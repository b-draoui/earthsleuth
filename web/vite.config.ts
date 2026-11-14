import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    chunkSizeWarningLimit: 1200, // maplibre-gl alone is ~1.1 MB; it loads once and is cached
  },
  optimizeDeps: {
    // Pre-bundle the map libraries at start-up, otherwise the first page load can fail
    // with "Outdated Optimize Dep" while Vite discovers them.
    include: ['maplibre-gl', 'react-map-gl/maplibre', 'recharts', 'react-force-graph-2d', 'motion/react'],
  },
  server: {
    // In development, calls to /api go to FastAPI (uvicorn on port 8000).
    proxy: { '/api': 'http://localhost:8000' },
  },
})
