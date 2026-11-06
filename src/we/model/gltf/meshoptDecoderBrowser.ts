/**
 * 浏览器侧 Meshopt 解码器工厂 —— 通用扩展依赖机制的**内置 provider**。
 *
 * - `EXT_meshopt_compression` 由 `getExtensionDependencyKeys()` 自动发现
 *   （官方 `readDependencies: ['meshopt.decoder']`）；本模块作为 `DEFAULT_PROVIDERS`
 *   的 `'meshopt.decoder'` 加载器，资产声明该扩展时自动懒加载并注册，宿主零注入。
 * - lib 不打包 `meshoptimizer`：通过 `vite.lib.config.ts` 的 external + 动态 import
 *   由宿主解析。`MeshoptDecoder` 自带 WASM（inline），无需 `public/` 额外资源。
 * - 需要自定义实现时可用 `registerExtensionDependencyProvider('meshopt.decoder', loader)`
 *   或 `createGLTFModel({ extensionDependencies: { 'meshopt.decoder': loader } })` 覆盖。
 */
export async function createBrowserMeshoptDecoder(): Promise<unknown> {
    const { MeshoptDecoder } = await import('meshoptimizer');
    await MeshoptDecoder.ready;
    return MeshoptDecoder;
}
