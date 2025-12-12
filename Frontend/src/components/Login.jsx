// src/components/Login.jsx
import React, { useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import GoogleSignIn from "../components/GoogleSignIn";
import { setApiToken } from "../lib/api";

export default function Login({ onSuccess }) {
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const trimmedEmail = (email || "").trim();
    if (!trimmedEmail || !password) {
      setError("Please enter email and password.");
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setError("Please enter a valid email address.");
      return;
    }

    setBusy(true);
    try {
      const res = await login({ email: trimmedEmail, password });

      if (res && res.ok) {
        // Prefer token returned by API; fallback to common shapes or localStorage
        const token =
          res.token ||
          res?.data?.token ||
          res?.data?.token ||
          res?.token ||
          localStorage.getItem("token") ||
          null;

        if (token) {
          try {
            localStorage.setItem("token", token);
          } catch (e) {
            console.warn("Failed to persist token:", e);
          }
          try {
            setApiToken(token);
          } catch (e) {
            console.warn("Failed to set api token:", e);
          }
        }

        onSuccess?.();
        navigate("/", { replace: true });
      } else {
        const err = res?.error || res;
        if (err?.error) setError(typeof err.error === "string" ? err.error : JSON.stringify(err.error));
        else if (err?.errors) setError(Array.isArray(err.errors) ? err.errors.map(x => x.msg || JSON.stringify(x)).join(", ") : JSON.stringify(err.errors));
        else setError(typeof err === "string" ? err : JSON.stringify(err));
      }
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || "Login failed";
      setError(typeof msg === "string" ? msg : JSON.stringify(msg));
    } finally {
      setBusy(false);
    }
  };

  // Called when GoogleSignIn returns successfully
  const handleGoogleSuccess = async (user, token) => {
    setError(null);
    setBusy(true);
    try {
      let handled = false;
      if (typeof login === "function") {
        try {
          const maybe = await login({ token, social: true, user });
          if (maybe && maybe.ok) {
            handled = true;
            // if login() returned a token, prefer it
            const returnedToken = maybe.token || maybe?.data?.token || localStorage.getItem("token");
            if (returnedToken) {
              try {
                localStorage.setItem("token", returnedToken);
              } catch (e) { console.warn("Failed to persist token:", e); }
              setApiToken(returnedToken);
            }
          }
        } catch (e) {
          // ignore and fallback
        }
      }

      if (!handled) {
        if (token) {
          try {
            localStorage.setItem("token", token);
          } catch (e) { console.warn("Failed to persist token:", e); }
          try {
            setApiToken(token);
          } catch (e) { console.warn("Failed to set api token:", e); }
        }
      }

      onSuccess?.(user, token);
      navigate("/", { replace: true });
    } catch (err) {
      console.error("Google login handler error:", err);
      setError(err?.message || "Google login failed");
    } finally {
      setBusy(false);
    }
  };

  const handleGoogleError = (err) => {
    console.error("GoogleSignIn error:", err);
    setError(err?.message || "Google sign-in failed");
  };

  const handleForgotPassword = () => {
    alert("Password reset feature coming soon. Please contact your administrator.");
  };

  const handleContactSupport = () => {
    alert("IT Support: support@pharmacorp.com\nPhone: +1 (800) 555-1234");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full mx-auto animate-fade-in">
        {/* Animated Logo & Header */}
        <div className="text-center mb-8 animate-slide-down">
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg hover:shadow-xl transition-shadow duration-300">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-blue-800 mb-2">PharmaAssist AI</h1>
          <p className="text-blue-600 font-medium">Secure Research Intelligence Platform</p>
          <div className="mt-2 flex items-center justify-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-xs text-gray-600">Secure Connection • HIPAA Compliant</span>
          </div>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-2xl border border-blue-200 overflow-hidden transform transition-transform duration-300 hover:scale-[1.01]">
          {/* Card Header with Gradient */}
          <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-blue-800 px-6 py-5 relative">
            <div className="absolute top-2 right-4">
              <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
            </div>
            <h2 className="text-xl font-bold text-white">Medical Researcher Login</h2>
            <p className="text-blue-100 text-sm mt-1">Access pharmaceutical research database</p>
            <div className="mt-2 flex items-center gap-2">
              <svg className="w-4 h-4 text-blue-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span className="text-xs text-blue-200">256-bit SSL Encryption</span>
            </div>
          </div>

          {/* Card Body */}
          <div className="p-6">
            {error && (
              <div role="alert" className="bg-gradient-to-r from-red-50 to-red-100 border border-red-200 rounded-xl p-4 mb-6 animate-shake">
                <div className="flex items-start gap-3">
                  <div className="bg-red-500 p-2 rounded-lg">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-red-800 mb-1">Authentication Error</p>
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6" noValidate>
              {/* Email Field */}
              <div>
                <label htmlFor="email" className="block text-sm font-bold text-gray-800 mb-2">
                  Corporate Email Address
                  <span className="text-red-500 ml-1">*</span>
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                    </svg>
                  </div>
                  <input
                    id="email"
                    className="w-full border-2 border-blue-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 pl-10 pr-4 py-3.5 rounded-xl transition-all duration-300 hover:border-blue-300"
                    placeholder="researcher@pharmacorp.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    type="email"
                    name="email"
                    autoComplete="email"
                    required
                    disabled={busy}
                  />
                </div>
              </div>

              {/* Password Field */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="password" className="block text-sm font-bold text-gray-800">
                    Password
                    <span className="text-red-500 ml-1">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    className="text-xs text-blue-600 hover:text-blue-800 font-semibold transition-colors"
                    disabled={busy}
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <input
                    id="password"
                    className="w-full border-2 border-blue-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 pl-10 pr-12 py-3.5 rounded-xl transition-all duration-300 hover:border-blue-300"
                    placeholder="••••••••"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    name="password"
                    autoComplete="current-password"
                    required
                    disabled={busy}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    disabled={busy}
                  >
                    <svg className="h-5 w-5 text-gray-400 hover:text-blue-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {showPassword ? (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L6.59 6.59m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      )}
                    </svg>
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Minimum 8 characters with uppercase, lowercase, and number
                </p>
              </div>

              {/* Remember Me & Security */}
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <input
                    id="remember-me"
                    type="checkbox"
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-blue-300 rounded"
                    disabled={busy}
                  />
                  <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-700">
                    Remember this device
                  </label>
                </div>
                <div className="flex items-center gap-1">
                  <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  <span className="text-xs text-green-600 font-medium">Secure</span>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={busy}
                className={`w-full py-4 px-4 rounded-xl font-bold text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-0.5 ${
                  busy
                    ? "bg-blue-400 cursor-not-allowed"
                    : "bg-gradient-to-r from-blue-600 via-blue-700 to-blue-800 hover:from-blue-700 hover:via-blue-800 hover:to-blue-900"
                }`}
                aria-busy={busy}
              >
                {busy ? (
                  <div className="flex items-center justify-center gap-3">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span className="font-semibold">Authenticating...</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-3">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                    </svg>
                    <span className="font-semibold">Access Research Portal</span>
                  </div>
                )}
              </button>
            </form>

            {/* Social Login Separator */}
            <div className="mt-8">
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-gradient-to-r from-transparent via-blue-200 to-transparent"></div>
                <div className="text-xs font-medium text-gray-500 bg-white px-3">OR CONTINUE WITH</div>
                <div className="flex-1 h-px bg-gradient-to-r from-transparent via-blue-200 to-transparent"></div>
              </div>

              {/* Google Sign-In */}
              <div className="mt-4">
                <GoogleSignIn
                  onSuccess={handleGoogleSuccess}
                  onError={handleGoogleError}
                  disabled={busy}
                />
              </div>

              {/* Alternative Login Methods */}
              <div className="mt-6 grid grid-cols-2 gap-3">
                <button
                  onClick={handleContactSupport}
                  disabled={busy}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg border border-blue-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  <span className="text-sm font-medium">Call Support</span>
                </button>
                <button
                  onClick={() => navigate("/signup")}
                  disabled={busy}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-white hover:bg-gray-50 text-gray-700 rounded-lg border border-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                  <span className="text-sm font-medium">Create Account</span>
                </button>
              </div>
            </div>
          </div>

          {/* Card Footer */}
          <div className="bg-gradient-to-r from-blue-50 to-blue-100 px-6 py-4 border-t border-blue-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <p className="text-xs text-blue-700 font-medium">HIPAA Compliant • AES-256 Encryption</p>
              </div>
              <div className="text-xs text-blue-600 bg-blue-200/30 px-2 py-1 rounded">v2.1</div>
            </div>
          </div>
        </div>

        {/* Additional Links & Info */}
        <div className="mt-8 space-y-4">
          <div className="bg-gradient-to-r from-blue-50 to-white rounded-xl p-4 border border-blue-200">
            <div className="flex items-start gap-3">
              <div className="bg-blue-100 p-2 rounded-lg">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-bold text-blue-800 mb-1">Login Requirements</p>
                <p className="text-xs text-blue-600">
                  Access requires corporate email and multi-factor authentication. Unauthorized access is strictly prohibited and monitored.
                </p>
              </div>
            </div>
          </div>

          <div className="text-center">
            <p className="text-sm text-gray-600">
              Need access?{" "}
              <button
                onClick={handleContactSupport}
                className="text-blue-600 hover:text-blue-800 font-bold transition-colors"
              >
                Contact IT Support
              </button>
            </p>
            <div className="mt-4 flex items-center justify-center space-x-4">
              <div className="w-12 h-px bg-gradient-to-r from-transparent via-blue-300 to-transparent"></div>
              <span className="text-xs text-gray-500 font-medium">© 2024 PharmaCorp Research</span>
              <div className="w-12 h-px bg-gradient-to-r from-transparent via-blue-300 to-transparent"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
// Add custom animations to Tailwind config (add to tailwind.config.js)
const customAnimations = `
@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slide-down {
  from { transform: translateY(-20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
  20%, 40%, 60%, 80% { transform: translateX(5px); }
}

.animate-fade-in {
  animation: fade-in 0.5s ease-out;
}

.animate-slide-down {
  animation: slide-down 0.6s ease-out;
}

.animate-shake {
  animation: shake 0.5s ease-in-out;
}
`;