import { vec3 } from "wgpu-matrix";
import { PerspectiveCamera, IV_Scene, initScene, createGLTFModel, SphereGeometry, ColorMaterial, IV_MeshEntity, Mesh, AmbientLight, DirectionalLight } from '@we3d';

declare global {
    interface Window {
        scene: any
        DC: any
    }
}
let input: IV_Scene = {
    canvas: "render",
    backgroudColor: [0, 0, 0, 0.1],
    reversedZ: true,
};
let scene = await initScene({
    initConfig: input,
});
window.scene = scene;

let oneDirlight= new DirectionalLight({
  color: [0, 0, 1],
  direction: [1, 1, 1],
  intensity: 10,
  
});
await scene.add(oneDirlight);

let ambientLight=new AmbientLight(
  {
    color: [1,1,1],
    intensity:0.6
  }
)
await scene.add(ambientLight);

let radius = 5;
let Y = 0;
let camera = new PerspectiveCamera({
  fov: (2 * Math.PI) / 5,
  aspect: scene.aspect,
  near: 0.01,
  far: 100,
  position: [0, 0, 5],
  lookAt: [0, 0, 0],
  // update: (scope: any) => {
  //   const now = Date.now() / 1000;
  //   // console.log(scope.lookAt);
  //   scope.Position = vec3.fromValues(Math.sin(now) * radius,Y, Math.cos(now) * radius);
  //   // console.log(scope.position);
  // },
  controlType: "arcball",
});
await scene.add(camera);

let gltf = await createGLTFModel({
    scene: scene,
    url: "/models/gltf/base/triangle/twoTriangle.gltf"
   
}
);
window.gltf = gltf;
console.log(gltf);
scene.add(gltf);

let geometry = new SphereGeometry(

  {
  // radius:1.1,
  // phiStart:0,
  // phiLength:Math.PI/2 ,
  // // thetaStart:0,
  // // thetaLength:Math.PI,
  // heightSegments:15,
  // widthSegments:1,
}
);

let colorMaterial = new ColorMaterial({
  color: [0, 0.1, 0.2, 1]
});

let inputMesh: IV_MeshEntity = {
  attributes: {
    geometry: geometry,
  },
  scale: [0.15, 0.15, 0.15],
  position: [0, 0, -1],
  material: colorMaterial,
    wireFrame: {
    color: [1, 1, 1, 1],
    enable: true,
    // wireFrameOnly: true,
  }
}
let mesh = new Mesh(inputMesh);
console.log(mesh);
await scene.add(mesh);
