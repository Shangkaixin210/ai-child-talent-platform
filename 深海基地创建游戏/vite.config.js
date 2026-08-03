import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  // 使用相对资源路径，便于作为子模块嵌入主平台。
  base: './',
  plugins: [vue()],
  build: {
    // 主平台会把这个目录作为 /deep-sea/ 静态页面一起发布。
    outDir: '../public/deep-sea',
    emptyOutDir: true,
  },
  server: {
    port: 3001,
    proxy: {
      '/api': {
        target: 'http://localhost:8005',
        changeOrigin: true,
      },
    },
  },
})
