"use client";

import { useEffect, useState, useCallback } from "react";
import { Clock, MapPin, ChevronDown, ChevronRight, Zap, Activity, Heart, Send, UserCheck } from "lucide-react";
import { eawsApi, isLocalTestApi } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import type { Incident } from "@/lib/models";
import SentinelShell from "@/components/SentinelShell";
import { insforge } from "@/lib/insforge";

const PRIORITY_TABS = ["Critical", "High", "Medium", "Pending Triage"] as const;
type PriorityTab = typeof PRIORITY_TABS[number];

const SEV_MAP: Record<PriorityTab, string[]> = {
  "Critical": ["critical"],
  "High": ["warning", "high"],
  "Medium": ["medium"],
  "Pending Triage": ["pending triage", "low"],
};

const PRIORITY_BADGE: Record<string, string> = {
  CRITICAL: "bg-red-600 text-white",
  WARNING: "bg-orange-500 text-white",
  MEDIUM: "bg-yellow-500 text-black",
  "PENDING TRIAGE": "bg-neutral-700 text-neutral-300",
  LOW: "bg-neutral-700 text-neutral-300",
};

const CAT_ICON: Record<string, string> = {
  MEDICAL: "🏥", SOS: "🆘", CRIME: "🚔", VIOLENCE: "🚔", FIRE: "🔥",
  DISASTER: "⚠️", NATURAL_HAZARD: "⚠️", ACCIDENT: "🚗", MISSING_PERSON: "🔎",
};

function timeAgo(iso: string) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  return m < 1 ? "just now" : m < 60 ? `${m}m ago` : `${Math.round(m / 60)}h ago`;
}

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [activeTab, setActiveTab] = useState<PriorityTab>("Critical");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [isDispatching, setIsDispatching] = useState(false);
  const [dispatchMsg, setDispatchMsg] = useState<string | null>(null);
  const [feedError, setFeedError] = useState<string | null>(null);

  const loadIncidents = useCallback(async () => {
    try {
      const data = await eawsApi.getLiveIncidents();
      setIncidents(data ?? []);
      setSelectedIncident((selected) =>
        data?.find((incident) => incident.id === selected?.id) ?? data?.[0] ?? null,
      );
      setFeedError(null);
    } catch (error) {
      setFeedError(error instanceof Error ? error.message : "Incident feed unavailable.");
      if (isLocalTestApi) {
        setIncidents([]);
        setSelectedIncident(null);
      }
    }
  }, []);

  useEffect(() => {
    loadIncidents();
    const iv = setInterval(loadIncidents, isLocalTestApi ? 1000 : 8000);
    if (isLocalTestApi) return () => clearInterval(iv);
    // InsForge Realtime subscription
    insforge.realtime.connect().then(() => {
      insforge.realtime.subscribe("incidents");
      insforge.realtime.on("db:incidents", () => { void loadIncidents(); });
    });
    return () => {
      clearInterval(iv);
      insforge.realtime.unsubscribe("incidents");
    };
  }, [loadIncidents]);

  const filtered = incidents.filter((incident) =>
    SEV_MAP[activeTab]?.includes(incident.severity.toLowerCase()),
  );

  const counts = {
    total: incidents.length,
    critical: incidents.filter((incident) => incident.severity.toLowerCase() === "critical").length,
    high: incidents.filter((incident) => ["warning", "high"].includes(incident.severity.toLowerCase())).length,
    pending: incidents.filter((incident) => ["pending triage", "low"].includes(incident.severity.toLowerCase())).length,
  };

  async function handleDispatch(inc: Incident, agency: string) {
    setIsDispatching(true);
    try {
      await eawsApi.dispatchIncident(inc.id, {
        agency_type: agency,
        priority: inc.severity.toLowerCase(),
        expected_version: inc.version,
      });
      setDispatchMsg(`${isLocalTestApi ? "TEST " : ""}${agency.toUpperCase()} dispatch recorded for ${inc.id}`);
      setTimeout(() => setDispatchMsg(null), 3000);
      await loadIncidents();
    } catch (error) {
      setDispatchMsg(`Dispatch failed: ${error instanceof Error ? error.message : "refresh and retry."}`);
      await loadIncidents();
    } finally {
      setIsDispatching(false);
    }
  }

  return (
    <SentinelShell title="Active Incidents" subtitle="Monitor citizen signals, coordinate dispatch, and broadcast updates back to the app">
      <div className="h-full flex flex-col overflow-hidden bg-[#090909]">

        {/* Stats bar */}
        <div className="grid grid-cols-4 gap-px border-b border-neutral-900 bg-neutral-900 shrink-0">
          {[
            { label: "Active Incidents", value: counts.total, sub: `${counts.critical} critical, ${counts.high} high priority, ${counts.pending} pending triage` },
            { label: "Critical", value: counts.critical, sub: "Immediate dispatch required" },
            { label: "High Priority", value: counts.high, sub: "Units en route or queued" },
            { label: "Pending Triage", value: counts.pending, sub: "Awaiting classification" },
          ].map((s) => (
            <div key={s.label} className="bg-[#0e0e0e] px-5 py-4">
              <p className="text-[10px] text-neutral-500 mb-1">{s.label}</p>
              <p className="text-3xl font-black text-white font-mono">{s.value}</p>
              <p className="text-[9px] text-neutral-600 mt-1">{s.sub}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-1 overflow-hidden">

          {/* LEFT: Incident Table */}
          <div className="flex-1 flex flex-col overflow-hidden">

            {/* Priority filter tabs */}
            <div className="flex items-center gap-2 px-5 py-3 border-b border-neutral-900 bg-[#0e0e0e] shrink-0">
              {PRIORITY_TABS.map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-colors ${
                    activeTab === tab
                      ? tab === "Critical" ? "bg-red-600 text-white"
                        : tab === "High" ? "bg-orange-500 text-white"
                        : tab === "Medium" ? "bg-yellow-500 text-black"
                        : "bg-neutral-700 text-white"
                      : "bg-neutral-900 text-neutral-400 hover:text-white hover:bg-neutral-800"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Table header */}
            <div className="grid grid-cols-[1.2fr_1fr_0.7fr_0.7fr_0.9fr_1.2fr] gap-4 px-5 py-2.5 border-b border-neutral-900 bg-[#0a0a0a] text-[9px] font-bold tracking-widest text-neutral-600 uppercase shrink-0">
              <span>ID / Citizen</span><span>Type</span><span>Priority</span><span>Location</span><span>Reported</span><span>Status / Actions</span>
            </div>

            {/* Scrollable incidents */}
            {dispatchMsg && (
              <div role="status" className={`mx-5 mt-2 text-[10px] ${dispatchMsg.startsWith("Dispatch failed") ? "text-red-300 bg-red-500/10 border-red-500/20" : "text-green-400 bg-green-500/10 border-green-500/20"} border rounded px-3 py-2`}>{dispatchMsg}</div>
            )}

            <div className="flex-1 overflow-y-auto">
              {feedError && (
                <div role="alert" className="m-5 rounded-lg border border-red-800/60 bg-red-950/30 px-4 py-3 text-xs text-red-200">
                  Incident feed unavailable. {feedError}
                </div>
              )}
              {filtered.length === 0 && !feedError && (
                <div className="m-5 rounded-lg border border-neutral-800 bg-neutral-950 px-4 py-5 text-sm text-neutral-400">
                  No incidents match this priority.
                </div>
              )}
              {filtered.map((inc) => {
                const incMeta = (inc as any)?.metadata || {};
                const isExpanded = expandedId === inc.id;
                const isSelected = selectedIncident?.id === inc.id;
                const dispatchRecorded = ["dispatched", "en_route", "on_scene", "resolved", "dismissed", "retracted", "merged"].includes(inc.status);
                return (
                  <div key={inc.id} className={`border-b border-neutral-900 transition-colors ${isSelected ? "bg-red-500/5" : "hover:bg-neutral-900/50"}`}>

                    {/* Main row */}
                    <div
                      className="grid grid-cols-[1.2fr_1fr_0.7fr_0.7fr_0.9fr_1.2fr] gap-4 px-5 py-3.5 cursor-pointer items-start"
                      onClick={() => { setSelectedIncident(inc); setExpandedId(isExpanded ? null : inc.id); }}
                    >
                      <div>
                        <p className="text-[11px] font-black text-white font-mono">{inc.id}</p>
                        <p className="text-[10px] text-neutral-400 mt-0.5">{inc.user_name || incMeta.patient_name || "Reporter unavailable"}</p>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-neutral-300">
                        <span>{CAT_ICON[inc.category.toUpperCase()] || "🔔"}</span>
                        <span className="capitalize">{inc.category}</span>
                      </div>
                      <div>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase ${PRIORITY_BADGE[inc.severity.toUpperCase()] || PRIORITY_BADGE["LOW"]}`}>
                          {["warning", "high"].includes(inc.severity.toLowerCase()) ? "High" : inc.severity.toLowerCase() === "pending triage" ? "Pending" : inc.severity}
                          {inc.severity_confidence === "unverified" ? " · Unverified" : ""}
                        </span>
                      </div>
                      <p className="text-[10px] text-neutral-400 flex items-center gap-1">
                        <MapPin size={9} /> {inc.location_name?.split(",")[0] || "Location unavailable"}
                      </p>
                      <p className="text-[10px] text-neutral-500 flex items-center gap-1">
                        <Clock size={9} /> {timeAgo(inc.created_at)}
                      </p>
                      <div className="flex flex-col gap-1">
                        <div className="flex gap-1.5 items-center">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDispatch(inc, "police"); }}
                            disabled={isDispatching || dispatchRecorded}
                            className="text-[9px] font-bold bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded transition-colors disabled:opacity-50"
                          >
                            {dispatchRecorded ? "Dispatch recorded" : isLocalTestApi ? "TEST Dispatch" : "Dispatch"}
                          </button>
                          {isExpanded ? <ChevronDown size={12} className="text-neutral-500" /> : <ChevronRight size={12} className="text-neutral-500" />}
                        </div>
                        <p className="px-2 text-[9px] text-neutral-400">
                          {inc.status.replaceAll("_", " ")} · {inc.operator_name || "Unassigned"}
                        </p>
                        <button
                          type="button"
                          disabled
                          title="Live unit availability and assignment are not connected."
                          className="text-[9px] font-bold bg-neutral-800 text-neutral-500 px-2 py-1 rounded text-left disabled:cursor-not-allowed"
                        >
                          Unit assignment unavailable
                        </button>
                        <button disabled className="text-[9px] text-neutral-500 px-2 py-0.5 text-left transition-colors disabled:cursor-not-allowed">
                          {isLocalTestApi ? "Messaging unavailable in TEST" : "Message App"}
                        </button>
                      </div>
                    </div>

                    {/* Expanded row */}
                    {isExpanded && (
                      <div className="grid grid-cols-3 gap-4 px-5 pb-3 pt-1 bg-neutral-950/50 border-t border-neutral-900/50 fade-in">
                        <div>
                          <p className="text-[8px] font-bold tracking-widest text-neutral-600 uppercase mb-1">Chief Complaint</p>
                          <p className="text-[10px] text-neutral-300">{inc.description || "No additional details"}</p>
                        </div>
                        <div>
                          <p className="text-[8px] font-bold tracking-widest text-neutral-600 uppercase mb-1">Decision support</p>
                          <p className="text-[10px] text-neutral-500">No validated decision-support output is available.</p>
                        </div>
                        <div>
                          <p className="text-[8px] font-bold tracking-widest text-neutral-600 uppercase mb-1">Medical data</p>
                          <p className="text-[10px] text-amber-300">Masked · audited reveal unavailable</p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* RIGHT: Incident Detail + Quick Actions */}
          {selectedIncident && (
            <div className="w-[280px] min-w-[280px] border-l border-neutral-900 bg-[#0e0e0e] overflow-y-auto flex flex-col fade-in">
              <div className="px-4 pt-4 pb-3 border-b border-neutral-900">
                <p className="text-[8px] font-bold tracking-widest text-neutral-600 uppercase mb-1">Incident Detail</p>
              </div>

              <div className="px-4 py-3 border-b border-neutral-900 space-y-3">
                <div>
                  <p className="text-[8px] font-bold tracking-widest text-neutral-600 uppercase mb-1">Chief Complaint</p>
                  <p className="text-[11px] text-neutral-300 leading-relaxed">{selectedIncident.description || "No description"}</p>
                </div>
                <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-3">
                  <p className="text-[10px] font-bold text-neutral-300">Medical data masked</p>
                  <p className="mt-1 text-[9px] text-neutral-500">Authorized reveal and access audit are not connected.</p>
                </div>
                <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-3">
                  <p className="text-[10px] font-bold text-neutral-300">Decision support unavailable</p>
                  <p className="mt-1 text-[9px] text-neutral-500">No validated model output or input record is connected.</p>
                </div>
              </div>

              <div className="px-4 py-3">
                <p className="text-[8px] font-bold tracking-widest text-neutral-600 uppercase mb-3">Quick Actions</p>
                <div className="space-y-2">
                  <button
                    onClick={() => handleDispatch(selectedIncident, "police")}
                    disabled={isDispatching || ["dispatched", "en_route", "on_scene", "resolved", "dismissed", "retracted", "merged"].includes(selectedIncident.status)}
                    className="w-full py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold transition-colors disabled:opacity-50"
                  >
                    {isLocalTestApi ? "TEST Dispatch Unit" : "Dispatch Unit"}
                  </button>
                  <button
                    onClick={() => handleDispatch(selectedIncident, "fire")}
                    disabled={isDispatching || ["dispatched", "en_route", "on_scene", "resolved", "dismissed", "retracted", "merged"].includes(selectedIncident.status)}
                    className="w-full py-2.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[11px] font-bold transition-colors disabled:opacity-50"
                  >
                    {isLocalTestApi ? "TEST Dispatch Fire Service" : "Assign Agency"}
                  </button>
                  <button disabled className="w-full py-2.5 rounded-lg bg-neutral-900 text-neutral-500 text-[11px] font-bold transition-colors disabled:cursor-not-allowed">
                    {isLocalTestApi ? "Messaging unavailable in TEST" : "Message App"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </SentinelShell>
  );
}
