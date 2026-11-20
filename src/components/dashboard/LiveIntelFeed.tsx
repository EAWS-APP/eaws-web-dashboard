"use client";

import React from "react";
import { AlertTriangle, Clock, MapPin, ShieldAlert, CheckCircle2, ChevronRight } from "lucide-react";
import type { Incident } from "@/lib/models";

interface LiveIntelFeedProps {
  incidents: Incident[];
  onSelectIncident?: (incident: Incident) => void;
  onVerify?: (id: string) => void;
  onResolve?: (id: string) => void;
  selectedId?: string;
  agencyFilter?: string;
}

export function LiveIntelFeed({
  incidents,
  onSelectIncident,
  onVerify,
  onResolve,
  selectedId,
  agencyFilter = "ALL",
}: LiveIntelFeedProps) {
  const filtered = incidents.filter(
    (inc) => agencyFilter === "ALL" || inc.agency_type?.toUpperCase() === agencyFilter.toUpperCase()
  );

  return (
    <div className="bg-neutral-900/90 border border-neutral-800 rounded-xl p-4 shadow-xl backdrop-blur flex flex-col h-full">
      <div className="flex items-center justify-between pb-3 border-b border-neutral-800 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
          <h3 className="text-sm font-semibold text-neutral-100 tracking-wide uppercase font-mono">
            Live Tactical Intel Feed
          </h3>
        </div>
        <span className="text-xs font-mono bg-neutral-800 text-neutral-400 px-2 py-0.5 rounded-full">
          {filtered.length} Active Events
        </span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
        {filtered.length === 0 ? (
          <div className="h-40 flex flex-col items-center justify-center text-neutral-500 text-xs font-mono">
            <ShieldAlert className="w-8 h-8 mb-2 stroke-[1.5] text-neutral-600" />
            No active emergency signals matching criteria
          </div>
        ) : (
          filtered.map((incident) => {
            const isSelected = selectedId === incident.id;
            const isHighPriority = incident.priority === "high" || incident.priority === "critical";

            return (
              <div
                key={incident.id}
                onClick={() => onSelectIncident?.(incident)}
                className={`group relative p-3 rounded-lg border transition-all cursor-pointer ${
                  isSelected
                    ? "bg-amber-950/30 border-amber-500/60 shadow-lg shadow-amber-950/40"
                    : "bg-neutral-950/60 border-neutral-800/80 hover:border-neutral-700 hover:bg-neutral-800/40"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded uppercase font-bold tracking-wider ${
                        isHighPriority
                          ? "bg-red-500/20 text-red-400 border border-red-500/30"
                          : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                      }`}
                    >
                      {incident.priority || "NORMAL"}
                    </span>
                    <span className="text-xs font-semibold text-neutral-200 truncate max-w-[180px]">
                      {incident.title || incident.category || "Emergency SOS"}
                    </span>
                  </div>
                  <span className="text-[10px] text-neutral-400 font-mono flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(incident.created_at || Date.now()).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>

                <p className="text-xs text-neutral-400 mt-1.5 line-clamp-2 font-mono leading-relaxed">
                  {incident.description || "No description provided."}
                </p>

                <div className="mt-2.5 pt-2 border-t border-neutral-800/60 flex items-center justify-between text-[11px] text-neutral-400">
                  <div className="flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-red-400" />
                    <span className="font-mono text-neutral-300">
                      {incident.region || "Accra Metro"}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {incident.status === "pending" && onVerify && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onVerify(incident.id);
                        }}
                        className="px-2 py-0.5 text-[10px] font-mono rounded bg-emerald-950 text-emerald-300 border border-emerald-800 hover:bg-emerald-900 transition"
                      >
                        Verify
                      </button>
                    )}
                    {incident.status !== "resolved" && onResolve && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onResolve(incident.id);
                        }}
                        className="px-2 py-0.5 text-[10px] font-mono rounded bg-neutral-800 text-neutral-300 hover:bg-neutral-700 transition"
                      >
                        Resolve
                      </button>
                    )}
                    <ChevronRight className="w-3.5 h-3.5 text-neutral-500 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
