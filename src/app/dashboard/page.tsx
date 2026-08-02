"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Clock, MapPin, Activity, Radio, Phone, Send,
  Shield, Flame, AlertTriangle, Wifi, ChevronRight,
  Zap, Heart,
} from "lucide-react";
import { eawsApi } from "@/lib/api";
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

const FALLBACK_INCIDENTS: Incident[] = [
  {
    id: "PT-8829-X", category: "MEDICAL", severity: "CRITICAL", status: "pending",
    title: "Medical Emergency — D. Harrison",
    description: "Severe penetrating trauma to abdominal quadrant 3. Active arterial bleed reported by bystander. Patient is drifting in and out of consciousness.",
    is_anonymous: false, is_verified: true,
    location_name: "Liberation Road, Accra",
    latitude: 5.6037, longitude: -0.187,
    likes_count: 0, comments_count: 0,
    created_at: new Date().toISOString(),
    metadata: { vitals_hr: "128", vitals_spo2: "91", ai_confidence: 94, ai_risk: "Hypovolemic Shock Risk", trauma_score: 14 },
  },
  {
    id: "PT-7714-A", category: "CRIME", severity: "WARNING", status: "verified",
    title: "Suspicious Activity Alert",
    description: "Armed robbery reported near Osu Oxford Street. Suspect fled on motorcycle.",
    is_anonymous: false, is_verified: true,
    location_name: "Osu, Oxford Street",
    latitude: 5.5507, longitude: -0.1702,
    likes_count: 0, comments_count: 0,
    created_at: new Date(Date.now() - 8 * 60000).toISOString(),
  },
  {
    id: "PT-6402-K", category: "DISASTER", severity: "MEDIUM", status: "assigned",
    title: "Earthquake Preparedness Broadcast",
    description: "Tremor of 3.1 magnitude detected. Advising citizens to follow evacuation protocols.",
    is_anonymous: false, is_verified: true,
    location_name: "East Legon, Accra",
    latitude: 5.636, longitude: -0.155,
    likes_count: 0, comments_count: 0,
    created_at: new Date(Date.now() - 14 * 60000).toISOString(),
  },
];

const FALLBACK_UNITS: AgencyUnit[] = [
  { id: "police-1", agency_type: "police", name: "Patrol Unit 4", status: "available", latitude: 5.59, longitude: -0.17 },
  { id: "fire-1", agency_type: "fire", name: "Engine 12", status: "available", latitude: 5.57, longitude: -0.21 },
  { id: "ambulance-1", agency_type: "ambulance", name: "Ambulance Alpha", status: "en_route", latitude: 5.61, longitude: -0.19 },
];

function timeAgo(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  return `${Math.round(mins / 60)}h ago`;
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
  const [incidents, setIncidents] = useState<Incident[]>(FALLBACK_INCIDENTS);
  const [units, setUnits] = useState<AgencyUnit[]>(FALLBACK_UNITS);
  const [apiStatus, setApiStatus] = useState<"live" | "fallback">("fallback");
  const [selectedIncident, setSelectedIncident] = useState<Incident>(FALLBACK_INCIDENTS[0]);
  const [isDispatching, setIsDispatching] = useState(false);
  const [dispatchSuccess, setDispatchSuccess] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "info" | "error" } | null>(null);
  const [systemHealth, setSystemHealth] = useState({ connectivity: 98, locationAccuracy: "±3m", smsFallback: "Active" });

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
      if (liveIncidents?.length) {
        setIncidents(liveIncidents);
        setSelectedIncident((prev) => liveIncidents.find((i) => i.id === prev.id) || liveIncidents[0]);
      }
      if (liveUnits?.length) setUnits(liveUnits);
      setApiStatus("live");
    } catch {
      setApiStatus("fallback");
    }
  }, []);

  useEffect(() => {
    loadData();
    const iv = setInterval(loadData, 8000);
    // Supabase Realtime — incidents table
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
      await eawsApi.dispatchIncident(target.id, { agency_type: agencyType, priority: target.severity.toLowerCase() });
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

  const meta = (selectedIncident as any)?.metadata || {};
  const topIncident = incidents[0];

  return (
    <SentinelShell
      title="Sentinel Command"
      subtitle="Monitor citizen signals, coordinate dispatch, and broadcast updates back to the app."
    >
      <div className="flex h-full overflow-hidden relative">

        {/* ── LEFT PANEL: Priority Incident Card ── */}
        <div className="w-[280px] min-w-[280px] h-full overflow-y-auto bg-[#0e0e0e] border-r border-neutral-900 flex flex-col gap-0">

          {/* Priority header */}
          <div className="px-4 pt-4 pb-3 border-b border-neutral-900">
            <p className="text-[8px] font-bold tracking-[0.2em] text-neutral-600 uppercase mb-1">Priority 1 · Immediate</p>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-white font-mono">{topIncident?.id || "—"}</h2>
              <span className="text-[9px] font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded uppercase">
                {topIncident?.severity || "—"}
              </span>
            </div>
          </div>

          {/* Citizen info */}
          <div className="px-4 py-3 border-b border-neutral-900 cursor-pointer hover:bg-neutral-900/50 transition-colors" onClick={() => setIsProfileModalOpen(true)}>
            <div className="flex justify-between items-center mb-1">
              <p className="text-[8px] font-bold tracking-widest text-neutral-600 uppercase">Name</p>
              <ChevronRight size={12} className="text-neutral-600" />
            </div>
            <p className="text-sm font-bold text-white">{topIncident?.title?.split("—")[1]?.trim() || topIncident?.title || "Unknown Citizen"}</p>

            <div className="grid grid-cols-2 gap-3 mt-3">
              <div className="bg-neutral-900 rounded-lg p-2.5 text-center">
                <div className="flex items-center justify-center gap-1 mb-0.5">
                  <Heart size={9} className="text-red-400" />
                  <span className="text-[8px] font-bold tracking-widest text-neutral-500 uppercase">HR</span>
                </div>
                <p className="text-xl font-black text-white font-mono">{meta.vitals_hr || "—"}</p>
                <p className="text-[8px] text-neutral-500">BPM</p>
              </div>
              <div className="bg-neutral-900 rounded-lg p-2.5 text-center">
                <div className="flex items-center justify-center gap-1 mb-0.5">
                  <Activity size={9} className="text-blue-400" />
                  <span className="text-[8px] font-bold tracking-widest text-neutral-500 uppercase">SpO2</span>
                </div>
                <p className="text-xl font-black text-white font-mono">{meta.vitals_spo2 ? `${meta.vitals_spo2}%` : "—"}</p>
                <p className="text-[8px] text-neutral-500">{meta.vitals_spo2 && parseInt(meta.vitals_spo2) < 95 ? "Low" : "Normal"}</p>
              </div>
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
              className="w-full py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-colors flex items-center justify-center gap-2"
              onClick={() => setIsTeleMedActive(true)}
            >
              <Phone size={12} /> Initiate Tele-Med Link
            </button>
            <button
              disabled={isDispatching}
              onClick={() => handleDispatch("police")}
              className="w-full py-2.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Send size={12} /> Dispatch Unit
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
                    disabled={isDispatching}
                    onClick={() => handleDispatch(ag.key)}
                    className={`flex-1 text-[9px] font-bold text-white py-1.5 rounded transition-colors disabled:opacity-50 ${ag.color}`}
                  >
                    Dispatch {ag.label}
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
        <div className="flex-1 relative">
          <LiveMap incidents={incidents} units={units} />

          {/* API status overlay */}
          <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/70 backdrop-blur-sm border border-neutral-800 rounded-full px-3 py-1.5">
            <span className="text-[8px] font-bold text-neutral-300">Accra Metro · Live Feed</span>
            <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${apiStatus === "live" ? "bg-green-500" : "bg-yellow-500"}`} />
          </div>
        </div>

        {/* ── RIGHT PANEL: Dispatch Queue + System Health ── */}
        <div className="w-[280px] min-w-[280px] h-full overflow-y-auto bg-[#0e0e0e] border-l border-neutral-900 flex flex-col">

          {/* Dispatch Queue */}
          <div className="px-4 pt-4 pb-2 border-b border-neutral-900">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-bold tracking-widest text-neutral-400 uppercase">Dispatch Queue</p>
              <span className="text-[9px] font-bold text-neutral-500 bg-neutral-900 border border-neutral-800 rounded px-1.5 py-0.5">
                {incidents.length} Pending
              </span>
            </div>

            <div className="space-y-2">
              {incidents.slice(0, 4).map((inc) => (
                <div
                  key={inc.id}
                  onClick={() => setSelectedIncident(inc)}
                  className={`rounded-lg border p-3 cursor-pointer transition-all hover:border-neutral-700 ${
                    selectedIncident?.id === inc.id ? "border-red-600/50 bg-red-500/5" : "border-neutral-800 bg-neutral-900/50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-[9px] font-bold text-neutral-500 uppercase mb-0.5">{inc.severity}</p>
                      <p className="text-[11px] font-semibold text-white leading-tight truncate">{inc.title}</p>
                      <p className="text-[9px] text-neutral-500 flex items-center gap-1 mt-0.5">
                        <MapPin size={8} /> {inc.location_name}
                      </p>
                    </div>
                    <span className={`shrink-0 text-[8px] font-bold border rounded px-1.5 py-0.5 ${PRIORITY_COLOR[inc.severity] || PRIORITY_COLOR["LOW"]}`}>
                      {inc.severity === "CRITICAL" ? "CRITICAL" : inc.severity === "WARNING" ? "HIGH" : "MED"}
                    </span>
                  </div>

                  <div className="flex gap-1.5 mt-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelectedIncident(inc); handleDispatch("police", inc); }}
                      disabled={isDispatching}
                      className="flex-1 text-[9px] font-bold bg-red-600 hover:bg-red-700 text-white py-1 rounded transition-colors disabled:opacity-50"
                    >
                      Dispatch
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelectedIncident(inc); showToast(`📲 Alert sent to ${inc.location_name || 'field units'} via SMS`, 'info'); }}
                      className="flex-1 text-[9px] font-bold bg-neutral-800 hover:bg-neutral-700 text-neutral-300 py-1 rounded transition-colors"
                    >
                      Message App
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* System Health */}
          <div className="px-4 py-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-bold tracking-widest text-neutral-400 uppercase">System Health</p>
              <span className="text-[9px] font-bold text-green-400 bg-green-500/10 border border-green-500/20 px-1.5 py-0.5 rounded">Stable</span>
            </div>
            <p className="text-[9px] text-neutral-600 mb-3">Connectivity and fallback status</p>

            <div className="space-y-3">
              {[
                { label: "App connectivity", value: `${systemHealth.connectivity}%`, pct: systemHealth.connectivity, color: "bg-red-500" },
                { label: "Location accuracy", value: systemHealth.locationAccuracy, pct: 95, color: "bg-blue-500" },
              ].map((h) => (
                <div key={h.label}>
                  <div className="flex justify-between text-[10px] mb-1">
                    <span className="text-neutral-400">{h.label}</span>
                    <span className="text-neutral-300 font-mono font-bold">{h.value}</span>
                  </div>
                  <div className="h-1 rounded-full bg-neutral-800">
                    <div className={`h-1 rounded-full ${h.color}`} style={{ width: `${h.pct}%` }} />
                  </div>
                </div>
              ))}
              <div className="flex justify-between text-[10px] pt-1 border-t border-neutral-900">
                <span className="text-neutral-400">SMS fallback</span>
                <span className="text-green-400 font-bold">{systemHealth.smsFallback}</span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-neutral-400">API status</span>
                <span className={`font-bold ${apiStatus === "live" ? "text-green-400" : "text-yellow-400"}`}>
                  {apiStatus === "live" ? "Live" : "Demo"}
                </span>
              </div>
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
                  <h2 className="text-white font-bold text-lg">{topIncident?.title?.split("—")[1]?.trim() || topIncident?.title || "Unknown Citizen"}</h2>
                  <p className="text-neutral-400 text-sm">ID: {topIncident?.user_id?.substring(0,8) || "ANON-8472"}</p>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-3">
                  <p className="text-[10px] text-neutral-500 uppercase font-bold tracking-widest mb-1">Medical History</p>
                  <p className="text-neutral-300 text-sm">Hypertension (Diagnosed 2021). No known drug allergies.</p>
                </div>
                <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-3">
                  <p className="text-[10px] text-neutral-500 uppercase font-bold tracking-widest mb-1">Emergency Contacts</p>
                  <p className="text-neutral-300 text-sm">Wife: +233 55 123 4567</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-3">
                    <p className="text-[10px] text-neutral-500 uppercase font-bold tracking-widest mb-1">Blood Type</p>
                    <p className="text-red-400 font-bold text-lg">O+</p>
                  </div>
                  <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-3">
                    <p className="text-[10px] text-neutral-500 uppercase font-bold tracking-widest mb-1">Status</p>
                    <p className="text-green-400 font-bold text-lg">Verified</p>
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
