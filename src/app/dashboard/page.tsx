"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  MapPin, Activity, Phone, Send,
  ChevronRight, MessageSquare, CheckCircle2,
  Zap, Heart, PanelLeftClose, PanelRightClose, PanelRightOpen
} from "lucide-react";
import { eawsApi, isLocalTestApi } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import type { AgencyUnit, Incident } from "@/lib/models";
import SentinelShell from "@/components/SentinelShell";
import { insforge } from "@/lib/insforge";

const LiveMap = dynamic(() => import("@/components/Map"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-neutral-950 text-neutral-500">
      <p className="text-xs font-mono tracking-widest animate-pulse">Initializing Secure Map Feed...</p>
    </div>
  ),
});

function timeAgo(iso: string) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  return `${Math.round(mins / 60)}h ago`;
}

const SEVERITY_ORDER: Record<string, number> = {
  critical: 4,
  high: 3,
  warning: 3,
  medium: 2,
  low: 1,
  "pending triage": 0,
};

function sortIncidentsByPriority(items: Incident[]) {
  return [...items].sort((a, b) => {
    const aIsSos = a.category.toLowerCase() === "sos";
    const bIsSos = b.category.toLowerCase() === "sos";
    if (aIsSos !== bIsSos) return aIsSos ? -1 : 1;
    const severityDifference =
      (SEVERITY_ORDER[String(b.severity).toLowerCase()] ?? 0) -
      (SEVERITY_ORDER[String(a.severity).toLowerCase()] ?? 0);
    return severityDifference || Date.parse(a.created_at) - Date.parse(b.created_at);
  });
}

const PRIORITY_COLOR: Record<string, string> = {
  CRITICAL: "text-red-400 bg-red-500/10 border-red-500/30",
  WARNING: "text-orange-400 bg-orange-500/10 border-orange-500/30",
  MEDIUM: "text-yellow-400 bg-yellow-500/10 border-yellow-500/30",
  LOW: "text-green-400 bg-green-500/10 border-green-500/30",
  "PENDING TRIAGE": "text-neutral-400 bg-neutral-500/10 border-neutral-500/30",
};

const CLEARED_STATUSES = new Set(["resolved", "dismissed", "retracted", "merged"]);
const TEST_OPERATOR = "TEST Operator Akua Sarpong";

export default function DashboardPage() {
  const router = useRouter();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [units, setUnits] = useState<AgencyUnit[]>([]);
  const [apiStatus, setApiStatus] = useState<"live" | "unavailable">("unavailable");
  const [apiError, setApiError] = useState<string | null>(null);
  const feedSnapshotRef = useRef("");
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [isDispatching, setIsDispatching] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [showCleared, setShowCleared] = useState(false);
  const [dispatchSuccess, setDispatchSuccess] = useState<string | null>(null);
  const [messageDraft, setMessageDraft] = useState("");
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [chatFocusIncidentId, setChatFocusIncidentId] = useState<string | null>(null);
  const messageComposerRef = useRef<HTMLTextAreaElement | null>(null);
  const [resolutionOutcome, setResolutionOutcome] = useState("");
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [showResolveForm, setShowResolveForm] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [etaDraft, setEtaDraft] = useState("");
  const [toast, setToast] = useState<{ msg: string; type: "success" | "info" | "error" } | null>(null);

  // Modals state
  const [isTeleMedActive, setIsTeleMedActive] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [callSeconds, setCallSeconds] = useState(0);

  function showToast(msg: string, type: "success" | "info" | "error" = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  const loadData = useCallback(async () => {
    try {
      const [liveIncidents, liveUnits] = await Promise.all([
        eawsApi.getLiveIncidents(),
        eawsApi.getLiveUnits(),
      ]);
      const prioritizedIncidents = sortIncidentsByPriority(liveIncidents ?? []);
      const feedSnapshot = JSON.stringify(prioritizedIncidents);
      if (feedSnapshot !== feedSnapshotRef.current) {
        feedSnapshotRef.current = feedSnapshot;
        setIncidents(prioritizedIncidents);
        setSelectedIncident((prev) =>
          prioritizedIncidents.find((incident) => incident.id === prev?.id) ??
          prioritizedIncidents[0] ??
          null
        );
      }
      setUnits((previousUnits) =>
        previousUnits.length === 0 && (liveUnits ?? []).length === 0
          ? previousUnits
          : liveUnits ?? []
      );
      setApiStatus("live");
      setApiError(null);
    } catch (error) {
      setApiStatus("unavailable");
      setApiError(error instanceof Error ? error.message : "Unknown API error");
      console.error("Dashboard feed unavailable:", error);
      if (isLocalTestApi) {
        feedSnapshotRef.current = "";
        setIncidents([]);
        setUnits([]);
        setSelectedIncident(null);
      }
    }
  }, []);

  useEffect(() => {
    loadData();
    const iv = setInterval(loadData, isLocalTestApi ? 1000 : 8000);
    if (isLocalTestApi) return () => clearInterval(iv);
    // InsForge Realtime subscription
    insforge.realtime.connect().then(() => {
      insforge.realtime.subscribe("incidents");
      insforge.realtime.on("db:incidents", () => { void loadData(); });
    });
    return () => {
      clearInterval(iv);
      insforge.realtime.unsubscribe("incidents");
    };
  }, [loadData]);

  async function handleDispatch(agencyType: string, incidentOverride?: typeof selectedIncident) {
    const target = incidentOverride ?? topIncident;
    if (!target) return;
    setIsDispatching(true);
    try {
      await eawsApi.dispatchIncident(target.id, {
        agency_type: agencyType,
        priority: target.severity.toLowerCase(),
        expected_version: target.version,
      });
      setDispatchSuccess(`${agencyType.toUpperCase()} unit dispatched to ${target.location_name || "incident"}!`);
      showToast(`✅ ${agencyType.toUpperCase()} dispatched to ${target.location_name || "incident"}`, "success");
      setTimeout(() => setDispatchSuccess(null), 3000);
      loadData();
    } catch (err: any) {
      const msg = err.message?.includes('duplicate') ? 'Already dispatched to this incident.' : err.message;
      showToast(`⚠️ Dispatch failed: ${msg}`, "error");
    } finally {
      setIsDispatching(false);
    }
  }

  async function handleClaimIncident(incidentOverride?: Incident | null) {
    const incident = incidentOverride ?? topIncident;
    if (!incident || isClaiming) return;
    if (incident.assigned_to && incident.assigned_to !== TEST_OPERATOR) {
      showToast(`This case is already being handled by ${incident.assigned_to}.`, "error");
      return;
    }
    setIsClaiming(true);
    try {
      await eawsApi.claimIncident(incident.id, {
        operator_name: TEST_OPERATOR,
        expected_version: incident.version,
      });
      showToast(`You are now handling ${incident.id}.`, "success");
      await loadData();
    } catch (error) {
      showToast(
        `Could not take this case: ${error instanceof Error ? error.message : "refresh and retry."}`,
        "error",
      );
      await loadData();
    } finally {
      setIsClaiming(false);
    }
  }

  async function handleSendCitizenMessage() {
    const incident = topIncident;
    const content = messageDraft.trim();
    if (!incident || !content || isSendingMessage || !isLocalTestApi) return;
    if (incident.assigned_to && incident.assigned_to !== TEST_OPERATOR) {
      showToast(`This case is owned by ${incident.assigned_to}; message sending is disabled.`, "error");
      return;
    }
    setIsSendingMessage(true);
    try {
      await eawsApi.sendIncidentMessage(incident.id, content);
      setMessageDraft("");
      showToast("TEST update saved; the citizen app will receive it on its next poll.", "info");
      await loadData();
    } catch (error) {
      showToast(
        `Message was not saved: ${error instanceof Error ? error.message : "refresh and retry."}`,
        "error",
      );
    } finally {
      setIsSendingMessage(false);
    }
  }

  async function handleMarkEnRoute() {
    const incident = topIncident;
    if (!incident || !isLocalTestApi || isDispatching) return;
    const eta = etaDraft.trim() ? Number(etaDraft) : null;
    if (eta !== null && (!Number.isInteger(eta) || eta < 1 || eta > 180)) {
      showToast("Enter an ETA from 1 to 180 whole minutes, or leave it blank.", "error");
      return;
    }
    setIsDispatching(true);
    try {
      await eawsApi.updateIncident(incident.id, {
        status: "en_route",
        operator_name: TEST_OPERATOR,
        eta_minutes: eta,
        action: `TEST unit marked en route${eta === null ? "" : ` · ETA ${eta} min`}`,
        expected_version: incident.version,
      });
      showToast("TEST unit status updated; the citizen app will receive it on its next poll.", "success");
      await loadData();
    } catch (error) {
      showToast(
        `Status update failed: ${error instanceof Error ? error.message : "refresh and retry."}`,
        "error",
      );
      await loadData();
    } finally {
      setIsDispatching(false);
    }
  }

  async function handleMarkOnScene() {
    const incident = topIncident;
    if (!incident || !isLocalTestApi || isDispatching) return;
    setIsDispatching(true);
    try {
      await eawsApi.updateIncident(incident.id, {
        status: "on_scene",
        operator_name: TEST_OPERATOR,
        action: "TEST unit marked on scene",
        expected_version: incident.version,
      });
      showToast("TEST unit marked on scene.", "success");
      await loadData();
    } catch (error) {
      showToast(
        `Status update failed: ${error instanceof Error ? error.message : "refresh and retry."}`,
        "error",
      );
      await loadData();
    } finally {
      setIsDispatching(false);
    }
  }

  async function handleResolveIncident(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const incident = topIncident;
    const outcome = resolutionOutcome.trim();
    const notes = resolutionNotes.trim();
    if (!incident || !outcome || !notes || !isLocalTestApi || isResolving) return;
    setIsResolving(true);
    try {
      await eawsApi.updateIncident(incident.id, {
        status: "resolved",
        operator_name: TEST_OPERATOR,
        outcome,
        resolution_notes: notes,
        action: `TEST incident resolved · ${outcome}`,
        expected_version: incident.version,
      });
      setResolutionOutcome("");
      setResolutionNotes("");
      setShowResolveForm(false);
      showToast("TEST incident resolved and cleared from the active queue. Audit history retained.", "success");
      await loadData();
    } catch (error) {
      showToast(
        `Resolution failed: ${error instanceof Error ? error.message : "refresh and retry."}`,
        "error",
      );
      await loadData();
    } finally {
      setIsResolving(false);
    }
  }

  // Tele-Med call timer
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

  const visibleIncidents = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    return incidents.filter((incident) => {
      const severity = String(incident.severity).toLocaleLowerCase();
      const normalizedSeverity = severity === "warning" ? "high" : severity;
      const matchesSeverity = severityFilter === "all" || normalizedSeverity === severityFilter;
      const searchableText = [
        incident.id,
        incident.title,
        incident.description,
        incident.category,
        incident.location_name,
        incident.user_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase();
      const matchesQueue = showCleared || !CLEARED_STATUSES.has(incident.status);
      return matchesSeverity && matchesQueue && (!query || searchableText.includes(query));
    });
  }, [incidents, searchQuery, severityFilter, showCleared]);
  const clearedIncidentCount = incidents.filter((incident) =>
    CLEARED_STATUSES.has(incident.status),
  ).length;
  const topIncident =
    visibleIncidents.find((incident) => incident.id === selectedIncident?.id) ??
    visibleIncidents[0] ??
    null;
  const meta = topIncident?.metadata || {};
  const testDispatchAlreadyRecorded =
    isLocalTestApi &&
    Boolean(
      topIncident?.dispatch_unit ||
        ["dispatched", "en_route", "on_scene", "resolved", "dismissed", "retracted", "merged"].includes(
          topIncident?.status ?? "",
        ),
    );
  const dispatchDisabled =
    isDispatching || !topIncident || testDispatchAlreadyRecorded;
  const mapIncidents = visibleIncidents;
  const topIncidentOwner = topIncident?.assigned_to || null;
  const isOwnedByAnotherOperator =
    Boolean(topIncidentOwner && topIncidentOwner !== TEST_OPERATOR);

  const [isLeftOpen, setIsLeftOpen] = useState(true);
  const [isRightOpen, setIsRightOpen] = useState(true);

  const selectIncident = useCallback((incidentId: string) => {
    const found = incidents.find((incident) => incident.id === incidentId);
    if (!found) return;
    setSelectedIncident(found);
    setIsLeftOpen(true);
  }, [incidents]);

  const openReporterProfile = useCallback((incidentId: string) => {
    selectIncident(incidentId);
    setIsProfileModalOpen(true);
  }, [selectIncident]);

  const openIncidentChat = useCallback((incidentId: string) => {
    selectIncident(incidentId);
    setChatFocusIncidentId(incidentId);
  }, [selectIncident]);

  const openFullReporterProfile = useCallback((incident: Incident) => {
    if (!incident.user_id) {
      showToast("This report does not include a reporter account ID.", "error");
      return;
    }
    router.push(`/citizen?id=${encodeURIComponent(incident.user_id)}`);
  }, [router]);

  useEffect(() => {
    if (!chatFocusIncidentId || topIncident?.id !== chatFocusIncidentId || !isLeftOpen) return;
    const frame = window.requestAnimationFrame(() => {
      messageComposerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      messageComposerRef.current?.focus();
      setChatFocusIncidentId(null);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [chatFocusIncidentId, isLeftOpen, topIncident?.id]);

  const reporterProfile = topIncident?.reporter_profile;
  const reporterPhone = reporterProfile?.phone?.trim() || "";
  const reporterEmail = reporterProfile?.email?.trim() || "";
  const emergencyContacts = reporterProfile?.emergency_contacts ?? [];
  const reporterInitials = (topIncident?.user_name || "Citizen")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();

  return (
    <SentinelShell
      title="Sentinel Command"
      subtitle="Monitor citizen signals, coordinate dispatch, and broadcast updates back to the app."
      searchValue={searchQuery}
      onSearchChange={setSearchQuery}
    >
      <div className="flex h-full overflow-hidden relative">

        {/* ── LEFT PANEL: Priority Incident Card ── */}
        <div
          className="h-full overflow-y-auto bg-[#0e0e0e] border-r border-neutral-900 flex flex-col gap-0 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] z-10"
          style={{ width: isLeftOpen ? "280px" : "0px", minWidth: isLeftOpen ? "280px" : "0px", opacity: isLeftOpen ? 1 : 0, overflow: isLeftOpen ? "auto" : "hidden" }}
        >

          {/* Priority header */}
          <div className="px-4 pt-4 pb-3 border-b border-neutral-900 flex items-center justify-between">
            <div>
              <p className="text-[8px] font-bold tracking-[0.2em] text-neutral-500 uppercase mb-0.5">Priority 1 · Immediate</p>
              <h2 className="text-lg font-black text-white font-mono">{topIncident?.id || "—"}</h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded uppercase">
                {topIncident
                  ? `${String(topIncident.severity).toUpperCase()}${
                      topIncident.severity_confidence === "unverified" || topIncident.is_verified === false
                        ? " · UNVERIFIED"
                        : ""
                    }`
                  : "—"}
              </span>
              <button
                onClick={() => setIsLeftOpen(false)}
                title="Slide to Minimize Priority Panel"
                className="p-1.5 rounded-lg text-neutral-400 hover:text-white bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 transition-all flex items-center justify-center"
              >
                <PanelLeftClose size={14} />
              </button>
            </div>
          </div>

          {/* Citizen info */}
          <div className="border-b border-neutral-900">
            <button
              type="button"
              className="w-full px-4 py-3 text-left hover:bg-neutral-900/50 transition-colors"
              onClick={() => topIncident && openReporterProfile(topIncident.id)}
              disabled={!topIncident}
              aria-label="Open reporter profile"
            >
              <span className="flex justify-between items-center mb-1">
                <span className="text-[8px] font-bold tracking-widest text-neutral-600 uppercase">Reporter profile</span>
                <ChevronRight size={12} className="text-neutral-600" />
              </span>
              <span className="block text-sm font-bold text-white">
                {topIncident?.user_name || topIncident?.title?.split("—")[1]?.trim() || topIncident?.title || "Unknown Citizen"}
              </span>
              <span className="mt-1 block text-[9px] font-mono text-neutral-500">
                {topIncident?.user_id || "Reporter ID unavailable"}
              </span>
            </button>
          </div>

          {topIncident && !CLEARED_STATUSES.has(topIncident.status) && (
            <div className="px-4 py-3 border-b border-neutral-900">
              <p className="text-[8px] font-bold tracking-widest text-neutral-600 uppercase mb-2">Case ownership</p>
              {topIncidentOwner ? (
                <p className={`text-[11px] font-semibold ${isOwnedByAnotherOperator ? "text-amber-300" : "text-emerald-300"}`}>
                  {isOwnedByAnotherOperator ? `Working: ${topIncidentOwner}` : "You are handling this case"}
                </p>
              ) : (
                <button
                  type="button"
                  onClick={() => void handleClaimIncident(topIncident)}
                  disabled={isClaiming}
                  className="w-full rounded-lg border border-amber-700/60 bg-amber-950/40 px-3 py-2 text-[10px] font-bold text-amber-200 hover:bg-amber-950/70 disabled:opacity-50"
                >
                  {isClaiming ? "Taking case…" : "Take this case"}
                </button>
              )}
              {isOwnedByAnotherOperator && (
                <p className="mt-1 text-[9px] text-neutral-500">Only the assigned operator should act on this incident.</p>
              )}
            </div>
          )}

          {/* AI Prediction */}
          {meta.ai_confidence && (
            <div className="px-4 py-3 border-b border-neutral-900">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <Zap size={11} className="text-yellow-400" />
                  <span className="text-[10px] font-bold text-neutral-300">AI Prediction Model v4.2</span>
                </div>
                <span className="text-[9px] font-bold text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 px-1.5 py-0.5 rounded">
                  {meta.ai_confidence}% confidence
                </span>
              </div>
              <div className="space-y-2">
                <div>
                  <div className="flex justify-between text-[9px] mb-1">
                    <span className="text-neutral-400">{meta.ai_risk || "Risk Assessment"}</span>
                    <span className="text-red-400 font-bold uppercase">Critical</span>
                  </div>
                  <div className="h-1 rounded-full bg-neutral-800">
                    <div className="h-1 rounded-full bg-red-500" style={{ width: `${meta.ai_confidence}%` }} />
                  </div>
                </div>
                {meta.trauma_score && (
                  <div>
                    <div className="flex justify-between text-[9px] mb-1">
                      <span className="text-neutral-400">Trauma Severity Score</span>
                      <span className="text-neutral-300 font-mono">{meta.trauma_score}/15</span>
                    </div>
                    <div className="h-1 rounded-full bg-neutral-800">
                      <div className="h-1 rounded-full bg-orange-500" style={{ width: `${(meta.trauma_score / 15) * 100}%` }} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Chief Complaint */}
          {topIncident?.description && (
            <div className="px-4 py-3 border-b border-neutral-900">
              <p className="text-[8px] font-bold tracking-widest text-neutral-600 uppercase mb-1.5">Chief Complaint</p>
              <p className="text-[11px] text-neutral-300 leading-relaxed italic">
                &ldquo;{topIncident.description}&rdquo;
              </p>
            </div>
          )}

          {/* Action buttons */}
          <div className="px-4 py-3 border-b border-neutral-900 space-y-2">
            {dispatchSuccess && (
              <div className="text-[10px] text-green-400 bg-green-500/10 border border-green-500/20 rounded px-2 py-1.5">{dispatchSuccess}</div>
            )}
            <button
              className={`w-full py-2.5 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-2 ${
                isLocalTestApi
                  ? "bg-neutral-800 text-neutral-500 cursor-not-allowed"
                  : "bg-red-600 hover:bg-red-700 text-white"
              }`}
              disabled={isLocalTestApi}
              title={isLocalTestApi ? "Calling is disabled in the local test API" : "Initiate tele-medicine link"}
              onClick={() => setIsTeleMedActive(true)}
            >
            <Phone size={12} /> {isLocalTestApi ? "Call unavailable in TEST" : "Initiate Tele-Med Link"}
            </button>
            <button
              disabled={dispatchDisabled || isOwnedByAnotherOperator}
              onClick={() => handleDispatch("police", topIncident)}
              className="w-full py-2.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Send size={12} />{" "}
              {testDispatchAlreadyRecorded
                ? "TEST Dispatch already recorded"
                : isLocalTestApi
                  ? "TEST Dispatch Unit"
                  : "Dispatch Unit"}
            </button>
          </div>

          {/* Agency Dispatch Actions */}
          <div className="px-4 py-3">
            <p className="text-[8px] font-bold tracking-widest text-neutral-600 uppercase mb-3">Quick Dispatch</p>
            <p className="text-[9px] text-neutral-600 mb-3">Dispatch selected incident to a specific agency</p>
            {[
              { key: "fire", label: "Fire Service", sub: "GNFS dispatch channel", color: "bg-orange-600 hover:bg-orange-700", portal: "/fire" },
              { key: "police", label: "Police", sub: "Threat and patrol routing", color: "bg-blue-600 hover:bg-blue-700", portal: "/police" },
              { key: "ambulance", label: "Ambulance", sub: "Medical response unit", color: "bg-green-600 hover:bg-green-700", portal: "/ambulance" },
            ].map((ag) => (
              <div key={ag.key} className="py-2 border-b border-neutral-900 last:border-0">
                <div className="flex items-center justify-between mb-1.5">
                  <div>
                    <p className="text-[11px] font-semibold text-white">{ag.label}</p>
                    <p className="text-[9px] text-neutral-500">{ag.sub}</p>
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <button
                    disabled={dispatchDisabled || isOwnedByAnotherOperator}
                    onClick={() => handleDispatch(ag.key)}
                    className={`flex-1 text-[9px] font-bold text-white py-1.5 rounded transition-colors disabled:opacity-50 ${ag.color}`}
                  >
                    {testDispatchAlreadyRecorded
                      ? "TEST Dispatch already recorded"
                      : isLocalTestApi
                        ? `TEST Dispatch ${ag.label}`
                        : `Dispatch ${ag.label}`}
                  </button>
                  <button
                    onClick={() => router.push(ag.portal)}
                    className="px-2 text-[9px] font-bold bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white py-1.5 rounded transition-colors"
                  >
                    Open Portal →
                  </button>
                </div>
              </div>
            ))}
          </div>

          {topIncident && isLocalTestApi && (
            <div className="border-t border-neutral-900 px-4 py-3 space-y-3">
              <div className="flex items-center gap-2">
                <MessageSquare size={12} className="text-neutral-400" />
                <p className="text-[9px] font-bold tracking-widest text-neutral-300 uppercase">
                  Citizen updates · TEST
                </p>
              </div>
              <div className="max-h-36 space-y-2 overflow-y-auto" aria-live="polite">
                {(topIncident.messages ?? []).length === 0 ? (
                  <p className="text-[10px] text-neutral-500">No incident-thread messages yet.</p>
                ) : (
                  topIncident.messages?.map((message) => (
                    <div key={message.id} className="rounded-lg border border-neutral-800 bg-neutral-900 p-2">
                      <p className="text-[10px] text-neutral-200">{message.content}</p>
                      <p className="mt-1 text-[8px] text-neutral-500">
                        {message.sender} ·{" "}
                        {message.delivery_state === "fetched_by_citizen_app"
                          ? "Received by citizen app"
                          : message.delivery_state === "test_only_not_delivered"
                            ? "TEST only · delivery not verified"
                            : "Saved on TEST server · waiting for app poll"}
                      </p>
                    </div>
                  ))
                )}
              </div>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleSendCitizenMessage();
                }}
                className="space-y-2"
              >
                <label htmlFor="citizen-update" className="sr-only">Message citizen about this incident</label>
                <textarea
                  id="citizen-update"
                  ref={messageComposerRef}
                  value={messageDraft}
                  onChange={(event) => setMessageDraft(event.target.value)}
                  disabled={isOwnedByAnotherOperator}
                  maxLength={1000}
                  rows={3}
                  placeholder="Write a TEST update for the citizen app…"
                  className="w-full resize-y rounded-lg border border-neutral-800 bg-neutral-950 p-2 text-[10px] text-white placeholder-neutral-600"
                  required
                />
                <button
                  type="submit"
                  disabled={!messageDraft.trim() || isSendingMessage || isOwnedByAnotherOperator || CLEARED_STATUSES.has(topIncident.status)}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-neutral-800 px-3 py-2 text-[10px] font-bold text-white hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Send size={11} /> {isSendingMessage ? "Saving…" : "Send TEST update"}
                </button>
              </form>
              <p className="text-[9px] text-amber-300">
                TEST only: saved to this incident thread; no SMS or push is sent.
              </p>
              {topIncident.user_id && (
                <button
                  type="button"
                  onClick={() => openFullReporterProfile(topIncident)}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-[10px] font-bold text-neutral-200 transition-colors hover:border-neutral-500 hover:bg-neutral-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-500"
                >
                  View full profile
                </button>
              )}
            </div>
          )}

          {topIncident && isLocalTestApi && (
            <div className="border-t border-neutral-900 px-4 py-3 space-y-2">
              <p className="text-[9px] font-bold tracking-widest text-neutral-300 uppercase">
                Response status · TEST
              </p>
              {topIncident.status === "dispatched" && (
                <div className="space-y-2">
                  <p className="text-[10px] text-neutral-400">
                    Assigned: {topIncident.dispatch_unit || "TEST unit"}
                  </p>
                  <label htmlFor="test-eta" className="block text-[9px] text-neutral-500">
                    ETA in minutes (optional)
                  </label>
                  <input
                    id="test-eta"
                    type="number"
                    min={1}
                    max={180}
                    step={1}
                    value={etaDraft}
                    onChange={(event) => setEtaDraft(event.target.value)}
                    placeholder="Not provided"
                    className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-2 py-1.5 text-xs text-white"
                  />
                  <button
                    type="button"
                    disabled={isDispatching || isOwnedByAnotherOperator}
                    onClick={() => void handleMarkEnRoute()}
                    className="w-full rounded-lg bg-blue-700 px-3 py-2 text-[10px] font-bold text-white hover:bg-blue-600 disabled:opacity-50"
                  >
                    Mark TEST unit en route
                  </button>
                </div>
              )}
              {topIncident.status === "en_route" && (
                <button
                  type="button"
                  disabled={isDispatching || isOwnedByAnotherOperator}
                  onClick={() => void handleMarkOnScene()}
                  className="w-full rounded-lg bg-blue-700 px-3 py-2 text-[10px] font-bold text-white hover:bg-blue-600 disabled:opacity-50"
                >
                  Mark TEST unit on scene
                </button>
              )}
              {CLEARED_STATUSES.has(topIncident.status) ? (
                <div className="rounded-lg border border-emerald-800/60 bg-emerald-950/30 p-2 text-[10px] text-emerald-200">
                  <p className="flex items-center gap-1 font-bold">
                    <CheckCircle2 size={12} /> Resolved by {topIncident.resolved_by || topIncident.operator_name || "operator"}
                  </p>
                  {topIncident.resolved_at && (
                    <p className="mt-1">{new Date(topIncident.resolved_at).toLocaleString()}</p>
                  )}
                  {topIncident.outcome && <p className="mt-1">Outcome: {topIncident.outcome}</p>}
                  {topIncident.resolution_notes && <p className="mt-1">Notes: {topIncident.resolution_notes}</p>}
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setShowResolveForm((open) => !open)}
                    disabled={isOwnedByAnotherOperator}
                    className="w-full rounded-lg border border-emerald-800/70 bg-emerald-950/30 px-3 py-2 text-[10px] font-bold text-emerald-200 hover:bg-emerald-950/60"
                  >
                    {showResolveForm ? "Cancel resolution" : "Resolve & clear from queue"}
                  </button>
                  {showResolveForm && (
                    <form onSubmit={(event) => void handleResolveIncident(event)} className="space-y-2">
                      <label htmlFor="resolution-outcome" className="sr-only">Resolution outcome</label>
                      <input
                        id="resolution-outcome"
                        value={resolutionOutcome}
                        onChange={(event) => setResolutionOutcome(event.target.value)}
                        disabled={isOwnedByAnotherOperator}
                        maxLength={240}
                        placeholder="Outcome (required)"
                        className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-2 py-2 text-[10px] text-white placeholder-neutral-600"
                        required
                      />
                      <label htmlFor="resolution-notes" className="sr-only">Resolution notes</label>
                      <textarea
                        id="resolution-notes"
                        value={resolutionNotes}
                        onChange={(event) => setResolutionNotes(event.target.value)}
                        disabled={isOwnedByAnotherOperator}
                        maxLength={2000}
                        rows={3}
                        placeholder="Resolution notes (required)"
                        className="w-full resize-y rounded-lg border border-neutral-800 bg-neutral-950 p-2 text-[10px] text-white placeholder-neutral-600"
                        required
                      />
                      <p className="text-[9px] text-neutral-500">
                        Saved with the resolver, time, and incident history. Resolved items leave the active queue but remain in cleared items and Audit.
                      </p>
                      <button
                        type="submit"
                        disabled={isResolving || isOwnedByAnotherOperator || !resolutionOutcome.trim() || !resolutionNotes.trim()}
                        className="w-full rounded-lg bg-emerald-700 px-3 py-2 text-[10px] font-bold text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isResolving ? "Saving resolution…" : "Confirm resolution"}
                      </button>
                    </form>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* ── CENTER: Full Map ── */}
        <div className="flex-1 relative min-w-0">
          <LiveMap
            incidents={mapIncidents}
            units={units}
            selectedIncidentId={topIncident?.id}
            onSelectIncident={selectIncident}
            onOpenReporterProfile={openReporterProfile}
            onOpenIncidentChat={openIncidentChat}
          />

          {/* Floating re-open button for Dispatch Queue when closed */}
          {!isRightOpen && (
            <button
              onClick={() => setIsRightOpen(true)}
              className="absolute right-4 bottom-8 z-[1000] flex items-center gap-2.5 bg-[#141414]/95 hover:bg-[#1c1c1e] border border-red-500/70 hover:border-red-500 text-white text-[12px] font-bold px-4 py-2.5 rounded-2xl transition-all shadow-[0_0_25px_rgba(239,68,68,0.3)] hover:shadow-[0_0_30px_rgba(239,68,68,0.5)] backdrop-blur-md group"
              title="Open Dispatch Queue"
            >
              <PanelRightOpen size={16} className="text-red-400 group-hover:translate-x-0.5 transition-transform" />
              <span>Dispatch Queue</span>
              {visibleIncidents.length > 0 && (
                <span className="bg-red-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full min-w-[20px] text-center shadow">
                  {visibleIncidents.length}
                </span>
              )}
            </button>
          )}
        </div>

        {/* ── RIGHT PANEL: Dispatch Queue + System Health ── */}
        <div
          className="h-full bg-[#0e0e0e] border-l border-neutral-900 flex flex-col transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] z-10"
          style={{ width: isRightOpen ? "280px" : "0px", minWidth: isRightOpen ? "280px" : "0px", opacity: isRightOpen ? 1 : 0, overflow: isRightOpen ? "auto" : "hidden" }}
        >

          {/* Dispatch Queue */}
          <div className="px-4 pt-4 pb-2 border-b border-neutral-900">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-bold tracking-widest text-neutral-400 uppercase">Dispatch Queue</p>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-bold text-neutral-500 bg-neutral-900 border border-neutral-800 rounded px-1.5 py-0.5">
                  {visibleIncidents.length} of {incidents.length} reports
                </span>
                <button
                  onClick={() => setIsRightOpen(false)}
                  title="Slide to Minimize Dispatch Queue"
                  className="p-1.5 rounded-lg text-neutral-400 hover:text-white bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 transition-all flex items-center justify-center"
                >
                  <PanelRightClose size={14} />
                </button>
              </div>
            </div>
            <label className="block mb-3">
              <span className="sr-only">Filter reports by severity</span>
              <select
                aria-label="Filter reports by severity"
                value={severityFilter}
                onChange={(event) => setSeverityFilter(event.target.value)}
                className="w-full rounded border border-neutral-800 bg-neutral-900 px-2 py-1.5 text-[10px] text-neutral-200"
              >
                <option value="all">All priorities</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </label>
            <label className="mb-3 flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-neutral-800 bg-neutral-900/70 px-2.5 py-2 text-[10px] text-neutral-300">
              <span>Show cleared / resolved</span>
              <span className="flex items-center gap-2">
                <span className="text-neutral-500">{clearedIncidentCount}</span>
                <input
                  type="checkbox"
                  checked={showCleared}
                  onChange={(event) => setShowCleared(event.target.checked)}
                  aria-label={`Show ${clearedIncidentCount} cleared or resolved incidents`}
                  className="accent-red-600"
                />
              </span>
            </label>

            <div className="space-y-2">
              {visibleIncidents.map((inc) => (
                <article
                  key={inc.id}
                  className={`rounded-lg border p-3 transition-all hover:border-neutral-700 ${
                    selectedIncident?.id === inc.id ? "border-red-600/50 bg-red-500/5" : "border-neutral-800 bg-neutral-900/50"
                  }`}
                >
                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() => selectIncident(inc.id)}
                    aria-label={`Select ${inc.title} and focus it on the map`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="flex-1 min-w-0">
                        <p className="text-[9px] font-bold text-neutral-500 uppercase mb-0.5">
                          {String(inc.severity).toUpperCase()}
                          {inc.severity_confidence === "unverified" || inc.is_verified === false
                            ? " · UNVERIFIED"
                            : ""}
                        </p>
                        <p className="text-[11px] font-semibold text-white leading-tight truncate">{inc.title}</p>
                        <p className="text-[9px] text-neutral-500 flex items-center gap-1 mt-0.5">
                          <MapPin size={8} /> {inc.location_name || "Location unavailable"}
                        </p>
                        <p className="text-[9px] text-neutral-500 mt-1">
                          {inc.status.replaceAll("_", " ")} · Owner: {inc.assigned_to || "Unassigned"} · {timeAgo(inc.created_at)}
                        </p>
                        {(inc.latitude == null || inc.longitude == null) && (
                          <p className="mt-1 text-[9px] font-semibold text-amber-300">No location pin available</p>
                        )}
                      </div>
                      <span className={`shrink-0 text-[8px] font-bold border rounded px-1.5 py-0.5 ${PRIORITY_COLOR[String(inc.severity).toUpperCase()] || PRIORITY_COLOR["LOW"]}`}>
                        {String(inc.severity).toUpperCase() === "CRITICAL"
                          ? "CRITICAL"
                          : ["WARNING", "HIGH"].includes(String(inc.severity).toUpperCase())
                            ? "HIGH"
                            : ["LOW", "MEDIUM"].includes(String(inc.severity).toUpperCase())
                              ? String(inc.severity).toUpperCase()
                              : "TRIAGE"}
                      </span>
                    </div>
                  </button>

                  <div className="flex gap-1.5 mt-2">
                    <button
                      onClick={() => {
                        selectIncident(inc.id);
                        void handleDispatch("police", inc);
                      }}
                      disabled={isDispatching || Boolean(inc.assigned_to && inc.assigned_to !== TEST_OPERATOR)}
                      className="flex-1 text-[9px] font-bold bg-red-600 hover:bg-red-700 text-white py-1 rounded transition-colors disabled:opacity-50"
                    >
                      {isLocalTestApi ? "TEST Dispatch" : "Dispatch"}
                    </button>
                    <button
                      onClick={() => openIncidentChat(inc.id)}
                      className="flex-1 text-[9px] font-bold bg-neutral-800 text-neutral-200 py-1 rounded transition-colors hover:bg-neutral-700"
                    >
                      Open chat
                    </button>
                    {!inc.assigned_to && !CLEARED_STATUSES.has(inc.status) && (
                      <button
                        onClick={() => {
                          selectIncident(inc.id);
                          void handleClaimIncident(inc);
                        }}
                        disabled={isClaiming}
                        className="flex-1 text-[9px] font-bold bg-amber-900/70 text-amber-100 py-1 rounded transition-colors hover:bg-amber-800 disabled:opacity-50"
                      >
                        Take case
                      </button>
                    )}
                    {inc.assigned_to && (
                      <span className="self-center text-[8px] text-neutral-400" title={`Case owner: ${inc.assigned_to}`}>
                        {inc.assigned_to === TEST_OPERATOR ? "You own this" : `Owned: ${inc.assigned_to}`}
                      </span>
                    )}
                  </div>
                </article>
              ))}

              {visibleIncidents.length === 0 && (
                <p className="text-[10px] text-neutral-500 py-3" role="status">
                  {incidents.length > 0
                    ? "No reports match the current search and priority filters."
                    : apiStatus === "live"
                    ? isLocalTestApi
                      ? "No reports in the test feed."
                      : "The configured API returned no reports."
                    : isLocalTestApi
                      ? "Test feed unavailable; no sample incidents are shown."
                      : "Configured API unavailable; sample incidents are not shown."}
                </p>
              )}
            </div>
          </div>

          {/* System Health */}
          <div className="px-4 py-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-bold tracking-widest text-neutral-400 uppercase">System Health</p>
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                isLocalTestApi
                  ? "text-yellow-300 bg-yellow-500/10 border border-yellow-500/20"
                  : "text-neutral-400 bg-neutral-500/10 border border-neutral-500/20"
              }`}>
                {isLocalTestApi ? "TEST ONLY" : "Unverified"}
              </span>
            </div>
            <p className="text-[9px] text-neutral-600 mb-3">
            {isLocalTestApi ? "Local test bench · no real dispatch" : "Connectivity and fallback status"}
            </p>

            <div className="space-y-3">
            <div className="flex justify-between text-[10px]">
              <span className="text-neutral-400">Test API</span>
              <span className={`font-bold ${apiStatus === "live" ? "text-green-400" : "text-red-400"}`}>
                {apiStatus === "live" ? "Connected" : "Unavailable"}
              </span>
            </div>
            <div className="flex justify-between text-[10px]">
              <span className="text-neutral-400">Location accuracy</span>
              <span className="text-neutral-300 font-mono font-bold">Per report / unknown</span>
              </div>
            <div className="flex justify-between text-[10px]">
              <span className="text-neutral-400">Realtime / push</span>
              <span className="text-yellow-400 font-bold">Not connected</span>
            </div>
            <div className="flex justify-between text-[10px] pt-1 border-t border-neutral-900">
              <span className="text-neutral-400">SMS fallback</span>
              <span className="text-yellow-400 font-bold">Not connected</span>
            </div>
            <div className="flex justify-between text-[10px]">
              <span className="text-neutral-400">Feed source</span>
              <span className={`font-bold ${apiStatus === "live" ? "text-green-400" : "text-red-400"}`}>
                {apiStatus === "live" ? (isLocalTestApi ? "TEST API" : "Configured API") : "Unavailable"}
              </span>
            </div>
            {apiError && (
              <p className="text-[9px] text-red-300 break-words" role="status">
                {apiError}
              </p>
            )}
            </div>
          </div>
        </div>
      </div>

      {/* Global Toast Notification */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-[100] px-5 py-3 rounded-xl shadow-2xl text-sm font-semibold border backdrop-blur-md transition-all ${
          toast.type === 'success' ? 'bg-green-500/20 border-green-500/40 text-green-300' :
          toast.type === 'error' ? 'bg-red-500/20 border-red-500/40 text-red-300' :
          'bg-blue-500/20 border-blue-500/40 text-blue-300'
        }`}>
          {toast.msg}
        </div>
      )}

      {/* Tele-Med Video Call Modal */}
      {isTeleMedActive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in zoom-in duration-200">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden shadow-2xl w-full max-w-4xl flex flex-col">
            <div className="flex items-center justify-between p-4 bg-black border-b border-neutral-800">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-red-500/20 text-red-500">
                  <Heart size={16} />
                </div>
                <div>
                  <h3 className="text-white font-bold text-sm">Tele-Med Link Active</h3>
                  <p className="text-red-400 text-xs flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                    Live stream from citizen device
                  </p>
                </div>
              </div>
              <div className="text-white font-mono text-xl bg-neutral-800 px-3 py-1 rounded-md tracking-widest">
                {formatCallTime(callSeconds)}
              </div>
            </div>
            
            <div className="relative aspect-video bg-black">
              {/* Mock Video Feed */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-neutral-500">
                <Activity size={48} className="mb-4 opacity-50" />
                <p>Waiting for citizen camera permission...</p>
                <div className="mt-4 flex gap-2">
                  <div className="w-2 h-2 rounded-full bg-neutral-600 animate-bounce"></div>
                  <div className="w-2 h-2 rounded-full bg-neutral-600 animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 rounded-full bg-neutral-600 animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-black border-t border-neutral-800 flex justify-center gap-4">
              <button className="p-4 rounded-full bg-neutral-800 text-white hover:bg-neutral-700 transition">
                <Activity size={20} />
              </button>
              <button 
                onClick={() => setIsTeleMedActive(false)}
                className="px-8 py-3 rounded-full bg-red-600 text-white font-bold hover:bg-red-700 transition flex items-center gap-2"
              >
                <Phone size={18} className="rotate-[135deg]" /> End Call
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Profile Modal */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in zoom-in duration-200">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden shadow-2xl w-full max-w-md flex flex-col">
            <div className="flex items-center justify-between p-4 bg-black border-b border-neutral-800">
              <h3 className="text-white font-bold text-sm">Citizen Profile</h3>
              <button onClick={() => setIsProfileModalOpen(false)} className="text-neutral-400 hover:text-white">
                ✕
              </button>
            </div>
            
            <div className="p-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-full bg-neutral-800 flex items-center justify-center text-white text-xl font-bold">
                  {reporterInitials}
                </div>
                <div>
                  <h2 className="text-white font-bold text-lg">{topIncident?.user_name || "Unknown Citizen"}</h2>
                  <p className="text-neutral-400 text-sm break-all">ID: {topIncident?.user_id || "Not available"}</p>
                </div>
              </div>
              
              <div className="space-y-3">
                <section className="grid grid-cols-2 gap-3">
                  <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-3">
                    <p className="text-[10px] text-neutral-500 uppercase font-bold tracking-widest mb-1">Account role</p>
                    <p className="text-white text-sm">{reporterProfile?.user_role || "Citizen"}</p>
                  </div>
                  <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-3">
                    <p className="text-[10px] text-neutral-500 uppercase font-bold tracking-widest mb-1">Incident</p>
                    <p className="text-white text-sm font-mono">{topIncident?.id || "Unavailable"}</p>
                  </div>
                </section>
                <section className="bg-neutral-950 border border-neutral-800 rounded-lg p-3">
                  <p className="text-[10px] text-neutral-500 uppercase font-bold tracking-widest mb-2">Contact details</p>
                  {reporterPhone ? (
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-neutral-300">{reporterPhone}</span>
                      {isLocalTestApi ? (
                        <span className="text-[10px] text-amber-300">Calls disabled in TEST</span>
                      ) : (
                        <a href={`tel:${encodeURIComponent(reporterPhone)}`} className="rounded bg-emerald-800 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700">
                          Call citizen
                        </a>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-neutral-400">Phone number not provided by this incident feed.</p>
                  )}
                  <p className="mt-2 text-sm text-neutral-300">{reporterEmail || "Email not provided"}</p>
                  {reporterProfile?.address && (
                    <p className="mt-2 text-sm text-neutral-300">{reporterProfile.address}</p>
                  )}
                  {isLocalTestApi && !reporterPhone && (
                    <p className="mt-2 text-[10px] text-amber-300">TEST records do not contain registered contact details; no calls can be placed.</p>
                  )}
                </section>
                <section className="bg-neutral-950 border border-neutral-800 rounded-lg p-3">
                  <p className="text-[10px] text-neutral-500 uppercase font-bold tracking-widest mb-2">Emergency contacts</p>
                  {emergencyContacts.length > 0 ? (
                    <ul className="space-y-2">
                      {emergencyContacts.map((contact, index) => (
                        <li key={`${contact.name}-${index}`} className="flex items-center justify-between gap-3 text-sm">
                          <span className="text-neutral-200">
                            {contact.name}{contact.relation ? ` · ${contact.relation}` : ""}
                            {contact.phone ? <span className="block text-xs text-neutral-500">{contact.phone}</span> : null}
                          </span>
                          {contact.phone && !isLocalTestApi && (
                            <a href={`tel:${encodeURIComponent(contact.phone)}`} className="text-xs font-bold text-emerald-300 hover:text-emerald-200">Call</a>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-neutral-400">No emergency contacts were included with this report.</p>
                  )}
                </section>
                <section className="bg-neutral-950 border border-neutral-800 rounded-lg p-3">
                  <p className="text-[10px] text-neutral-500 uppercase font-bold tracking-widest mb-1">Medical information</p>
                  <p className="text-amber-300 text-sm">Masked. An authorized, audited reveal is not available in this TEST workflow.</p>
                </section>
                <section className="bg-neutral-950 border border-neutral-800 rounded-lg p-3">
                  <p className="text-[10px] text-neutral-500 uppercase font-bold tracking-widest mb-1">Current report</p>
                  <p className="text-neutral-200 text-sm">{topIncident?.title || "No report selected"}</p>
                  <p className="mt-1 text-xs text-neutral-400">{topIncident?.location_name || "Location unavailable"}</p>
                </section>
              </div>
            </div>
            
            <div className="p-4 bg-black border-t border-neutral-800 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsProfileModalOpen(false);
                  if (topIncident) openIncidentChat(topIncident.id);
                }}
                className="flex-1 py-2.5 rounded-lg bg-red-700 text-white font-bold hover:bg-red-600 transition"
                disabled={!topIncident}
              >
                <MessageSquare size={14} className="mr-2 inline" /> Chat about incident
              </button>
              {topIncident?.user_id && (
                <button
                  type="button"
                  onClick={() => openFullReporterProfile(topIncident)}
                  className="flex-1 rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-xs font-bold text-neutral-200 transition hover:bg-neutral-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-500"
                >
                  View full profile
                </button>
              )}
              <button 
                type="button"
                onClick={() => setIsProfileModalOpen(false)}
                className="px-4 py-2.5 rounded-lg bg-neutral-800 text-white font-bold hover:bg-neutral-700 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </SentinelShell>
  );
}
