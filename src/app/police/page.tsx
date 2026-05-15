import PortalDashboard from "@/components/PortalDashboard";

export default function PoliceDashboardPage() {
  return (
    <PortalDashboard
      tone="blue"
      portal="Police"
      subtitle="Police response coordination"
      operator="Police Unit POL-0021"
      badge="Law enforcement portal"
      stats={[
        { label: "Active patrols", value: "18", detail: "Units available across Accra metro" },
        { label: "Open cases", value: "7", detail: "Awaiting officer acknowledgement" },
        { label: "Avg. arrival", value: "8m", detail: "Current urban response estimate" },
      ]}
      queueTitle="Police Assignments"
      queue={[
        {
          title: "Crowd control request",
          location: "Kwame Nkrumah Circle",
          priority: "High",
          time: "3m ago",
        },
        {
          title: "Traffic incident",
          location: "37 Military Hospital Road",
          priority: "Medium",
          time: "11m ago",
        },
        {
          title: "Follow-up welfare check",
          location: "Osu Oxford Street",
          priority: "Routine",
          time: "24m ago",
        },
      ]}
      actions={["Acknowledge assignment", "Request backup", "Mark scene secured"]}
    />
  );
}
