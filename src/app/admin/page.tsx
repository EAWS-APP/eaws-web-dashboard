import PortalDashboard from "@/components/PortalDashboard";

export default function AdminDashboardPage() {
  return (
    <PortalDashboard
      tone="purple"
      portal="Admin"
      subtitle="System oversight and agency governance"
      operator="Admin admin@eaws.gov.gh"
      badge="National administration portal"
      stats={[
        { label: "Verified users", value: "2,418", detail: "Citizen profiles linked to ID records" },
        { label: "Connected agencies", value: "12", detail: "Police, Fire, Ambulance, and NADMO nodes" },
        { label: "System uptime", value: "99.9%", detail: "Measured across dispatch services" },
      ]}
      queueTitle="Administrative Review"
      queue={[
        {
          title: "Agency access request",
          location: "NADMO Greater Accra Office",
          priority: "Review",
          time: "6m ago",
        },
        {
          title: "Operator role update",
          location: "National Dispatch Center",
          priority: "Approval",
          time: "15m ago",
        },
        {
          title: "Incident audit package",
          location: "Central records queue",
          priority: "Compliance",
          time: "31m ago",
        },
      ]}
      actions={["Approve agency user", "Open audit log", "Export response summary"]}
    />
  );
}
