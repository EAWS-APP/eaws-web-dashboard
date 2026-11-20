"use client";

import React, { useState } from "react";
import { AlertCircle, Radio, X, Send, ShieldAlert } from "lucide-react";
import { eawsApi } from "@/lib/api";

interface Reverse911ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function Reverse911Modal({ isOpen, onClose, onSuccess }: Reverse911ModalProps) {
  const [region, setRegion] = useState("GREATER ACCRA");
  const [broadcastType, setBroadcastType] = useState("EVACUATION");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [radiusKm, setRadiusKm] = useState("5");
  const [isSending, setIsSending] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !message) {
      alert("Please fill in alert title and broadcast message.");
      return;
    }

    setIsSending(true);
    try {
      await eawsApi.sendGeofencedBroadcast({
        title,
        message,
        alert_type: broadcastType,
        region_id: region,
        radius_meters: parseFloat(radiusKm) * 1000,
      });
      alert(`Reverse 911 Geofenced Broadcast triggered for region ${region}!`);
      setTitle("");
      setMessage("");
      onSuccess?.();
      onClose();
    } catch (err: any) {
      alert("Broadcast alert trigger failed: " + (err.message || err));
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-neutral-900 border border-red-500/40 rounded-xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95">
        <div className="bg-red-950/60 border-b border-red-500/30 p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-red-500 animate-pulse" />
            <h3 className="text-sm font-bold text-red-200 uppercase tracking-wide font-mono">
              Reverse 911 Geofenced Broadcast
            </h3>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 font-mono text-xs">
          <div>
            <label className="block text-neutral-400 mb-1">Target Region Matrix</label>
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-800 rounded px-3 py-2 text-neutral-200 focus:border-red-500 focus:outline-none"
            >
              <option value="GREATER ACCRA">Greater Accra</option>
              <option value="ASHANTI">Ashanti (Kumasi)</option>
              <option value="WESTERN">Western (Takoradi)</option>
              <option value="EASTERN">Eastern (Koforidua)</option>
              <option value="NORTHERN">Northern (Tamale)</option>
              <option value="ALL_REGIONS">NATIONAL EMERGENCY (ALL 16 REGIONS)</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-neutral-400 mb-1">Alert Classification</label>
              <select
                value={broadcastType}
                onChange={(e) => setBroadcastType(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded px-3 py-2 text-neutral-200 focus:border-red-500 focus:outline-none"
              >
                <option value="EVACUATION">EVACUATION ORDER</option>
                <option value="SHELTER_IN_PLACE">SHELTER IN PLACE</option>
                <option value="FLASH_FLOOD">SEVERE FLOOD WARNING</option>
                <option value="SECURITY_THREAT">NATIONAL SECURITY ALERT</option>
              </select>
            </div>

            <div>
              <label className="block text-neutral-400 mb-1">Geofence Radius (KM)</label>
              <input
                type="number"
                value={radiusKm}
                onChange={(e) => setRadiusKm(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded px-3 py-2 text-neutral-200 focus:border-red-500 focus:outline-none"
                min="1"
                max="50"
              />
            </div>
          </div>

          <div>
            <label className="block text-neutral-400 mb-1">Broadcast Title</label>
            <input
              type="text"
              placeholder="e.g. URGENT: Evacuation Notice for Weija Dam Radius"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-800 rounded px-3 py-2 text-neutral-200 focus:border-red-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-neutral-400 mb-1">Emergency Message Payload</label>
            <textarea
              rows={4}
              placeholder="Enter precise citizen directive broadcast text..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-800 rounded px-3 py-2 text-neutral-200 focus:border-red-500 focus:outline-none"
            />
          </div>

          <div className="pt-3 border-t border-neutral-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-neutral-800 text-neutral-300 rounded hover:bg-neutral-700 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSending}
              className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded flex items-center gap-1.5 transition disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              {isSending ? "Broadcasting..." : "Dispatch Geofenced Alert"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
