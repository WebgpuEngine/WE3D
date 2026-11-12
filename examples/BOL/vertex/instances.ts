import { PerspectiveCamera, IV_Scene, initScene, BoxGeometry, ColorMaterial, IV_MeshEntity, Mesh, IV_BOL, E_BOLBufferType, SphereGeometry } from '@we3d';

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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
  position: [0, 0, 25],
  lookAt: [0, 0, 0],
  controlType: "arcball",
});
await scene.add(camera);
window.BPC = scene.BPC;

////////////////////////sphere/////////////////////////////////////////////
let sphereGeometry = new SphereGeometry();
let colorMaterialRed = new ColorMaterial({ color: [1, 0, 0, 1] });
let meshSphere = new Mesh({
  attributes: {
    geometry: sphereGeometry,
  },
  material: colorMaterialRed,
  wireFrame: {
    color: [1, 1, 1, 1],
    enable: true,
  }
});
window.meshSphere = meshSphere;

// await scene.add({
//   entity: meshSphere,
//   position: [0, 3, 0],
// });

////////////////////////box/////////////////////////////////////////////

let boxGeometry = new BoxGeometry();
let colorMaterial = new ColorMaterial({ color: [0, 0.1, 0.2, 1] });
let inputMesh: IV_MeshEntity = {
  attributes: {
    geometry: boxGeometry,
  },
  material: colorMaterial,
  wireFrame: {
    color: [1, 1, 1, 1],
    enable: true,
  }
}
let meshBox = new Mesh(inputMesh);
// window.abc = await scene.add(mesh);
console.log(meshBox);
window.meshBox = meshBox;
window.instanceBox = []
window.instanceSphere = []
// await  scene.add(meshBox);

//add 
for (let i = -6; i < 4; i++) {
  await sleep(100);
  window.instanceBox.push(await scene.add(
    {
      entity: meshBox,
      scale: [0.3, 0.3, 0.3],
      position: [i + 0.3, -1, 0],
    }
  ));
}

// scene.BPC.BOLs.storage.get(3)?.rebuild();
await sleep(1000);
// debugger;
// for (let i = -6; i < 6; i++) {
//   await sleep(500);
//   window.instanceBox.push(await scene.add(
//     {
//       entity: meshBox,
//       scale: [0.3, 0.3, 0.3],
//       position: [i + 0.3, 1, 0],
//     }
//   ));
// }

// await sleep(1000);
// console.warn("remove instances");
// //remove
for (let i of window.instanceBox) {
  await sleep(100);
  scene.BPC.BOLs.storage.get(3)?.rebuild();

  i.destroy();
  for (let [key, value] of scene.BPC.BOLs.storage.get(3)?.pointerOffsetMap!) {
    let pointer =scene.pointers.getPointer(value);
    console.log(`ID: ${value}, offset:${key} ,byteSize:${pointer?.byteLength}`);
  }
}

// // scene.BPC.BOLs.storage.get(3)?.rebuild();

// // debugger;
// // scene.BPC.BOLs.storage.get(3)?.rebuild();
// await sleep(500);
// // debugger;

// // //add again

for (let i = -2; i < 3; i++) {
  // if (i == -9) debugger;
  // if (i == -8) debugger;
  await sleep(500);
  // console.log(i);
  window.instanceBox.push(await scene.add(
    {
      entity: meshBox,
      scale: [0.3, 0.3, 0.3],
      position: [0, i + 0.3, 0],
    }
  ));
}

// debugger;
