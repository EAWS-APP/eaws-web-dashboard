"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { Clock, MapPin, Radio } from "lucide-react";
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
  const [incidents, setIncidents] = useState<Incident[]>(fallbackIncidents);
  const [units, setUnits] = useState<AgencyUnit[]>(fallbackUnits);
  const [apiStatus, setApiStatus] = useState<"live" | "fallback">("fallback");

  useEffect(() => {
    let isMounted = true;

    async function loadLiveData() {
      try {
        const [liveIncidents, liveUnits] = await Promise.all([
          eawsApi.getLiveIncidents(),
          eawsApi.getLiveUnits(),
        ]);
        if (!isMounted) return;
        setIncidents(liveIncidents);
        setUnits(liveUnits);
        setApiStatus("live");
      } catch (error) {
        console.warn("EAWS live dashboard fallback active:", error);
        if (isMounted) setApiStatus("fallback");
      }
    }

    loadLiveData();
    const interval = window.setInterval(loadLiveData, 15000);
    return () => {
      isMounted = false;
      window.clearInterval(interval);
    };
  }, []);

  return (
    <div className="w-full h-full relative flex">
      {/* Map takes up the full background */}
      <div className="absolute inset-0 z-0">
        <LiveMap incidents={incidents} units={units} />
      </div>

      {/* Floating Panel for Incidents */}
      <div className="relative z-10 w-[350px] m-6 flex flex-col gap-4 pointer-events-none">
        
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/90 px-3 py-2 text-xs font-medium text-neutral-300 pointer-events-auto">
          API mode: <span className={apiStatus === "live" ? "text-green-400" : "text-yellow-400"}>{apiStatus}</span>
        </div>

        {incidents.slice(0, 4).map((incident) => {
          const isCritical = incident.severity === "CRITICAL";
          const dotClass = isCritical ? "bg-red-500" : "bg-yellow-500";
          const textClass = isCritical ? "text-red-500" : "text-yellow-500";
          const buttonClass = isCritical ? "bg-red-600 hover:bg-red-700" : "bg-yellow-600 hover:bg-yellow-700";
          return (
            <div
              key={incident.id}
              className="bg-neutral-900/90 backdrop-blur-md border border-neutral-800 rounded-xl p-4 shadow-2xl pointer-events-auto transition-transform hover:scale-[1.02]"
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-3 w-3 relative">
                    {isCritical ? (
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    ) : null}
                    <span className={`relative inline-flex rounded-full h-3 w-3 ${dotClass}`}></span>
                  </span>
                  <span className={`font-bold ${textClass} text-sm`}>{incident.severity}</span>
                </div>
                <span className="text-xs text-neutral-400 flex items-center gap-1">
                  <Clock size={12} />
                  {new Date(incident.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>

              <h3 className="text-lg font-semibold text-white mb-1">{incident.title}</h3>
              <p className="text-neutral-400 text-sm mb-4 flex items-center gap-1.5">
                <MapPin size={14} />
                {incident.location_name}
              </p>

              <div className="flex gap-2">
                <button className={`flex-1 ${buttonClass} text-white text-sm font-medium py-2 rounded-lg transition-colors`}>
                  Dispatch Action
                </button>
                <button className="px-3 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg transition-colors border border-neutral-700">
                  Details
                </button>
              </div>
            </div>
          );
        })}

      </div>
    </div>
  );
}
