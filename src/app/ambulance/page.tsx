"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PortalDashboard from "@/components/PortalDashboard";
import { eawsApi } from "@/lib/api";
import type { Assignment } from "@/lib/models";

export default function AmbulanceDashboardPage() {
  const router = useRouter();
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Authenticate and verify role on mount
  useEffect(() => {
    async function checkAuth() {
      try {
        const data = await eawsApi.getMe();
        if (data.profile && ["ambulance", "admin", "super_admin"].includes(data.profile.user_role)) {
          setUserProfile(data.profile);
          setIsAuthenticated(true);
        } else {
          console.warn("Mismatched role or unauthorized access to ambulance dashboard");
          router.replace("/");
        }
      } catch (err) {
        console.error("Session verification failed for ambulance portal:", err);
        router.replace("/");
      }
    }
    checkAuth();
  }, [router]);

  async function loadAssignments() {
    try {
      const data = await eawsApi.getAssignments("ambulance");
      setAssignments(data || []);
      setError(null);
    } catch (err: any) {
      console.error("Failed to load ambulance assignments:", err);
      setError("Failed to connect to backend feed");
    }
  }

  // Poll assignments only after successful auth
  useEffect(() => {
    if (!isAuthenticated) return;

    loadAssignments();
    const interval = setInterval(loadAssignments, 5000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  async function handleAction(action: string, id: string) {
    setIsLoading(true);
    try {
      if (action === "Acknowledge assignment") {
        await eawsApi.acknowledgeResponse(id);
      } else if (action === "Request backup") {
        await eawsApi.updateAssignmentStatus(id, {
          status: "en_route",
          remarks: "Medical crew requested backup/advanced life support.",
        });
      } else if (action === "Mark resolved") {
        await eawsApi.updateAssignmentStatus(id, {
          status: "resolved",
          remarks: "Patient stabilized, transported, and assignment completed.",
        });
      }
      setSelectedId(undefined);
      await loadAssignments();
    } catch (err: any) {
      alert("Action failed: " + (err.message || err));
    } finally {
      setIsLoading(false);
    }
  }

  // Format assignments list for UI
  const queue = assignments.map((a) => {
    const minsAgo = Math.max(1, Math.round((Date.now() - new Date(a.created_at).getTime()) / 60000));
    const relativeTime = minsAgo < 60 ? `${minsAgo}m ago` : `${Math.round(minsAgo / 60)}h ago`;

    return {
      id: a.id,
      title: a.incident_title,
      location: a.location_name,
      priority: a.priority.toUpperCase(),
      time: relativeTime,
      status: a.status,
      incident_id: a.incident_id,
      incident_description: a.incident_description,
      incident_metadata: a.incident_metadata,
      latitude: a.latitude,
      longitude: a.longitude,
    };
  });

  // Calculate active cases
  const openCasesCount = assignments.filter((a) => a.status !== "resolved" && a.status !== "cancelled").length;

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center text-neutral-400 font-sans gap-2">
        <div className="h-6 w-6 rounded-full border-2 border-neutral-600 border-t-white animate-spin" />
        <p className="text-xs font-semibold tracking-wider">Verifying official credentials...</p>
      </div>
    );
  }

  return (
    <PortalDashboard
      tone="red"
      portal="Ambulance"
      subtitle="Emergency medical response coordination"
      operator={userProfile ? `${userProfile.full_name} (${userProfile.operator_code || "AMB-CREW"})` : "Ambulance Crew Unit"}
      badge="Medical response portal"
      stats={[
        { label: "Active units", value: "8", detail: "Ambulance crews on shift" },
        { label: "Open assignments", value: String(openCasesCount), detail: error || "Real-time dispatch connection active" },
        { label: "Avg. triage to dispatch", value: "4.5m", detail: "Average response dispatch time" },
      ]}
      queueTitle="Ambulance Assignments"
      queue={queue}
      actions={["Acknowledge assignment", "Request backup", "Mark resolved"]}
      selectedId={selectedId}
      onSelect={setSelectedId}
      onAction={handleAction}
      isActionLoading={isLoading}
      userRole="ambulance"
      userProfile={userProfile}
      onRefresh={loadAssignments}
    />
  );
}
