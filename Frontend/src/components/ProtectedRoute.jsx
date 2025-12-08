// src/components/ProtectedRoute.jsx
import React, { useContext } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";

export default function ProtectedRoute({ children, fallback = "/login" }) {
  const { user, token, loading } = useContext(AuthContext);

  // 1) While AuthContext is determining login state
  if (loading) {
    return (
      <div className="p-8 text-center text-gray-600">
        Loading...
      </div>
    );
  }

  // 2) If no user OR no token → force redirect
  //    (covers cases like cleared localStorage or token expiry)
  if (!user || !token) {
    return <Navigate to={fallback} replace />;
  }

  // 3) Support:
  //    <ProtectedRoute><Dashboard/></ProtectedRoute>
  //    and
  //    Route element={<ProtectedRoute/>} + <Outlet/>
  if (children) return children;

  return <Outlet />;
}
