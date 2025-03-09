import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  base: process.env.NODE_ENV === 'development' ? '/' : './',
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/renderer'),
      '@ant-design/icons-vue/es/icons': '@ant-design/icons-vue/lib/icons'
    }
  },
  server: {
    port: 5178,
    strictPort: false,
    host: true,
    hmr: {
      protocol: 'ws',
      host: 'localhost',
      port: 5178
    }
  },
  build: {
    outDir: resolve(__dirname, 'dist/renderer'),
    emptyOutDir: true,
    rollupOptions: {
      external: [
        'electron',
        '@electron/remote',
        'electron-store'
      ]
    }
  },
  publicDir: 'public',
  assetsInclude: ['**/*.svg'],
  clearScreen: false
});
