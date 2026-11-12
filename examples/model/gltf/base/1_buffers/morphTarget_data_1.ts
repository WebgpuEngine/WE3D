import { quat, vec3 } from "wgpu-matrix";
import { PerspectiveCamera, IV_Scene, initScene, createGLTFModel } from '@we3d';

declare global {
    interface Window {
        scene: any
        DC: any
    }
}
let input: IV_Scene = {
    canvas: "render",
    backgroudColor: [0, 0, 0, 0.91],
    reversedZ: true,
};
let scene = await initScene({
    initConfig: input,
});
window.scene = scene;

let radius = 5;
let Y = 0;
let camera = new PerspectiveCamera({
    fov: (2 * Math.PI) / 5,
    aspect: scene.aspect,
    near: 0.01,
    far: 100,
    position: [0, 0, 5],
    lookAt: [0, 0, 0],
    //   update: (scope: any) => {
    //     const now = Date.now() / 1000;
    //     // console.warn(scope.lookAt);
    //     scope.Position = vec3.fromValues(Math.sin(now) * radius,Y, Math.cos(now) * radius);
    //     // console.warn(scope.position);
    //   },
    controlType: "arcball",

});
await scene.add(camera);

let gltf = await createGLTFModel({
    scene: scene,
    url: "/models/gltf/base/morphTarget/MorphTarget.gltf"
}
);
window.gltf = gltf;

// console.warn("accessor 4: samplers input ,time(5个时间点)")
// gltf.printAccessorContent(4)
// console.warn("accessor 5: samplers output ,weight(2个/组*5组)")
// gltf.printAccessorContent(5)
// console.log("========================================position 2,3。只有第三个点有数据，其他点为0（weight*0=0,所以等于没有权重） ========================================");
// console.warn("原始position1： 1,2,3")
// gltf.printAccessorContent(1)
// console.warn("position2： 1,2,3")
// gltf.printAccessorContent(2)
// console.warn("position3： 1,2,3")
// gltf.printAccessorContent(3)
// console.log("========================================indices  ========================================");
// gltf.printAccessorContent(0)

await scene.add(gltf);

// const q = quat.fromEuler(0,0, Math.PI/8,  'xyz'); // 角度（弧度）、旋转顺序
// console.warn(q)
