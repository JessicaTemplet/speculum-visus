import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    headers: {
      // This tells the browser it's okay for Snap's WASM engine to run
      "Content-Security-Policy": "script-src 'self' 'unsafe-eval' 'wasm-eval'; object-src 'none';"
    }
  }
})