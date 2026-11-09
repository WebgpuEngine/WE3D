import {
    IV_Scene,
    initScene,
    PerspectiveCamera,
    AmbientLight,
    DirectionalLight,
    createGLTFModel,
} from '@we3d';

declare global {
    interface Window {
        scene: any;
        gltf: any;
    }
}

// P2-2：KHR_texture_basisu 视觉回归（ETC1S / BasisLZ）。
// 引擎 getImage() 按 image/ktx2 分流到纹理转码注册表，懒加载 public/basis/ 的
// Basis Universal transcoder 输出 RGBA8 ImageBitmap；宿主零注入、零 provider 注册。
const input: IV_Scene = {
    canvas: 'render',
    backgroudColor: [0, 0, 0, 1],
};
const scene = await initScene({ initConfig: input });
window.scene = scene;

const camera = new PerspectiveCamera({
    fov: (2 * Math.PI) / 5,
    aspect: scene.aspect,
    near: 0.01,
    far: 100,
    position: [0, 0, 3],
    lookAt: [0, 0, 0],
});
await scene.add(camera);

await scene.add(
    new DirectionalLight({ color: [1, 1, 1], direction: [1, 1, 1], intensity: 3 }),
);
await scene.add(new AmbientLight({ color: [1, 1, 1], intensity: 0.4 }));

const gltf = await createGLTFModel({
    scene,
    url: '/models/gltf/base/texture/ktx2/BoxTexturedETC1S.gltf',
});
window.gltf = gltf;
await scene.add(gltf);
