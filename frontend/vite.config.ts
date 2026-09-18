import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '^/(auth|cameras|recordings|streams|health|detection)(/|$)': {
        target: process.env.BACKEND_URL || 'http://127.0.0.1:5004',
        changeOrigin: true,
        bypass(req) {
          if (req.method === 'GET' && req.headers.accept?.includes('text/html') &&
              /^\/cameras\/[^/]+\/?$/.test(req.url || '')) {
            return '/index.html';
          }
        },
      },
      '/socket.io': {
        target: process.env.BACKEND_URL || 'http://127.0.0.1:5004',
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
