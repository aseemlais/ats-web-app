import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import type { ProxyOptions } from "vite";

export function simulateNetworkError(
  _timeout: number,
): ProxyOptions["configure"] {
  return (proxy, _options) => {
    proxy.on("proxyReq", (proxyReq, _req, res) => {
      setTimeout(() => {
        // Destroy the socket connection to the browser
        res.socket?.destroy(new Error("simulated network error"));

        // Also clean up the backend connection
        proxyReq.socket?.destroy();
      }, 2000);
    });
  };
}

const proxyTarget = "http://localhost:3001";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: "@", replacement: path.resolve(__dirname, "./src") },
      { find: "@chat-template/core/errors", replacement: path.resolve(__dirname, "../packages/core/dist/errors.js") },
      { find: "@chat-template/core", replacement: path.resolve(__dirname, "../packages/core/dist/index.js") },
      { find: "@chat-template/auth", replacement: path.resolve(__dirname, "../packages/auth/dist/index.js") },
      { find: "@chat-template/db", replacement: path.resolve(__dirname, "../packages/db/dist/index.js") },
      { find: "@chat-template/utils", replacement: path.resolve(__dirname, "../packages/utils/dist/index.js") },
    ],
  },
  server: {
    port: process.env.PORT ? Number.parseInt(process.env.PORT) : 3000,

    proxy: {
      "/api/chat": {
        target: proxyTarget,
        changeOrigin: true,
      },

      "/api": {
        target: process.env.BACKEND_URL || "http://localhost:3001",
        changeOrigin: true,
      },

      "/invocations": {
        target: proxyTarget,
        changeOrigin: true,
      },
    },
  },

  build: {
    outDir: "dist",
    sourcemap: false,
  },
});