import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.VITE_CLERK_PUBLISHABLE_KEY': JSON.stringify(
      process.env.VITE_CLERK_PUBLISHABLE_KEY || 'pk_test_dXByaWdodC1sb25naG9ybi04NzMuY2xlcmsuYWNjb3VudHMuZGV2JA'
    ),
  },
  server: {
    port: 3002,
    host: true,
  },
  preview: {
    port: 3002,
    host: true,
  },
  build: {
    rollupOptions: {
      input: 'admin.html',
    },
  },
});
