"use client";

import PortalDashboard from "@/components/PortalDashboard";

export default function FireDashboardPage() {
  return (
    <PortalDashboard
      tone="orange"
      portal="Fire"
      subtitle="Fire service incident command"
      operator="Fire Unit FIRE-119"
      badge="Fire response portal"
      stats={[
        { label: "Engines ready", value: "9", detail: "Available for immediate dispatch" },
        { label: "Active fire calls", value: "4", detail: "Two marked as structure risk" },
        { label: "Water points", value: "16", detail: "Verified near assigned incidents" },
      ]}
      queueTitle="Fire Assignments"
      queue={[
        {
          id: "fire-1",
          title: "Market smoke report",
          location: "Makola Market",
          priority: "Critical",
          time: "2m ago",
        },
        {
          id: "fire-2",
          title: "Electrical fire alert",
          location: "Madina Zongo Junction",
          priority: "High",
          time: "9m ago",
        },
        {
          id: "fire-3",
          title: "Rescue standby",
          location: "Labadi Beach Road",
          priority: "Medium",
          time: "18m ago",
        },
      ]}
      actions={["Dispatch engine", "Request water tender", "Confirm fire contained"]}
    />
  );
}
