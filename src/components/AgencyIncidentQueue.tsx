"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, MapPin, RefreshCw, Send } from "lucide-react";
import { eawsApi, isLocalTestApi } from "@/lib/api";
import type { Incident } from "@/lib/models";
import { supabase } from "@/lib/supabase";
import SentinelShell from "@/components/SentinelShell";
import { insforge } from "@/lib/insforge";

type AgencyIncidentQueueProps = {
  agencyType: "fire" | "ambulance";
  categories: string[];
  title: string;
  subtitle: string;
  emptyMessage: string;
};

const SEVERITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  warning: 1,
  medium: 2,
  low: 3,
};

const CLOSED_STATUSES = new Set([
  "dispatched",
  "en_route",
  "on_scene",
  "resolved",
  "dismissed",
  "retracted",
  "merged",
]);

function ageLabel(createdAt: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - Date.parse(createdAt)) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

export default function AgencyIncidentQueue({
  agencyType,
  categories,
  title,
  subtitle,
  emptyMessage,
}: AgencyIncidentQueueProps) {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dispatchingId, setDispatchingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadIncidents = useCallback(async () => {
    try {
      const results = await eawsApi.getLiveIncidents();
      const normalizedCategories = new Set(categories.map((category) => category.toLowerCase()));
      setIncidents(
        results
          .filter((incident) => normalizedCategories.has(incident.category.toLowerCase()))
          .sort((a, b) => {
            const priorityDifference =
              (SEVERITY_ORDER[a.severity.toLowerCase()] ?? 4) -
              (SEVERITY_ORDER[b.severity.toLowerCase()] ?? 4);
            return priorityDifference || Date.parse(a.created_at) - Date.parse(b.created_at);
          }),
      );
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Incident feed unavailable.");
      if (isLocalTestApi) setIncidents([]);
    } finally {
      setLoading(false);
    }
  }, [categories]);

  useEffect(() => {
    void Promise.resolve().then(loadIncidents);
    const interval = setInterval(loadIncidents, isLocalTestApi ? 1000 : 8000);
    if (isLocalTestApi) return () => clearInterval(interval);
    // InsForge Realtime subscription
    const channel = `${agencyType}-incident-queue`;
    insforge.realtime.connect().then(() => {
      insforge.realtime.subscribe(channel);
      insforge.realtime.on("db:incidents", () => { void loadIncidents(); });
    });
    return () => {
      clearInterval(interval);
      insforge.realtime.unsubscribe(channel);
    };
  }, [agencyType, loadIncidents]);

  async function dispatch(incident: Incident) {
    setDispatchingId(incident.id);
    setNotice(null);
    try {
      await eawsApi.dispatchIncident(incident.id, {
        agency_type: agencyType,
        priority: incident.severity.toLowerCase(),
        expected_version: incident.version,
      });
      setNotice(`${isLocalTestApi ? "TEST " : ""}${agencyType} dispatch recorded for ${incident.id}.`);
      await loadIncidents();
    } catch (dispatchError) {
      setNotice(
        dispatchError instanceof Error
          ? `Dispatch failed: ${dispatchError.message}`
          : "Dispatch failed. Refresh the queue before retrying.",
      );
      await loadIncidents();
    } finally {
      setDispatchingId(null);
    }
  }

  return (
    <SentinelShell title={title} subtitle={subtitle}>
      <section className="h-full overflow-y-auto bg-[#090909] p-5">
        {isLocalTestApi && (
          <div role="status" className="mb-4 rounded-lg border border-amber-700/50 bg-amber-950/40 px-4 py-3 text-xs text-amber-200">
            TEST dispatch records a synthetic unit on the shared incident. No physical responder is contacted.
          </div>
        )}
        {error && (
          <div role="alert" className="mb-4 rounded-lg border border-red-800/60 bg-red-950/30 px-4 py-3 text-xs text-red-200">
            Incident feed unavailable. {error}
          </div>
        )}
        {notice && (
          <div role="status" className="mb-4 rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-3 text-xs text-neutral-200">
            {notice}
          </div>
        )}
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-white">Priority queue</h2>
            <p className="mt-1 text-xs text-neutral-500">{incidents.length} matching incidents · severity, then wait time</p>
          </div>
          <button
            type="button"
            onClick={() => void loadIncidents()}
            className="inline-flex items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs font-semibold text-neutral-200 hover:bg-neutral-800"
          >
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
        {loading && incidents.length === 0 ? (
          <p className="rounded-xl border border-neutral-800 bg-neutral-950 p-5 text-sm text-neutral-400">Loading incident feed…</p>
        ) : incidents.length === 0 ? (
          <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-5 text-sm text-neutral-400">
            <AlertTriangle size={16} className="mb-2 text-neutral-500" />
            {error ? "No incident data is available; retry when the feed is restored." : emptyMessage}
          </div>
        ) : (
          <div className="space-y-3">
            {incidents.map((incident) => {
              const alreadyDispatched = CLOSED_STATUSES.has(incident.status);
              return (
                <article key={incident.id} className="rounded-xl border border-neutral-800 bg-[#101010] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <h3 className="font-mono text-sm font-bold text-white">{incident.id}</h3>
                        <span className="rounded border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[10px] font-bold uppercase text-red-300">
                          {incident.severity}
                          {incident.severity_confidence === "unverified" ? " · unverified" : ""}
                        </span>
                        <span className="rounded border border-neutral-700 px-2 py-0.5 text-[10px] uppercase text-neutral-300">
                          {incident.status.replaceAll("_", " ")}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-neutral-100">{incident.title}</p>
                      {incident.description && <p className="mt-1 text-xs text-neutral-400">{incident.description}</p>}
                      <p className="mt-2 flex items-center gap-1 text-xs text-neutral-400">
                        <MapPin size={12} />
                        {incident.location_name || "Location unavailable"}
                      </p>
                      <p className="mt-1 text-[11px] text-neutral-500">
                        {incident.user_name || "Reporter unavailable"} · {ageLabel(incident.created_at)} · {incident.operator_name || "Unassigned"}
                      </p>
                      {incident.dispatch_unit && (
                        <p className="mt-1 text-[11px] font-semibold text-emerald-300">
                          Current assignment: {incident.dispatch_unit}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      disabled={alreadyDispatched || dispatchingId !== null}
                      onClick={() => void dispatch(incident)}
                      className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-red-700 px-3 py-2 text-xs font-bold text-white hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Send size={12} />
                      {alreadyDispatched
                        ? incident.dispatch_unit
                          ? `Assigned: ${incident.dispatch_unit}`
                          : "Dispatch already recorded"
                        : dispatchingId === incident.id
                          ? "Recording…"
                          : isLocalTestApi
                            ? "TEST Dispatch"
                            : "Dispatch"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </SentinelShell>
  );
}
