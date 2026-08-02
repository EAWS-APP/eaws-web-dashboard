"use client";

import { useEffect, useState, useCallback } from "react";
import { Clock, MapPin, ChevronDown, ChevronRight, Zap, Activity, Heart, Send, UserCheck } from "lucide-react";
import { eawsApi } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import type { Incident } from "@/lib/models";
import SentinelShell from "@/components/SentinelShell";

const PRIORITY_TABS = ["Critical", "High", "Medium", "Pending Triage"] as const;
type PriorityTab = typeof PRIORITY_TABS[number];

const SEV_MAP: Record<PriorityTab, string[]> = {
  "Critical": ["CRITICAL"],
  "High": ["WARNING"],
  "Medium": ["MEDIUM"],
  "Pending Triage": ["PENDING TRIAGE", "LOW"],
};

const PRIORITY_BADGE: Record<string, string> = {
  CRITICAL: "bg-red-600 text-white",
  WARNING: "bg-orange-500 text-white",
  MEDIUM: "bg-yellow-500 text-black",
  "PENDING TRIAGE": "bg-neutral-700 text-neutral-300",
  LOW: "bg-neutral-700 text-neutral-300",
};

const CAT_ICON: Record<string, string> = {
  MEDICAL: "🏥", CRIME: "🚔", FIRE: "🔥", DISASTER: "⚠️",
};

function timeAgo(iso: string) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  return m < 1 ? "just now" : m < 60 ? `${m}m ago` : `${Math.round(m / 60)}h ago`;
}

const FALLBACK: Incident[] = [
  { id: "PT-8829-X", category: "FIRE", severity: "CRITICAL", status: "pending", title: "Structure Fire", description: "Structure fire with trapped occupants", is_anonymous: false, location_name: "Liberation Road", latitude: 5.603, longitude: -0.187, likes_count: 0, comments_count: 0, created_at: new Date(Date.now() - 2 * 60000).toISOString(), metadata: { vitals_hr: "128", vitals_spo2: "91", ai_confidence: 94, patient_name: "D. Harrison" } },
  { id: "PT-7714-A", category: "CRIME", severity: "WARNING", status: "verified", title: "Armed Robbery", description: "Suspect fled on motorcycle after robbery attempt", is_anonymous: false, location_name: "Osu", latitude: 5.55, longitude: -0.17, likes_count: 0, comments_count: 0, created_at: new Date(Date.now() - 8 * 60000).toISOString(), metadata: { patient_name: "Ama Mensah" } },
  { id: "PT-6402-K", category: "DISASTER", severity: "MEDIUM", status: "assigned", title: "Flood Warning", description: "Heavy rainfall causing flash flooding in low-lying areas", is_anonymous: false, location_name: "East Legon", latitude: 5.636, longitude: -0.155, likes_count: 0, comments_count: 0, created_at: new Date(Date.now() - 14 * 60000).toISOString(), metadata: { patient_name: "Kojo Owusu" } },
];

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<Incident[]>(FALLBACK);
  const [activeTab, setActiveTab] = useState<PriorityTab>("Critical");
  const [expandedId, setExpandedId] = useState<string | null>("PT-8829-X");
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(FALLBACK[0]);
  const [isDispatching, setIsDispatching] = useState(false);
  const [dispatchMsg, setDispatchMsg] = useState<string | null>(null);

  const loadIncidents = useCallback(async () => {
    try {
      const data = await eawsApi.getLiveIncidents();
      if (data?.length) setIncidents(data);
    } catch { /* use fallback */ }
  }, []);

  useEffect(() => {
    loadIncidents();
    const iv = setInterval(loadIncidents, 8000);
    const ch = supabase.channel("incidents-page")
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "incidents" }, loadIncidents)
      .subscribe();
    return () => { clearInterval(iv); supabase.removeChannel(ch); };
  }, [loadIncidents]);

  const filtered = incidents.filter(i => SEV_MAP[activeTab]?.includes(i.severity));

  const counts = {
    total: incidents.length,
    critical: incidents.filter(i => i.severity === "CRITICAL").length,
    high: incidents.filter(i => i.severity === "WARNING").length,
    pending: incidents.filter(i => ["PENDING TRIAGE", "LOW"].includes(i.severity)).length,
  };

  async function handleDispatch(inc: Incident, agency: string) {
    setIsDispatching(true);
    try {
      await eawsApi.dispatchIncident(inc.id, { agency_type: agency, priority: inc.severity.toLowerCase() });
      setDispatchMsg(`${agency.toUpperCase()} unit dispatched to ${inc.location_name}`);
      setTimeout(() => setDispatchMsg(null), 3000);
      loadIncidents();
    } catch (e: any) {
      alert("Dispatch failed: " + e.message);
    } finally {
      setIsDispatching(false);
    }
  }

  const meta = (selectedIncident as any)?.metadata || {};

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
              <div className="mx-5 mt-2 text-[10px] text-green-400 bg-green-500/10 border border-green-500/20 rounded px-3 py-2">{dispatchMsg}</div>
            )}

            <div className="flex-1 overflow-y-auto">
              {(filtered.length === 0 ? incidents : filtered).map((inc) => {
                const incMeta = (inc as any)?.metadata || {};
                const isExpanded = expandedId === inc.id;
                const isSelected = selectedIncident?.id === inc.id;
                return (
                  <div key={inc.id} className={`border-b border-neutral-900 transition-colors ${isSelected ? "bg-red-500/5" : "hover:bg-neutral-900/50"}`}>

                    {/* Main row */}
                    <div
                      className="grid grid-cols-[1.2fr_1fr_0.7fr_0.7fr_0.9fr_1.2fr] gap-4 px-5 py-3.5 cursor-pointer items-start"
                      onClick={() => { setSelectedIncident(inc); setExpandedId(isExpanded ? null : inc.id); }}
                    >
                      <div>
                        <p className="text-[11px] font-black text-white font-mono">{inc.id}</p>
                        <p className="text-[10px] text-neutral-400 mt-0.5">{incMeta.patient_name || (inc.title?.split(" ").slice(0,2).join(" "))}</p>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-neutral-300">
                        <span>{CAT_ICON[inc.category] || "🔔"}</span>
                        <span className="capitalize">{inc.category}</span>
                      </div>
                      <div>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase ${PRIORITY_BADGE[inc.severity] || PRIORITY_BADGE["LOW"]}`}>
                          {inc.severity === "WARNING" ? "High" : inc.severity === "PENDING TRIAGE" ? "Pending" : inc.severity}
                        </span>
                      </div>
                      <p className="text-[10px] text-neutral-400 flex items-center gap-1">
                        <MapPin size={9} /> {inc.location_name?.split(",")[0]}
                      </p>
                      <p className="text-[10px] text-neutral-500 flex items-center gap-1">
                        <Clock size={9} /> {timeAgo(inc.created_at)}
                      </p>
                      <div className="flex flex-col gap-1">
                        <div className="flex gap-1.5 items-center">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDispatch(inc, "police"); }}
                            disabled={isDispatching}
                            className="text-[9px] font-bold bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded transition-colors disabled:opacity-50"
                          >
                            Dispatch
                          </button>
                          {isExpanded ? <ChevronDown size={12} className="text-neutral-500" /> : <ChevronRight size={12} className="text-neutral-500" />}
                        </div>
                        <button className="text-[9px] font-bold bg-neutral-800 hover:bg-neutral-700 text-neutral-300 px-2 py-1 rounded transition-colors text-left">
                          Assign Unit
                        </button>
                        <button className="text-[9px] text-neutral-500 hover:text-white px-2 py-0.5 text-left transition-colors">
                          Message App
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
                          <p className="text-[8px] font-bold tracking-widest text-neutral-600 uppercase mb-1">AI Prediction Model</p>
                          {incMeta.ai_confidence ? (
                            <>
                              <p className="text-[10px] text-neutral-300 mb-1">{incMeta.ai_confidence}% confidence · {incMeta.ai_risk || "Critical escalation"}</p>
                              <div className="h-1 rounded-full bg-neutral-800">
                                <div className="h-1 rounded-full bg-red-500" style={{ width: `${incMeta.ai_confidence}%` }} />
                              </div>
                            </>
                          ) : <p className="text-[10px] text-neutral-500">Not available</p>}
                        </div>
                        <div>
                          <p className="text-[8px] font-bold tracking-widest text-neutral-600 uppercase mb-1">Vitals</p>
                          <div className="flex gap-3 text-[10px] text-neutral-300">
                            {incMeta.vitals_hr && <span>HR {incMeta.vitals_hr}</span>}
                            {incMeta.vitals_spo2 && <span>SpO2 {incMeta.vitals_spo2}%</span>}
                            {!incMeta.vitals_hr && <span className="text-neutral-600">No vitals recorded</span>}
                          </div>
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
                <div>
                  <p className="text-[8px] font-bold tracking-widest text-neutral-600 uppercase mb-2">AI Prediction Model</p>
                  <div className="flex items-center justify-between text-[9px] mb-1">
                    <span className="text-neutral-400">Confidence</span>
                    <span className="text-neutral-300 font-mono">{meta.ai_confidence || "N/A"}%</span>
                  </div>
                  {meta.ai_confidence && (
                    <div className="h-1.5 rounded-full bg-neutral-800">
                      <div className="h-1.5 rounded-full bg-red-500 transition-all" style={{ width: `${meta.ai_confidence}%` }} />
                    </div>
                  )}
                </div>
                {(meta.vitals_hr || meta.vitals_spo2) && (
                  <div>
                    <p className="text-[8px] font-bold tracking-widest text-neutral-600 uppercase mb-2">Vitals</p>
                    <div className="grid grid-cols-3 gap-2">
                      {meta.vitals_hr && (
                        <div className="bg-neutral-900 rounded p-2 text-center">
                          <p className="text-[8px] text-neutral-500 mb-0.5">HR</p>
                          <p className="text-sm font-black text-white font-mono">{meta.vitals_hr}</p>
                        </div>
                      )}
                      {meta.vitals_spo2 && (
                        <div className="bg-neutral-900 rounded p-2 text-center">
                          <p className="text-[8px] text-neutral-500 mb-0.5">SpO2</p>
                          <p className="text-sm font-black text-white font-mono">{meta.vitals_spo2}%</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="px-4 py-3">
                <p className="text-[8px] font-bold tracking-widest text-neutral-600 uppercase mb-3">Quick Actions</p>
                <div className="space-y-2">
                  <button
                    onClick={() => handleDispatch(selectedIncident, "police")}
                    disabled={isDispatching}
                    className="w-full py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold transition-colors disabled:opacity-50"
                  >
                    Dispatch Unit
                  </button>
                  <button
                    onClick={() => handleDispatch(selectedIncident, "fire")}
                    disabled={isDispatching}
                    className="w-full py-2.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[11px] font-bold transition-colors"
                  >
                    Assign Agency
                  </button>
                  <button className="w-full py-2.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-400 text-[11px] font-bold transition-colors">
                    Message App
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
