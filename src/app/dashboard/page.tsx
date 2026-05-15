"use client";

import dynamic from "next/dynamic";
import { Clock, MapPin, Radio } from "lucide-react";

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

export default function DashboardPage() {
  return (
    <div className="w-full h-full relative flex">
      {/* Map takes up the full background */}
      <div className="absolute inset-0 z-0">
        <LiveMap />
      </div>

      {/* Floating Panel for Incidents */}
      <div className="relative z-10 w-[350px] m-6 flex flex-col gap-4 pointer-events-none">
        
        {/* Incident Card 1 */}
        <div className="bg-neutral-900/90 backdrop-blur-md border border-neutral-800 rounded-xl p-4 shadow-2xl pointer-events-auto transition-transform hover:scale-[1.02]">
          <div className="flex justify-between items-start mb-3">
            <div className="flex items-center gap-2">
              <span className="flex h-3 w-3 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
              </span>
              <span className="font-bold text-red-500 text-sm">CRITICAL SOS</span>
            </div>
            <span className="text-xs text-neutral-400 flex items-center gap-1">
              <Clock size={12} />
              Just now
            </span>
          </div>
          
          <h3 className="text-lg font-semibold text-white mb-1">Medical Emergency</h3>
          <p className="text-neutral-400 text-sm mb-4 flex items-center gap-1.5">
            <MapPin size={14} />
            Accra Mall Area, Spintex Rd
          </p>

          <div className="flex gap-2">
            <button className="flex-1 bg-red-600 hover:bg-red-700 text-white text-sm font-medium py-2 rounded-lg transition-colors">
              Dispatch Action
            </button>
            <button className="px-3 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg transition-colors border border-neutral-700">
              Details
            </button>
          </div>
        </div>

        {/* Incident Card 2 */}
        <div className="bg-neutral-900/90 backdrop-blur-md border border-neutral-800 rounded-xl p-4 shadow-2xl pointer-events-auto">
          <div className="flex justify-between items-start mb-3">
            <div className="flex items-center gap-2">
              <span className="relative inline-flex rounded-full h-3 w-3 bg-yellow-500"></span>
              <span className="font-bold text-yellow-500 text-sm">WARNING</span>
            </div>
            <span className="text-xs text-neutral-400 flex items-center gap-1">
              <Clock size={12} />
              15m ago
            </span>
          </div>
          
          <h3 className="text-lg font-semibold text-white mb-1">Fire Reported</h3>
          <p className="text-neutral-400 text-sm mb-4 flex items-center gap-1.5">
            <MapPin size={14} />
            Makola Market
          </p>

          <div className="flex gap-2">
            <button className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white text-sm font-medium py-2 rounded-lg transition-colors">
              Assign Fire Unit
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
