import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';

export default defineConfig({
  plugins: [
    wasm(),
    topLevelAwait(), // 解决 Wasm 初始化时的顶层 await 问题
  ],
  resolve: {
    alias: {
      // 公共 API 入口别名（examples/e2e 走 @we3d 导入）
      '@we3d': fileURLToPath(new URL('./src/we/index.ts', import.meta.url)),
    },
  },
  server: {
    hmr: {
      overlay: false,
    },
  },
  build: {
    sourcemap: true,
  },
});
