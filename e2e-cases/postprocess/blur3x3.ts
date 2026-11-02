import {
    PerspectiveCamera,
    IV_Scene,
    initScene,
    BoxGeometry,
    IV_MeshEntity,
    Mesh,
    TextureMaterial,
    Blur3x3,
} from '@we3d';

declare global {
    interface Window {
        scene: any;
        DC: any;
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
    near: 0.01,
    far: 100,
    position: [0, 0, 3],
    lookAt: [0, 0, 0],
    controlType: 'arcball',
});
await scene.add(camera);

let boxGeometry = new BoxGeometry();

let textureMaterial = new TextureMaterial({
    texture: '/resource/images/img/we3D.png',
});

let inputMesh: IV_MeshEntity = {
    attributes: {
        geometry: boxGeometry,
    },
    material: textureMaterial,
    // wireFrame: {
    //   color: [1, 1, 1, 1],
    //   enable: true,
    //   // wireFrameOnly: true,
    // }
};
let mesh = new Mesh(inputMesh);
console.log(mesh);
await scene.add(mesh);

let blur = new Blur3x3({ scene });
