import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
  // lib 产物不应携带 public 静态资源；仅发布 we3d.js + 类型声明
  publicDir: false,
  plugins: [
    dts({
      tsconfigPath: './tsconfig.lib.json',
      entryRoot: 'src/we',
      outDirs: 'dist',
      // 首版 per-file 声明（不聚合）；Phase 8 收敛后再开 bundleTypes:true
      bundleTypes: false,
    }),
  ],
  build: {
    emptyOutDir: true,
    outDir: 'dist',
    sourcemap: true,
    lib: {
      entry: 'src/we/index.ts',
      formats: ['es'],
      fileName: 'we3d',
    },
    rollupOptions: {
      // 全部 dependencies 外部化（wasm 相关依赖不打进产物）
      external: [
        /^@loaders\.gl\//,
        '@dimforge/rapier3d',
        'hdrify',
        'js-md5',
        'ktx-parse',
        'webgpu-utils',
        'wgpu-matrix',
      ],
    },
  },
});
