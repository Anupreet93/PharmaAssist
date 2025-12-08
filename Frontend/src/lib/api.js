// src/lib/api.js
import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:8080", // change if your backend uses another host/port
  headers: { "Content-Type": "application/json" },
  // withCredentials: true, // not needed for access-token-only flow
});

export default api;
