/**
 * §3.3 B1：共享 GPUTexture 不提前销毁
 *
 * 两个 TextureMaterial 使用同一 URL，命中 textureOfString 后共享同一 GPUTexture。
 * 销毁左侧 mesh（从画面移除）与 material（触发共享纹理释放）：
 * 旧实现 Texture._destroy() 会无条件 texture.destroy()，导致右侧材质引用的共享对象失效；
 * 新实现由释放申请 + 策略裁决，右侧应保持正常显示。
 *
 * 画面判读：左右两个带纹理的盒子。左侧被销毁后从画面移除；
 * 旧实现下右侧纹理随左侧销毁而失效（本用例暴露的差异），新实现下右侧应完整显示贴图。
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
    position: [0, 0, 5],
    lookAt: [0, 0, 0],
    controlType: 'arcball',
});
await scene.add(camera);

const source = '/resource/images/img/we3D.png';
const materialA = new TextureMaterial({ texture: source });
const materialB = new TextureMaterial({ texture: source });

const meshA = new Mesh({
    attributes: { geometry: new BoxGeometry() },
    material: materialA,
} as IV_MeshEntity);
const meshB = new Mesh({
    attributes: { geometry: new BoxGeometry() },
    material: materialB,
} as IV_MeshEntity);

await scene.add({ entity: meshA, position: [-0.75, 0, 0] });
await scene.add({ entity: meshB, position: [0.75, 0, 0] });

// 两个材质完成 init 后，销毁左侧：meshA 从画面移除 + materialA 触发共享纹理释放
meshA.destroy();
materialA.destroy();
