import re

with open('src/lib/api.ts', 'r') as f:
    content = f.read()

content = re.sub(
    r'updateIncident:\s*\(.*?\)\s*=>\s*authFetch<.*?>\(`/incidents/\$\{id\}`,\s*{\s*method:\s*"PATCH",\s*body:\s*payload,\s*}\)\.then\(\(r\)\s*=>\s*r\.incident\),',
    'updateIncident: (id: string, payload: Partial<Incident> & { expected_version?: number; action?: string }) => authFetch<{ success: boolean; incident: Incident }>(`/incidents/${id}`, { method: "PATCH", body: payload }).then((r) => r.incident),\n  sendIncidentMessage: (incidentId: string, content: string) => authFetch<{ message: IncidentMessage }>(`/incidents/${incidentId}/messages`, { method: "POST", body: { content } }).then((r) => r.message),',
    content,
    flags=re.DOTALL
)

with open('src/lib/api.ts', 'w') as f:
    f.write(content)

