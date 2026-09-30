"use client";

import { useEffect, useState, Suspense, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { eawsApi, isLocalTestApi } from "@/lib/api";
import SentinelShell from "@/components/SentinelShell";
import {
  Phone, MessageSquare, ChevronRight, Smartphone, Battery,
  ExternalLink, Clock, Wifi, AlertTriangle, CheckCircle, User, Activity, X, Send
} from "lucide-react";

// ─── Demo / fallback data dictionary for all citizens ──────────────────────────
const MOCK_PROFILES: Record<string, any> = {
  "c-001": {
    full_name: "D. Harrison",
    citizen_id: "GH-ACR-8829-44",
    phone: "+233 54 882 9912",
    blood_type: "O+",
    allergies: "Penicillin",
    chronic_conditions: "Asthma, Hypertension",
    current_medications: "Salbutamol, Amlodipine",
    device_model: "Samsung Galaxy S24",
    device_os: "Android 15",
    last_active: "2 min ago",
    gps_sharing: true,
    battery: 41,
    signal: "Strong",
    emergency_contacts: [
      { name: "Ama Harrison",  relation: "Spouse",   phone: "+233 20 111 2233" },
      { name: "Kwame Harrison", relation: "Brother",  phone: "+233 24 555 7788" },
      { name: "Nana Mensah",   relation: "Neighbor", phone: "+233 50 909 1010" },
    ],
    incident_history: [
      { id: "PT-8829-X", date: "2026-07-18", type: "Fire",     severity: "CRITICAL", outcome: "Dispatched · On scene · Stabilized" },
      { id: "PT-7714-A", date: "2026-05-02", type: "Medical",  severity: "HIGH",     outcome: "Transported · Hospital intake completed" },
      { id: "PT-6402-K", date: "2025-11-21", type: "Disaster", severity: "MEDIUM",   outcome: "Resolved · Shelter referral issued" },
    ],
    active_incident_id: "PT-8829-X",
    active_incident_note: "Fire response request · Liberation Road",
    initial_messages: [
      { sender: "citizen", text: "There is a massive fire outbreak here at Makola Market. Please send GNFS!", time: "10 min ago" },
      { sender: "operator", text: "Central Dispatch received. Engine units dispatched. Are you in a safe area?", time: "9 min ago" },
      { sender: "citizen", text: "Yes, I moved to the outer bank near the main road. The smoke is very thick.", time: "8 min ago" }
    ]
  },
  "c-002": {
    full_name: "Ama Serwaa Boateng",
    citizen_id: "GH-ACR-7723-09",
    phone: "+233 20 111 2233",
    blood_type: "A+",
    allergies: "Sulfonamides",
    chronic_conditions: "Diabetes Type 2",
    current_medications: "Metformin",
    device_model: "iPhone 15 Pro",
    device_os: "iOS 18.1",
    last_active: "5 min ago",
    gps_sharing: true,
    battery: 89,
    signal: "Excellent",
    emergency_contacts: [
      { name: "Kofi Boateng",  relation: "Father",   phone: "+233 20 111 2244" },
      { name: "Yaa Boateng",   relation: "Mother",   phone: "+233 20 111 2255" },
    ],
    incident_history: [
      { id: "PT-7723-Y", date: "2026-06-15", type: "Medical",  severity: "MEDIUM",   outcome: "Treated on scene" },
    ],
    active_incident_id: null,
    active_incident_note: null,
    initial_messages: [
      { sender: "citizen", text: "My blood sugar levels are spiking. I feel extremely dizzy.", time: "15 min ago" },
      { sender: "operator", text: "Ambulance unit dispatched. Please sit down and try to remain calm.", time: "14 min ago" }
    ]
  },
  "c-003": {
    full_name: "Kwame Asante",
    citizen_id: "GH-ACR-5501-21",
    phone: "+233 24 555 7788",
    blood_type: "B-",
    allergies: "None",
    chronic_conditions: "None",
    current_medications: "None",
    device_model: "Google Pixel 8",
    device_os: "Android 14",
    last_active: "12 min ago",
    gps_sharing: true,
    battery: 65,
    signal: "Good",
    emergency_contacts: [
      { name: "Ekow Asante",   relation: "Uncle",    phone: "+233 24 555 7799" },
    ],
    incident_history: [],
    active_incident_id: null,
    active_incident_note: null,
    initial_messages: [
      { sender: "operator", text: "Kwame, we noticed your GPS beacon turned on. Are you experiencing an emergency?", time: "20 min ago" },
      { sender: "citizen", text: "False alarm, sorry. The app opened in my pocket.", time: "19 min ago" }
    ]
  },
  "c-004": {
    full_name: "Nana Mensah",
    citizen_id: "GH-ACR-3312-17",
    phone: "+233 50 909 1010",
    blood_type: "O-",
    allergies: "Aspirin",
    chronic_conditions: "Epilepsy",
    current_medications: "Sodium Valproate",
    device_model: "Xiaomi Redmi Note 13",
    device_os: "Android 13",
    last_active: "1 hour ago",
    gps_sharing: false,
    battery: 12,
    signal: "Weak",
    emergency_contacts: [
      { name: "Adwoa Mensah",  relation: "Sister",   phone: "+233 50 909 1011" },
    ],
    incident_history: [
      { id: "PT-3312-Z", date: "2026-02-10", type: "Accident", severity: "HIGH",     outcome: "EMS dispatch · Transported to Korle-Bu" }
    ],
    active_incident_id: null,
    active_incident_note: null,
    initial_messages: []
  },
  "c-005": {
    full_name: "Abena Osei-Bonsu",
    citizen_id: "GH-ACR-1189-44",
    phone: "+233 27 456 8801",
    blood_type: "AB+",
    allergies: "Peanuts",
    chronic_conditions: "Asthma",
    current_medications: "Albuterol Inhaler",
    device_model: "iPhone 14",
    device_os: "iOS 17.5",
    last_active: "Just now",
    gps_sharing: true,
    battery: 98,
    signal: "Excellent",
    emergency_contacts: [
      { name: "Yaw Osei-Bonsu", relation: "Husband",  phone: "+233 27 456 8802" }
    ],
    incident_history: [],
    active_incident_id: null,
    active_incident_note: null,
    initial_messages: [
      { sender: "citizen", text: "Accident reported on Spintex Road near the junction. Traffic is building.", time: "5 min ago" }
    ]
  }
};

const SEV: Record<string, { dot: string; badge: string; label: string }> = {
  CRITICAL: { dot: "bg-red-500",    badge: "text-red-400 bg-red-500/15 border-red-500/30",    label: "Critical" },
  HIGH:     { dot: "bg-orange-400", badge: "text-orange-400 bg-orange-500/15 border-orange-500/30", label: "High" },
  MEDIUM:   { dot: "bg-yellow-400", badge: "text-yellow-400 bg-yellow-500/15 border-yellow-500/30", label: "Medium" },
};

function Field({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={`bg-[#1a1a1a] border border-white/5 rounded-lg p-3.5 ${wide ? "col-span-2" : ""}`}>
      <p className="text-[9px] font-bold tracking-[0.15em] text-neutral-500 uppercase mb-1.5">{label}</p>
      <p className="text-sm font-semibold text-white leading-snug">{value || "None"}</p>
    </div>
  );
}

function CitizenProfileContent() {
  const searchParams = useSearchParams();
  const citizenId = searchParams.get("id");
  const [profile, setProfile] = useState(MOCK_PROFILES["c-001"]);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const [activeCitizenId, setActiveCitizenId] = useState<string | null>(null);

  useEffect(() => {
    if (!citizenId) return;

    // Check offline dictionary match
    const norm = citizenId.toLowerCase();
    const mockKey = Object.keys(MOCK_PROFILES).find(key =>
      key.toLowerCase() === norm ||
      MOCK_PROFILES[key].citizen_id.toLowerCase() === norm ||
      MOCK_PROFILES[key].full_name.toLowerCase().includes(norm)
    );

    if (mockKey) {
      const matched = MOCK_PROFILES[mockKey];
      setProfile(matched);
      setMessages(matched.initial_messages || []);
      setActiveCitizenId(mockKey);
    }

    // Try fetching live profile from Supabase
    async function load() {
      try {
        const { data } = await supabase.from("profiles").select("*").eq("user_id", citizenId).single();
        if (data) {
          setActiveCitizenId(citizenId);
          setProfile((prev: any) => ({
            ...prev,
            ...data,
            blood_type: data.blood_group || data.blood_type || prev.blood_type,
            chronic_conditions: data.chronic_illnesses || data.chronic_conditions || prev.chronic_conditions,
            current_medications: data.medical_notes || data.current_medications || prev.current_medications,
          }));
        }
      } catch (_) {}
    }
    load();
  }, [citizenId]);

  // Load and poll messages when chat is open
  useEffect(() => {
    if (!isChatOpen || !activeCitizenId) return;
    const fetchMsgs = () => {
      eawsApi.getMessages(activeCitizenId).then(msgs => {
        if (msgs.length > 0) setMessages(msgs);
      }).catch(() => {});
    };
    fetchMsgs();
    const interval = setInterval(fetchMsgs, 5000);
    return () => clearInterval(interval);
  }, [isChatOpen, activeCitizenId]);

  // Auto-scroll chat to bottom on new messages
  useEffect(() => {
    if (isChatOpen && chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isChatOpen]);

  const p = profile;

  return (
    <SentinelShell title="Citizen Profile" subtitle="Full identity, medical, and history record for control room reference">
      <div className="h-full overflow-y-auto relative" style={{ background: "#0a0a0a" }}>
        <div className="p-6">
          {/* ── top bar ── */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-white font-bold text-lg tracking-tight">Citizen Record</h2>
              <p className="text-neutral-500 text-xs mt-0.5">Profile accessible from Incidents, Dispatch Detail &amp; Community</p>
            </div>
            <div className="flex gap-2">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-green-400 bg-green-500/10 border border-green-500/25 px-3 py-1.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                Verified
              </span>
              {p.active_incident_id && (
                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-red-400 bg-red-500/10 border border-red-500/25 px-3 py-1.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                  Active Incident
                </span>
              )}
            </div>
          </div>

          {/* ── 3-column grid ── */}
          <div className="grid grid-cols-3 gap-5">

            {/* ════════════ COL 1 — IDENTITY ════════════ */}
            <div className="bg-[#111111] border border-white/[0.06] rounded-2xl p-5 flex flex-col gap-5">
              <div>
                <p className="text-base font-bold text-white tracking-tight">Identity</p>
                <p className="text-[11px] text-neutral-500 mt-0.5">Primary citizen record and contact access</p>
              </div>

              {/* avatar + name */}
              <div className="bg-[#181818] border border-white/[0.06] rounded-xl p-4 flex items-center gap-4">
                <div className="relative flex-shrink-0">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-neutral-700 to-neutral-900 border-2 border-neutral-700 flex items-center justify-center overflow-hidden font-black text-lg text-white">
                    {p.full_name.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase()}
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-green-500 border-2 border-[#181818]" />
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] font-bold tracking-[0.14em] text-neutral-500 uppercase mb-1">Full Name</p>
                  <p className="text-lg font-black text-white leading-none">{p.full_name}</p>
                </div>
              </div>

              {/* citizen ID + phone */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-[#181818] border border-white/[0.06] rounded-lg p-3">
                  <p className="text-[9px] font-bold tracking-[0.14em] text-neutral-500 uppercase mb-1.5">Citizen ID</p>
                  <p className="text-[11px] font-mono font-bold text-white leading-snug">{p.citizen_id}</p>
                </div>
                <div className="bg-[#181818] border border-white/[0.06] rounded-lg p-3">
                  <p className="text-[9px] font-bold tracking-[0.14em] text-neutral-500 uppercase mb-1.5">Phone</p>
                  <p className="text-[11px] font-mono font-bold text-white leading-snug">{p.phone}</p>
                </div>
              </div>

              {/* emergency contacts */}
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <p className="text-[11px] font-bold text-neutral-300 tracking-tight">Linked Emergency Contacts</p>
                  <span className="text-[10px] text-neutral-500 font-medium">{p.emergency_contacts?.length || 0} contacts</span>
                </div>
                <div className="space-y-2">
                  {p.emergency_contacts?.map((c: any) => (
                    <div key={c.name} className="flex items-center justify-between bg-[#181818] border border-white/[0.04] rounded-lg px-3.5 py-3">
                      <div>
                        <p className="text-[12px] font-semibold text-white">{c.name}</p>
                        <p className="text-[10px] text-neutral-500 mt-0.5">{c.relation}</p>
                      </div>
                      {isLocalTestApi ? (
                        <span className="text-[10px] text-amber-300">Calls disabled in TEST</span>
                      ) : (
                        <a href={`tel:${c.phone}`} className="text-[11px] font-mono text-neutral-400 hover:text-white transition-colors">{c.phone}</a>
                      )}
                    </div>
                  )) || <div className="text-[11px] text-neutral-600 italic py-2">No contacts registered</div>}
                </div>
              </div>

              {/* action buttons */}
              <div className="flex gap-2 mt-auto">
                <button onClick={() => setIsChatOpen(true)} disabled={isLocalTestApi} title={isLocalTestApi ? "Citizen messaging is unavailable in TEST mode" : undefined} className="flex-1 py-2.5 rounded-lg bg-red-600 hover:bg-red-500 active:bg-red-700 text-white text-[11px] font-bold transition-all duration-150 flex items-center justify-center gap-2 shadow-lg shadow-red-900/30 disabled:cursor-not-allowed disabled:opacity-50">
                  <MessageSquare size={13} /> {isLocalTestApi ? "Messaging unavailable" : "Message via App"}
                </button>
                {isLocalTestApi ? (
                  <button disabled title="Calls are disabled in TEST mode" className="flex-1 py-2.5 rounded-lg bg-[#1e1e1e] border border-white/[0.08] text-amber-300 text-[10px] font-bold disabled:cursor-not-allowed">
                    <Phone size={13} /> Calls disabled in TEST
                  </button>
                ) : (
                  <a href={`tel:${p.phone}`} className="flex-1 py-2.5 rounded-lg bg-[#1e1e1e] hover:bg-[#252525] border border-white/[0.08] text-neutral-300 text-[11px] font-bold transition-all duration-150 flex items-center justify-center gap-2">
                    <Phone size={13} /> Call Contact
                  </a>
                )}
              </div>
            </div>

            {/* ════════════ COL 2 — MEDICAL + HISTORY ════════════ */}
            <div className="flex flex-col gap-5">
              {/* Medical Profile */}
              <div className="bg-[#111111] border border-white/[0.06] rounded-2xl p-5">
                <p className="text-base font-bold text-white tracking-tight mb-0.5">Medical Profile</p>
                <p className="text-[11px] text-amber-300">
                  Masked. Authorized reveal and access auditing are not connected, so medical details are unavailable.
                </p>
              </div>

              {/* Incident History */}
              <div className="bg-[#111111] border border-white/[0.06] rounded-2xl p-5 flex-1">
                <p className="text-base font-bold text-white tracking-tight mb-0.5">Incident History</p>
                <p className="text-[11px] text-neutral-500 mb-4">Past incidents linked to this citizen record</p>

                <div className="space-y-2.5">
                  {p.incident_history?.map((inc: any) => {
                    const s = SEV[inc.severity] ?? SEV.MEDIUM;
                    return (
                      <div key={inc.id} className="bg-[#181818] border border-white/[0.05] rounded-xl p-4 hover:border-white/10 transition-colors">
                        <div className="flex items-start justify-between mb-1.5">
                          <div>
                            <p className="text-[13px] font-black text-white font-mono tracking-tight">{inc.id}</p>
                            <p className="text-[10px] text-neutral-500 mt-0.5">{inc.date} · {inc.type}</p>
                          </div>
                          <span className={`text-[10px] font-bold border rounded-md px-2.5 py-1 flex-shrink-0 ${s.badge}`}>
                            {s.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-2">
                          <CheckCircle size={11} className="text-neutral-600 flex-shrink-0" />
                          <p className="text-[11px] text-neutral-400">Outcome: {inc.outcome}</p>
                        </div>
                      </div>
                    );
                  }) || <div className="text-[11px] text-neutral-600 italic py-2">No past incident record</div>}
                </div>

                <div className="flex gap-2.5 mt-4">
                  <button className="flex-1 py-2.5 rounded-lg bg-[#1e1e1e] hover:bg-[#252525] border border-white/[0.08] text-neutral-300 text-[11px] font-bold transition-all duration-150 flex items-center justify-center gap-2">
                    <ExternalLink size={11} /> Open Incident
                  </button>
                  <button className="flex-1 py-2.5 rounded-lg bg-[#1e1e1e] hover:bg-[#252525] border border-white/[0.08] text-neutral-300 text-[11px] font-bold transition-all duration-150 flex items-center justify-center gap-2">
                    <Activity size={11} /> View Timeline
                  </button>
                </div>
              </div>
            </div>

            {/* ════════════ COL 3 — DEVICES + RELATED INCIDENT ════════════ */}
            <div className="flex flex-col gap-5">
              {/* Linked Devices */}
              <div className="bg-[#111111] border border-white/[0.06] rounded-2xl p-5">
                <p className="text-base font-bold text-white tracking-tight mb-0.5">Linked Devices</p>
                <p className="text-[11px] text-neutral-500 mb-4">App and location sharing status</p>

                {/* device card */}
                <div className="bg-[#181818] border border-white/[0.06] rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-[#222] border border-white/[0.06] flex items-center justify-center">
                        <Smartphone size={15} className="text-neutral-400" />
                      </div>
                      <div>
                        <p className="text-[9px] font-bold tracking-[0.14em] text-neutral-500 uppercase mb-0.5">Device Model</p>
                        <p className="text-[13px] font-bold text-white">{p.device_model || "N/A"}</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-green-400 bg-green-500/10 border border-green-500/25 px-2.5 py-1 rounded-md">Online</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-[#111111] rounded-lg p-3">
                      <p className="text-[9px] font-bold tracking-[0.12em] text-neutral-600 uppercase mb-1.5">OS</p>
                      <p className="text-[12px] font-semibold text-neutral-200">{p.device_os || "N/A"}</p>
                    </div>
                    <div className="bg-[#111111] rounded-lg p-3">
                      <p className="text-[9px] font-bold tracking-[0.12em] text-neutral-600 uppercase mb-1.5">Last Active</p>
                      <p className="text-[12px] font-semibold text-neutral-200 flex items-center gap-1.5">
                        <Clock size={10} className="text-neutral-500" />{p.last_active || "N/A"}
                      </p>
                    </div>
                    <div className="bg-[#111111] rounded-lg p-3">
                      <p className="text-[9px] font-bold tracking-[0.12em] text-neutral-600 uppercase mb-1.5">GPS Sharing</p>
                      <p className={`text-[12px] font-semibold flex items-center gap-1.5 ${p.gps_sharing ? "text-green-400" : "text-red-400"}`}>
                        <Wifi size={10} />
                        {p.gps_sharing ? "Enabled" : "Disabled"}
                      </p>
                    </div>
                    <div className="bg-[#111111] rounded-lg p-3">
                      <p className="text-[9px] font-bold tracking-[0.12em] text-neutral-600 uppercase mb-1.5">Battery / Signal</p>
                      <p className={`text-[12px] font-semibold flex items-center gap-1.5 ${p.battery < 20 ? "text-red-400" : "text-neutral-200"}`}>
                        <Battery size={10} className={p.battery < 20 ? "text-red-400" : "text-green-400"} />
                        {p.battery || 0}% · {p.signal || "N/A"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Related Incident */}
              <div className="bg-[#111111] border border-white/[0.06] rounded-2xl p-5 flex-1">
                <p className="text-base font-bold text-white tracking-tight mb-0.5">Related Incident</p>
                <p className="text-[11px] text-neutral-500 mb-4">Current active link back to dispatch</p>

                {/* active link block */}
                {p.active_incident_id ? (
                  <div className="bg-[#181818] border border-white/[0.06] rounded-xl p-4 mb-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[9px] font-bold tracking-[0.14em] text-neutral-500 uppercase">Active Link</p>
                      <span className="text-[10px] font-bold text-red-400 bg-red-500/10 border border-red-500/25 px-2.5 py-1 rounded-md flex items-center gap-1.5">
                        <AlertTriangle size={9} /> Critical
                      </span>
                    </div>
                    <p className="text-xl font-black text-white font-mono tracking-tight leading-none mb-1.5">{p.active_incident_id}</p>
                    <p className="text-[11px] text-neutral-500">{p.active_incident_note}</p>
                  </div>
                ) : (
                  <div className="bg-[#181818] border border-white/[0.04] rounded-xl p-4 mb-3 text-center">
                    <p className="text-[11px] text-neutral-500 italic">No current active incident link</p>
                  </div>
                )}

                {/* control room note */}
                <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4 mb-4">
                  <p className="text-[9px] font-bold tracking-[0.14em] text-neutral-500 uppercase mb-2">Control Room Note</p>
                  <p className="text-[11px] text-neutral-400 leading-relaxed">
                    This profile is reachable from Incidents, Dispatch Detail, and Community reporter handles.
                  </p>
                </div>

                {/* CTA button */}
                <a href="/dashboard" className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-500 active:bg-red-700 text-white text-[12px] font-bold transition-all duration-150 flex items-center justify-center gap-2 shadow-lg shadow-red-900/30 mt-auto">
                  <ChevronRight size={14} /> View in Dispatch Queue
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* ── Chat Overlay ── */}
        {isChatOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/60 backdrop-blur-sm">
            <div className="w-[400px] h-full bg-[#111] border-l border-white/[0.08] flex flex-col shadow-2xl">
              {/* Header */}
              <div className="p-4 border-b border-white/[0.08] flex items-center justify-between bg-[#151515]">
                <div>
                  <p className="text-white font-bold text-sm">Operator Chat Hub</p>
                  <p className="text-[10px] text-neutral-500">Live communication with {p.full_name}</p>
                </div>
                <button onClick={() => setIsChatOpen(false)} className="p-1.5 rounded-lg bg-neutral-900 border border-white/[0.06] text-neutral-400 hover:text-white transition-colors">
                  <X size={15} />
                </button>
              </div>
              {/* Chat Body */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 flex flex-col-reverse">
                {/* Messages list (rendered in reverse for scrolling behavior) */}
                {messages.length === 0 ? (
                  <div className="text-center text-neutral-600 text-[11px] py-12">No communication history. Send a message to start.</div>
                ) : (
                  [...messages].reverse().map((msg, i) => (
                    <div key={i} className={`flex flex-col max-w-[80%] ${msg.sender === "operator" ? "ml-auto items-end" : "mr-auto items-start"}`}>
                      <div className={`p-3 rounded-2xl text-[12px] leading-relaxed ${msg.sender === "operator" ? "bg-red-600 text-white rounded-br-none" : "bg-neutral-800 text-neutral-200 rounded-bl-none"}`}>
                        {msg.text}
                      </div>
                      <span className="text-[9px] text-neutral-600 mt-1">{msg.time}</span>
                    </div>
                  ))
                )}
              </div>
              {/* Input area */}
              <form onSubmit={async (e) => {
                e.preventDefault();
                if (!newMessage.trim() || !activeCitizenId || isSending) return;
                setIsSending(true);
                const text = newMessage;
                setNewMessage("");
                try {
                  const added = await eawsApi.sendMessage(activeCitizenId, text);
                  setMessages(prev => [...prev, added]);
                } catch {
                  // Optimistic fallback
                  setMessages(prev => [...prev, { sender: "operator", text, time: "Just now" }]);
                } finally {
                  setIsSending(false);
                }
              }} className="p-4 border-t border-white/[0.08] bg-[#151515] flex gap-2">
                <input value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Type a message to citizen..." className="flex-1 bg-[#222] border border-white/[0.06] rounded-xl px-4 py-2.5 text-[12px] text-white placeholder-neutral-500 focus:outline-none focus:border-red-500/50" />
                <button type="submit" disabled={isSending} className="p-2.5 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white transition-colors"><Send size={15} /></button>
              </form>
            </div>
          </div>
        )}
        <div ref={chatBottomRef} />
      </div>
    </SentinelShell>
  );
}

export default function CitizenProfilePage() {
  return (
    <Suspense
      fallback={
        <SentinelShell title="Citizen Profile" subtitle="Loading profile...">
          <div className="flex items-center justify-center h-full text-neutral-500 text-sm">
            Loading profile...
          </div>
        </SentinelShell>
      }
    >
      <CitizenProfileContent />
    </Suspense>
  );
}
