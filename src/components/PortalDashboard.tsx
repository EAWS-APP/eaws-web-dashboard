"use client";

import { useEffect, useState, useRef } from "react";
import dynamic from "next/dynamic";
import { supabase } from "@/lib/supabase";
import { eawsApi } from "@/lib/api";
import type { Incident } from "@/lib/models";
import {
  X, CheckCircle, UserCheck, Search, Shield, Flame, Activity, Phone,
  Radio, Play, Send, AlertTriangle, Compass, Navigation, Plus, Minus, Layers
} from "lucide-react";
import { insforge } from "@/lib/insforge";

const LiveMap = dynamic(() => import("@/components/Map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-neutral-950 text-neutral-500 rounded-lg border border-neutral-800">
      <p className="text-xs font-mono tracking-wider animate-pulse font-bold">Initializing Secure Map Feed...</p>
    </div>
  ),
});

type Tone = "blue" | "orange" | "purple" | "red" | "emerald";

type Stat = {
  label: string;
  value: string;
  detail: string;
};

type QueueItem = {
  id: string;
  title: string;
  location: string;
  priority: string;
  time: string;
  status?: string;
  incident_id?: string;
  incident_description?: string;
  incident_metadata?: any;
  latitude?: number | null;
  longitude?: number | null;
};

type PortalDashboardProps = {
  tone: Tone;
  portal: string;
  subtitle: string;
  operator: string;
  badge: string;
  stats: Stat[];
  queueTitle: string;
  queue: QueueItem[];
  actions: string[];
  selectedId?: string;
  onSelect?: (id: string) => void;
  onAction?: (action: string, selectedId: string) => void;
  isActionLoading?: boolean;
  userRole?: string;
  userProfile?: {
    full_name: string;
    operator_code?: string;
  } | null;
  onRefresh?: () => void;
};

const ACCRA_RIDGE_HOSPITALS = [
  { id: "ridge", name: "Ridge Hospital (GARH)", phone: "+233 30 222 8121", coords: [5.5684, -0.1983], street: "via Castle Rd" },
  { id: "korlebu", name: "Korle-Bu Trauma Center", phone: "+233 30 267 4072", coords: [5.5348, -0.2244], street: "via Guggisberg Ave" },
  { id: "37mil", name: "37 Military Hospital", phone: "+233 30 277 6111", coords: [5.5898, -0.1878], street: "via Liberation Rd" },
  { id: "lekma", name: "Lekma Clinic", phone: "+233 30 271 2341", coords: [5.6012, -0.1124], street: "via Spintex Road" },
];

const ACCRA_EAST_LEGON_HOSPITALS = [
  { id: "yeboah", name: "Yeboah Hospital", phone: "+233 30 252 2235", coords: [5.6354, -0.1554], street: "Lagos Avenue" },
  { id: "obatanpa", name: "Obatanpa Women's Hospital", phone: "+233 30 250 8920", coords: [5.6288, -0.1620], street: "East Legon Bypass" },
  { id: "alpha_med", name: "Alpha Medical Centre", phone: "+233 55 522 5522", coords: [5.6412, -0.1480], street: "Boundary Rd" },
  { id: "del_int", name: "Del International Hospital", phone: "+233 30 251 9289", coords: [5.6395, -0.1510], street: "near Boundary Rd" },
];

const ACCRA_AMASAMAN_HOSPITALS = [
  { id: "amasaman", name: "Amasaman Municipal Hospital", phone: "+233 30 290 8390", coords: [5.7022, -0.3012], street: "Amasaman Rd" },
  { id: "gawest", name: "Ga West Municipal Hospital", phone: "+233 30 291 0390", coords: [5.6980, -0.2850], street: "Hospital Rd" },
  { id: "stjohns", name: "St. John's Hospital", phone: "+233 30 242 2200", coords: [5.6698, -0.2520], street: "Tantra Hills Rd" },
  { id: "pokuase", name: "Pokuase Health Centre", phone: "+233 50 144 8390", coords: [5.6880, -0.2680], street: "Pokuase Bypass" },
];

export default function PortalDashboard({
  tone,
  portal,
  subtitle,
  operator,
  badge,
  stats,
  queueTitle,
  queue,
  actions,
  selectedId,
  onSelect,
  onAction,
  isActionLoading = false,
  userRole,
  userProfile,
  onRefresh,
}: PortalDashboardProps) {
  // Navigation / View state
  const [activeTab, setActiveTab] = useState<"triage" | "route" | "comms" | "metrics">("triage");
  const [showInteractiveMap, setShowInteractiveMap] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Sidebar Navigation tab state
  const [activeSidebarTab, setActiveSidebarTab] = useState<
    "map" | "incidents" | "resources" | "community" | "analytics" | "status" | "support" | "clinical"
  >("map");

  // Medical Registry Search states
  const [searchMedicalQuery, setSearchMedicalQuery] = useState("");
  const [matchedProfiles, setMatchedProfiles] = useState<any[]>([]);
  const [selectedMedicalProfile, setSelectedMedicalProfile] = useState<any | null>(null);
  const [isSearchingProfile, setIsSearchingProfile] = useState(false);
  const [patientIncidents, setPatientIncidents] = useState<any[]>([]);
  const [isPatientIncidentsLoading, setIsPatientIncidentsLoading] = useState(false);

  // Paramedic En-Route Attachment states
  const [paramedicAudioUrl, setParamedicAudioUrl] = useState("");
  const [paramedicVideoUrl, setParamedicVideoUrl] = useState("");
  const [targetHospital, setTargetHospital] = useState("");

  // Microphone recording states
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [audioRecordDuration, setAudioRecordDuration] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // New Incident Manual Creation states
  const [showNewIncidentModal, setShowNewIncidentModal] = useState(false);
  const [isCreatingIncident, setIsCreatingIncident] = useState(false);
  const [newIncidentTitle, setNewIncidentTitle] = useState("");
  const [newIncidentCategory, setNewIncidentCategory] = useState("MEDICAL");
  const [newIncidentSeverity, setNewIncidentSeverity] = useState("MEDIUM");
  const [newIncidentLocation, setNewIncidentLocation] = useState("");
  const [newIncidentDesc, setNewIncidentDesc] = useState("");
  
  // Bystander media modal preview state
  const [bystanderMediaPreview, setBystanderMediaPreview] = useState<{ type: "image" | "video"; url: string } | null>(null);

  // Triage & Form states
  const [patientName, setPatientName] = useState("");
  const [vitalsHR, setVitalsHR] = useState("");
  const [vitalsBP, setVitalsBP] = useState("");
  const [vitalsSpO2, setVitalsSpO2] = useState("");
  const [policeSuspect, setPoliceSuspect] = useState("");
  const [policeVehicle, setPoliceVehicle] = useState("");
  const [notesText, setNotesText] = useState("");
  const [isSavingForm, setIsSavingForm] = useState(false);
  
  // Escalation & Backup states
  const [backupReason, setBackupReason] = useState("");
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [isStatusLoading, setIsStatusLoading] = useState(false);
  const [isEscalating, setIsEscalating] = useState(false);

  // Hospital Pre-Alert states
  const [isAlertingHospitalId, setIsAlertingHospitalId] = useState<string | null>(null);
  const [alertedHospitals, setAlertedHospitals] = useState<Record<string, boolean>>({});

  // Police Dispatch unit selector states
  const [selectedDispatchUnitId, setSelectedDispatchUnitId] = useState("");
  const [isDispatching, setIsDispatching] = useState(false);

  // Chat message feeds
  const [chatMessages, setChatMessages] = useState<Array<{ sender: string; time: string; text: string }>>([
    { sender: "POLICE_HQ", time: "14:12:05", text: "Patrol unit 42 is 2 mins out from Block C." },
    { sender: "EMS_ALPHA", time: "14:12:30", text: "Preparing oxygen. Confirming patient is asthmatic." },
    { sender: "DISPATCH", time: "14:12:45", text: "Visual confirmed on Cam_01. Suspect fleeing West." }
  ]);
   const [newMessage, setNewMessage] = useState("");
 
  // Community Feed posts state (X/Twitter clone)
  interface CommunityPost {
    id: string;
    author: string;
    username: string;
    avatar: string;
    time: string;
    content: string;
    media?: {
      type: "image" | "video" | "audio";
      url: string;
    };
    likes: number;
    likedByMe?: boolean;
    reshares: number;
    resharedByMe?: boolean;
    comments: Array<{
      id: string;
      author: string;
      username: string;
      avatar: string;
      time: string;
      content: string;
      media?: {
        type: "image" | "video" | "audio";
        url: string;
      };
    }>;
  }

  const [communityPosts, setCommunityPosts] = useState<CommunityPost[]>([]);
  const [isFeedLoading, setIsFeedLoading] = useState(false);
  const [postComments, setPostComments] = useState<Record<string, any[]>>({});

  const loadCommunityFeed = async () => {
    setIsFeedLoading(true);
    try {
      const incidents = await eawsApi.getIncidentFeed();
      const mappedPosts: CommunityPost[] = (incidents || []).map((inc) => {
        const firstMedia = inc.incident_media && inc.incident_media.length > 0 ? inc.incident_media[0] : null;
        const fullName = inc.reporter_profile?.full_name || (inc.is_anonymous ? "Anonymous Citizen" : "Citizen Reporter");
        const role = inc.reporter_profile?.user_role || "citizen";
        const opCode = inc.reporter_profile?.operator_code || "";

        let avatar = "C";
        if (role === "police") avatar = "AP";
        else if (role === "ambulance") avatar = "AE";
        else if (role === "fire") avatar = "AF";
        else if (role === "dispatcher") avatar = "DC";
        else if (role === "admin" || role === "super_admin") avatar = "AC";
        else if (fullName) avatar = fullName.substring(0, 2).toUpperCase();

        const username = opCode ? opCode : fullName.toLowerCase().replace(/\s+/g, "");

        const minsAgo = Math.max(1, Math.round((Date.now() - new Date(inc.created_at).getTime()) / 60000));
        const relativeTime = minsAgo < 60 ? `${minsAgo}m ago` : `${Math.round(minsAgo / 60)}h ago`;

        return {
          id: inc.id,
          author: fullName,
          username: username,
          avatar: avatar,
          time: relativeTime,
          content: inc.description || inc.title,
          likes: inc.likes_count ?? 0,
          likedByMe: false,
          reshares: inc.views_count ?? 0,
          resharedByMe: false,
          comments: [],
          media: firstMedia ? {
            type: firstMedia.media_type,
            url: firstMedia.file_url,
          } : undefined,
        };
      });
      setCommunityPosts(mappedPosts);
    } catch (err) {
      console.error("Failed to fetch community feed:", err);
    } finally {
      setIsFeedLoading(false);
    }
  };

  const [newPostText, setNewPostText] = useState("");
  const [attachedMedia, setAttachedMedia] = useState<{ type: "image" | "video" | "audio"; url: string } | null>(null);
  const [activeCommentPostId, setActiveCommentPostId] = useState<string | null>(null);
  const [newCommentText, setNewCommentText] = useState<Record<string, string>>({});
  const [attachedCommentMedia, setAttachedCommentMedia] = useState<Record<string, { type: "image" | "video" | "audio"; url: string } | null>>({});

  // Tele-Med Video Call states
  const [isTeleMedActive, setIsTeleMedActive] = useState(false);
  const [teleMedStream, setTeleMedStream] = useState<MediaStream | null>(null);
  const [teleMedMuted, setTeleMedMuted] = useState(false);
  const [teleMedVideoStopped, setTeleMedVideoStopped] = useState(false);
  const [teleMedDuration, setTeleMedDuration] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    let timer: any;
    if (isTeleMedActive) {
      timer = setInterval(() => {
        setTeleMedDuration((prev) => prev + 1);
      }, 1000);
    } else {
      setTeleMedDuration(0);
    }
    return () => clearInterval(timer);
  }, [isTeleMedActive]);

  useEffect(() => {
    if (isTeleMedActive && teleMedStream && videoRef.current) {
      videoRef.current.srcObject = teleMedStream;
    }
  }, [isTeleMedActive, teleMedStream]);

  const startTeleMedCall = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      setTeleMedStream(stream);
      setIsTeleMedActive(true);
    } catch (err: any) {
      console.warn("Camera access failed, falling back to simulated connection:", err.message);
      setIsTeleMedActive(true);
    }
  };

  const stopTeleMedCall = () => {
    if (teleMedStream) {
      teleMedStream.getTracks().forEach((track) => track.stop());
    }
    setTeleMedStream(null);
    setIsTeleMedActive(false);
    setTeleMedVideoStopped(false);
    setTeleMedMuted(false);
  };

  const toggleMute = () => {
    if (teleMedStream) {
      teleMedStream.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setTeleMedMuted(!teleMedMuted);
    }
  };

  const toggleVideo = () => {
    if (teleMedStream) {
      teleMedStream.getVideoTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setTeleMedVideoStopped(!teleMedVideoStopped);
    }
  };

  // Patient History states
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historicalIncidents, setHistoricalIncidents] = useState<any[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);

  const fetchPatientHistory = async () => {
    setShowHistoryModal(true);
    setIsHistoryLoading(true);
    try {
      const { data, error } = await supabase
        .from("incidents")
        .select("*")
        .eq("category", "MEDICAL")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setHistoricalIncidents(data || []);
    } catch (err) {
      console.error("Failed to load historical logs:", err);
    } finally {
      setIsHistoryLoading(false);
    }
  };

  // Live Active Responding Units states
  const [liveUnits, setLiveUnits] = useState<any[]>([]);
  const [ambulanceCoords, setAmbulanceCoords] = useState<[number, number]>([5.6037, -0.1870]);

  useEffect(() => {
    async function loadLiveUnits() {
      try {
        const units = await eawsApi.getLiveUnits();
        setLiveUnits(units || []);
      } catch (err) {
        console.error("Failed to load live units in dashboard:", err);
      }
    }
    loadLiveUnits();
    const interval = setInterval(loadLiveUnits, 8000);
    return () => clearInterval(interval);
  }, []);

  // Bystander Audio Player states
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);

  useEffect(() => {
    let timer: any;
    if (isPlayingAudio) {
      timer = setInterval(() => {
        setAudioProgress((prev) => {
          if (prev >= 72) {
            setIsPlayingAudio(false);
            return 0;
          }
          return prev + 1;
        });
      }, 1000);
    } else {
      clearInterval(timer);
    }
    return () => clearInterval(timer);
  }, [isPlayingAudio]);

  const formatAudioTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `0${mins}:${remainingSecs < 10 ? "0" : ""}${remainingSecs}`;
  };

  const selectedAssignment = queue.find((item) => item.id === selectedId);

  // Real-time incident logs channel subscriptions
  useEffect(() => {
    // InsForge Realtime: incident log messages
    insforge.realtime.connect().then(() => {
      insforge.realtime.subscribe("radio-comms-logs");
      insforge.realtime.on<any>("incident_log_created", (payload) => {
        setChatMessages((prev) => [
          ...prev,
          {
            sender: payload.operator_code || "FIELD_UNIT",
            time: new Date(payload.created_at).toTimeString().substring(0, 8),
            text: payload.remarks || payload.status_logged || "Status logged",
          },
        ]);
      });
    });

    return () => {
      insforge.realtime.unsubscribe("radio-comms-logs");
    };
  }, []);

  useEffect(() => {
    loadCommunityFeed();
    const interval = setInterval(loadCommunityFeed, 8000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!activeCommentPostId) return;

    const loadCommentsForPost = async () => {
      try {
        const comments = await eawsApi.getComments(activeCommentPostId);
        setPostComments((prev) => ({
          ...prev,
          [activeCommentPostId]: comments || [],
        }));
      } catch (err) {
        console.error("Failed to load comments:", err);
      }
    };

    loadCommentsForPost();
  }, [activeCommentPostId]);

  // Prepopulate form states when selectedId updates
  useEffect(() => {
    if (selectedAssignment) {
      const meta = selectedAssignment.incident_metadata || {};
      setPatientName(meta.patient_name || "");
      setVitalsHR(meta.vitals_hr || "");
      setVitalsBP(meta.vitals_bp || "");
      setVitalsSpO2(meta.vitals_spo2 || "");
      setPoliceSuspect(meta.suspect_details || "");
      setPoliceVehicle(meta.vehicle_details || "");
      setNotesText(meta.responder_notes || "");
      setAlertedHospitals(meta.alerted_hospitals || {});
      setParamedicAudioUrl(meta.paramedic_audio_url || "");
      setParamedicVideoUrl(meta.paramedic_video_url || "");
      setTargetHospital(meta.target_hospital || "");
    }
  }, [selectedId, selectedAssignment]);

  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const senderName = userProfile?.operator_code || operator || "OPERATOR";
    const timeNow = new Date().toTimeString().substring(0, 8);

    // Save to local chat state immediately
    setChatMessages((prev) => [
      ...prev,
      { sender: senderName, time: timeNow, text: newMessage.trim() }
    ]);
    
    // Save to backend logs if incident is active
    if (selectedAssignment && selectedAssignment.incident_id) {
      try {
        await supabase.from("incident_logs").insert({
          incident_id: selectedAssignment.incident_id,
          operator_code: senderName,
          status_logged: "radio_transmission",
          remarks: newMessage.trim(),
        });
      } catch (err) {
        console.error("Failed to persist radio log:", err);
      }
    }

    setNewMessage("");
  };

  const handleStatusTransition = async (targetStatus: string, remarks?: string) => {
    if (!selectedId) return;
    setIsStatusLoading(true);
    try {
      if (targetStatus === "acknowledged") {
        await eawsApi.acknowledgeResponse(selectedId);
      } else {
        await eawsApi.updateAssignmentStatus(selectedId, {
          status: targetStatus,
          remarks: remarks || `Advanced status to ${stepLabels[targetStatus]}.`
        });
      }
      if (onRefresh) onRefresh();
    } catch (err: any) {
      alert("Failed to advance workflow state: " + (err.message || err));
    } finally {
      setIsStatusLoading(false);
    }
  };

  const handleSaveTriage = async () => {
    if (!selectedAssignment || !selectedAssignment.incident_id) return;
    setIsSavingForm(true);
    try {
      const updatedMeta = {
        ...(selectedAssignment.incident_metadata || {}),
        patient_name: patientName,
        vitals_hr: vitalsHR,
        vitals_bp: vitalsBP,
        vitals_spo2: vitalsSpO2,
        suspect_details: policeSuspect,
        vehicle_details: policeVehicle,
        responder_notes: notesText,
        alerted_hospitals: alertedHospitals,
        paramedic_audio_url: paramedicAudioUrl,
        paramedic_video_url: paramedicVideoUrl,
        target_hospital: targetHospital
      };

      await eawsApi.updateIncident(selectedAssignment.incident_id, {
        metadata: updatedMeta,
        category: userRole === "police" ? "CRIME" : "MEDICAL"
      });

      // Also insert a log entry for verification tracking
      const senderName = userProfile?.operator_code || operator || "OPERATOR";
      await supabase.from("incident_logs").insert({
        incident_id: selectedAssignment.incident_id,
        operator_code: senderName,
        status_logged: "triage_update",
        remarks: `Updated logs: ${userRole === "police" ? "Suspect/Vehicle details saved." : "Vitals saved."}`
      });

      alert("Operational records updated successfully!");
      if (onRefresh) onRefresh();
    } catch (err: any) {
      alert("Failed to save operational records: " + (err.message || err));
    } finally {
      setIsSavingForm(false);
    }
  };

  const handlePreAlertHospital = async (hospitalId: string, hospitalName: string) => {
    if (!selectedAssignment || !selectedAssignment.incident_id) {
      alert("No active case loaded. Cannot transmit pre-alert.");
      return;
    }

    setIsAlertingHospitalId(hospitalId);
    try {
      const nextAlerts = { ...alertedHospitals, [hospitalId]: true };
      setAlertedHospitals(nextAlerts);

      // Save updated list to metadata
      const updatedMeta = {
        ...(selectedAssignment.incident_metadata || {}),
        alerted_hospitals: nextAlerts
      };
      await eawsApi.updateIncident(selectedAssignment.incident_id, {
        metadata: updatedMeta
      });

      const senderName = userProfile?.operator_code || operator || "OPERATOR";
      await supabase.from("incident_logs").insert({
        incident_id: selectedAssignment.incident_id,
        operator_code: senderName,
        status_logged: "hospital_alerted",
        remarks: `Pre-alert transmitted to ${hospitalName}.`
      });

      alert(`Trauma pre-alert transmitted successfully to ${hospitalName}!`);
    } catch (err: any) {
      alert("Failed to alert hospital: " + (err.message || err));
    } finally {
      setIsAlertingHospitalId(null);
    }
  };

  const handleEscalate = async () => {
    if (!selectedId || !backupReason.trim()) return;
    setIsEscalating(true);
    try {
      await eawsApi.escalateIncident(selectedId, backupReason.trim());
      alert("Distress beacon broadcasted to all agency staging areas!");
      setShowBackupModal(false);
      setBackupReason("");
      if (onRefresh) onRefresh();
    } catch (err: any) {
      alert("Failed to escalate: " + (err.message || err));
    } finally {
      setIsEscalating(false);
    }
  };

  const handleDispatchUnit = async () => {
    if (!selectedAssignment || !selectedAssignment.incident_id || !selectedDispatchUnitId) {
      alert("Please select a call beacon and an available patrol unit.");
      return;
    }
    setIsDispatching(true);
    try {
      await eawsApi.dispatchIncident(selectedAssignment.incident_id, {
        agency_type: "police",
        unit_id: selectedDispatchUnitId,
        priority: selectedAssignment.priority.toLowerCase(),
        notes: `Tactical police unit deployed from Sentinel HQs.`
      });
      alert(`Patrol unit dispatched successfully!`);
      setSelectedDispatchUnitId("");
      if (onRefresh) onRefresh();
    } catch (err: any) {
      alert("Dispatch failed: " + (err.message || err));
    } finally {
      setIsDispatching(false);
    }
  };

  const handleCreateIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIncidentTitle.trim() || !newIncidentLocation.trim()) {
      alert("Incident Title and Location Name are required.");
      return;
    }

    setIsCreatingIncident(true);
    try {
      const defaultLat = 5.6037 + (Math.random() - 0.5) * 0.05;
      const defaultLng = -0.1870 + (Math.random() - 0.5) * 0.05;

      const res = await eawsApi.createIncident({
        title: newIncidentTitle.trim(),
        category: newIncidentCategory,
        description: newIncidentDesc.trim() || "No further details.",
        latitude: defaultLat,
        longitude: defaultLng,
        location_name: newIncidentLocation.trim(),
        severity: newIncidentSeverity
      });

      alert(`Manual dispatch alert "${res.incident?.title || newIncidentTitle}" created successfully!`);
      setShowNewIncidentModal(false);
      setNewIncidentTitle("");
      setNewIncidentDesc("");
      setNewIncidentLocation("");
      if (onRefresh) onRefresh();
    } catch (err: any) {
      alert("Failed to submit manual incident: " + (err.message || err));
    } finally {
      setIsCreatingIncident(false);
    }
  };

  const handleSearchMedicalProfile = async (queryName: string) => {
    setSearchMedicalQuery(queryName);
    if (!queryName.trim()) {
      setMatchedProfiles([]);
      return;
    }

    setIsSearchingProfile(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .ilike("full_name", `%${queryName.trim()}%`)
        .limit(5);
      if (error) throw error;
      setMatchedProfiles(data || []);
    } catch (err) {
      console.error("Failed to query medical profiles:", err);
    } finally {
      setIsSearchingProfile(false);
    }
  };

  const fetchPatientIncidents = async (name: string) => {
    setIsPatientIncidentsLoading(true);
    try {
      const { data, error } = await supabase
        .from("incidents")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const matched = (data || []).filter((inc: any) => {
        const meta = inc.metadata || {};
        return meta.patient_name && meta.patient_name.toLowerCase() === name.toLowerCase();
      });
      setPatientIncidents(matched);
    } catch (err) {
      console.error("Failed to query patient incidents:", err);
    } finally {
      setIsPatientIncidentsLoading(false);
    }
  };

  const startAudioRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/wav" });
        const simulatedUrl = `https://sswwdizgwctfwirhmroj.supabase.co/storage/v1/object/public/reports/paramedic-audio-${Date.now()}.wav`;
        setParamedicAudioUrl(simulatedUrl);
        alert("En-route voice dispatch record captured successfully!");
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecordingAudio(true);
      setAudioRecordDuration(0);
    } catch (err) {
      alert("Microphone hardware access denied or not connected.");
    }
  };

  const stopAudioRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
      mediaRecorder.stream.getTracks().forEach(track => track.stop());
    }
    setIsRecordingAudio(false);
    setMediaRecorder(null);
  };

  const handleMediaUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isVideo = file.type.startsWith("video/");
    const simulatedUrl = `https://sswwdizgwctfwirhmroj.supabase.co/storage/v1/object/public/reports/paramedic-${isVideo ? "video" : "image"}-${Date.now()}-${file.name}`;
    setParamedicVideoUrl(simulatedUrl);
    alert(`${isVideo ? "Video clip" : "Diagnostic image"} attached to victim file successfully!`);
  };

  // Audio Recording timer effect
  useEffect(() => {
    let timer: any;
    if (isRecordingAudio) {
      timer = setInterval(() => {
        setAudioRecordDuration(prev => prev + 1);
      }, 1000);
    } else {
      setAudioRecordDuration(0);
    }
    return () => clearInterval(timer);
  }, [isRecordingAudio]);

  const getHospitalDistanceAndEta = (hLat: number, hLng: number) => {
    if (!selectedAssignment?.latitude) return { dist: "N/A", eta: "N/A" };
    const R = 6371; // km
    const dLat = (hLat - selectedAssignment.latitude) * Math.PI / 180;
    const dLon = (hLng - (selectedAssignment.longitude || 0)) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(selectedAssignment.latitude * Math.PI / 180) * Math.cos(hLat * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const d = R * c; 
    
    // Average 45 km/h for emergency vehicle in Accra traffic
    const etaMin = Math.round((d / 45) * 60) + 1;
    return {
      dist: `${d.toFixed(1)} km`,
      eta: `${etaMin} mins`
    };
  };

  // Workflow steps
  const steps = userRole === "police" 
    ? ["assigned", "acknowledged", "en_route", "on_scene", "secured", "resolved"]
    : ["assigned", "acknowledged", "en_route", "on_scene", "patient_transported", "resolved"];

  const stepLabels: Record<string, string> = {
    assigned: "Dispatched",
    acknowledged: "Acknowledged",
    en_route: "En Route",
    on_scene: "At Scene",
    patient_transported: "Transporting",
    secured: "Scene Secured",
    resolved: "Resolved"
  };

  const currentStatus = selectedAssignment?.status || "assigned";
  const currentStepIndex = steps.indexOf(currentStatus);
  const nextStepIndex = currentStepIndex + 1;
  const nextStatus = nextStepIndex < steps.length ? steps[nextStepIndex] : null;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  const renderIncidentsTab = () => {
    const filteredInc = queue.filter((inc: any) => {
      const matchQuery = inc.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         inc.location.toLowerCase().includes(searchQuery.toLowerCase());
      return matchQuery;
    });

    return (
      <div className="space-y-4 font-mono text-xs max-w-5xl mx-auto">
        <div className="flex justify-between items-center bg-surface-container p-4 rounded-xl border border-outline-variant">
          <div>
            <h3 className="text-sm font-bold text-white uppercase">Incidents Repository Feed</h3>
            <p className="text-[10px] text-neutral-400 mt-1">TOTAL CASES IN WORKSPACE: {queue.length} ACTIVE</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-[10px] text-emerald-400 font-bold uppercase">Live Syncing</span>
          </div>
        </div>

        <div className="bg-[#111112] border border-outline-variant rounded-xl overflow-hidden shadow-xl">
          <table className="w-full text-left divide-y divide-neutral-850">
            <thead className="bg-neutral-950 text-neutral-400 uppercase text-[9px] font-bold">
              <tr>
                <th className="p-4">Title & Details</th>
                <th className="p-4">Location</th>
                <th className="p-4">Priority</th>
                <th className="p-4">Time Elapsed</th>
                <th className="p-4 text-right">Operational Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-900 bg-surface-container-low/40">
              {filteredInc.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-neutral-500">
                    No active emergency calls match your search criteria.
                  </td>
                </tr>
              ) : (
                filteredInc.map(inc => (
                  <tr key={inc.id} className="hover:bg-neutral-900/50 transition-colors">
                    <td className="p-4">
                      <div className="font-bold text-white text-xs">{inc.title}</div>
                      <div className="text-[10px] text-neutral-500 mt-0.5 max-w-sm truncate">{inc.incident_description || "No description provided."}</div>
                    </td>
                    <td className="p-4 text-neutral-300">{inc.location}</td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                        inc.priority === "CRITICAL" || inc.priority === "HIGH" 
                          ? "bg-red-500/10 text-red-400 border border-red-500/20" 
                          : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                      }`}>
                        {inc.priority}
                      </span>
                    </td>
                    <td className="p-4 text-neutral-400">{inc.time}</td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <a
                          href={`/citizen?id=${inc.incident_metadata?.user_id || inc.id}`}
                          target="_blank"
                          className="px-3 py-1 bg-neutral-800 text-white hover:bg-neutral-700 font-bold rounded text-[10px] uppercase transition-all flex items-center gap-1 border border-neutral-700 h-[26px]"
                        >
                          Profile
                        </a>
                        <button
                          onClick={() => {
                            if (onSelect) onSelect(inc.id);
                            setActiveSidebarTab("map");
                          }}
                          className="px-3 py-1 bg-primary text-on-primary hover:opacity-90 font-bold rounded text-[10px] uppercase transition-all h-[26px]"
                        >
                          Track View
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderResourcesTab = () => {
    return (
      <div className="space-y-4 font-mono text-xs max-w-5xl mx-auto">
        <div className="flex justify-between items-center bg-surface-container p-4 rounded-xl border border-outline-variant">
          <div>
            <h3 className="text-sm font-bold text-white uppercase">Responder Resource Registry</h3>
            <p className="text-[10px] text-neutral-400 mt-1">ACTIVE SYSTEM ASSETS: {liveUnits.length} FIELD CREWS</p>
          </div>
          <button 
            onClick={async () => {
              try {
                const u = await eawsApi.getLiveUnits();
                setLiveUnits(u || []);
                alert("Field asset status registry refreshed.");
              } catch(e) {}
            }}
            className="px-3 py-1 bg-neutral-850 hover:bg-neutral-800 border border-neutral-700 text-neutral-300 rounded font-bold uppercase text-[10px]"
          >
            Refresh Logs
          </button>
        </div>

        <div className="bg-[#111112] border border-outline-variant rounded-xl overflow-hidden shadow-xl">
          <table className="w-full text-left divide-y divide-neutral-850">
            <thead className="bg-neutral-950 text-neutral-400 uppercase text-[9px] font-bold">
              <tr>
                <th className="p-4">Callsign</th>
                <th className="p-4">Agency</th>
                <th className="p-4">Current Coordinates</th>
                <th className="p-4">Operating Status</th>
                <th className="p-4 text-right">Last Verified</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-900 bg-surface-container-low/40">
              {liveUnits.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-neutral-500">
                    No active responder units logged in database.
                  </td>
                </tr>
              ) : (
                liveUnits.map(unit => (
                  <tr key={unit.id} className="hover:bg-neutral-900/50 transition-colors">
                    <td className="p-4 font-bold text-white">{unit.callsign}</td>
                    <td className="p-4 text-neutral-300 uppercase">{unit.agency_type || (unit.callsign.startsWith("AMB") ? "ambulance" : "police")}</td>
                    <td className="p-4 text-neutral-400 font-sans">
                      {unit.current_latitude?.toFixed(4) || "5.6037"}°, {unit.current_longitude?.toFixed(4) || "-0.1870"}°
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                        unit.status === "AVAILABLE" || unit.status === "available"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                      }`}>
                        {unit.status}
                      </span>
                    </td>
                    <td className="p-4 text-neutral-500 text-right text-[10px]">
                      {unit.last_updated ? new Date(unit.last_updated).toLocaleTimeString() : "NOW"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderCommunityTab = () => {
    const handleLikePost = async (postId: string) => {
      try {
        await eawsApi.reactToIncident(postId, "like");
        setCommunityPosts(prev => prev.map(post => {
          if (post.id === postId) {
            const liked = !post.likedByMe;
            return {
              ...post,
              likedByMe: liked,
              likes: liked ? post.likes + 1 : post.likes - 1
            };
          }
          return post;
        }));
      } catch (err) {
        console.error("Failed to like post:", err);
      }
    };

    const handleResharePost = (postId: string) => {
      setCommunityPosts(prev => prev.map(post => {
        if (post.id === postId) {
          const reshared = !post.resharedByMe;
          return {
            ...post,
            resharedByMe: reshared,
            reshares: reshared ? post.reshares + 1 : post.reshares - 1
          };
        }
        return post;
      }));
    };

    const handleCreatePost = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newPostText.trim() && !attachedMedia) return;

      try {
        const defaultCategory = userRole === "police" ? "CRIME" : userRole === "fire" ? "FIRE" : "MEDICAL";
        const titleText = newPostText.trim().substring(0, 50) + (newPostText.trim().length > 50 ? "..." : "");

        const res = await eawsApi.createIncident({
          category: defaultCategory,
          title: titleText,
          description: newPostText.trim(),
          location_name: "Greater Accra Command",
          latitude: 5.6037,
          longitude: -0.1870,
          severity: "MEDIUM",
        });

        const createdIncidentId = res.incident?.id;

        if (createdIncidentId && attachedMedia) {
          await eawsApi.attachMedia(createdIncidentId, {
            media_type: attachedMedia.type,
            file_url: attachedMedia.url,
            description: `Media attachment for post ${createdIncidentId}`,
          });
        }

        setNewPostText("");
        setAttachedMedia(null);
        await loadCommunityFeed();
      } catch (err: any) {
        alert("Failed to publish post: " + (err.message || err));
      }
    };

    const handleAddComment = async (postId: string) => {
      const text = newCommentText[postId] || "";
      if (!text.trim()) return;

      try {
        const comment = await eawsApi.addComment(postId, text.trim());
        setPostComments(prev => ({
          ...prev,
          [postId]: [...(prev[postId] || []), {
            ...comment,
            user_profile: {
              full_name: userProfile?.full_name || (userRole === "police" ? "Accra Police HQ" : "Accra Medical Staging"),
              user_role: userRole,
              operator_code: userProfile?.operator_code || ""
            }
          }]
        }));

        setCommunityPosts(prev => prev.map(post => {
          if (post.id === postId) {
            return { ...post };
          }
          return post;
        }));

        setNewCommentText(prev => ({ ...prev, [postId]: "" }));
      } catch (err: any) {
        alert("Failed to post reply: " + (err.message || err));
      }
    };

    return (
      <div className="space-y-4 font-mono text-xs max-w-2xl mx-auto pb-8">
        {/* Feed Header */}
        <div className="bg-[#111112] p-4 rounded-xl border border-outline-variant flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white uppercase flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-lg animate-pulse">forum</span>
              Community Feed
            </h3>
            <p className="text-[10px] text-neutral-400 mt-0.5">X-STYLE INTEL SHARING PLATFORM</p>
          </div>
          <span className="bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded text-[8px] uppercase font-bold">
            {communityPosts.length} ACTIVE DISCUSSION POSTS
          </span>
        </div>

        {/* Citizen Search Widget */}
        <div className="bg-surface-container p-3 rounded-xl border border-outline-variant flex items-center gap-3 mb-4">
          <span className="material-symbols-outlined text-neutral-400 text-sm">search</span>
          <input 
            type="text" 
            placeholder="Lookup Citizen Profile (e.g., GH-ACR-8829-44) - Press Enter" 
            className="flex-1 bg-transparent border-none text-xs text-white placeholder-neutral-600 focus:outline-none font-sans"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.currentTarget.value) {
                e.preventDefault();
                window.open(`/citizen?id=${encodeURIComponent(e.currentTarget.value.trim())}`, '_blank');
                e.currentTarget.value = '';
              }
            }}
          />
          <span className="text-[9px] text-neutral-500 bg-neutral-800 px-2 py-1 rounded font-bold">↵</span>
        </div>

        {/* 1. Post Composer */}
        <form onSubmit={handleCreatePost} className="bg-surface-container p-4 rounded-xl border border-outline-variant space-y-3">
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold shrink-0">
              {userRole === "police" ? "AP" : "AE"}
            </div>
            <div className="flex-1">
              <textarea
                value={newPostText}
                onChange={(e) => setNewPostText(e.target.value)}
                placeholder="What is happening in your operational sector?"
                className="w-full bg-neutral-950 border border-neutral-850 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-primary placeholder-neutral-600 font-sans resize-none"
                rows={3}
              />
            </div>
          </div>

          {/* Composer Media Preview */}
          {attachedMedia && (
            <div className="ml-11 relative bg-neutral-950 p-2 rounded-lg border border-neutral-850 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-sm">
                  {attachedMedia.type === "image" ? "image" : attachedMedia.type === "video" ? "videocam" : "audiotrack"}
                </span>
                <span className="text-[9px] text-neutral-400 capitalize">
                  {attachedMedia.type} attachment preview loaded
                </span>
              </div>
              <button 
                type="button" 
                onClick={() => setAttachedMedia(null)}
                className="text-neutral-500 hover:text-white transition-colors"
              >
                <span className="material-symbols-outlined text-xs">close</span>
              </button>
            </div>
          )}

          {/* Composer Controls */}
          <div className="flex items-center justify-between ml-11 pt-1">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setAttachedMedia({
                  type: "image",
                  url: "https://images.unsplash.com/photo-1599733589046-9b8308b5b50d?w=400&auto=format&fit=crop&q=80"
                })}
                className="p-1.5 bg-neutral-950 rounded hover:bg-neutral-900 border border-neutral-850 text-neutral-400 hover:text-white transition-colors flex items-center justify-center"
                title="Attach Scene Photo"
              >
                <span className="material-symbols-outlined text-sm">image</span>
              </button>
              <button
                type="button"
                onClick={() => setAttachedMedia({
                  type: "video",
                  url: "https://assets.mixkit.co/videos/preview/mixkit-rain-on-a-window-sill-of-a-house-11326-large.mp4"
                })}
                className="p-1.5 bg-neutral-950 rounded hover:bg-neutral-900 border border-neutral-850 text-neutral-400 hover:text-white transition-colors flex items-center justify-center"
                title="Attach Drone Video"
              >
                <span className="material-symbols-outlined text-sm">videocam</span>
              </button>
              <button
                type="button"
                onClick={() => setAttachedMedia({
                  type: "audio",
                  url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3"
                })}
                className="p-1.5 bg-neutral-950 rounded hover:bg-neutral-900 border border-neutral-850 text-neutral-400 hover:text-white transition-colors flex items-center justify-center"
                title="Attach Audio Dispatch"
              >
                <span className="material-symbols-outlined text-sm">audiotrack</span>
              </button>
            </div>

            <button
              type="submit"
              disabled={!newPostText.trim() && !attachedMedia}
              className="bg-primary text-on-primary font-bold px-4 py-1.5 rounded uppercase text-[10px] transition-all hover:brightness-110 active:scale-95 disabled:opacity-40 disabled:scale-100"
            >
              Publish Post
            </button>
          </div>
        </form>

        {/* 2. Posts Timeline */}
        <div className="space-y-4">
          {communityPosts.map(post => (
            <div key={post.id} className="bg-[#111112] border border-neutral-850 rounded-xl p-4 space-y-3">
              {/* Post Header */}
              <div className="flex items-center gap-3">
                <a href={`/citizen?id=${post.username}`} target="_blank" className="w-8 h-8 rounded-full bg-neutral-800 text-white font-bold flex items-center justify-center shrink-0 hover:ring-2 hover:ring-primary transition-all cursor-pointer">
                  {post.avatar}
                </a>
                <div>
                  <div className="flex items-center gap-1.5">
                    <a href={`/citizen?id=${post.username}`} target="_blank" className="font-bold text-white text-xs leading-none hover:underline hover:text-primary transition-colors cursor-pointer">{post.author}</a>
                    <a href={`/citizen?id=${post.username}`} target="_blank" className="text-[10px] text-neutral-500 font-sans hover:text-primary transition-colors cursor-pointer">@{post.username}</a>
                  </div>
                  <span className="text-[8px] text-neutral-500 mt-0.5 block">{post.time}</span>
                </div>
              </div>

              {/* Post Content */}
              <p className="text-neutral-250 font-sans text-xs leading-relaxed break-words">{post.content}</p>

              {/* Post Media Attachments */}
              {post.media && (
                <div className="border border-neutral-850 rounded-lg overflow-hidden bg-black max-w-full">
                  {post.media.type === "image" && (
                    <img 
                      src={post.media.url} 
                      alt="Post media attachment" 
                      className="w-full h-auto max-h-72 object-cover"
                    />
                  )}
                  {post.media.type === "video" && (
                    <video 
                      src={post.media.url} 
                      className="w-full max-h-72" 
                      controls 
                    />
                  )}
                  {post.media.type === "audio" && (
                    <div className="p-3 bg-neutral-900/60 flex flex-col gap-2">
                      <span className="text-[8px] text-primary uppercase font-bold flex items-center gap-1">
                        <span className="material-symbols-outlined text-[10px]">audiotrack</span>
                        Audio Broadcast Wave
                      </span>
                      <audio 
                        src={post.media.url} 
                        className="w-full h-8" 
                        controls 
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Post Actions Bar */}
              <div className="flex items-center justify-start gap-8 pt-2 border-t border-neutral-850/60 text-neutral-400">
                <button
                  onClick={() => setActiveCommentPostId(activeCommentPostId === post.id ? null : post.id)}
                  className={`flex items-center gap-1.5 hover:text-white transition-colors ${
                    activeCommentPostId === post.id ? "text-white" : ""
                  }`}
                >
                  <span className="material-symbols-outlined text-sm">chat_bubble</span>
                  <span className="text-[10px] font-sans">{post.comments.length}</span>
                </button>

                <button
                  onClick={() => handleResharePost(post.id)}
                  className={`flex items-center gap-1.5 transition-colors ${
                    post.resharedByMe ? "text-emerald-400 hover:text-emerald-355" : "hover:text-white"
                  }`}
                >
                  <span className="material-symbols-outlined text-sm">autorenew</span>
                  <span className="text-[10px] font-sans">{post.reshares}</span>
                </button>

                <button
                  onClick={() => handleLikePost(post.id)}
                  className={`flex items-center gap-1.5 transition-colors ${
                    post.likedByMe ? "text-red-500 hover:text-red-400" : "hover:text-white"
                  }`}
                >
                  <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: post.likedByMe ? "'FILL' 1" : undefined }}>
                    favorite
                  </span>
                  <span className="text-[10px] font-sans">{post.likes}</span>
                </button>
              </div>

              {/* Comments Section Drawer */}
              {activeCommentPostId === post.id && (
                <div className="pt-3 border-t border-neutral-850/60 space-y-3">
                  {/* Comments list */}
                  {(() => {
                    const commentsForPost = postComments[post.id] || [];
                    if (commentsForPost.length === 0) return (
                      <div className="text-[10px] text-neutral-500 text-center py-2 bg-black/10 rounded-lg font-sans">
                        Be the first to reply!
                      </div>
                    );
                    return (
                      <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-1 bg-black/25 p-2 rounded-lg">
                        {commentsForPost.map((c) => {
                          const commenterName = c.user_profile?.full_name || "Official Operator";
                          const commenterCode = c.user_profile?.operator_code || "";
                          const commenterUser = commenterCode ? commenterCode : commenterName.toLowerCase().replace(/\s+/g, "");

                          const minsAgo = Math.max(1, Math.round((Date.now() - new Date(c.created_at).getTime()) / 60000));
                          const relativeTime = minsAgo < 60 ? `${minsAgo}m ago` : `${Math.round(minsAgo / 60)}h ago`;

                          return (
                            <div key={c.id} className="text-[10px] bg-neutral-900/40 p-2 rounded border border-neutral-850/50 space-y-1.5">
                              <div className="flex justify-between items-center text-[8px] text-neutral-500 font-mono">
                                <span className="font-bold text-neutral-300">@{commenterUser}</span>
                                <span>{relativeTime}</span>
                              </div>
                              <p className="text-neutral-250 font-sans">{c.content}</p>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}

                  {/* Comment Composer */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newCommentText[post.id] || ""}
                      onChange={(e) => setNewCommentText(prev => ({ ...prev, [post.id]: e.target.value }))}
                      placeholder="Post your reply..."
                      className="flex-1 bg-neutral-950 border border-neutral-850 rounded px-2.5 py-1.5 text-[10px] text-white focus:outline-none focus:border-primary placeholder-neutral-600 font-sans"
                    />

                    <button
                      onClick={() => handleAddComment(post.id)}
                      disabled={!(newCommentText[post.id] || "").trim()}
                      className="bg-primary text-on-primary font-bold px-3 rounded text-[9px] uppercase hover:brightness-110 active:scale-95 disabled:opacity-40 disabled:scale-100 font-sans"
                    >
                      Reply
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderAnalyticsTab = () => {
    return (
      <div className="space-y-6 font-mono text-xs max-w-4xl mx-auto">
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-surface-container border border-outline-variant p-4 rounded-xl">
            <span className="text-[10px] text-neutral-400 font-bold block uppercase">Mean Response Time</span>
            <span className="text-2xl font-black text-white mt-1 block">4m 12s</span>
            <span className="text-[9px] text-emerald-400 mt-1 block">▼ 18% improvement from last week</span>
          </div>
          <div className="bg-surface-container border border-outline-variant p-4 rounded-xl">
            <span className="text-[10px] text-neutral-400 font-bold block uppercase">Total Dispatched Incidents</span>
            <span className="text-2xl font-black text-white mt-1 block">{queue.length * 3 + 12}</span>
            <span className="text-[9px] text-neutral-500 mt-1 block">Active tracking in Region-01</span>
          </div>
          <div className="bg-surface-container border border-outline-variant p-4 rounded-xl">
            <span className="text-[10px] text-neutral-400 font-bold block uppercase">Escalation Frequency</span>
            <span className="text-2xl font-black text-red-500 mt-1 block">2%</span>
            <span className="text-[9px] text-neutral-500 mt-1 block">Operational thresholds nominal</span>
          </div>
        </div>

        <div className="bg-[#111112] border border-outline-variant rounded-xl p-4 space-y-4">
          <h4 className="font-bold text-white uppercase text-xs border-b border-neutral-850 pb-2">Operational Analytics Summary</h4>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-[10px] mb-1">
                <span>MEDICAL / EMERGENCY CALLS</span>
                <span>65%</span>
              </div>
              <div className="h-2 bg-neutral-900 rounded-full overflow-hidden">
                <div className="h-full bg-primary" style={{ width: "65%" }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-[10px] mb-1">
                <span>CRIME / SECURITY CALLS</span>
                <span>25%</span>
              </div>
              <div className="h-2 bg-neutral-900 rounded-full overflow-hidden">
                <div className="h-full bg-secondary-container" style={{ width: "25%" }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-[10px] mb-1">
                <span>FIRE / HAZARD THREATS</span>
                <span>10%</span>
              </div>
              <div className="h-2 bg-neutral-900 rounded-full overflow-hidden">
                <div className="h-full bg-tertiary" style={{ width: "10%" }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderStatusTab = () => {
    return (
      <div className="space-y-4 font-mono text-xs max-w-xl mx-auto">
        <div className="bg-surface-container border border-outline-variant p-4 rounded-xl space-y-3">
          <h3 className="font-bold text-white uppercase text-xs border-b border-neutral-850 pb-2">System Diagnostics Overwatch</h3>
          <div className="space-y-2">
            <div className="flex justify-between items-center py-1">
              <span className="text-neutral-400">Database Connection:</span>
              <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded uppercase font-bold text-[9px]">Supabase Online</span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-neutral-400">Node Gateway Latency:</span>
              <span className="text-white font-bold">14ms (EXCELLENT)</span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-neutral-400">REST API Server Health:</span>
              <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded uppercase font-bold text-[9px]">NOMINAL</span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-neutral-400">SendGrid Email Relay:</span>
              <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded uppercase font-bold text-[9px]">ACTIVE</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderClinicalTab = () => {
    return (
      <div className="space-y-4 font-mono text-xs max-w-5xl mx-auto grid grid-cols-12 gap-6 items-start">
        {/* Left Side: Patient Profile Search & Information Card */}
        <div className="col-span-5 space-y-4">
          <div className="bg-surface-container border border-outline-variant p-4 rounded-xl space-y-3 shadow-lg">
            <h3 className="text-sm font-bold text-white uppercase flex items-center gap-1.5">
              <span className="material-symbols-outlined text-primary text-base">search</span>
              Patient Medical Search
            </h3>
            <p className="text-[10px] text-neutral-400">Search for standard medical profile files registered by citizens.</p>
            <div className="relative">
              <input
                type="text"
                value={searchMedicalQuery}
                onChange={(e) => handleSearchMedicalProfile(e.target.value)}
                placeholder="Enter patient full name..."
                className="w-full bg-[#131313] border border-outline-variant rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-primary"
              />
              {isSearchingProfile && (
                <span className="absolute right-3 top-2.5 text-[9px] text-neutral-500 animate-pulse">Searching...</span>
              )}
            </div>

            {/* Results dropdown list */}
            {searchMedicalQuery.trim() && matchedProfiles.length > 0 && (
              <div className="bg-neutral-950 border border-neutral-850 rounded-lg divide-y divide-neutral-900 max-h-48 overflow-y-auto mt-1">
                {matchedProfiles.map((p) => (
                  <div
                    key={p.user_id}
                    onClick={() => {
                      setSelectedMedicalProfile(p);
                      setSearchMedicalQuery("");
                      setMatchedProfiles([]);
                      fetchPatientIncidents(p.full_name);
                    }}
                    className="p-3 hover:bg-neutral-900 cursor-pointer flex justify-between items-center"
                  >
                    <div>
                      <h4 className="font-bold text-white text-xs">{p.full_name}</h4>
                      <p className="text-[9px] text-neutral-400 font-mono">Blood: {p.blood_group || "N/A"} · ID: {p.user_id.substring(0,8)}</p>
                    </div>
                    <span className="material-symbols-outlined text-sm text-neutral-500">chevron_right</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {selectedMedicalProfile ? (
            <div className="bg-[#111112] border border-outline-variant rounded-xl p-4 space-y-3 shadow-lg">
              <div className="flex items-center gap-3 border-b border-neutral-850 pb-2">
                <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary text-xl">
                  <span className="material-symbols-outlined">person</span>
                </div>
                <div>
                  <h4 className="font-extrabold text-white text-xs">{selectedMedicalProfile.full_name}</h4>
                  <p className="text-[9px] text-neutral-500 font-mono">TEL: {selectedMedicalProfile.phone_number || "N/A"}</p>
                </div>
              </div>

              <div className="space-y-2">
                <div>
                  <span className="text-[9px] text-neutral-500 block">BLOOD GROUP:</span>
                  <span className="text-white font-bold text-xs">{selectedMedicalProfile.blood_group || "N/A"}</span>
                </div>
                <div>
                  <span className="text-[9px] text-neutral-500 block">ALLERGIES:</span>
                  <span className="text-error font-bold text-xs uppercase">{selectedMedicalProfile.allergies || "None Reported"}</span>
                </div>
                <div>
                  <span className="text-[9px] text-neutral-500 block">CHRONIC ILLNESSES & CONDITION:</span>
                  <span className="text-white font-bold text-xs">{selectedMedicalProfile.chronic_illnesses || "None"}</span>
                </div>
                <div>
                  <span className="text-[9px] text-neutral-500 block">PREFERRED HOSPITAL:</span>
                  <span className="text-secondary-container font-bold text-xs">{selectedMedicalProfile.preferred_hospital || "N/A"}</span>
                </div>
                {selectedMedicalProfile.medical_notes && (
                  <div className="border-t border-neutral-850 pt-2">
                    <span className="text-[9px] text-neutral-500 block">ADDITIONAL MEDICAL REMARKS:</span>
                    <p className="text-neutral-305 leading-relaxed text-[10px] mt-0.5">{selectedMedicalProfile.medical_notes}</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-[#111112] border border-neutral-850 border-dashed rounded-xl p-8 text-center text-neutral-500">
              <span className="material-symbols-outlined text-3xl">medical_information</span>
              <p className="text-[10px] mt-1 uppercase">Awaiting lookup selection...</p>
            </div>
          )}
        </div>

        {/* Right Side: Responding Ambulance Logs / Incidents Timeline */}
        <div className="col-span-7 space-y-4">
          <div className="bg-surface-container border border-outline-variant p-4 rounded-xl shadow-lg">
            <h3 className="text-sm font-bold text-white uppercase flex items-center gap-1.5">
              <span className="material-symbols-outlined text-secondary-container text-base">timeline</span>
              Active Incident logs & Paramedic Reports
            </h3>
            <p className="text-[10px] text-neutral-400 mt-1">Live timeline of active/recent incidents logged for this patient profile.</p>
          </div>

          {selectedMedicalProfile ? (
            isPatientIncidentsLoading ? (
              <div className="text-center py-12 text-neutral-500 animate-pulse uppercase">
                Loading medical logs timeline...
              </div>
            ) : patientIncidents.length === 0 ? (
              <div className="bg-[#111112] border border-neutral-850 rounded-xl p-8 text-center text-neutral-500">
                No active or historical incident logs resolved for this patient.
              </div>
            ) : (
              <div className="space-y-4">
                {patientIncidents.map((inc) => {
                  const meta = inc.metadata || {};
                  return (
                    <div key={inc.id} className="p-4 bg-[#111112] border border-outline-variant rounded-xl space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="bg-neutral-800 text-neutral-300 font-bold px-1.5 py-0.5 rounded text-[8px] uppercase">
                            {inc.severity || "MEDIUM"}
                          </span>
                          <h4 className="font-bold text-white mt-1 text-xs">{inc.title}</h4>
                          <p className="text-[9px] text-neutral-500 mt-0.5">DATE: {new Date(inc.created_at).toLocaleString()}</p>
                        </div>
                        <span className={`text-[9px] px-2 py-0.5 rounded border uppercase ${
                          inc.status === "resolved"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : "bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse"
                        }`}>
                          {inc.status || "ACTIVE"}
                        </span>
                      </div>

                      {/* Vitals Summary */}
                      <div className="grid grid-cols-4 gap-2 bg-[#0A0A0A] p-2.5 rounded text-[9px] text-neutral-300 border border-neutral-850">
                        <div>
                          <span className="text-neutral-500 block">HR:</span>
                          <span className="text-error font-bold">{meta.vitals_hr || "N/A"} BPM</span>
                        </div>
                        <div>
                          <span className="text-neutral-500 block">BP:</span>
                          <span className="text-white font-bold">{meta.vitals_bp || "N/A"}</span>
                        </div>
                        <div>
                          <span className="text-neutral-500 block">SpO2:</span>
                          <span className="text-secondary-container font-bold">{meta.vitals_spo2 || "N/A"}%</span>
                        </div>
                        <div>
                          <span className="text-neutral-500 block">TARGET ER:</span>
                          <span className="text-emerald-400 font-bold truncate block">{meta.target_hospital || "UNASSIGNED"}</span>
                        </div>
                      </div>

                      {/* Paramedic notes */}
                      {meta.responder_notes && (
                        <p className="text-[10px] text-neutral-300 leading-relaxed border-t border-neutral-850 pt-2">
                          <span className="text-neutral-500 font-bold">PARAMEDIC LOGS:</span> {meta.responder_notes}
                        </p>
                      )}

                      {/* Attachments */}
                      {(meta.paramedic_audio_url || meta.paramedic_video_url) && (
                        <div className="flex gap-4 pt-2 border-t border-neutral-850 text-[9px]">
                          {meta.paramedic_audio_url && (
                            <a 
                              href={meta.paramedic_audio_url} 
                              target="_blank" 
                              rel="noreferrer"
                              className="text-primary hover:underline flex items-center gap-1 font-bold"
                            >
                              <span className="material-symbols-outlined text-xs">audiotrack</span>
                              PLAY PARAMEDIC AUDIO REPORT
                            </a>
                          )}
                          {meta.paramedic_video_url && (
                            <a 
                              href={meta.paramedic_video_url} 
                              target="_blank" 
                              rel="noreferrer"
                              className="text-secondary-container hover:underline flex items-center gap-1 font-bold"
                            >
                              <span className="material-symbols-outlined text-xs">videocam</span>
                              PLAY PARAMEDIC DIAGNOSTIC VIDEO
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            <div className="bg-[#111112] border border-neutral-850 border-dashed rounded-xl p-12 text-center text-neutral-500">
              <p className="text-[10px] uppercase">Select a patient card to populate en-route logs</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderSupportTab = () => {
    return (
      <div className="space-y-4 font-mono text-xs max-w-2xl mx-auto">
        <div className="bg-[#111112] border border-outline-variant p-5 rounded-xl space-y-3">
          <h3 className="font-bold text-white uppercase text-xs border-b border-neutral-850 pb-2">Sentinel SOP Documentation</h3>
          <p className="text-[10px] text-neutral-400 leading-relaxed uppercase">
            standard operating procedures for dispatchers, operators, and responder commanders.
          </p>
          <div className="space-y-2 text-[10px] text-neutral-355 leading-normal border-t border-neutral-850 pt-3">
            <p className="font-bold text-white">1. SOS Alert Intake Protocol</p>
            <p>Every citizen SOS trigger automatically updates the live queue with priority CRITICAL. Operators must acknowledge response within 30 seconds.</p>
            
            <p className="font-bold text-white mt-3">2. Hospital Trauma Pre-Alerts</p>
            <p>For patient emergency scenarios, dispatchers must pre-alert hospital emergency rooms using the tactical hospital panel prior to ambulance arrival.</p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0A0A0A] text-[#e5e2e1] font-sans">
      {/* 1. Left Sidebar Navigation Drawer */}
      <aside className="h-screen w-64 flex flex-col bg-surface-container border-r border-outline-variant fixed left-0 top-0 z-40 py-6 shrink-0">
        <div className="px-6 mb-8">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-primary-container flex items-center justify-center shadow-lg">
              <span className="material-symbols-outlined text-on-primary-container text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                {userRole === "police" ? "security" : "medical_services"}
              </span>
            </div>
            <div>
              <h1 className="text-sm font-bold text-on-surface leading-none uppercase tracking-wider">CENTRAL DISPATCH</h1>
              <p className="font-mono text-[9px] text-tertiary mt-1 tracking-widest">REGION-01 | ACTIVE</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-2 space-y-1">
          <button 
            onClick={() => setActiveSidebarTab("map")}
            className={`w-full flex items-center gap-4 px-4 py-2 transition-all text-left border-l-4 ${
              activeSidebarTab === "map"
                ? "bg-secondary-container text-on-secondary-container border-secondary"
                : "text-on-surface-variant hover:text-on-surface hover:bg-surface-variant border-transparent"
            }`}
          >
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>map</span>
            <span className="text-[11px] font-bold uppercase tracking-wider font-mono">Live Map</span>
          </button>
          <button 
            onClick={() => setActiveSidebarTab("incidents")}
            className={`w-full flex items-center gap-4 px-4 py-2 transition-all text-left border-l-4 ${
              activeSidebarTab === "incidents"
                ? "bg-secondary-container text-on-secondary-container border-secondary"
                : "text-on-surface-variant hover:text-on-surface hover:bg-surface-variant border-transparent"
            }`}
          >
            <span className="material-symbols-outlined">emergency_home</span>
            <span className="text-[11px] font-bold uppercase tracking-wider font-mono">Incidents</span>
          </button>
          <button 
            onClick={() => setActiveSidebarTab("resources")}
            className={`w-full flex items-center gap-4 px-4 py-2 transition-all text-left border-l-4 ${
              activeSidebarTab === "resources"
                ? "bg-secondary-container text-on-secondary-container border-secondary"
                : "text-on-surface-variant hover:text-on-surface hover:bg-surface-variant border-transparent"
            }`}
          >
            <span className="material-symbols-outlined">group_work</span>
            <span className="text-[11px] font-bold uppercase tracking-wider font-mono">Resources</span>
          </button>
          <button 
            onClick={() => setActiveSidebarTab("community")}
            className={`w-full flex items-center gap-4 px-4 py-2 transition-all text-left border-l-4 ${
              activeSidebarTab === "community"
                ? "bg-secondary-container text-on-secondary-container border-secondary"
                : "text-on-surface-variant hover:text-on-surface hover:bg-surface-variant border-transparent"
            }`}
          >
            <span className="material-symbols-outlined">rss_feed</span>
            <span className="text-[11px] font-bold uppercase tracking-wider font-mono">Community</span>
          </button>
          <button 
            onClick={() => setActiveSidebarTab("analytics")}
            className={`w-full flex items-center gap-4 px-4 py-2 transition-all text-left border-l-4 ${
              activeSidebarTab === "analytics"
                ? "bg-secondary-container text-on-secondary-container border-secondary"
                : "text-on-surface-variant hover:text-on-surface hover:bg-surface-variant border-transparent"
            }`}
          >
            <span className="material-symbols-outlined">monitoring</span>
            <span className="text-[11px] font-bold uppercase tracking-wider font-mono">Analytics</span>
          </button>
          <button 
            onClick={() => setActiveSidebarTab("clinical")}
            className={`w-full flex items-center gap-4 px-4 py-2 transition-all text-left border-l-4 ${
              activeSidebarTab === "clinical"
                ? "bg-secondary-container text-on-secondary-container border-secondary"
                : "text-on-surface-variant hover:text-on-surface hover:bg-surface-variant border-transparent"
            }`}
          >
            <span className="material-symbols-outlined">local_hospital</span>
            <span className="text-[11px] font-bold uppercase tracking-wider font-mono">Clinical Intake</span>
          </button>
        </nav>
        <div className="px-4 mt-auto space-y-4">
          <button 
            onClick={() => setShowNewIncidentModal(true)}
            className="w-full py-2.5 bg-primary-container text-on-primary-container text-[11px] font-bold uppercase tracking-wider rounded hover:brightness-110 active:opacity-80 transition-all flex items-center justify-center gap-2 shadow-lg"
          >
            <span className="material-symbols-outlined text-[18px]">add_alert</span>
            NEW INCIDENT
          </button>
          <div className="pt-4 border-t border-outline-variant space-y-1">
            <button 
              onClick={() => setActiveSidebarTab("status")}
              className={`w-full flex items-center gap-4 px-4 py-2 transition-all text-left border-l-4 ${
                activeSidebarTab === "status"
                  ? "bg-secondary-container text-on-secondary-container border-secondary"
                  : "text-on-surface-variant hover:text-on-surface hover:bg-surface-variant border-transparent"
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">security</span>
              <span className="text-[11px] font-bold uppercase tracking-wider font-mono">System Status</span>
            </button>
            <button 
              onClick={() => setActiveSidebarTab("support")}
              className={`w-full flex items-center gap-4 px-4 py-2 transition-all text-left border-l-4 ${
                activeSidebarTab === "support"
                  ? "bg-secondary-container text-on-secondary-container border-secondary"
                  : "text-on-surface-variant hover:text-on-surface hover:bg-surface-variant border-transparent"
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">help</span>
              <span className="text-[11px] font-bold uppercase tracking-wider font-mono">Support</span>
            </button>
          </div>
        </div>
      </aside>

      {/* 2. Main Content Canvas */}
      <main className="flex-1 ml-64 flex flex-col h-screen overflow-hidden bg-background tactical-grid relative">
        <div className="scanline fixed inset-0 z-10 opacity-30 pointer-events-none"></div>

        {/* Top Header Bar */}
        <header className="flex justify-between items-center px-6 w-full sticky top-0 z-50 bg-surface border-b border-outline-variant h-14 shrink-0">
          <div className="flex items-center gap-6">
            <h2 className="text-[20px] font-bold text-primary tracking-tighter">SENTINEL COMMAND</h2>
            <div className="relative group">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-base">search</span>
              <input 
                className="bg-surface-container border-none rounded-lg pl-10 pr-4 py-1.5 text-xs w-64 focus:ring-1 focus:ring-primary text-white outline-none font-mono" 
                placeholder="Search case coordinates..." 
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden md:flex flex-col items-end">
              <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest font-mono">SYS_LOG_ACTIVE</span>
              <span className="text-[9px] font-mono text-tertiary uppercase">AUTH_LEVEL: {operator}</span>
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
              alt="Dispatcher avatar"
              src={userRole === "police" 
                ? "https://lh3.googleusercontent.com/aida-public/AB6AXuAyB959pF4FMa4T-uIRaVkvvr_G3chCp7e_anIWsONQV3brSzzZxFxr3Q2im4CDMqlcr3W0fxtE17IDkx0rSaEMleLqql9Tlr-83Aq8ZnK9xcjCskKjlsyJmDOG-zr875vadNlvNrq_QNqJNa9PzQErOAy7sEWM_p5GM2UccL7cb7i6_EGyvkkBgjQSF44ErLF5X0J1GnxgOg0cU9RRW2CzZO_CLDXlfRq3U3y3c-VCP0lc_fJWwFWM0iXttVXRBUuIjiIR2rtJ38U3" 
                : "https://lh3.googleusercontent.com/aida-public/AB6AXuC1pyy9DKcQQADaQyTsuVTkRypVcMdP3oLJCR_JcsEDRqXqarm5wj4Uzbw0G-64fZj1z86jP6q0MprDb5QANArNL-GgaEo4fxeJws46-vaCYYqTSe4h-blZB6teVyLipRi-6Z1GBRlZfiZlKBvcjauM5G0ob18ilvZ8l1hes4Va3lDYzzEC31mCRD08Kt6IunhMe3eSAkvCnqqPZvdTzMbmfiMsKhRb0cDN2FywS_skU1WzWjgeUCub3PEIGjSH25Pc4xl7Eb07FBcV"}
            />
          </div>
        </header>

        {/* ========================================================================= */}
        {/* VIEW RENDERERS BASED ON THE OPERATIONAL ROLE                              */}
        {/* ========================================================================= */}

        {activeSidebarTab === "map" ? (
          <>
            {/* A. MEDICAL / AMBULANCE DASHBOARD PORTAL */}
            {userRole === "ambulance" && (
              <div className="flex-1 p-4 grid grid-cols-12 gap-4 overflow-hidden">
            {/* 1. Patient Profile & Digital Triage Status (Left Panel) */}
            <section className="col-span-4 bg-surface-container-low border border-outline-variant rounded-lg overflow-hidden flex flex-col z-20">
              <div className="p-3.5 border-b border-outline-variant bg-error-container/10 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-error critical-pulse"></div>
                  <h3 className="text-[10px] font-bold text-error tracking-wider uppercase font-mono">PRIORITY 1: IMMEDIATE</h3>
                </div>
                <span className="font-mono text-[9px] text-on-surface-variant font-bold">ID: {selectedAssignment?.id || "AWAITING"}</span>
              </div>
              <div className="flex-1 p-4 custom-scrollbar overflow-y-auto space-y-4">
                <div className="flex gap-4">
                  <div className="w-20 h-24 object-cover border border-outline-variant rounded bg-[#131313] overflow-hidden flex items-center justify-center text-neutral-500 font-mono text-[9px] relative uppercase">
                    {selectedAssignment ? (
                      <img 
                        className="w-full h-full object-cover" 
                        alt="Patient portrait"
                        src="https://lh3.googleusercontent.com/aida-public/AB6AXuBYrjztPvEBijYU6OIxwLbLM18MSUi6d279KTX2GxQeymPjIrSaBxieHVgBv3Fh9LJPshiguBhLlIetqGWmkhgSV-1yZH7Qw6LehvEwuF2QxU8GPZaK2puh7moHppQovJiaFRYP46vhvgRae9Jf0JgonauKV7vUgYOPzLHWXzTv_uzgQ3xAn4x7edHVAUqbWJNIk4-Z5cWoJdiv2cu3OmH6T_wYvRgLgpi7bPXeCOeJW-LGEpbnGqmVGiP6Zcgst9QQ9l87dSvEcyM0"
                      />
                    ) : (
                      "NO PHOTO"
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <p className="text-[9px] font-bold text-on-surface-variant font-mono">OPERATIONAL QUEUE</p>
                    <select
                      value={selectedId || ""}
                      onChange={(e) => onSelect && onSelect(e.target.value)}
                      className="w-full bg-[#131313] border border-[#3A3A3C] rounded px-2.5 py-1 text-xs text-white focus:outline-none focus:border-primary font-mono"
                    >
                      <option value="">-- SELECT CALL BEACON --</option>
                      {queue.map((item) => (
                        <option key={item.id} value={item.id}>
                          [{item.priority}] {item.title}
                        </option>
                      ))}
                    </select>
                    
                    <button 
                      onClick={fetchPatientHistory}
                      className="text-[9px] text-primary hover:underline font-mono font-bold flex items-center gap-1 mt-1"
                    >
                      <span className="material-symbols-outlined text-[12px]">history</span>
                      VIEW MEDICAL HISTORY
                    </button>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <div>
                        <p className="text-[9px] font-bold text-on-surface-variant font-mono uppercase">Heart Rate</p>
                        <input 
                          type="number"
                          value={vitalsHR}
                          onChange={(e) => setVitalsHR(e.target.value)}
                          placeholder="e.g. 128"
                          className="w-full bg-[#131313] border border-[#3A3A3C] rounded px-2.5 py-0.5 text-xs text-error font-mono font-bold"
                        />
                      </div>
                      <div>
                        <p className="text-[9px] font-bold text-on-surface-variant font-mono uppercase">SpO2 Level</p>
                        <input 
                          type="number"
                          value={vitalsSpO2}
                          onChange={(e) => setVitalsSpO2(e.target.value)}
                          placeholder="e.g. 91"
                          className="w-full bg-[#131313] border border-[#3A3A3C] rounded px-2.5 py-0.5 text-xs text-secondary-container font-mono font-bold"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2">
                  <div>
                    <p className="text-[9px] font-bold text-on-surface-variant font-mono uppercase">Blood Pressure</p>
                    <input 
                      type="text"
                      value={vitalsBP}
                      onChange={(e) => setVitalsBP(e.target.value)}
                      placeholder="e.g. 110/70"
                      className="w-full bg-[#131313] border border-[#3A3A3C] rounded px-2.5 py-0.5 text-xs text-white font-mono"
                    />
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-on-surface-variant font-mono uppercase">Patient Full Name</p>
                    <input 
                      type="text"
                      value={patientName}
                      onChange={(e) => setPatientName(e.target.value)}
                      placeholder="e.g. Kofi Mensah"
                      className="w-full bg-[#131313] border border-[#3A3A3C] rounded px-2.5 py-0.5 text-xs text-white font-mono font-bold"
                    />
                  </div>
                  <div className="relative">
                    <p className="text-[9px] font-bold text-primary font-mono uppercase">Search Citizen Medical Registry</p>
                    <input 
                      type="text"
                      value={searchMedicalQuery}
                      onChange={(e) => handleSearchMedicalProfile(e.target.value)}
                      placeholder="Type name to match medical card..."
                      className="w-full bg-[#131313] border border-primary/40 rounded px-2.5 py-1 text-xs text-white font-mono"
                    />
                    {isSearchingProfile && (
                      <span className="absolute right-2 top-6 text-[8px] text-neutral-400 font-mono animate-pulse">Searching...</span>
                    )}

                    {matchedProfiles.length > 0 && (
                      <div className="absolute left-0 right-0 top-full mt-1 bg-neutral-950 border border-neutral-800 rounded shadow-2xl z-50 divide-y divide-neutral-900 max-h-36 overflow-y-auto">
                        {matchedProfiles.map((p) => (
                          <div
                            key={p.user_id}
                            onClick={() => {
                              setPatientName(p.full_name || "");
                              setSearchMedicalQuery("");
                              setMatchedProfiles([]);
                              setSelectedMedicalProfile(p);
                              setNotesText(
                                `Medical card: Blood group: ${p.blood_group || "N/A"}. Allergies: ${p.allergies || "None"}. Chronic Illnesses: ${p.chronic_illnesses || "None"}. Preferred Hospital: ${p.preferred_hospital || "N/A"}.`
                              );
                            }}
                            className="p-2 hover:bg-neutral-850 cursor-pointer flex flex-col gap-0.5"
                          >
                            <span className="font-bold text-white text-[10px]">{p.full_name}</span>
                            <span className="text-[8px] text-neutral-400 font-mono">
                              Blood Group: {p.blood_group || "N/A"} · Disease: {p.chronic_illnesses || "None"}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-on-surface-variant font-mono uppercase">Operational Remarks &amp; Notes</p>
                    <textarea 
                      value={notesText}
                      onChange={(e) => setNotesText(e.target.value)}
                      placeholder="Enter status observations..."
                      rows={2}
                      className="w-full bg-[#131313] border border-[#3A3A3C] rounded p-2 text-xs text-white font-mono"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-[9px] font-bold text-primary font-mono uppercase">Target Emergency Room</p>
                      <select
                        value={targetHospital}
                        onChange={(e) => setTargetHospital(e.target.value)}
                        className="w-full bg-[#131313] border border-[#3A3A3C] rounded px-2.5 py-1 text-xs text-white focus:outline-none font-mono"
                      >
                        <option value="">-- SELECT TARGET ER --</option>
                        <option value="Ridge Hospital (GARH)">Ridge Hospital (GARH)</option>
                        <option value="Korle-Bu Trauma Center">Korle-Bu Trauma Center</option>
                        <option value="37 Military Hospital">37 Military Hospital</option>
                        <option value="Lekma Clinic">Lekma Clinic</option>
                      </select>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-primary font-mono uppercase">Paramedic Audio Clip</p>
                      <div className="flex items-center gap-2 mt-1">
                        {isRecordingAudio ? (
                          <div className="flex-1 flex items-center justify-between bg-error-container/20 border border-error/30 rounded px-2.5 py-1 text-xs text-error font-mono">
                            <span className="flex items-center gap-1.5 font-bold uppercase tracking-wider animate-pulse">
                              <span className="w-1.5 h-1.5 rounded-full bg-error"></span>
                              REC // {audioRecordDuration}s
                            </span>
                            <button
                              type="button"
                              onClick={stopAudioRecording}
                              className="material-symbols-outlined text-error hover:scale-110 active:scale-95 transition-all text-base"
                            >
                              stop_circle
                            </button>
                          </div>
                        ) : (
                          <div className="flex-1 flex items-center gap-1">
                            <button
                              type="button"
                              onClick={startAudioRecording}
                              className="flex items-center justify-center gap-1 bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 px-2 py-1.5 rounded text-[10px] font-bold font-mono uppercase tracking-wider transition-all"
                            >
                              <span className="material-symbols-outlined text-xs">mic</span>
                              Record
                            </button>
                            {paramedicAudioUrl ? (
                              <div className="flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2 py-1 rounded text-[9px] font-bold font-mono uppercase">
                                <button
                                  type="button"
                                  onClick={() => {
                                    alert("Playing voice dispatch stream...");
                                    const audio = new Audio(paramedicAudioUrl);
                                    audio.play().catch(() => alert("Simulating play for stream URL: " + paramedicAudioUrl));
                                  }}
                                  className="material-symbols-outlined text-xs hover:scale-110 active:scale-95 transition-all"
                                >
                                  volume_up
                                </button>
                                <span>Attached</span>
                                <button
                                  type="button"
                                  onClick={() => setParamedicAudioUrl("")}
                                  className="material-symbols-outlined text-[10px] text-error ml-1 hover:text-red-400"
                                >
                                  close
                                </button>
                              </div>
                            ) : (
                              <span className="text-[9px] text-neutral-500 italic font-mono">No Audio</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-primary font-mono uppercase">Paramedic Video/Image Clip</p>
                    <div className="mt-1">
                      <input 
                        type="file" 
                        id="paramedic-media-file" 
                        accept="video/*,image/*" 
                        className="hidden" 
                        onChange={handleMediaUpload} 
                      />
                      <label
                        htmlFor="paramedic-media-file"
                        className="flex items-center justify-center gap-1 bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 px-3 py-1.5 rounded text-[10px] font-bold font-mono uppercase tracking-wider cursor-pointer transition-all w-fit"
                      >
                        <span className="material-symbols-outlined text-xs">photo_camera</span>
                        Upload Media
                      </label>
                      {paramedicVideoUrl && (
                        <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2 py-1 rounded text-[9px] font-bold font-mono uppercase mt-1.5 w-fit">
                          <span className="material-symbols-outlined text-xs">check_circle</span>
                          <span>Attached: {paramedicVideoUrl.includes("video") ? "Video" : "Image"} Log</span>
                          <button
                            type="button"
                            onClick={() => setParamedicVideoUrl("")}
                            className="material-symbols-outlined text-[10px] text-error ml-1 hover:text-red-400"
                          >
                            close
                          </button>
                        </div>
                      )}
                  </div>
                </div>
              </div>

                <div className="bg-[#131313] p-3 rounded border border-outline-variant">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] font-bold text-primary font-mono">AI PREDICTION MODEL v4.2</p>
                    <span className="text-[9px] bg-primary/20 text-primary px-1.5 py-0.5 rounded font-mono font-bold">94% CONFIDENCE</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-on-surface-variant">Hypovolemic Shock Risk</span>
                      <span className="text-error font-bold">CRITICAL</span>
                    </div>
                    <div className="w-full bg-surface-variant h-1 rounded-full overflow-hidden">
                      <div className="bg-error h-full w-[88%]"></div>
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-[9px] font-bold text-on-surface-variant font-mono uppercase">CHIEF COMPLAINT</p>
                  <p className="text-xs text-on-surface-variant italic bg-[#131313] p-2 rounded border border-neutral-850">
                    "{selectedAssignment?.incident_description || 'Active operational beacon queue stream active. Awaiting dispatcher instructions.'}"
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={handleSaveTriage}
                    disabled={isSavingForm}
                    className="bg-primary text-on-primary py-2 rounded text-[10px] font-bold uppercase transition-all hover:brightness-110 active:scale-95 shadow font-mono"
                  >
                    {isSavingForm ? "Saving..." : "SAVE TACTICAL LOGS"}
                  </button>
                  <button 
                    onClick={() => setShowBackupModal(true)}
                    className="bg-red-650 text-white py-2 rounded text-[10px] font-bold uppercase transition-all hover:bg-red-750 active:scale-95 shadow font-mono animate-pulse"
                  >
                    REQUEST BACKUP
                  </button>
                </div>
              </div>
              <div className="p-3 bg-surface-container border-t border-outline-variant">
                <button 
                  onClick={startTeleMedCall}
                  className="w-full py-2 bg-secondary-container text-on-secondary-container text-[10px] font-bold uppercase rounded flex items-center justify-center gap-2 hover:brightness-110 active:scale-95 transition-all font-mono"
                >
                  <span className="material-symbols-outlined text-sm">videocam</span>
                  INITIATE TELE-MED LINK
                </button>
              </div>
            </section>

            {/* 2. Tactical Map (Middle/Top Panel) */}
            <section className="col-span-8 bg-surface-container-low border border-outline-variant rounded-lg overflow-hidden relative z-20 flex flex-col h-full">
              <div className="flex-1 w-full relative bg-[#1c1c1e]">
                <div className="absolute inset-0">
                  <LiveMap 
                    onAmbulanceMove={(coords) => setAmbulanceCoords(coords)}
                    center={selectedAssignment?.latitude ? [selectedAssignment.latitude, selectedAssignment.longitude || 0] : [5.6037, -0.1870]}
                    zoom={13}
                    incidents={selectedAssignment ? [{
                      id: selectedAssignment.incident_id || "1",
                      title: selectedAssignment.title,
                      description: selectedAssignment.incident_description || "",
                      category: "MEDICAL",
                      severity: selectedAssignment.priority,
                      status: selectedAssignment.status || "assigned",
                      location_name: selectedAssignment.location,
                      latitude: selectedAssignment.latitude || 5.6037,
                      longitude: selectedAssignment.longitude || -0.1870,
                      created_at: new Date().toISOString()
                    } as any] : []}
                    units={liveUnits.map((u) => ({
                      id: u.id,
                      name: u.callsign,
                      agency_type: u.agency_type || (u.callsign.startsWith("AMB") ? "ambulance" : u.callsign.startsWith("POL") ? "police" : "fire"),
                      status: u.status.toLowerCase(),
                      latitude: u.current_latitude || 5.6037,
                      longitude: u.current_longitude || -0.1870,
                      created_at: u.created_at || u.last_updated
                    }))}
                  />
                </div>
              </div>

              {/* Bottom panels (Bystander and Asset lists) */}
              <div className="h-48 border-t border-outline-variant grid grid-cols-12 shrink-0 bg-surface-container-low">
                {/* Bystander Audio Feed */}
                <div className="col-span-5 border-r border-outline-variant p-3 flex flex-col justify-between">
                  <div className="flex justify-between items-center pb-1 border-b border-neutral-850">
                    <h3 className="text-[10px] font-bold text-on-surface-variant font-mono tracking-wider">BYSTANDER AUDIO REPORT</h3>
                    <span className="text-[8px] font-mono text-neutral-500">RECEIVED: 02:14 AGO</span>
                  </div>
                  
                  <div className="flex-1 grid grid-cols-12 gap-3 mt-2">
                    {/* Left: Audio Player */}
                    <div className="col-span-8 flex flex-col justify-between h-full">
                      <div className="flex items-center gap-2 py-1">
                        <button 
                          onClick={() => setIsPlayingAudio(!isPlayingAudio)}
                          className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container shadow hover:scale-105 active:scale-95 transition-transform shrink-0"
                        >
                          <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>
                            {isPlayingAudio ? "pause" : "play_arrow"}
                          </span>
                        </button>
                        {/* Simulated Waveform animation */}
                        <div className="flex-1 h-6 flex items-center gap-0.5 overflow-hidden">
                          <div className="w-0.5 bg-primary h-4 rounded-full waveform-bar" style={{ animationDelay: "0.1s", animationPlayState: isPlayingAudio ? "running" : "paused" }}></div>
                          <div className="w-0.5 bg-primary h-2 rounded-full waveform-bar" style={{ animationDelay: "0.3s", animationPlayState: isPlayingAudio ? "running" : "paused" }}></div>
                          <div className="w-0.5 bg-primary h-3 rounded-full waveform-bar" style={{ animationDelay: "0.5s", animationPlayState: isPlayingAudio ? "running" : "paused" }}></div>
                          <div className="w-0.5 bg-primary h-5 rounded-full waveform-bar" style={{ animationDelay: "0.2s", animationPlayState: isPlayingAudio ? "running" : "paused" }}></div>
                          <div className="w-0.5 bg-primary h-1 rounded-full waveform-bar" style={{ animationDelay: "0.4s", animationPlayState: isPlayingAudio ? "running" : "paused" }}></div>
                          <div className="w-0.5 bg-primary h-4 rounded-full waveform-bar" style={{ animationDelay: "0.6s", animationPlayState: isPlayingAudio ? "running" : "paused" }}></div>
                        </div>
                        <span className="font-mono text-[9px] text-primary shrink-0">{formatAudioTime(audioProgress)}</span>
                      </div>
                      <div className="bg-[#0A0A0A] p-2 rounded border border-outline-variant flex items-start gap-1.5 min-h-[44px]">
                        <span className="material-symbols-outlined text-primary text-[12px] shrink-0 mt-0.5">transcribe</span>
                        <p className="text-[9px] text-neutral-400 leading-snug">"The victim is losing blood fast, I've applied a makeshift tourniquet..."</p>
                      </div>
                    </div>

                    {/* Right: Media Attachments */}
                    <div className="col-span-4 flex flex-col justify-between border-l border-neutral-850 pl-3 h-full">
                      <span className="text-[8px] font-bold text-neutral-500 uppercase font-mono tracking-wider">Visual Feed</span>
                      {(() => {
                        const mockPhoto = "https://images.unsplash.com/photo-1599733589046-9b8308b5b50d?w=300&auto=format&fit=crop&q=80"; // medical scene mock photo
                        return (
                          <div 
                            onClick={() => setBystanderMediaPreview({ type: "image", url: mockPhoto })}
                            className="relative flex-1 w-full bg-neutral-950 rounded border border-neutral-800 overflow-hidden cursor-pointer hover:border-primary transition-colors group mt-1.5"
                          >
                            <img 
                              src={mockPhoto} 
                              alt="Scene screenshot" 
                              className="w-full h-full object-cover opacity-60 group-hover:scale-105 group-hover:opacity-85 transition-all"
                            />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/35 group-hover:bg-black/10 transition-colors">
                              <span className="material-symbols-outlined text-white text-base bg-black/60 p-1 rounded-full">zoom_in</span>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>

                {/* Nearby Assets / Hospitals list */}
                <div className="col-span-7 p-3 flex flex-col justify-between">
                  <div className="flex items-center justify-between border-b border-neutral-850 pb-1">
                    <h3 className="text-[10px] font-bold text-on-surface-variant font-mono tracking-wider">NEARBY TRAUMA HOSPITALS</h3>
                    <div className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-tertiary animate-pulse"></span>
                      <span className="text-[9px] font-mono font-bold text-tertiary">
                        {(() => {
                          const [lat, lng] = ambulanceCoords;
                          if (lat > 5.61 && lng > -0.17) return "EAST LEGON SECTOR";
                          if (lat > 5.65 && lng < -0.22) return "AMASAMAN SECTOR";
                          return "ACCRA CENTRAL SECTOR";
                        })()}
                      </span>
                    </div>
                  </div>
                  <div className="flex-1 grid grid-cols-2 gap-2 overflow-y-auto custom-scrollbar mt-2">
                    {(() => {
                      const [lat, lng] = ambulanceCoords;
                      let activeHospitals = ACCRA_RIDGE_HOSPITALS;
                      if (lat > 5.61 && lng > -0.17) {
                        activeHospitals = ACCRA_EAST_LEGON_HOSPITALS;
                      } else if (lat > 5.65 && lng < -0.22) {
                        activeHospitals = ACCRA_AMASAMAN_HOSPITALS;
                      }

                      return activeHospitals.map((hosp) => {
                        const routing = getHospitalDistanceAndEta(hosp.coords[0], hosp.coords[1]);
                        const isAlerted = alertedHospitals[hosp.id];
                        const isCurrentlyAlerting = isAlertingHospitalId === hosp.id;
                        
                        return (
                          <div key={hosp.id} className="p-2 bg-neutral-900 border border-neutral-850 rounded flex justify-between items-center text-[10px]">
                            <div className="truncate max-w-[130px]">
                              <p className="font-bold text-white leading-tight">{hosp.name}</p>
                              <p className="text-[8px] text-neutral-400 font-mono">{routing.dist} · {routing.eta}</p>
                              <p className="text-[7px] text-neutral-500 font-mono">{hosp.phone}</p>
                            </div>
                            <button
                              onClick={() => handlePreAlertHospital(hosp.id, hosp.name)}
                              disabled={isCurrentlyAlerting || isAlerted}
                              className={`px-2 py-1 text-[8px] font-bold uppercase rounded font-mono transition-all shrink-0 ${
                                isAlerted 
                                  ? "bg-tertiary/10 text-tertiary border border-tertiary/20 cursor-default" 
                                  : "bg-red-650 hover:bg-red-750 text-white"
                              }`}
                            >
                              {isCurrentlyAlerting ? "Alerting..." : isAlerted ? "Alerted" : "ER Alert"}
                            </button>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* B. POLICE DISPATCH DASHBOARD PORTAL */}
        {userRole === "police" && (
          <div className="flex-1 p-4 grid grid-cols-12 gap-4 overflow-hidden">
            {/* Column 1: Live Incident Queue */}
            <section className="col-span-3 border-r border-outline-variant bg-surface-container-low flex flex-col overflow-hidden z-20 rounded-lg">
              <div className="p-3 bg-surface-container border-b border-outline-variant">
                <h3 className="text-[10px] font-bold text-primary font-mono tracking-wider uppercase mb-1">INCIDENT QUEUE</h3>
                <div className="flex justify-between items-center text-[10px]">
                  <span className="font-mono text-error font-bold">{queue.length} ACTIVE ALERTS</span>
                  <span className="material-symbols-outlined text-on-surface-variant text-sm cursor-pointer">filter_list</span>
                </div>
              </div>

              {/* SOS Active Alert Card */}
              {queue.filter(item => item.priority === "CRITICAL" || item.priority === "HIGH").slice(0, 1).map((item) => (
                <div key={item.id} className="p-3 bg-error-container/20 border-b-2 border-error animate-pulse m-2 rounded-lg text-xs space-y-2">
                  <div className="flex justify-between items-start">
                    <span className="bg-error text-on-error text-[9px] font-bold px-1.5 py-0.5 rounded">SOS ACTIVE</span>
                    <span className="font-mono text-[9px] text-error font-bold">{item.time}</span>
                  </div>
                  <h4 className="font-bold text-error leading-tight">{item.title}</h4>
                  <p className="text-[10px] text-on-error-container leading-relaxed truncate">{item.incident_description || "Breach reported."}</p>
                  <button 
                    onClick={() => onSelect && onSelect(item.id)} 
                    className="w-full py-1 bg-error text-on-error text-[10px] font-bold rounded hover:opacity-90 uppercase font-mono"
                  >
                    Track Bio / Deploy
                  </button>
                </div>
              ))}

              <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
                {queue.map((item) => (
                  <div 
                    key={item.id}
                    onClick={() => onSelect && onSelect(item.id)}
                    className={`p-3 rounded border transition-all cursor-pointer ${
                      selectedId === item.id 
                        ? "bg-primary-container/10 border-primary" 
                        : "bg-surface-container-high/40 border-outline-variant/30 hover:bg-surface-container-high"
                    }`}
                  >
                    <div className="flex justify-between items-start mb-1 text-[10px]">
                      <span className={`font-bold font-mono ${item.priority === "CRITICAL" || item.priority === "HIGH" ? "text-error" : "text-secondary"}`}>
                        PRIORITY {item.priority}
                      </span>
                      <span className="font-mono text-[9px] text-on-surface-variant">{item.time}</span>
                    </div>
                    <p className="font-bold text-white text-xs truncate">{item.title}</p>
                    <p className="text-[10px] text-on-surface-variant font-mono truncate">{item.location}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Column 2: Interactive Tactical Map */}
            <section className="col-span-6 bg-black relative rounded-lg overflow-hidden border border-outline-variant z-20 flex flex-col h-full">
              {/* Map UI controls */}
              <div className="absolute top-4 left-4 right-4 z-30 flex justify-between items-center">
                <div className="bg-[#0A0A0A]/90 backdrop-blur-md p-3 rounded border border-outline-variant min-w-[200px] text-xs">
                  <p className="text-[9px] font-bold text-primary font-mono uppercase">Grid Coordinates</p>
                  <p className="font-mono text-xs text-white">34.0522° N, 118.2437° W</p>
                </div>
                <button 
                  onClick={() => setShowInteractiveMap(!showInteractiveMap)}
                  className="bg-[#0A0A0A]/90 border border-outline-variant px-3 py-2 flex items-center justify-center gap-1.5 text-primary hover:brightness-110 active:scale-95 transition-all text-[10px] font-bold uppercase rounded font-mono shadow-md"
                >
                  <span className="material-symbols-outlined text-xs">map</span>
                  {showInteractiveMap ? "Mockup HUD View" : "Live GPS View"}
                </button>
              </div>

              <div className="flex-1 w-full relative bg-[#1c1c1e]">
                {!showInteractiveMap ? (
                  <div 
                    className="absolute inset-0 bg-cover bg-center grayscale opacity-40" 
                    style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuDharzit5a4CIEayfYysrD2V-ICpVcTpdH4Eyga71rN_d7zER3M1xa1r4Id2JIG9RHXbmw0VnFVpIdGveGAXuLk9LDw8D3LqSgEDelvcqQNcNRJFj9iF61zZyMNBqldNOuYPokOI55ZXq5XDxoJDZZvwouQyixytYYO_MwRU3ntJ9Vxqx6cMZwrwcHoJjsMUdcCIQAv3zxT8gzmgXPQoFL9__YbfIFFpN6qNp3hNbcaCgsYKlVqUNNntkZklZTUBrb2kRwW5pknQA7B')" }}
                  >
                    <div className="eta-label absolute" style={{ top: "35%", left: "40%" }}>UNIT-042 (RAPID)</div>
                  </div>
                ) : (
                  <div className="absolute inset-0">
                    <LiveMap 
                      center={selectedAssignment?.latitude ? [selectedAssignment.latitude, selectedAssignment.longitude || 0] : [5.6037, -0.1870]}
                      zoom={13}
                      incidents={selectedAssignment ? [{
                        id: selectedAssignment.incident_id || "1",
                        title: selectedAssignment.title,
                        description: selectedAssignment.incident_description || "",
                        category: "CRIME",
                        severity: selectedAssignment.priority,
                        status: selectedAssignment.status || "assigned",
                        location_name: selectedAssignment.location,
                        latitude: selectedAssignment.latitude || 5.6037,
                        longitude: selectedAssignment.longitude || -0.1870,
                        created_at: new Date().toISOString()
                      } as any] : []}
                      units={liveUnits.map((u) => ({
                        id: u.id,
                        name: u.callsign,
                        agency_type: u.agency_type || (u.callsign.startsWith("AMB") ? "ambulance" : u.callsign.startsWith("POL") ? "police" : "fire"),
                        status: u.status.toLowerCase(),
                        latitude: u.current_latitude || 5.6037,
                        longitude: u.current_longitude || -0.1870,
                        created_at: u.created_at || u.last_updated
                      }))}
                    />
                  </div>
                )}
              </div>

              {/* Bottom Details panel */}
              <div className="p-4 bg-surface-container/90 border-t border-outline-variant flex justify-between items-center rounded-b-lg shrink-0">
                <div className="flex gap-6 text-[10px] font-mono">
                  <div>
                    <p className="text-[9px] text-neutral-400 font-bold">GRID TARGET</p>
                    <p className="text-primary font-bold">{selectedAssignment?.location || "KUMASI HIGH-RISK Z9"}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-neutral-400 font-bold">SECTOR STATUS</p>
                    <p className="text-tertiary font-bold">LEVEL 1 STABLE</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-neutral-400 font-bold">Z-AXIS ALTITUDE</p>
                    <p className="text-white font-bold">FLOOR 4 (ROOF)</p>
                  </div>
                </div>
                <button className="flex items-center gap-1 bg-primary text-on-primary font-bold text-[10px] px-3 py-1 rounded hover:opacity-90 font-mono uppercase">
                  <span className="material-symbols-outlined text-xs">fullscreen</span>
                  Expand Tactical View
                </button>
              </div>
            </section>

            {/* Column 3: Live Comms & Community Intel */}
            <section className="col-span-3 bg-surface-container flex flex-col overflow-hidden z-20 rounded-lg">
              <div className="p-3 border-b border-outline-variant bg-surface-container-high">
                <h3 className="text-[10px] font-bold text-tertiary font-mono tracking-wider uppercase mb-1">COMMUNITY INTEL</h3>
                <div className="flex gap-3 text-[10px] font-mono">
                  <span className="text-primary border-b-2 border-primary pb-0.5 cursor-pointer uppercase">LIVE EYE</span>
                  <span className="text-neutral-500 cursor-pointer uppercase">VERIFIED</span>
                </div>
              </div>

              <div className="flex-1 p-3 overflow-y-auto custom-scrollbar space-y-4">
                {/* Live Eye bodycam window */}
                <div className="relative rounded-lg overflow-hidden border border-outline-variant bg-black">
                  <div className="absolute top-2 left-2 flex items-center gap-1 z-10">
                    <span className="w-2 h-2 bg-error rounded-full animate-pulse"></span>
                    <span className="font-mono text-[9px] text-white drop-shadow-md">LIVE: OFFICER SMITH | BC-994</span>
                  </div>
                  <div className="aspect-video bg-black overflow-hidden relative">
                    <img 
                      className="object-cover w-full h-full opacity-80" 
                      alt="Officer bodycam feed"
                      src="https://lh3.googleusercontent.com/aida-public/AB6AXuAx-Aqf91d9QdU8tHSb-J3Mvp6FayD2U--jgYx11S-_MYMbL0z3NAuWOdbBFHVsy_bS5S_ZKlk6S0H8E0ngKP5mu9JeWAxSCrX54IQVYxg38SktQdlDQejxEKNzht4_uPqD0qv8HbzyDP8XruOJg886le9KfGVBEa543qcIS7h9UrRt6c52iGdbGEz47L8Nr0d-rzUp012CmMnv9xHyrqLORF9TA5_8zNcGS6oIgmuTXA3PPrjTSrP_Md-Zq7O7cgND6fzKgWWdERRp"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
                  </div>
                  <div className="p-2 bg-surface-container-highest flex justify-between items-center text-[10px] font-mono">
                    <span className="text-neutral-400">0.14s LATENCY</span>
                    <span className="material-symbols-outlined text-sm text-neutral-400">volume_up</span>
                  </div>
                </div>

                {/* Form fields for Police Suspect & Vehicle updates */}
                {selectedAssignment && (
                  <div className="bg-surface-container-low border border-outline-variant p-3 rounded-lg space-y-3">
                    <p className="text-[10px] font-bold text-primary font-mono uppercase border-b border-outline-variant pb-1">INCIDENT SUSPECT LOGS</p>
                    
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-on-surface-variant font-mono uppercase block">Suspect Description</label>
                      <input 
                        type="text"
                        value={policeSuspect}
                        onChange={(e) => setPoliceSuspect(e.target.value)}
                        placeholder="e.g. Male, 6ft, red jacket"
                        className="w-full bg-[#131313] border border-[#3A3A3C] rounded px-2.5 py-1 text-xs text-white focus:outline-none font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-on-surface-variant font-mono uppercase block">Vehicle Details</label>
                      <input 
                        type="text"
                        value={policeVehicle}
                        onChange={(e) => setPoliceVehicle(e.target.value)}
                        placeholder="e.g. Black SUV, GR-482-26"
                        className="w-full bg-[#131313] border border-[#3A3A3C] rounded px-2.5 py-1 text-xs text-white focus:outline-none font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-on-surface-variant font-mono uppercase block">Log Observations</label>
                      <textarea
                        value={notesText}
                        onChange={(e) => setNotesText(e.target.value)}
                        placeholder="Responder observations..."
                        rows={2}
                        className="w-full bg-[#131313] border border-[#3A3A3C] rounded p-2 text-xs text-white focus:outline-none font-mono"
                      />
                    </div>

                    <button 
                      onClick={handleSaveTriage}
                      disabled={isSavingForm}
                      className="w-full bg-primary text-on-primary py-2 rounded text-[10px] font-bold uppercase transition-all hover:brightness-110 active:scale-95 font-mono shadow"
                    >
                      {isSavingForm ? "Saving..." : "COMMIT LOG UPDATES"}
                    </button>
                  </div>
                )}

                {/* Deploy Responder Unit Panel */}
                {selectedAssignment && (
                  <div className="bg-surface-container-low border border-outline-variant p-3 rounded-lg space-y-3">
                    <p className="text-[10px] font-bold text-primary font-mono uppercase border-b border-outline-variant pb-1">DEPLOY RESPONDER UNIT</p>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-on-surface-variant font-mono uppercase block">Available Patrol Units</label>
                      <select
                        value={selectedDispatchUnitId}
                        onChange={(e) => setSelectedDispatchUnitId(e.target.value)}
                        className="w-full bg-[#131313] border border-[#3A3A3C] rounded px-2.5 py-1 text-xs text-white focus:outline-none font-mono"
                      >
                        <option value="">-- SELECT TACTICAL UNIT --</option>
                        {liveUnits.filter(u => u.agency_type === "police" || u.callsign?.startsWith("POL")).map(unit => (
                          <option key={unit.id} value={unit.id}>
                            {unit.callsign} ({unit.status})
                          </option>
                        ))}
                      </select>
                    </div>
                    <button 
                      onClick={handleDispatchUnit}
                      disabled={isDispatching || !selectedDispatchUnitId}
                      className="w-full bg-secondary-container text-on-secondary-container py-2 rounded text-[10px] font-bold uppercase transition-all hover:brightness-110 active:scale-95 font-mono shadow"
                    >
                      {isDispatching ? "Dispatching Unit..." : "DEPLOY SELECTED UNIT"}
                    </button>
                  </div>
                )}

                {/* Comms Chat Console */}
                <div className="bg-surface-container-low border border-outline-variant p-3 rounded-lg flex flex-col gap-2.5">
                  <p className="text-[10px] font-bold text-tertiary font-mono uppercase">SHARED JOINT OPS ROOM</p>
                  <div className="space-y-2 max-h-36 overflow-y-auto pr-1 feed-scrollbar text-xs">
                    {chatMessages.map((msg, idx) => (
                      <div key={idx} className="bg-[#0A0A0A] p-2 rounded border border-neutral-850">
                        <div className="flex justify-between text-[8px] font-mono text-neutral-400 mb-0.5">
                          <span className="font-bold text-primary">{msg.sender}</span>
                          <span>{msg.time}</span>
                        </div>
                        <p className="text-[10px] text-neutral-200 font-sans leading-relaxed">{msg.text}</p>
                      </div>
                    ))}
                  </div>
                  <form onSubmit={handleSendChatMessage} className="flex gap-2">
                    <input 
                      className="flex-1 bg-surface-container-high border border-outline-variant text-[11px] px-2.5 py-1.5 rounded focus:outline-none text-white font-mono uppercase" 
                      placeholder="Type operational log..." 
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                    />
                    <button type="submit" className="bg-primary text-on-primary px-3 py-1.5 rounded text-[10px] font-bold uppercase active:scale-95 transition-all">Send</button>
                  </form>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* C. FIRE COMMAND DASHBOARD PORTAL (toned green and preserved) */}
        {userRole === "fire" && (
          <div className="flex-1 p-4 grid grid-cols-12 gap-4 overflow-hidden z-20">
            {/* Active Incident Header banner */}
            <div className="col-span-12 bg-error-container/20 border border-error p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden">
              <div className="flex items-center gap-3">
                <div className="bg-error text-on-error p-2 rounded flex items-center justify-center animate-pulse h-12 w-12 shrink-0">
                  <span className="material-symbols-outlined text-2xl font-bold">emergency</span>
                </div>
                <div>
                  <h2 className="text-lg font-black text-error uppercase leading-tight">FIRE: INDUSTRIAL COMPLEX B</h2>
                  <div className="flex items-center gap-1.5 mt-0.5 font-mono text-[9px] text-on-surface-variant">
                    <span className="bg-error text-on-error px-1.5 py-0.5 rounded font-bold">LEVEL 4 EMERGENCY</span>
                    <span>LOC: 5.6037° N, 0.1870° W</span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <span className="font-mono text-error font-bold text-xl block">00:42:15</span>
                <span className="text-[9px] font-bold text-on-surface-variant font-mono uppercase">Elapsed Time</span>
              </div>
            </div>

            {/* Left Column (Team Alpha vitals / Feed) */}
            <div className="col-span-4 flex flex-col gap-4">
              <div className="tactical-card p-4 rounded-xl space-y-3">
                <h3 className="text-xs font-bold text-on-surface-variant uppercase tracking-widest flex items-center gap-1.5 border-b border-outline-variant pb-2 font-mono">
                  <span className="material-symbols-outlined text-sm text-primary">rss_feed</span>
                  Operation Dispatch Queue
                </h3>
                <div className="space-y-2 max-h-[120px] overflow-y-auto feed-scrollbar text-xs">
                  {queue.map((item) => (
                    <div 
                      key={item.id}
                      onClick={() => onSelect && onSelect(item.id)}
                      className={`p-2.5 rounded border transition-colors cursor-pointer ${
                        selectedId === item.id 
                          ? "bg-primary-container/10 border-primary-container" 
                          : "bg-surface-container-high/40 border-outline-variant/30 hover:bg-surface-container-high"
                      }`}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-bold text-white truncate max-w-[170px]">{item.title}</span>
                        <span className={`text-[8px] px-1 rounded font-black font-mono ${
                          item.priority === "CRITICAL" || item.priority === "HIGH" ? "bg-error-container text-error" : "bg-secondary-container/20 text-secondary-container"
                        }`}>
                          {item.priority}
                        </span>
                      </div>
                      <p className="text-[10px] text-on-surface-variant font-mono">{item.location}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Vitals indicators */}
              <div className="bg-surface-container border border-outline-variant p-4 rounded-xl space-y-4">
                <div className="flex justify-between items-center border-b border-neutral-850 pb-2">
                  <h3 className="text-xs font-bold text-on-surface-variant flex items-center gap-1 font-mono">
                    <span className="material-symbols-outlined text-sm">person</span> TEAM ALPHA VITALS
                  </h3>
                  <span className="text-[9px] font-bold text-tertiary">[ ONLINE ]</span>
                </div>
                <div className="space-y-3 text-xs">
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-[10px] font-bold font-mono">OXYGEN LEVELS</span>
                      <span className="text-tertiary font-mono">92%</span>
                    </div>
                    <div className="h-2 bg-neutral-900 rounded-full overflow-hidden">
                      <div className="h-full bg-tertiary" style={{ width: "92%" }}></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-[10px] font-bold font-mono text-primary">EXTERNAL TEMP</span>
                      <span className="text-primary font-mono">420°C</span>
                    </div>
                    <div className="h-2 bg-neutral-900 rounded-full overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: "75%" }}></div>
                    </div>
                    <p className="text-[9px] text-primary font-mono mt-1 uppercase">Critical Heat Warning</p>
                  </div>
                </div>
              </div>

              {/* Resourcing supply meters */}
              <div className="bg-surface-container border border-outline-variant p-4 rounded-xl space-y-3">
                <h3 className="text-xs font-bold text-on-surface-variant flex items-center gap-1 font-mono">
                  <span className="material-symbols-outlined text-sm">inventory_2</span> RESOURCING
                </h3>
                <div className="space-y-3 text-xs">
                  <div>
                    <div className="flex justify-between mb-1 font-mono text-[9px]">
                      <span>WATER SUPPLY</span>
                      <span>85%</span>
                    </div>
                    <div className="h-2 bg-neutral-900 rounded-full overflow-hidden">
                      <div className="h-full bg-secondary-container" style={{ width: "85%" }}></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column (Tactical fire map & Joint Ops Comms) */}
            <div className="col-span-8 flex flex-col gap-4">
              <div className="relative bg-surface-container border border-outline-variant rounded-xl overflow-hidden flex-1 min-h-[300px]">
                <div 
                  className="absolute inset-0 bg-cover bg-center grayscale brightness-[0.3] contrast-[1.2]" 
                  style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuDaD7DArnyhrGclB8ym7nCviF3Y6oS8i18mXhDaWTbsU1h-Bnp-xAlyU4ZUDimBwPAjkBfo-pkqcTjpyBkyYfpD3L_-Wfnb4pKQ5wm2_1ZZ9A4XoofCm9YQ_O_ksQYRQeal3BpxHMqPj-mbxGbRwYvQUsSs5PXfi_pg5fObZ-Y2T7wmIPk_e2fdBvKfZoVo9qT_E7GjXDdJufeTwC4jU0Wrjt3fza1XI_WDdZVPdjzpRTyOgvD1klhaGVRnzpGDd4i5abykch-_6HKi')" }}
                ></div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full border border-primary/40 flex items-center justify-center">
                  <div className="absolute w-full h-full rounded-full border border-primary/20 animate-ping"></div>
                  <span className="text-[8px] font-bold text-primary bg-background/80 px-1 absolute -top-3 font-mono">500M PERIMETER</span>
                </div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
                  <span className="material-symbols-outlined text-primary text-2xl animate-pulse">local_fire_department</span>
                </div>
              </div>

              {/* Joint Ops chat */}
              <div className="bg-surface-container border border-outline-variant p-3 rounded-xl flex flex-col justify-between gap-2.5">
                <h3 className="text-[10px] font-bold text-on-surface-variant flex items-center gap-1.5 uppercase font-mono">
                  <span className="material-symbols-outlined text-xs">forum</span> Joint Ops Comms
                </h3>
                <div className="space-y-2 max-h-24 overflow-y-auto pr-1 feed-scrollbar text-xs">
                  {chatMessages.map((msg, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <span className="text-[9px] font-bold text-primary bg-primary/10 px-1.5 rounded">{msg.sender}</span>
                      <p className="text-[10px] text-neutral-350">
                        <span className="text-neutral-500 font-mono mr-1.5">{msg.time}</span>
                        {msg.text}
                      </p>
                    </div>
                  ))}
                </div>
                <form onSubmit={handleSendChatMessage} className="flex gap-2">
                  <input 
                    className="flex-1 bg-surface-container-low border border-[#3A3A3C] text-xs px-3 py-1.5 rounded focus:outline-none text-white font-mono uppercase" 
                    placeholder="Type operational transmission..." 
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                  />
                  <button type="submit" className="bg-primary text-on-primary px-4 py-1.5 rounded text-xs font-bold uppercase active:scale-95 transition-all">Send</button>
                </form>
              </div>
            </div>
          </div>
        )}
          </>
        ) : (
          <div className="flex-1 p-6 overflow-y-auto custom-scrollbar space-y-6 z-20">
            {activeSidebarTab === "incidents" && renderIncidentsTab()}
            {activeSidebarTab === "resources" && renderResourcesTab()}
            {activeSidebarTab === "community" && renderCommunityTab()}
            {activeSidebarTab === "analytics" && renderAnalyticsTab()}
            {activeSidebarTab === "status" && renderStatusTab()}
            {activeSidebarTab === "support" && renderSupportTab()}
            {activeSidebarTab === "clinical" && renderClinicalTab()}
          </div>
        )}

        {/* Footer Bar */}
        <footer className="h-8 bg-surface-container-lowest border-t border-outline-variant px-6 flex items-center justify-between text-[10px] font-data-mono text-on-surface-variant shrink-0 z-30">
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-tertiary"></span> SYSTEM: NOMINAL</span>
            <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">hub</span> UPLINK: 42ms</span>
          </div>
          <div>
            ENCRYPTION: AES-512 SECURED
          </div>
        </footer>
      </main>

      {/* Distress Backup Modal */}
      {showBackupModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
          <div className="bg-[#1C1C1E] border border-[#3A3A3C] rounded-xl max-w-sm w-full overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-850 px-4 py-3 bg-neutral-950/40">
              <h3 className="font-bold text-xs text-white uppercase tracking-wider">Request Tactical Backup</h3>
              <button onClick={() => setShowBackupModal(false)} className="text-neutral-500 hover:text-white transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="p-4 space-y-4 font-mono text-xs">
              <p className="text-[10px] text-neutral-400 leading-relaxed uppercase">
                This triggers a critical priority distress signal alerting all emergency responder units. Please input operational justification:
              </p>
              <textarea
                value={backupReason}
                onChange={(e) => setBackupReason(e.target.value)}
                placeholder="e.g. Armed suspect spotted / Riot containment required"
                className="w-full bg-[#0A0A0A] border border-[#3A3A3C] rounded p-2.5 text-xs text-white focus:outline-none focus:border-red-500"
                rows={3}
              />
              <button
                onClick={handleEscalate}
                disabled={isEscalating || !backupReason.trim()}
                className="w-full bg-red-650 hover:bg-red-750 text-white font-bold py-2 rounded text-xs uppercase transition-all disabled:opacity-50"
              >
                {isEscalating ? "Transmitting distress payload..." : "Broadcast Distress Beacon"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tele-Med Video Call Modal */}
      {isTeleMedActive && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
          <div className="bg-[#1C1C1E] border border-[#3A3A3C] rounded-xl max-w-lg w-full overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-850 px-4 py-3 bg-neutral-950/40">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse"></span>
                <h3 className="font-extrabold text-xs text-white uppercase tracking-wider font-mono">
                  PARAMEDIC TELE-MED FEED
                </h3>
              </div>
              <span className="text-[10px] font-mono text-neutral-400 bg-neutral-800 px-2 py-0.5 rounded">
                LATENCY: {(14 + (teleMedDuration % 3)).toFixed(0)}ms
              </span>
            </div>
            
            {/* Video Feed Workspace */}
            <div className="relative aspect-video bg-black flex items-center justify-center border-b border-neutral-850">
              {teleMedVideoStopped ? (
                <div className="text-center space-y-2">
                  <span className="material-symbols-outlined text-4xl text-neutral-600">videocam_off</span>
                  <p className="text-xs font-mono text-neutral-500 uppercase">Camera Stream Suspended</p>
                </div>
              ) : (
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  className="w-full h-full object-cover"
                />
              )}

              {/* Status overlay */}
              <div className="absolute top-3 left-3 bg-black/75 px-2 py-1 rounded text-[9px] font-mono text-white flex items-center gap-1.5 border border-neutral-800">
                <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-ping"></span>
                <span>REC // {formatAudioTime(teleMedDuration)}</span>
              </div>
              
              <div className="absolute bottom-3 right-3 bg-black/75 px-2 py-1 rounded text-[9px] font-mono text-neutral-400 border border-neutral-800">
                CLIENT_REF: {selectedAssignment?.id ? selectedAssignment.id.substring(0, 8) : "SYS-88"}
              </div>
            </div>

            {/* Dialog controls */}
            <div className="p-4 bg-neutral-950/20 flex justify-between items-center">
              <div className="flex gap-2">
                <button 
                  onClick={toggleMute}
                  className={`px-3 py-2 rounded flex items-center justify-center text-xs transition-all font-mono uppercase font-bold border ${
                    teleMedMuted 
                      ? "bg-red-500/25 text-red-500 border-red-500/30" 
                      : "bg-neutral-800 text-neutral-300 border-neutral-700 hover:bg-neutral-700"
                  }`}
                >
                  <span className="material-symbols-outlined text-sm mr-1.5">
                    {teleMedMuted ? "mic_off" : "mic"}
                  </span>
                  {teleMedMuted ? "Unmute" : "Mute"}
                </button>
                
                <button 
                  onClick={toggleVideo}
                  className={`px-3 py-2 rounded flex items-center justify-center text-xs transition-all font-mono uppercase font-bold border ${
                    teleMedVideoStopped 
                      ? "bg-red-500/25 text-red-500 border-red-500/30" 
                      : "bg-neutral-800 text-neutral-300 border-neutral-700 hover:bg-neutral-700"
                  }`}
                >
                  <span className="material-symbols-outlined text-sm mr-1.5">
                    {teleMedVideoStopped ? "videocam_off" : "videocam"}
                  </span>
                  {teleMedVideoStopped ? "Start Cam" : "Stop Cam"}
                </button>
              </div>

              <button
                onClick={stopTeleMedCall}
                className="bg-red-650 hover:bg-red-750 text-white font-bold px-5 py-2 rounded text-xs uppercase transition-all font-mono flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-sm">call_end</span>
                Disconnect
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Patient History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
          <div className="bg-[#1C1C1E] border border-[#3A3A3C] rounded-xl max-w-lg w-full overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-850 px-4 py-3 bg-neutral-950/40">
              <h3 className="font-extrabold text-xs text-white uppercase tracking-wider font-mono">
                PATIENT MEDICAL HISTORY RECORDS
              </h3>
              <button onClick={() => setShowHistoryModal(false)} className="text-neutral-500 hover:text-white transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="p-4 space-y-4 max-h-96 overflow-y-auto custom-scrollbar font-mono text-xs">
              {isHistoryLoading ? (
                <div className="text-center py-8 text-neutral-500 animate-pulse">
                  Querying medical registry logs...
                </div>
              ) : historicalIncidents.length === 0 ? (
                <div className="text-center py-8 text-neutral-500">
                  No historical resolved records found for this patient category.
                </div>
              ) : (
                <div className="space-y-3">
                  {historicalIncidents.map((inc) => {
                    const meta = inc.metadata || {};
                    return (
                      <div key={inc.id} className="p-3 bg-neutral-900 border border-neutral-850 rounded-lg space-y-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="bg-neutral-800 text-neutral-300 font-bold px-1.5 py-0.5 rounded text-[9px] uppercase">
                              {inc.severity || "MEDIUM"}
                            </span>
                            <h4 className="font-bold text-white mt-1 text-xs">{inc.title}</h4>
                            <p className="text-[9px] text-neutral-500 mt-0.5">DATE: {new Date(inc.created_at).toLocaleString()}</p>
                          </div>
                          <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded uppercase">
                            RESOLVED
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 bg-[#0A0A0A] p-2 rounded text-[9px] text-neutral-300">
                          <div>
                            <span className="text-neutral-500 block">HR:</span>
                            <span className="text-error font-bold">{meta.vitals_hr || "N/A"} BPM</span>
                          </div>
                          <div>
                            <span className="text-neutral-500 block">BP:</span>
                            <span className="text-white font-bold">{meta.vitals_bp || "N/A"}</span>
                          </div>
                          <div>
                            <span className="text-neutral-500 block">SpO2:</span>
                            <span className="text-secondary-container font-bold">{meta.vitals_spo2 || "N/A"}%</span>
                          </div>
                        </div>
                        {meta.responder_notes && (
                          <p className="text-[10px] text-neutral-400 leading-normal border-t border-neutral-850 pt-1.5">
                            <span className="text-neutral-500 font-bold">REMARKS:</span> {meta.responder_notes}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="p-4 bg-neutral-950/20 border-t border-neutral-850 flex justify-end">
              <button
                onClick={() => setShowHistoryModal(false)}
                className="bg-neutral-800 border border-neutral-700 hover:bg-neutral-700 text-neutral-300 font-bold px-4 py-2 rounded text-xs uppercase font-mono"
              >
                Close Logs
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Incident Manual Dispatcher Modal */}
      {showNewIncidentModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
          <div className="bg-[#1C1C1E] border border-[#3A3A3C] rounded-xl max-w-md w-full overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-850 px-4 py-3 bg-neutral-950/40">
              <h3 className="font-extrabold text-xs text-white uppercase tracking-wider font-mono">
                MANUAL EMERGENCY INTAKE DISPATCH
              </h3>
              <button 
                onClick={() => setShowNewIncidentModal(false)}
                className="text-neutral-500 hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleCreateIncident} className="p-4 space-y-4 font-mono text-xs">
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-on-surface-variant uppercase block">Incident Alert Title</label>
                <input 
                  type="text"
                  required
                  value={newIncidentTitle}
                  onChange={(e) => setNewIncidentTitle(e.target.value)}
                  placeholder="e.g. Armed robbery at East Legon / Severe Cardiac Arrest"
                  className="w-full bg-[#0A0A0A] border border-[#3A3A3C] rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-on-surface-variant uppercase block">Agency Category</label>
                  <select
                    value={newIncidentCategory}
                    onChange={(e) => setNewIncidentCategory(e.target.value)}
                    className="w-full bg-[#0A0A0A] border border-[#3A3A3C] rounded px-3 py-2 text-xs text-white focus:outline-none"
                  >
                    <option value="MEDICAL">MEDICAL (Ambulance)</option>
                    <option value="CRIME">CRIME (Police)</option>
                    <option value="FIRE">FIRE (Fire Service)</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-on-surface-variant uppercase block">Urgency Severity</label>
                  <select
                    value={newIncidentSeverity}
                    onChange={(e) => setNewIncidentSeverity(e.target.value)}
                    className="w-full bg-[#0A0A0A] border border-[#3A3A3C] rounded px-3 py-2 text-xs text-white focus:outline-none"
                  >
                    <option value="CRITICAL">CRITICAL (Priority 1)</option>
                    <option value="HIGH">HIGH (Priority 2)</option>
                    <option value="MEDIUM">MEDIUM (Priority 3)</option>
                    <option value="LOW">LOW (Priority 4)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-bold text-on-surface-variant uppercase block">Location Name / Sector</label>
                <input 
                  type="text"
                  required
                  value={newIncidentLocation}
                  onChange={(e) => setNewIncidentLocation(e.target.value)}
                  placeholder="e.g. Accra Mall Main entrance / Boundary Rd"
                  className="w-full bg-[#0A0A0A] border border-[#3A3A3C] rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-bold text-on-surface-variant uppercase block">Operator Remarks / Description</label>
                <textarea
                  value={newIncidentDesc}
                  onChange={(e) => setNewIncidentDesc(e.target.value)}
                  placeholder="Details logged by operator..."
                  className="w-full bg-[#0A0A0A] border border-[#3A3A3C] rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-primary"
                  rows={3}
                />
              </div>

              <div className="pt-2 border-t border-neutral-850 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewIncidentModal(false)}
                  className="bg-neutral-800 border border-neutral-700 hover:bg-neutral-700 text-neutral-300 font-bold px-4 py-2 rounded text-xs uppercase"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingIncident}
                  className="bg-primary text-on-primary font-bold px-5 py-2 rounded text-xs uppercase transition-all flex items-center gap-1.5"
                >
                  {isCreatingIncident ? "Transmitting Alert..." : "Broadcast SOS Alert"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bystander Media Preview Modal */}
      {bystanderMediaPreview && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
          <div className="bg-[#1C1C1E] border border-[#3A3A3C] rounded-xl max-w-2xl w-full overflow-hidden shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-neutral-850 px-4 py-3 bg-neutral-950/40">
              <h3 className="font-bold text-xs text-white uppercase tracking-wider font-mono">Bystander Scene Attachment</h3>
              <button onClick={() => setBystanderMediaPreview(null)} className="text-neutral-500 hover:text-white transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="p-4 flex items-center justify-center bg-black/40" style={{ minHeight: "300px" }}>
              {bystanderMediaPreview.type === "image" ? (
                <img 
                  src={bystanderMediaPreview.url} 
                  alt="Bystander attachment" 
                  className="max-h-[75vh] max-w-full object-contain rounded border border-neutral-800"
                />
              ) : (
                <video 
                  src={bystanderMediaPreview.url} 
                  controls 
                  autoPlay
                  className="max-h-[75vh] max-w-full rounded border border-neutral-800"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
