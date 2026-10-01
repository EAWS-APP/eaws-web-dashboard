export type IncidentSeverity =
  | "PENDING TRIAGE"
  | "CRITICAL"
  | "WARNING"
  | "MEDIUM"
  | "LOW"
  | "critical"
  | "high"
  | "medium"
  | "low";
export type IncidentStatus =
  | "pending"
  | "new"
  | "sent"
  | "acknowledged"
  | "assigned"
  | "dispatched"
  | "en_route"
  | "on_scene"
  | "verified"
  | "in_progress"
  | "resolved"
  | "dismissed"
  | "retracted"
  | "escalated";

export type IncidentMessage = {
  id: string;
  content: string;
  sender: string;
  sender_role?: "operator" | "citizen" | string;
  delivery_state?: string;
  read_state?: string;
  created_at: string;
  delivered_at?: string;
};

export type Incident = {
  id: string;
  user_id?: string | null;
  user_name?: string | null;
  category: string;
  severity: IncidentSeverity;
  severity_confidence?: "unverified" | "verified" | string;
  status: IncidentStatus;
  title: string;
  description?: string | null;
  is_anonymous: boolean;
  is_verified?: boolean;
  location_name: string | null;
  latitude: number | null;
  longitude: number | null;
  assigned_to?: string | null;
  operator_name?: string | null;
  dispatch_unit?: string | null;
  eta_minutes?: number | null;
  outcome?: string | null;
  resolution_notes?: string | null;
  resolved_by?: string | null;
  resolved_at?: string | null;
  messages?: IncidentMessage[];
  version?: number;
  media_url?: string | null;
  media_type?: "image" | "video" | "audio" | null;
  likes_count: number;
  comments_count: number;
  views_count?: number;
  metadata?: any;
  created_at: string;
  updated_at?: string;
  incident_media?: Array<{
    id: string;
    media_type: "image" | "video" | "audio";
    file_url: string;
    storage_path?: string;
  }> | null;
  reporter_profile?: {
    full_name: string;
    user_role: string;
    operator_code?: string;
  } | null;
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
  incident_description?: string;
  incident_metadata?: any;
  latitude?: number | null;
  longitude?: number | null;
};
