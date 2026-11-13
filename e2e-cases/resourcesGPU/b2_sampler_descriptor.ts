/**
 * §3.3 B2：sampler 缓存 key 不一致
 *
 * 旧实现 sampler/baseFunction.ts 的 has() 用 descriptor 对象、get() 用 descriptor.label 字符串，
 * 且 samplerOfString 只由 createSampler() 写入 'linear'/'nearest'/'cube'，自定义 descriptor 分支
 * 实际不命中缓存；新实现统一用规范化 descriptor key。
 *
 * 三个盒子：左/中 使用完全相同的 descriptor（应复用同一 sampler），右使用不同 descriptor（不应串用）。
 * 画面判读：三张贴图都应正常显示，中/右不出现采样错误或缺失。
 */
import {
    PerspectiveCamera,
    IV_Scene,
    initScene,
    BoxGeometry,
    TextureMaterial,
    IV_MeshEntity,
    Mesh,
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
    position: [0, 0, 6],
    lookAt: [0, 0, 0],
    controlType: 'arcball',
});
await scene.add(camera);

const source = '/resource/images/img/we3D.png';

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
    addressModeU: 'clamp-to-edge',
    addressModeV: 'clamp-to-edge',
};

const materialA = new TextureMaterial({
    texture: source,
    samplerDescriptor: linear,
    samplerBindingType: 'filtering',
});
const materialB = new TextureMaterial({
    texture: source,
    samplerDescriptor: linear,
    samplerBindingType: 'filtering',
});
const materialC = new TextureMaterial({
    texture: source,
    samplerDescriptor: nearest,
    samplerBindingType: 'filtering',
});

const boxes = [materialA, materialB, materialC].map((material, i) => {
    const mesh = new Mesh({
        attributes: { geometry: new BoxGeometry() },
        material,
    } as IV_MeshEntity);
    return { mesh, x: (i - 1) * 1.15 };
});

for (const item of boxes) {
    await scene.add({ entity: item.mesh, position: [item.x, 0, 0] });
}
