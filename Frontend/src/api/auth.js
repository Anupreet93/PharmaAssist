// src/api/auth.js
// Helper functions for auth API calls and authorized fetch
const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

// low-level helper to parse JSON errors
async function parseResponse(res) {
  const text = await res.text().catch(() => "");
  try {
    const json = text ? JSON.parse(text) : null;
    return { ok: res.ok, status: res.status, ...json };
  } catch {
    return { ok: res.ok, status: res.status, raw: text };
  }
}

export async function loginRequest(email, password) {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  return parseResponse(res);
}

export async function signupRequest(name, email, password) {
  const res = await fetch(`${API_BASE}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password })
  });
  return parseResponse(res);
}

export async function fetchMe(token) {
  if (!token) return { ok: false, status: 401 };
  const res = await fetch(`${API_BASE}/api/me`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return parseResponse(res);
}

// wrapper for other authorized API calls (returns parsed payload)
export async function apiFetch(input, init = {}) {
  const token = init.token || localStorage.getItem("token") || null;
  const headers = {
    ...(init.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };

  const res = await fetch(typeof input === "string" ? input : input, {
    ...init,
    headers
  });
  return parseResponse(res);
}
