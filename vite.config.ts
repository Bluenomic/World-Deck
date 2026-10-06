import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  cacheDir: process.env.WORLD_DECK_VITE_CACHE || 'node_modules/.vite',
})
