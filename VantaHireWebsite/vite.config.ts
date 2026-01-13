import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    sourcemap: true,
    chunkSizeWarningLimit: 1000, // Raised after vendor chunking; further reduction needs lazy routes
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Core React runtime
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/')) {
            return 'vendor-react';
          }
          // Data fetching
          if (id.includes('@tanstack/react-query')) {
            return 'vendor-query';
          }
          // Date utilities
          if (id.includes('date-fns')) {
            return 'vendor-date';
          }
          // Icons (lucide is large)
          if (id.includes('lucide-react')) {
            return 'vendor-icons';
          }
          // UI components (Radix primitives)
          if (id.includes('@radix-ui')) {
            return 'vendor-ui';
          }
          // Charts and visualization
          if (id.includes('recharts') || id.includes('d3-') || id.includes('victory')) {
            return 'vendor-charts';
          }
          // Form handling
          if (id.includes('react-hook-form') || id.includes('@hookform') || id.includes('node_modules/zod')) {
            return 'vendor-forms';
          }
          // Animation
          if (id.includes('framer-motion')) {
            return 'vendor-motion';
          }
          // Markdown/Editor
          if (id.includes('react-markdown') || id.includes('remark') || id.includes('rehype')) {
            return 'vendor-markdown';
          }
          // React Joyride (tours)
          if (id.includes('react-joyride') || id.includes('react-floater') || id.includes('popper')) {
            return 'vendor-tours';
          }
          return undefined;
        },
      },
    },
  },
});
