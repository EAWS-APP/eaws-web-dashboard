"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Building2,
  CheckCircle2,
  Clock,
  Flame,
  MapPin,
  Navigation,
  Phone,
  Radio,
  Send,
  Shield,
  User,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { eawsApi } from "@/lib/api";
import type { AgencyUnit, Incident } from "@/lib/models";
import WebRtcVoiceCall from "@/components/WebRtcVoiceCall";

const LiveMap = dynamic(() => import("@/components/Map"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-neutral-900 text-neutral-400">
      <div className="flex flex-col items-center gap-3">
        <Radio className="animate-pulse" size={40} />
        <p className="text-xs font-mono">Loading District Tactical Map...</p>
      </div>
    </div>
  ),
});

function playSirenChime() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.setValueAtTime(660, now + 0.15);
    osc.frequency.setValueAtTime(880, now + 0.3);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.55);
  } catch (_) {}
}

export default function DistrictDispatchPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [units, setUnits] = useState<AgencyUnit[]>([]);
  const [apiStatus, setApiStatus] = useState<"live" | "offline">("offline");
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);

  const [regionFilter, setRegionFilter] = useState<string>("ALL");
  const [agencyFilter, setAgencyFilter] = useState<string>("ALL");
  const [audioEnabled, setAudioEnabled] = useState<boolean>(true);
  const seenIdsRef = useRef<Set<string>>(new Set());

  // Dispatch form state
  const [dispatchAgency, setDispatchAgency] = useState<string>("police");
  const [dispatchPriority, setDispatchPriority] = useState<string>("high");
  const [dispatchNotes, setDispatchNotes] = useState<string>("");
  const [nearbyUnits, setNearbyUnits] = useState<any[]>([]);
  const [nearbyStations, setNearbyStations] = useState<any[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState<string>("");
  const [isBusy, setIsBusy] = useState<boolean>(false);
  const [toast, setToast] = useState<string | null>(null);

  // Live responder movement simulator
  const [isSimulatingMove, setIsSimulatingMove] = useState<boolean>(false);
  const simTimerRef = useRef<NodeJS.Timeout | null>(null);

  function notify(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 4500);
  }

  async function loadData() {
    try {
      const [incList, unitList] = await Promise.all([
        eawsApi.getLiveIncidents(),
        eawsApi.getLiveUnits(),
      ]);
      const safeInc = Array.isArray(incList) ? incList : [];
      setIncidents(safeInc);
      setUnits(Array.isArray(unitList) ? unitList : []);
      setApiStatus("live");

      // Refresh currently open incident
      setSelectedIncident((prev) => {
        if (!prev) return null;
        return safeInc.find((i) => i.id === prev.id) || prev;
      });

      // Chime on new pending critical SOS
      let hasNewPending = false;
      for (const inc of safeInc) {
        if (!seenIdsRef.current.has(inc.id)) {
          seenIdsRef.current.add(inc.id);
          if (inc.status === "pending" && inc.severity?.toUpperCase() === "CRITICAL") {
            hasNewPending = true;
          }
        }
      }
      if (hasNewPending && audioEnabled) {
        playSirenChime();
      }
    } catch {
      setApiStatus("offline");
    }
  }

  useEffect(() => {
    loadData();
    const timer = setInterval(loadData, 5000);
    return () => clearInterval(timer);
  }, [audioEnabled]);

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

  useEffect(() => {
    return () => {
      if (simTimerRef.current) clearInterval(simTimerRef.current);
    };
  }, []);

  const filteredIncidents = incidents.filter((inc: any) => {
    if (regionFilter !== "ALL") {
      const r = (inc.region_id || "UNASSIGNED").toUpperCase();
      if (r !== regionFilter) return false;
    }
    if (agencyFilter !== "ALL") {
      const cat = String(inc.emergency_type || inc.category || "").toLowerCase();
      const assigns = inc.assignments || [];
      const hasAssign = assigns.some((a: any) => (a.agency_type || "").toLowerCase() === agencyFilter);
      if (!hasAssign && !cat.includes(agencyFilter)) return false;
    }
    return true;
  });

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedIncident) return;
    setIsBusy(true);
    try {
      await eawsApi.dispatchIncident(selectedIncident.id, {
        agency_type: dispatchAgency,
        priority: dispatchPriority,
        notes: dispatchNotes || undefined,
        ...(selectedUnitId ? { unit_id: selectedUnitId } : {}),
      } as any);
      notify(`Assigned to ${dispatchAgency.toUpperCase()} — Case #${selectedIncident.id.slice(0, 8)}`);
      await loadData();
    } catch (err: any) {
      notify(`Assign failed: ${err.message || "Error"}`);
    } finally {
      setIsBusy(false);
    }
  }

  async function handleResponderStatus(status: string) {
    const assigns = (selectedIncident as any)?.assignments || [];
    const asnId = assigns[0]?.id;
    if (!asnId) {
      notify("No assignment ID found on this incident yet.");
      return;
    }
    setIsBusy(true);
    try {
      if (status === "acknowledged") {
        await eawsApi.acknowledgeResponse(asnId);
      } else {
        await eawsApi.updateAssignmentStatus(asnId, { status });
      }
      notify(`Responder status updated to ${status.toUpperCase()}`);
      await loadData();
    } catch (err: any) {
      notify(`Status update failed: ${err.message || "Error"}`);
    } finally {
      setIsBusy(false);
    }
  }

  function toggleSimulateMovement() {
    if (isSimulatingMove) {
      if (simTimerRef.current) clearInterval(simTimerRef.current);
      simTimerRef.current = null;
      setIsSimulatingMove(false);
      notify("Stopped responder GPS simulation");
      return;
    }
    const inc = selectedIncident as any;
    if (!inc || inc.latitude == null || inc.longitude == null) return;
    const asn = inc.assignments?.[0];
    if (!asn?.id) {
      notify("Assign a unit first before simulating live movement.");
      return;
    }

    // Start ~1.5km away from victim and step closer every 2 seconds
    let curLat = inc.latitude + 0.012;
    let curLng = inc.longitude + 0.012;
    const unitId = asn.unit_id || undefined;
    setIsSimulatingMove(true);
    notify("Simulating responder unit moving toward victim (every 2s)...");

    simTimerRef.current = setInterval(async () => {
      curLat += (inc.latitude - curLat) * 0.25;
      curLng += (inc.longitude - curLng) * 0.25;
      try {
        await eawsApi.postUnitLocation({
          latitude: curLat,
          longitude: curLng,
          assignment_id: asn.id,
          unit_id: unitId,
          speed_kmh: 48,
          heading: 225,
        });
        loadData();
      } catch (_) {}
    }, 2000);
  }

  const activeAssignment = (selectedIncident as any)?.assignments?.[0];

  return (
    <div className="h-screen w-screen bg-neutral-950 text-white flex flex-col overflow-hidden">
      {/* Top District Command Header */}
      <header className="h-14 border-b border-neutral-800 bg-neutral-900/90 px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/40 flex items-center justify-center">
            <Shield size={18} className="text-blue-400" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-wide uppercase">
              District &amp; Divisional Dispatch Console
            </h1>
            <p className="text-[11px] text-neutral-400 font-mono">
              Tier 3 Tactical Queue • Real-Time Triage &amp; Station Proximity Routing
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <select
            value={regionFilter}
            onChange={(e) => setRegionFilter(e.target.value)}
            className="bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-neutral-200"
          >
            <option value="ALL">All Regions / Districts</option>
            <option value="GREATER_ACCRA">Greater Accra</option>
            <option value="ASHANTI">Ashanti</option>
            <option value="CENTRAL">Central</option>
            <option value="EASTERN">Eastern</option>
            <option value="BONO">Bono</option>
            <option value="BONO_EAST">Bono East</option>
            <option value="NORTHERN">Northern</option>
            <option value="NORTH_EAST">North East</option>
            <option value="OTI">Oti</option>
            <option value="SAVANNAH">Savannah</option>
            <option value="AHAFO">Ahafo</option>
          </select>

          <select
            value={agencyFilter}
            onChange={(e) => setAgencyFilter(e.target.value)}
            className="bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-neutral-200"
          >
            <option value="ALL">All Agencies</option>
            <option value="police">Police</option>
            <option value="fire">Fire Service</option>
            <option value="ambulance">Ambulance (NAS)</option>
            <option value="nadmo">NADMO</option>
          </select>

          <button
            onClick={() => setAudioEnabled(!audioEnabled)}
            className="p-2 rounded-lg border border-neutral-800 bg-neutral-950 hover:bg-neutral-800 text-neutral-300"
            title={audioEnabled ? "Mute Alert Chime" : "Unmute Alert Chime"}
          >
            {audioEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
          </button>

          <span
            className={`px-2.5 py-1 rounded-full text-[11px] font-mono font-bold border ${
              apiStatus === "live"
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                : "bg-red-500/10 text-red-400 border-red-500/30"
            }`}
          >
            {apiStatus === "live" ? "● LIVE CAD" : "○ OFFLINE"}
          </span>
        </div>
      </header>

      {toast && (
        <div className="fixed top-16 right-5 z-50 bg-neutral-900 border border-emerald-500/50 text-emerald-300 px-4 py-2.5 rounded-lg shadow-xl text-xs font-semibold">
          {toast}
        </div>
      )}

      {/* Main 3-Pane Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Pane: Incoming Queue */}
        <aside className="w-80 border-r border-neutral-800 bg-neutral-900/50 flex flex-col shrink-0">
          <div className="p-3 border-b border-neutral-800 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-300">
              District Incident Queue ({filteredIncidents.length})
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
            {filteredIncidents.map((inc: any) => {
              const isSelected = selectedIncident?.id === inc.id;
              const isPending = inc.status === "pending" || inc.status === "new";
              return (
                <button
                  key={inc.id}
                  onClick={() => setSelectedIncident(inc)}
                  className={`w-full text-left p-3 rounded-xl border transition-all ${
                    isSelected
                      ? "bg-neutral-800/90 border-blue-500"
                      : isPending
                      ? "bg-red-950/20 border-red-500/40 hover:border-red-400"
                      : "bg-neutral-900 border-neutral-800 hover:border-neutral-700"
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                    <span className={isPending ? "text-red-400 font-bold" : "text-neutral-400"}>
                      ● {inc.severity || "CRITICAL"}
                    </span>
                    <span className="text-neutral-500">
                      {new Date(inc.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <div className="text-sm font-bold text-white truncate">
                    {inc.title || "Emergency SOS"}
                  </div>
                  <div className="text-[11px] text-neutral-400 truncate mt-0.5 flex items-center gap-1">
                    <MapPin size={11} className="shrink-0" />
                    <span>{inc.location_name || "GPS Coordinates"}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[10px]">
                    <span
                      className={`px-2 py-0.5 rounded font-bold uppercase ${
                        isPending
                          ? "bg-amber-500/20 text-amber-300"
                          : "bg-emerald-500/20 text-emerald-300"
                      }`}
                    >
                      {inc.status}
                    </span>
                    <span className="font-mono text-neutral-400">
                      {inc.district_id || inc.region_id || "UNASSIGNED"}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Center Pane: Live Map */}
        <main className="flex-1 relative">
          <LiveMap
            incidents={filteredIncidents}
            units={units}
            onSelectIncident={(id) => {
              const found = filteredIncidents.find((i) => i.id === id);
              if (found) setSelectedIncident(found);
            }}
          />
        </main>

        {/* Right Pane: Triage, Dispatch & Live Responder Testing */}
        {selectedIncident && (
          <aside className="w-[410px] border-l border-neutral-800 bg-neutral-900 flex flex-col overflow-y-auto shrink-0">
            <div className="p-4 border-b border-neutral-800 flex items-center justify-between sticky top-0 bg-neutral-900 z-10">
              <div>
                <h2 className="text-sm font-bold">{selectedIncident.title || "Emergency SOS"}</h2>
                <p className="text-[11px] text-neutral-400 font-mono">
                  {(selectedIncident as any).region_id || "UNASSIGNED"} •{" "}
                  {(selectedIncident as any).district_id || "UNASSIGNED"}
                </p>
              </div>
              <button
                onClick={() => setSelectedIncident(null)}
                className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-400"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Caller & Direct Call */}
              <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-semibold">
                    <User size={14} className="text-blue-400" />
                    <span>
                      {(selectedIncident as any).reporter_profile?.full_name ||
                        selectedIncident.user_name ||
                        "Citizen Reporter"}
                    </span>
                  </div>
                  <a
                    href={`tel:${(selectedIncident as any).reporter_profile?.phone_number || "+233244567890"}`}
                    className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold flex items-center gap-1"
                  >
                    <Phone size={12} /> Call Victim
                  </a>
                </div>
                <p className="text-xs text-neutral-400">
                  {selectedIncident.location_name} ({selectedIncident.latitude?.toFixed(4)},{" "}
                  {selectedIncident.longitude?.toFixed(4)})
                </p>
                <WebRtcVoiceCall
                  incidentId={selectedIncident.id}
                  callerLabel={
                    (selectedIncident as any).reporter_profile?.full_name ||
                    selectedIncident.user_name ||
                    "Citizen"
                  }
                />
              </div>

              {/* Closest Official Police Stations & Live Units */}
              <form onSubmit={handleAssign} className="space-y-3 rounded-xl border border-neutral-800 bg-neutral-950/60 p-3">
                <div className="text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
                  <Send size={13} className="text-red-400" /> Assign Unit / Alert Station
                </div>

                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { id: "police", label: "Police", icon: Shield },
                    { id: "ambulance", label: "Medical", icon: Activity },
                    { id: "fire", label: "Fire", icon: Flame },
                    { id: "nadmo", label: "NADMO", icon: Building2 },
                  ].map((ag) => {
                    const Icon = ag.icon;
                    const active = dispatchAgency === ag.id;
                    return (
                      <button
                        key={ag.id}
                        type="button"
                        onClick={() => setDispatchAgency(ag.id)}
                        className={`py-2 px-1 rounded-lg border text-[11px] font-bold flex flex-col items-center gap-1 ${
                          active
                            ? "bg-white text-black border-white"
                            : "bg-neutral-900 text-neutral-400 border-neutral-800"
                        }`}
                      >
                        <Icon size={14} />
                        {ag.label}
                      </button>
                    );
                  })}
                </div>

                {(nearbyUnits.length > 0 || (dispatchAgency === "police" && nearbyStations.length > 0)) && (
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-semibold text-neutral-400">
                      {nearbyUnits.length > 0
                        ? `Live Units Nearby (${nearbyUnits.length})`
                        : "Closest Official Stations (Local & Neighbouring)"}
                    </div>
                    <div className="max-h-36 overflow-y-auto space-y-1">
                      {nearbyUnits.length > 0
                        ? nearbyUnits.slice(0, 5).map((u) => (
                            <button
                              key={u.id}
                              type="button"
                              onClick={() => {
                                setSelectedUnitId(u.id);
                                setDispatchNotes(`Dispatched ${u.callsign} (${u.distance_km} km away)`);
                              }}
                              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-xs border ${
                                selectedUnitId === u.id
                                  ? "border-emerald-500 bg-emerald-500/15"
                                  : "border-neutral-800 bg-neutral-900"
                              }`}
                            >
                              <span className="font-mono font-bold truncate">{u.callsign}</span>
                              <span className="font-mono text-[10px] text-emerald-400">
                                {u.distance_km} km (~{u.eta_minutes}m)
                              </span>
                            </button>
                          ))
                        : nearbyStations.slice(0, 5).map((s) => (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() =>
                                setDispatchNotes(
                                  `Alerted ${s.station_name} (${s.district_name || s.region_id}, ${s.distance_km} km away)`
                                )
                              }
                              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded text-left text-xs border border-neutral-800 bg-neutral-900 hover:border-blue-500/50"
                            >
                              <div className="min-w-0">
                                <div className="font-semibold text-white truncate">{s.station_name}</div>
                                <div className="text-[10px] text-neutral-400 truncate">
                                  {s.district_name || s.region_id}
                                </div>
                              </div>
                              <span className="font-mono text-[10px] text-blue-400 shrink-0 ml-2">
                                {s.distance_km} km (~{s.eta_minutes}m)
                              </span>
                            </button>
                          ))}
                    </div>
                  </div>
                )}

                <textarea
                  rows={2}
                  value={dispatchNotes}
                  onChange={(e) => setDispatchNotes(e.target.value)}
                  placeholder="Dispatch notes or selected station..."
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-lg p-2 text-xs text-white"
                />

                <button
                  type="submit"
                  disabled={isBusy}
                  className="w-full bg-red-600 hover:bg-red-700 py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <Send size={13} /> Confirm Dispatch Assignment
                </button>
              </form>

              {/* Responder Status & Live GPS Movement Test Controls */}
              {activeAssignment && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/15 p-3 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-400 uppercase flex items-center gap-1.5">
                      <CheckCircle2 size={14} /> Assigned: {activeAssignment.agency_type?.toUpperCase()}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 uppercase">
                      {activeAssignment.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleResponderStatus("acknowledged")}
                      className="py-1.5 px-2 rounded bg-neutral-800 hover:bg-neutral-700 text-[11px] font-semibold"
                    >
                      1. Acknowledge
                    </button>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleResponderStatus("en_route")}
                      className="py-1.5 px-2 rounded bg-blue-600 hover:bg-blue-700 text-[11px] font-semibold"
                    >
                      2. Mark En Route
                    </button>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleResponderStatus("on_scene")}
                      className="py-1.5 px-2 rounded bg-amber-600 hover:bg-amber-700 text-[11px] font-semibold"
                    >
                      3. Arrived Scene
                    </button>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleResponderStatus("resolved")}
                      className="py-1.5 px-2 rounded bg-emerald-600 hover:bg-emerald-700 text-[11px] font-semibold"
                    >
                      4. Resolve Case
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={toggleSimulateMovement}
                    className={`w-full py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 border ${
                      isSimulatingMove
                        ? "bg-red-600/20 border-red-500 text-red-300"
                        : "bg-blue-600/20 border-blue-500 text-blue-300"
                    }`}
                  >
                    <Navigation size={13} />
                    {isSimulatingMove
                      ? "Stop Live Responder Movement"
                      : "Simulate Responder Driving to Victim"}
                  </button>
                </div>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
