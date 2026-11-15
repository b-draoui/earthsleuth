import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    chunkSizeWarningLimit: 1200,
  },
  optimizeDeps: {
    include: ['maplibre-gl', 'react-map-gl/maplibre', 'recharts', 'react-force-graph-2d', 'motion/react'],
  },
  server: {
    proxy: { '/api': 'http://localhost:8000' },
  },
})
