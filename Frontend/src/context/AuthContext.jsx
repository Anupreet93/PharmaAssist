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
  // --- bootstrap user + token from localStorage ---
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

  // --- sync axios header + persist token ---
  useEffect(() => {
    try {
      if (token) {
        api.defaults.headers.common.Authorization = `Bearer ${token}`;
        localStorage.setItem("token", token);
      } else {
        delete api.defaults.headers.common.Authorization;
        localStorage.removeItem("token");
      }
    } catch (e) {
      console.warn("Token persistence failed", e);
    }
  }, [token]);

  // --- persist user ---
  useEffect(() => {
    try {
      if (user) localStorage.setItem("user", JSON.stringify(user));
      else localStorage.removeItem("user");
    } catch (e) {
      console.warn("User persistence failed", e);
    }
  }, [user]);

  // --- bootstrap auth via /api/me ---
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

        if (mounted && fetchedUser) {
          setUser(fetchedUser);
        } else {
          setToken(null);
          setUser(null);
        }
      } catch (err) {
        console.warn("Auth bootstrap failed:", err?.response?.data || err.message);
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

  // --- LOGIN ---
  const login = useCallback(async ({ email, password }) => {
    try {
      if (!email || !password) {
        return { ok: false, error: "Email and password are required" };
      }

      const res = await api.post("/api/auth/login", {
        email: email.trim(),
        password
      });

      const data = res?.data ?? {};
      const gotToken = data.token ?? data.data?.token ?? null;
      const gotUser = data.user ?? data.data?.user ?? null;

      if (!gotToken) {
        return { ok: false, error: data.error || "Invalid login response" };
      }

      setToken(gotToken);
      if (gotUser) setUser(gotUser);

      return { ok: true };
    } catch (err) {
      const server = err?.response?.data;

      console.error("AuthContext.login error:", server || err.message);

      if (server?.errors) return { ok: false, error: server.errors };
      if (server?.error) return { ok: false, error: server.error };

      return { ok: false, error: err?.message || "Network error" };
    }
  }, []);

  // --- SIGNUP ---
  const signup = useCallback(async ({ username, email, password }) => {
    try {
      if (!username || !email || !password) {
        return { ok: false, error: "Username, email and password are required" };
      }

      const res = await api.post("/api/auth/signup", {
        username: username.trim(),
        email: email.trim(),
        password
      });

      const data = res?.data ?? {};
      const gotToken = data.token ?? data.data?.token ?? null;
      const gotUser = data.user ?? data.data?.user ?? null;

      if (!gotToken) {
        return { ok: false, error: data.error || "Signup failed" };
      }

      setToken(gotToken);
      if (gotUser) setUser(gotUser);

      return { ok: true };
    } catch (err) {
      const server = err?.response?.data;

      console.error("AuthContext.signup error:", server || err.message);

      if (server?.errors) return { ok: false, error: server.errors };
      if (server?.error) return { ok: false, error: server.error };

      return { ok: false, error: err?.message || "Network error" };
    }
  }, []);

  // --- LOGOUT ---
  const logout = useCallback(async () => {
    setUser(null);
    setToken(null);

    try {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      delete api.defaults.headers.common.Authorization;
    } catch {}

    try {
      await api.post("/api/auth/logout");
    } catch {
      // best-effort
    }
  }, []);

  const signOut = useCallback(async () => {
    await logout();
  }, [logout]);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        signup,
        logout,
        signOut
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
