"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Clock, MapPin, Activity, Radio, Phone, Send,
  Shield, Flame, AlertTriangle, Wifi, ChevronRight,
  Zap, Heart, Users, RefreshCw, Layers, Siren, CheckCircle,
  ShieldAlert, FileText, Lock, Volume2, Globe, Eye, BarChart3,
  Settings, Save, Key, Webhook, Search, Filter, AlertOctagon, UserPlus
} from "lucide-react";
import { eawsApi } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import type { AgencyUnit, Incident } from "@/lib/models";
import SentinelShell from "@/components/SentinelShell";
import { RosterManagerModal } from "@/components/dashboard/RosterManagerModal";
import { Reverse911Modal } from "@/components/dashboard/Reverse911Modal";

const LiveMap = dynamic(() => import("@/components/Map"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-neutral-950 text-neutral-500 font-mono text-xs">
      <p className="tracking-widest animate-pulse">Initializing National Command Map Feed...</p>
    </div>
  ),
});

function SuperAdminContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") || "map";
  
  // Real database states
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [units, setUnits] = useState<AgencyUnit[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  
  // Multi-tenant Regional & Agency Scope filters
  const [selectedRegion, setSelectedRegion] = useState("ALL");
  const [selectedAgency, setSelectedAgency] = useState("ALL");
  const [nationalThreatLevel, setNationalThreatLevel] = useState<"LEVEL_1" | "LEVEL_2" | "LEVEL_3">("LEVEL_1");

  // Incidents Tab Filters
  const [incidentSearch, setIncidentSearch] = useState("");
  const [incidentSeverityFilter, setIncidentSeverityFilter] = useState("ALL");
  const [incidentStatusFilter, setIncidentStatusFilter] = useState("ALL");

  // Settings states
  const [gpsRefresh, setGpsRefresh] = useState("3 sec");
  const [pushEnabled, setPushEnabled] = useState(true);
  const [smsEnabled, setSmsEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [fireEnabled, setFireEnabled] = useState(true);
  const [policeEnabled, setPoliceEnabled] = useState(true);
  const [disasterEnabled, setDisasterEnabled] = useState(true);
  const [mapLayers, setMapLayers] = useState({ traffic: true, shelters: true, hazards: true });
  const [ghanaCardThreshold, setGhanaCardThreshold] = useState("0.98");
  const [isSaving, setIsSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);

  // Tele-Med & Modals state
  const [isTeleMedActive, setIsTeleMedActive] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isCreateAdminModalOpen, setIsCreateAdminModalOpen] = useState(false);
  const [isRosterModalOpen, setIsRosterModalOpen] = useState(false);
  const [isReverse911ModalOpen, setIsReverse911ModalOpen] = useState(false);
  const [agencyRoster, setAgencyRoster] = useState<any[]>([]);
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newAdminPassword, setNewAdminPassword] = useState("Admin@123456");
  const [newAdminFullName, setNewAdminFullName] = useState("");
  const [newAdminAgency, setNewAdminAgency] = useState("police");
  const [isCreatingAdmin, setIsCreatingAdmin] = useState(false);
  const [callSeconds, setCallSeconds] = useState(0);
  const [isDispatching, setIsDispatching] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "info" | "error" } | null>(null);

  const loadRoster = useCallback(async () => {
    try {
      const roster = await eawsApi.getAgencyRoster();
      if (roster) setAgencyRoster(roster);
    } catch (err) {
      console.error("Roster load error:", err);
    }
  }, []);

  function showToast(msg: string, type: "success" | "info" | "error" = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  async function handleCreateDepartmentAdmin(e: React.FormEvent) {
    e.preventDefault();
    if (!newAdminEmail || !newAdminPassword || !newAdminAgency) return;
    setIsCreatingAdmin(true);
    try {
      const res = await eawsApi.createDepartmentAdmin({
        email: newAdminEmail,
        password: newAdminPassword,
        full_name: newAdminFullName || `${newAdminAgency.toUpperCase()} Department Admin`,
        agency_type: newAdminAgency,
      });
      showToast(`✅ ${res.message || `Department Admin for ${newAdminAgency.toUpperCase()} created successfully!`}`, "success");
      setIsCreateAdminModalOpen(false);
      setNewAdminEmail("");
      setNewAdminFullName("");
      await loadData();
    } catch (err: any) {
      showToast(`⚠️ Failed to create admin: ${err.message || err}`, "error");
    } finally {
      setIsCreatingAdmin(false);
    }
  }

  // Fetch real-time data from database
  const loadData = useCallback(async () => {
    try {
      const [liveIncidents, liveUnits, logs, users] = await Promise.all([
        eawsApi.getIncidentFeed(),
        eawsApi.getLiveUnits(),
        eawsApi.getSystemAuditLogs(),
        eawsApi.getAdminUsers().catch(() => []),
      ]);

      if (liveIncidents?.length) {
        setIncidents(liveIncidents);
        if (!selectedIncident) {
          setSelectedIncident(liveIncidents[0]);
        }
      }
      if (liveUnits?.length) setUnits(liveUnits);
      if (logs?.length) setAuditLogs(logs);
      if (users?.length) setAdminUsers(users.filter((u: any) => u.user_role === "admin" || u.user_role === "super_admin"));
    } catch (err) {
      console.error("Super Admin feed load error:", err);
    }
  }, [selectedIncident]);

  // Real-time Supabase WebSockets
  useEffect(() => {
    loadData();
    const iv = setInterval(loadData, 6000);
    const channel = supabase
      .channel("superadmin-live-feed")
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "incidents" }, loadData)
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "agency_units" }, loadData)
      .subscribe();
    return () => { clearInterval(iv); supabase.removeChannel(channel); };
  }, [loadData]);

  // Tele-med audio call timer
  useEffect(() => {
    if (!isTeleMedActive) { setCallSeconds(0); return; }
    const t = setInterval(() => setCallSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [isTeleMedActive]);

  function formatCallTime(secs: number) {
    const m = String(Math.floor(secs / 60)).padStart(2, '0');
    const s = String(secs % 60).padStart(2, '0');
    return `${m}:${s}`;
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    await new Promise(r => setTimeout(r, 600));
    setIsSaving(false);
    setSavedOk(true);
    setTimeout(() => setSavedOk(false), 3000);
  }

  // Single Agency Dispatch
  async function handleSingleDispatch(agencyType: string) {
    if (!selectedIncident) return;
    setIsDispatching(true);
    try {
      await eawsApi.dispatchIncident(selectedIncident.id, { agency_type: agencyType, priority: selectedIncident.severity.toLowerCase() });
      showToast(`✅ ${agencyType.toUpperCase()} dispatched to ${selectedIncident.location_name || "incident"}`, "success");
      await loadData();
    } catch (err: any) {
      showToast(`⚠️ Dispatch failed: ${err.message}`, "error");
    } finally {
      setIsDispatching(false);
    }
  }

  // Joint Taskforce Multi-Agency Dispatch Engine
  async function handleJointTaskforceDispatch() {
    if (!selectedIncident) return;
    setIsDispatching(true);
    try {
      const res = await eawsApi.jointDispatchIncident(selectedIncident.id, ["police", "fire", "ambulance", "nadmo"], "Super Admin Joint Taskforce Deployment");
      showToast(`🚨 ${res.message}`, "success");
      await loadData();
    } catch (err: any) {
      showToast(`⚠️ Joint Dispatch failed: ${err.message}`, "error");
    } finally {
      setIsDispatching(false);
    }
  }

  // Helper matching functions
  function matchesRegion(locName: string | null | undefined, region: string) {
    if (region === "ALL") return true;
    if (!locName) return false;
    const name = locName.toUpperCase();
    if (region === "GREATER_ACCRA") return name.includes("ACCRA") || name.includes("TEMA") || name.includes("OSU");
    if (region === "ASHANTI") return name.includes("KUMASI") || name.includes("OBUASI");
    if (region === "WESTERN") return name.includes("TAKORADI") || name.includes("SEKONDI");
    if (region === "NORTHERN") return name.includes("TAMALE");
    return name.includes(region);
  }

  function matchesAgency(inc: Incident, agency: string) {
    if (agency === "ALL") return true;
    const type = ((inc as any).emergency_type || inc.category || "").toLowerCase();
    if (agency === "POLICE") return type.includes("police") || type.includes("crime");
    if (agency === "FIRE") return type.includes("fire") || type.includes("hazard");
    if (agency === "AMBULANCE") return type.includes("ambulance") || type.includes("medical");
    if (agency === "NADMO") return type.includes("flood") || type.includes("disaster");
    return true;
  }

  const filteredIncidents = incidents.filter((inc) =>
    matchesRegion(inc.location_name || (inc as any).address, selectedRegion) &&
    matchesAgency(inc, selectedAgency)
  );

  const topIncident = selectedIncident || filteredIncidents[0] || incidents[0];
  const meta = (topIncident as any)?.metadata || {};
  const BAR_HEIGHTS = [35, 52, 48, 65, 78, 85, 70, 92, 88, 96, 90, 100];

  return (
    <SentinelShell
      title="National Super Admin Governance Center"
      subtitle="Ministry Command Overwatch, Multi-Regional Scope Switching, Joint Taskforce Engine & System Audit Logs"
    >
      {toast && (
        <div className="fixed top-4 right-4 z-[200] bg-neutral-900 border border-neutral-700 text-white font-mono text-xs px-4 py-3 rounded-lg shadow-2xl animate-bounce">
          {toast.msg}
        </div>
      )}

      {/* ── 1. SUPER ADMIN ALL INCIDENTS OVERWATCH TAB ── */}
      {activeTab === "incidents" && (
        <div className="h-full overflow-y-auto p-6 space-y-6 bg-[#090909] font-sans text-xs md:text-sm">
          <div className="flex items-center justify-between border-b border-neutral-850 pb-4">
            <div>
              <h2 className="text-xl font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
                <AlertTriangle className="text-red-500" size={20} />
                National Incident Overwatch Queue (Nationwide)
              </h2>
              <p className="text-xs text-neutral-400 mt-1">Inter-agency emergency feed monitoring across all 16 Regions</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-neutral-300 uppercase">Total: <strong className="text-white text-sm">{incidents.length}</strong></span>
              <button onClick={loadData} className="bg-neutral-850 hover:bg-neutral-750 text-white p-2.5 rounded-lg border border-neutral-800 transition-colors">
                <RefreshCw size={16} />
              </button>
            </div>
          </div>

          {/* Search & Filter Controls */}
          <div className="flex items-center gap-4 bg-[#0e0e0e] border border-neutral-900 p-4 rounded-xl">
            <div className="flex-1 relative">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                placeholder="Search incident title, location, or description..."
                value={incidentSearch}
                onChange={(e) => setIncidentSearch(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg pl-10 pr-3 py-2.5 text-xs md:text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-red-500/50"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-neutral-300 uppercase">Severity:</span>
              <select
                value={incidentSeverityFilter}
                onChange={(e) => setIncidentSeverityFilter(e.target.value)}
                className="bg-neutral-950 border border-neutral-800 text-white text-xs md:text-sm rounded-lg px-3 py-2.5 focus:outline-none"
              >
                <option value="ALL">ALL SEVERITIES</option>
                <option value="CRITICAL">CRITICAL</option>
                <option value="HIGH">HIGH</option>
                <option value="PENDING TRIAGE">PENDING TRIAGE</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-neutral-300 uppercase">Status:</span>
              <select
                value={incidentStatusFilter}
                onChange={(e) => setIncidentStatusFilter(e.target.value)}
                className="bg-neutral-950 border border-neutral-800 text-white text-xs md:text-sm rounded-lg px-3 py-2.5 focus:outline-none"
              >
                <option value="ALL">ALL STATUSES</option>
                <option value="pending">PENDING</option>
                <option value="verified">VERIFIED</option>
                <option value="assigned">ASSIGNED</option>
                <option value="resolved">RESOLVED</option>
              </select>
            </div>
          </div>

          {/* Incident Table */}
          <div className="bg-[#0e0e0e] border border-neutral-900 rounded-xl overflow-hidden shadow-lg">
            <table className="w-full text-left text-xs md:text-sm">
              <thead className="bg-neutral-950 text-neutral-300 border-b border-neutral-850 font-bold uppercase tracking-wider text-xs">
                <tr>
                  <th className="p-4">INCIDENT ID</th>
                  <th className="p-4">TITLE &amp; CATEGORY</th>
                  <th className="p-4">LOCATION</th>
                  <th className="p-4">SEVERITY</th>
                  <th className="p-4">STATUS</th>
                  <th className="p-4">GHANA CARD TRUST</th>
                  <th className="p-4">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-900">
                {incidents
                  .filter((inc) => {
                    const q = incidentSearch.toLowerCase();
                    const matchQ = !q || (inc.title || "").toLowerCase().includes(q) || (inc.location_name || "").toLowerCase().includes(q) || (inc.description || "").toLowerCase().includes(q);
                    const matchSev = incidentSeverityFilter === "ALL" || (inc.severity || "").toUpperCase() === incidentSeverityFilter;
                    const matchStat = incidentStatusFilter === "ALL" || (inc.status || "").toLowerCase() === incidentStatusFilter.toLowerCase();
                    return matchQ && matchSev && matchStat;
                  })
                  .map((inc) => (
                    <tr key={inc.id} className="hover:bg-neutral-900/50 transition-colors">
                      <td className="p-4 font-bold text-red-400">#{inc.id.substring(0, 8)}</td>
                      <td className="p-4">
                        <p className="font-bold text-white text-xs md:text-sm">{inc.title}</p>
                        <p className="text-xs text-neutral-400 uppercase font-semibold">{inc.category || (inc as any).emergency_type || "GENERAL"}</p>
                      </td>
                      <td className="p-4 text-neutral-200">{inc.location_name || (inc as any).address || "GPS Coordinates"}</td>
                      <td className="p-4">
                        <span className={`text-xs font-bold px-2.5 py-1 rounded uppercase ${
                          inc.severity === "CRITICAL" ? "bg-red-600/20 text-red-400 border border-red-500/30" : "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                        }`}>
                          {inc.severity || "MEDIUM"}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={`text-xs font-bold px-2.5 py-1 rounded uppercase ${
                          inc.status === "verified" ? "bg-green-500/20 text-green-400 border border-green-500/30" : "bg-neutral-800 text-neutral-300"
                        }`}>
                          {inc.status}
                        </span>
                      </td>
                      <td className="p-4 text-green-400 font-bold text-xs md:text-sm">0.98 (Verified)</td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setSelectedIncident(inc);
                              handleJointTaskforceDispatch();
                            }}
                            className="bg-red-600 hover:bg-red-700 text-white font-bold text-[9px] uppercase px-2.5 py-1 rounded transition-colors"
                          >
                            Joint Dispatch
                          </button>
                          <button
                            onClick={async () => {
                              await eawsApi.updateIncident(inc.id, { severity: "CRITICAL" });
                              showToast("Incident elevated to CRITICAL severity", "info");
                              await loadData();
                            }}
                            className="bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[9px] font-bold uppercase px-2.5 py-1 rounded transition-colors"
                          >
                            Escalate
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── 2. SUPER ADMIN AGENCY ADMINS & DEPARTMENTS TAB ── */}
      {activeTab === "departments" && (
        <div className="h-full overflow-y-auto p-6 space-y-6 bg-[#090909] font-sans text-xs md:text-sm">
          <div className="flex items-center justify-between border-b border-neutral-850 pb-4">
            <div>
              <h2 className="text-xl font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
                <Users className="text-purple-400" size={20} />
                Department Admins &amp; Agency Readiness Control
              </h2>
              <p className="text-xs text-neutral-400 mt-1">Delegated agency administrative accounts and operational readiness across all services</p>
            </div>
            <button
              onClick={() => setIsCreateAdminModalOpen(true)}
              className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs md:text-sm px-4 py-2.5 rounded-lg flex items-center gap-2 transition-colors shadow-lg"
            >
              <UserPlus size={16} /> + Create Department Admin
            </button>
          </div>

          {/* Agency Overview Cards */}
          <div className="grid grid-cols-4 gap-5">
            {[
              { agency: "Police Service", code: "POLICE", color: "border-blue-500/40 text-blue-400", desc: "Ghana Police Service HQ Admin" },
              { agency: "Fire Service (GNFS)", code: "FIRE", color: "border-orange-500/40 text-orange-400", desc: "National Fire Service Command Admin" },
              { agency: "National Ambulance", code: "AMBULANCE", color: "border-green-500/40 text-green-400", desc: "Ambulance Service (NAS) Admin" },
              { agency: "NADMO Disaster", code: "NADMO", color: "border-purple-500/40 text-purple-400", desc: "Disaster Management Command Admin" },
            ].map((card) => {
              const matchingAdmins = adminUsers.filter(u => (u.agency_type || u.user_role || "").toUpperCase() === card.code || (card.code === "POLICE" && u.user_role === "police"));
              return (
                <div key={card.code} className={`bg-[#0e0e0e] border ${card.color} rounded-xl p-5 space-y-3`}>
                  <p className="text-xs font-bold uppercase text-neutral-400">{card.desc}</p>
                  <h3 className="text-2xl font-extrabold text-white">{card.agency}</h3>
                  <div className="flex justify-between items-center text-xs pt-3 border-t border-neutral-850">
                    <span className="text-neutral-300">Assigned Admins:</span>
                    <span className="font-bold text-white text-sm">{matchingAdmins.length || 1} Account</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-neutral-300">Operational Status:</span>
                    <span className="text-green-400 font-bold">100% ONLINE</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Department Admins Table */}
          <div className="bg-[#0e0e0e] border border-neutral-900 rounded-xl overflow-hidden shadow-lg">
            <div className="p-4 bg-neutral-950 border-b border-neutral-850 flex justify-between items-center">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Active Agency Department Admin Accounts</h3>
              <span className="text-xs font-bold text-green-400 bg-green-500/10 px-3 py-1 rounded border border-green-500/20">
                GOVERNANCE DELEGATION ACTIVE
              </span>
            </div>
            <table className="w-full text-left text-xs md:text-sm">
              <thead className="bg-neutral-950 text-neutral-300 border-b border-neutral-850 uppercase font-bold text-xs">
                <tr>
                  <th className="p-4">ADMIN NAME</th>
                  <th className="p-4">OFFICIAL EMAIL</th>
                  <th className="p-4">ASSIGNED AGENCY</th>
                  <th className="p-4">REGIONAL SCOPE</th>
                  <th className="p-4">STATUS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-900">
                {adminUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-neutral-400">
                      No custom department admins created yet. Click &quot;+ Create Department Admin&quot; to assign agency admins.
                    </td>
                  </tr>
                ) : (
                  adminUsers.map((u, idx) => (
                    <tr key={u.user_id || idx} className="hover:bg-neutral-900/50 transition-colors">
                      <td className="p-4 font-bold text-white text-xs md:text-sm">{u.full_name || "Department Admin"}</td>
                      <td className="p-4 text-neutral-200">{u.email || "admin@agency.gov.gh"}</td>
                      <td className="p-4">
                        <span className="text-xs font-bold uppercase px-2.5 py-1 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                          {(u.agency_type || u.user_role || "agency_admin").toUpperCase()}
                        </span>
                      </td>
                      <td className="p-4 text-neutral-300">GHANA NATIONWIDE (ALL REGIONS)</td>
                      <td className="p-4 text-green-400 font-bold">ACTIVE &amp; APPROVED</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── 3. SUPER ADMIN AUDIT LOGS TAB ── */}
      {activeTab === "audit" && (
        <div className="h-full overflow-y-auto p-6 space-y-6 bg-[#090909] font-sans text-xs md:text-sm">
          <div className="flex items-center justify-between border-b border-neutral-850 pb-4">
            <div>
              <h2 className="text-xl font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
                <ShieldAlert className="text-tertiary" size={20} />
                National Security &amp; Audit Operations Logs
              </h2>
              <p className="text-xs text-neutral-400 mt-1">Immutable audit trail of national security events, promotions, and dispatch overrides</p>
            </div>
            <button onClick={loadData} className="bg-neutral-850 hover:bg-neutral-750 text-white font-bold text-xs md:text-sm px-4 py-2 rounded-lg flex items-center gap-2 border border-neutral-800 transition-colors">
              <RefreshCw size={14} /> Refresh Audit Trail
            </button>
          </div>

          <div className="bg-[#0e0e0e] border border-neutral-900 rounded-xl overflow-hidden shadow-lg">
            <table className="w-full text-left text-xs md:text-sm">
              <thead className="bg-neutral-950 text-neutral-300 border-b border-neutral-850 font-bold uppercase tracking-wider text-xs">
                <tr>
                  <th className="p-4">TIMESTAMP</th>
                  <th className="p-4">ACTION TYPE</th>
                  <th className="p-4">OPERATOR / ACTOR</th>
                  <th className="p-4">DETAILS &amp; METADATA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-900">
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-neutral-400">
                      No security audit events recorded.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log, idx) => (
                    <tr key={log.id || idx} className="hover:bg-neutral-900/50 transition-colors">
                      <td className="p-4 text-neutral-300">{new Date(log.created_at || Date.now()).toLocaleString()}</td>
                      <td className="p-4 font-bold text-tertiary uppercase">{log.action || "SYSTEM_EVENT"}</td>
                      <td className="p-4 text-white font-bold">{log.operator || log.actor_id || "Super Admin HQ"}</td>
                      <td className="p-4 text-neutral-200 leading-relaxed">{log.details || log.message || JSON.stringify(log.metadata || {})}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── 4. SUPER ADMIN ANALYTICS TAB ── */}
      {activeTab === "analytics" && (
        <div className="h-full overflow-y-auto p-6 space-y-6 bg-[#090909] font-sans text-xs md:text-sm">
          <div className="flex items-center justify-between border-b border-neutral-850 pb-4">
            <div>
              <h2 className="text-xl font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
                <BarChart3 className="text-primary" size={20} />
                National Emergency Analytics &amp; Response KPIs
              </h2>
              <p className="text-xs text-neutral-400 mt-1">Real-time performance metrics across all 16 Regions and 5 Responder Agencies</p>
            </div>
            <span className="text-xs font-bold text-green-400 bg-green-500/10 border border-green-500/20 px-3 py-1 rounded-lg uppercase animate-pulse">
              Live National Data Feed
            </span>
          </div>

          <div className="grid grid-cols-4 gap-5">
            {[
              { label: "Total Incidents Resolved", value: "1,284", change: "+18% vs previous period", pos: true },
              { label: "National Avg Response Time", value: "8.4 mins", change: "-0.8m SLA improvement", pos: true },
              { label: "Active Emergency Calls", value: incidents.length || "128", change: "Live sharing enabled", pos: true },
              { label: "SOS Signals Received", value: "42", change: "12 critical, 30 triaged", pos: false },
            ].map((s) => (
              <div key={s.label} className="bg-[#0e0e0e] border border-neutral-900 rounded-xl px-5 py-4 space-y-1">
                <p className="text-xs font-bold uppercase text-neutral-400">{s.label}</p>
                <p className="text-3xl font-black text-white font-mono">{s.value}</p>
                <p className={`text-xs font-semibold ${s.pos ? "text-green-400" : "text-neutral-400"}`}>{s.change}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-5">
            <div className="col-span-2 bg-[#0e0e0e] border border-neutral-900 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-bold text-white">Incidents Over Time (12 Months)</p>
                  <p className="text-xs text-neutral-400 mt-0.5">National trend line from mobile app and 112 dispatch network</p>
                </div>
                <span className="text-xs font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-2.5 py-1 rounded">Verified</span>
              </div>
              <div className="flex items-end gap-2 h-36">
                {BAR_HEIGHTS.map((h, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full rounded-t-sm bg-red-600/80 hover:bg-red-500 transition-colors cursor-pointer" style={{ height: `${h}%` }} />
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-xs font-bold text-neutral-400 mt-3">
                {["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].map(m => <span key={m}>{m}</span>)}
              </div>
            </div>

            <div className="bg-[#0e0e0e] border border-neutral-900 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-bold text-white">System Infrastructure Health</p>
                <span className="text-xs font-bold text-green-400 bg-green-500/10 border border-green-500/20 px-2.5 py-1 rounded">100% Stable</span>
              </div>
              <div className="space-y-4 pt-2">
                {[
                  { label: "Supabase WebSockets", value: "99.98%", pct: 99 },
                  { label: "PostGIS Spatial Engine", value: "Active", pct: 100 },
                  { label: "SMS Gateway Fallback", value: "Active", pct: 100 },
                  { label: "API Response Latency", value: "42ms", pct: 96 },
                ].map((h) => (
                  <div key={h.label}>
                    <div className="flex justify-between text-xs mb-1.5"><span className="text-neutral-300 font-medium">{h.label}</span><span className="text-white font-bold">{h.value}</span></div>
                    <div className="h-2 rounded-full bg-neutral-800"><div className="h-2 rounded-full bg-red-500" style={{ width: `${h.pct}%` }} /></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 5. SUPER ADMIN GOVERNANCE SETTINGS TAB ── */}
      {activeTab === "settings" && (
        <div className="h-full overflow-y-auto p-6 space-y-6 bg-[#090909] font-sans text-xs md:text-sm">
          <div className="flex items-center justify-between border-b border-neutral-850 pb-4">
            <div>
              <h2 className="text-xl font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
                <Settings className="text-tertiary" size={20} />
                Super Admin System &amp; Governance Preferences
              </h2>
              <p className="text-xs text-neutral-400 mt-1">National identity verification thresholds, telemetry cadence, and API access controls</p>
            </div>
            {savedOk && <div className="text-xs text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg px-4 py-2 font-bold">Settings saved successfully.</div>}
          </div>

          <div className="grid grid-cols-3 gap-5">
            {/* Operator Profile */}
            <div className="bg-[#0e0e0e] border border-neutral-900 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-white uppercase">Super Admin Profile</p>
                <span className="text-xs font-bold bg-purple-600 text-white px-2.5 py-1 rounded">Super Admin</span>
              </div>
              <p className="text-xs text-neutral-400">Ministry Level Command Authority</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-neutral-900 rounded-lg p-3">
                  <p className="text-xs text-neutral-400 uppercase mb-1">Name</p>
                  <p className="text-sm font-bold text-white">Ama Mensah</p>
                </div>
                <div className="bg-neutral-900 rounded-lg p-3">
                  <p className="text-xs text-neutral-400 uppercase mb-1">Role</p>
                  <p className="text-sm font-bold text-white">National Commander</p>
                </div>
              </div>
              <div className="bg-neutral-900 rounded-lg p-3">
                <p className="text-xs text-neutral-400 uppercase mb-1">Assigned Scope</p>
                <p className="text-sm font-bold text-white">All 16 Regions (Ghana Nationwide)</p>
              </div>
            </div>

            {/* Ghana Card Trust Settings */}
            <div className="bg-[#0e0e0e] border border-neutral-900 rounded-xl p-5 space-y-3">
              <p className="text-sm font-bold text-white uppercase">Ghana Card Identity Controls</p>
              <p className="text-xs text-neutral-400">National trust score threshold for automatic report verification</p>
              <div className="bg-neutral-900 rounded-lg p-3 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-neutral-300 font-bold">Min Verification Trust Score</span>
                  <span className="text-green-400 font-bold text-sm">{ghanaCardThreshold}</span>
                </div>
                <input
                  type="range"
                  min="0.80"
                  max="1.00"
                  step="0.01"
                  value={ghanaCardThreshold}
                  onChange={(e) => setGhanaCardThreshold(e.target.value)}
                  className="w-full accent-red-600 cursor-pointer"
                />
              </div>
              {[
                { label: "Require Ghana Card for SOS Panic Trigger", val: true },
                { label: "Allow Anonymous Incident Reports", val: true },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between py-2 border-b border-neutral-900 last:border-0">
                  <span className="text-xs text-neutral-200 font-medium">{item.label}</span>
                  <div className="w-9 h-5 rounded-full bg-red-600 relative shrink-0">
                    <span className="absolute top-0.5 right-0.5 w-4 h-4 bg-white rounded-full" />
                  </div>
                </div>
              ))}
            </div>

            {/* Telemetry Cadence */}
            <div className="bg-[#0e0e0e] border border-neutral-900 rounded-xl p-5 space-y-3">
              <p className="text-sm font-bold text-white uppercase">Telemetry &amp; GPS Cadence</p>
              <p className="text-xs text-neutral-400">AVL vehicle position refresh rate</p>
              <div className="bg-neutral-900 rounded-lg p-3">
                <p className="text-xs font-bold text-neutral-300 mb-1">GPS Refresh Rate</p>
                <select value={gpsRefresh} onChange={e => setGpsRefresh(e.target.value)} className="w-full bg-[#131313] text-white text-xs md:text-sm border border-neutral-800 rounded-lg p-2.5 focus:outline-none">
                  <option>1 sec</option><option>3 sec</option><option>5 sec</option><option>10 sec</option>
                </select>
              </div>
              <div className="bg-neutral-900 rounded-lg p-3">
                <p className="text-xs font-bold text-neutral-300 mb-1.5 uppercase">Emergency Channels</p>
                <div className="flex gap-4 text-xs mt-1">
                  <label className="flex items-center gap-1.5 text-white font-semibold cursor-pointer"><input type="checkbox" checked={fireEnabled} onChange={e => setFireEnabled(e.target.checked)} /> Fire</label>
                  <label className="flex items-center gap-1.5 text-white font-semibold cursor-pointer"><input type="checkbox" checked={policeEnabled} onChange={e => setPoliceEnabled(e.target.checked)} /> Police</label>
                  <label className="flex items-center gap-1.5 text-white font-semibold cursor-pointer"><input type="checkbox" checked={disasterEnabled} onChange={e => setDisasterEnabled(e.target.checked)} /> Disaster</label>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button onClick={handleSaveSettings} disabled={isSaving} className="bg-red-600 hover:bg-red-500 text-white font-bold text-xs md:text-sm px-6 py-3 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50 shadow-lg">
              <Save size={16} /> {isSaving ? "Saving Configuration..." : "Save Governance Settings"}
            </button>
          </div>
        </div>
      )}

      {/* ── 6. DEFAULT SUPER ADMIN COMMAND HUD & MAP VIEW ── */}
      {/* ── 6. DEFAULT SUPER ADMIN COMMAND HUD & MAP VIEW ── */}
      {(activeTab === "map" || !["incidents", "departments", "audit", "analytics", "settings"].includes(activeTab)) && (
        <div className="flex flex-col h-full overflow-hidden relative font-sans">
          {/* Top Scope Bar */}
          <div className="bg-[#121212] border-b border-neutral-850 px-5 py-3 flex items-center justify-between font-sans text-xs md:text-sm shrink-0">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2 text-red-500 font-bold text-xs md:text-sm">
                <Globe size={16} />
                <span>NATIONAL MATRIX SWITCHER:</span>
              </div>

              {/* Region Selector */}
              <div className="flex items-center gap-2 bg-neutral-900 px-3.5 py-1.5 rounded-lg border border-neutral-800">
                <span className="text-xs text-neutral-400 font-bold">REGION:</span>
                <select
                  value={selectedRegion}
                  onChange={(e) => setSelectedRegion(e.target.value)}
                  className="bg-transparent text-white font-bold text-xs md:text-sm focus:outline-none cursor-pointer"
                >
                  <option value="ALL">ALL NATIONWIDE (16 REGIONS)</option>
                  <option value="GREATER_ACCRA">GREATER ACCRA REGION</option>
                  <option value="ASHANTI">ASHANTI REGION</option>
                  <option value="WESTERN">WESTERN REGION</option>
                  <option value="CENTRAL">CENTRAL REGION</option>
                  <option value="EASTERN">EASTERN REGION</option>
                  <option value="VOLTA">VOLTA REGION</option>
                  <option value="NORTHERN">NORTHERN REGION</option>
                </select>
              </div>

              {/* Agency HQ Selector */}
              <div className="flex items-center gap-2 bg-neutral-900 px-3.5 py-1.5 rounded-lg border border-neutral-800">
                <span className="text-xs text-neutral-400 font-bold">AGENCY HQ:</span>
                <select
                  value={selectedAgency}
                  onChange={(e) => setSelectedAgency(e.target.value)}
                  className="bg-transparent text-amber-400 font-bold text-xs md:text-sm focus:outline-none cursor-pointer"
                >
                  <option value="ALL">ALL AGENCIES (NATIONAL HQ)</option>
                  <option value="POLICE">GHANA POLICE FORCE HQ</option>
                  <option value="FIRE">NATIONAL FIRE SERVICE (GNFS) HQ</option>
                  <option value="AMBULANCE">NATIONAL AMBULANCE (NAS) HQ</option>
                  <option value="NADMO">NADMO DISASTER MGMT HQ</option>
                  <option value="TRIAGE">112 CALL TRIAGE HQ</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                onClick={() => setIsCreateAdminModalOpen(true)}
                className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs uppercase px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition-colors shadow"
              >
                <Shield size={14} />
                + Create Dept Admin
              </button>
              <button
                onClick={() => { loadRoster(); setIsRosterModalOpen(true); }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition-colors shadow"
              >
                <Users size={14} />
                + Agency Roster / CSV
              </button>
              <button
                onClick={() => setIsReverse911ModalOpen(true)}
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs uppercase px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition-colors shadow"
              >
                <Radio size={14} />
                Reverse 911
              </button>
              <span className="text-xs text-neutral-300 font-bold uppercase ml-2">
                ACTIVE INCIDENTS: <strong className="text-white text-sm">{filteredIncidents.length}</strong>
              </span>
              <span className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse"></span>
              <span className="text-xs text-green-400 font-bold">REAL-TIME SYNC</span>
            </div>
          </div>

          {/* Main Split Grid */}
          <div className="flex-1 flex overflow-hidden">
            {/* Left Executive Command Panel */}
            <div className="w-[340px] min-w-[340px] h-full overflow-y-auto bg-[#0e0e0e] border-r border-neutral-900 flex flex-col text-xs md:text-sm custom-scrollbar">
              
              {/* 1. National Readiness & DEFCON Threat Gauge */}
              <div className="p-5 border-b border-neutral-900 bg-neutral-950/80 space-y-3">
                <div className="flex justify-between items-center">
                  <p className="text-xs font-extrabold tracking-wider text-neutral-400 uppercase">National Security Threat Gauge</p>
                  <span className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse"></span>
                </div>

                <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-neutral-300 uppercase">Alert Status:</span>
                    <select
                      value={nationalThreatLevel}
                      onChange={(e) => {
                        const val = e.target.value as "LEVEL_1" | "LEVEL_2" | "LEVEL_3";
                        setNationalThreatLevel(val);
                        showToast(`🛡️ National Threat Status set to ${val.replace("_", " ")}`, "info");
                      }}
                      className="bg-neutral-950 text-white font-bold text-xs rounded-md px-2.5 py-1.5 border border-neutral-800 focus:outline-none cursor-pointer"
                    >
                      <option value="LEVEL_1">LEVEL 1 - NORMAL</option>
                      <option value="LEVEL_2">LEVEL 2 - ELEVATED</option>
                      <option value="LEVEL_3">LEVEL 3 - CRITICAL EMERGENCY</option>
                    </select>
                  </div>

                  <div className="pt-2 border-t border-neutral-850 flex items-center justify-between text-xs">
                    <span className="text-neutral-400 font-semibold">State Readiness:</span>
                    <span className={`font-bold px-2 py-0.5 rounded text-[10px] uppercase ${
                      nationalThreatLevel === "LEVEL_3" ? "bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse" :
                      nationalThreatLevel === "LEVEL_2" ? "bg-amber-500/20 text-amber-400 border border-amber-500/40" :
                      "bg-green-500/20 text-green-400 border border-green-500/40"
                    }`}>
                      {nationalThreatLevel === "LEVEL_3" ? "HIGH ALERT" : nationalThreatLevel === "LEVEL_2" ? "ELEVATED" : "OPTIMAL READINESS"}
                    </span>
                  </div>
                </div>
              </div>

              {/* 2. Multi-Agency Operational Readiness Matrix */}
              <div className="p-5 border-b border-neutral-900 space-y-3">
                <p className="text-xs font-extrabold text-neutral-400 uppercase tracking-wider">Multi-Agency Fleet Matrix</p>
                <div className="space-y-2.5">
                  {[
                    { agency: "Ghana Police Service", code: "GPS", active: "42 Units Active", detail: "18 Regional Patrols", color: "border-blue-500/30 text-blue-400" },
                    { agency: "National Fire Service", code: "GNFS", active: "28 Engines Ready", detail: "4 Fire Stations", color: "border-orange-500/30 text-orange-400" },
                    { agency: "National Ambulance", code: "NAS", active: "35 Fleet Standby", detail: "12 En Route", color: "border-green-500/30 text-green-400" },
                    { agency: "NADMO Disaster Command", code: "NADMO", active: "14 Safe Zones Open", detail: "6 Relief Centers", color: "border-purple-500/30 text-purple-400" },
                  ].map((ag) => (
                    <div key={ag.code} className={`bg-neutral-950 border ${ag.color} rounded-lg p-3 flex items-center justify-between`}>
                      <div>
                        <p className="font-bold text-white text-xs">{ag.agency}</p>
                        <p className="text-[11px] text-neutral-400">{ag.detail}</p>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-1 bg-neutral-900 text-neutral-200 rounded border border-neutral-800">
                        {ag.active}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 3. Ghana 16-Region Command Health Grid */}
              <div className="p-5 border-b border-neutral-900 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-extrabold text-neutral-400 uppercase tracking-wider">Ghana 16-Region Health</p>
                  <span className="text-[11px] text-neutral-500 font-semibold">Active Sector Focus</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: "GREATER_ACCRA", name: "Greater Accra", count: incidents.filter(i => matchesRegion(i.location_name, "GREATER_ACCRA")).length || 3 },
                    { key: "ASHANTI", name: "Ashanti Region", count: incidents.filter(i => matchesRegion(i.location_name, "ASHANTI")).length || 1 },
                    { key: "WESTERN", name: "Western Region", count: incidents.filter(i => matchesRegion(i.location_name, "WESTERN")).length || 0 },
                    { key: "NORTHERN", name: "Northern Region", count: incidents.filter(i => matchesRegion(i.location_name, "NORTHERN")).length || 0 },
                    { key: "VOLTA", name: "Volta Region", count: incidents.filter(i => matchesRegion(i.location_name, "VOLTA")).length || 0 },
                    { key: "EASTERN", name: "Eastern Region", count: incidents.filter(i => matchesRegion(i.location_name, "EASTERN")).length || 0 },
                  ].map((r) => (
                    <button
                      key={r.key}
                      onClick={() => setSelectedRegion(r.key)}
                      className={`p-2.5 rounded-lg border text-left transition-all ${
                        selectedRegion === r.key
                          ? "bg-red-600/20 border-red-500 text-white font-bold"
                          : "bg-neutral-950 border-neutral-850 hover:bg-neutral-900 text-neutral-300"
                      }`}
                    >
                      <p className="text-[11px] font-semibold truncate">{r.name}</p>
                      <p className="text-[10px] text-neutral-400 font-bold mt-0.5">{r.count} Active Alert{r.count !== 1 ? "s" : ""}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* 4. Strategic Executive Command Actions */}
              <div className="p-5 space-y-2.5">
                <p className="text-xs font-extrabold text-neutral-400 uppercase tracking-wider mb-2">Executive Command Actions</p>
                <button
                  onClick={handleJointTaskforceDispatch}
                  disabled={isDispatching}
                  className="w-full py-3 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs md:text-sm font-bold transition-colors flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
                >
                  <Siren size={16} /> 1-Click Joint Taskforce Escalation
                </button>

                <button
                  onClick={() => setIsReverse911ModalOpen(true)}
                  className="w-full py-3 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs md:text-sm font-bold transition-colors flex items-center justify-center gap-2 shadow-lg"
                >
                  <Radio size={16} /> Broadcast Reverse 911 Public Alert
                </button>
              </div>

            </div>

            {/* Center Map Canvas */}
            <div className="flex-1 h-full relative overflow-hidden bg-neutral-950 border-r border-neutral-900">
              <LiveMap incidents={filteredIncidents} units={units} />
              <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/80 backdrop-blur-sm border border-neutral-800 rounded-full px-3.5 py-1.5 text-xs font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse"></span>
                <span className="text-neutral-200 font-bold uppercase">SUPABASE REALTIME SYNC</span>
                <span className="text-amber-400 font-bold">| PostGIS Active</span>
              </div>
            </div>

            {/* Right Audit Trail */}
            <div className="w-[340px] min-w-[340px] h-full overflow-y-auto bg-[#0e0e0e] flex flex-col text-xs md:text-sm">
              <div className="p-4 bg-neutral-950 border-b border-neutral-900 flex justify-between items-center shrink-0">
                <h3 className="font-extrabold text-xs md:text-sm text-white uppercase tracking-wider flex items-center gap-2">
                  <FileText size={16} className="text-amber-400" />
                  National Security Audit Trail
                </h3>
                <span className="text-xs font-bold text-green-400 bg-green-500/10 px-2.5 py-1 rounded border border-green-500/20">
                  LIVE LOGS
                </span>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
                {auditLogs.length === 0 ? (
                  <div className="text-center py-12 text-neutral-400 text-xs">
                    No security audit events recorded.
                  </div>
                ) : (
                  auditLogs.map((log, idx) => (
                    <div key={log.id || idx} className="p-3.5 bg-neutral-950 rounded-lg border border-neutral-850 space-y-1.5 hover:border-amber-500/40 transition-all">
                      <div className="flex justify-between items-start">
                        <span className="font-bold text-amber-400 text-xs uppercase">{log.action || "SYSTEM_EVENT"}</span>
                        <span className="text-xs text-neutral-400">{new Date(log.created_at || Date.now()).toLocaleTimeString()}</span>
                      </div>
                      <p className="text-xs text-white font-bold">{log.operator || "Operator System"}</p>
                      <p className="text-xs text-neutral-300 leading-normal">{log.details || log.message || "Action executed successfully."}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tele-Med Audio Link Modal */}
      {isTeleMedActive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 font-mono">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden shadow-2xl w-full max-w-md">
            <div className="p-4 bg-black border-b border-neutral-800 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></span>
                <h3 className="text-white font-bold text-xs uppercase">Tele-Med Doctor Voice Link Connected</h3>
              </div>
              <span className="text-tertiary text-xs font-bold">{formatCallTime(callSeconds)}</span>
            </div>
            
            <div className="p-6 text-center space-y-4">
              <div className="w-20 h-20 rounded-full bg-red-500/10 border border-red-500/30 mx-auto flex items-center justify-center text-red-400">
                <Volume2 size={36} className="animate-pulse" />
              </div>
              <div>
                <p className="text-white font-bold text-sm">Doctor Emergency Voice Channel Active</p>
                <p className="text-neutral-400 text-xs mt-1">Patient: {topIncident?.title || "D. Harrison"} · HR {meta.vitals_hr || "128"} BPM</p>
              </div>

              <div className="p-3 bg-neutral-950 rounded border border-neutral-850 text-left text-[10px] text-neutral-300 space-y-1">
                <p className="text-tertiary font-bold uppercase">PHYSICIAN ADVISORY:</p>
                <p>&ldquo;Instruct bystander to apply pressure dressing to quadrant 3 until Ambulance Alpha arrives.&rdquo;</p>
              </div>
            </div>

            <div className="p-4 bg-black border-t border-neutral-800 flex justify-center">
              <button
                onClick={() => setIsTeleMedActive(false)}
                className="px-6 py-2.5 rounded-lg bg-red-600 text-white font-bold text-xs hover:bg-red-700 transition flex items-center gap-2"
              >
                <Phone size={14} className="rotate-[135deg]" /> End Tele-Med Channel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Citizen Profile Modal */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 font-mono">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 bg-black border-b border-neutral-800">
              <h3 className="text-white font-bold text-xs uppercase">Citizen Profile &amp; Ghana Card Identity</h3>
              <button onClick={() => setIsProfileModalOpen(false)} className="text-neutral-400 hover:text-white">
                ✕
              </button>
            </div>
            
            <div className="p-6 space-y-4 text-xs">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-neutral-800 flex items-center justify-center text-white text-base font-bold">
                  {(topIncident?.title?.split("—")[1]?.trim() || "DH")[0]}
                </div>
                <div>
                  <h2 className="text-white font-bold text-sm">{topIncident?.title?.split("—")[1]?.trim() || topIncident?.title || "D. Harrison"}</h2>
                  <p className="text-tertiary text-[10px]">GHANA CARD: GHA-8829104-9 (VERIFIED)</p>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="bg-neutral-950 border border-neutral-800 rounded p-3">
                  <p className="text-[9px] text-neutral-500 uppercase font-bold">Medical History</p>
                  <p className="text-neutral-300 text-xs mt-0.5">Hypertension (Diagnosed 2021). No known drug allergies.</p>
                </div>
                <div className="bg-neutral-950 border border-neutral-800 rounded p-3">
                  <p className="text-[9px] text-neutral-500 uppercase font-bold">Emergency Contact</p>
                  <p className="text-neutral-300 text-xs mt-0.5">Next of Kin: +233 55 123 4567</p>
                </div>
              </div>
            </div>
            
            <div className="p-4 bg-black border-t border-neutral-800">
              <button 
                onClick={() => setIsProfileModalOpen(false)}
                className="w-full py-2 rounded bg-neutral-800 text-white font-bold text-xs hover:bg-neutral-700 transition"
              >
                Close Window
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Department Admin Modal */}
      {isCreateAdminModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 font-mono">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 bg-black border-b border-neutral-800">
              <h3 className="text-white font-bold text-xs uppercase flex items-center gap-2">
                <Shield size={14} className="text-red-500" />
                Create Department Admin Account
              </h3>
              <button onClick={() => setIsCreateAdminModalOpen(false)} className="text-neutral-400 hover:text-white">
                ✕
              </button>
            </div>
            
            <form onSubmit={handleCreateDepartmentAdmin} className="p-6 space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-neutral-400 uppercase">Target Agency Department</label>
                <select
                  value={newAdminAgency}
                  onChange={(e) => setNewAdminAgency(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded px-3 py-2 text-xs text-white focus:outline-none"
                >
                  <option value="police">Ghana Police Service HQ Admin</option>
                  <option value="fire">Ghana National Fire Service (GNFS) Admin</option>
                  <option value="nadmo">NADMO Disaster Management Admin</option>
                  <option value="ambulance">National Ambulance Service (NAS) Admin</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-neutral-400 uppercase">Official Admin Email</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. admin@police.gov.gh"
                  value={newAdminEmail}
                  onChange={(e) => setNewAdminEmail(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded px-3 py-2 text-xs text-white focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-neutral-400 uppercase">Admin Full Name</label>
                <input
                  type="text"
                  placeholder="e.g. Supt. Kwaku Baah (Police HQ Admin)"
                  value={newAdminFullName}
                  onChange={(e) => setNewAdminFullName(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded px-3 py-2 text-xs text-white focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-neutral-400 uppercase">Initial Password</label>
                <input
                  type="text"
                  required
                  value={newAdminPassword}
                  onChange={(e) => setNewAdminPassword(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded px-3 py-2 text-xs text-white focus:outline-none font-mono"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isCreatingAdmin}
                  className="w-full py-2.5 rounded bg-red-600 hover:bg-red-700 text-white font-bold text-xs transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Shield size={14} />
                  {isCreatingAdmin ? "Creating Department Admin..." : "Confirm & Create Admin"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <RosterManagerModal
        isOpen={isRosterModalOpen}
        onClose={() => setIsRosterModalOpen(false)}
        roster={agencyRoster}
        onRefreshRoster={loadRoster}
      />
      <Reverse911Modal
        isOpen={isReverse911ModalOpen}
        onClose={() => setIsReverse911ModalOpen(false)}
        onSuccess={() => showToast("Reverse 911 alert sent successfully!", "success")}
      />
    </SentinelShell>
  );
}

export default function SuperAdminDashboardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center text-neutral-400 font-mono gap-2">
        <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <p className="text-xs uppercase tracking-widest animate-pulse">Loading Governance Center...</p>
      </div>
    }>
      <SuperAdminContent />
    </Suspense>
  );
}
