"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect, Suspense } from "react";
import { supabase } from "@/lib/supabase";
import { eawsApi } from "@/lib/api";
import SentinelShell from "@/components/SentinelShell";
import { BarChart3, Settings, Shield, Bell, Map, Wifi, Key, Webhook, Users, FileText, Save, Search, Download, CheckCircle, Clock } from "lucide-react";

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
  const [healthMessage, setHealthMessage] = useState("Checking configured incident API");
  const [liveIncidents, setLiveIncidents] = useState<any[]>([]);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);

  /* ── Audit Logs State ── */
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [threadOwners, setThreadOwners] = useState<Record<string, any>>({});
  const [auditSearch, setAuditSearch] = useState("");
  const [auditAgencyFilter, setAuditAgencyFilter] = useState("all");

  useEffect(() => {
    let active = true;
    const loadSnapshot = async () => {
      try {
        const incidents = await eawsApi.getLiveIncidents();
        if (!active) return;
        setLiveIncidents(incidents);
        setAnalyticsError(null);
        setBackendHealth("Healthy");
        setHealthMessage("Configured incident feed reachable");
      } catch (error) {
        if (!active) return;
        setAnalyticsError(error instanceof Error ? error.message : "Incident feed unavailable.");
        setBackendHealth("Unreachable");
        setHealthMessage("Configured incident feed unavailable");
        setLiveIncidents([]);
      }
    };
    void loadSnapshot();
    const iv = setInterval(loadSnapshot, 5000);
    return () => {
      active = false;
      clearInterval(iv);
    };
  }, []);

  useEffect(() => {
    if (tab !== "audit") return;
    let active = true;
    const loadAudit = async () => {
      try {
        const res = await eawsApi.getAuditLogs();
        if (!active || !res) return;
        setAuditLogs(res.logs || []);
        setThreadOwners(res.thread_owners || {});
        setAuditError(null);
      } catch (error) {
        if (!active) return;
        setAuditError(error instanceof Error ? error.message : "Audit feed unavailable.");
        console.error("Error fetching audit logs:", error);
      }
    };
    void loadAudit();
    const interval = setInterval(loadAudit, 3000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [tab]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    try {
      localStorage.setItem("eaws-dashboard-map-preferences", JSON.stringify({ gpsRefresh, mapLayers }));
      setSavedOk(true);
      setTimeout(() => setSavedOk(false), 2500);
    } catch (error) {
      console.error("Could not save local dashboard preferences:", error);
      setSavedOk(false);
    } finally {
      setIsSaving(false);
    }
  }

  useEffect(() => {
    try {
      const saved = localStorage.getItem("eaws-dashboard-map-preferences");
      if (!saved) return;
      const preferences = JSON.parse(saved);
      if (["3 sec", "5 sec", "10 sec"].includes(preferences.gpsRefresh)) {
        setGpsRefresh(preferences.gpsRefresh);
      }
      if (
        preferences.mapLayers &&
        typeof preferences.mapLayers.traffic === "boolean" &&
        typeof preferences.mapLayers.shelters === "boolean" &&
        typeof preferences.mapLayers.hazards === "boolean"
      ) {
        setMapLayers(preferences.mapLayers);
      }
    } catch (error) {
      console.error("Could not load local dashboard preferences:", error);
    }
  }, []);

  const resolvedCount = liveIncidents.filter((incident) => incident.status === "resolved").length;
  const activeCount = liveIncidents.filter((incident) => !["resolved", "dismissed", "retracted", "merged"].includes(incident.status)).length;
  const sosCount = liveIncidents.filter((incident) => incident.category?.toLowerCase() === "sos").length;
  const activeCitizens = new Set(liveIncidents.map((incident) => incident.user_id).filter(Boolean)).size;
  const hourlyCounts = Array.from({ length: 12 }, (_, index) => {
    const start = Date.now() - (11 - index) * 60 * 60 * 1000;
    const end = start + 60 * 60 * 1000;
    return liveIncidents.filter((incident) => {
      const timestamp = Date.parse(incident.created_at);
      return timestamp >= start && timestamp < end;
    }).length;
  });
  const maxHourlyCount = Math.max(1, ...hourlyCounts);

  // Audit Log Tab
  if (tab === "audit") {
    const filteredLogs = auditLogs.filter(log => {
      const matchSearch = (log.operator_name || "").toLowerCase().includes(auditSearch.toLowerCase()) ||
                          (log.text || "").toLowerCase().includes(auditSearch.toLowerCase()) ||
                          (log.citizen_id || "").toLowerCase().includes(auditSearch.toLowerCase());
      const matchAgency = auditAgencyFilter === "all" || (log.agency || "").toLowerCase().includes(auditAgencyFilter.toLowerCase());
      return matchSearch && matchAgency;
    });

    return (
      <div className="h-full overflow-y-auto p-5 space-y-5 bg-[#090909]">
        {/* Header Stats */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-[#0e0e0e] border border-neutral-900 rounded-xl px-5 py-4">
            <p className="text-[10px] text-neutral-500 mb-1">Recorded Incident Events</p>
            <p className="text-3xl font-black text-white font-mono">{auditLogs.length}</p>
            <p className="text-[9px] text-neutral-400 mt-1">Events in current API history</p>
          </div>
          <div className="bg-[#0e0e0e] border border-neutral-900 rounded-xl px-5 py-4">
            <p className="text-[10px] text-neutral-500 mb-1">Active Claimed Threads</p>
            <p className="text-3xl font-black text-blue-400 font-mono">{Object.keys(threadOwners).length}</p>
            <p className="text-[9px] text-neutral-400 mt-1">Thread ownership is not connected</p>
          </div>
          <div className="bg-[#0e0e0e] border border-neutral-900 rounded-xl px-5 py-4">
            <p className="text-[10px] text-neutral-500 mb-1">Active Duty Operators</p>
            <p className="text-3xl font-black text-purple-400 font-mono">{new Set(auditLogs.map((log) => log.operator_name).filter(Boolean)).size}</p>
            <p className="text-[9px] text-neutral-400 mt-1">Actors present in current event history</p>
          </div>
          <div className="bg-[#0e0e0e] border border-neutral-900 rounded-xl px-5 py-4">
            <p className="text-[10px] text-neutral-500 mb-1">Compliance & Audit Integrity</p>
            <p className="text-3xl font-black text-neutral-300 font-mono">Not verified</p>
            <p className="text-[9px] text-neutral-400 mt-1">Test history is volatile, not immutable</p>
          </div>
        </div>

        <div role="status" className="rounded-lg border border-amber-700/50 bg-amber-950/40 px-4 py-3 text-xs text-amber-200">
          Audit data is limited to the current API event history. This test service is in-memory and is not an immutable or compliance-grade audit ledger.
        </div>
        {auditError && (
          <div role="alert" className="rounded-lg border border-red-800/60 bg-red-950/30 px-4 py-3 text-xs text-red-200">
            Audit feed unavailable. {auditError}
          </div>
        )}

        {/* Filter & Export Bar */}
        <div className="bg-[#0e0e0e] border border-neutral-900 rounded-xl p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
              <input
                value={auditSearch}
                onChange={e => setAuditSearch(e.target.value)}
                placeholder="Filter by Operator Name, Badge, Citizen ID or Keyword..."
                className="w-full bg-[#141414] border border-neutral-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-red-500/50"
              />
            </div>
            <select
              value={auditAgencyFilter}
              onChange={e => setAuditAgencyFilter(e.target.value)}
              className="bg-[#141414] border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
            >
              <option value="all">All Agencies</option>
              <option value="police">Police Service</option>
              <option value="fire">Fire Service</option>
              <option value="ambulance">Ambulance</option>
            </select>
          </div>

          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors"
          >
            <Download size={13} /> Export Audit Report (PDF)
          </button>
        </div>

        {/* Audit Log Table */}
        <div className="bg-[#0e0e0e] border border-neutral-900 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-neutral-900 flex items-center justify-between">
            <div>
              <h3 className="text-white font-bold text-xs">Recorded Incident History</h3>
              <p className="text-[10px] text-neutral-500">Events currently present in the configured incident API</p>
            </div>
            <span className="text-[9px] font-bold text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded">
              Volatile TEST history
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-neutral-900 bg-[#121212] text-[9px] font-bold uppercase tracking-widest text-neutral-500">
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Operator Name & Badge</th>
                  <th className="py-3 px-4">Agency</th>
                  <th className="py-3 px-4">Target Citizen</th>
                  <th className="py-3 px-4">Action / Sent Message</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-900 text-xs">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-neutral-600 text-xs">
                      No audit records matching criteria.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log, idx) => (
                    <tr key={log.id || idx} className="hover:bg-neutral-900/50 transition-colors">
                      <td className="py-3 px-4 font-mono text-[10px] text-neutral-400">
                        {log.created_at ? new Date(log.created_at).toLocaleString() : "Just now"}
                      </td>
                      <td className="py-3 px-4 font-semibold text-white">
                        <div className="flex items-center gap-1.5">
                          <Shield size={12} className="text-red-500" />
                          <span>{log.operator_name || "Actor unavailable"}</span>
                          {log.operator_badge && <span className="text-[9px] font-mono text-neutral-500">({log.operator_badge})</span>}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-neutral-800 text-neutral-300">
                          {log.agency || "Unspecified"}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-red-400 font-bold">
                        {log.incident_id || log.citizen_id || "—"}
                      </td>
                      <td className="py-3 px-4 text-neutral-300 max-w-xs truncate">
                        {log.is_deleted ? (
                          <span className="text-red-400 italic flex items-center gap-1">Deleted Message (Audit Preserved)</span>
                        ) : (
                          log.text || (log.media_url ? "[Media Attachment]" : "N/A")
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-[9px] font-bold text-neutral-300 bg-neutral-800 border border-neutral-700 px-2 py-0.5 rounded flex items-center gap-1 w-fit">
                          {log.status || "Recorded"}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  if (tab === "settings") {
    return (
      <div className="h-full overflow-y-auto p-5 space-y-5 bg-[#090909]">
        <div role="status" className="rounded-lg border border-amber-700/50 bg-amber-950/40 px-4 py-3 text-xs text-amber-200">
          TEST mode: notification delivery, agency routing, staff identity, webhooks, and remote settings are not connected. Only map preferences below are stored in this browser.
        </div>
        {savedOk && <div role="status" className="text-[10px] text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg px-4 py-2.5">Local map preferences saved in this browser.</div>}

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
                <p className="text-[10px] font-semibold text-white">TEST Operator Akua Sarpong</p>
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
              { label: "Push notifications", sub: "Not connected in TEST mode", val: pushEnabled, set: setPushEnabled },
              { label: "SMS fallback", sub: "Not connected in TEST mode", val: smsEnabled, set: setSmsEnabled },
              { label: "Sound alerts", sub: "Browser alert service not configured", val: soundEnabled, set: setSoundEnabled },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between py-2.5 border-b border-neutral-900 last:border-0">
                <div>
                  <p className="text-[10px] font-semibold text-white">{item.label}</p>
                  <p className="text-[8px] text-neutral-500">{item.sub}</p>
                </div>
                <button disabled aria-label={`${item.label} not configured`} title="No delivery service is connected" className={`w-9 h-5 rounded-full relative transition-colors cursor-not-allowed opacity-50 ${item.val ? "bg-red-600" : "bg-neutral-700"}`}>
                  <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${item.val ? "translate-x-4" : "translate-x-0.5"}`} />
                </button>
              </div>
            ))}
          </div>

          {/* Broadcast Defaults */}
          <div className="bg-[#0e0e0e] border border-neutral-900 rounded-xl p-4">
            <p className="text-[10px] font-bold text-white mb-1">Broadcast Defaults</p>
            <p className="text-[9px] text-neutral-500 mb-3">Unavailable until a delivery service and zones are connected</p>
            <div className="space-y-2.5 mb-4">
              <div className="bg-neutral-900 rounded p-2.5">
                <p className="text-[7px] text-neutral-600 uppercase mb-1">Default Delivery</p>
                <p className="text-[10px] font-semibold text-amber-300">Not configured</p>
              </div>
              <div className="bg-neutral-900 rounded p-2.5">
                <p className="text-[7px] text-neutral-600 uppercase mb-1">Default Target Zone</p>
                <p className="text-[10px] font-semibold text-amber-300">No zones configured</p>
              </div>
            </div>
            <button type="button" disabled={isSaving} onClick={(event) => void handleSave(event)} className="w-full py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-[10px] font-bold transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50">
              <Save size={10} /> {isSaving ? "Saving…" : "Save local map preferences"}
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
                <button disabled title="Agency routing is not connected" className={`w-9 h-5 rounded-full relative transition-colors cursor-not-allowed opacity-50 ${item.val ? item.color : "bg-neutral-700"}`}>
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
                  <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${backendHealth === "Healthy" ? "text-green-400 bg-green-500/10 border border-green-500/20" : "text-red-300 bg-red-500/10 border border-red-500/20"}`}>{backendHealth === "Healthy" ? "TEST API" : backendHealth}</span>
                </div>
                <p className="text-[8px] text-neutral-500 mt-0.5">{healthMessage}; no push or realtime delivery</p>
              </div>
              <div className="bg-neutral-900 rounded p-2.5">
                <p className="text-[8px] text-neutral-600 uppercase mb-1">API Keys</p>
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-mono text-amber-300">Not configured</p>
                  <button disabled className="text-[8px] text-neutral-600 cursor-not-allowed">Unavailable</button>
                </div>
              </div>
              <div className="bg-neutral-900 rounded p-2.5">
                <p className="text-[8px] text-neutral-600 uppercase mb-1">Webhook Status</p>
                <p className={`text-[10px] font-semibold ${backendHealth === "Healthy" ? "text-green-400" : backendHealth === "Checking" ? "text-yellow-400" : "text-red-400"}`}>
                  {backendHealth === "Healthy" ? "Incident feed reachable only" : backendHealth === "Checking" ? "Checking..." : "Incident feed unreachable"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Analytics tab
  return (
    <div className="h-full overflow-y-auto p-5 space-y-5 bg-[#090909]">
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Active Incidents", value: activeCount, change: analyticsError ? "Feed unavailable" : "Current API snapshot", pos: !analyticsError },
          { label: "Resolved Incidents", value: resolvedCount, change: "Current API snapshot", pos: true },
          { label: "Distinct Reporters", value: activeCitizens, change: "IDs in current API snapshot", pos: true },
          { label: "SOS Signals", value: sosCount, change: "Current API snapshot", pos: false },
        ].map((s) => (
          <div key={s.label} className="bg-[#0e0e0e] border border-neutral-900 rounded-xl px-5 py-4">
            <p className="text-[10px] text-neutral-500 mb-1">{s.label}</p>
            <p className="text-3xl font-black text-white font-mono">{s.value}</p>
            <p className={`text-[9px] mt-1 ${s.pos ? "text-green-400" : "text-neutral-500"}`}>{s.change}</p>
          </div>
        ))}
      </div>
      {analyticsError && (
        <div role="alert" className="rounded-lg border border-red-800/60 bg-red-950/30 px-4 py-3 text-xs text-red-200">
          Analytics unavailable. {analyticsError}
        </div>
      )}

      <div className="grid grid-cols-3 gap-5">
        {/* Incidents Over Time */}
        <div className="col-span-2 bg-[#0e0e0e] border border-neutral-900 rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[11px] font-bold text-white">Incidents Over Time</p>
              <p className="text-[9px] text-neutral-500">Incident records in the previous 12 hours · current API snapshot</p>
            </div>
            <span className="text-[8px] font-bold text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">TEST API</span>
          </div>
          <div className="flex items-end gap-2 h-32">
            {hourlyCounts.map((count, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div title={`${count} reports`} className="w-full rounded-t-sm bg-red-600/80 transition-colors" style={{ height: `${Math.max(count ? 8 : 2, (count / maxHourlyCount) * 100)}%` }} />
              </div>
            ))}
          </div>
          <div className="flex justify-between text-[8px] text-neutral-600 mt-2">
            {Array.from({ length: 12 }, (_, index) => `${11 - index}h`).map((hour) => <span key={hour}>{hour}</span>)}
          </div>
        </div>

        {/* System Health */}
        <div className="bg-[#0e0e0e] border border-neutral-900 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] font-bold text-white">System Health</p>
            <span className={`text-[8px] font-bold px-2 py-0.5 rounded ${backendHealth === "Healthy" ? "text-green-400 bg-green-500/10 border border-green-500/20" : "text-red-300 bg-red-500/10 border border-red-500/20"}`}>{backendHealth}</span>
          </div>
          <p className="text-[9px] text-neutral-500 mb-3">Only incident feed reachability is measured; other services are not connected.</p>
          <div className="space-y-3">
            {[
              { label: "Incident feed", value: backendHealth, pct: backendHealth === "Healthy" ? 100 : 0 },
              { label: "Location accuracy", value: "Not reported", pct: 0 },
              { label: "SMS / push", value: "Not connected", pct: 0 },
            ].map((h) => (
              <div key={h.label}>
                <div className="flex justify-between text-[9px] mb-1"><span className="text-neutral-400">{h.label}</span><span className="text-neutral-300 font-mono font-bold">{h.value}</span></div>
                <div className="h-1 rounded-full bg-neutral-800"><div className="h-1 rounded-full bg-red-500" style={{ width: `${h.pct}%` }} /></div>
              </div>
            ))}
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
    <SentinelShell title="Reports & Operator Audit Ledger" subtitle="Operator accountability, thread assignments & compliance metrics">
      {mounted ? (
        <Suspense fallback={<div className="flex items-center justify-center h-full text-neutral-500 text-sm">Loading...</div>}>
          <AdminContent />
        </Suspense>
      ) : null}
    </SentinelShell>
  );
}
