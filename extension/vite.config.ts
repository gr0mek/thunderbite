import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./manifest.config";

export default defineConfig({
  plugins: [preact(), crx({ manifest })],
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
    },
  },
  build: {
    target: "es2022",
    outDir: "dist",
    emptyOutDir: true,
    // Extension pages load chunks straight from the packed extension, so
    // <link rel="modulepreload"> buys nothing — and Chrome refuses to reuse
    // those preloads for chrome-extension:// resources ("cross-world
    // extension resource mismatch"), fetching every chunk twice and logging
    // a warning per chunk. Static imports still load the chunks normally.
    modulePreload: false,
  },
});
