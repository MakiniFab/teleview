import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'https://deriv-backend-api.onrender.com', // Your Render URL
        changeOrigin: true,
        secure: false,
      },
    },
  },
});