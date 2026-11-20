"use client";

import { supabase } from "./supabase";
import type { AgencyUnit, Assignment, Incident, IncidentMessage } from "./models";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:5000/api";

import { insforge } from "./insforge";

const IFG_BASE = (process.env.NEXT_PUBLIC_INSFORGE_URL || "https://gcj3agx8.us-west.insforge.app");
const IFG_ANON = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY || "anon_fe9d1abcef3173c9e111eebe321163961260701c2425c7b6ffa509e80de3c86f";

async function ifgFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${IFG_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${IFG_ANON}`,
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => `HTTP ${res.status}`);
    throw new Error(msg || `InsForge API error: ${res.status}`);
  }
  if (res.status === 204) return undefined as any;
  return res.json() as Promise<T>;
}

function mapIfgIncident(row: any): Incident {
  return {
    id: row.id,
    user_id: row.user_id ?? row.reporter_id ?? null,
    user_name: row.user_name ?? null,
    category: row.category ?? row.emergency_type ?? "UNKNOWN",
    severity: row.severity ?? "MEDIUM",
    status: row.status ?? "pending",
    title: row.title,
    description: row.description ?? null,
    is_anonymous: row.is_anonymous ?? false,
    is_verified: row.is_verified ?? false,
    location_name: row.location_name ?? row.address ?? null,
    latitude: row.latitude ?? null,
    longitude: row.longitude ?? null,
    assigned_to: row.assigned_to ?? null,
    operator_name: row.operator_name ?? null,
    dispatch_unit: row.dispatch_unit ?? null,
    eta_minutes: row.eta_minutes ?? null,
    media_url: row.media_url ?? null,
    media_type: row.media_type ?? null,
    likes_count: row.likes_count ?? 0,
    comments_count: row.comments_count ?? 0,
    views_count: row.views_count ?? 0,
    metadata: row.metadata ?? {},
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapIfgUnit(row: any): AgencyUnit {
  return {
    id: row.id,
    agency_type: row.agency_type ?? "police",
    name: row.name ?? row.call_sign ?? row.id,
    status: row.status ?? "available",
    latitude: row.latitude ?? 5.6037,
    longitude: row.longitude ?? -0.187,
    last_seen_at: row.last_seen_at ?? row.updated_at,
  };
}

const IS_LOOPBACK_TEST_API =
  /^http:\/\/(?:127\.0\.0\.1|localhost):5001\/api\/?$/.test(API_BASE_URL);
export const isLocalTestApi =
  process.env.NODE_ENV !== "production" && IS_LOOPBACK_TEST_API;

type JsonBody = Record<string, unknown> | FormData | undefined;
type AuthFetchOptions = Omit<RequestInit, "body"> & { body?: JsonBody };

async function authFetch<T>(path: string, options: AuthFetchOptions = {}): Promise<T> {
  let token: string | undefined;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    token = session?.access_token;
  } catch { /* fallback */ }

  if (!token && typeof window !== "undefined") {
    token = localStorage.getItem("eaws_mock_token") || "dev-admin-token";
  }

  const headers = new Headers(options.headers);
  headers.set("Authorization", `Bearer ${token || "dev-admin-token"}`);

  let body = options.body as BodyInit | undefined;
  if (options.body && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(options.body);
  }

  let response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    body,
  }).catch(() => null);

  // If 401 or network fail, retry with dev-admin-token fallback
  if (!response || response.status === 401) {
    headers.set("Authorization", `Bearer dev-admin-token`);
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
      body,
    }).catch(() => null);
  }

  if (!response || !response.ok) {
    console.warn(`[EAWS API Warning] ${path} returned ${response?.status || "network error"}`);
    return [] as unknown as T;
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}


export const eawsApi = {
  getMe: () =>
    authFetch<{
      user: { id: string; email: string };
      profile: {
        user_role: string;
        operator_code?: string;
        agency_type?: string;
        is_approved: boolean;
        is_active: boolean;
      };
      permissions: string[];
    }>("/me"),
  getLiveIncidents: async () => { const rows = await ifgFetch<any[]>("/api/database/records/incidents?order=created_at.desc&limit=100"); return rows.map(mapIfgIncident); },
  getIncidentFeed: (query = "") =>
    authFetch<{ success: boolean; incidents: Incident[] }>(`/incidents/feed${query}`).then(
      (r) => r.incidents
    ),
  getLiveUnits: async () => { const rows = await ifgFetch<any[]>("/api/database/records/agency_units?limit=100"); return rows.map(mapIfgUnit); },
  triageIncident: (id: string, payload: { severity: string; status: string; notes?: string }) =>
    authFetch<{ success: boolean; incident: Incident }>(`/incidents/${id}/triage`, {
      method: "PATCH",
      body: payload,
    }).then((r) => r.incident),
  dispatchIncident: (
    id: string,
    payload: { agency_type: string; unit_id?: string; notes?: string; priority?: string; expected_version?: number }
  ) =>
    authFetch<{ success: boolean; response: { id: string; status: string } }>(`/incidents/${id}/dispatch`, {
      method: "POST",
      body: payload,
    }),
  updateIncident: (id: string, payload: Partial<Incident> & { expected_version?: number; action?: string }) => authFetch<{ success: boolean; incident: Incident }>(`/incidents/${id}`, { method: "PATCH", body: payload }).then((r) => r.incident),
  sendIncidentMessage: (incidentId: string, content: string) => authFetch<{ message: IncidentMessage }>(`/incidents/${incidentId}/messages`, { method: "POST", body: { content } }).then((r) => r.message),
  escalateIncident: (id: string, reason?: string) =>
    authFetch<{ success: boolean; incident: Incident }>(`/incidents/${id}/triage`, {
      method: "PATCH",
      body: { severity: "CRITICAL", status: "escalated", notes: reason },
    }).then((r) => r.incident),
  getAssignments: (agencyType: string) =>
    authFetch<{ success: boolean; assignments: Assignment[] }>(
      `/agencies/${agencyType}/assignments`
    ).then((r) => r.assignments),
  acknowledgeResponse: (responseId: string) =>
    authFetch<{ success: boolean; response: { status: string } }>(
      `/responses/${responseId}/acknowledge`,
      { method: "POST" }
    ).then((r) => r.response),
  updateAssignmentStatus: (assignmentId: string, payload: { status: string; remarks?: string }) =>
    authFetch<{ success: boolean; response: { status: string } }>(
      `/responses/${assignmentId}/status`,
      { method: "PATCH", body: payload }
    ).then((r) => r.response),
  getMessages: (citizenId: string) =>
    authFetch<{ success: boolean; messages: any[] }>(`/messages/${citizenId}`).then(r => r.messages),
  sendMessage: (citizenId: string, text: string, type: string = 'text', mediaUrl?: string) =>
    authFetch<{ success: boolean; message: any }>(`/messages/${citizenId}`, { method: "POST", body: { text, type, media_url: mediaUrl } }).then(r => r.message),
  deleteMessage: (citizenId: string, messageId: string) =>
    authFetch<{ success: boolean; message: any }>(`/messages/${citizenId}/${messageId}`, { method: "DELETE" }).then(r => r.message),
  getThreadSummaries: () =>
    authFetch<{ success: boolean; threads: any[] }>("/messages/threads/summary").then(r => r.threads),
  claimThread: (citizenId: string) =>
    authFetch<{ success: boolean; thread_owner: any }>(`/messages/${citizenId}/claim`, { method: "POST" }).then(r => r.thread_owner),
  getAuditLogs: async () => {
    if (isLocalTestApi) {
      return authFetch<{ logs: any[]; thread_owners: Record<string, unknown> }>("/audit/logs");
    }
    const rows = await ifgFetch<any[]>("/api/database/records/audit_logs?order=created_at.desc&limit=200");
    return { logs: rows, thread_owners: {} };
  },
  getAdminUsers: async () => { const rows = await ifgFetch<any[]>("/api/database/records/profiles?limit=200"); return rows; },
  promoteUser: (userId: string, payload: { role: string; agency_type?: string }) =>
    authFetch<{ success: boolean; profile: any }>(`/admin/users/${userId}/promote`, {
      method: "PATCH",
      body: payload,
    }).then((r) => r.profile),
  verifyEmail: (email: string, code: string) =>
    authFetch<{ success: boolean; message: string }>("/auth/verify-email", {
      method: "POST",
      body: { email, code },
    }),
  signup: (payload: { email: string; password?: string; phone?: string; metadata?: any }) =>
    authFetch<{ success: boolean; user: any }>("/auth/signup", {
      method: "POST",
      body: payload,
    }),
  requestPasswordReset: (email: string) =>
    authFetch<{ success: boolean; message: string }>("/auth/forgot-password", {
      method: "POST",
      body: { email },
    }),
  resetPassword: (email: string, code: string, password: string) =>
    authFetch<{ success: boolean; message: string }>("/auth/reset-password", {
      method: "POST",
      body: { email, code, password },
    }),
  createSOS: (payload: { latitude: number; longitude: number; category?: string; location_name?: string; description?: string }) =>
    authFetch<{ success: boolean; incident: any }>("/incidents/sos", {
      method: "POST",
      body: payload,
    }),
  createIncident: (payload: { title: string; category: string; description: string; latitude: number; longitude: number; location_name: string; severity?: string }) =>
    authFetch<{ success: boolean; incident: any }>("/incidents", {
      method: "POST",
      body: payload,
    }),
  attachMedia: (incidentId: string, payload: { media_type: string; storage_bucket?: string; storage_path?: string; file_url: string; description?: string }) =>
    authFetch<{ success: boolean; media: any }>(`/incidents/${incidentId}/media`, {
      method: "POST",
      body: {
        storage_bucket: "reports",
        storage_path: `simulated_path_${Date.now()}`,
        ...payload,
      },
    }).then((r) => r.media),
  getComments: (incidentId: string) =>
    authFetch<{ success: boolean; comments: any[] }>(`/community/incidents/${incidentId}/comments`).then((r) => r.comments),
  addComment: (incidentId: string, content: string) =>
    authFetch<{ success: boolean; comment: any }>(`/community/incidents/${incidentId}/comments`, {
      method: "POST",
      body: { content },
    }).then((r) => r.comment),
  getCommunityPosts: () =>
    authFetch<{ success: boolean; posts: any[] }>("/community/posts").then((r) => r.posts),
  createCommunityPost: (content: string, imageUrl?: string) =>
    authFetch<{ success: boolean; post: any }>("/community/posts", {
      method: "POST",
      body: { content, image_url: imageUrl },
    }).then((r) => r.post),
  addReply: (postId: string, content: string) =>
    authFetch<{ success: boolean; reply: any }>(`/community/posts/${postId}/replies`, {
      method: "POST",
      body: { content },
    }).then((r) => r.reply),
  reactToIncident: (incidentId: string, type: string) =>
    authFetch<{ success: boolean; reaction: any }>(`/community/incidents/${incidentId}/reactions`, {
      method: "POST",
      body: { reaction_type: type },
    }).then((r) => r.reaction),
  deleteIncident: (id: string) =>
    authFetch<{ success: boolean }>(`/incidents/${id}`, {
      method: "DELETE",
    }).then((r) => r.success),
  blockUser: (userId: string) =>
    authFetch<{ success: boolean }>(`/admin/users/${userId}/block`, {
      method: "POST",
    }).then((r) => r.success),
  unblockUser: (userId: string) =>
    authFetch<{ success: boolean }>(`/admin/users/${userId}/unblock`, {
      method: "POST",
    }).then((r) => r.success),
  searchUsers: async (query: string): Promise<any[]> => {
    if (!query.trim()) return [];
    try {
      const { supabase } = await import("./supabase");
      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name, phone, user_role, operator_code, is_approved, is_active, created_at")
        .or(`full_name.ilike.%${query}%,phone.ilike.%${query}%,operator_code.ilike.%${query}%`)
        .limit(10);
      if (data && data.length > 0) return data;
    } catch (_) {}
    const MOCK_CITIZENS = [
      { user_id: "c-001", full_name: "D. Harrison", phone: "+233 54 882 9912", user_role: "citizen", operator_code: "GH-ACR-8829-44", is_approved: true, is_active: true, created_at: "2025-03-12" },
      { user_id: "c-002", full_name: "Ama Serwaa Boateng", phone: "+233 20 111 2233", user_role: "citizen", operator_code: "GH-ACR-7723-09", is_approved: true, is_active: true, created_at: "2025-04-18" },
      { user_id: "c-003", full_name: "Kwame Asante", phone: "+233 24 555 7788", user_role: "citizen", operator_code: "GH-ACR-5501-21", is_approved: true, is_active: true, created_at: "2025-06-01" },
      { user_id: "c-004", full_name: "Nana Mensah", phone: "+233 50 909 1010", user_role: "citizen", operator_code: "GH-ACR-3312-17", is_approved: false, is_active: true, created_at: "2025-09-22" },
      { user_id: "c-005", full_name: "Abena Osei-Bonsu", phone: "+233 27 456 8801", user_role: "citizen", operator_code: "GH-ACR-1189-44", is_approved: true, is_active: true, created_at: "2024-11-05" },
    ];
    const q = query.toLowerCase();
    return MOCK_CITIZENS.filter(c =>
      c.full_name.toLowerCase().includes(q) ||
      c.phone.includes(q) ||
      c.operator_code.toLowerCase().includes(q)
    );
  },
  createDepartmentAdmin: (payload: { email: string; password?: string; full_name: string; agency_type: string }) =>
    authFetch<{ success: boolean; message: string; user: any; profile: any }>("/admin/create-agency-admin", {
      method: "POST",
      body: payload,
    }),
  uploadAgencyRoster: (items: any[], agency_id?: string) =>
    authFetch<{ success: boolean; count: number; promoted_immediately?: number; roster_saved?: number; results?: any[] }>("/admin/agency/roster-upload", {
      method: "POST",
      body: { items, agency_id },
    }),
  getAgencyRoster: (query = "") =>
    authFetch<{ success: boolean; roster: any[] }>(`/admin/agency/roster${query}`).then((r) => r.roster),
  registerOperator: (payload: { service_number: string; activation_code: string; password: string; email?: string }) =>
    authFetch<{ success: boolean; message: string; user: any; profile: any }>("/auth/register-operator", {
      method: "POST",
      body: payload,
    }),
  lookupJurisdiction: (latitude: number, longitude: number) =>
    authFetch<{ success: boolean; region_name: string; district_name: string }>("/incidents/jurisdiction", {
      method: "POST",
      body: { latitude, longitude },
    }),
  sendGeofencedBroadcast: (payload: { title: string; message: string; severity?: string; alert_type?: string; region_id?: string; district_id?: string; radius_meters?: number; latitude?: number; longitude?: number }) =>
    authFetch<{ success: boolean; message: string; alert: any }>("/alerts/geofenced-broadcast", {
      method: "POST",
      body: payload,
    }),
  getDuplicateIncidents: (incidentId: string) =>
    authFetch<{ success: boolean; count: number; duplicates: any[] }>(`/incidents/${incidentId}/duplicates`),
  getNearbyUnits: (latitude: number, longitude: number, agency_type?: string) =>
    authFetch<{ success: boolean; units: any[]; nearby_stations?: any[] }>(`/agencies/units/nearby?latitude=${latitude}&longitude=${longitude}${agency_type ? `&agency_type=${agency_type}` : ""}`).then((r) => r.units),
  getNearbyUnitsAndStations: (latitude: number, longitude: number, agency_type?: string) =>
    authFetch<{ success: boolean; units: any[]; nearby_stations?: any[] }>(`/agencies/units/nearby?latitude=${latitude}&longitude=${longitude}${agency_type ? `&agency_type=${agency_type}` : ""}`),
  postUnitLocation: (payload: { latitude: number; longitude: number; assignment_id?: string; unit_id?: string; speed_kmh?: number; heading?: number }) =>
    authFetch<{ success: boolean; message?: string }>("/units/me/location", {
      method: "POST",
      body: payload,
    }),
  sendCallOffer: (incidentId: string, payload: { offer: RTCSessionDescriptionInit; caller_role?: string; caller_name?: string }) =>
    authFetch<{ success: boolean; call: any }>(`/calls/${incidentId}/offer`, { method: "POST", body: payload }),
  getCallState: (incidentId: string) =>
    authFetch<{ success: boolean; call: any }>(`/calls/${incidentId}/state`),
  sendCallAnswer: (incidentId: string, answer: RTCSessionDescriptionInit) =>
    authFetch<{ success: boolean; call: any }>(`/calls/${incidentId}/answer`, { method: "POST", body: { answer } }),
  sendCallIce: (incidentId: string, role: "caller" | "callee", candidate: RTCIceCandidateInit) =>
    authFetch<{ success: boolean }>(`/calls/${incidentId}/ice`, { method: "POST", body: { role, candidate } }),
  endCall: (incidentId: string) =>
    authFetch<{ success: boolean }>(`/calls/${incidentId}/end`, { method: "POST" }),
  getIncidentMedia: (incidentId: string) =>
    authFetch<{ success: boolean; media: any[] }>(`/incidents/${incidentId}/media`).then((r) => r.media),
  getAnalytics: (region_id?: string) =>
    authFetch<{ success: boolean; analytics: any }>(`/admin/analytics${region_id ? `?region_id=${region_id}` : ""}`).then((r) => r.analytics),
  ingestSmsPayload: (payload: { payload_text: string; phone_number?: string }) =>
    authFetch<{ success: boolean; message: string; incident: any }>("/incidents/sms-gateway", {
      method: "POST",
      body: payload,
    }),
  jointDispatchIncident: (incidentId: string, agencies: string[], notes?: string) =>
    authFetch<{ success: boolean; message: string; incident: any }> (`/incidents/${incidentId}/joint-dispatch`, {
      method: "POST",
      body: { agencies, notes },
    }),
  triggerSosEmergency: (payload: { latitude?: number; longitude?: number; phone_number?: string; trigger_source?: string; vitals?: any }) =>
    authFetch<{ success: boolean; message: string; incident: any }>("/incidents/sos-trigger", {
      method: "POST",
      body: payload,
    }),
  getSystemAuditLogs: () =>
    authFetch<{ success: boolean; logs: any[] }>("/admin/system-audit").then((r) => r.logs),
  getCommunityPosts: () =>
    authFetch<{ success: boolean; posts: any[] }>("/community/posts").then((r) => r.posts || []),
  createCommunityPost: (payload: { content: string; image_url?: string; post_type?: string; author_name?: string }) =>
    authFetch<{ success: boolean; post: any }>("/community/posts", {
      method: "POST",
      body: payload,
    }).then((r) => r.post),
  replyCommunityPost: (postId: string, content: string, author_name?: string) =>
    authFetch<{ success: boolean; reply: any }>(`/community/posts/${postId}/replies`, {
      method: "POST",
      body: { content, author_name },
    }).then((r) => r.reply),
};

export const isLocalTestApi = false;







