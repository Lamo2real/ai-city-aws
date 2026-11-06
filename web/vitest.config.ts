import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    name: "web",
    environment: "jsdom",
    include: ["web/test/**/*.test.{ts,tsx}", "test/**/*.test.{ts,tsx}"],
    root: import.meta.dirname,
  },
});
