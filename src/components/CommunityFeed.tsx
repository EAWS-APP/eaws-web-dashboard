"use client";

import { useEffect, useState } from "react";
import { 
  Heart, 
  MessageSquare, 
  MapPin, 
  Clock, 
  Send, 
  AlertTriangle, 
  Check, 
  Plus, 
  X,
  Radio,
  UserCheck,
  Shield,
  Activity,
  Flame,
  User,
  Search,
  CheckCircle,
  HelpCircle
} from "lucide-react";
import { eawsApi } from "@/lib/api";
import type { Incident } from "@/lib/models";

// Define a type that extends Incident with the optional reporter_profile
type CommunityIncident = Incident & {
  reporter_profile?: {
    full_name: string;
    user_role: string;
    operator_code?: string;
  } | null;
  likes?: number;
  isLiked?: boolean;
};

type CommunityFeedProps = {
  userRole?: string;
  userProfile?: {
    full_name: string;
    operator_code?: string;
  } | null;
};

export default function CommunityFeed({ userRole = "operator", userProfile = null }: CommunityFeedProps) {
  const [incidents, setIncidents] = useState<CommunityIncident[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  
  // Post Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState("MEDICAL");
  const [newSeverity, setNewSeverity] = useState("MEDIUM");
  const [newLocation, setNewLocation] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Comments Drawer/Modal State
  const [activeCommentsIncidentId, setActiveCommentsIncidentId] = useState<string | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [newCommentText, setNewCommentText] = useState("");
  const [isLoadingComments, setIsLoadingComments] = useState(false);

  const categories = ["All", "Medical", "Fire", "Crime", "Accident", "Flood", "Other"];

  async function loadFeed() {
    setIsLoading(true);
    try {
      // Fetch feed from backend
      const data = await eawsApi.getIncidentFeed();
      // Ensure likes / isLiked fields exist for local state
      const processed: CommunityIncident[] = (data || []).map((inc: any) => ({
        ...inc,
        likes: inc.likes_count ?? 0,
        isLiked: false, // Default local like state
      }));
      setIncidents(processed);
      setError(null);
    } catch (err: any) {
      console.error("Failed to load community feed:", err);
      setError("Unable to connect to live community feed.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadFeed();
    const interval = setInterval(loadFeed, 10000);
    return () => clearInterval(interval);
  }, []);

  // Handle Like/Reaction
  async function handleLike(incidentId: string) {
    try {
      await eawsApi.reactToIncident(incidentId, "like");
      
      // Update local state
      setIncidents(prev => 
        prev.map(inc => {
          if (inc.id === incidentId) {
            const alreadyLiked = inc.isLiked;
            return {
              ...inc,
              isLiked: !alreadyLiked,
              likes: (inc.likes ?? 0) + (alreadyLiked ? -1 : 1)
            };
          }
          return inc;
        })
      );
    } catch (err: any) {
      console.error("Failed to register like:", err);
    }
  }

  // Fetch comments for chosen incident
  async function openComments(incidentId: string) {
    setActiveCommentsIncidentId(incidentId);
    setIsLoadingComments(true);
    try {
      const data = await eawsApi.getComments(incidentId);
      setComments(data || []);
    } catch (err: any) {
      console.error("Failed to load comments:", err);
    } finally {
      setIsLoadingComments(false);
    }
  }

  // Submit comment
  async function handleCommentSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!activeCommentsIncidentId || !newCommentText.trim()) return;
    try {
      const newComment = await eawsApi.addComment(activeCommentsIncidentId, newCommentText.trim());
      // Append commenter's profile details locally
      const withProfile = {
        ...newComment,
        user_profile: {
          full_name: userProfile?.full_name || "Official Operator",
          user_role: userRole,
          operator_code: userProfile?.operator_code
        }
      };
      setComments(prev => [...prev, withProfile]);
      setNewCommentText("");
      
      // Update comments count locally
      setIncidents(prev =>
        prev.map(inc => {
          if (inc.id === activeCommentsIncidentId) {
            return {
              ...inc,
              comments_count: (inc.comments_count ?? 0) + 1
            };
          }
          return inc;
        })
      );
    } catch (err: any) {
      console.error("Failed to add comment:", err);
    }
  }

  // Create post
  async function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim() || !newLocation.trim() || !newDescription.trim()) {
      alert("Please fill out all fields.");
      return;
    }
    setIsSubmitting(true);
    try {
      await eawsApi.createIncident({
        title: newTitle.trim(),
        category: newCategory.toUpperCase(),
        severity: newSeverity,
        description: newDescription.trim(),
        location_name: newLocation.trim(),
        latitude: 5.6037 + (Math.random() - 0.5) * 0.04, // Mock GPS centered in Accra
        longitude: -0.1870 + (Math.random() - 0.5) * 0.04,
      });

      setShowCreateModal(false);
      setNewTitle("");
      setNewLocation("");
      setNewDescription("");
      
      // Reload feed to show new post
      await loadFeed();
    } catch (err: any) {
      alert("Failed to submit post: " + (err.message || err));
    } finally {
      setIsSubmitting(false);
    }
  }

  // Render role badge helper
  function renderRoleBadge(role?: string) {
    if (!role || role === "citizen") return null;
    
    switch (role) {
      case "police":
        return (
          <span className="inline-flex items-center gap-1 rounded bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 text-[10px] font-bold text-blue-400">
            👮 Official Police
          </span>
        );
      case "ambulance":
        return (
          <span className="inline-flex items-center gap-1 rounded bg-red-500/10 border border-red-500/20 px-2 py-0.5 text-[10px] font-bold text-red-400">
            🚑 Medical Crew
          </span>
        );
      case "fire":
        return (
          <span className="inline-flex items-center gap-1 rounded bg-orange-500/10 border border-orange-500/20 px-2 py-0.5 text-[10px] font-bold text-orange-400">
            🔥 Fire Service
          </span>
        );
      case "dispatcher":
        return (
          <span className="inline-flex items-center gap-1 rounded bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 text-[10px] font-bold text-purple-400">
            📡 Dispatcher
          </span>
        );
      case "admin":
      case "super_admin":
        return (
          <span className="inline-flex items-center gap-1 rounded bg-yellow-500/10 border border-yellow-500/20 px-2 py-0.5 text-[10px] font-bold text-yellow-400">
            🛡️ Admin Control
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded bg-neutral-800 px-2 py-0.5 text-[10px] font-bold text-neutral-400">
            🚨 Responder
          </span>
        );
    }
  }

  // Filter incidents locally based on search query & category selection
  const filtered = incidents.filter(inc => {
    const matchesSearch = 
      inc.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (inc.description ?? "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (inc.location_name ?? "").toLowerCase().includes(searchQuery.toLowerCase());
      
    if (selectedCategory === "All") return matchesSearch;
    return matchesSearch && inc.category.toLowerCase() === selectedCategory.toLowerCase();
  });

  return (
    <div className="space-y-6">
      {/* Search & Actions Header Card */}
      <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex-1 max-w-md relative">
          <Search className="absolute left-3.5 top-3 text-neutral-500" size={17} />
          <input
            type="text"
            placeholder="Search community posts, tags or reports..."
            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg pl-10 pr-4 py-2.5 text-sm text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-neutral-700"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button 
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 bg-neutral-100 hover:bg-white text-neutral-950 font-bold px-4 py-2.5 rounded-lg text-sm transition active:scale-[0.98]"
          >
            <Plus size={16} />
            Create Official Post
          </button>
        </div>
      </div>

      {/* Category Chips Bar */}
      <div className="flex flex-wrap gap-2 overflow-x-auto pb-1.5 border-b border-neutral-900">
        {categories.map(cat => {
          const isSelected = selectedCategory === cat;
          return (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                isSelected 
                  ? "bg-neutral-100 text-neutral-950 border-neutral-100" 
                  : "bg-neutral-950 text-neutral-400 border-neutral-800 hover:text-neutral-200"
              }`}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* Feed List */}
      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-center text-sm text-red-400">
          {error}
        </div>
      )}

      {isLoading && incidents.length === 0 ? (
        <div className="py-12 text-center text-neutral-500 text-sm">
          Loading live feed alerts...
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center text-neutral-500 text-sm">
          No announcements or reports match your filters.
        </div>
      ) : (
        <div className="space-y-4 max-w-3xl">
          {filtered.map(inc => {
            const isCritical = inc.severity === "CRITICAL";
            const dateStr = new Date(inc.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            
            return (
              <div 
                key={inc.id}
                className={`rounded-lg border bg-neutral-900 shadow-lg relative overflow-hidden transition ${
                  isCritical ? "border-red-500/20" : "border-neutral-800"
                }`}
              >
                {/* Visual strip indicators */}
                <div className={`absolute top-0 inset-x-0 h-1 ${
                  isCritical ? "bg-red-500" : "bg-neutral-800"
                }`} />

                <div className="p-5 space-y-4">
                  {/* Top line header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-neutral-950 border border-neutral-850 flex items-center justify-center font-bold text-neutral-300 text-sm uppercase">
                        {inc.reporter_profile?.full_name?.substring(0,2) || "CI"}
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-white text-sm">
                            {inc.reporter_profile?.full_name || "Citizen Reporter"}
                          </span>
                          {renderRoleBadge(inc.reporter_profile?.user_role)}
                        </div>
                        <p className="text-[10px] text-neutral-500 mt-0.5 flex items-center gap-1 font-mono">
                          <Clock size={11} />
                          {dateStr} · {new Date(inc.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`text-[9px] font-extrabold tracking-wider px-2 py-0.5 rounded border uppercase ${
                        isCritical 
                          ? "bg-red-500/10 text-red-400 border-red-500/20 animate-pulse" 
                          : "bg-neutral-950 text-neutral-400 border-neutral-800"
                      }`}>
                        {inc.category}
                      </span>
                      
                      {!inc.is_verified ? (
                        <span className="text-[9px] font-bold text-yellow-500 bg-yellow-500/10 border border-yellow-500/20 px-2 py-0.5 rounded uppercase">
                          Unverified
                        </span>
                      ) : (
                        <span className="text-[9px] font-bold text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded uppercase flex items-center gap-0.5">
                          <Check size={9} />
                          Verified
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Body Title and Description */}
                  <div>
                    <h3 className="font-bold text-white text-base leading-snug">{inc.title}</h3>
                    <p className="mt-2 text-sm text-neutral-300 leading-relaxed whitespace-pre-line">{inc.description}</p>
                  </div>

                  {/* Location Pin */}
                  <div className="flex items-center gap-1.5 text-xs text-neutral-400 font-mono">
                    <MapPin size={13} className="text-neutral-500" />
                    <span>{inc.location_name}</span>
                  </div>

                  {/* Footer actions bar */}
                  <div className="flex items-center gap-4 pt-3.5 border-t border-neutral-850">
                    <button
                      onClick={() => handleLike(inc.id)}
                      className={`flex items-center gap-1.5 text-xs font-bold transition ${
                        inc.isLiked 
                          ? "text-red-500" 
                          : "text-neutral-400 hover:text-red-400"
                      }`}
                    >
                      <Heart size={15} fill={inc.isLiked ? "currentColor" : "none"} />
                      <span>{inc.likes} Likes</span>
                    </button>

                    <button
                      onClick={() => openComments(inc.id)}
                      className="flex items-center gap-1.5 text-xs font-bold text-neutral-400 hover:text-white transition"
                    >
                      <MessageSquare size={15} />
                      <span>{inc.comments_count ?? 0} Comments</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* COMMENTS MODAL / DRAWER */}
      {activeCommentsIncidentId && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden shadow-2xl flex flex-col max-h-[500px]">
            <div className="px-5 py-4 border-b border-neutral-850 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-white text-sm">Post Comments</h4>
                <p className="text-xs text-neutral-500">Live responses feed</p>
              </div>
              <button 
                onClick={() => setActiveCommentsIncidentId(null)}
                className="p-1 rounded bg-neutral-950 border border-neutral-800 text-neutral-400 hover:text-white"
              >
                <X size={15} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {isLoadingComments ? (
                <div className="text-center py-6 text-xs text-neutral-500">Loading replies...</div>
              ) : comments.length === 0 ? (
                <div className="text-center py-6 text-xs text-neutral-500">Be the first to leave a comment!</div>
              ) : (
                comments.map(c => (
                  <div key={c.id} className="space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">
                          {c.user_profile?.full_name || "Anonymous Responder"}
                        </span>
                        {renderRoleBadge(c.user_profile?.user_role)}
                      </div>
                      <span className="text-[10px] text-neutral-500 font-mono">
                        {new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-neutral-300 leading-relaxed bg-neutral-950 border border-neutral-850 p-2.5 rounded-lg">
                      {c.content}
                    </p>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handleCommentSubmit} className="p-4 border-t border-neutral-850 bg-neutral-950 flex gap-2">
              <input
                type="text"
                placeholder="Write your response..."
                required
                className="flex-1 bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-100 focus:outline-none focus:border-neutral-700"
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
              />
              <button
                type="submit"
                className="bg-neutral-100 hover:bg-white text-neutral-950 font-bold px-3 py-2 rounded-lg text-xs transition"
              >
                <Send size={12} />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* CREATE OFFICIAL POST MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden shadow-2xl">
            <div className="px-5 py-4 border-b border-neutral-850 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-white text-sm">Create Official Community Post</h4>
                <p className="text-xs text-neutral-500">Will be broadcasted as an instantly verified report</p>
              </div>
              <button 
                onClick={() => setShowCreateModal(false)}
                className="p-1 rounded bg-neutral-950 border border-neutral-800 text-neutral-400 hover:text-white"
              >
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-5 space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-neutral-400 font-semibold">Post Title</label>
                <input
                  type="text"
                  placeholder="e.g. Liberation Road cleared after flash flood"
                  required
                  className="w-full px-3 py-2.5 bg-neutral-950 border border-neutral-800 rounded-lg text-white placeholder-neutral-600 focus:outline-none focus:border-neutral-700"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-neutral-400 font-semibold">Incident Category</label>
                  <select
                    className="w-full px-3 py-2.5 bg-neutral-950 border border-neutral-800 rounded-lg text-white focus:outline-none focus:border-neutral-700"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                  >
                    <option value="MEDICAL">Medical Emergency</option>
                    <option value="FIRE">Fire Alert</option>
                    <option value="CRIME">Crime/Theft</option>
                    <option value="ACCIDENT">Road Collision</option>
                    <option value="FLOOD">Flooding Alert</option>
                    <option value="OTHER">General Notice</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-neutral-400 font-semibold">Report Severity</label>
                  <select
                    className="w-full px-3 py-2.5 bg-neutral-950 border border-neutral-800 rounded-lg text-white focus:outline-none focus:border-neutral-700"
                    value={newSeverity}
                    onChange={(e) => setNewSeverity(e.target.value)}
                  >
                    <option value="LOW">Low (Information Only)</option>
                    <option value="MEDIUM">Medium (Caution Advised)</option>
                    <option value="WARNING">Warning (High Urgency)</option>
                    <option value="CRITICAL">Critical (Danger / Emergency)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-neutral-400 font-semibold">Target Location / Address</label>
                <input
                  type="text"
                  placeholder="e.g. Airport Residential Area"
                  required
                  className="w-full px-3 py-2.5 bg-neutral-950 border border-neutral-800 rounded-lg text-white placeholder-neutral-600 focus:outline-none focus:border-neutral-700"
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-neutral-400 font-semibold">Incident Details</label>
                <textarea
                  rows={4}
                  placeholder="Describe the incident, route status, action taken, etc..."
                  required
                  className="w-full px-3 py-2.5 bg-neutral-950 border border-neutral-800 rounded-lg text-white placeholder-neutral-600 focus:outline-none focus:border-neutral-700 resize-none"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-neutral-100 hover:bg-white text-neutral-950 font-bold py-3 rounded-lg transition flex items-center justify-center gap-1.5"
              >
                {isSubmitting ? "Broadcasting..." : "Broadcast Official Post"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
