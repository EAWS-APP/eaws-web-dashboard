"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { supabase } from "@/lib/supabase";
import { eawsApi } from "@/lib/api";
import type { Incident } from "@/lib/models";
import {
  X, CheckCircle, UserCheck, Search, Shield, Flame, Activity, Phone,
  TrendingUp, Check, RefreshCw, AlertTriangle, Users, ShieldAlert, Timer
} from "lucide-react";

const LiveMap = dynamic(() => import("@/components/Map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[384px] w-full items-center justify-center bg-neutral-950 text-neutral-500 rounded-lg border border-neutral-800">
      <p className="text-xs font-mono tracking-wider animate-pulse font-bold">Initializing Admin Tracking Viewport...</p>
    </div>
  ),
});

type EAWSUser = {
  user_id: string;
  full_name: string;
  email: string;
  phone: string;
  user_role: string;
  operator_code: string | null;
  agency_type: string | null;
  is_approved: boolean;
  is_active: boolean;
  created_at: string;
};

export default function AdminDashboardPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [adminProfile, setAdminProfile] = useState<any>(null);
  
  // Real database states
  const [users, setUsers] = useState<EAWSUser[]>([]);
  const [liveIncidents, setLiveIncidents] = useState<Incident[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Layout View states
  const [showInteractiveMap, setShowInteractiveMap] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRole, setFilterRole] = useState("all");

  // User Elevation states
  const [selectedUser, setSelectedUser] = useState<EAWSUser | null>(null);
  const [targetRole, setTargetRole] = useState("police");
  const [isPromoting, setIsPromoting] = useState(false);
  const [promotionResult, setPromotionResult] = useState<{ email: string; code: string } | null>(null);

  const [chatMessages, setChatMessages] = useState<Array<{ sender: string; time: string; text: string }>>([
    { sender: "DISPATCH", time: "14:12:05", text: "Global system overwatch active." },
    { sender: "POLICE_HQ", time: "14:12:30", text: "All patrol channels synchronized." },
    { sender: "EMS_HQ", time: "14:12:45", text: "Ambulance units standby." }
  ]);

  // Verification states
  useEffect(() => {
    async function checkAuth() {
      try {
        const data = await eawsApi.getMe();
        if (data.profile && ["admin", "super_admin"].includes(data.profile.user_role)) {
          setAdminProfile(data.profile);
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

  async function loadUsers() {
    setIsLoading(true);
    try {
      const data = await eawsApi.getAdminUsers();
      setUsers(data || []);
    } catch (err) {
      console.error("Failed to load users:", err);
    } finally {
      setIsLoading(false);
    }
  }

  async function loadIncidents() {
    try {
      const data = await eawsApi.getIncidentFeed();
      setLiveIncidents(data || []);
    } catch (err) {
      console.error("Failed to load incidents:", err);
    }
  }

  useEffect(() => {
    if (isAuthenticated) {
      loadUsers();
      loadIncidents();
    }
  }, [isAuthenticated]);

  async function handlePromoteSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUser) return;
    setIsPromoting(true);
    try {
      const result = await eawsApi.promoteUser(selectedUser.user_id, {
        role: targetRole,
      });
      setPromotionResult({
        email: result.email || selectedUser.email,
        code: result.operator_code,
      });
      await loadUsers();
    } catch (err: any) {
      alert("Promotion failed: " + (err.message || err));
    } finally {
      setIsPromoting(false);
    }
  }

  const handleVerifyIncident = async (id: string) => {
    try {
      await eawsApi.updateIncident(id, { status: "verified" });
      alert("Incident successfully verified!");
      await loadIncidents();
    } catch (err: any) {
      alert("Failed to verify incident: " + (err.message || err));
    }
  };

  const handleDismissIncident = async (id: string) => {
    try {
      await eawsApi.updateIncident(id, { status: "resolved" });
      alert("Incident successfully resolved/dismissed.");
      await loadIncidents();
    } catch (err: any) {
      alert("Failed to resolve incident: " + (err.message || err));
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  // Filter users based on query
  const filteredUsers = users.filter((u) => {
    const nameMatch = (u.full_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
                      (u.email || "").toLowerCase().includes(searchTerm.toLowerCase());
    
    if (filterRole === "all") return nameMatch;
    if (filterRole === "citizen") return nameMatch && u.user_role === "citizen";
    return nameMatch && u.user_role === filterRole;
  });

  // Calculate high level metrics
  const unverifiedReportsCount = liveIncidents.filter((i) => i.status !== "resolved").length;
  const criticalSosCount = liveIncidents.filter((i) => i.severity === "CRITICAL").length;

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center text-[#e5e2e1] gap-2.5">
        <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <p className="text-xs font-mono tracking-wider animate-pulse uppercase">Connecting Secure Admin Console...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0A0A0A] text-[#e5e2e1] font-sans">
      <div className="scanline fixed inset-0 z-10 opacity-30 pointer-events-none"></div>

      {/* 1. Left SideNavBar */}
      <aside className="h-screen w-64 flex flex-col bg-surface-container border-r border-outline-variant fixed left-0 top-0 z-40 py-6 shrink-0">
        <div className="px-6 mb-8">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-primary-container flex items-center justify-center rounded shadow-lg">
              <span className="material-symbols-outlined text-on-primary-container">shield</span>
            </div>
            <div>
              <h1 className="text-sm font-bold text-on-surface leading-none uppercase tracking-wider">CENTRAL DISPATCH</h1>
              <p className="font-mono text-[9px] text-tertiary mt-1 tracking-widest">Region-01 | Active</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-2 space-y-1">
          <a className="flex items-center gap-4 px-4 py-2 bg-secondary-container text-on-secondary-container border-l-4 border-secondary transition-all" href="#">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>map</span>
            <span className="text-[11px] font-bold uppercase tracking-wider font-mono">Live Map</span>
          </a>
          <a className="flex items-center gap-4 px-4 py-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-variant transition-all" href="#">
            <span className="material-symbols-outlined">emergency_home</span>
            <span className="text-[11px] font-bold uppercase tracking-wider font-mono">Incidents</span>
          </a>
          <a className="flex items-center gap-4 px-4 py-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-variant transition-all" href="#">
            <span className="material-symbols-outlined">group_work</span>
            <span className="text-[11px] font-bold uppercase tracking-wider font-mono">Resources</span>
          </a>
          <a className="flex items-center gap-4 px-4 py-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-variant transition-all" href="#">
            <span className="material-symbols-outlined">rss_feed</span>
            <span className="text-[11px] font-bold uppercase tracking-wider font-mono">Community</span>
          </a>
          <a className="flex items-center gap-4 px-4 py-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-variant transition-all" href="#">
            <span className="material-symbols-outlined">monitoring</span>
            <span className="text-[11px] font-bold uppercase tracking-wider font-mono">Analytics</span>
          </a>
        </nav>
        <div className="px-4 mt-auto space-y-4">
          <button className="w-full py-2.5 bg-primary-container text-on-primary-container text-[11px] font-bold uppercase tracking-wider rounded hover:brightness-110 active:opacity-80 transition-all flex items-center justify-center gap-2 shadow-lg">
            <span className="material-symbols-outlined text-[18px]">add_alert</span>
            NEW INCIDENT
          </button>
          <div className="pt-4 border-t border-outline-variant">
            <a className="flex items-center gap-4 px-4 py-2 text-on-surface-variant hover:text-on-surface transition-all" href="#">
              <span className="material-symbols-outlined text-[20px]">security</span>
              <span className="text-[11px] font-bold uppercase tracking-wider font-mono">System Status</span>
            </a>
            <a className="flex items-center gap-4 px-4 py-2 text-on-surface-variant hover:text-on-surface transition-all" href="#">
              <span className="material-symbols-outlined text-[20px]">help</span>
              <span className="text-[11px] font-bold uppercase tracking-wider font-mono">Support</span>
            </a>
          </div>
        </div>
      </aside>

      {/* 2. Main Workspace */}
      <main className="ml-64 flex-1 flex flex-col h-screen overflow-hidden bg-background tactical-grid relative">
        <header className="flex justify-between items-center px-6 w-full sticky top-0 z-50 bg-surface border-b border-outline-variant h-14 shrink-0">
          <div className="flex items-center gap-6">
            <h2 className="text-[20px] font-bold text-primary tracking-tighter">SENTINEL COMMAND</h2>
            <div className="relative group">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-base">search</span>
              <input 
                className="bg-surface-container border-none rounded-lg pl-10 pr-4 py-1.5 text-xs w-64 focus:ring-1 focus:ring-primary text-white outline-none font-mono" 
                placeholder="Global Entity Search..." 
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden md:flex flex-col items-end">
              <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest font-mono">SYS_LOG_ACTIVE</span>
              <span className="text-[9px] font-mono text-tertiary uppercase">AUTH_LEVEL: SYSTEM_ADMIN</span>
            </div>
            <button className="material-symbols-outlined text-on-surface-variant hover:bg-surface-variant p-2 rounded transition-colors">notifications</button>
            <button className="material-symbols-outlined text-error hover:bg-surface-variant p-2 rounded transition-colors">emergency</button>
            <button className="material-symbols-outlined text-on-surface-variant hover:bg-surface-variant p-2 rounded transition-colors">settings</button>
            <div className="h-6 w-[1px] bg-outline-variant mx-1"></div>
            <button 
              onClick={handleLogout}
              className="text-[11px] font-bold uppercase tracking-wider text-primary hover:bg-surface-variant px-4 py-1.5 rounded transition-colors font-mono"
            >
              LOGOUT
            </button>
            <img 
              className="w-8 h-8 rounded-full border border-primary ml-2 object-cover" 
              alt="Admin avatar"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuAyB959pF4FMa4T-uIRaVkvvr_G3chCp7e_anIWsONQV3brSzzZxFxr3Q2im4CDMqlcr3W0fxtE17IDkx0rSaEMleLqql9Tlr-83Aq8ZnK9xcjCskKjlsyJmDOG-zr875vadNlvNrq_QNqJNa9PzQErOAy7sEWM_p5GM2UccL7cb7i6_EGyvkkBgjQSF44ErLF5X0J1GnxgOg0cU9RRW2CzZO_CLDXlfRq3U3y3c-VCP0lc_fJWwFWM0iXttVXRBUuIjiIR2rtJ38U3"
            />
          </div>
        </header>

        {/* Dashboard Scrollable Canvas */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* ROW 1: HEALTH & ANALYTICS */}
          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-12 lg:col-span-3 tactical-card p-4 rounded-xl flex flex-col justify-between min-h-[120px]">
              <div className="flex justify-between items-start">
                <span className="text-[10px] font-bold tracking-wider text-on-surface-variant font-mono uppercase">Active Users</span>
                <Users size={16} className="text-tertiary" />
              </div>
              <div className="mt-2">
                <h3 className="text-2xl font-black text-white font-mono">{users.length}</h3>
                <p className="text-tertiary text-[10px] font-mono flex items-center gap-0.5 mt-0.5">
                  <TrendingUp size={11} /> +12% from last hour
                </p>
              </div>
            </div>
            
            <div className="col-span-12 lg:col-span-3 tactical-card p-4 rounded-xl flex flex-col justify-between min-h-[120px] border-error/30 bg-error-container/5">
              <div className="flex justify-between items-start">
                <span className="text-[10px] font-bold tracking-wider text-error font-mono uppercase">SOS Count</span>
                <ShieldAlert size={16} className="text-error" />
              </div>
              <div className="mt-2">
                <h3 className="text-2xl font-black text-error font-mono">{criticalSosCount}</h3>
                <p className="text-on-surface-variant text-[10px] font-mono">Priority 1 Active Alerts</p>
              </div>
            </div>

            <div className="col-span-12 lg:col-span-3 tactical-card p-4 rounded-xl flex flex-col justify-between min-h-[120px]">
              <div className="flex justify-between items-start">
                <span className="text-[10px] font-bold tracking-wider text-on-surface-variant font-mono uppercase">System Uptime</span>
                <Timer size={16} className="text-secondary-container" />
              </div>
              <div className="mt-2">
                <h3 className="text-2xl font-black text-white font-mono">99.998%</h3>
                <p className="text-on-surface-variant text-[10px] font-mono">Nodes Cluster: 12/12 Online</p>
              </div>
            </div>

            <div className="col-span-12 lg:col-span-3 tactical-card p-4 rounded-xl flex flex-col justify-between min-h-[120px] relative overflow-hidden group">
              <div className="relative z-10 flex flex-col h-full justify-between">
                <div>
                  <span className="text-[10px] font-bold tracking-wider text-on-surface-variant font-mono uppercase">Global Data Load</span>
                  <h3 className="text-base font-black text-tertiary font-mono mt-1">STABLE</h3>
                </div>
                <button 
                  onClick={() => setShowInteractiveMap(!showInteractiveMap)}
                  className="w-full py-1 text-[9px] font-mono font-bold uppercase rounded border border-outline-variant hover:bg-surface-variant transition-colors"
                >
                  {showInteractiveMap ? "Show Satellite HUD" : "Show Map Viewport"}
                </button>
              </div>
            </div>
          </div>

          {/* Interactive Map view if toggled */}
          {showInteractiveMap && (
            <div className="tactical-card rounded-xl overflow-hidden border border-outline-variant h-96 relative">
              <LiveMap 
                center={[5.6037, -0.1870]}
                zoom={12}
                incidents={liveIncidents}
                units={[]}
              />
            </div>
          )}

          {/* ROW 2: INTEL FEED & CHAT */}
          <div className="grid grid-cols-12 gap-6">
            {/* Global Intel Feed */}
            <div className="col-span-12 lg:col-span-8 tactical-card overflow-hidden flex flex-col h-[500px] rounded-xl">
              <div className="p-4 border-b border-outline-variant flex justify-between items-center bg-surface-container-low shrink-0">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-base">hub</span>
                  Global Intel Feed
                </h4>
                <div className="flex gap-2">
                  <select 
                    value={filterRole}
                    onChange={(e) => setFilterRole(e.target.value)}
                    className="bg-[#131313] border border-[#3A3A3C] rounded px-2.5 py-1 text-[10px] text-neutral-300 font-mono"
                  >
                    <option value="all">ALL REGISTRANTS</option>
                    <option value="citizen">CITIZENS ONLY</option>
                    <option value="police">POLICE UNITS</option>
                    <option value="ambulance">EMS RESPONDERS</option>
                  </select>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
                {liveIncidents.length === 0 ? (
                  <div className="text-center py-12 text-neutral-500 font-mono text-xs">
                    NO ACTIVE SYSTEM INTEL REPORTED
                  </div>
                ) : (
                  liveIncidents.map((inc) => {
                    const isCritical = inc.severity === "CRITICAL";
                    const isVerified = inc.status === "verified";
                    const score = isCritical ? "0.98" : "0.74";
                    
                    return (
                      <div key={inc.id} className="p-4 border border-[#3A3A3C] rounded-lg bg-[#131313] flex gap-4 transition-all">
                        <div className="flex flex-col items-center gap-2 shrink-0">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isCritical ? "bg-error-container text-error" : "bg-secondary-container/20 text-secondary-container"}`}>
                            <span className="material-symbols-outlined text-base">
                              {isCritical ? "warning" : "shield_person"}
                            </span>
                          </div>
                        </div>
                        <div className="flex-1 space-y-2">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-bold text-white text-xs">{inc.title}</p>
                              <p className="text-[9px] font-mono font-bold text-neutral-400 mt-0.5">LOC: {inc.location_name}</p>
                              <p className={`text-[8px] font-mono font-bold ${isCritical ? "text-error" : "text-tertiary"} uppercase mt-0.5`}>
                                TRUST SCORE: {score} · {inc.severity}
                              </p>
                            </div>
                            <span className={`text-[8px] font-bold font-mono px-2 py-0.5 rounded uppercase ${
                              isVerified ? "bg-tertiary/20 text-tertiary border border-tertiary/30" : "bg-secondary-container/20 text-secondary-container border-secondary-container/30"
                            }`}>
                              {inc.status}
                            </span>
                          </div>
                          <p className="text-xs text-neutral-350 leading-relaxed">{inc.description || "No description provided."}</p>
                          
                          {!isVerified && (
                            <div className="flex gap-2 pt-2 border-t border-neutral-850 justify-end">
                              <button 
                                onClick={() => handleVerifyIncident(inc.id)}
                                className="bg-tertiary text-on-tertiary px-3 py-1 rounded font-mono text-[9px] font-bold uppercase hover:brightness-110 transition-all flex items-center gap-1"
                              >
                                <Check size={10} /> Verify Report
                              </button>
                              <button 
                                onClick={() => handleDismissIncident(inc.id)}
                                className="bg-neutral-800 border border-neutral-700 text-neutral-400 px-3 py-1 rounded font-mono text-[9px] font-bold uppercase hover:bg-neutral-700 transition-all"
                              >
                                Dismiss
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Chat/Incident Room Sidebar */}
            <div className="col-span-12 lg:col-span-4 tactical-card flex flex-col h-[500px] rounded-xl">
              <div className="p-4 border-b border-outline-variant bg-surface-container-low flex items-center justify-between shrink-0">
                <h4 className="text-[10px] font-bold text-white uppercase tracking-wider flex items-center gap-1.5 font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-error animate-pulse"></span>
                  Incident Room [DELTA-9]
                </h4>
                <span className="material-symbols-outlined text-xs text-on-surface-variant">open_in_full</span>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4 flex flex-col-reverse">
                {/* Simulated / Real merged comms feeds */}
                <div className="space-y-3 flex flex-col">
                  {chatMessages.slice(-5).map((msg, idx) => (
                    <div key={idx} className="bg-surface-variant/30 p-2.5 rounded-lg border border-outline-variant text-xs">
                      <p className="font-bold text-primary font-mono text-[9px] uppercase">{msg.sender} · {msg.time}</p>
                      <p className="text-neutral-200 mt-1 leading-relaxed">{msg.text}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-4 border-t border-outline-variant shrink-0">
                <div className="flex gap-2">
                  <input 
                    className="flex-1 bg-surface-container-highest border-none rounded text-xs px-3 py-1.5 focus:ring-1 focus:ring-primary text-white outline-none font-mono" 
                    placeholder="Direct dispatch command..." 
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  <button className="bg-primary-container w-9 h-9 flex items-center justify-center rounded shadow hover:brightness-110 active:scale-95 transition-all text-on-primary-container">
                    <span className="material-symbols-outlined text-sm">send</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ROW 3: INCIDENT HISTORY & PERMISSIONS */}
          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-12 lg:col-span-7 tactical-card overflow-hidden rounded-xl">
              <div className="p-4 border-b border-outline-variant bg-surface-container-low flex justify-between items-center">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Incident History Log</h4>
                <button className="material-symbols-outlined text-on-surface-variant text-base">filter_list</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-[11px]">
                  <thead className="bg-surface-container text-on-surface-variant border-b border-[#3A3A3C]">
                    <tr>
                      <th className="p-3 font-bold">ID</th>
                      <th className="p-3 font-bold">EVENT TYPE</th>
                      <th className="p-3 font-bold">GEOLOCATION</th>
                      <th className="p-3 font-bold">TIMESTAMP</th>
                      <th className="p-3 font-bold">STATUS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-900">
                    {liveIncidents.map((inc) => (
                      <tr key={inc.id} className="hover:bg-neutral-900/30 transition-colors">
                        <td className="p-3 text-primary font-bold">#{inc.id.substring(0, 8)}</td>
                        <td className="p-3 font-sans font-bold text-white">{inc.title}</td>
                        <td className="p-3 text-neutral-400">{inc.latitude?.toFixed(4)}° N, {inc.longitude?.toFixed(4)}° W</td>
                        <td className="p-3 text-neutral-400">{new Date(inc.created_at).toLocaleTimeString()}</td>
                        <td className="p-3">
                          <span className={`text-[8px] font-bold font-mono px-2 py-0.5 border rounded uppercase ${
                            inc.status === "verified" ? "text-tertiary bg-tertiary/10 border-tertiary/20" : "text-error bg-error-container/10 border-error/20"
                          }`}>
                            {inc.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Access Control & Approvals List */}
            <div className="col-span-12 lg:col-span-5 tactical-card p-4 rounded-xl space-y-4">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono border-b border-[#3A3A3C] pb-2">User Permissions &amp; Approvals</h4>
              <div className="space-y-3 overflow-y-auto max-h-[300px] custom-scrollbar pr-1">
                {filteredUsers.map((user) => (
                  <div key={user.user_id} className="p-3 border border-[#3A3A3C] bg-surface-container rounded-lg flex items-center justify-between transition-all">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded bg-outline-variant flex items-center justify-center text-xs text-white font-bold font-mono overflow-hidden">
                        <span className="material-symbols-outlined text-sm text-neutral-400">person</span>
                      </div>
                      <div>
                        <p className="font-bold text-white text-xs">{user.full_name || "Unnamed citizen"}</p>
                        <p className="text-[9px] text-neutral-400 font-mono uppercase">{user.email} · {user.user_role}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {user.user_role === "citizen" ? (
                        <button 
                          onClick={() => {
                            setSelectedUser(user);
                            setPromotionResult(null);
                          }}
                          className="bg-primary/20 text-primary border border-primary/30 hover:bg-primary hover:text-black px-2.5 py-1 rounded text-[9px] font-bold uppercase transition-all font-mono"
                        >
                          Elevate
                        </button>
                      ) : (
                        <span className="text-[9px] text-tertiary font-bold font-mono border border-tertiary/20 bg-tertiary/5 px-2 py-1 rounded">APPROVED</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      </main>

      {/* Role Elevation Modal Dialog */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
          <div className="bg-[#1C1C1E] border border-[#3A3A3C] rounded-xl max-w-sm w-full overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-850 px-4 py-3 bg-neutral-950/40">
              <h3 className="font-extrabold text-xs text-white uppercase tracking-wider font-mono">Elevate Account Privileges</h3>
              <button onClick={() => setSelectedUser(null)} className="text-neutral-500 hover:text-white transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="p-4">
              {promotionResult ? (
                <div className="space-y-4 text-center py-4 text-xs font-mono">
                  <div className="h-12 w-12 rounded-full bg-green-500/10 border border-green-500/20 mx-auto flex items-center justify-center text-green-400 mb-2">
                    <CheckCircle size={28} />
                  </div>
                  <h4 className="font-bold text-white text-sm">Elevation Successful!</h4>
                  <div className="rounded-lg bg-neutral-950 p-4 border border-neutral-850 space-y-2 text-left">
                    <p className="text-[10px] text-neutral-500 uppercase font-bold">Security Details:</p>
                    <p className="flex justify-between">
                      <span className="text-neutral-400">Email:</span>
                      <span className="text-white">{promotionResult.email}</span>
                    </p>
                    <p className="flex justify-between">
                      <span className="text-neutral-400">Operator Code:</span>
                      <span className="text-green-400 font-bold">{promotionResult.code}</span>
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedUser(null)}
                    className="w-full bg-neutral-850 hover:bg-neutral-750 text-white font-bold py-2 rounded text-xs transition-colors uppercase"
                  >
                    Close Window
                  </button>
                </div>
              ) : (
                <form onSubmit={handlePromoteSubmit} className="space-y-4 text-xs font-mono">
                  <div className="bg-neutral-950 p-3 rounded border border-neutral-850 space-y-1">
                    <p className="text-neutral-500">Target Profile</p>
                    <p className="font-bold text-white">{selectedUser.full_name || "Unnamed citizen"}</p>
                    <p className="text-neutral-400">{selectedUser.email}</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-neutral-400">SELECT TARGET ROLE</label>
                    <select
                      value={targetRole}
                      onChange={(e) => setTargetRole(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded px-3 py-2 text-xs text-white focus:outline-none"
                    >
                      <option value="police">Ghana Police Force</option>
                      <option value="ambulance">National Ambulance Service</option>
                      <option value="fire">National Fire Service</option>
                    </select>
                  </div>
                  <button
                    type="submit"
                    disabled={isPromoting}
                    className="w-full bg-primary text-on-primary font-bold py-2.5 rounded text-xs transition-all uppercase flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <UserCheck size={14} />
                    <span>{isPromoting ? "Elevating Profile..." : "Confirm & Elevate"}</span>
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
