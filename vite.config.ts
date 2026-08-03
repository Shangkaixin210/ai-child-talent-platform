import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api/platform': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      // 深海基地行为评分由 Node 服务(3000)提供，优先于 /api/assessment
      '/api/assessment/submit-level': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      // 职业体验 + 深海基地 SSO（已合并到 story-backend :8000）
      '/api/assessment': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
