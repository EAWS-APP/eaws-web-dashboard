"use client";

import { useEffect, useState, useCallback } from "react";
import { MapPin, Zap, Phone, Wifi } from "lucide-react";
import { eawsApi } from "@/lib/api";
import type { AgencyUnit } from "@/lib/models";
import SentinelShell from "@/components/SentinelShell";

const FALLBACK_UNITS: AgencyUnit[] = [
  { id: "gnfs-eng-12", agency_type: "fire", name: "Engine 12", status: "available", latitude: 5.60, longitude: -0.18, last_seen_at: new Date().toISOString() },
  { id: "gnfs-lad-04", agency_type: "fire", name: "Ladder 04", status: "en_route", latitude: 5.58, longitude: -0.22, last_seen_at: new Date().toISOString() },
  { id: "pol-pt-21", agency_type: "police", name: "Patrol 21", status: "on_scene", latitude: 5.55, longitude: -0.17, last_seen_at: new Date().toISOString() },
  { id: "pol-int-08", agency_type: "police", name: "Unit 08", status: "available", latitude: 5.60, longitude: -0.19, last_seen_at: new Date().toISOString() },
  { id: "ndr-rel-03", agency_type: "nadmo", name: "Relief 03", status: "offline", latitude: 5.65, longitude: -0.25, last_seen_at: new Date().toISOString() },
  { id: "amb-alpha", agency_type: "ambulance", name: "Ambulance Alpha", status: "en_route", latitude: 5.62, longitude: -0.18, last_seen_at: new Date().toISOString() },
];

const STATUS_BADGE: Record<string, string> = {
  available: "text-green-400 bg-green-500/10 border border-green-500/20",
  en_route: "text-blue-400 bg-blue-500/10 border border-blue-500/20",
  on_scene: "text-orange-400 bg-orange-500/10 border border-orange-500/20",
  assigned: "text-yellow-400 bg-yellow-500/10 border border-yellow-500/20",
  offline: "text-neutral-500 bg-neutral-800 border border-neutral-700",
};

const AGENCY_LABEL: Record<string, string> = {
  fire: "Fire Service / GNFS",
  police: "Police",
  ambulance: "Ambulance",
  nadmo: "National Disaster",
};

const AGENCY_ICON: Record<string, string> = { fire: "🔥", police: "🛡️", ambulance: "🚑", nadmo: "⚠️" };

function elapsedMins(iso?: string) {
  if (!iso) return "—";
  return Math.round((Date.now() - new Date(iso).getTime()) / 60000) + "m";
}

export default function ResourcesPage() {
  const [units, setUnits] = useState<AgencyUnit[]>(FALLBACK_UNITS);
  const [selectedUnit, setSelectedUnit] = useState<AgencyUnit>(FALLBACK_UNITS[0]);
  const [opNotes, setOpNotes] = useState("Assigned to flood response corridor near East Legon.\nCrew requested radio check before re-route.");

  const loadUnits = useCallback(async () => {
    try {
      const data = await eawsApi.getLiveUnits();
      if (data?.length) {
        setUnits(data);
        setSelectedUnit((prev) => data.find((u) => u.id === prev.id) || data[0]);
      }
    } catch { /* use fallback */ }
  }, []);

  useEffect(() => {
    loadUnits();
    const iv = setInterval(loadUnits, 10000);
    return () => clearInterval(iv);
  }, [loadUnits]);

  const totals = {
    total: units.length,
    available: units.filter((u) => u.status === "available").length,
    deployed: units.filter((u) => ["en_route", "on_scene", "assigned"].includes(u.status)).length,
    offline: units.filter((u) => u.status === "offline").length,
  };

  const agencies = ["fire", "police", "ambulance", "nadmo"] as const;

  // Simulated telemetry for selected unit
  const sim = {
    position: selectedUnit.agency_type === "fire" ? "North Ridge · Accra" : selectedUnit.agency_type === "police" ? "Osu · Accra" : "East Legon · Accra",
    eta: selectedUnit.status === "available" ? "—" : "08 min",
    crew: selectedUnit.agency_type === "fire" ? 6 : selectedUnit.agency_type === "ambulance" ? 3 : 2,
    fuel: 74,
    signal: "Strong",
    speed: selectedUnit.status === "en_route" ? 42 : 0,
    battery: 91,
    comms: selectedUnit.status === "offline" ? "Offline" : "Online",
    lastPing: 12,
  };

  return (
    <SentinelShell title="Resources" subtitle="Manage responders, units, and dispatch capacity across services">
      <div className="h-full flex overflow-hidden bg-[#090909]">

        {/* LEFT: Main resources panel */}
        <div className="flex-1 overflow-y-auto">

          {/* Stats bar */}
          <div className="grid grid-cols-4 gap-px bg-neutral-900 border-b border-neutral-900">
            {[
              { label: "Total Units", value: totals.total, sub: "Across all agencies" },
              { label: "Available", value: totals.available, sub: "Ready for assignment" },
              { label: "Deployed", value: totals.deployed, sub: "On scene or en route" },
              { label: "Offline", value: totals.offline, sub: "Needs attention" },
            ].map((s) => (
              <div key={s.label} className="bg-[#0e0e0e] px-5 py-4">
                <p className="text-[10px] text-neutral-500 mb-1">{s.label}</p>
                <p className="text-3xl font-black text-white font-mono">{s.value}</p>
                <p className="text-[9px] text-neutral-600 mt-1">{s.sub}</p>
              </div>
            ))}
          </div>

          <div className="p-5 space-y-5">
            {/* Agency Capacity bars */}
            <div className="bg-[#0e0e0e] border border-neutral-900 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-[11px] font-bold text-white">Agency Capacity</p>
                  <p className="text-[9px] text-neutral-500">Live readiness and deployment balance</p>
                </div>
                <span className="text-[9px] font-bold text-neutral-400 bg-neutral-800 border border-neutral-700 rounded px-2 py-0.5">Unified</span>
              </div>
              <div className="space-y-4">
                {[
                  { label: "Fire Service / GNFS", count: units.filter(u => u.agency_type === "fire").length || 18, color: "bg-orange-500", max: 25 },
                  { label: "Police", count: units.filter(u => u.agency_type === "police").length || 24, color: "bg-blue-500", max: 30 },
                  { label: "National Disaster", count: units.filter(u => u.agency_type === "nadmo").length || 9, color: "bg-purple-500", max: 15 },
                ].map((ag) => (
                  <div key={ag.label}>
                    <div className="flex justify-between text-[10px] mb-1.5">
                      <span className="text-neutral-300">{ag.label}</span>
                      <span className="text-neutral-400 font-mono">{ag.count} units</span>
                    </div>
                    <div className="h-2 rounded-full bg-neutral-800">
                      <div className={`h-2 rounded-full ${ag.color} transition-all`} style={{ width: `${(ag.count / ag.max) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Resources by Agency */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-[11px] font-bold text-white">Resources by Agency</p>
                  <p className="text-[9px] text-neutral-500">Units, personnel, status, and quick actions</p>
                </div>
                <div className="flex gap-2">
                  {["Assign", "Reassign", "Contact"].map(a => (
                    <button key={a} className="text-[9px] font-bold bg-neutral-800 hover:bg-neutral-700 text-neutral-300 px-2.5 py-1 rounded transition-colors">{a}</button>
                  ))}
                </div>
              </div>

              {agencies.map((agType) => {
                const agUnits = units.filter((u) => u.agency_type === agType);
                if (agUnits.length === 0) return null;
                const avail = agUnits.filter(u => u.status === "available").length;
                return (
                  <div key={agType} className="mb-4 bg-[#0e0e0e] border border-neutral-900 rounded-xl overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-900">
                      <div className="flex items-center gap-2">
                        <span>{AGENCY_ICON[agType]}</span>
                        <div>
                          <p className="text-[11px] font-bold text-white">{AGENCY_LABEL[agType]}</p>
                          <p className="text-[9px] text-neutral-500">
                            {agType === "fire" ? "Operational response units" : agType === "police" ? "Patrol, perimeter, and escort units" : agType === "ambulance" ? "Emergency medical response" : "Flood, quake, and logistics support"}
                          </p>
                        </div>
                      </div>
                      <span className="text-[9px] font-bold text-green-400">{avail} available</span>
                    </div>
                    {agUnits.map((unit) => (
                      <div
                        key={unit.id}
                        onClick={() => setSelectedUnit(unit)}
                        className={`grid grid-cols-[1.2fr_0.8fr_0.6fr_0.6fr_0.7fr_1fr] gap-3 px-4 py-3 border-b border-neutral-900 last:border-0 cursor-pointer transition-colors items-center ${
                          selectedUnit?.id === unit.id ? "bg-neutral-900" : "hover:bg-neutral-900/50"
                        }`}
                      >
                        <div>
                          <p className="text-[11px] font-semibold text-white">{unit.name}</p>
                          <p className="text-[8px] text-neutral-600 font-mono">{unit.id.toUpperCase()}</p>
                        </div>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded capitalize w-fit ${STATUS_BADGE[unit.status] || STATUS_BADGE["offline"]}`}>
                          {unit.status.replace("_", " ")}
                        </span>
                        <span className="text-[10px] text-neutral-500 font-mono">
                          {unit.status === "en_route" ? "08 min" : "—"}
                        </span>
                        <span className="text-[10px] text-neutral-400">
                          {agType === "fire" ? "6 crew" : agType === "ambulance" ? "3 crew" : "2 crew"}
                        </span>
                        <span className="text-[10px] text-neutral-500 flex items-center gap-1">
                          <MapPin size={8} />
                          {unit.latitude.toFixed(2)}°N
                        </span>
                        <div className="flex gap-1.5">
                          <button
                            className={`text-[9px] font-bold px-2 py-1 rounded transition-colors ${
                              unit.status === "available"
                                ? "bg-red-600 hover:bg-red-700 text-white"
                                : "bg-orange-600 hover:bg-orange-700 text-white"
                            }`}
                          >
                            {unit.status === "available" ? "Assign" : "Reassign"}
                          </button>
                          <button className="text-[9px] font-bold bg-neutral-800 hover:bg-neutral-700 text-neutral-300 px-2 py-1 rounded transition-colors">
                            Contact
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* RIGHT: Selected Unit detail */}
        <div className="w-[280px] min-w-[280px] border-l border-neutral-900 bg-[#0e0e0e] overflow-y-auto flex flex-col">
          <div className="px-4 pt-4 pb-2 border-b border-neutral-900">
            <div className="flex items-center justify-between">
              <p className="text-[8px] font-bold tracking-widest text-neutral-600 uppercase">Selected Unit</p>
              <span className="text-[9px] font-bold text-white bg-neutral-800 border border-neutral-700 px-2 py-0.5 rounded font-mono">{selectedUnit?.id?.toUpperCase().slice(0, 8) || "—"}</span>
            </div>
            <p className="text-[9px] text-neutral-500 mt-0.5">Live location and telemetry</p>
          </div>

          {selectedUnit && (
            <>
              <div className="px-4 py-3 border-b border-neutral-900">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[8px] font-bold tracking-widest text-neutral-600 uppercase">Current Position</p>
                  <span className="text-[8px] font-bold text-green-400">Live</span>
                </div>
                <p className="text-[13px] font-bold text-white mb-3">{sim.position}</p>
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  {[
                    { label: "ETA", value: sim.eta },
                    { label: "Crew", value: sim.crew },
                    { label: "Fuel", value: `${sim.fuel}%` },
                    { label: "Signal", value: sim.signal },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-neutral-900 rounded-lg p-2.5">
                      <p className="text-[8px] text-neutral-600 mb-0.5">{label}</p>
                      <p className="font-bold text-white font-mono">{value}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="px-4 py-3 border-b border-neutral-900">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[8px] font-bold tracking-widest text-neutral-600 uppercase">Telemetry</p>
                  <Zap size={10} className="text-green-400" />
                </div>
                <div className="space-y-2 text-[10px]">
                  {[
                    { label: "Speed", value: sim.speed > 0 ? `${sim.speed} km/h` : "Stationary" },
                    { label: "Battery", value: `${sim.battery}%` },
                    { label: "Comms", value: sim.comms },
                    { label: "Last Ping", value: `${sim.lastPing} sec` },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between">
                      <span className="text-neutral-500">{label}</span>
                      <span className={`font-mono font-bold ${label === "Comms" && sim.comms === "Offline" ? "text-red-400" : "text-neutral-300"}`}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="px-4 py-3 border-b border-neutral-900">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[8px] font-bold tracking-widest text-neutral-600 uppercase">Live Location</p>
                  <span className="text-[8px] font-bold text-blue-400">GPS</span>
                </div>
                <div className="h-24 bg-neutral-900 rounded-lg border border-neutral-800 flex items-center justify-center">
                  <div className="text-center">
                    <MapPin size={20} className="text-red-500 mx-auto mb-1" />
                    <p className="text-[9px] text-neutral-500 font-mono">{selectedUnit.latitude.toFixed(4)}°N, {Math.abs(selectedUnit.longitude).toFixed(4)}°W</p>
                  </div>
                </div>
              </div>

              <div className="px-4 py-3">
                <p className="text-[8px] font-bold tracking-widest text-neutral-600 uppercase mb-2">Operational Notes</p>
                <p className="text-[9px] text-neutral-500 mb-2">Fast actions for the selected resource</p>
                <textarea
                  value={opNotes}
                  onChange={(e) => setOpNotes(e.target.value)}
                  rows={3}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-[10px] text-neutral-300 resize-none focus:outline-none focus:border-neutral-600 mb-3"
                />
                <div className="flex gap-2">
                  <button className="flex-1 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-[10px] font-bold transition-colors">Assign</button>
                  <button className="flex-1 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[10px] font-bold transition-colors">Reassign</button>
                  <button className="flex-1 py-2 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-400 text-[10px] font-bold transition-colors">Contact</button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </SentinelShell>
  );
}
