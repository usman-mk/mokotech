import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Resolves the path aliases declared in tsconfig.json, including the ones
  // added by `nest g library`. Requires Vite 8, which ships this option.
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    // Unit tests live next to the code (src/**), HTTP tests in test/**.
    include: ['src/**/*.spec.ts', 'test/**/*.spec.ts'],
    // HTTP tests use a separate `<db>_test` database (never the dev one).
    globalSetup: ['./test/setup/global-setup.ts'],
    setupFiles: ['./test/setup/test-env.ts'],
    // ...and share it: run files one at a time so they never see each
    // other's rows.
    fileParallelism: false,
  },
});
