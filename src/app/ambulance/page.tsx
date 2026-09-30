import AgencyIncidentQueue from "@/components/AgencyIncidentQueue";

const AMBULANCE_CATEGORIES = ["medical", "sos"];

export default function AmbulancePage() {
  return (
    <AgencyIncidentQueue
      agencyType="ambulance"
      categories={AMBULANCE_CATEGORIES}
      title="Ambulance Service"
      subtitle="Review medical incidents and record a test dispatch against the shared incident."
      emptyMessage="No medical or SOS incidents are currently in the queue."
    />
  );
}
