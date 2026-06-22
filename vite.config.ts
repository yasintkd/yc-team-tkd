import { defineConfig } from 'vite'
import reactSwc from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    reactSwc(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        skipWaiting: true,
        clientsClaim: true,
      },
      manifest: {
        name: 'YÇ Team Taekwondo Yönetim',
        short_name: 'YÇ Team',
        description: 'Sporcu, aidat ve yoklama yönetimi',
        start_url: '/',
        display: 'standalone',
        background_color: '#e3f0fa',
        theme_color: '#e3f0fa',
        lang: 'tr',
        icons: [
          {
            src: '/icon-yc-team-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icon-yc-team-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
  build: {
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/') || id.includes('node_modules/react-router')) return 'react-vendor'
          if (id.includes('node_modules/@supabase')) return 'supabase'
          if (id.includes('node_modules/lucide-react')) return 'ui-vendor'
          if (id.includes('node_modules/jspdf') || id.includes('node_modules/html2canvas')) return 'pdf-export'
          if (id.includes('node_modules')) return 'vendor'
        },
      },
    },
  },
})