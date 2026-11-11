import { PerspectiveCamera, IV_Scene, initScene, BoxGeometry, ColorMaterial, IV_MeshEntity, Mesh, IV_BOL, E_BOLBufferType } from '@we3d';

declare global {
  interface Window {
    scene: any
    DC: any
  }
}
let input: IV_Scene = {
  canvas: "render",
  backgroudColor: [0, 0., 0., 0.],
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
  position: [0, 0, 15],
  lookAt: [0, 0, 0],
  controlType: "arcball",
});
await scene.add(camera);

let boxGeometry = new BoxGeometry();

let colorMaterial = new ColorMaterial({
  color: [0, 0.1, 0.2, 1]
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
  }
}
let mesh = new Mesh(inputMesh);
window.abc = await scene.add(mesh);
console.log(mesh);
window.mesh = mesh;
window.instanceMash = []

for (let i = 0; i < 3; i++) {
  window.instanceMash.push(await scene.add(
    {
      entity: mesh,
      scale: [0.3, 0.3, 0.3],
      position: [i, -1, 0],
    }
  ));
}

window.BPC = scene.BPC;

// function myTest() {
//   debugger
// }
// myTest()

// let j=1;
for (let i of window.instanceMash) {
  i.destroy();

  // setTimeout(() => {
  //   console.log(i);
  //    i.destroy();
  // }, 1000*j++);
}

// for (let i = -6; i < 0; i++) {
//   window.instanceMash.push(await scene.add(
//     {
//       entity: mesh,
//       scale: [0.3, 0.3, 0.3],
//       position: [i , 0, 0],
//     }
//   ));
// }
