import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // 交付方式為「靜態檔放內網」，用相對路徑才不會綁死部署目錄
  base: './',
  server: { port: 3400 },
  build: {
    outDir: 'dist',
    // three 很大，單獨切出來避免主 chunk 爆掉
    // （Vite 8 走 rolldown，manualChunks 必須是函式而不是物件）
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three')) return 'three';
          if (id.includes('@react-three')) return 'r3f';
          return null;
        },
      },
    },
  },
});
