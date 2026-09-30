"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Clock, MapPin, Activity, Radio, Phone, Send,
  Shield, Flame, AlertTriangle, Wifi, ChevronRight, X,
  Zap, Heart, PanelLeftClose, PanelRightClose, PanelRightOpen, ChevronLeft
} from "lucide-react";
import { eawsApi, isLocalTestApi } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import type { AgencyUnit, Incident } from "@/lib/models";
import SentinelShell from "@/components/SentinelShell";

const LiveMap = dynamic(() => import("@/components/Map"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-neutral-950 text-neutral-500">
      <p className="text-xs font-mono tracking-widest animate-pulse">Initializing Secure Map Feed...</p>
    </div>
  ),
});

function timeAgo(iso: string) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  return `${Math.round(mins / 60)}h ago`;
}

const SEVERITY_ORDER: Record<string, number> = {
  critical: 4,
  high: 3,
  warning: 3,
  medium: 2,
  low: 1,
  "pending triage": 0,
};

function sortIncidentsByPriority(items: Incident[]) {
  return [...items].sort((a, b) => {
    const aIsSos = a.category.toLowerCase() === "sos";
    const bIsSos = b.category.toLowerCase() === "sos";
    if (aIsSos !== bIsSos) return aIsSos ? -1 : 1;
    const severityDifference =
      (SEVERITY_ORDER[String(b.severity).toLowerCase()] ?? 0) -
      (SEVERITY_ORDER[String(a.severity).toLowerCase()] ?? 0);
    return severityDifference || Date.parse(a.created_at) - Date.parse(b.created_at);
  });
}

const PRIORITY_COLOR: Record<string, string> = {
  CRITICAL: "text-red-400 bg-red-500/10 border-red-500/30",
  WARNING: "text-orange-400 bg-orange-500/10 border-orange-500/30",
  MEDIUM: "text-yellow-400 bg-yellow-500/10 border-yellow-500/30",
  LOW: "text-green-400 bg-green-500/10 border-green-500/30",
  "PENDING TRIAGE": "text-neutral-400 bg-neutral-500/10 border-neutral-500/30",
};

export default function DashboardPage() {
  const router = useRouter();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [units, setUnits] = useState<AgencyUnit[]>([]);
  const [apiStatus, setApiStatus] = useState<"live" | "unavailable">("unavailable");
  const [apiError, setApiError] = useState<string | null>(null);
  const feedSnapshotRef = useRef("");
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [isDispatching, setIsDispatching] = useState(false);
  const [dispatchSuccess, setDispatchSuccess] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "info" | "error" } | null>(null);

  // Modals state
  const [isTeleMedActive, setIsTeleMedActive] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [callSeconds, setCallSeconds] = useState(0);

  function showToast(msg: string, type: "success" | "info" | "error" = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  const loadData = useCallback(async () => {
    try {
      const [liveIncidents, liveUnits] = await Promise.all([
        eawsApi.getLiveIncidents(),
        eawsApi.getLiveUnits(),
      ]);
      const prioritizedIncidents = sortIncidentsByPriority(liveIncidents ?? []);
      const feedSnapshot = JSON.stringify(prioritizedIncidents);
      if (feedSnapshot !== feedSnapshotRef.current) {
        feedSnapshotRef.current = feedSnapshot;
        setIncidents(prioritizedIncidents);
        setSelectedIncident((prev) =>
          prioritizedIncidents.find((incident) => incident.id === prev?.id) ??
          prioritizedIncidents[0] ??
          null
        );
      }
      setUnits((previousUnits) =>
        previousUnits.length === 0 && (liveUnits ?? []).length === 0
          ? previousUnits
          : liveUnits ?? []
      );
      setApiStatus("live");
      setApiError(null);
    } catch (error) {
      setApiStatus("unavailable");
      setApiError(error instanceof Error ? error.message : "Unknown API error");
      console.error("Dashboard feed unavailable:", error);
      if (isLocalTestApi) {
        feedSnapshotRef.current = "";
        setIncidents([]);
        setUnits([]);
        setSelectedIncident(null);
      }
    }
  }, []);

  useEffect(() => {
    loadData();
    const iv = setInterval(loadData, isLocalTestApi ? 1000 : 8000);
    if (isLocalTestApi) return () => clearInterval(iv);
    const channel = supabase
      .channel("dashboard-incidents")
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "incidents" }, loadData)
      .subscribe();
    return () => { clearInterval(iv); supabase.removeChannel(channel); };
  }, [loadData]);

  async function handleDispatch(agencyType: string, incidentOverride?: typeof selectedIncident) {
    const target = incidentOverride || selectedIncident;
    if (!target) return;
    setIsDispatching(true);
    try {
      await eawsApi.dispatchIncident(target.id, {
        agency_type: agencyType,
        priority: target.severity.toLowerCase(),
        expected_version: target.version,
      });
      setDispatchSuccess(`${agencyType.toUpperCase()} unit dispatched to ${target.location_name || "incident"}!`);
      showToast(`✅ ${agencyType.toUpperCase()} dispatched to ${target.location_name || "incident"}`, "success");
      setTimeout(() => setDispatchSuccess(null), 3000);
      loadData();
    } catch (err: any) {
      const msg = err.message?.includes('duplicate') ? 'Already dispatched to this incident.' : err.message;
      showToast(`⚠️ Dispatch failed: ${msg}`, "error");
    } finally {
      setIsDispatching(false);
    }
  }

  // Tele-Med call timer
  useEffect(() => {
    if (!isTeleMedActive) { setCallSeconds(0); return; }
    const t = setInterval(() => setCallSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [isTeleMedActive]);

  function formatCallTime(secs: number) {
    const m = String(Math.floor(secs / 60)).padStart(2, '0');
    const s = String(secs % 60).padStart(2, '0');
    return `${m}:${s}`;
  }

  const visibleIncidents = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    return incidents.filter((incident) => {
      const severity = String(incident.severity).toLocaleLowerCase();
      const normalizedSeverity = severity === "warning" ? "high" : severity;
      const matchesSeverity = severityFilter === "all" || normalizedSeverity === severityFilter;
      const searchableText = [
        incident.id,
        incident.title,
        incident.description,
        incident.category,
        incident.location_name,
        incident.user_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase();
      return matchesSeverity && (!query || searchableText.includes(query));
    });
  }, [incidents, searchQuery, severityFilter]);
  const topIncident =
    visibleIncidents.find((incident) => incident.id === selectedIncident?.id) ??
    visibleIncidents[0] ??
    null;
  const meta = topIncident?.metadata || {};
  const testDispatchAlreadyRecorded =
    isLocalTestApi &&
    Boolean(
      topIncident?.dispatch_unit ||
        ["dispatched", "en_route", "on_scene", "resolved", "dismissed", "retracted", "merged"].includes(
          topIncident?.status ?? "",
        ),
    );
  const dispatchDisabled =
    isDispatching || !topIncident || testDispatchAlreadyRecorded;
  const mapIncidents = useMemo(() => visibleIncidents.slice(0, 100), [visibleIncidents]);

  const [isLeftOpen, setIsLeftOpen] = useState(true);
  const [isRightOpen, setIsRightOpen] = useState(true);

  return (
    <SentinelShell
      title="Sentinel Command"
      subtitle="Monitor citizen signals, coordinate dispatch, and broadcast updates back to the app."
      searchValue={searchQuery}
      onSearchChange={setSearchQuery}
    >
      <div className="flex h-full overflow-hidden relative">

        {/* ── LEFT PANEL: Priority Incident Card ── */}
        <div
          className="h-full overflow-y-auto bg-[#0e0e0e] border-r border-neutral-900 flex flex-col gap-0 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] z-10"
          style={{ width: isLeftOpen ? "280px" : "0px", minWidth: isLeftOpen ? "280px" : "0px", opacity: isLeftOpen ? 1 : 0, overflow: isLeftOpen ? "auto" : "hidden" }}
        >

          {/* Priority header */}
          <div className="px-4 pt-4 pb-3 border-b border-neutral-900 flex items-center justify-between">
            <div>
              <p className="text-[8px] font-bold tracking-[0.2em] text-neutral-500 uppercase mb-0.5">Priority 1 · Immediate</p>
              <h2 className="text-lg font-black text-white font-mono">{topIncident?.id || "—"}</h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded uppercase">
                {topIncident
                  ? `${String(topIncident.severity).toUpperCase()}${
                      topIncident.severity_confidence === "unverified" || topIncident.is_verified === false
                        ? " · UNVERIFIED"
                        : ""
                    }`
                  : "—"}
              </span>
              <button
                onClick={() => setIsLeftOpen(false)}
                title="Slide to Minimize Priority Panel"
                className="p-1.5 rounded-lg text-neutral-400 hover:text-white bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 transition-all flex items-center justify-center"
              >
                <PanelLeftClose size={14} />
              </button>
            </div>
          </div>

          {/* Citizen info */}
          <div className="px-4 py-3 border-b border-neutral-900 cursor-pointer hover:bg-neutral-900/50 transition-colors" onClick={() => setIsProfileModalOpen(true)}>
            <div className="flex justify-between items-center mb-1">
              <p className="text-[8px] font-bold tracking-widest text-neutral-600 uppercase">Name</p>
              <ChevronRight size={12} className="text-neutral-600" />
            </div>
            <p className="text-sm font-bold text-white">
              {topIncident?.user_name || topIncident?.title?.split("—")[1]?.trim() || topIncident?.title || "Unknown Citizen"}
            </p>

            <div className="mt-3 rounded-lg border border-neutral-800 bg-neutral-900 p-3">
              <p className="text-[10px] font-bold text-neutral-300">Medical data masked</p>
              <p className="mt-1 text-[9px] text-neutral-500">Authorized reveal and access audit are not connected.</p>
            </div>
          </div>

          {/* AI Prediction */}
          {meta.ai_confidence && (
            <div className="px-4 py-3 border-b border-neutral-900">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <Zap size={11} className="text-yellow-400" />
                  <span className="text-[10px] font-bold text-neutral-300">AI Prediction Model v4.2</span>
                </div>
                <span className="text-[9px] font-bold text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 px-1.5 py-0.5 rounded">
                  {meta.ai_confidence}% confidence
                </span>
              </div>
              <div className="space-y-2">
                <div>
                  <div className="flex justify-between text-[9px] mb-1">
                    <span className="text-neutral-400">{meta.ai_risk || "Risk Assessment"}</span>
                    <span className="text-red-400 font-bold uppercase">Critical</span>
                  </div>
                  <div className="h-1 rounded-full bg-neutral-800">
                    <div className="h-1 rounded-full bg-red-500" style={{ width: `${meta.ai_confidence}%` }} />
                  </div>
                </div>
                {meta.trauma_score && (
                  <div>
                    <div className="flex justify-between text-[9px] mb-1">
                      <span className="text-neutral-400">Trauma Severity Score</span>
                      <span className="text-neutral-300 font-mono">{meta.trauma_score}/15</span>
                    </div>
                    <div className="h-1 rounded-full bg-neutral-800">
                      <div className="h-1 rounded-full bg-orange-500" style={{ width: `${(meta.trauma_score / 15) * 100}%` }} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Chief Complaint */}
          {topIncident?.description && (
            <div className="px-4 py-3 border-b border-neutral-900">
              <p className="text-[8px] font-bold tracking-widest text-neutral-600 uppercase mb-1.5">Chief Complaint</p>
              <p className="text-[11px] text-neutral-300 leading-relaxed italic">
                &ldquo;{topIncident.description}&rdquo;
              </p>
            </div>
          )}

          {/* Action buttons */}
          <div className="px-4 py-3 border-b border-neutral-900 space-y-2">
            {dispatchSuccess && (
              <div className="text-[10px] text-green-400 bg-green-500/10 border border-green-500/20 rounded px-2 py-1.5">{dispatchSuccess}</div>
            )}
            <button
              className={`w-full py-2.5 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-2 ${
                isLocalTestApi
                  ? "bg-neutral-800 text-neutral-500 cursor-not-allowed"
                  : "bg-red-600 hover:bg-red-700 text-white"
              }`}
              disabled={isLocalTestApi}
              title={isLocalTestApi ? "Calling is disabled in the local test API" : "Initiate tele-medicine link"}
              onClick={() => setIsTeleMedActive(true)}
            >
            <Phone size={12} /> {isLocalTestApi ? "Call unavailable in TEST" : "Initiate Tele-Med Link"}
            </button>
            <button
              disabled={dispatchDisabled}
              onClick={() => handleDispatch("police", topIncident)}
              className="w-full py-2.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Send size={12} />{" "}
              {testDispatchAlreadyRecorded
                ? "TEST Dispatch already recorded"
                : isLocalTestApi
                  ? "TEST Dispatch Unit"
                  : "Dispatch Unit"}
            </button>
          </div>

          {/* Agency Dispatch Actions */}
          <div className="px-4 py-3">
            <p className="text-[8px] font-bold tracking-widest text-neutral-600 uppercase mb-3">Quick Dispatch</p>
            <p className="text-[9px] text-neutral-600 mb-3">Dispatch selected incident to a specific agency</p>
            {[
              { key: "fire", label: "Fire Service", sub: "GNFS dispatch channel", color: "bg-orange-600 hover:bg-orange-700", portal: "/fire" },
              { key: "police", label: "Police", sub: "Threat and patrol routing", color: "bg-blue-600 hover:bg-blue-700", portal: "/police" },
              { key: "ambulance", label: "Ambulance", sub: "Medical response unit", color: "bg-green-600 hover:bg-green-700", portal: "/ambulance" },
            ].map((ag) => (
              <div key={ag.key} className="py-2 border-b border-neutral-900 last:border-0">
                <div className="flex items-center justify-between mb-1.5">
                  <div>
                    <p className="text-[11px] font-semibold text-white">{ag.label}</p>
                    <p className="text-[9px] text-neutral-500">{ag.sub}</p>
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <button
                    disabled={dispatchDisabled}
                    onClick={() => handleDispatch(ag.key)}
                    className={`flex-1 text-[9px] font-bold text-white py-1.5 rounded transition-colors disabled:opacity-50 ${ag.color}`}
                  >
                    {testDispatchAlreadyRecorded
                      ? "TEST Dispatch already recorded"
                      : isLocalTestApi
                        ? `TEST Dispatch ${ag.label}`
                        : `Dispatch ${ag.label}`}
                  </button>
                  <button
                    onClick={() => router.push(ag.portal)}
                    className="px-2 text-[9px] font-bold bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white py-1.5 rounded transition-colors"
                  >
                    Open Portal →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── CENTER: Full Map ── */}
        <div className="flex-1 relative min-w-0">
          <LiveMap
            incidents={mapIncidents}
            units={units}
            onSelectIncident={(id) => {
              const found = incidents.find((inc) => inc.id === id);
              if (found) {
                setSelectedIncident(found);
                setIsLeftOpen(true);
              }
            }}
          />

          {/* Floating re-open button for Dispatch Queue when closed */}
          {!isRightOpen && (
            <button
              onClick={() => setIsRightOpen(true)}
              className="absolute right-4 bottom-8 z-[1000] flex items-center gap-2.5 bg-[#141414]/95 hover:bg-[#1c1c1e] border border-red-500/70 hover:border-red-500 text-white text-[12px] font-bold px-4 py-2.5 rounded-2xl transition-all shadow-[0_0_25px_rgba(239,68,68,0.3)] hover:shadow-[0_0_30px_rgba(239,68,68,0.5)] backdrop-blur-md group"
              title="Open Dispatch Queue"
            >
              <PanelRightOpen size={16} className="text-red-400 group-hover:translate-x-0.5 transition-transform" />
              <span>Dispatch Queue</span>
              {visibleIncidents.length > 0 && (
                <span className="bg-red-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full min-w-[20px] text-center shadow">
                  {visibleIncidents.length}
                </span>
              )}
            </button>
          )}
        </div>

        {/* ── RIGHT PANEL: Dispatch Queue + System Health ── */}
        <div
          className="h-full bg-[#0e0e0e] border-l border-neutral-900 flex flex-col transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] z-10"
          style={{ width: isRightOpen ? "280px" : "0px", minWidth: isRightOpen ? "280px" : "0px", opacity: isRightOpen ? 1 : 0, overflow: isRightOpen ? "auto" : "hidden" }}
        >

          {/* Dispatch Queue */}
          <div className="px-4 pt-4 pb-2 border-b border-neutral-900">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-bold tracking-widest text-neutral-400 uppercase">Dispatch Queue</p>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-bold text-neutral-500 bg-neutral-900 border border-neutral-800 rounded px-1.5 py-0.5">
                  {visibleIncidents.length} of {incidents.length} reports
                </span>
                <button
                  onClick={() => setIsRightOpen(false)}
                  title="Slide to Minimize Dispatch Queue"
                  className="p-1.5 rounded-lg text-neutral-400 hover:text-white bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 transition-all flex items-center justify-center"
                >
                  <PanelRightClose size={14} />
                </button>
              </div>
            </div>
            <label className="block mb-3">
              <span className="sr-only">Filter reports by severity</span>
              <select
                aria-label="Filter reports by severity"
                value={severityFilter}
                onChange={(event) => setSeverityFilter(event.target.value)}
                className="w-full rounded border border-neutral-800 bg-neutral-900 px-2 py-1.5 text-[10px] text-neutral-200"
              >
                <option value="all">All priorities</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </label>

            <div className="space-y-2">
              {visibleIncidents.slice(0, 4).map((inc) => (
                <div
                  key={inc.id}
                  onClick={() => {
                    setSelectedIncident(inc);
                    setIsLeftOpen(true);
                  }}
                  className={`rounded-lg border p-3 cursor-pointer transition-all hover:border-neutral-700 ${
                    selectedIncident?.id === inc.id ? "border-red-600/50 bg-red-500/5" : "border-neutral-800 bg-neutral-900/50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-[9px] font-bold text-neutral-500 uppercase mb-0.5">
                        {String(inc.severity).toUpperCase()}
                        {inc.severity_confidence === "unverified" || inc.is_verified === false
                          ? " · UNVERIFIED"
                          : ""}
                      </p>
                      <p className="text-[11px] font-semibold text-white leading-tight truncate">{inc.title}</p>
                      <p className="text-[9px] text-neutral-500 flex items-center gap-1 mt-0.5">
                        <MapPin size={8} /> {inc.location_name || "Location unavailable"}
                      </p>
                      <p className="text-[9px] text-neutral-500 mt-1">
                        {inc.status.replaceAll("_", " ")} · {inc.operator_name || inc.assigned_to || "Unassigned"} · {timeAgo(inc.created_at)}
                      </p>
                    </div>
                    <span className={`shrink-0 text-[8px] font-bold border rounded px-1.5 py-0.5 ${PRIORITY_COLOR[String(inc.severity).toUpperCase()] || PRIORITY_COLOR["LOW"]}`}>
                      {String(inc.severity).toUpperCase() === "CRITICAL"
                        ? "CRITICAL"
                        : ["WARNING", "HIGH"].includes(String(inc.severity).toUpperCase())
                          ? "HIGH"
                          : ["LOW", "MEDIUM"].includes(String(inc.severity).toUpperCase())
                            ? String(inc.severity).toUpperCase()
                            : "TRIAGE"}
                    </span>
                  </div>

                  <div className="flex gap-1.5 mt-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedIncident(inc);
                        setIsLeftOpen(true);
                        handleDispatch("police", inc);
                      }}
                      disabled={isDispatching}
                      className="flex-1 text-[9px] font-bold bg-red-600 hover:bg-red-700 text-white py-1 rounded transition-colors disabled:opacity-50"
                    >
                      {isLocalTestApi ? "TEST Dispatch" : "Dispatch"}
                    </button>
                    <button
                    disabled
                    title="Citizen messaging is not connected to this dashboard"
                    onClick={(e) => { e.stopPropagation(); showToast("Messaging service is not connected.", "error"); }}
                    className="flex-1 text-[9px] font-bold bg-neutral-800 text-neutral-500 py-1 rounded transition-colors disabled:cursor-not-allowed"
                    >
                    Messaging unavailable
                    </button>
                  </div>
                </div>
              ))}

              {visibleIncidents.length === 0 && (
                <p className="text-[10px] text-neutral-500 py-3" role="status">
                  {incidents.length > 0
                    ? "No reports match the current search and priority filters."
                    : apiStatus === "live"
                    ? isLocalTestApi
                      ? "No reports in the test feed."
                      : "The configured API returned no reports."
                    : isLocalTestApi
                      ? "Test feed unavailable; no sample incidents are shown."
                      : "Configured API unavailable; sample incidents are not shown."}
                </p>
              )}
            </div>
          </div>

          {/* System Health */}
          <div className="px-4 py-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-bold tracking-widest text-neutral-400 uppercase">System Health</p>
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                isLocalTestApi
                  ? "text-yellow-300 bg-yellow-500/10 border border-yellow-500/20"
                  : "text-neutral-400 bg-neutral-500/10 border border-neutral-500/20"
              }`}>
                {isLocalTestApi ? "TEST ONLY" : "Unverified"}
              </span>
            </div>
            <p className="text-[9px] text-neutral-600 mb-3">
            {isLocalTestApi ? "Local test bench · no real dispatch" : "Connectivity and fallback status"}
            </p>

            <div className="space-y-3">
            <div className="flex justify-between text-[10px]">
              <span className="text-neutral-400">Test API</span>
              <span className={`font-bold ${apiStatus === "live" ? "text-green-400" : "text-red-400"}`}>
                {apiStatus === "live" ? "Connected" : "Unavailable"}
              </span>
            </div>
            <div className="flex justify-between text-[10px]">
              <span className="text-neutral-400">Location accuracy</span>
              <span className="text-neutral-300 font-mono font-bold">Per report / unknown</span>
              </div>
            <div className="flex justify-between text-[10px]">
              <span className="text-neutral-400">Realtime / push</span>
              <span className="text-yellow-400 font-bold">Not connected</span>
            </div>
            <div className="flex justify-between text-[10px] pt-1 border-t border-neutral-900">
              <span className="text-neutral-400">SMS fallback</span>
              <span className="text-yellow-400 font-bold">Not connected</span>
            </div>
            <div className="flex justify-between text-[10px]">
              <span className="text-neutral-400">Feed source</span>
              <span className={`font-bold ${apiStatus === "live" ? "text-green-400" : "text-red-400"}`}>
                {apiStatus === "live" ? (isLocalTestApi ? "TEST API" : "Configured API") : "Unavailable"}
              </span>
            </div>
            {apiError && (
              <p className="text-[9px] text-red-300 break-words" role="status">
                {apiError}
              </p>
            )}
            </div>
          </div>
        </div>
      </div>

      {/* Global Toast Notification */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-[100] px-5 py-3 rounded-xl shadow-2xl text-sm font-semibold border backdrop-blur-md transition-all ${
          toast.type === 'success' ? 'bg-green-500/20 border-green-500/40 text-green-300' :
          toast.type === 'error' ? 'bg-red-500/20 border-red-500/40 text-red-300' :
          'bg-blue-500/20 border-blue-500/40 text-blue-300'
        }`}>
          {toast.msg}
        </div>
      )}

      {/* Tele-Med Video Call Modal */}
      {isTeleMedActive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in zoom-in duration-200">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden shadow-2xl w-full max-w-4xl flex flex-col">
            <div className="flex items-center justify-between p-4 bg-black border-b border-neutral-800">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-red-500/20 text-red-500">
                  <Heart size={16} />
                </div>
                <div>
                  <h3 className="text-white font-bold text-sm">Tele-Med Link Active</h3>
                  <p className="text-red-400 text-xs flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                    Live stream from citizen device
                  </p>
                </div>
              </div>
              <div className="text-white font-mono text-xl bg-neutral-800 px-3 py-1 rounded-md tracking-widest">
                {formatCallTime(callSeconds)}
              </div>
            </div>
            
            <div className="relative aspect-video bg-black">
              {/* Mock Video Feed */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-neutral-500">
                <Activity size={48} className="mb-4 opacity-50" />
                <p>Waiting for citizen camera permission...</p>
                <div className="mt-4 flex gap-2">
                  <div className="w-2 h-2 rounded-full bg-neutral-600 animate-bounce"></div>
                  <div className="w-2 h-2 rounded-full bg-neutral-600 animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 rounded-full bg-neutral-600 animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-black border-t border-neutral-800 flex justify-center gap-4">
              <button className="p-4 rounded-full bg-neutral-800 text-white hover:bg-neutral-700 transition">
                <Activity size={20} />
              </button>
              <button 
                onClick={() => setIsTeleMedActive(false)}
                className="px-8 py-3 rounded-full bg-red-600 text-white font-bold hover:bg-red-700 transition flex items-center gap-2"
              >
                <Phone size={18} className="rotate-[135deg]" /> End Call
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Profile Modal */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in zoom-in duration-200">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden shadow-2xl w-full max-w-md flex flex-col">
            <div className="flex items-center justify-between p-4 bg-black border-b border-neutral-800">
              <h3 className="text-white font-bold text-sm">Citizen Profile</h3>
              <button onClick={() => setIsProfileModalOpen(false)} className="text-neutral-400 hover:text-white">
                ✕
              </button>
            </div>
            
            <div className="p-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-full bg-neutral-800 flex items-center justify-center text-white text-xl font-bold">
                  {(topIncident?.title?.split("—")[1]?.trim() || "UC")[0]}
                </div>
                <div>
                  <h2 className="text-white font-bold text-lg">{topIncident?.user_name || "Unknown Citizen"}</h2>
                  <p className="text-neutral-400 text-sm">ID: {topIncident?.user_id?.substring(0,8) || "ANON-8472"}</p>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-3">
                  <p className="text-[10px] text-neutral-500 uppercase font-bold tracking-widest mb-1">Medical History</p>
                  <p className="text-amber-300 text-sm">Masked. Authorized reveal and access audit are not connected.</p>
                </div>
                <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-3">
                  <p className="text-[10px] text-neutral-500 uppercase font-bold tracking-widest mb-1">Emergency Contacts</p>
                  <p className="text-neutral-400 text-sm">Contact data is not available from the incident feed.</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-3">
                    <p className="text-[10px] text-neutral-500 uppercase font-bold tracking-widest mb-1">Medical Details</p>
                    <p className="text-amber-300 font-bold text-sm">Masked</p>
                  </div>
                  <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-3">
                    <p className="text-[10px] text-neutral-500 uppercase font-bold tracking-widest mb-1">Status</p>
                    <p className="text-neutral-300 font-bold text-sm">{topIncident?.severity_confidence === "verified" ? "Verified" : "Unverified"}</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="p-4 bg-black border-t border-neutral-800">
              <button 
                onClick={() => setIsProfileModalOpen(false)}
                className="w-full py-2.5 rounded-lg bg-neutral-800 text-white font-bold hover:bg-neutral-700 transition"
              >
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}
    </SentinelShell>
  );
}
