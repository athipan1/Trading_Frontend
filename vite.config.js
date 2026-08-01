import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{js,jsx}'],
    setupFiles: ['./src/test/setup.js'],
    restoreMocks: true,
    clearMocks: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'lcov'],
      include: [
        'src/components/systemIncidentModel.js',
        'src/config/**/*.js',
        'src/hooks/**/*.js',
        'src/i18n.js',
        'src/services/**/*.js',
        'src/utils/**/*.js',
      ],
      exclude: ['src/**/*.test.{js,jsx}', 'src/test/**'],
      thresholds: {
        statements: 90,
        branches: 80,
        functions: 90,
        lines: 90,
      },
    },
  },
});
