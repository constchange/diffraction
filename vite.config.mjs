import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  // EdgeOne Pages serves this app from the root of the connected domain.
  // Keep the default absolute so an HTML fallback at a nested URL cannot turn
  // /assets/foo.js into /assets/assets/foo.js. Subpath builds may override it.
  base: process.env.VITE_BASE_PATH || "/",
  build: {
    outDir: "dist/client",
    target: "es2022",
    rollupOptions: {
      preserveEntrySignatures: "strict",
      input: {
        app: resolve(import.meta.dirname, "index.html"),
        embed: resolve(import.meta.dirname, "src/embed.jsx"),
      },
      output: {
        entryFileNames: (chunk) => chunk.name === "embed" ? "embed.js" : "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
  optimizeDeps: {
    include: ["react", "react-dom/client"],
  },
  server: {
    host: "0.0.0.0",
    allowedHosts: ["terminal.local"],
    warmup: {
      clientFiles: ["./src/main.jsx"],
    },
  },
  plugins: [react()],
});
