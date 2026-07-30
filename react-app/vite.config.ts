import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const googleClientId =
  process.env.VITE_GOOGLE_CLIENT_ID?.trim() ||
  process.env.GOOGLE_CLIENT_ID?.trim() ||
  '';

const apiUrl = (process.env.VITE_API_URL || '').trim().replace(/\/$/, '');

export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.VITE_GOOGLE_CLIENT_ID': JSON.stringify(googleClientId),
    'import.meta.env.VITE_API_URL': JSON.stringify(apiUrl),
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.jsx', '.js', '.mjs', '.json'],
  },
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
