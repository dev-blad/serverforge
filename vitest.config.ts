import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/services/**', 'src/modules/**', 'src/bot/customId.ts'],
      // Thin adapters that need a live Discord connection are verified manually (see README).
      exclude: ['src/services/template/captureDiscord.ts', 'src/modules/**/runtime.ts'],
      reporter: ['text', 'html'],
    },
  },
});
