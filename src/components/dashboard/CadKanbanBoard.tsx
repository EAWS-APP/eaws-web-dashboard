"use client";

import React from "react";
import { AlertTriangle, CheckCircle, Clock, Shield, ArrowRight, UserCheck } from "lucide-react";
import type { Incident } from "@/lib/models";

interface CadKanbanBoardProps {
  incidents: Incident[];
  onUpdateStatus: (id: string, status: string) => void;
}

const COLUMNS = [
  { id: "pending", label: "Pending Verification", color: "border-amber-500/40 text-amber-400 bg-amber-500/10" },
  { id: "verified", label: "Verified / Active", color: "border-blue-500/40 text-blue-400 bg-blue-500/10" },
  { id: "dispatched", label: "Unit Dispatched", color: "border-purple-500/40 text-purple-400 bg-purple-500/10" },
  { id: "in_progress", label: "On Scene / Operations", color: "border-emerald-500/40 text-emerald-400 bg-emerald-500/10" },
  { id: "resolved", label: "Resolved", color: "border-neutral-700 text-neutral-400 bg-neutral-800/40" },
];

export function CadKanbanBoard({ incidents, onUpdateStatus }: CadKanbanBoardProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-3 h-full overflow-x-auto p-1">
      {COLUMNS.map((col) => {
        const colIncidents = incidents.filter(
          (inc) => (inc.status || "pending").toLowerCase() === col.id.toLowerCase()
        );

        return (
          <div
            key={col.id}
            className="flex flex-col bg-neutral-900/80 border border-neutral-800/80 rounded-xl p-3 min-w-[220px]"
          >
            <div className="flex items-center justify-between pb-2 border-b border-neutral-800 mb-2">
              <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded border ${col.color}`}>
                {col.label}
              </span>
              <span className="text-xs font-mono text-neutral-400 bg-neutral-800 px-1.5 py-0.5 rounded">
                {colIncidents.length}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-0.5">
              {colIncidents.length === 0 ? (
                <div className="h-24 flex items-center justify-center text-neutral-600 text-[11px] font-mono italic">
                  Clear
                </div>
              ) : (
                colIncidents.map((inc) => (
                  <div
                    key={inc.id}
                    className="p-3 bg-neutral-950/80 border border-neutral-800 rounded-lg hover:border-neutral-700 transition space-y-2"
                  >
                    <div className="flex items-start justify-between">
                      <span className="text-xs font-semibold text-neutral-200">
                        {inc.title || inc.category || "Incident"}
                      </span>
                      <span
                        className={`text-[9px] font-mono px-1.5 py-0.2 rounded uppercase ${
                          inc.priority === "high" || inc.priority === "critical"
                            ? "bg-red-500/20 text-red-400"
                            : "bg-neutral-800 text-neutral-400"
                        }`}
                      >
                        {inc.priority || "MED"}
                      </span>
                    </div>

                    <p className="text-[11px] text-neutral-400 font-mono line-clamp-2">
                      {inc.description || "No tactical details recorded."}
                    </p>

                    <div className="pt-2 border-t border-neutral-900 flex items-center justify-between text-[10px]">
                      <span className="text-neutral-500 font-mono">
                        {inc.region || "Accra"}
                      </span>
                      {col.id !== "resolved" && (
                        <button
                          onClick={() => {
                            const nextStatus =
                              col.id === "pending"
                                ? "verified"
                                : col.id === "verified"
                                ? "dispatched"
                                : col.id === "dispatched"
                                ? "in_progress"
                                : "resolved";
                            onUpdateStatus(inc.id, nextStatus);
                          }}
                          className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-mono font-medium"
                        >
                          Advance <ArrowRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
