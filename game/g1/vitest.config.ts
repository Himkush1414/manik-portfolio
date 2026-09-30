import { defineConfig } from 'vitest/config';

// Unit tests only (pure logic: save migrations, unlocks, purchases, rating
// math, binding conflicts, FSM guards, ShipSpec validation). The app itself
// is served by the portfolio's Vite at /game/g1/.
export default defineConfig({
  root: __dirname,
  test: {
    include: ['src/tests/**/*.test.ts'],
    environment: 'node',
  },
});
