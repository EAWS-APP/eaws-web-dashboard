"use client";

import React, { useState } from "react";
import { Users, Upload, ShieldCheck, X, FileText, CheckCircle2 } from "lucide-react";
import { eawsApi } from "@/lib/api";

interface RosterManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  roster: any[];
  onRefreshRoster?: () => void;
}

export function RosterManagerModal({
  isOpen,
  onClose,
  roster,
  onRefreshRoster,
}: RosterManagerModalProps) {
  const [activeTab, setActiveTab] = useState<"directory" | "bulk">("directory");
  const [bulkInput, setBulkInput] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  if (!isOpen) return null;

  const handleBulkUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkInput.trim()) return;

    setIsUploading(true);
    try {
      const lines = bulkInput.trim().split("\n");
      const parsedRoster = lines.map((line) => {
        const [badge_number, full_name, agency_type, rank, phone] = line.split(",").map((s) => s.trim());
        return {
          badge_number: badge_number || `ROSTER-${Math.floor(Math.random() * 90000 + 10000)}`,
          full_name: full_name || "Unknown Operator",
          agency_type: agency_type || "POLICE",
          rank: rank || "Officer",
          phone: phone || "+233200000000",
        };
      });

      await eawsApi.uploadAgencyRoster(parsedRoster);
      alert(`Successfully ingested ${parsedRoster.length} roster entries into database!`);
      setBulkInput("");
      onRefreshRoster?.();
      setActiveTab("directory");
    } catch (err: any) {
      alert("Roster bulk upload failed: " + (err.message || err));
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl w-full max-w-2xl overflow-hidden shadow-2xl">
        <div className="bg-neutral-950 border-b border-neutral-800 p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-400" />
            <h3 className="text-sm font-bold text-neutral-100 uppercase tracking-wide font-mono">
              Agency Roster & Personnel Master Directory
            </h3>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex border-b border-neutral-800 bg-neutral-950/60 font-mono text-xs">
          <button
            onClick={() => setActiveTab("directory")}
            className={`px-4 py-2.5 font-semibold flex items-center gap-2 ${
              activeTab === "directory"
                ? "text-emerald-400 border-b-2 border-emerald-500 bg-neutral-900"
                : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            <Users className="w-4 h-4" /> Active Directory ({roster.length})
          </button>
          <button
            onClick={() => setActiveTab("bulk")}
            className={`px-4 py-2.5 font-semibold flex items-center gap-2 ${
              activeTab === "bulk"
                ? "text-emerald-400 border-b-2 border-emerald-500 bg-neutral-900"
                : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            <Upload className="w-4 h-4" /> Bulk CSV Ingestion
          </button>
        </div>

        <div className="p-5 font-mono text-xs max-h-[60vh] overflow-y-auto">
          {activeTab === "directory" ? (
            roster.length === 0 ? (
              <div className="py-12 text-center text-neutral-500">
                No active duty agency roster records ingested yet.
              </div>
            ) : (
              <div className="space-y-2">
                {roster.map((person, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-neutral-950 border border-neutral-800 rounded-lg flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-neutral-200">{person.full_name}</span>
                        <span className="text-[10px] px-1.5 py-0.2 bg-emerald-950 text-emerald-400 border border-emerald-800 rounded">
                          {person.rank || "Officer"}
                        </span>
                      </div>
                      <div className="text-[11px] text-neutral-500 mt-1">
                        Badge: <span className="text-neutral-300">{person.badge_number}</span> | Agency:{" "}
                        <span className="text-neutral-300">{person.agency_type}</span>
                      </div>
                    </div>
                    <span className="text-[10px] text-neutral-400">{person.phone || "+233..."}</span>
                  </div>
                ))}
              </div>
            )
          ) : (
            <form onSubmit={handleBulkUpload} className="space-y-4">
              <p className="text-neutral-400 text-[11px]">
                Paste CSV data in format: <code className="text-emerald-400">badge_number, full_name, agency_type, rank, phone</code>
              </p>

              <textarea
                rows={8}
                value={bulkInput}
                onChange={(e) => setBulkInput(e.target.value)}
                placeholder={`GPS-8801, Sgt. Kweku Mensah, POLICE, Sergeant, +233244123456\nGNFS-3021, Inspector Ama Serwaa, FIRE, Commander, +233200987654`}
                className="w-full bg-neutral-950 border border-neutral-800 rounded p-3 text-neutral-200 focus:border-emerald-500 focus:outline-none font-mono text-xs"
              />

              <div className="flex justify-end gap-2">
                <button
                  type="submit"
                  disabled={isUploading}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded flex items-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  {isUploading ? "Ingesting..." : "Ingest Roster Batch"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
