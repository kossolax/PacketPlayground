/* eslint-disable import/no-extraneous-dependencies */
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import { checker } from 'vite-plugin-checker';
import svgr from 'vite-plugin-svgr';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    base: env.BASE_URL || '/',
    plugins: [
      react(),
      svgr(),
      checker({
        typescript: true,
        eslint: {
          lintCommand: 'eslint "./src/**/*.{js,jsx,ts,tsx}"',
          useFlatConfig: true,
        },
      }),
    ],
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom', 'react-router-dom', 'react-i18next'],
            icons: ['lucide-react', '@radix-ui/react-icons'],
          },
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    define: {
      'process.env': env,
    },
    test: {
      environment: 'jsdom',
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/*.old/**',
        '**/src/components/ui/**',
        '**/src/lib/simulation-test-helpers.test.ts',
        '**/netflow/**',
      ],
      globals: true,
      setupFiles: './vitest-setup.ts',
      coverage: {
        provider: 'v8',
        reporter: ['json-summary', 'text-summary', 'html'],
        reportsDirectory: './coverage',
        exclude: ['**/node_modules/**', '**/dist/**', '**/*.old/**'],
      },
    },
    server: {
      watch: {
        usePolling: true,
      },
    },
    worker: {
      format: 'es',
    },
  };
});
