import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { optimizedBuild } from './scripts/lib/optimized-build.mjs'

export default defineConfig({
  plugins: [react(),optimizedBuild()],
  server: {
    port: 3001,
    strictPort: true,
    host: '127.0.0.1',
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3002',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
})
