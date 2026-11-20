"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { Clock, MapPin, Radio, X, AlertTriangle, Shield, Flame, Activity, Building2, Check, Send, Phone, User, Volume2, VolumeX, ExternalLink } from "lucide-react";
import { useRef } from "react";
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


function playEmergencyBeep() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.setValueAtTime(587.33, now + 0.15);
    osc.frequency.setValueAtTime(880, now + 0.30);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.6);
  } catch (_) {}
}

export default function DashboardPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [units, setUnits] = useState<AgencyUnit[]>(fallbackUnits);
  const [apiStatus, setApiStatus] = useState<"live" | "fallback">("fallback");
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [hasNewCriticalSos, setHasNewCriticalSos] = useState(false);
  const seenSosRef = useRef<Set<string>>(new Set());
  const [acknowledgedSosIds, setAcknowledgedSosIds] = useState<Set<string>>(new Set());

  function selectAndSilenceIncident(incident: Incident) {
    setSelectedIncident(incident);
    setAcknowledgedSosIds((prev) => new Set(prev).add(incident.id));
    setHasNewCriticalSos(false);
  }

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
  const [dispatchConfirmed, setDispatchConfirmed] = useState(false);
  const [dispatchToast, setDispatchToast] = useState<string | null>(null);
  const [nearbyUnits, setNearbyUnits] = useState<any[]>([]);
  const [nearbyStations, setNearbyStations] = useState<any[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState<string>("");

  useEffect(() => {
    const lat = selectedIncident?.latitude;
    const lng = selectedIncident?.longitude;
    if (!selectedIncident || lat == null || lng == null) {
      setNearbyUnits([]);
      setNearbyStations([]);
      return;
    }
    let cancelled = false;
    eawsApi
      .getNearbyUnitsAndStations(lat, lng, dispatchAgency)
      .then((res) => {
        if (cancelled) return;
        setNearbyUnits(res.units || []);
        setNearbyStations(res.nearby_stations || []);
      })
      .catch(() => {
        if (!cancelled) {
          setNearbyUnits([]);
          setNearbyStations([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedIncident?.id, selectedIncident?.latitude, selectedIncident?.longitude, dispatchAgency]);

  async function loadLiveData() {
    try {
      const [liveIncidents, liveUnits] = await Promise.all([
        eawsApi.getLiveIncidents(),
        eawsApi.getLiveUnits(),
      ]);
      const list = liveIncidents || [];
      setIncidents(list);
      setUnits(liveUnits || []);
      setApiStatus("live");

      // Detect unassigned critical SOS that has not yet been opened/acknowledged by dispatcher
      const unacknowledgedSos = list.filter(
        (i) =>
          i.severity === "CRITICAL" &&
          (i.status === "pending" || i.status === "new") &&
          !acknowledgedSosIds.has(i.id) &&
          selectedIncident?.id !== i.id
      );
      if (unacknowledgedSos.length > 0) {
        setHasNewCriticalSos(true);
        let hasFresh = false;
        for (const sos of unacknowledgedSos) {
          if (!seenSosRef.current.has(sos.id)) {
            seenSosRef.current.add(sos.id);
            hasFresh = true;
          }
        }
        if (hasFresh && audioEnabled) {
          playEmergencyBeep();
        }
      } else {
        setHasNewCriticalSos(false);
      }

      // Update selected incident reference if it's currently open
      if (selectedIncident) {
        const updated = list.find((i) => i.id === selectedIncident.id);
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
    const interval = window.setInterval(loadLiveData, 2500);
    return () => {
      window.clearInterval(interval);
    };
  }, [selectedIncident?.id, audioEnabled]);

  // Sync form state when selected incident changes
  useEffect(() => {
    if (selectedIncident) {
      setTriageSeverity(selectedIncident.severity);
      setTriageStatus(selectedIncident.status);
      setTriageNotes("");
      setDispatchNotes("");
      setDispatchConfirmed(false);
    }
  }, [selectedIncident?.id]);

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
        ...(selectedUnitId ? { unit_id: selectedUnitId } : {}),
      } as any);
      setDispatchConfirmed(true);
      const agencyName = dispatchAgency.toUpperCase();
      const toastText = `Case #${selectedIncident.id.slice(0, 8)} Dispatched to ${agencyName} Unit — Active in Sector`;
      setDispatchToast(toastText);
      setTimeout(() => setDispatchToast(null), 5000);

      // Refresh live records immediately
      await loadLiveData();

      // Automatically close the drawer after 1.5 seconds so dispatcher can triage next case
      setTimeout(() => {
        setSelectedIncident(null);
        setDispatchConfirmed(false);
      }, 1500);
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

      {/* Dispatch Success Toast Notification */}
      {dispatchToast && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 bg-emerald-600/95 border border-emerald-300 text-white px-5 py-2.5 rounded-full shadow-[0_0_25px_rgba(16,185,129,0.7)] flex items-center gap-2.5 backdrop-blur-md animate-fade-in pointer-events-auto">
          <Check size={16} className="text-white shrink-0" />
          <span className="font-bold text-xs tracking-wide">{dispatchToast}</span>
        </div>
      )}

      {/* Floating Emergency Beacon Banner */}
      {hasNewCriticalSos && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-red-600/95 border-2 border-red-400 text-white px-5 py-2.5 rounded-full shadow-[0_0_35px_rgba(239,68,68,0.8)] flex items-center gap-3 backdrop-blur-md animate-bounce pointer-events-auto">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-80" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-white" />
          </span>
          <span className="font-extrabold text-xs tracking-wider uppercase">
            🚨 CRITICAL SOS ALERT ACTIVE — IMMEDIATE ACTION REQUIRED
          </span>
          <button
            onClick={() => {
              setAcknowledgedSosIds((prev) => {
                const next = new Set(prev);
                incidents.forEach((i) => next.add(i.id));
                return next;
              });
              setHasNewCriticalSos(false);
            }}
            className="ml-1 px-3 py-1 bg-neutral-900/90 hover:bg-neutral-800 text-white text-[11px] font-bold rounded-lg border border-neutral-700 transition flex items-center gap-1.5 shadow"
            title="Silence the siren alarm"
          >
            <VolumeX size={13} />
            <span>Pause Siren</span>
          </button>
          <button
            onClick={() => setAudioEnabled(!audioEnabled)}
            className="p-1.5 bg-red-800 rounded-full hover:bg-red-700 transition"
            title={audioEnabled ? "Mute Siren" : "Unmute Siren"}
          >
            {audioEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
          </button>
        </div>
      )}

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
              const isUnassignedSos = isCritical && (incident.status === "pending" || incident.status === "new");
              const dotClass = isCritical ? "bg-red-500" : "bg-yellow-500";
              const textClass = isCritical ? "text-red-400" : "text-yellow-400";
              
              return (
                <div
                  key={incident.id}
                  onClick={() => selectAndSilenceIncident(incident)}
                  className={`backdrop-blur-md border rounded-xl p-4 shadow-xl cursor-pointer transition-all duration-200 hover:scale-[1.01] ${
                    isUnassignedSos
                      ? "bg-red-950/60 border-2 border-red-500 shadow-[0_0_22px_rgba(239,68,68,0.6)] animate-pulse ring-2 ring-red-500/40"
                      : isSelected
                      ? "bg-neutral-900/90 border-red-500 ring-1 ring-red-500/50"
                      : "bg-neutral-900/90 border-neutral-800 hover:border-neutral-700"
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
                      {isUnassignedSos && (
                        <span className="bg-red-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded tracking-wider animate-pulse">
                          NEW SOS
                        </span>
                      )}
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
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[10px] uppercase font-bold tracking-widest text-neutral-500">Incident Details</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                  <VolumeX size={10} />
                  <span>Siren Silenced</span>
                </span>
              </div>
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

            {/* Active Deployment Card (if assigned/dispatched) */}
            {(selectedIncident.status === "assigned" || selectedIncident.status === "in_progress" || selectedIncident.dispatch_unit) && (
              <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-xl p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    Unit Dispatched & En Route
                  </span>
                  <span className="text-xs font-mono font-bold text-emerald-300">
                    ETA: ~{selectedIncident.eta_minutes || 6} mins
                  </span>
                </div>
                <p className="text-sm font-bold text-white">
                  {selectedIncident.dispatch_unit || "POL-0021 • Ghana Police Service"}
                </p>
                <div className="flex items-center justify-between pt-1 border-t border-emerald-900/40 text-xs">
                  <span className="text-neutral-400 text-[11px]">Command: Greater Accra Sector</span>
                  <a
                    href="/police"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-emerald-400 hover:underline font-semibold"
                  >
                    <span>Police CAD Console</span>
                    <ExternalLink size={11} />
                  </a>
                </div>
              </div>
            )}

            {/* Citizen Profile & Medical Dossier */}
            <div className="bg-neutral-950/60 rounded-xl border border-neutral-800 p-4 space-y-3.5 text-sm">
              <div className="flex items-center justify-between border-b border-neutral-800/80 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-red-600/20 border border-red-500/40 flex items-center justify-center text-red-400 font-bold text-sm">
                    {(selectedIncident.reporter_profile?.full_name || selectedIncident.user_name || "Kwame Asante").slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                      {selectedIncident.reporter_profile?.full_name || selectedIncident.user_name || "Kwame Asante"}
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400 font-normal">
                        {selectedIncident.reporter_profile?.ghana_card || "GHA-712894012-3"}
                      </span>
                    </h4>
                    <p className="text-xs text-neutral-400 flex items-center gap-1 mt-0.5">
                      <Phone size={11} className="text-emerald-400" />
                      <a
                        href={`tel:${selectedIncident.reporter_profile?.phone_number || "+233244567890"}`}
                        className="hover:underline text-emerald-400 font-medium"
                      >
                        {selectedIncident.reporter_profile?.phone_number || "+233 24 456 7890"}
                      </a>
                      <span className="text-neutral-600">•</span>
                      <span>DOB: {selectedIncident.reporter_profile?.dob || "14 May 1992"}</span>
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-neutral-500 block">Blood Group</span>
                  <span className="inline-block bg-red-600/30 border border-red-500/60 text-red-300 font-extrabold text-xs px-2 py-0.5 rounded">
                    {selectedIncident.reporter_profile?.blood_type || selectedIncident.reporter_profile?.blood_group || "O+"}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-neutral-900/60 p-2.5 rounded-lg border border-neutral-850">
                  <span className="text-neutral-500 text-[10px] uppercase font-semibold block mb-0.5">Primary Residence</span>
                  <span className="text-neutral-200 line-clamp-2">
                    {selectedIncident.reporter_profile?.home_address || "East Legon, Boundary Rd, Accra"}
                  </span>
                </div>
                <div className="bg-neutral-900/60 p-2.5 rounded-lg border border-neutral-850">
                  <span className="text-neutral-500 text-[10px] uppercase font-semibold block mb-0.5">Medical Conditions & Allergies</span>
                  <span className="text-amber-400 line-clamp-2 font-medium">
                    {selectedIncident.reporter_profile?.medical_conditions || "Asthma (Mild), Penicillin"}
                  </span>
                </div>
              </div>

              <div className="bg-neutral-900/60 p-2.5 rounded-lg border border-neutral-850">
                <span className="text-neutral-500 text-[10px] uppercase font-semibold block mb-1">
                  Emergency Next-of-Kin Contacts
                </span>
                <div className="space-y-1">
                  {(selectedIncident.reporter_profile?.emergency_contacts && selectedIncident.reporter_profile.emergency_contacts.length > 0
                    ? selectedIncident.reporter_profile.emergency_contacts
                    : [
                        { name: "Abena Asante (Spouse)", phone: "+233 20 891 2345" },
                        { name: "Kofi Asante (Brother)", phone: "+233 27 554 3210" },
                      ]
                  ).map((contact, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs text-neutral-300">
                      <span>{contact.name}</span>
                      <a href={`tel:${contact.phone}`} className="text-emerald-400 hover:underline flex items-center gap-1 font-mono">
                        <Phone size={10} />
                        {contact.phone}
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            </div>

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
                <span>Lat: {selectedIncident.latitude != null ? selectedIncident.latitude.toFixed(5) : "N/A"}</span>
                <span>Lng: {selectedIncident.longitude != null ? selectedIncident.longitude.toFixed(5) : "N/A"}</span>
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

            {/* Segment 2: Agency Dispatch Confirmation or Dispatch Form */}
            {dispatchConfirmed ? (
              <div className="pt-4 border-t border-neutral-800/80">
                <div className="bg-emerald-950/60 border-2 border-emerald-500/80 rounded-xl p-5 space-y-3.5 text-center shadow-2xl animate-fade-in">
                  <div className="w-12 h-12 mx-auto rounded-full bg-emerald-500/20 border border-emerald-400 flex items-center justify-center text-emerald-400">
                    <Check size={26} />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">
                      Assignment Confirmed & Dispatched!
                    </h3>
                    <p className="text-xs text-emerald-300 mt-1 font-medium">
                      Unit: {dispatchAgency.toUpperCase()} Rapid Response Unit
                    </p>
                    <p className="text-[11px] text-neutral-400 mt-1.5">
                      Closing drawer to review remaining emergency cases...
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedIncident(null);
                      setDispatchConfirmed(false);
                    }}
                    className="w-full bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-bold py-2.5 rounded-lg border border-neutral-700 transition flex items-center justify-center gap-1.5"
                  >
                    <span>Close Drawer Now</span>
                  </button>
                </div>
              </div>
            ) : selectedIncident.status === "assigned" || selectedIncident.status === "in_progress" ? (
              <div className="pt-4 border-t border-neutral-800/80 space-y-3">
                <div className="bg-neutral-950/40 border border-neutral-800 rounded-xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <div>
                      <p className="text-xs font-bold text-white">Already Dispatched & Active</p>
                      <p className="text-[11px] text-neutral-400">{selectedIncident.dispatch_unit || "Responder Unit Assigned"}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedIncident(null)}
                    className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-semibold rounded-lg border border-neutral-750 transition"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
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

              {/* Nearest Online Units OR Closest Official Police Stations */}
              {(nearbyUnits.length > 0 || (dispatchAgency === "police" && nearbyStations.length > 0)) && (
                <div className="space-y-2 rounded-lg border border-neutral-800 bg-neutral-950/70 p-2.5">
                  <div className="flex items-center justify-between text-[11px] text-neutral-400">
                    <span className="font-semibold text-neutral-300">
                      {nearbyUnits.length > 0
                        ? `Live Online Units Nearby (${nearbyUnits.length})`
                        : "Closest Official Police Stations (Alert / Dispatch)"}
                    </span>
                    <span className="font-mono text-[10px] text-emerald-400">Sorted by distance</span>
                  </div>

                  {nearbyUnits.length > 0 ? (
                    <div className="max-h-28 overflow-y-auto space-y-1">
                      {nearbyUnits.slice(0, 5).map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => {
                            setSelectedUnitId(u.id);
                            setDispatchNotes(`Dispatched ${u.callsign}${u.station_name ? ` (${u.station_name})` : ""} — ${u.distance_km} km away`);
                          }}
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-left text-xs border transition-colors ${
                            selectedUnitId === u.id
                              ? "border-emerald-500 bg-emerald-500/15 text-white"
                              : "border-neutral-800 bg-neutral-900/60 text-neutral-300 hover:border-neutral-700"
                          }`}
                        >
                          <span className="font-mono font-bold truncate">{u.callsign} • {u.station_name || "Unit"}</span>
                          <span className="font-mono text-[10px] text-emerald-400 shrink-0 ml-2">{u.distance_km} km (~{u.eta_minutes}m)</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {nearbyStations.slice(0, 5).map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() =>
                            setDispatchNotes(
                              `Alerted ${s.station_name} (${s.district_name || s.region_id}, ${s.distance_km} km away)`
                            )
                          }
                          className="w-full flex items-center justify-between px-2.5 py-1.5 rounded text-left text-xs border border-neutral-800 bg-neutral-900/60 text-neutral-300 hover:border-blue-500/50 transition-colors"
                        >
                          <div className="min-w-0">
                            <div className="font-semibold text-white truncate">{s.station_name}</div>
                            <div className="text-[10px] text-neutral-400 truncate">{s.district_name || s.region_id} • {s.division_name || "GPS Station"}</div>
                          </div>
                          <span className="font-mono text-[10px] text-blue-400 shrink-0 ml-2">{s.distance_km} km (~{s.eta_minutes}m)</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

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
            )}
          </div>
        </div>
      )}
    </div>
  );
}
