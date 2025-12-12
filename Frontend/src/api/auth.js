// src/api/auth.js
import api from "../lib/api";

/**
 * NOTE:
 * - Set VITE_API_BASE_URL in your environment (dev: .env.local, prod: Vercel/Render)
 *   to the backend root (e.g. https://your-backend.onrender.com) WITHOUT a trailing slash.
 * - The axios instance (src/lib/api.js) will form requests like:
 *     `${VITE_API_BASE_URL}/api/auth/signup`
 *
 * Use the functions below from your components / context.
 */

// low-level normalizer for axios responses
function normalizeAxiosResponse(axiosRes) {
  // axios returns `data` already parsed
  return { ok: true, status: axiosRes.status, ...axiosRes.data };
}

function normalizeAxiosError(err) {
  const res = err?.response;
  if (!res) {
    // network error
    return { ok: false, status: 0, error: err.message || "Network error" };
  }
  return { ok: false, status: res.status, ...(res.data || {}) };
}

export async function loginRequest(email, password) {
  try {
    const res = await api.post("/api/auth/login", { email: (email || "").trim(), password });
    return normalizeAxiosResponse(res);
  } catch (err) {
    return normalizeAxiosError(err);
  }
}

export async function signupRequest(name, email, password) {
  try {
    const res = await api.post("/api/auth/signup", { name, email: (email || "").trim(), password });
    return normalizeAxiosResponse(res);
  } catch (err) {
    return normalizeAxiosError(err);
  }
}

export async function fetchMe(token) {
  if (!token) return { ok: false, status: 401 };
  try {
    const res = await api.get("/api/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    return normalizeAxiosResponse(res);
  } catch (err) {
    return normalizeAxiosError(err);
  }
}

/**
 * Generic fetch helper for endpoints that aren't covered above.
 * Accepts either a path (string) or a config-compatible axios call.
 */
export async function apiFetch(input, init = {}) {
  try {
    // if input is a string path (e.g. '/api/some'), call axios with method
    if (typeof input === "string") {
      const method = (init.method || "get").toLowerCase();
      const config = { ...init };
      if (init.token) config.headers = { ...(config.headers || {}), Authorization: `Bearer ${init.token}` };
      // use axios instance: body -> data
      if (method === "get" || method === "delete") {
        const res = await api.request({ url: input, method, params: init.params || {}, headers: config.headers });
        return normalizeAxiosResponse(res);
      } else {
        const res = await api.request({ url: input, method, data: init.body || init.data || {}, headers: config.headers });
        return normalizeAxiosResponse(res);
      }
    } else {
      // if a Request-like object is passed, try to adapt (rare)
      const res = await api.request(input);
      return normalizeAxiosResponse(res);
    }
  } catch (err) {
    return normalizeAxiosError(err);
  }
}
