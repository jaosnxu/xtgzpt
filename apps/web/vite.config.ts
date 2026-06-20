import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const allowedHosts = process.env.VITE_ALLOWED_HOSTS
  ? process.env.VITE_ALLOWED_HOSTS.split(",").map((host) => host.trim()).filter(Boolean)
  : undefined;

export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts,
    host: process.env.WEB_HOST ?? "127.0.0.1",
    port: 3001,
    proxy: {
      "/api": {
        target: process.env.VITE_DEV_API_TARGET ?? "http://127.0.0.1:3002",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, "")
      }
    }
  }
});
