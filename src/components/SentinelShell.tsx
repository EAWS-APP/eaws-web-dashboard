"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useState, useEffect, useRef, Suspense } from "react";
import {
  ShieldAlert, Shield, Map, AlertTriangle, Truck, Users,
  BarChart3, Settings, Radio, Search, X, Send,
  Bell, Wifi, WifiOff, MessageSquare, Trash2, Ban, ExternalLink, ChevronRight, LogOut,
  PanelLeftClose, PanelLeftOpen, User, Key, Activity
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { eawsApi, isLocalTestApi } from "@/lib/api";
import { insforge } from "@/lib/insforge";

const NAV_ITEMS = [
  { id: "map",        label: "Live Map",      icon: Map,           href: "/dashboard" },
  { id: "incidents",  label: "Incidents",     icon: AlertTriangle, href: "/police" },
  { id: "fire",       label: "Fire Service",  icon: Radio,         href: "/fire" },
  { id: "ambulance",  label: "Ambulance",     icon: Truck,         href: "/ambulance" },
  { id: "community",  label: "Community",     icon: Users,         href: "/community" },
  { id: "analytics",  label: "Analytics",     icon: BarChart3,     href: "/admin?tab=analytics" },
  { id: "audit",      label: "Audit Ledger",  icon: Shield,        href: "/admin?tab=audit" },
  { id: "settings",   label: "Settings",      icon: Settings,      href: "/admin?tab=settings" },
];

const SUPER_ADMIN_NAV_ITEMS = [
  { id: "map",         label: "Live Overwatch",   icon: Map,           href: "/super-admin?tab=map" },
  { id: "incidents",   label: "All Incidents",    icon: AlertTriangle, href: "/super-admin?tab=incidents" },
  { id: "departments", label: "Agency Admins",    icon: Users,         href: "/super-admin?tab=departments" },
  { id: "analytics",   label: "Analytics",        icon: BarChart3,     href: "/super-admin?tab=analytics" },
  { id: "audit font-mono", label: "Audit Logs",   icon: ShieldAlert,   href: "/super-admin?tab=audit" },
  { id: "settings font-mono", label: "Settings",  icon: Settings,      href: "/super-admin?tab=settings" },
];

type AgencyFilter = "all" | "fire" | "police" | "disaster";

export default function SentinelShell({
  children,
  title = "Sentinel Command",
  subtitle,
  searchValue,
  onSearchChange,
}: {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
}) {
  const router = useRouter();
  const pathname = usePathname();

  // Persist collapsed state across routes in localStorage
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [showOperatorModal, setShowOperatorModal] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("eaws_nav_collapsed");
      if (saved !== null) {
        setNavCollapsed(saved === "true");
      }
    } catch { /* ignore */ }
  }, []);

  const toggleNav = (collapsed: boolean) => {
    setNavCollapsed(collapsed);
    try {
      localStorage.setItem("eaws_nav_collapsed", String(collapsed));
    } catch { /* ignore */ }
  };

  const [showBroadcast, setShowBroadcast] = useState(false);
  const [broadcastMsg, setBroadcastMsg] = useState("");
  const [broadcastZone, setBroadcastZone] = useState("All citizens in Accra Metro");
  const [isSending, setIsSending] = useState(false);
  const [sentOk, setSentOk] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [liveIncidentCount, setLiveIncidentCount] = useState<number | null>(null);

  /* ── Dispatch Global Messages Inbox State ── */
  const [showInboxModal, setShowInboxModal] = useState(false);
  const [threads, setThreads] = useState<any[]>([]);
  const [selectedCitizenId, setSelectedCitizenId] = useState<string>("c-005");
  const [activeMsgs, setActiveMsgs] = useState<any[]>([]);
  const [activeThreadOwner, setActiveThreadOwner] = useState<any>(null);
  const [newMsgText, setNewMsgText] = useState("");
  const [mediaUrlInput, setMediaUrlInput] = useState("");
  const [showMediaPrompt, setShowMediaPrompt] = useState(false);
  const [unreadTotal, setUnreadTotal] = useState<number>(0);
  const [toastAlert, setToastAlert] = useState<{ name: string; text: string } | null>(null);
  const prevLastMsgIdRef = useRef<string | null>(null);

  /* ── Real-time connectivity status ── */
  useEffect(() => {
    const update = () => setIsOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);

  /* ── Live incident counter for sidebar badge ── */
  useEffect(() => {
    if (isLocalTestApi) {
      const fetchTestCount = async () => {
        try {
          setLiveIncidentCount((await eawsApi.getLiveIncidents()).length);
        } catch (error) {
          console.error("Could not refresh test incident count:", error);
        }
      };
      fetchTestCount();
      const interval = setInterval(fetchTestCount, 2000);
      return () => clearInterval(interval);
    }

    async function fetchCount() {
      try {
        const { count } = await supabase
          .from("incidents")
          .select("*", { count: "exact", head: true })
          .in("status", ["pending", "verified", "assigned"]);
        setLiveIncidentCount(count ?? 0);
      } catch { /* fallback */ }
    }
    fetchCount();
    // InsForge Realtime subscription
    insforge.realtime.connect().then(() => {
      insforge.realtime.subscribe("shell-incident-count");
      insforge.realtime.on("db:incidents", () => { void fetchCount(); });
    });
    return () => { insforge.realtime.unsubscribe("shell-incident-count"); };
  }, []);

  /* ── Global Messages Polling & Notification Toast ── */
  useEffect(() => {
    if (isLocalTestApi) return;
    const checkMessages = async () => {
      try {
        const tList = await eawsApi.getThreadSummaries();
        if (tList && Array.isArray(tList)) {
          setThreads(tList);
          const totalUnread = tList.reduce((acc, t) => acc + (t.unread_count || 0), 0);
          setUnreadTotal(totalUnread);

          // Check if latest message is new from a citizen
          const newestThread = tList[0];
          if (newestThread && newestThread.last_message) {
            const last = newestThread.last_message;
            if (last.sender === "citizen" && last.id !== prevLastMsgIdRef.current) {
              prevLastMsgIdRef.current = last.id;
              const name = MOCK_NAMES[newestThread.citizen_id] || newestThread.citizen_id;
              setToastAlert({ name, text: last.text || "Sent an image/media attachment" });
              setTimeout(() => setToastAlert(null), 5000);
            }
          }
        }
      } catch { /* silent fallback */ }
    };

    checkMessages();
    const interval = setInterval(checkMessages, 1500);
    return () => clearInterval(interval);
  }, []);

  /* ── Load conversation when a thread is selected inside Inbox Modal ── */
  useEffect(() => {
    if (isLocalTestApi || !showInboxModal || !selectedCitizenId) return;
    const fetchThreadMsgs = () => {
      eawsApi.getMessages(selectedCitizenId).then(res => {
        if (Array.isArray(res)) {
          setActiveMsgs(res);
        } else if (res && (res as any).messages) {
          setActiveMsgs((res as any).messages);
          setActiveThreadOwner((res as any).thread_owner || null);
        }
      }).catch(() => {});
    };
    fetchThreadMsgs();
    const interval = setInterval(fetchThreadMsgs, 1000);
    return () => clearInterval(interval);
  }, [showInboxModal, selectedCitizenId]);

  const handleClaimThread = async () => {
    try {
      const owner = await eawsApi.claimThread(selectedCitizenId);
      setActiveThreadOwner(owner);
      const tList = await eawsApi.getThreadSummaries();
      setThreads(tList);
    } catch (err) {
      console.error("Error claiming thread:", err);
    }
  };

  /* ── Broadcast Alert to Supabase alerts table ── */
  async function handleBroadcast(e: React.FormEvent) {
    e.preventDefault();
    if (!broadcastMsg.trim()) return;
    setIsSending(true);
    try {
      await supabase.from("alerts").insert({
        title: "OPERATOR BROADCAST",
        message: broadcastMsg.trim(),
        severity: "WARNING",
        zone_target: broadcastZone,
        is_active: true,
        created_at: new Date().toISOString(),
      });
      setSentOk(true);
      setBroadcastMsg("");
      setTimeout(() => { setSentOk(false); setShowBroadcast(false); }, 2000);
    } catch (err) {
      console.error("Broadcast failed:", err);
    } finally {
      setIsSending(false);
    }
  }

  const handleSendFromModal = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = newMsgText.trim();
    const media = mediaUrlInput.trim();
    if (!text && !media) return;
    setNewMsgText("");
    setMediaUrlInput("");
    setShowMediaPrompt(false);
    try {
      const type = media ? (media.match(/\.(mp4|mov|webm)$/i) ? 'video' : 'image') : 'text';
      await eawsApi.sendMessage(selectedCitizenId, text, type, media || undefined);
      const updated = await eawsApi.getMessages(selectedCitizenId);
      setActiveMsgs(updated);
    } catch (err) {
      console.error("Error sending from modal:", err);
    }
  };

  const handleDeleteFromModal = async (msgId: string) => {
    try {
      await eawsApi.deleteMessage(selectedCitizenId, msgId);
      const updated = await eawsApi.getMessages(selectedCitizenId);
      setActiveMsgs(updated);
    } catch (err) {
      console.error("Error deleting from modal:", err);
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error("Signout error:", e);
    }
    if (typeof window !== "undefined") {
      localStorage.removeItem("eaws_mock_token");
      localStorage.removeItem("eaws_operator");
      localStorage.removeItem("supabase.auth.token");
      window.location.href = "/";
    }
  };

  const agencyList = [
    { key: "fire",     label: "Fire Service",     color: "text-orange-400", dot: "bg-orange-500" },
    { key: "police",   label: "Police",           color: "text-blue-400",   dot: "bg-blue-500"   },
    { key: "disaster", label: "Disaster",         color: "text-purple-400", dot: "bg-purple-500" },
  ];

  return (
    <div className="flex h-screen w-screen overflow-hidden relative" style={{ background: "var(--sentinel-bg, #080808)" }}>

      {/* ═══════════════════  NEW INCOMING MESSAGE TOAST NOTIFICATION  ═══════════════════ */}
      {toastAlert && (
        <div
          onClick={() => { setShowInboxModal(true); setToastAlert(null); }}
          className="fixed top-4 right-6 z-50 bg-[#161616] border border-red-500/50 rounded-xl p-3.5 shadow-2xl flex items-center gap-3 cursor-pointer hover:border-red-500 transition-all animate-bounce"
        >
          <div className="w-9 h-9 rounded-full bg-red-600 flex items-center justify-center text-white shrink-0">
            <MessageSquare size={16} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-[12px] font-bold text-white">{toastAlert.name}</p>
              <span className="text-[9px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded font-bold">NEW MSG</span>
            </div>
            <p className="text-[11px] text-neutral-300 truncate max-w-[240px] mt-0.5">{toastAlert.text}</p>
          </div>
          <button onClick={(e) => { e.stopPropagation(); setToastAlert(null); }} className="text-neutral-500 hover:text-white p-1">
            <X size={14} />
          </button>
        </div>
      )}

      {/* ═══════════════════  LEFT SIDEBAR  ═══════════════════ */}
      <aside className="w-[220px] min-w-[220px] flex flex-col border-r border-neutral-900 bg-[#0c0c0c]">

        {/* Logo */}
        <div className="px-4 pt-4 pb-3 border-b border-neutral-900">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-red-600 rounded-md flex items-center justify-center shrink-0 critical-pulse">
              <ShieldAlert size={18} className="text-white" />
            </div>
            <div className="leading-tight">
              <p className="text-xs font-black tracking-widest text-white uppercase">Central</p>
              <p className="text-xs font-black tracking-widest text-white uppercase">Dispatch</p>
            </div>
          </div>
          <p className="text-xs text-neutral-400 mt-1.5 font-medium">Region-01 · Active</p>
          <div className="mt-1.5 text-[10px] font-semibold px-2 py-0.5 rounded bg-neutral-900 text-neutral-400 inline-block">
            Sentinel Command · 2026 Interface
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 pt-3 overflow-y-auto space-y-1">
          <p className="text-xs font-bold tracking-wider text-neutral-400 px-1 pt-1 pb-1 uppercase">
            {pathname.startsWith("/super-admin") ? "Super Admin Governance" : "Navigation"}
          </p>
          {(pathname.startsWith("/super-admin") ? SUPER_ADMIN_NAV_ITEMS : NAV_ITEMS).map((item) => {
            const Icon = item.icon;
            let targetHref = item.href;
            if (!pathname.startsWith("/super-admin")) {
              if (item.id === "analytics") {
                const base = pathname.includes("/dashboard") ? "/dashboard" : "/admin";
                targetHref = `${base}?tab=analytics`;
              } else if (item.id === "settings") {
                const base = pathname.includes("/dashboard") ? "/dashboard" : "/admin";
                targetHref = `${base}?tab=settings`;
              } else if (item.id === "map") {
                targetHref = "/dashboard";
              }
            }

            const currentSearch = typeof window !== "undefined" ? window.location.search : "";
            const currentFull = pathname + currentSearch;
            const active = pathname.startsWith("/super-admin")
              ? (currentFull === targetHref || (targetHref === "/super-admin?tab=map" && (!currentSearch || currentSearch === "?tab=map")))
              : (pathname === targetHref || currentFull === targetHref);

            return (
              <button
                key={item.id}
                onClick={() => router.push(targetHref)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs md:text-sm font-semibold transition-all mb-0.5 relative ${
                  active
                    ? "bg-red-600 text-white shadow-lg shadow-red-900/30 font-bold"
                    : "text-neutral-300 hover:text-white hover:bg-neutral-800/70"
                }`}
              >
                <Icon size={16} />
                <span>{item.label}</span>
                {item.id === "incidents" && liveIncidentCount !== null && liveIncidentCount > 0 && (
                  <span className="ml-auto text-xs font-bold bg-red-600 text-white rounded-full px-2 py-0.5 min-w-[20px] text-center">
                    {liveIncidentCount > 99 ? "99+" : liveIncidentCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Agency Filter */}
        <div className="px-3 pb-4 pt-3 border-t border-neutral-900">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs font-bold tracking-wider text-neutral-400 uppercase">Agency Filter</p>
            <button
              onClick={() => setAgencyFilter("all")}
              className={`text-xs font-bold px-2 py-0.5 rounded transition-colors ${agencyFilter === "all" ? "bg-neutral-700 text-white" : "text-neutral-400 hover:text-white"}`}
            >
              All
            </button>
          </div>
          <p className="text-xs text-neutral-400 mb-2">Unified view across services</p>
          {agencyList.map((a) => (
            <button
              key={a.key}
              onClick={() => setAgencyFilter(agencyFilter === a.key ? "all" : a.key)}
              className={`w-full flex items-center justify-between py-2 px-2 rounded-md transition-all group mb-1 ${
                agencyFilter === a.key ? "bg-neutral-800" : "hover:bg-neutral-900"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${a.dot}`} />
                <span className="text-xs font-semibold text-neutral-200 group-hover:text-white">{a.label}</span>
              </div>
              <span className={`text-xs font-bold ${a.color}`}>{a.count}</span>
            </button>
          ))}
        </div>
      </aside>

      {/* ═══════════════════  MAIN AREA  ═══════════════════ */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {isLocalTestApi && (
          <div
            className="px-4 py-1.5 bg-amber-950 border-b border-amber-700 text-amber-100 text-[10px] font-bold tracking-wide text-center"
            role="status"
          >
            TEST MODE — SYNTHETIC DATA ONLY · NO REAL DISPATCH, SMS, CALLS, OR CITIZEN MESSAGES
          </div>
        )}

        {/* Top Header */}
        <header className="h-[60px] min-h-[60px] flex items-center px-6 gap-4 border-b border-neutral-900 bg-[#0c0c0c]">
          {/* Title */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="text-base md:text-lg font-extrabold text-white truncate">{title}</h1>
              <span className="shrink-0 text-[10px] font-bold bg-neutral-800 text-neutral-400 px-2.5 py-1 rounded tracking-widest uppercase">
                2026 Interface
              </span>
            </div>
            {subtitle && (
              <p className="text-xs text-neutral-400 font-medium leading-none mt-1 truncate">{subtitle}</p>
            )}
          </div>

          {/* Search */}
          <div className="relative hidden md:block">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              placeholder="Search resources or ID..."
              className="bg-neutral-900 border border-neutral-800 rounded-md pl-9 pr-3 py-2 text-xs md:text-sm text-neutral-200 placeholder-neutral-500 w-52 focus:outline-none focus:border-neutral-600 transition-colors"
            />
          </div>

          {/* Region / Status badge */}
          <div className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 rounded-md px-3 py-2">
            {isOnline
              ? <Wifi size={14} className="text-green-500" />
              : <WifiOff size={14} className="text-red-500" />}
            <span className="text-xs font-semibold text-neutral-200">Accra · {isOnline ? "Live" : "Offline"}</span>
          </div>

          {/* GLOBAL DISPATCH MESSAGES INBOX BUTTON */}
          <button
            onClick={() => setShowInboxModal(true)}
            disabled={isLocalTestApi}
            className="relative flex items-center gap-1.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-white text-[11px] font-bold px-3 py-1.5 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title={isLocalTestApi ? "Messaging is not implemented in the local test API" : "Open Control Room Messages Inbox"}
          >
            <MessageSquare size={13} className="text-red-500" />
            <span>Messages</span>
            {unreadTotal > 0 && (
              <span className="ml-1 text-[9px] font-bold bg-red-600 text-white rounded-full px-1.5 py-0.5 animate-pulse">
                {unreadTotal}
              </span>
            )}
          </button>

          {/* Broadcast Alert button */}
          <button
            onClick={() => setShowBroadcast(true)}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-xs md:text-sm font-bold px-4 py-2 rounded-md transition-colors shadow-lg shadow-red-900/30"
          >
            <Radio size={14} className="animate-pulse" />
            Broadcast Alert
          </button>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-hidden">
          {children}
        </main>
      </div>

      {/* ═══════════════════  GLOBAL DISPATCH MESSAGES INBOX MODAL  ═══════════════════ */}
      {showInboxModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-6">
          <div className="bg-[#111] border border-neutral-800 rounded-2xl shadow-2xl w-[920px] h-[620px] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="px-5 py-3.5 border-b border-neutral-800 flex items-center justify-between bg-[#151515]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-red-600/20 border border-red-500/30 flex items-center justify-center text-red-500 font-bold">
                  <MessageSquare size={16} />
                </div>
                <div>
                  <h3 className="text-white font-bold text-sm leading-tight">Control Room Messaging Hub</h3>
                  <p className="text-[10px] text-neutral-500">Live two-way citizen & dispatch communications</p>
                </div>
              </div>
              <button onClick={() => setShowInboxModal(false)} className="p-1.5 rounded-lg bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800 transition-colors">
                <X size={16} />
              </button>
            </div>

            {/* Modal Body — 2 Panel Layout */}
            <div className="flex-1 flex min-h-0">
              {/* Left Panel: Active Citizen Threads List */}
              <div className="w-[300px] border-r border-neutral-800 bg-[#121212] flex flex-col">
                <div className="p-3 border-b border-neutral-800">
                  <p className="text-[9px] font-bold tracking-widest text-neutral-500 uppercase">Active Conversations</p>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                  {Object.keys(MOCK_NAMES).map((cid) => {
                    const cName = MOCK_NAMES[cid];
                    const thread = threads.find(t => t.citizen_id === cid);
                    const isSelected = selectedCitizenId === cid;
                    const lastMsg = thread?.last_message;
                    const owner = thread?.thread_owner;
                    return (
                      <button
                        key={cid}
                        onClick={() => setSelectedCitizenId(cid)}
                        className={`w-full text-left p-3 rounded-xl transition-all flex items-start gap-3 ${
                          isSelected ? "bg-red-600/15 border border-red-500/30 text-white" : "hover:bg-neutral-800/60 text-neutral-400 border border-transparent"
                        }`}
                      >
                        <div className="w-9 h-9 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center font-bold text-xs text-white shrink-0">
                          {cName.split(" ").map(w => w[0]).slice(0, 2).join("")}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="text-[12px] font-bold text-white truncate">{cName}</p>
                            <span className="text-[9px] text-neutral-500">{lastMsg?.time || "Active"}</span>
                          </div>
                          <p className="text-[10px] text-neutral-400 truncate mt-0.5">
                            {lastMsg ? (lastMsg.is_deleted ? "This message was deleted" : lastMsg.text || "Media attached") : "No messages yet"}
                          </p>
                          <div className="mt-1 flex items-center gap-1">
                            {owner ? (
                              <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
                                Assigned: {owner.operator_name?.split(" ")[1] || owner.operator_name || "Operator"}
                              </span>
                            ) : (
                              <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                UNASSIGNED
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Right Panel: Chat Thread Window */}
              <div className="flex-1 flex flex-col bg-[#0a0a0a]">
                {/* Thread Header */}
                <div className="px-4 py-3 border-b border-neutral-800 bg-[#121212] flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center font-bold text-xs text-white">
                      {(MOCK_NAMES[selectedCitizenId] || selectedCitizenId).split(" ").map(w => w[0]).slice(0, 2).join("")}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-white font-bold text-xs">{MOCK_NAMES[selectedCitizenId] || selectedCitizenId}</p>
                        {activeThreadOwner ? (
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
                            Assigned to: {activeThreadOwner.operator_name} ({activeThreadOwner.agency || "Dispatch"})
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse">
                            UNASSIGNED
                          </span>
                        )}
                      </div>
                      <p className="text-[9px] text-green-400 font-semibold">Online · Citizen Direct Line</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleClaimThread}
                      className="text-[10px] font-bold text-white bg-red-600 hover:bg-red-500 px-3 py-1 rounded-lg transition-colors shadow-md shadow-red-900/30"
                    >
                      {activeThreadOwner ? "Reassign to Me" : "Claim Thread"}
                    </button>
                    <button
                      onClick={() => router.push(`/citizen?id=${selectedCitizenId}`)}
                      className="text-[10px] font-bold text-neutral-400 hover:text-white bg-neutral-900 border border-neutral-800 px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors"
                    >
                      Profile <ChevronRight size={11} />
                    </button>
                  </div>
                </div>

                {/* Messages List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 flex flex-col">
                  {activeMsgs.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center">
                      <p className="text-neutral-600 text-xs text-center">No messages in thread yet. Type a message below to start.</p>
                    </div>
                  ) : (
                    activeMsgs.map((m: any, i: number) => (
                      <div key={m.id || i} className={`group relative flex flex-col max-w-[80%] ${m.sender === "operator" ? "ml-auto items-end" : "mr-auto items-start"}`}>
                        {m.sender === "operator" && (
                          <span className="text-[8px] font-bold text-red-400 mb-0.5">
                            {m.operator_name || "Dispatcher Sarah M."} {m.operator_badge ? `(${m.operator_badge})` : ""}
                          </span>
                        )}
                        <div className={`p-3 rounded-2xl text-[12px] leading-relaxed shadow-sm ${m.is_deleted ? "bg-neutral-900 border border-neutral-800 text-neutral-500 italic" : m.sender === "operator" ? "bg-red-600 text-white rounded-br-none" : "bg-neutral-800 text-neutral-200 rounded-bl-none"}`}>
                          {m.is_deleted ? (
                            <span className="flex items-center gap-1.5"><Ban size={12} /> This message was deleted</span>
                          ) : (
                            <>
                              {m.media_url && (
                                <div className="mb-2 rounded-lg overflow-hidden border border-white/10">
                                  {m.type === 'video' ? (
                                    <video src={m.media_url} controls className="max-h-48 w-full object-cover" />
                                  ) : (
                                    <img src={m.media_url} alt="" className="max-h-48 w-full object-cover" onError={(e) => (e.target as HTMLElement).style.display = 'none'} />
                                  )}
                                </div>
                              )}
                              {m.text && <p className="break-words">{m.text}</p>}
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="text-[9px] text-neutral-500">{m.time || 'Just now'}</span>
                          {!m.is_deleted && (
                            <button onClick={() => handleDeleteFromModal(m.id)} title="Delete Message" className="opacity-0 group-hover:opacity-100 text-neutral-500 hover:text-red-400 transition-opacity p-0.5">
                              <Trash2 size={11} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Optional Media URL input */}
                {showMediaPrompt && (
                  <div className="px-3 py-2 bg-[#141414] border-t border-neutral-800 flex items-center gap-2">
                    <input
                      value={mediaUrlInput}
                      onChange={e => setMediaUrlInput(e.target.value)}
                      placeholder="Paste Image/Video URL..."
                      className="flex-1 bg-[#111] border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
                    />
                    <button onClick={() => setShowMediaPrompt(false)} className="text-neutral-400 hover:text-white p-1"><X size={14} /></button>
                  </div>
                )}

                {/* Input Form */}
                <form onSubmit={handleSendFromModal} className="p-3 border-t border-neutral-800 bg-[#121212] flex gap-2 items-center">
                  <button
                    type="button"
                    onClick={() => setShowMediaPrompt(!showMediaPrompt)}
                    title="Attach Media URL"
                    className={`p-2 rounded-xl border border-neutral-800 transition-colors ${showMediaPrompt ? 'bg-red-500/20 text-red-400' : 'bg-[#181818] text-neutral-400 hover:text-white'}`}
                  >
                    <ExternalLink size={14} />
                  </button>
                  <input
                    value={newMsgText}
                    onChange={e => setNewMsgText(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        (e.target as HTMLInputElement).form?.requestSubmit();
                      }
                    }}
                    placeholder="Type message to citizen... (Press Enter to send)"
                    className="flex-1 bg-[#181818] border border-neutral-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-red-500/50"
                  />
                  <button type="submit" className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 active:bg-red-700 text-white font-bold text-xs transition-colors flex items-center gap-1.5 shadow-md shadow-red-900/30">
                    <Send size={13} /> Send
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════  BROADCAST ALERT MODAL  ═══════════════════ */}
      {showBroadcast && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-[#111] border border-neutral-800 rounded-xl shadow-2xl w-[480px] fade-in">
            <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800">
              <div className="flex items-center gap-2">
                <Radio size={16} className="text-red-500 animate-pulse" />
                <div>
                  <p className="text-[10px] font-bold tracking-widest text-red-500 uppercase">Emergency Broadcast</p>
                  <p className="text-xs text-neutral-400">Send to mobile app + SMS fallback</p>
                </div>
              </div>
              <button onClick={() => setShowBroadcast(false)} className="text-neutral-500 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleBroadcast} className="p-5 space-y-4">
              {sentOk && (
                <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 text-sm text-green-400 flex items-center gap-2">
                  <Bell size={14} /> Alert broadcast successfully transmitted!
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold tracking-widest text-neutral-500 uppercase">Message</label>
                <textarea
                  rows={3}
                  value={broadcastMsg}
                  onChange={(e) => setBroadcastMsg(e.target.value)}
                  placeholder="e.g. Evacuate to the nearest safe zone. Keep GPS sharing enabled."
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2.5 text-sm text-white placeholder-neutral-600 resize-none focus:outline-none focus:border-red-600/50 transition-colors"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold tracking-widest text-neutral-500 uppercase">Target Zone</label>
                <select
                  value={broadcastZone}
                  onChange={(e) => setBroadcastZone(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-neutral-600"
                >
                  <option>All citizens in Accra Metro</option>
                  <option>All citizens in zone A</option>
                  <option>All citizens in zone B</option>
                  <option>All citizens in zone C</option>
                  <option>Emergency contacts only</option>
                </select>
              </div>

              <div className="flex items-center justify-between text-[10px] text-neutral-500 bg-neutral-900 rounded-lg px-3 py-2">
                <span>Delivery method</span>
                <span className="text-neutral-300 font-medium">Push + SMS fallback</span>
              </div>

              <button
                type="submit"
                disabled={isSending || !broadcastMsg.trim()}
                className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold text-sm py-3 rounded-lg transition-colors shadow-lg shadow-red-900/30"
              >
                <Send size={14} />
                {isSending ? "Transmitting..." : "Send to App"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════════  OPERATOR PROFILE MODAL  ═══════════════════ */}
      {showOperatorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md animate-in fade-in zoom-in duration-200">
          <div className="bg-[#141414] border border-white/10 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 bg-black/40 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <img src="/eaws-logo.png" alt="EAWS" className="w-8 h-8 rounded-xl object-contain shadow" />
                <div>
                  <h3 className="text-white font-bold text-[13px] leading-snug">Operator Profile</h3>
                  <p className="text-neutral-500 text-[10px] font-mono">Sentinel Command ID: OP-ACC-8492</p>
                </div>
              </div>
              <button
                onClick={() => setShowOperatorModal(false)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X size={15} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Operator Identity Card */}
              <div className="flex items-center gap-3.5 p-3.5 bg-neutral-900/80 border border-white/5 rounded-xl">
                <div className="w-12 h-12 rounded-full bg-red-600 border-2 border-red-500/50 flex items-center justify-center font-black text-white text-base shadow-lg shadow-red-900/40 shrink-0">
                  OP
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-white font-bold text-sm">Staff Operator</p>
                    <span className="text-[9px] font-bold bg-green-500/20 text-green-400 border border-green-500/30 px-2 py-0.5 rounded-full">
                      ON DUTY
                    </span>
                  </div>
                  <p className="text-neutral-400 text-xs mt-0.5">Accra Regional Dispatch Centre</p>
                  <p className="text-neutral-500 font-mono text-[10px]">Clearance Level 4 · Inter-Agency Lead</p>
                </div>
              </div>

              {/* Station & Access Info */}
              <div className="grid grid-cols-2 gap-2.5 text-[11px]">
                <div className="p-3 bg-neutral-950 border border-white/5 rounded-xl">
                  <p className="text-neutral-500 text-[9px] font-bold tracking-wider uppercase mb-1">Station Desk</p>
                  <p className="text-white font-bold font-mono">DESK-ACCRA-04</p>
                  <p className="text-neutral-500 text-[9px] mt-0.5">HQ Control Room</p>
                </div>
                <div className="p-3 bg-neutral-950 border border-white/5 rounded-xl">
                  <p className="text-neutral-500 text-[9px] font-bold tracking-wider uppercase mb-1">Radio Sector</p>
                  <p className="text-red-400 font-bold font-mono">SECTOR-METRO-1</p>
                  <p className="text-neutral-500 text-[9px] mt-0.5">Encrypted Live Link</p>
                </div>
              </div>

              {/* Session Details */}
              <div className="p-3 bg-neutral-950 border border-white/5 rounded-xl space-y-1.5 text-[11px]">
                <div className="flex justify-between items-center text-neutral-400">
                  <span>Duty Session</span>
                  <span className="text-green-400 font-mono font-bold">Active · Authenticated</span>
                </div>
                <div className="flex justify-between items-center text-neutral-400">
                  <span>Routing Authorities</span>
                  <span className="text-neutral-200 font-medium">Fire · Police · Ambulance · NADMO</span>
                </div>
                <div className="flex justify-between items-center text-neutral-400">
                  <span>Audit Trail</span>
                  <span className="text-neutral-300 font-mono">Immutable Ledger Enabled</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2.5 pt-1">
                <button
                  onClick={() => {
                    setShowOperatorModal(false);
                    router.push("/admin?tab=settings");
                  }}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-white/10 text-white font-bold text-xs transition-colors text-center"
                >
                  System Settings
                </button>
                <button
                  onClick={handleLogout}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs transition-all flex items-center justify-center gap-1.5 shadow-md shadow-red-900/40"
                >
                  <LogOut size={13} />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

