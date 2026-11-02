import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { transform as esbuildTransform } from 'esbuild';

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
    // 强制 esbuild 压缩并去除注释：vite 7 在 build.lib 配置下内置 minify 实际未生效，
    // 故在 renderChunk 阶段显式调用 esbuild 压缩（minify + legalComments:none 去全部注释）
    {
      name: 'force-minify-esbuild',
      async renderChunk(code) {
        const { code: minified } = await esbuildTransform(code, {
          loader: 'js',
          minify: true,
          legalComments: 'none',
        });
        return { code: minified, map: null };
      },
    },
  ],
  build: {
    emptyOutDir: true,
    outDir: 'dist',
    sourcemap: true,
    // 显式关闭内置 minify：vite 7 在 build.lib 下内置 minify 实际不生效，
    // 压缩与去注释由下方 renderChunk 插件（force-minify-esbuild）统一处理
    minify: false,
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
