import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/services/**', 'src/modules/**/logic.ts', 'src/bot/customId.ts'],
      reporter: ['text', 'html'],
    },
  },
});
