"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { Clock, MapPin, Radio, X, AlertTriangle, Shield, Flame, Activity, Building2, Check, Send } from "lucide-react";
import { eawsApi } from "@/lib/api";
import type { AgencyUnit, Incident } from "@/lib/models";

// Dynamically import Map with SSR disabled since Leaflet relies on window
const LiveMap = dynamic(() => import("@/components/Map"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-neutral-900 text-neutral-400">
      <div className="flex flex-col items-center gap-4">
        <Radio className="animate-pulse" size={48} />
        <p>Initializing Secure Map Feed...</p>
      </div>
    </div>
  ),
});

const fallbackIncidents: Incident[] = [
  {
    id: "demo-medical-1",
    category: "MEDICAL",
    severity: "CRITICAL",
    status: "pending",
    title: "Medical Emergency",
    description: "Critical SOS near Accra Mall Area",
    is_anonymous: false,
    is_verified: true,
    location_name: "Accra Mall Area, Spintex Rd",
    latitude: 5.6037,
    longitude: -0.187,
    likes_count: 0,
    comments_count: 0,
    created_at: new Date().toISOString(),
  },
  {
    id: "demo-fire-1",
    category: "FIRE",
    severity: "WARNING",
    status: "verified",
    title: "Fire Reported",
    description: "Smoke reported near Makola Market",
    is_anonymous: false,
    is_verified: true,
    location_name: "Makola Market",
    latitude: 5.5507,
    longitude: -0.2078,
    likes_count: 0,
    comments_count: 0,
    created_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
  },
];

const fallbackUnits: AgencyUnit[] = [
  {
    id: "police-unit-4",
    agency_type: "police",
    name: "Police Patrol Unit 4",
    status: "available",
    latitude: 5.59,
    longitude: -0.17,
  },
];

export default function DashboardPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [units, setUnits] = useState<AgencyUnit[]>(fallbackUnits);
  const [apiStatus, setApiStatus] = useState<"live" | "fallback">("fallback");

  // Interaction state
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form states
  const [triageSeverity, setTriageSeverity] = useState<string>("MEDIUM");
  const [triageStatus, setTriageStatus] = useState<string>("verified");
  const [triageNotes, setTriageNotes] = useState<string>("");

  const [dispatchAgency, setDispatchAgency] = useState<string>("police");
  const [dispatchPriority, setDispatchPriority] = useState<string>("medium");
  const [dispatchNotes, setDispatchNotes] = useState<string>("");

  async function loadLiveData() {
    try {
      const [liveIncidents, liveUnits] = await Promise.all([
        eawsApi.getLiveIncidents(),
        eawsApi.getLiveUnits(),
      ]);
      setIncidents(liveIncidents || []);
      setUnits(liveUnits || []);
      setApiStatus("live");

      // Update selected incident reference if it's currently open
      if (selectedIncident) {
        const updated = liveIncidents.find((i) => i.id === selectedIncident.id);
        if (updated) {
          setSelectedIncident(updated);
        }
      }
    } catch (error) {
      console.warn("EAWS live dashboard fallback active:", error);
      setApiStatus("fallback");
      if (incidents.length === 0) {
        setIncidents(fallbackIncidents);
      }
    }
  }

  useEffect(() => {
    loadLiveData();
    const interval = window.setInterval(loadLiveData, 8000);
    return () => {
      window.clearInterval(interval);
    };
  }, [selectedIncident?.id]);

  // Sync form state when selected incident changes
  useEffect(() => {
    if (selectedIncident) {
      setTriageSeverity(selectedIncident.severity);
      setTriageStatus(selectedIncident.status);
      setTriageNotes("");
      setDispatchNotes("");
    }
  }, [selectedIncident]);

  async function handleTriageSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedIncident) return;
    setIsLoading(true);
    setSuccessMessage(null);
    try {
      const updated = await eawsApi.triageIncident(selectedIncident.id, {
        severity: triageSeverity,
        status: triageStatus,
        notes: triageNotes || undefined,
      });
      setSelectedIncident(updated);
      setSuccessMessage("Incident successfully triaged!");
      setTimeout(() => setSuccessMessage(null), 3000);
      await loadLiveData();
    } catch (err: any) {
      alert("Triage update failed: " + (err.message || err));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDispatchSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedIncident) return;
    setIsLoading(true);
    setSuccessMessage(null);
    try {
      await eawsApi.dispatchIncident(selectedIncident.id, {
        agency_type: dispatchAgency,
        priority: dispatchPriority,
        notes: dispatchNotes || undefined,
      });
      setSuccessMessage(`Dispatched to ${dispatchAgency.toUpperCase()} unit!`);
      setTimeout(() => setSuccessMessage(null), 3000);
      await loadLiveData();
    } catch (err: any) {
      alert("Agency dispatch failed: " + (err.message || err));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="w-full h-full relative flex overflow-hidden">
      {/* Map takes up the full background */}
      <div className="absolute inset-0 z-0">
        <LiveMap incidents={incidents} units={units} />
      </div>

      {/* Floating Left Panel for Incidents List */}
      <div className="relative z-10 w-[360px] m-6 flex flex-col h-[calc(100vh-140px)] gap-4 pointer-events-none">
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/95 backdrop-blur-md px-3.5 py-2.5 text-xs font-semibold text-neutral-300 pointer-events-auto flex items-center justify-between shadow-lg">
          <span className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${apiStatus === "live" ? "bg-green-500 animate-pulse" : "bg-yellow-500"}`} />
            API Connection: {apiStatus === "live" ? "LIVE FEED" : "DEMO / FALLBACK"}
          </span>
          <span className="text-neutral-500">Total: {incidents.length}</span>
        </div>

        {/* Scrollable list of active incidents */}
        <div className="flex-1 overflow-y-auto pointer-events-auto scrollbar-thin scrollbar-thumb-neutral-800 pr-1 flex flex-col gap-3">
          {incidents.length === 0 ? (
            <div className="bg-neutral-900/90 border border-neutral-800 rounded-xl p-6 text-center text-sm text-neutral-500">
              No active incidents reported.
            </div>
          ) : (
            incidents.map((incident) => {
              const isCritical = incident.severity === "CRITICAL";
              const isSelected = selectedIncident?.id === incident.id;
              const dotClass = isCritical ? "bg-red-500" : "bg-yellow-500";
              const textClass = isCritical ? "text-red-400" : "text-yellow-400";
              
              return (
                <div
                  key={incident.id}
                  onClick={() => setSelectedIncident(incident)}
                  className={`bg-neutral-900/90 backdrop-blur-md border rounded-xl p-4 shadow-xl cursor-pointer transition-all duration-200 hover:scale-[1.01] ${
                    isSelected ? "border-red-500 ring-1 ring-red-500/50" : "border-neutral-800 hover:border-neutral-700"
                  }`}
                >
                  <div className="flex justify-between items-start mb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="flex h-2.5 w-2.5 relative">
                        {isCritical ? (
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        ) : null}
                        <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${dotClass}`}></span>
                      </span>
                      <span className={`font-bold tracking-wide ${textClass} text-xs`}>
                        {incident.severity}
                      </span>
                    </div>
                    <span className="text-xs text-neutral-400 flex items-center gap-1">
                      <Clock size={12} />
                      {new Date(incident.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>

                  <h3 className="text-base font-semibold text-white mb-1.5 truncate">{incident.title}</h3>
                  <p className="text-neutral-400 text-xs flex items-center gap-1.5 mb-2 truncate">
                    <MapPin size={13} className="text-neutral-500" />
                    {incident.location_name}
                  </p>

                  <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-neutral-800/80">
                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                      incident.status === "pending" ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" :
                      incident.status === "verified" ? "bg-blue-500/10 text-blue-500 border border-blue-500/20" :
                      "bg-green-500/10 text-green-500 border border-green-500/20"
                    }`}>
                      {incident.status}
                    </span>
                    <span className="text-[10px] text-neutral-500">
                      {incident.category || "GENERAL"}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Floating Right Detail & Action Panel */}
      {selectedIncident && (
        <div className="relative z-10 w-[420px] m-6 ml-auto flex flex-col h-[calc(100vh-140px)] bg-neutral-900/95 backdrop-blur-md border border-neutral-800 rounded-xl shadow-2xl overflow-y-auto scrollbar-thin scrollbar-thumb-neutral-800">
          <div className="flex items-center justify-between border-b border-neutral-800 px-5 py-4 shrink-0 bg-neutral-950/40">
            <div>
              <span className="text-[10px] uppercase font-bold tracking-widest text-neutral-500">Incident Details</span>
              <h2 className="text-lg font-bold text-white leading-tight truncate max-w-[280px]">
                {selectedIncident.title}
              </h2>
            </div>
            <button
              onClick={() => setSelectedIncident(null)}
              className="p-1.5 rounded-lg border border-neutral-800 hover:bg-neutral-800 hover:text-white transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          <div className="p-5 space-y-6">
            {successMessage && (
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 text-sm text-green-400 flex items-center gap-2">
                <Check size={16} />
                <span>{successMessage}</span>
              </div>
            )}

            {/* Incident Summary Card */}
            <div className="bg-neutral-950/40 rounded-lg border border-neutral-800/80 p-4 space-y-3.5 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-neutral-500">Status</p>
                  <p className="font-semibold text-white capitalize mt-0.5">{selectedIncident.status}</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-500">Severity</p>
                  <p className="font-semibold text-red-400 mt-0.5">{selectedIncident.severity}</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-500">Category</p>
                  <p className="font-semibold text-white mt-0.5">{selectedIncident.category || "General"}</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-500">Verification</p>
                  <p className="font-semibold text-white mt-0.5">
                    {selectedIncident.is_verified ? "Verified ✅" : "Unverified ⚠️"}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-xs text-neutral-500">Location Name</p>
                <p className="font-medium text-white flex items-center gap-1.5 mt-0.5">
                  <MapPin size={14} className="text-neutral-400 shrink-0" />
                  {selectedIncident.location_name}
                </p>
              </div>

              {selectedIncident.description && (
                <div>
                  <p className="text-xs text-neutral-500">Description</p>
                  <p className="text-neutral-300 mt-1 leading-relaxed">{selectedIncident.description}</p>
                </div>
              )}

              <div className="flex gap-4 text-xs text-neutral-500 pt-2 border-t border-neutral-850">
                <span>Lat: {selectedIncident.latitude.toFixed(5)}</span>
                <span>Lng: {selectedIncident.longitude.toFixed(5)}</span>
              </div>
            </div>

            {/* Segment 1: Triage Management */}
            <form onSubmit={handleTriageSubmit} className="space-y-4 pt-4 border-t border-neutral-800/80">
              <h3 className="text-sm font-bold text-white tracking-wide uppercase flex items-center gap-2">
                <AlertTriangle size={16} className="text-amber-500" />
                1. Triage & Verify
              </h3>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs text-neutral-400">Severity Level</label>
                  <select
                    value={triageSeverity}
                    onChange={(e) => setTriageSeverity(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-red-500"
                  >
                    <option value="LOW">LOW</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="WARNING">WARNING</option>
                    <option value="CRITICAL">CRITICAL</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-neutral-400">Verification Status</label>
                  <select
                    value={triageStatus}
                    onChange={(e) => setTriageStatus(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-red-500"
                  >
                    <option value="pending">Pending</option>
                    <option value="verified">Verified</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-neutral-400">Triage Operator Remarks</label>
                <input
                  type="text"
                  placeholder="e.g. Verified via duplicate reports..."
                  value={triageNotes}
                  onChange={(e) => setTriageNotes(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-red-500"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-bold py-2.5 rounded-lg border border-neutral-750 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <span>Update Triage & Verification</span>
              </button>
            </form>

            {/* Segment 2: Agency Dispatch */}
            <form onSubmit={handleDispatchSubmit} className="space-y-4 pt-4 border-t border-neutral-800/80">
              <h3 className="text-sm font-bold text-white tracking-wide uppercase flex items-center gap-2">
                <Send size={16} className="text-red-500" />
                2. Dispatch Emergency Units
              </h3>

              <div className="space-y-2">
                <label className="text-xs text-neutral-400">Select Responder Agency</label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { id: "police", label: "Police", icon: Shield, color: "border-blue-600 text-blue-400 bg-blue-600/5 hover:bg-blue-600/10" },
                    { id: "ambulance", label: "Medical", icon: Activity, color: "border-teal-600 text-teal-400 bg-teal-600/5 hover:bg-teal-600/10" },
                    { id: "fire", label: "Fire", icon: Flame, color: "border-orange-600 text-orange-400 bg-orange-600/5 hover:bg-orange-600/10" },
                    { id: "nadmo", label: "NADMO", icon: Building2, color: "border-purple-600 text-purple-400 bg-purple-600/5 hover:bg-purple-600/10" },
                  ].map((agency) => {
                    const isSelected = dispatchAgency === agency.id;
                    const Icon = agency.icon;
                    return (
                      <button
                        key={agency.id}
                        type="button"
                        onClick={() => setDispatchAgency(agency.id)}
                        className={`flex flex-col items-center gap-1.5 p-2 rounded-lg border text-xs font-semibold transition-all ${
                          isSelected
                            ? "border-white bg-white text-neutral-950 font-bold scale-[1.03]"
                            : agency.color
                        }`}
                      >
                        <Icon size={18} />
                        <span>{agency.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs text-neutral-400">Response Priority</label>
                  <select
                    value={dispatchPriority}
                    onChange={(e) => setDispatchPriority(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-red-500"
                  >
                    <option value="low">Low Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="high">High Priority</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-neutral-400">Dispatch Special Instructions</label>
                <textarea
                  rows={2}
                  placeholder="Include dispatch instructions or unit references here..."
                  value={dispatchNotes}
                  onChange={(e) => setDispatchNotes(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-600 resize-none focus:outline-none focus:ring-1 focus:ring-red-500"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-red-600 hover:bg-red-700 text-white text-xs font-bold py-3 rounded-lg shadow-lg hover:shadow-red-900/25 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <Send size={14} />
                <span>Confirm Dispatch Assignment</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
