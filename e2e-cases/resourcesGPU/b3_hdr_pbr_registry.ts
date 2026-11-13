/**
 * §3.3 B3：HDR / PBR 登记遗漏
 *
 * 旧实现 HDRTexture 写 textureOfString 但 mapList.push 被注释（不登记回删），
 * PBRMaterial.createTexture() 绕过通用 set() 直写 weTextureOfString；
 * 新实现统一走 acquire()（登记与创建合并）。
 *
 * 左侧：HDRTexture 贴图的盒子；右侧：PBRMaterial 共用同一 albedo URL 的球体（两个材质）。
 * 画面判读：HDR 与 PBR 两条路径都应正常出图，不出现贴图缺失或黑屏。
 */
import {
    PerspectiveCamera,
    IV_Scene,
    initScene,
    BoxGeometry,
    SphereGeometry,
    TextureMaterial,
    IV_MeshEntity,
    Mesh,
    HDRTexture,
    PBRMaterial,
    IV_PBRMaterial,
    AmbientLight,
    DirectionalLight,
    ColorMaterial,
} from '@we3d';

declare global {
    interface Window {
        scene: any;
    }
}

const initConfig: IV_Scene = {
    canvas: 'render',
    backgroudColor: [0, 0, 0, 1],
    reversedZ: true,
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

await scene.add(new DirectionalLight({ color: [1, 1, 1], direction: [0, 1, 0], intensity: 1 }));
await scene.add(new AmbientLight({ color: [1, 1, 1], intensity: 0.6 }));

// 左：HDRTexture（旧实现写 textureOfString 但未登记）
const hdrTexture = new HDRTexture({ source: '/IBL/brdfLut/dfg_lut_128.hdr' }, scene.device, scene);
await hdrTexture.init();
const hdrMaterial = new TextureMaterial({ texture: hdrTexture });
const hdrMesh = new Mesh({
    attributes: { geometry: new BoxGeometry() },
    material: hdrMaterial,
} as IV_MeshEntity);
await scene.add({ entity: hdrMesh, position: [-1.1, 0, 0] });

// 右：两个 PBRMaterial 共用同一 albedo URL（触发 weTextureOfString 共享与登记路径）
const albedo = '/resource/PBR/rustediron/rustediron2_basecolor.png';
const pbrOptions: IV_PBRMaterial = {
    textures: {
        albedo: { texture: { source: albedo } },
        metallic: { texture: { source: '/resource/PBR/rustediron/rustediron2_metallic.png' } },
        roughness: { texture: { source: '/resource/PBR/rustediron/rustediron2_roughness.png' } },
    },
};
const pbrMaterialA = new PBRMaterial(pbrOptions);
const pbrMaterialB = new PBRMaterial(pbrOptions);

const sphereA = new Mesh({
    attributes: { geometry: new SphereGeometry({ widthSegments: 32, heightSegments: 32 }) },
    material: pbrMaterialA,
} as IV_MeshEntity);
const sphereB = new Mesh({
    attributes: { geometry: new SphereGeometry({ widthSegments: 32, heightSegments: 32 }) },
    material: new ColorMaterial({ color: [0.9, 0.5, 0.1, 1] }),
} as IV_MeshEntity);
await scene.add({ entity: sphereA, position: [0.75, -0.6, 0] });
await scene.add({ entity: sphereB, position: [1.6, 0.7, -1] });

// 第二个 PBR 材质也挂到场景（小尺寸），确保同一 URL 被两次 createTexture 命中
const sphereC = new Mesh({
    attributes: {
        geometry: new SphereGeometry({ radius: 0.35, widthSegments: 16, heightSegments: 16 }),
    },
    material: pbrMaterialB,
} as IV_MeshEntity);
await scene.add({ entity: sphereC, position: [2.1, -0.9, 0] });
