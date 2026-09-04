import { defineConfig } from 'vite'

export default defineConfig({
  root: import.meta.dirname,
  build: {
    emptyOutDir: true,
    outDir: 'dist',
  },
})
