"use client";

import React from "react";
import { Activity, Heart, Thermometer, PhoneCall, Radio, Shield } from "lucide-react";

interface PatientVitalsCardProps {
  unitCode?: string;
  patientName?: string;
  heartRate?: number;
  spo2?: number;
  bloodPressure?: string;
  etaMinutes?: number;
  destinationHospital?: string;
  onAudioCall?: () => void;
}

export function PatientVitalsCard({
  unitCode = "AMB-UNIT-04",
  patientName = "Emergency Patient #8841",
  heartRate = 88,
  spo2 = 97,
  bloodPressure = "120/80",
  etaMinutes = 7,
  destinationHospital = "Korle Bu Teaching Hospital (Trauma Center)",
  onAudioCall,
}: PatientVitalsCardProps) {
  const isHrNormal = heartRate >= 60 && heartRate <= 100;
  const isSpo2Normal = spo2 >= 95;

  return (
    <div className="bg-neutral-900/90 border border-emerald-500/30 rounded-xl p-4 shadow-xl backdrop-blur font-mono text-xs space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-emerald-400 animate-pulse" />
          <div>
            <h4 className="font-bold text-neutral-100">{unitCode} - Tele-Med Sync</h4>
            <p className="text-[10px] text-neutral-400">{patientName}</p>
          </div>
        </div>
        <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
          LIVE VITAL STREAM
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-neutral-950 p-2.5 rounded-lg border border-neutral-800">
          <div className="flex items-center justify-center gap-1 text-red-400 text-[10px] mb-1">
            <Heart className="w-3.5 h-3.5 animate-bounce" /> HR (BPM)
          </div>
          <div className={`text-lg font-bold ${isHrNormal ? "text-emerald-400" : "text-red-400"}`}>
            {heartRate}
          </div>
        </div>

        <div className="bg-neutral-950 p-2.5 rounded-lg border border-neutral-800">
          <div className="flex items-center justify-center gap-1 text-cyan-400 text-[10px] mb-1">
            <Activity className="w-3.5 h-3.5" /> SpO2 (%)
          </div>
          <div className={`text-lg font-bold ${isSpo2Normal ? "text-cyan-400" : "text-amber-400"}`}>
            {spo2}%
          </div>
        </div>

        <div className="bg-neutral-950 p-2.5 rounded-lg border border-neutral-800">
          <div className="flex items-center justify-center gap-1 text-purple-400 text-[10px] mb-1">
            <Thermometer className="w-3.5 h-3.5" /> BP (mmHg)
          </div>
          <div className="text-lg font-bold text-purple-300">{bloodPressure}</div>
        </div>
      </div>

      <div className="bg-neutral-950 p-3 rounded-lg border border-neutral-800/80 space-y-1.5 text-[11px]">
        <div className="flex justify-between text-neutral-400">
          <span>Destination Hospital:</span>
          <span className="text-neutral-200 font-semibold">{destinationHospital}</span>
        </div>
        <div className="flex justify-between text-neutral-400">
          <span>Transit ETA:</span>
          <span className="text-emerald-400 font-bold">{etaMinutes} mins remaining</span>
        </div>
      </div>

      {onAudioCall && (
        <button
          onClick={onAudioCall}
          className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded flex items-center justify-center gap-2 transition"
        >
          <PhoneCall className="w-4 h-4" /> Open Direct Tele-Med Channel
        </button>
      )}
    </div>
  );
}
