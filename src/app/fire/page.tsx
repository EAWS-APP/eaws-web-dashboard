"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, useCallback } from "react";
import { CheckCircle, AlertTriangle, Radio, Send, Wifi, MapPin, Clock } from "lucide-react";
import { eawsApi } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import type { Incident } from "@/lib/models";
import SentinelShell from "@/components/SentinelShell";

const LiveMap = dynamic(() => import("@/components/Map"), {
  ssr: false,
  loading: () => <div className="w-full h-full flex items-center justify-center bg-neutral-950 text-neutral-500 text-xs animate-pulse">Loading map...</div>,
});

type FeedFilter = "All" | "Verified" | "Pending" | "Escalated";

const MEDIA_THUMB: Record<string, string> = {
  smoke: "https://images.unsplash.com/photo-1542393545-10f5cde2c810?w=120&q=60",
  road:  "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=120&q=60",
  breach:"https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=120&q=60",
};

const FALLBACK_POSTS: (Incident & { thumb?: string })[] = [
  { id: "c1", category: "FIRE", severity: "CRITICAL", status: "pending", title: "Smoke detected near industrial park", description: "Heavy smoke rising from eastern factory district. Residents evacuating.", is_anonymous: false, location_name: "East Legon", latitude: 5.635, longitude: -0.155, likes_count: 12, comments_count: 3, created_at: new Date(Date.now() - 2 * 60000).toISOString(), thumb: MEDIA_THUMB.smoke },
  { id: "c2", category: "DISASTER", severity: "WARNING", status: "verified", title: "Road blockage on HWY-101", description: "Multi-vehicle accident blocking all lanes. Emergency services en route.", is_anonymous: false, location_name: "Osu", latitude: 5.556, longitude: -0.173, likes_count: 28, comments_count: 7, created_at: new Date(Date.now() - 15 * 60000).toISOString(), thumb: MEDIA_THUMB.road },
  { id: "c3", category: "CRIME", severity: "CRITICAL", status: "escalated", title: "Perimeter breach active", description: "Unauthorized entry at airport perimeter sector C. Security responding.", is_anonymous: false, location_name: "Airport Perimeter", latitude: 5.605, longitude: -0.165, likes_count: 5, comments_count: 2, created_at: new Date(Date.now() - 8 * 60000).toISOString(), thumb: MEDIA_THUMB.breach },
];

function timeAgo(iso: string) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  return m < 1 ? "just now" : m < 60 ? `${m}m ago` : `${Math.round(m / 60)}h ago`;
}

export default function CommunityPage() {
  const [posts, setPosts] = useState<(Incident & { thumb?: string })[]>(FALLBACK_POSTS);
  const [filter, setFilter] = useState<FeedFilter>("All");
  const [isFeedLoading, setIsFeedLoading] = useState(false);

  // Broadcast Composer state
  const [broadcastMsg, setBroadcastMsg] = useState("Evacuate to the nearest safe zone. Keep GPS sharing enabled.");
  const [broadcastZone, setBroadcastZone] = useState("All citizens in zone A");
  const [deliveryMethod, setDeliveryMethod] = useState("Push + SMS fallback");
  const [isSending, setIsSending] = useState(false);
  const [sentOk, setSentOk] = useState(false);

  // Moderation state
  const [moderationQueue, setModerationQueue] = useState([
    { id: "m1", title: "Smoke report", status: "Pending" },
    { id: "m2", title: "Road blockage", status: "Verified" },
    { id: "m3", title: "Perimeter breach", status: "Escalated" },
  ]);

  const loadFeed = useCallback(async () => {
    setIsFeedLoading(true);
    try {
      const data = await eawsApi.getIncidentFeed();
      if (data?.length) {
        setPosts(data.slice(0, 8).map((inc) => ({
          ...inc,
          thumb: inc.incident_media?.[0]?.file_url,
        })));
      }
    } catch { /* use fallback */ } finally {
      setIsFeedLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFeed();
    const iv = setInterval(loadFeed, 12000);
    const ch = supabase
      .channel("community-feed")
      .on("postgres_changes" as any, { event: "INSERT", schema: "public", table: "incidents" }, loadFeed)
      .subscribe();
    return () => { clearInterval(iv); supabase.removeChannel(ch); };
  }, [loadFeed]);

  const filtered = filter === "All" ? posts : posts.filter((p) => {
    if (filter === "Verified") return p.status === "verified";
    if (filter === "Pending") return p.status === "pending";
    if (filter === "Escalated") return p.status === "escalated";
    return true;
  });

  async function handleVerify(id: string) {
    try {
      await eawsApi.updateIncident(id, { status: "verified", is_verified: true });
      setPosts((prev) => prev.map((p) => p.id === id ? { ...p, status: "verified" } : p));
    } catch { /* noop */ }
  }

  async function handleEscalate(id: string) {
    try {
      await eawsApi.escalateIncident(id, "Escalated by operator");
      setPosts((prev) => prev.map((p) => p.id === id ? { ...p, status: "escalated" } : p));
    } catch { /* noop */ }
  }

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
      setTimeout(() => setSentOk(false), 3000);
    } catch { /* noop */ } finally {
      setIsSending(false);
    }
  }

  const STATUS_BADGE: Record<string, string> = {
    pending: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
    verified: "text-green-400 bg-green-500/10 border-green-500/20",
    escalated: "text-red-400 bg-red-500/10 border-red-500/20",
  };

  return (
    <SentinelShell title="Sentinel Command" subtitle="Monitor citizen signals, coordinate dispatch, and broadcast updates back to the app.">
      <div className="h-full flex overflow-hidden bg-[#090909]">

        {/* LEFT: Community Hazard Feed */}
        <div className="w-[280px] min-w-[280px] border-r border-neutral-900 bg-[#0e0e0e] flex flex-col overflow-hidden">
          <div className="px-4 pt-4 pb-2 border-b border-neutral-900 shrink-0">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-[10px] font-bold tracking-widest text-neutral-400 uppercase">Community Hazard Feed</p>
                <p className="text-[9px] text-neutral-600">Live eye · verified media</p>
              </div>
              <span className="text-[8px] font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded animate-pulse">Live</span>
            </div>
            <div className="flex gap-1">
              {(["All", "Verified", "Pending", "Escalated"] as FeedFilter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`flex-1 text-[8px] font-bold py-1 rounded transition-colors ${filter === f ? "bg-neutral-700 text-white" : "text-neutral-500 hover:text-white hover:bg-neutral-800"}`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {filtered.map((post) => (
              <div key={post.id} className="border-b border-neutral-900 p-3">
                <div className="flex gap-2 mb-2">
                  {post.thumb ? (
                    <img src={post.thumb} alt="" className="w-14 h-10 rounded object-cover shrink-0 bg-neutral-800" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  ) : (
                    <div className="w-14 h-10 rounded bg-neutral-800 shrink-0 flex items-center justify-center text-lg">{post.category === "FIRE" ? "🔥" : post.category === "CRIME" ? "🔒" : "⚠️"}</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold text-white leading-tight truncate">{post.title}</p>
                    <p className="text-[8px] text-neutral-500 mt-0.5 flex items-center gap-1">
                      <Clock size={7} /> {timeAgo(post.created_at)} · {post.location_name}
                    </p>
                    <span className={`inline-block mt-1 text-[7px] font-bold border rounded px-1.5 py-0.5 capitalize ${STATUS_BADGE[post.status] || "text-neutral-400 bg-neutral-800 border-neutral-700"}`}>
                      {post.status}
                    </span>
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <button onClick={() => handleVerify(post.id)} className="flex-1 text-[8px] font-bold py-1.5 rounded bg-green-600 hover:bg-green-700 text-white transition-colors">Verify</button>
                  <button onClick={() => handleEscalate(post.id)} className="flex-1 text-[8px] font-bold py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors leading-tight">Escalate to Incident</button>
                  <button className="flex-1 text-[8px] font-bold py-1.5 rounded bg-red-600 hover:bg-red-700 text-white transition-colors">Broadcast</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CENTER: Map + Broadcast Composer overlay */}
        <div className="flex-1 relative">
          <LiveMap incidents={posts as any} units={[]} />

          {/* Broadcast Composer overlay */}
          <div className="absolute bottom-4 left-4 right-4 bg-black/80 backdrop-blur-md border border-neutral-800 rounded-xl p-4 shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-[10px] font-bold text-white">Citizen Broadcast Composer</p>
                <p className="text-[9px] text-neutral-500">Send instructions back to the mobile app</p>
              </div>
              {sentOk && <span className="text-[9px] font-bold text-green-400">Ready to send ✓</span>}
            </div>

            <form onSubmit={handleBroadcast} className="space-y-2">
              <textarea
                value={broadcastMsg}
                onChange={(e) => setBroadcastMsg(e.target.value)}
                rows={2}
                className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-[11px] text-white placeholder-neutral-600 resize-none focus:outline-none focus:border-neutral-600"
              />
              <div className="flex gap-2">
                <select value={broadcastZone} onChange={(e) => setBroadcastZone(e.target.value)} className="flex-1 bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-1.5 text-[10px] text-neutral-300 focus:outline-none">
                  <option>All citizens in zone A</option>
                  <option>All citizens in zone B</option>
                  <option>All citizens in Accra Metro</option>
                  <option>Emergency contacts only</option>
                </select>
                <select value={deliveryMethod} onChange={(e) => setDeliveryMethod(e.target.value)} className="flex-1 bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-1.5 text-[10px] text-neutral-300 focus:outline-none">
                  <option>Push + SMS fallback</option>
                  <option>Push notification only</option>
                  <option>SMS only</option>
                </select>
              </div>
              <button type="submit" disabled={isSending} className="w-full py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                <Send size={12} />
                {isSending ? "Transmitting..." : sentOk ? "Sent Successfully!" : "Send to App"}
              </button>
            </form>
          </div>

          {/* Map label */}
          <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/70 backdrop-blur-sm border border-neutral-800 rounded-full px-3 py-1.5">
            <span className="text-[8px] font-bold text-neutral-300">Accra Metro · Live Feed</span>
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          </div>
        </div>

        {/* RIGHT: Moderation Queue + System Health */}
        <div className="w-[240px] min-w-[240px] border-l border-neutral-900 bg-[#0e0e0e] flex flex-col overflow-y-auto">
          {/* Moderation Queue */}
          <div className="px-4 pt-4 pb-2 border-b border-neutral-900">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-bold tracking-widest text-neutral-400 uppercase">Moderation Queue</p>
              <span className="text-[9px] font-bold text-neutral-500 bg-neutral-800 border border-neutral-700 rounded px-1.5 py-0.5">{moderationQueue.length} items</span>
            </div>
            <div className="space-y-2">
              {moderationQueue.map((item) => (
                <div key={item.id} className="flex items-center justify-between bg-neutral-900 rounded-lg p-2.5">
                  <p className="text-[10px] font-semibold text-white">{item.title}</p>
                  <div className="flex gap-1 ml-2 shrink-0">
                    {item.status === "Pending" && (
                      <>
                        <button onClick={() => setModerationQueue(q => q.map(i => i.id === item.id ? {...i, status: "Verified"} : i))} className="text-[8px] font-bold bg-green-600 hover:bg-green-700 text-white px-1.5 py-0.5 rounded transition-colors">Verify</button>
                        <button className="text-[8px] font-bold bg-neutral-700 hover:bg-neutral-600 text-white px-1.5 py-0.5 rounded transition-colors">Escalate</button>
                      </>
                    )}
                    {item.status === "Verified" && (
                      <>
                        <button className="text-[8px] font-bold bg-red-600 hover:bg-red-700 text-white px-1.5 py-0.5 rounded transition-colors">Broadcast</button>
                        <button className="text-[8px] font-bold bg-neutral-700 hover:bg-neutral-600 text-white px-1.5 py-0.5 rounded transition-colors">Incident</button>
                      </>
                    )}
                    {item.status === "Escalated" && (
                      <>
                        <button className="text-[8px] font-bold bg-red-600 hover:bg-red-700 text-white px-1.5 py-0.5 rounded transition-colors">Broadcast</button>
                        <button className="text-[8px] font-bold bg-blue-600 hover:bg-blue-700 text-white px-1.5 py-0.5 rounded transition-colors">Dispatch</button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* System Health */}
          <div className="px-4 py-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-bold tracking-widest text-neutral-400 uppercase">System Health</p>
              <span className="text-[9px] font-bold text-green-400 bg-green-500/10 border border-green-500/20 px-1.5 py-0.5 rounded">Stable</span>
            </div>
            <div className="space-y-3 text-[10px]">
              {[
                { label: "App connectivity", value: "98%", pct: 98, color: "bg-red-500" },
                { label: "Location accuracy", value: "±3m", pct: 95, color: "bg-blue-500" },
              ].map((h) => (
                <div key={h.label}>
                  <div className="flex justify-between mb-1"><span className="text-neutral-400">{h.label}</span><span className="text-neutral-300 font-mono font-bold">{h.value}</span></div>
                  <div className="h-1 rounded-full bg-neutral-800"><div className={`h-1 rounded-full ${h.color}`} style={{ width: `${h.pct}%` }} /></div>
                </div>
              ))}
              <div className="flex justify-between pt-1 border-t border-neutral-900">
                <span className="text-neutral-400">SMS fallback</span>
                <span className="text-green-400 font-bold">Active</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </SentinelShell>
  );
}
