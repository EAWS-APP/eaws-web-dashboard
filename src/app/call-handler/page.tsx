"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { eawsApi } from "@/lib/api";
import type { Incident } from "@/lib/models";
import {
  PhoneCall, Shield, CheckCircle, AlertTriangle, Mic, MapPin, Check, X,
  UserCheck, RefreshCw, Volume2, ShieldCheck, PhoneIncoming
} from "lucide-react";

export default function CallHandlerDashboardPage() {
  const router = useRouter();
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pendingIncidents, setPendingIncidents] = useState<Incident[]>([]);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [incidentMediaList, setIncidentMediaList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Authenticate call handler / triage operator
  useEffect(() => {
    async function checkAuth() {
      try {
        const data = await eawsApi.getMe();
        if (data.profile && ["dispatcher", "admin", "super_admin", "citizen"].includes(data.profile.user_role)) {
          setUserProfile(data.profile);
          setIsAuthenticated(true);
        } else {
          router.replace("/");
        }
      } catch (err) {
        router.replace("/");
      }
    }
    checkAuth();
  }, [router]);

  async function loadPendingCalls() {
    setIsLoading(true);
    try {
      const data = await eawsApi.getIncidentFeed();
      // Filter for unverified or pending triage calls
      const pending = (data || []).filter((i) => i.status === "pending" || !i.status);
      setPendingIncidents(pending);
      if (pending.length > 0 && !selectedIncident) {
        setSelectedIncident(pending[0]);
      }
    } catch (err) {
      console.error("Failed to load call triage feed:", err);
    } finally {
      setIsLoading(false);
    }

  }

  useEffect(() => {
    if (!isAuthenticated) return;
    loadPendingCalls();
    const interval = setInterval(loadPendingCalls, 5000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  useEffect(() => {
    if (!selectedIncident) return;
    async function fetchMedia() {
      const incId = selectedIncident?.id;
      if (!incId) return;
      try {
        const media = await eawsApi.getIncidentMedia(incId);
        setIncidentMediaList(media || []);
      } catch (err) {
        console.error("Failed to fetch incident media:", err);
        setIncidentMediaList([]);
      }
    }
    fetchMedia();
  }, [selectedIncident]);


  async function handleVerifyAndForward() {
    if (!selectedIncident) return;
    setIsProcessing(true);
    try {
      await eawsApi.updateIncident(selectedIncident.id, { status: "verified" });
      alert(`Incident #${selectedIncident.id.substring(0, 8)} verified and forwarded to Central CAD Dispatch!`);
      setSelectedIncident(null);
      await loadPendingCalls();
    } catch (err: any) {
      alert("Verification failed: " + (err.message || err));
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleDismissPrank() {
    if (!selectedIncident) return;
    setIsProcessing(true);
    try {
      await eawsApi.updateIncident(selectedIncident.id, { status: "resolved" });
      alert("Call flagged as invalid/dismissed.");
      setSelectedIncident(null);
      await loadPendingCalls();
    } catch (err: any) {
      alert("Dismiss failed: " + (err.message || err));
    } finally {
      setIsProcessing(false);
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center text-neutral-400 font-mono gap-2">
        <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <p className="text-xs uppercase tracking-widest animate-pulse">Connecting 112 Call Triage Console...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0A0A0A] text-[#e5e2e1] font-sans">
      <div className="scanline fixed inset-0 z-10 opacity-30 pointer-events-none"></div>

      {/* Main Workspace */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <header className="h-14 bg-surface border-b border-outline-variant px-6 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3 font-mono">
            <div className="w-8 h-8 rounded bg-error-container/20 border border-error/40 flex items-center justify-center text-error">
              <PhoneIncoming size={18} className="animate-pulse" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">112 CALL TRIAGE &amp; INTAKE CONSOLE</h2>
              <p className="text-[9px] text-tertiary">Ghana National Emergency Communications Center</p>
            </div>
          </div>

          <div className="flex items-center gap-4 font-mono text-xs">
            <div className="bg-surface-container px-3 py-1.5 rounded border border-outline-variant flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
              <span className="text-[10px] text-neutral-300 font-bold uppercase">
                OPERATOR: {userProfile ? (userProfile.operator_code || userProfile.full_name) : "TRIAGE-01"}
              </span>
            </div>
            <button
              onClick={loadPendingCalls}
              className="bg-surface-container hover:bg-surface-variant p-2 rounded text-neutral-300 transition-colors"
            >
              <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
            </button>
          </div>
        </header>

        {/* Triage Workspace Grid */}
        <div className="flex-1 grid grid-cols-12 overflow-hidden p-6 gap-6">
          
          {/* Left Column: Pending 112 Calls Queue */}
          <div className="col-span-12 lg:col-span-5 tactical-card rounded-xl flex flex-col overflow-hidden border border-outline-variant">
            <div className="p-4 bg-surface-container-low border-b border-outline-variant flex justify-between items-center shrink-0">
              <h3 className="font-mono text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <PhoneCall size={14} className="text-error" />
                Incoming Emergency Queue ({pendingIncidents.length})
              </h3>
              <span className="text-[9px] font-mono font-bold bg-error/10 text-error border border-error/30 px-2 py-0.5 rounded">
                LIVE TRIAGE
              </span>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3 font-mono">
              {pendingIncidents.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 text-neutral-500 space-y-2">
                  <CheckCircle size={32} className="text-tertiary opacity-60" />
                  <p className="font-bold text-xs uppercase text-white">Call Queue Clear</p>
                  <p className="text-[10px]">No pending unverified 112 emergency calls in queue.</p>
                </div>
              ) : (
                pendingIncidents.map((inc) => {
                  const isSelected = selectedIncident?.id === inc.id;
                  const emergencyType = (inc as any).emergency_type || inc.category || "sos";
                  const isCritical = inc.severity === "CRITICAL" || emergencyType === "sos";

                  return (
                    <div
                      key={inc.id}
                      onClick={() => setSelectedIncident(inc)}
                      className={`p-4 rounded-lg border transition-all cursor-pointer space-y-2 ${
                        isSelected
                          ? "bg-primary/10 border-primary shadow-lg"
                          : "bg-[#131313] border-neutral-800 hover:border-neutral-700"
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-bold text-white text-xs">{inc.title}</p>
                          <p className="text-[9px] text-neutral-400 mt-0.5 flex items-center gap-1">
                            <MapPin size={10} className="text-tertiary" /> {inc.location_name || "Accra Metro"}
                          </p>
                        </div>
                        <span className={`text-[8px] font-bold px-2 py-0.5 rounded uppercase ${
                          isCritical ? "bg-error/20 text-error border border-error/40 animate-pulse" : "bg-yellow-500/10 text-yellow-400 border border-yellow-500/30"
                        }`}>
                          {emergencyType}
                        </span>
                      </div>


                      <p className="text-[11px] text-neutral-300 font-sans line-clamp-2 leading-relaxed">
                        {inc.description || "Caller pressed emergency SOS button."}
                      </p>

                      <div className="flex justify-between items-center pt-2 border-t border-neutral-850 text-[8px]">
                        <span className="text-neutral-500">{new Date(inc.created_at).toLocaleTimeString()}</span>
                        <span className="text-tertiary font-bold">CLICK TO INSPECT TRIAGE</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Selected Call Inspection & Verification Console */}
          <div className="col-span-12 lg:col-span-7 tactical-card rounded-xl flex flex-col overflow-hidden border border-outline-variant">
            <div className="p-4 bg-surface-container-low border-b border-outline-variant flex justify-between items-center shrink-0 font-mono">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <ShieldCheck size={16} className="text-tertiary" />
                Call Inspection &amp; Identity Verification Panel
              </h3>
              {selectedIncident && (
                <span className="text-[10px] text-primary font-bold">TICKET #{selectedIncident.id.substring(0, 8)}</span>
              )}
            </div>

            {selectedIncident ? (
              <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6 font-mono">
                {/* Ghana Card Identity Trust Banner */}
                <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center text-green-400">
                      <UserCheck size={20} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white uppercase">GHANA CARD VERIFIED CITIZEN</p>
                      <p className="text-[9px] text-neutral-300">Identity linked to National Identification Authority Database</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-green-400 bg-green-500/20 px-3 py-1 rounded border border-green-500/40">
                    TRUST SCORE: 0.98
                  </span>
                </div>

                {/* Incident Details Card */}
                <div className="p-4 bg-neutral-950 rounded-lg border border-neutral-850 space-y-3">
                  <div>
                    <span className="text-[9px] text-tertiary font-bold uppercase">REPORTED EMERGENCY:</span>
                    <h3 className="text-base font-bold text-white font-sans mt-0.5">{selectedIncident.title}</h3>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-[9px] text-neutral-500 uppercase font-bold">GEOGRAPHIC SECTOR:</span>
                      <p className="text-neutral-200 mt-0.5 flex items-center gap-1">
                        <MapPin size={12} className="text-primary" /> {selectedIncident.location_name || "Accra Sector"}
                      </p>
                    </div>
                    <div>
                      <span className="text-[9px] text-neutral-500 uppercase font-bold">COORDINATES:</span>
                      <p className="text-neutral-200 mt-0.5">
                        {selectedIncident.latitude?.toFixed(4)}° N, {selectedIncident.longitude?.toFixed(4)}° W
                      </p>
                    </div>
                  </div>

                  <div>
                    <span className="text-[9px] text-neutral-500 uppercase font-bold">CALLER STATEMENT:</span>
                    <p className="text-neutral-200 text-xs font-sans mt-1 leading-relaxed bg-neutral-900 p-3 rounded border border-neutral-850">
                      {selectedIncident.description || "No description provided."}
                    </p>
                  </div>
                </div>

                {/* Multilingual Voice Note Player */}
                <div className="p-4 bg-neutral-950 border border-neutral-850 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-tertiary uppercase flex items-center gap-1.5">
                      <Mic size={14} className="text-tertiary" />
                      CITIZEN VOICE NOTE (LOCAL DIALECT / AUDIO STREAM)
                    </span>
                    <span className="text-[9px] text-neutral-500">Duration: 0:42</span>
                  </div>

                  <audio controls className="w-full h-9 accent-tertiary" src="https://actions.google.com/sounds/v1/alarms/digital_watch_alarm.ogg">
                    Your browser does not support audio playback.
                  </audio>

                  <div className="flex justify-between items-center text-[9px] text-neutral-400 pt-1">
                    <span>Language Detected: <strong>Twi (Ghana)</strong></span>
                    <span className="text-green-400 font-bold">Auto-transcript: "Fire burning market stall at Bush Canteen"</span>
                  </div>
                </div>

                {/* Verification Action Buttons */}
                <div className="pt-4 border-t border-neutral-850 flex gap-4">
                  <button
                    onClick={handleDismissPrank}
                    disabled={isProcessing}
                    className="flex-1 py-3 bg-neutral-850 hover:bg-neutral-750 text-neutral-400 rounded-lg text-xs font-bold uppercase transition-all flex items-center justify-center gap-2 border border-neutral-750 disabled:opacity-50"
                  >
                    <X size={16} /> Dismiss / Prank Report
                  </button>

                  <button
                    onClick={handleVerifyAndForward}
                    disabled={isProcessing}
                    className="flex-2 py-3 bg-tertiary hover:brightness-110 text-on-tertiary rounded-lg text-xs font-bold uppercase transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
                  >
                    <CheckCircle size={16} />
                    <span>{isProcessing ? "Verifying & Forwarding..." : "VERIFY & FORWARD TO CENTRAL CAD DISPATCH"}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 text-neutral-500 space-y-2 font-mono">
                <PhoneCall size={40} className="text-neutral-600 mb-2" />
                <p className="font-bold text-xs uppercase text-white">No Call Selected for Triage</p>
                <p className="text-[10px]">Select an incoming call from the left queue to inspect voice notes and verify.</p>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
