const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || '';

export async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  if (response.status === 204) return null;

  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('application/json') ? await response.json() : await response.text();

  if (!response.ok) {
    const message = typeof body === 'object' && body?.detail ? body.detail : `Request failed: ${response.status}`;
    throw new Error(message);
  }

  return body;
}

export function getJson(path) {
  return apiRequest(path);
}

export function postJson(path, data) {
  return apiRequest(path, { method: 'POST', body: JSON.stringify(data) });
}

export function putJson(path, data) {
  return apiRequest(path, { method: 'PUT', body: JSON.stringify(data) });
}

export function patchJson(path, data) {
  return apiRequest(path, { method: 'PATCH', body: JSON.stringify(data) });
}

export function deleteJson(path) {
  return apiRequest(path, { method: 'DELETE' });
}
