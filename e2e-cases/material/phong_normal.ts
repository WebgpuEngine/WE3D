import {
    PerspectiveCamera,
    IV_Scene,
    initScene,
    BoxGeometry,
    ColorMaterial,
    IV_MeshEntity,
    Mesh,
    SphereGeometry,
    PhongMaterial,
    AmbientLight,
    PointLight,
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

let radius = 2;
let Y = 0;
let camera = new PerspectiveCamera({
    fov: (2 * Math.PI) / 5,
    aspect: scene.aspect,
    near: 0.01,
    far: 100,
    position: [0, 1, 3],
    lookAt: [0, 0, 0],
    controlType: 'arcball',
});
await scene.add(camera);

let onelight = new PointLight({
    position: [1, 1, 1],
    intensity: 2.0,
});
await scene.add(onelight);

let ambientLight = new AmbientLight({
    color: [1, 1, 1],
    intensity: 0.3,
});
await scene.add(ambientLight);

let ballGeometry = new SphereGeometry({
    radius: 0.01,
    widthSegments: 8,
    heightSegments: 8,
});
let lightMaterial = new ColorMaterial({
    color: [1, 1, 1, 1],
});

let light1Entity1 = new Mesh({
    attributes: {
        geometry: ballGeometry,
    },
    material: lightMaterial,
    position: [1, 1, 1],
    // scale: [0.1, 0.1, 0.1],
});
await scene.add(light1Entity1);

let geometry = new BoxGeometry();
let phongMaterial = new PhongMaterial({
    // color: [0, 0.9, 1, 1],
    // roughness:0.5,
    // metalness:1.5,
    // shininess:32,
    textures: {
        color: {
            source: '/resource/images/wall/brickwall.jpg',
        },
        normal: {
            source: '/resource/images/wall/brickwall_normal.jpg',
        },
    },
});

let inputMesh: IV_MeshEntity = {
    attributes: {
        geometry: geometry,
    },
    material: phongMaterial,
    // wireFrame: {
    //   color: [1, 1, 1, 1],
    //   enable: true,
    //   // wireFrameOnly: true,
    // }
};
let mesh = new Mesh(inputMesh);
console.log(mesh);
await scene.add(mesh);
