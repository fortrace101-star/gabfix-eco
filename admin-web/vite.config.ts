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
  esbuild: {
    // esbuild reads the nearest tsconfig.json for every file it transforms, so the
    // shared client-app sources pull in client-app/tsconfig.json. That file extends
    // "expo/tsconfig.base", which only resolves where the mobile app's dependencies
    // are installed (locally) and not in this build (Expo is not a dependency here).
    // Passing the settings explicitly makes esbuild skip that lookup.
    tsconfigRaw: JSON.stringify({
      compilerOptions: {
        target: 'ES2022',
        useDefineForClassFields: true,
        jsx: 'automatic',
        isolatedModules: true,
      },
    }),
  },
  server: {
    fs: {
      // Allow the sibling client-app config files the alias points at.
      allow: ['..'],
    },
  },
});
