import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    outDir: 'docs', // This tells Vite to build into a 'docs' folder
  },
  server: {
    headers: {
      "Content-Security-Policy": "script-src 'self' 'unsafe-eval' 'wasm-eval'; object-src 'none';"
    }
  }
})