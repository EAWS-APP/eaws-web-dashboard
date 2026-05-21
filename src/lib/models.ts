export type IncidentSeverity = "PENDING TRIAGE" | "CRITICAL" | "WARNING" | "MEDIUM" | "LOW";
export type IncidentStatus = "pending" | "verified" | "assigned" | "in_progress" | "resolved";

export type Incident = {
  id: string;
  user_id?: string | null;
  user_name?: string | null;
  category: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  title: string;
  description?: string | null;
  is_anonymous: boolean;
  is_verified?: boolean;
  location_name: string;
  latitude: number;
  longitude: number;
  media_url?: string | null;
  media_type?: "image" | "video" | "audio" | null;
  likes_count: number;
  comments_count: number;
  views_count?: number;
  created_at: string;
  updated_at?: string;
};

export type AgencyUnit = {
  id: string;
  agency_type: "police" | "fire" | "ambulance" | "nadmo";
  name: string;
  status: "available" | "assigned" | "en_route" | "on_scene" | "offline";
  latitude: number;
  longitude: number;
  last_seen_at?: string;
};

export type Assignment = {
  id: string;
  incident_id: string;
  incident_title: string;
  location_name: string;
  priority: string;
  status: string;
  created_at: string;
};

