// src/lib/api.js
import axios from "axios";
const envBase = import.meta.env.VITE_API_BASE_URL || "";
const normalized = envBase ? envBase.replace(/\/$/, "") : "http://localhost:8080";
const api = axios.create({
  baseURL: normalized,
  headers: { "Content-Type": "application/json" }
});

// set initial token if present
if (typeof window !== "undefined") {
  const tok = localStorage.getItem("token");
  if (tok) api.defaults.headers.common.Authorization = `Bearer ${tok}`;
}

// helper to update token after login/logout
export function setApiToken(token) {
  if (token) api.defaults.headers.common.Authorization = `Bearer ${token}`;
  else delete api.defaults.headers.common.Authorization;
}

export default api;
