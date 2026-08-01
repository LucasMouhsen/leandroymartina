import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages serves the custom domain from its root, rather than from
  // the repository path used by the default github.io URL.
  base: '/',
  plugins: [react()],
})
