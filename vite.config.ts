import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
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
