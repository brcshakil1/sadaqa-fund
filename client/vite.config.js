import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // In development, /api calls are forwarded to the Node server.
    // 127.0.0.1 (not "localhost") avoids IPv4/IPv6 mix-ups on Windows that cause "ECONNRESET".
    proxy: {
      '/api': { target: 'http://127.0.0.1:5000', changeOrigin: true },
    },
  },
});