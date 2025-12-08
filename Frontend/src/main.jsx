// src/main.jsx
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";

// IMPORTANT: import your CSS (Tailwind directives or compiled CSS).
// Adding ?v=${Date.now()} forces a cache-bust in dev so you always get latest CSS.
// Remove the query param for production builds.
import "./index.css" ; 

createRoot(document.getElementById("root")).render(
  <AuthProvider>
    <App />
  </AuthProvider>
);
