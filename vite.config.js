import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'icon-180.png'],
      manifest: {
        name: 'Seminario Bíblico Fares',
        short_name: 'Mi Pensum',
        description: 'Pensum, materias, guías y evaluaciones del Seminario Bíblico Fares',
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#1B4F72',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
  },
})