import path from 'node:path'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

const backend = process.env.VITE_BACKEND_URL ?? 'http://127.0.0.1:8000'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: backend,
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('error', (_err, _req, res) => {
            if (res && 'writeHead' in res && !res.headersSent) {
              res.writeHead(503, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ error: { message: 'Backend đang khởi động hoặc chưa sẵn sàng. Vui lòng thử lại sau giây lát.' } }))
            }
          })
        },
      },
      '/ws': {
        target: backend.replace(/^http/, 'ws'),
        ws: true,
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('error', (_err, _req, socket) => {
            if (socket && 'destroy' in socket) {
              socket.destroy()
            }
          })
        },
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 1200,
  },
})
