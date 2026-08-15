import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      // 开发时把数据 API 代理到本地服务端（node server.js）
      "/api": "http://127.0.0.1:4173",
      "/login": "http://127.0.0.1:4173",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
