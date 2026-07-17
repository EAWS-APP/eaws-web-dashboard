"use client";

import { supabase } from "./supabase";
import type { AgencyUnit, Assignment, Incident } from "./models";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:5000/api";

type JsonBody = Record<string, unknown> | FormData | undefined;
type AuthFetchOptions = Omit<RequestInit, "body"> & { body?: JsonBody };

async function authFetch<T>(path: string, options: AuthFetchOptions = {}): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers = new Headers(options.headers);
  if (session?.access_token) {
    headers.set("Authorization", `Bearer ${session.access_token}`);
  }

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
    authFetch<{ success: boolean; incidents: Incident[] }>("/incidents/live").then((r) => r.incidents),
  getIncidentFeed: (query = "") =>
    authFetch<{ success: boolean; incidents: Incident[] }>(`/incidents/feed${query}`).then(
      (r) => r.incidents
    ),
  getLiveUnits: () =>
    authFetch<{ success: boolean; units: AgencyUnit[] }>("/units/live").then((r) => r.units),
  triageIncident: (id: string, payload: { severity: string; status: string; notes?: string }) =>
    authFetch<{ success: boolean; incident: Incident }>(`/incidents/${id}/triage`, {
      method: "PATCH",
      body: payload,
    }).then((r) => r.incident),
  dispatchIncident: (
    id: string,
    payload: { agency_type: string; unit_id?: string; notes?: string; priority?: string }
  ) =>
    authFetch<{ success: boolean; response_id: string; status: string }>(`/incidents/${id}/dispatch`, {
      method: "POST",
      body: payload,
    }),
  updateIncident: (id: string, payload: Partial<Incident>) =>
    authFetch<{ success: boolean; incident: Incident }>(`/incidents/${id}`, {
      method: "PATCH",
      body: payload,
    }).then((r) => r.incident),
  escalateIncident: (id: string, reason?: string) =>
    authFetch<{ success: boolean; incident: Incident }>(`/incidents/${id}/escalate`, {
      method: "POST",
      body: { reason },
    }).then((r) => r.incident),
  getAssignments: (agencyType: string) =>
    authFetch<{ success: boolean; assignments: Assignment[] }>(
      `/agencies/${agencyType}/assignments`
    ).then((r) => r.assignments),
  acknowledgeResponse: (responseId: string) =>
    authFetch<{ success: boolean; response: { status: string } }>(
      `/assignments/${responseId}/acknowledge`,
      { method: "POST" }
    ).then((r) => r.response),
  updateAssignmentStatus: (assignmentId: string, payload: { status: string; remarks?: string }) =>
    authFetch<{ success: boolean; response: { status: string } }>(
      `/assignments/${assignmentId}/status`,
      { method: "PATCH", body: payload }
    ).then((r) => r.response),
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
  reactToIncident: (incidentId: string, type: string) =>
    authFetch<{ success: boolean; reaction: any }>(`/community/incidents/${incidentId}/reactions`, {
      method: "POST",
      body: { reaction_type: type },
    }).then((r) => r.reaction),
};

