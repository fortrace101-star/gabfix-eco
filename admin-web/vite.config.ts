import { fileURLToPath, URL } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      // The rate card and catalogue read the single source used by the mobile app.
      '@mobile': fileURLToPath(new URL('../client-app/src', import.meta.url)),
    },
  },
  server: {
    fs: {
      // Allow the sibling client-app config files the alias points at.
      allow: ['..'],
    },
  },
});
