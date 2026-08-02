"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect, Suspense } from "react";
import { supabase } from "@/lib/supabase";
import SentinelShell from "@/components/SentinelShell";
import { BarChart3, Settings, Shield, Bell, Map, Wifi, Key, Webhook, Users, FileText, Save } from "lucide-react";

function AdminContent() {
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") || "analytics";

  const [gpsRefresh, setGpsRefresh] = useState("3 sec");
  const [pushEnabled, setPushEnabled] = useState(true);
  const [smsEnabled, setSmsEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [fireEnabled, setFireEnabled] = useState(true);
  const [policeEnabled, setPoliceEnabled] = useState(true);
  const [disasterEnabled, setDisasterEnabled] = useState(true);
  const [mapLayers, setMapLayers] = useState({ traffic: true, shelters: true, hazards: true });
  const [backendHealth, setBackendHealth] = useState<"Healthy" | "Unreachable" | "Checking">("Checking");
  const [isSaving, setIsSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [resolvedCount] = useState(1284);
  const [avgResponse] = useState("4.2m");
  const [activeCitizens] = useState(128);
  const [sosCount] = useState(42);

  useEffect(() => {
    async function checkBackend() {
      try {
        const res = await fetch("http://127.0.0.1:5001/api/me", { method: "HEAD" }).catch(() => null);
        setBackendHealth(res ? "Healthy" : "Unreachable");
      } catch { setBackendHealth("Unreachable"); }
    }
    checkBackend();
    const iv = setInterval(checkBackend, 30000);
    return () => clearInterval(iv);
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    await new Promise(r => setTimeout(r, 600));
    setIsSaving(false);
    setSavedOk(true);
    setTimeout(() => setSavedOk(false), 2500);
  }

  const BAR_HEIGHTS = [30, 45, 38, 55, 62, 70, 58, 75, 80, 90, 85, 100];

  if (tab === "settings") {
    return (
      <div className="h-full overflow-y-auto p-5 space-y-5 bg-[#090909]">
        {savedOk && <div className="text-[10px] text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg px-4 py-2.5">Settings saved successfully.</div>}

        <div className="grid grid-cols-3 gap-5">
          {/* Operator Profile */}
          <div className="bg-[#0e0e0e] border border-neutral-900 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-bold text-white">Operator Profile</p>
              <span className="text-[8px] font-bold bg-purple-600 text-white px-2 py-0.5 rounded">Admin</span>
            </div>
            <p className="text-[9px] text-neutral-500 mb-3">Identity and regional assignment</p>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="bg-neutral-900 rounded p-2">
                <p className="text-[7px] text-neutral-600 uppercase mb-1">Name</p>
                <p className="text-[10px] font-semibold text-white">Ama Mensah</p>
              </div>
              <div className="bg-neutral-900 rounded p-2">
                <p className="text-[7px] text-neutral-600 uppercase mb-1">Role</p>
                <p className="text-[10px] font-semibold text-white">Command Operator</p>
              </div>
            </div>
            <div className="bg-neutral-900 rounded p-2">
              <p className="text-[7px] text-neutral-600 uppercase mb-1">Region</p>
              <p className="text-[10px] font-semibold text-white">Greater Accra – Region-01</p>
            </div>
          </div>

          {/* Notifications */}
          <div className="bg-[#0e0e0e] border border-neutral-900 rounded-xl p-4">
            <p className="text-[10px] font-bold text-white mb-1">Notifications & Alerts</p>
            <p className="text-[9px] text-neutral-500 mb-3">Operator delivery preferences</p>
            {[
              { label: "Push notifications", sub: "Immediate app alerts", val: pushEnabled, set: setPushEnabled },
              { label: "SMS fallback", sub: "Backup when offline", val: smsEnabled, set: setSmsEnabled },
              { label: "Sound alerts", sub: "Critical tone enabled", val: soundEnabled, set: setSoundEnabled },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between py-2.5 border-b border-neutral-900 last:border-0">
                <div>
                  <p className="text-[10px] font-semibold text-white">{item.label}</p>
                  <p className="text-[8px] text-neutral-500">{item.sub}</p>
                </div>
                <button onClick={() => item.set(!item.val)} className={`w-9 h-5 rounded-full relative transition-colors ${item.val ? "bg-red-600" : "bg-neutral-700"}`}>
                  <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${item.val ? "translate-x-4" : "translate-x-0.5"}`} />
                </button>
              </div>
            ))}
          </div>

          {/* Broadcast Defaults */}
          <div className="bg-[#0e0e0e] border border-neutral-900 rounded-xl p-4">
            <p className="text-[10px] font-bold text-white mb-1">Broadcast Defaults</p>
            <p className="text-[9px] text-neutral-500 mb-3">Standard delivery and targeting</p>
            <div className="space-y-2.5 mb-4">
              <div className="bg-neutral-900 rounded p-2.5">
                <p className="text-[7px] text-neutral-600 uppercase mb-1">Default Delivery</p>
                <p className="text-[10px] font-semibold text-white">Push + SMS fallback</p>
              </div>
              <div className="bg-neutral-900 rounded p-2.5">
                <p className="text-[7px] text-neutral-600 uppercase mb-1">Default Target Zone</p>
                <p className="text-[10px] font-semibold text-white">All citizens in zone A</p>
              </div>
            </div>
            <button onClick={handleSave} className="w-full py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-[10px] font-bold transition-colors flex items-center justify-center gap-1.5">
              <Save size={10} /> Save Changes
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-5">
          {/* Agency Control */}
          <div className="bg-[#0e0e0e] border border-neutral-900 rounded-xl p-4">
            <p className="text-[10px] font-bold text-white mb-1">Agency Control</p>
            <p className="text-[9px] text-neutral-500 mb-3">Role-based routing and response tools</p>
            {[
              { label: "Fire Service", sub: "GNFS dispatch channel", val: fireEnabled, set: setFireEnabled, color: "bg-orange-500" },
              { label: "Police", sub: "Threat and patrol routing", val: policeEnabled, set: setPoliceEnabled, color: "bg-blue-500" },
              { label: "National Disaster", sub: "Flood, quake, and weather alerts", val: disasterEnabled, set: setDisasterEnabled, color: "bg-purple-500" },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between py-2.5 border-b border-neutral-900 last:border-0">
                <div>
                  <p className="text-[10px] font-semibold text-white">{item.label}</p>
                  <p className="text-[8px] text-neutral-500">{item.sub}</p>
                </div>
                <button onClick={() => item.set(!item.val)} className={`w-9 h-5 rounded-full relative transition-colors ${item.val ? item.color : "bg-neutral-700"}`}>
                  <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${item.val ? "translate-x-4" : "translate-x-0.5"}`} />
                </button>
              </div>
            ))}
          </div>

          {/* Map & Telemetry */}
          <div className="bg-[#0e0e0e] border border-neutral-900 rounded-xl p-4">
            <p className="text-[10px] font-bold text-white mb-1">Map & Telemetry Preferences</p>
            <p className="text-[9px] text-neutral-500 mb-3">Units, refresh cadence, and layers</p>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="bg-neutral-900 rounded p-2">
                <p className="text-[7px] text-neutral-600 uppercase mb-1">Units</p>
                <p className="text-[10px] font-semibold text-white">Metric</p>
              </div>
              <div className="bg-neutral-900 rounded p-2">
                <p className="text-[7px] text-neutral-600 uppercase mb-1">GPS Refresh</p>
                <select value={gpsRefresh} onChange={(e) => setGpsRefresh(e.target.value)} className="text-[10px] font-semibold text-white bg-transparent focus:outline-none w-full">
                  <option>3 sec</option><option>5 sec</option><option>10 sec</option>
                </select>
              </div>
            </div>
            <p className="text-[7px] text-neutral-600 uppercase mb-2">Layers</p>
            <div className="flex gap-2">
              {(["traffic", "shelters", "hazards"] as const).map(l => (
                <button key={l} onClick={() => setMapLayers(p => ({ ...p, [l]: !p[l] }))} className={`text-[9px] font-bold px-2.5 py-1 rounded capitalize transition-colors ${mapLayers[l] ? "bg-red-600 text-white" : "bg-neutral-800 text-neutral-400"}`}>{l}</button>
              ))}
            </div>
          </div>

          {/* Integrations */}
          <div className="bg-[#0e0e0e] border border-neutral-900 rounded-xl p-4">
            <p className="text-[10px] font-bold text-white mb-1">Integrations</p>
            <p className="text-[9px] text-neutral-500 mb-3">Mobile app link status and API keys</p>
            <div className="space-y-3">
              <div className="bg-neutral-900 rounded p-2.5">
                <div className="flex justify-between items-center">
                  <p className="text-[9px] font-semibold text-white">Mobile app link</p>
                  <span className="text-[8px] font-bold text-green-400 bg-green-500/10 border border-green-500/20 px-1.5 py-0.5 rounded">Online</span>
                </div>
                <p className="text-[8px] text-neutral-500 mt-0.5">Connected and syncing</p>
              </div>
              <div className="bg-neutral-900 rounded p-2.5">
                <p className="text-[8px] text-neutral-600 uppercase mb-1">API Keys</p>
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-mono text-neutral-300">•••• •••• •••• 4821</p>
                  <button className="text-[8px] text-neutral-500 hover:text-white">Rotate</button>
                </div>
              </div>
              <div className="bg-neutral-900 rounded p-2.5">
                <p className="text-[8px] text-neutral-600 uppercase mb-1">Webhook Status</p>
                <p className={`text-[10px] font-semibold ${backendHealth === "Healthy" ? "text-green-400" : backendHealth === "Checking" ? "text-yellow-400" : "text-red-400"}`}>
                  {backendHealth === "Healthy" ? "Healthy · 12 endpoints" : backendHealth === "Checking" ? "Checking..." : "Unreachable"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* System Health */}
        <div className="bg-[#0e0e0e] border border-neutral-900 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-bold text-white">System Health</p>
            <span className="text-[8px] font-bold text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded">Stable</span>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {[{ label: "App connectivity", value: "98%", pct: 98 }, { label: "Location accuracy", value: "±3m", pct: 95 }, { label: "SMS fallback", value: "Active", pct: 100 }].map((h) => (
              <div key={h.label}>
                <div className="flex justify-between text-[9px] mb-1"><span className="text-neutral-400">{h.label}</span><span className="text-neutral-300 font-mono font-bold">{h.value}</span></div>
                <div className="h-1 rounded-full bg-neutral-800"><div className="h-1 rounded-full bg-red-500" style={{ width: `${h.pct}%` }} /></div>
              </div>
            ))}
          </div>
        </div>

        {/* Citizen Records & Moderation */}
        <div className="bg-[#0e0e0e] border border-neutral-900 rounded-xl p-4">
          <p className="text-[10px] font-bold text-white mb-1">Citizen Records & Moderation</p>
          <p className="text-[9px] text-neutral-500 mb-4">Access controls and audit visibility for citizen profiles</p>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-neutral-900 rounded p-2.5"><p className="text-[7px] text-neutral-600 uppercase mb-1">Retention Period</p><p className="text-sm font-black text-white">7 years</p></div>
            <div className="bg-neutral-900 rounded p-2.5"><p className="text-[7px] text-neutral-600 uppercase mb-1">Profile Access</p><p className="text-sm font-black text-white">Restricted</p></div>
          </div>
          {[
            { label: "Allow operators to view medical history", sub: "Visible in dispatch and incident detail views", val: true },
            { label: "Require verification before profile access", sub: "Adds approval step for sensitive records", val: true },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between py-2.5 border-b border-neutral-900 last:border-0">
              <div><p className="text-[10px] font-semibold text-white">{item.label}</p><p className="text-[8px] text-neutral-500">{item.sub}</p></div>
              <div className="w-9 h-5 rounded-full relative bg-red-600 shrink-0">
                <span className="absolute top-0.5 right-0.5 w-4 h-4 bg-white rounded-full shadow" />
              </div>
            </div>
          ))}
          <div className="mt-4">
            <p className="text-[8px] font-bold tracking-widest text-neutral-600 uppercase mb-2">Audit Log</p>
            <p className="text-[8px] text-neutral-500 mb-2">Recent citizen record access events</p>
            {["Ama Mensah – CID-20491 – 09:42", "Kwame Boateng – CID-11802 – 09:17", "Esi Adjei – CID-77604 – 07:58"].map(e => (
              <p key={e} className="text-[9px] text-neutral-400 font-mono py-1 border-b border-neutral-900 last:border-0">{e}</p>
            ))}
          </div>
          <button onClick={handleSave} disabled={isSaving} className="mt-4 w-full py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-[10px] font-bold transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50">
            <Save size={10} />{isSaving ? "Saving..." : savedOk ? "Saved!" : "Save Changes"}
          </button>
        </div>
      </div>
    );
  }

  // Analytics tab
  return (
    <div className="h-full overflow-y-auto p-5 space-y-5 bg-[#090909]">
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total Incidents Resolved", value: resolvedCount.toLocaleString(), change: "+18% vs previous period", pos: true },
          { label: "Avg Response Time", value: avgResponse, change: "-0.8m improvement", pos: true },
          { label: "Active Citizens", value: activeCitizens, change: "Live sharing enabled", pos: true },
          { label: "SOS Signals Received", value: sosCount, change: "12 critical, 30 triaged", pos: false },
        ].map((s) => (
          <div key={s.label} className="bg-[#0e0e0e] border border-neutral-900 rounded-xl px-5 py-4">
            <p className="text-[10px] text-neutral-500 mb-1">{s.label}</p>
            <p className="text-3xl font-black text-white font-mono">{s.value}</p>
            <p className={`text-[9px] mt-1 ${s.pos ? "text-green-400" : "text-neutral-500"}`}>{s.change}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-5">
        {/* Incidents Over Time */}
        <div className="col-span-2 bg-[#0e0e0e] border border-neutral-900 rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[11px] font-bold text-white">Incidents Over Time</p>
              <p className="text-[9px] text-neutral-500">Trend line from app and dispatch network</p>
            </div>
            <span className="text-[8px] font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded animate-pulse">Live Feed</span>
          </div>
          <div className="flex items-end gap-2 h-32">
            {BAR_HEIGHTS.map((h, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full rounded-t-sm bg-red-600/80 hover:bg-red-500 transition-colors cursor-pointer" style={{ height: `${h}%` }} />
              </div>
            ))}
          </div>
          <div className="flex justify-between text-[8px] text-neutral-600 mt-2">
            {["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].map(m => <span key={m}>{m}</span>)}
          </div>
        </div>

        {/* System Health */}
        <div className="bg-[#0e0e0e] border border-neutral-900 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] font-bold text-white">System Health</p>
            <span className="text-[8px] font-bold text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded">Stable</span>
          </div>
          <p className="text-[9px] text-neutral-500 mb-3">Telemetry from mobile app and dispatch network</p>
          <div className="space-y-3">
            {[
              { label: "App connectivity", value: "98%", pct: 98 },
              { label: "Location accuracy", value: "±3m", pct: 95 },
              { label: "SMS fallback", value: "Active", pct: 100 },
            ].map((h) => (
              <div key={h.label}>
                <div className="flex justify-between text-[9px] mb-1"><span className="text-neutral-400">{h.label}</span><span className="text-neutral-300 font-mono font-bold">{h.value}</span></div>
                <div className="h-1 rounded-full bg-neutral-800"><div className="h-1 rounded-full bg-red-500" style={{ width: `${h.pct}%` }} /></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-5">
        {/* By Agency */}
        <div className="bg-[#0e0e0e] border border-neutral-900 rounded-xl p-4">
          <p className="text-[11px] font-bold text-white mb-1">Incidents by Agency</p>
          <p className="text-[9px] text-neutral-500 mb-4">Fire, Police, and Disaster distribution</p>
          <div className="flex items-end gap-4 h-20 mb-3">
            {[{ label: "Fire", pct: 35, color: "bg-orange-500" }, { label: "Police", pct: 55, color: "bg-blue-500" }, { label: "Disaster", pct: 30, color: "bg-purple-500" }].map(b => (
              <div key={b.label} className="flex-1 flex flex-col items-center gap-1">
                <div className={`w-full rounded-t-sm ${b.color}`} style={{ height: `${b.pct * 0.8}px` }} />
                <span className="text-[8px] text-neutral-500">{b.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Incident Types donut */}
        <div className="bg-[#0e0e0e] border border-neutral-900 rounded-xl p-4">
          <p className="text-[11px] font-bold text-white mb-1">Incident Types</p>
          <p className="text-[9px] text-neutral-500 mb-4">Donut-style breakdown</p>
          <div className="flex items-center justify-center h-20 relative">
            <svg viewBox="0 0 80 80" className="w-20 h-20">
              <circle cx="40" cy="40" r="30" fill="none" stroke="#dc2626" strokeWidth="16" strokeDasharray="60 130" strokeDashoffset="-10" />
              <circle cx="40" cy="40" r="30" fill="none" stroke="#3b82f6" strokeWidth="16" strokeDasharray="40 150" strokeDashoffset="-70" />
              <circle cx="40" cy="40" r="30" fill="none" stroke="#a855f7" strokeWidth="16" strokeDasharray="25 165" strokeDashoffset="-110" />
            </svg>
            <span className="absolute text-[9px] font-bold text-neutral-400">100%</span>
          </div>
        </div>

        {/* District Heatmap */}
        <div className="bg-[#0e0e0e] border border-neutral-900 rounded-xl p-4">
          <p className="text-[11px] font-bold text-white mb-1">District Heatmap</p>
          <p className="text-[9px] text-neutral-500 mb-3">Geographic breakdown of activity</p>
          <div className="grid grid-cols-5 gap-1">
            {Array.from({ length: 25 }).map((_, i) => {
              const intensity = Math.random();
              return <div key={i} className="h-6 rounded-sm" style={{ background: `rgba(220,38,38,${0.1 + intensity * 0.8})` }} />;
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <SentinelShell title="Reports & Analytics" subtitle="Performance metrics from the mobile app and dispatch network">
      {mounted ? (
        <Suspense fallback={<div className="flex items-center justify-center h-full text-neutral-500 text-sm">Loading...</div>}>
          <AdminContent />
        </Suspense>
      ) : null}
    </SentinelShell>
  );
}
