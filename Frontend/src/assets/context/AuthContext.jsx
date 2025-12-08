// src/context/AuthContext.jsx
import React, { createContext, useState, useEffect, useCallback } from "react";
import { loginRequest, signupRequest, fetchMe, apiFetch } from "../api/auth";

export const AuthContext = createContext({
  user: null,
  token: null,
  loading: true,
  login: async () => {},
  signup: async () => {},
  logout: () => {},
  apiFetch: async () => {}
});

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("token"));
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // set token in localStorage & state
  const saveToken = (t) => {
    if (t) {
      localStorage.setItem("token", t);
      setToken(t);
    } else {
      localStorage.removeItem("token");
      setToken(null);
    }
  };

  const logout = useCallback(() => {
    saveToken(null);
    setUser(null);
  }, []);

  // login wrapper
  const login = async (email, password) => {
    const res = await loginRequest(email, password);
    if (!res.ok) {
      // return error payload
      throw res;
    }
    saveToken(res.token);
    setUser(res.user);
    return res;
  };

  // signup wrapper
  const signup = async (name, email, password) => {
    const res = await signupRequest(name, email, password);
    if (!res.ok) throw res;
    saveToken(res.token);
    setUser(res.user);
    return res;
  };

  // apiFetch wrapper that includes Authorization header
  const authFetch = useCallback(async (input, init = {}) => {
    return apiFetch(input, { ...init, token });
  }, [token]);

  // attempt to fetch current user on mount / token change
  useEffect(() => {
    let mounted = true;
    const init = async () => {
      if (!token) {
        setUser(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const res = await fetchMe(token);
        if (res && res.ok) {
          if (mounted) setUser(res.user);
        } else {
          // token invalid -> clear
          saveToken(null);
          if (mounted) setUser(null);
        }
      } catch (err) {
        console.error("fetchMe error:", err);
        saveToken(null);
        if (mounted) setUser(null);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    init();
    return () => (mounted = false);
  }, [token]);

  return (
    <AuthContext.Provider value={{
      user,
      token,
      loading,
      login,
      signup,
      logout,
      apiFetch: authFetch
    }}>
      {children}
    </AuthContext.Provider>
  );
}
