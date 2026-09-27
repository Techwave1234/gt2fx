import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  // Everything inlined into one dist/index.html → double-clickable from disk (file://)
  base: './',
  server: {
    host: true,
    port: 5173,
  },
})
