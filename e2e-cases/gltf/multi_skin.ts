import {
    IV_Scene,
    initScene,
    PerspectiveCamera,
    AmbientLight,
    DirectionalLight,
    createGLTFModel,
    E_AnimationPlayType,
} from '@we3d';

declare global {
    interface Window {
        scene: any;
        gltf: any;
    }
}

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
    position: [0, 1, 3],
    lookAt: [0, 1, 0],
});
await scene.add(camera);

await scene.add(
    new DirectionalLight({ color: [1, 1, 1], direction: [1, 1, 1], intensity: 3 }),
);
await scene.add(new AmbientLight({ color: [1, 1, 1], intensity: 0.2 }));

// P4-1 D4：多 skin 渲染回归。两个 skinned mesh（SkinA / SkinB）左右分离（x ∓ 0.7），
// 各自绑定自己的 joints（[2,3] / [4,5]）与独立动画；修复前全量双重循环会互相串驱动。
const gltf = await createGLTFModel({
    scene,
    url: '/models/gltf/base/skin/MultiSkin.gltf',
});
window.gltf = gltf;
const node = await scene.add(gltf);

// e2e 约定：固定播放 0.5 秒后停在当前帧（而非 0 帧），确保截图基线覆盖 skin 动画驱动结果
node.AnimationGroup?.forEach((group) => {
    group.play({
        speed: 1,
        mode: { type: E_AnimationPlayType.time, time: 0.5 },
        stopToFirst: false,
    });
});
