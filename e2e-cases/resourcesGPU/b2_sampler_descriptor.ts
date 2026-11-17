/**
 * §3.3 B2：sampler 缓存 key 不一致
 *
 * 旧实现 sampler/baseFunction.ts 的 has() 用 descriptor 对象、get() 用 descriptor.label 字符串，
 * 且 samplerOfString 只由 createSampler() 写入 'linear'/'nearest'/'cube'，自定义 descriptor 分支
 * 实际不命中缓存；新实现统一用规范化 descriptor key。
 *
 * 三个盒子共用同一张程序化「米」字纹理（同一 source，验证 textureOfString 共享同一 GPUTexture），
 * 采样器通过 Texture 对象显式传入（TextureMaterial 的 samplerDescriptor 不会传递到底层 sampler）：
 * 左 / 中 使用完全相同的 linear descriptor（应复用同一 sampler，画面平滑一致），
 * 右使用 nearest descriptor（不应串用，斜线呈明显锯齿）。
 *
 * 为让人眼可分辨 linear 与 nearest 的差异，纹理采用高对比「米」字格（横、竖、撇、捺），
 * 其中密集斜线最能体现过滤差异，并将相机拉近产生放大采样（magFilter 主导），使：
 *   - linear：斜线边缘平滑过渡
 *   - nearest：斜线呈硬边锯齿（马赛克感）
 * 两种 sampler 的差异在放大时一目了然。
 */
import {
    PerspectiveCamera,
    IV_Scene,
    initScene,
    BoxGeometry,
    TextureMaterial,
    IV_MeshEntity,
    Mesh,
    Texture,
} from '@we3d';

declare global {
    interface Window {
        scene: any;
    }
}

const initConfig: IV_Scene = {
    canvas: 'render',
    backgroudColor: [0, 0, 0, 1],
};
const scene = await initScene({ initConfig });
window.scene = scene;

const camera = new PerspectiveCamera({
    fov: (2 * Math.PI) / 5,
    aspect: scene.aspect,
    near: 0.01,
    far: 100,
    position: [0, 0, 4],
    lookAt: [0, 0, 0],
    controlType: 'arcball',
});
await scene.add(camera);

/**
 * 程序化高对比「米」字格纹理。
 * 白底、深色外框，中心绘制横、竖、撇、捺（十字 + 双对角线）构成「米」字。
 * 斜线是体现过滤差异的关键：放大采样下 linear 平滑、nearest 硬边锯齿。
 */
function makeMiPattern(size = 64): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    // 白底
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);
    // 深色外框
    ctx.strokeStyle = '#111111';
    ctx.lineWidth = 3;
    ctx.strokeRect(1.5, 1.5, size - 3, size - 3);
    // “米”字：横、竖、撇、捺
    const m = size * 0.14;
    const c = size / 2;
    ctx.strokeStyle = '#111111';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(m, c);
    ctx.lineTo(size - m, c); // 横
    ctx.moveTo(c, m);
    ctx.lineTo(c, size - m); // 竖
    ctx.moveTo(m, m);
    ctx.lineTo(size - m, size - m); // 撇
    ctx.moveTo(size - m, m);
    ctx.lineTo(m, size - m); // 捺
    ctx.stroke();
    return canvas;
}

// 三个盒子共用同一张纹理 source（验证 textureOfString 共享同一 GPUTexture）
const source = makeMiPattern();

const linear: GPUSamplerDescriptor = {
    label: 'e2e-sampler-linear',
    magFilter: 'linear',
    minFilter: 'linear',
    mipmapFilter: 'linear',
    addressModeU: 'repeat',
    addressModeV: 'repeat',
};
const nearest: GPUSamplerDescriptor = {
    label: 'e2e-sampler-nearest',
    magFilter: 'nearest',
    minFilter: 'nearest',
    mipmapFilter: 'nearest',
    addressModeU: 'repeat',
    addressModeV: 'repeat',
};

// 三个纹理对象：A/B 使用完全相同的 descriptor（应复用同一 sampler，画面平滑一致），
// C 使用不同 descriptor（不应串用，画面呈现明显棋盘格马赛克）
const textureA = new Texture(
    { source, sampler: linear, samplerBindingType: 'filtering' },
    scene.device,
    scene,
);
const textureB = new Texture(
    { source, sampler: linear, samplerBindingType: 'filtering' },
    scene.device,
    scene,
);
const textureC = new Texture(
    { source, sampler: nearest, samplerBindingType: 'filtering' },
    scene.device,
    scene,
);
await textureA.init(scene);
await textureB.init(scene);
await textureC.init(scene);

// 验证 sampler 缓存：A/B 使用相同 descriptor，其 GPU sampler 应复用同一对象
(scene as any).__b2_samplerReused = textureA.sampler === textureB.sampler;

const materialA = new TextureMaterial({ texture: textureA });
const materialB = new TextureMaterial({ texture: textureB });
const materialC = new TextureMaterial({ texture: textureC });

const boxes = [materialA, materialB, materialC].map((material, i) => {
    const mesh = new Mesh({
        attributes: { geometry: new BoxGeometry() },
        material,
    } as IV_MeshEntity);
    return { mesh, x: (i - 1) * 1.3 };
});

for (const item of boxes) {
    await scene.add({ entity: item.mesh, position: [item.x, 0, 0] });
}
