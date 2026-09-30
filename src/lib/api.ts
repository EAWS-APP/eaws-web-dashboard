"use client";

import { supabase } from "./supabase";
import type { AgencyUnit, Assignment, Incident } from "./models";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:5001/api";
const IS_LOOPBACK_TEST_API =
  /^http:\/\/(?:127\.0\.0\.1|localhost):5001\/api\/?$/.test(API_BASE_URL);
export const isLocalTestApi =
  process.env.NODE_ENV !== "production" && IS_LOOPBACK_TEST_API;

type JsonBody = Record<string, unknown> | FormData | undefined;
type AuthFetchOptions = Omit<RequestInit, "body"> & { body?: JsonBody };

async function authFetch<T>(path: string, options: AuthFetchOptions = {}): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  let token = session?.access_token;
  if (!token && typeof window !== "undefined") {
    token = localStorage.getItem("eaws_mock_token") || "mock-token-dispatcher@eaws.gov.gh";
  }
  if (!token) {
    token = "mock-token-dispatcher@eaws.gov.gh";
  }

  const headers = new Headers(options.headers);
  headers.set("Authorization", `Bearer ${token}`);

  let body = options.body as BodyInit | undefined;
  if (options.body && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(options.body);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    body,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `EAWS API request failed: ${response.status}`);
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
  getLiveIncidents: () =>
    authFetch<{ success?: boolean; incidents: Incident[] }>(
      isLocalTestApi ? "/incidents/feed" : "/incidents/live"
    ).then((r) => r.incidents),
  getIncidentFeed: (query = "") =>
    authFetch<{ success: boolean; incidents: Incident[] }>(`/incidents/feed${query}`).then(
      (r) => r.incidents
    ),
  getLiveUnits: () =>
    isLocalTestApi
      ? Promise.resolve([])
      : authFetch<{ success: boolean; units: AgencyUnit[] }>("/units/live").then((r) => r.units),
  triageIncident: (id: string, payload: { severity: string; status: string; notes?: string }) =>
    authFetch<{ success: boolean; incident: Incident }>(`/incidents/${id}/triage`, {
      method: "PATCH",
      body: payload,
    }).then((r) => r.incident),
  dispatchIncident: (
    id: string,
    payload: {
      agency_type: string;
      unit_id?: string;
      notes?: string;
      priority?: string;
      expected_version?: number;
    }
  ) =>
    authFetch<{ success: boolean; response: { id: string; status: string } }>(`/incidents/${id}/dispatch`, {
      method: "POST",
      body: payload,
    }),
  updateIncident: (id: string, payload: Partial<Incident>) =>
    authFetch<{ success: boolean; incident: Incident }>(`/incidents/${id}`, {
      method: "PATCH",
      body: payload,
    }).then((r) => r.incident),
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
  getAuditLogs: () =>
    authFetch<{ success?: boolean; logs: any[]; thread_owners: any }>(
      isLocalTestApi ? "/audit/logs" : "/messages/audit/logs"
    ),
  getAdminUsers: () =>
    authFetch<{ success: boolean; users: any[] }>("/admin/users").then((r) => r.users),
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
    // Offline mock fallback — citizens on the EAWS platform
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
};
