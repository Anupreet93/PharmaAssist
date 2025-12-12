// src/lib/api.js
import axios from "axios";

const envBase = import.meta.env.VITE_API_BASE_URL || "";
// remove trailing slash if present
const normalized = envBase ? envBase.replace(/\/$/, "") : "http://localhost:8080";

const api = axios.create({
  baseURL: normalized, // will be e.g. https://your-backend.onrender.com or http://localhost:8080
  headers: { "Content-Type": "application/json" },
  // withCredentials: true, // enable only if you use cookies
});

export default api;
