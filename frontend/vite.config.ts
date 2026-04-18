import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/auth": "http://localhost:4000",
      "/stock": "http://localhost:4000",
      "/blocking": "http://localhost:4000",
      "/analytics": "http://localhost:4000",
      "/config": "http://localhost:4000",
      "/users": "http://localhost:4000",
      "/branches": "http://localhost:4000",
      "/files": "http://localhost:4000",
      "/uploads": "http://localhost:4000",
      "/socket.io": {
        target: "http://localhost:4000",
        ws: true,
      },
      "/health": "http://localhost:4000",
    },
  },
});
