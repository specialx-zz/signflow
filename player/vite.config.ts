import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Electron file:// 로드를 위해 상대경로 사용
  base: './',
  server: {
    port: 5174,
    host: true,
  },
  build: {
    // 청크 크기 경고 임계값 상향
    chunkSizeWarningLimit: 1000,
  },
})
