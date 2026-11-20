"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ShieldAlert,
  MapPin,
  Radio,
  Clock,
  LogOut,
  Send,
  User,
  Heart,
  MessageSquare,
  AlertOctagon,
  Home,
  Rss,
  Info,
  CheckCircle,
  X
} from "lucide-react";
import { eawsApi } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import type { Incident } from "@/lib/models";

export default function CitizenAppPage() {
  const [activeTab, setActiveTab] = useState<'home' | 'feed' | 'profile'>('home');
  const [userProfile, setUserProfile] = useState<any>(null);
  const [feed, setFeed] = useState<Incident[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // SOS State
  const [sosCountdown, setSosCountdown] = useState<number | null>(null);
  const [sosTriggered, setSosTriggered] = useState(false);

  // Form States
  const [reportTitle, setReportTitle] = useState("");
  const [reportCategory, setReportCategory] = useState("MEDICAL");
  const [reportDescription, setReportDescription] = useState("");
  const [reportLocation, setReportLocation] = useState("Accra Mall Parking Area");
  const [showReportSheet, setShowReportSheet] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  async function loadMe() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch("http://127.0.0.1:5000/api/me", {
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUserProfile(data.profile);
      }
    } catch (error) {
      console.error("Failed to load user profile:", error);
    }
  }

  async function loadFeed() {
    try {
      const feedData = await eawsApi.getLiveIncidents();
      setFeed(feedData || []);
    } catch (error) {
      console.error("Failed to load alerts feed:", error);
    }
  }

  useEffect(() => {
    loadMe();
    loadFeed();
    const interval = setInterval(loadFeed, 10000);
    return () => clearInterval(interval);
  }, []);

  // SOS Countdown Timer effect
  useEffect(() => {
    if (sosCountdown === null) return;

    if (sosCountdown === 0) {
      triggerSOS();
      return;
    }

    const timer = setTimeout(() => {
      setSosCountdown(sosCountdown - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [sosCountdown]);

  function startSOSCountdown() {
    setSosTriggered(false);
    setSosCountdown(3);
  }

  function cancelSOS() {
    setSosCountdown(null);
  }

  async function triggerSOS() {
    setSosCountdown(null);
    setSosTriggered(true);
    try {
      await eawsApi.createSOS({
        latitude: 5.6037, // Default Accra Mall Area
        longitude: -0.1870,
        category: "MEDICAL",
        location_name: "Accra Central SOS Broadcast",
        description: "Citizen triggered emergency SOS broadcast from mobile client."
      });
      loadFeed();
      setTimeout(() => setSosTriggered(false), 5000);
    } catch (error) {
      alert("Failed to transmit SOS broadcast: " + error);
      setSosTriggered(false);
    }
  }

  async function handleReportSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reportTitle || !reportDescription || !reportLocation) {
      alert("Please fill in all report fields.");
      return;
    }
    setIsLoading(true);
    try {
      await eawsApi.createIncident({
        title: reportTitle,
        category: reportCategory,
        description: reportDescription,
        location_name: reportLocation,
        latitude: 5.60 + (Math.random() - 0.5) * 0.05,
        longitude: -0.18 + (Math.random() - 0.5) * 0.05,
        severity: "MEDIUM",
      });
      setSubmitSuccess(true);
      setReportTitle("");
      setReportDescription("");
      loadFeed();
      setTimeout(() => {
        setSubmitSuccess(false);
        setShowReportSheet(false);
      }, 2000);
    } catch (error: any) {
      alert("Report failed to submit: " + (error.message || error));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4 font-sans text-neutral-100 relative overflow-hidden">
      
      {/* Background radial blurs */}
      <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-red-600/5 blur-[120px] pointer-events-none" />
      <div className="absolute -bottom-[20%] -right-[10%] w-[50%] h-[50%] rounded-full bg-blue-600/5 blur-[120px] pointer-events-none" />

      {/* Simulated Smartphone Container */}
      <div className="w-[375px] h-[780px] bg-neutral-900 rounded-[45px] border-[12px] border-neutral-800 shadow-2xl relative overflow-hidden flex flex-col scale-[0.98] sm:scale-100">
        
        {/* Notch / Speaker */}
        <div className="absolute top-0 inset-x-0 h-6 flex justify-center z-50">
          <div className="w-32 h-4.5 bg-neutral-800 rounded-b-xl flex items-center justify-between px-4">
            <span className="text-[10px] font-bold text-neutral-400">9:41</span>
            <div className="w-10 h-1 bg-neutral-950 rounded-full" />
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-neutral-400" />
              <div className="w-2.5 h-1.5 border border-neutral-400 rounded-sm" />
            </div>
          </div>
        </div>

        {/* Dynamic header depending on active tab */}
        <header className="h-20 pt-8 px-5 border-b border-neutral-850 bg-neutral-950/60 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <ShieldAlert size={20} className="text-red-500" />
            <span className="font-bold tracking-wider text-sm">EAWS CITIZEN</span>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-red-500/10 text-red-500 text-[10px] font-bold border border-red-500/20 animate-pulse">
            GH-ALERT
          </span>
        </header>

        {/* Scrollable Body Content */}
        <div className="flex-1 overflow-y-auto bg-neutral-900 relative">
          
          {/* TAB 1: Home/SOS */}
          {activeTab === 'home' && (
            <div className="p-5 flex flex-col items-center justify-between h-full min-h-[500px]">
              
              {/* Emergency Status Banner */}
              <div className="w-full bg-neutral-950/50 border border-neutral-850 rounded-xl p-3.5 flex items-center gap-3">
                <Radio className="text-red-500 animate-pulse shrink-0" size={20} />
                <div className="text-xs">
                  <p className="font-bold text-white">Warning System Connected</p>
                  <p className="text-neutral-400">Direct link to Accra Dispatch Center</p>
                </div>
              </div>

              {/* Big Red SOS Button */}
              <div className="my-8 flex flex-col items-center justify-center relative">
                {sosCountdown !== null ? (
                  /* SOS Countdown viewport */
                  <div className="w-52 h-52 rounded-full bg-red-600/10 border-4 border-red-600 flex flex-col items-center justify-center animate-pulse">
                    <p className="text-xs font-bold text-red-400 tracking-wider">TRANSMITTING IN</p>
                    <p className="text-7xl font-extrabold text-white my-1">{sosCountdown}</p>
                    <button
                      onClick={cancelSOS}
                      className="px-4 py-1.5 bg-neutral-800 text-[10px] font-bold rounded-full border border-neutral-700 text-white tracking-widest hover:bg-neutral-700"
                    >
                      CANCEL
                    </button>
                  </div>
                ) : sosTriggered ? (
                  /* SOS success pulsing display */
                  <div className="w-52 h-52 rounded-full bg-green-500/10 border-4 border-green-500 flex flex-col items-center justify-center text-center px-4">
                    <CheckCircle className="text-green-400 mb-2" size={32} />
                    <p className="text-xs font-bold text-green-400 tracking-wider">SOS TRANSMITTED</p>
                    <p className="text-[10px] text-neutral-400 mt-1">Responder dispatched</p>
                  </div>
                ) : (
                  /* Standard Button */
                  <button
                    onClick={startSOSCountdown}
                    className="w-52 h-52 rounded-full bg-red-600 border-[10px] border-red-950 shadow-2xl flex flex-col items-center justify-center transition-all duration-300 hover:scale-[1.03] active:scale-[0.97] hover:border-red-900 group"
                  >
                    <AlertOctagon size={42} className="text-white group-hover:rotate-12 transition-transform" />
                    <span className="font-extrabold text-lg text-white mt-2 tracking-wider">TRIGGER SOS</span>
                    <span className="text-[9px] text-red-200 mt-0.5 uppercase tracking-widest font-semibold">Immediate Dispatch</span>
                  </button>
                )}
              </div>

              {/* Action grid (Report Incidents) */}
              <div className="w-full space-y-3">
                <button
                  onClick={() => setShowReportSheet(true)}
                  className="w-full py-3.5 bg-neutral-950 border border-neutral-850 hover:border-neutral-750 text-white font-bold rounded-xl text-xs tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg"
                >
                  <Send size={14} className="text-red-500" />
                  REPORT EMERGENCY INCIDENT
                </button>
              </div>

            </div>
          )}

          {/* TAB 2: Live Feed */}
          {activeTab === 'feed' && (
            <div className="p-4 space-y-4">
              <h3 className="text-xs font-bold text-neutral-500 tracking-wider uppercase">Emergency Alerts Feed</h3>
              <div className="space-y-3">
                {feed.length === 0 ? (
                  <div className="text-center text-neutral-500 py-12 text-xs">
                    No active emergency broadcasts.
                  </div>
                ) : (
                  feed.map((incident) => {
                    const isCritical = incident.severity === "CRITICAL";
                    return (
                      <div
                        key={incident.id}
                        className={`bg-neutral-950/40 border rounded-xl p-3.5 space-y-2.5 shadow ${
                          isCritical ? "border-red-500/30" : "border-neutral-850"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded ${
                            isCritical ? "bg-red-500/10 text-red-400 border border-red-500/20" : "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20"
                          }`}>
                            {incident.severity} · {incident.category}
                          </span>
                          <span className="text-[10px] text-neutral-500 flex items-center gap-1 font-mono">
                            <Clock size={10} />
                            {new Date(incident.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        <div>
                          <h4 className="font-bold text-white text-sm truncate">{incident.title}</h4>
                          <p className="text-neutral-400 text-xs mt-1 leading-relaxed">{incident.description}</p>
                        </div>

                        <div className="flex items-center justify-between text-[10px] text-neutral-500 pt-2.5 border-t border-neutral-850">
                          <span className="flex items-center gap-1 truncate max-w-[140px]">
                            <MapPin size={11} className="text-neutral-600 shrink-0" />
                            {incident.location_name}
                          </span>
                          <span className="uppercase text-[9px] font-bold text-neutral-400">{incident.status}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB 3: Profile */}
          {activeTab === 'profile' && (
            <div className="p-5 space-y-5">
              <h3 className="text-xs font-bold text-neutral-500 tracking-wider uppercase">User Profile Logs</h3>
              
              {userProfile ? (
                <div className="space-y-4">
                  {/* Account Details Box */}
                  <div className="bg-neutral-950/40 rounded-xl border border-neutral-850 p-4 space-y-3.5 text-xs">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-red-600/10 border border-red-600/20 flex items-center justify-center font-bold text-red-500 text-sm">
                        {userProfile.full_name?.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-bold text-white text-sm">{userProfile.full_name}</p>
                        <p className="text-[10px] text-neutral-500 capitalize">{userProfile.user_role} Account</p>
                      </div>
                    </div>

                    <div className="border-t border-neutral-850 pt-3 space-y-2 text-neutral-400 font-mono">
                      <p className="flex justify-between">
                        <span>Phone:</span>
                        <span className="text-neutral-200">{userProfile.phone_number || "None"}</span>
                      </p>
                      <p className="flex justify-between">
                        <span>Ghana Card:</span>
                        <span className="text-neutral-200">{userProfile.ghana_card || "None"}</span>
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={async () => {
                      await supabase.auth.signOut();
                      window.location.href = "/";
                    }}
                    className="w-full py-3 bg-neutral-950 hover:bg-neutral-800 border border-neutral-850 hover:border-red-500/30 text-neutral-400 hover:text-red-400 font-bold rounded-xl text-xs tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <LogOut size={13} />
                    SECURE SIGN OUT
                  </button>
                </div>
              ) : (
                <div className="text-center text-neutral-500 py-12 text-xs">
                  Loading profile logs...
                </div>
              )}
            </div>
          )}

          {/* SLIDE-UP SHEET: Report Incident Form */}
          {showReportSheet && (
            <div className="absolute inset-0 bg-black/60 z-50 flex flex-col justify-end transition-all">
              <div className="bg-neutral-950 rounded-t-[30px] border-t border-neutral-800 p-5 space-y-4 max-h-[500px] overflow-y-auto animate-in slide-in-from-bottom duration-200">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-white text-sm">Report Incident to Dispatch</h4>
                  <button
                    onClick={() => setShowReportSheet(false)}
                    className="p-1 rounded bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white"
                  >
                    <X size={14} />
                  </button>
                </div>

                {submitSuccess ? (
                  <div className="text-center py-8 space-y-2">
                    <CheckCircle className="text-green-400 mx-auto" size={32} />
                    <p className="font-bold text-white">Emergency Transmitted</p>
                    <p className="text-[10px] text-neutral-400">Dispatcher notified. Responding units queued.</p>
                  </div>
                ) : (
                  <form onSubmit={handleReportSubmit} className="space-y-3.5 text-xs text-left">
                    <div className="space-y-1">
                      <label className="text-neutral-400 font-semibold">Incident Title</label>
                      <input
                        type="text"
                        placeholder="e.g. Traffic Collision"
                        required
                        className="w-full px-3 py-2 bg-neutral-900 border border-neutral-850 rounded-lg text-white placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-red-500"
                        value={reportTitle}
                        onChange={(e) => setReportTitle(e.target.value)}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-neutral-400 font-semibold">Emergency Category</label>
                        <select
                          className="w-full px-3 py-2 bg-neutral-900 border border-neutral-850 rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-red-500"
                          value={reportCategory}
                          onChange={(e) => setReportCategory(e.target.value)}
                        >
                          <option value="MEDICAL">Medical Emergency</option>
                          <option value="FIRE">Fire Alert</option>
                          <option value="CRIME">Crime/Theft</option>
                          <option value="ACCIDENT">Road Collision</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-neutral-400 font-semibold">Estimated Location</label>
                        <input
                          type="text"
                          required
                          className="w-full px-3 py-2 bg-neutral-900 border border-neutral-850 rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-red-500"
                          value={reportLocation}
                          onChange={(e) => setReportLocation(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-neutral-400 font-semibold">Incident Description</label>
                      <textarea
                        rows={3}
                        required
                        placeholder="Briefly describe the emergency..."
                        className="w-full px-3 py-2 bg-neutral-900 border border-neutral-850 rounded-lg text-white placeholder-neutral-600 resize-none focus:outline-none focus:ring-1 focus:ring-red-500"
                        value={reportDescription}
                        onChange={(e) => setReportDescription(e.target.value)}
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Send size={12} />
                      <span>{isLoading ? "Transmitting..." : "Submit Incident"}</span>
                    </button>
                  </form>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Bottom Tab Navigation Bar */}
        <footer className="h-16 border-t border-neutral-850 bg-neutral-950 shrink-0 flex items-center justify-around px-2 z-40">
          <button
            onClick={() => setActiveTab('home')}
            className={`flex flex-col items-center gap-1 py-1.5 px-3 rounded-lg text-[10px] font-semibold transition-colors ${
              activeTab === 'home' ? 'text-red-500' : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            <Home size={18} />
            <span>Home</span>
          </button>
          
          <button
            onClick={() => setActiveTab('feed')}
            className={`flex flex-col items-center gap-1 py-1.5 px-3 rounded-lg text-[10px] font-semibold transition-colors ${
              activeTab === 'feed' ? 'text-red-500' : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            <Rss size={18} />
            <span>Alerts</span>
          </button>

          <button
            onClick={() => setActiveTab('profile')}
            className={`flex flex-col items-center gap-1 py-1.5 px-3 rounded-lg text-[10px] font-semibold transition-colors ${
              activeTab === 'profile' ? 'text-red-500' : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            <User size={18} />
            <span>Profile</span>
          </button>
        </footer>

      </div>
    </div>
  );
}
