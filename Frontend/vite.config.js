import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
<<<<<<< HEAD
  base: "/",

  server: {
    host: true,
    port: 5173,
    allowedHosts: "all",

    headers: {
      "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
    },
  },
});
=======
  base: "/",   // for Vercel

  server: {
    host: true,          // 🔥 allows external access
    port: 5173,
    allowedHosts: "all", // 🔥 allow loca.lt / ngrok domains
  },
  headers: {
      "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
    },
});
>>>>>>> def0ffa (Updated Vite Config)
