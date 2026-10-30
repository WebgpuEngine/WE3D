import {
    PerspectiveCamera,
    IV_Scene,
    initScene,
    BoxGeometry,
    ColorMaterial,
    IV_MeshEntity,
    Mesh,
} from '@we3d';

declare global {
    interface Window {
        scene: any;
        DC: any;
        mesh: any;
        instanceMash: any;
    }
}
let input: IV_Scene = {
    canvas: 'render',
    backgroudColor: [0, 0, 0, 1],
    // reversedZ:true,
};
let scene = await initScene({
    initConfig: input,
});
window.scene = scene;

let camera = new PerspectiveCamera({
    fov: (2 * Math.PI) / 5,
    aspect: scene.aspect,
    near: 0.1,
    far: 10,
    position: [0, 1, 2],
    lookAt: [0, 0, 0],
    // update: (scope: any) => {
    //   const now = Date.now() / 1000;
    //   scope.Position = vec3.fromValues(Math.sin(now) * radius, Y, Math.cos(now) * radius);
    // },
    // viewport: {
    //   x: 0,
    //   y: 0,
    //   width: 300,
    //   height: 300,
    //   minDepth: 0,
    //   maxDepth: 1
    // },
    // controlType:"arcball",
});
await scene.add(camera);

let boxGeometry = new BoxGeometry();

let colorMaterial = new ColorMaterial({
    color: [0, 0.1, 0.2, 1],
});

let inputMesh: IV_MeshEntity = {
    attributes: {
        geometry: boxGeometry,
    },
    material: colorMaterial,
    wireFrame: {
        color: [1, 1, 1, 1],
        enable: true,
        // wireFrameOnly: true,
    },
};
let mesh = new Mesh(inputMesh);
console.log(mesh);
window.mesh = mesh;
window.instanceMash = await scene.add(mesh);
