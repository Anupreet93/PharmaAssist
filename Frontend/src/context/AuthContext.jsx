// src/context/AuthContext.jsx
import React, { createContext, useState, useEffect, useCallback } from "react";
import api from "../lib/api";

export const AuthContext = createContext({
  user: null,
  token: null,
  loading: true,
  login: async () => {},
  signup: async () => {},
  logout: async () => {},
  signOut: async () => {}
});

export function AuthProvider({ children }) {
  // bootstrap user + token from localStorage
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem("user");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(() => localStorage.getItem("token") || null);
  const [loading, setLoading] = useState(true);

  // synchronize axios header + persist token
  useEffect(() => {
    if (token) {
      api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      try {
        localStorage.setItem("token", token);
      } catch (e) {
        console.warn("Failed to persist token to localStorage", e);
      }
    } else {
      // remove header and persisted token
      delete api.defaults.headers.common["Authorization"];
      try {
        localStorage.removeItem("token");
      } catch (e) {}
    }
  }, [token]);

  // persist or remove user object
  useEffect(() => {
    try {
      if (user) localStorage.setItem("user", JSON.stringify(user));
      else localStorage.removeItem("user");
    } catch (e) {
      console.warn("Failed to persist user to localStorage", e);
    }
  }, [user]);

  // bootstrap validate token by calling /api/me if token exists
  useEffect(() => {
    let mounted = true;
    const bootstrap = async () => {
      if (!token) {
        if (mounted) setLoading(false);
        return;
      }

      try {
        const res = await api.get("/api/me");
        const data = res?.data ?? {};
        const fetchedUser = data.user ?? data.data?.user ?? data;
        if (fetchedUser && mounted) {
          setUser(fetchedUser);
        } else {
          // invalid token / no user returned
          setToken(null);
          setUser(null);
        }
      } catch (err) {
        console.warn("Auth bootstrap failed — clearing token:", err?.response?.data || err.message);
        setToken(null);
        setUser(null);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    bootstrap();
    return () => {
      mounted = false;
    };
  }, [token]);

  // login
  const login = useCallback(async ({ email, password }) => {
    try {
      if (!email || !password) return { ok: false, error: "Email and password required" };

      const res = await api.post("/api/auth/login", { email: (email || "").trim(), password });
      const data = res?.data ?? {};

      const gotToken = data.token ?? data?.data?.token ?? null;
      const gotUser = data.user ?? data?.data?.user ?? data;

      if (gotToken) {
        setToken(gotToken);
        if (gotUser && typeof gotUser === "object") setUser(gotUser);
        return { ok: true };
      }

      if (data?.message && data?.token) {
        setToken(data.token);
        if (data.user) setUser(data.user);
        return { ok: true };
      }

      return { ok: false, error: data.error || "Login failed" };
    } catch (err) {
      const server = err?.response?.data;
      console.error("AuthContext.login error:", server || err.message);
      if (server?.errors) return { ok: false, error: server.errors };
      if (server?.error) return { ok: false, error: server.error };
      return { ok: false, error: err?.message || "Network error" };
    }
  }, []);

  // signup
  const signup = useCallback(async ({ name, email, password }) => {
    try {
      const res = await api.post("/api/auth/signup", { name, email: (email || "").trim(), password });
      const data = res?.data ?? {};
      const gotToken = data.token ?? data?.data?.token ?? null;
      const gotUser = data.user ?? data?.data?.user ?? data;

      if (gotToken) {
        setToken(gotToken);
        if (gotUser && typeof gotUser === "object") setUser(gotUser);
        return { ok: true };
      }

      return { ok: false, error: data.error || "Signup failed" };
    } catch (err) {
      const server = err?.response?.data;
      console.error("AuthContext.signup error:", server || err.message);
      return { ok: false, error: server?.error || err?.message || "Network error" };
    }
  }, []);

  // logout: clear local state + localStorage + axios header; optionally notify backend
  const logout = useCallback(async () => {
    // clear state first
    setUser(null);
    setToken(null);

    // explicitly clear persisted storage and axios header to be safe
    try {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
    } catch (e) {}

    try {
      delete api.defaults.headers.common["Authorization"];
    } catch (e) {}

    // try to notify backend (best-effort)
    try {
      await api.post("/api/auth/logout");
    } catch (e) {
      // ignore network errors for logout
    }
  }, []);

  // signOut alias
  const signOut = useCallback(async () => {
    await logout();
  }, [logout]);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, signup, logout, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
