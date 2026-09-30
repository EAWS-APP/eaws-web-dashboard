import AgencyIncidentQueue from "@/components/AgencyIncidentQueue";

const FIRE_CATEGORIES = ["fire"];

export default function FireServicePage() {
  return (
    <AgencyIncidentQueue
      agencyType="fire"
      categories={FIRE_CATEGORIES}
      title="Fire Service"
      subtitle="Review fire incidents and record a test dispatch against the shared incident."
      emptyMessage="No fire incidents are currently in the queue."
    />
  );
}
