// src/components/GoogleSignIn.jsx
import React, { useEffect, useRef, useState } from "react";
import api from "../lib/api";

/**
 * GoogleSignIn
 * Props:
 *  - onSuccess(user, token)
 *  - onError(err)
 *  - id (optional) default 'google-signin-button'
 *
 * Notes:
 *  - For Vite use `import.meta.env.VITE_GOOGLE_CLIENT_ID`
 *  - For CRA use `process.env.REACT_APP_GOOGLE_CLIENT_ID` (not used here)
 *  - You can also set window.__GOOGLE_CLIENT_ID__ in index.html at runtime.
 */
export default function GoogleSignIn({ onSuccess, onError, id = "google-signin-button" }) {
  const containerRef = useRef(null);
  const [loaded, setLoaded] = useState(false);

  function readClientId() {
    try {
      // 1) explicit global from index.html (recommended)
      if (typeof window !== "undefined" && window.__GOOGLE_CLIENT_ID__) {
        return window.__GOOGLE_CLIENT_ID__;
      }

      // 2) Vite env (import.meta.env) - safe to reference in browser builds
      //    Note: import.meta is defined in Vite; using optional chaining to be safe.
      if (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_GOOGLE_CLIENT_ID) {
        return import.meta.env.VITE_GOOGLE_CLIENT_ID;
      }

      // 3) alternative runtime global (if you set one)
      if (typeof window !== "undefined" && window.__VITE_GOOGLE_CLIENT_ID__) {
        return window.__VITE_GOOGLE_CLIENT_ID__;
      }

      // 4) CRA-style (only present in CRA build environments where process exists in browser)
      if (typeof process !== "undefined" && process?.env?.REACT_APP_GOOGLE_CLIENT_ID) {
        return process.env.REACT_APP_GOOGLE_CLIENT_ID;
      }
    } catch (e) {
      console.warn("[GoogleSignIn] readClientId error", e);
    }
    return null;
  }

  useEffect(() => {
    const clientId = readClientId();
    if (!clientId) {
      console.warn(
        "[GoogleSignIn] Google client id not found. Set window.__GOOGLE_CLIENT_ID__ in index.html or VITE_GOOGLE_CLIENT_ID in your env."
      );
    } else {
      console.log("[GoogleSignIn] using clientId:", clientId);
    }

    const scriptId = "google-identity-script";
    const existing = document.getElementById(scriptId);

    function renderButton() {
      try {
        if (!clientId) return;
        if (!window.google?.accounts?.id) {
          console.warn("[GoogleSignIn] window.google.accounts.id not available yet.");
          return;
        }

        // Initialize GSI
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: handleCredentialResponse,
          ux_mode: "popup"
        });

        const el = containerRef.current;
        if (!el) {
          console.warn("[GoogleSignIn] container element not found");
          return;
        }

        el.innerHTML = "";
        // Let Google's button decide sizing; 'large' is recommended for visibility
        window.google.accounts.id.renderButton(el, { theme: "outline", size: "large" });

        // Optional: show One Tap (disabled by default)
        // window.google.accounts.id.prompt();

        setLoaded(true);
      } catch (e) {
        console.error("[GoogleSignIn] renderButton error:", e);
        onError?.(e);
      }
    }

    async function handleCredentialResponse(response) {
      try {
        if (!response || !response.credential) {
          throw new Error("No credential returned from Google");
        }

        const id_token = response.credential;

        // POST to backend for verification & app sign-in
        let backendResp;
        if (api && typeof api.post === "function") {
          backendResp = await api.post("/api/auth/google", { id_token });
        } else {
          const r = await fetch("/api/auth/google", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id_token })
          });
          backendResp = { data: await r.json() };
        }

        const data = backendResp?.data ?? null;
        if (!data || !data.ok) {
          const msg = data?.error || data?.message || "Google backend auth failed";
          throw new Error(msg);
        }

        onSuccess?.(data.user, data.token);
      } catch (err) {
        console.error("[GoogleSignIn] credential handling failed:", err);
        onError?.(err);
      }
    }

    if (!existing) {
      const s = document.createElement("script");
      s.src = "https://accounts.google.com/gsi/client";
      s.async = true;
      s.defer = true;
      s.id = scriptId;
      s.onload = () => {
        // small delay to let window.google be ready
        setTimeout(() => renderButton(), 200);
      };
      s.onerror = (e) => {
        console.error("[GoogleSignIn] Failed to load Google script", e);
        onError?.(new Error("Failed to load Google script"));
      };
      document.body.appendChild(s);
    } else {
      // script already present
      setTimeout(() => renderButton(), 200);
    }

    return () => {
      try {
        if (window.google?.accounts?.id) window.google.accounts.id.cancel();
      } catch (e) {
        // ignore
      }
    };
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <div ref={containerRef} id={id} className="w-full flex justify-center" />
      {!loaded && <div className="text-xs text-gray-400 mt-2 text-center">Loading Google sign-in...</div>}
    </div>
  );
}
