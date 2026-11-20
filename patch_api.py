import re

with open('src/lib/api.ts', 'r') as f:
    content = f.read()

# 1. Add ifgFetch and map models
ifg_helpers = """
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
"""

content = content.replace('const IS_LOOPBACK_TEST_API =', ifg_helpers + '\nconst IS_LOOPBACK_TEST_API =')

# 2. Patch specific methods in export const eawsApi = {
content = re.sub(
    r'getLiveIncidents:\s*\(\)\s*=>.*?\(\(r\)\s*=>\s*r\.incidents\),',
    'getLiveIncidents: async () => { const rows = await ifgFetch<any[]>("/api/database/records/incidents?order=created_at.desc&limit=100"); return rows.map(mapIfgIncident); },',
    content,
    flags=re.DOTALL
)

content = re.sub(
    r'getIncidentFeed:\s*\(query\s*=\s*""\)\s*=>.*?\(\(r\)\s*=>\s*r\.incidents\s*\),',
    'getIncidentFeed: async (query = "") => { const rows = await ifgFetch<any[]>(`/api/database/records/incidents?order=created_at.desc&limit=200${query ? `&${query.replace(/^\\?/, "")}` : ""}`); return rows.map(mapIfgIncident); },',
    content,
    flags=re.DOTALL
)

content = re.sub(
    r'getLiveUnits:\s*\(\)\s*=>\s*isLocalTestApi.*?\.then\(\(r\)\s*=>\s*r\.units\),',
    'getLiveUnits: async () => { const rows = await ifgFetch<any[]>("/api/database/records/agency_units?limit=100"); return rows.map(mapIfgUnit); },',
    content,
    flags=re.DOTALL
)

content = re.sub(
    r'getAuditLogs:\s*\(\)\s*=>\s*authFetch<.*?>\(.*?isLocalTestApi.*?\),',
    'getAuditLogs: async () => { const rows = await ifgFetch<any[]>("/api/database/records/audit_logs?order=created_at.desc&limit=200"); return { logs: rows, thread_owners: {} }; },',
    content,
    flags=re.DOTALL
)

content = re.sub(
    r'getAdminUsers:\s*\(\)\s*=>\s*authFetch<.*?>\("/admin/users"\)\.then\(\(r\)\s*=>\s*r\.users\),',
    'getAdminUsers: async () => { const rows = await ifgFetch<any[]>("/api/database/records/profiles?limit=200"); return rows; },',
    content,
    flags=re.DOTALL
)

# 3. Fix missing AuthFetchOptions body type
content = content.replace(
    'let token = session?.access_token;',
    'let token: string | undefined;\n  if (!isLocalTestApi) {\n    const { data: { session } } = await supabase.auth.getSession();\n    token = session?.access_token;\n  }'
)
content = content.replace(
    'const {\n    data: { session },\n  } = await supabase.auth.getSession();\n\n  let token = session?.access_token;',
    ''
)

with open('src/lib/api.ts', 'w') as f:
    f.write(content)

