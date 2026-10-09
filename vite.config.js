import { defineConfig } from 'vite'
import sygnal from 'sygnal/vite'


// https://vitejs.dev/config/

export default defineConfig({
  // sets up JSX, HMR, dev diagnostics and Vitest for Sygnal
  plugins: [sygnal()],
  build: {
    outDir: './dist',
    emptyOutDir: true
  },
  server: {
    port: 5173,
    force: true
  },
  base: ""
})
