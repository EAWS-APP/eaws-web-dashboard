"use client";

import { supabase } from "./supabase";
import type { AgencyUnit, Assignment, Incident } from "./models";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5000/api";

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
  getLiveIncidents: () => authFetch<Incident[]>("/incidents/live"),
  getIncidentFeed: (query = "") => authFetch<Incident[]>(`/incidents/feed${query}`),
  getLiveUnits: () => authFetch<AgencyUnit[]>("/units/live"),
  triageIncident: (id: string, payload: { severity: string; status: string; notes?: string }) =>
    authFetch<Incident>(`/incidents/${id}/triage`, { method: "PATCH", body: payload }),
  dispatchIncident: (id: string, payload: { agency_type: string; unit_id?: string; notes?: string }) =>
    authFetch<{ response_id: string; status: string }>(`/incidents/${id}/dispatch`, {
      method: "POST",
      body: payload,
    }),
  getAssignments: (agencyType: string) => authFetch<Assignment[]>(`/agencies/${agencyType}/assignments`),
  acknowledgeResponse: (responseId: string) =>
    authFetch<{ status: string }>(`/responses/${responseId}/acknowledge`, { method: "POST" }),
};
