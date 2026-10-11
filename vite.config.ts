import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

const apiPort = Number(process.env.PORT ?? "3000");
const apiTarget = `http://127.0.0.1:${apiPort}`;

export default defineConfig({
  envDir: false,
  plugins: [vue()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": { target: apiTarget, changeOrigin: false },
      "/session": { target: apiTarget, changeOrigin: false },
    },
  },
  preview: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": { target: apiTarget, changeOrigin: false },
      "/session": { target: apiTarget, changeOrigin: false },
    },
  },
});
