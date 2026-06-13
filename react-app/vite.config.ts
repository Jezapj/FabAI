import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/', // Ensure production assets are mapped to the server root URL
  publicDir: 'public', // Explicitly force Vite to bundle your public static folder
  server: {
    host: '0.0.0.0',
    port: 3000,
    watch: {
      usePolling: true,
    }
  }
});
