"use client";

import { useRouter, usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import {
  ShieldAlert, Map, AlertTriangle, Truck, Users,
  BarChart3, Settings, Radio, Search, X, Send,
  Bell, Wifi, WifiOff,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

const NAV_ITEMS = [
  { id: "map",        label: "Live Map",      icon: Map,           href: "/dashboard" },
  { id: "incidents",  label: "Incidents",     icon: AlertTriangle, href: "/police" },
  { id: "fire",       label: "Fire Service",  icon: Radio,         href: "/fire" },
  { id: "ambulance",  label: "Ambulance",     icon: Truck,         href: "/ambulance" },
  { id: "community",  label: "Community",     icon: Users,         href: "/community" },
  { id: "analytics",  label: "Analytics",     icon: BarChart3,     href: "/admin?tab=analytics" },
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
}: {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [agencyFilter, setAgencyFilter] = useState<AgencyFilter>("all");
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [broadcastMsg, setBroadcastMsg] = useState("");
  const [broadcastZone, setBroadcastZone] = useState("All citizens in Accra Metro");
  const [isSending, setIsSending] = useState(false);
  const [sentOk, setSentOk] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [liveIncidentCount, setLiveIncidentCount] = useState<number | null>(null);

  /* ── Real-time connectivity status ── */
  useEffect(() => {
    const update = () => setIsOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);

  /* ── Live incident counter for sidebar badge ── */
  useEffect(() => {
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
    const channel = supabase
      .channel("shell-incident-count")
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "incidents" }, fetchCount)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

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

  function isActive(href: string) {
    const base = href.split("?")[0];
    return pathname === base;
  }

  const agencyList = [
    { key: "fire" as AgencyFilter,     label: "Fire Service",     count: 18, color: "text-orange-400", dot: "bg-orange-500" },
    { key: "police" as AgencyFilter,   label: "Police",           count: 24, color: "text-blue-400",   dot: "bg-blue-500"   },
    { key: "disaster" as AgencyFilter, label: "Disaster",         count: 9,  color: "text-purple-400", dot: "bg-purple-500" },
  ];

  return (
    <div className="flex h-screen w-screen overflow-hidden" style={{ background: "var(--sentinel-bg, #080808)" }}>

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
    </div>
  );
}
