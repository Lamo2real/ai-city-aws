// Builds only the City page for the iPhone app (city-embed.html + one script) into ios/AICity/CityWeb.
// Run: npm run build:city-embed -w @aic/web (then commit the output; a test checks it is up to date).
import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  publicDir: false,
  build: {
    outDir: "../ios/AICity/CityWeb",
    emptyOutDir: true,
    sourcemap: false,
    target: "es2022",
    modulePreload: false,
    rollupOptions: {
      input: "city-embed.html",
      output: {
        entryFileNames: "city-embed.js",
        chunkFileNames: "city-embed-[name].js",
        assetFileNames: "city-embed.[ext]",
      },
    },
  },
});
