import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// The port is fixed because Supabase only sends email links back to addresses on its Redirect URLs list.
// If 5173 is busy, Vite stops with an error instead of quietly picking another port.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true, // listen on your local network so your phone can connect
    port: 5173,
    strictPort: true,
    open: true,
  },
  preview: {
    port: 5173,
    strictPort: true,
  },
})
