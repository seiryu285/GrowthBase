import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    preserveSymlinks: false
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    server: {
      deps: {
        inline: [/^@growthbase\//]
      }
    },
    coverage: {
      reporter: ["text", "html"]
    }
  }
});
