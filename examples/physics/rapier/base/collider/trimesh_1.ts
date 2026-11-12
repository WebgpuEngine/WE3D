import RAPIER from "@dimforge/rapier3d";

import { PerspectiveCamera, eventOfScene, IV_Scene, userDefineEventCall, initScene, IV_MeshEntity, Mesh, BoxGeometry, ColorMaterial, PhongMaterial, DirectionalLight, AmbientLight, PlaneGeometry, Scene } from '@we3d';

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
let scene = await initScene({ initConfig: input, });
window.scene = scene;

let camera = new PerspectiveCamera({
  fov: (2 * Math.PI) / 5,
  aspect: scene.aspect,
  near: 0.01,
  far: 1000,
  position: [0, 6, 16],
  lookAt: [0, 0, 0],
  controlType: "arcball",
});
await scene.add(camera);

let onelight = new DirectionalLight({
  color: [1, 1, 1],
  direction: [0., 1, .0],
  intensity: 1,
  shadow: true,
});
await scene.add(onelight);

let ambientLight = new AmbientLight(
  {
    color: [1, 1, 1],
    intensity: 0.05
  }
)
await scene.add(ambientLight);

///////////////////////////////////////////////////
// box 
// let boxGeometry = new BoxGeometry();

// let colorMaterial = new PhongMaterial({
//   color: [0, 0.1, 0.2, 1]
// });

// let inputMesh: IV_MeshEntity = {
//   attributes: {
//     geometry: boxGeometry,
//   },
//   material: colorMaterial,
//   // wireFrame: {
//   //   color: [1, 1, 1, 1],
//   //   enable: true,
//   // },
// }
// let mesh = new Mesh(inputMesh);
// let instanceBox = await scene.add(
//   {
//     entity: mesh,
//     position: [0, 2, 0],
//   });
// window.instanceBox = instanceBox;
///////////////////////////////////////////////////

import seedrandom from "seedrandom";

function generateTriMesh(nsubdivs: number, wx: number, wy: number, wz: number) {
  let vertices = [];
  let indices = [];

  let elementWidth = 1.0 / nsubdivs;
  let rng = seedrandom("trimesh");

  let i, j;
  for (i = 0; i <= nsubdivs; ++i) {
    for (j = 0; j <= nsubdivs; ++j) {
      let x = (j * elementWidth - 0.5) * wx;
      let y = rng() * wy;
      let z = (i * elementWidth - 0.5) * wz;

      vertices.push(x, y, z);
    }
  }

  for (i = 0; i < nsubdivs; ++i) {
    for (j = 0; j < nsubdivs; ++j) {
      let i1 = (i + 0) * (nsubdivs + 1) + (j + 0);
      let i2 = (i + 0) * (nsubdivs + 1) + (j + 1);
      let i3 = (i + 1) * (nsubdivs + 1) + (j + 0);
      let i4 = (i + 1) * (nsubdivs + 1) + (j + 1);

      indices.push(i1, i3, i2);
      indices.push(i3, i4, i2);
    }
  }

  return {
    vertices: new Float32Array(vertices),
    indices: new Uint32Array(indices),
  };
}
// let trimesh = generateTriMesh(1, 1.0, 1.0, 1.0);
let trimesh = generateTriMesh(20, 40.0, 4.0, 40.0);

// let groundMaterial = new ColorMaterial({
//   color: [0.5, 0.5, 0.5, 1],
// });
let groundMaterial = new PhongMaterial({
  color: [0., 0.5, 0.5, 1],
  roughness: 0.51,
  metalness: 0.29,
  shininess: 32
});

let index = Array.from(trimesh.indices!);
let positions = Array.from(trimesh.vertices!);
// let index=[0,1,2];
// let positions = [
//   0,0,0,
//   1,0,0,
//   0,1,0,
// ]

let groundMesh = new Mesh({
  attributes: {
    data: {
      vertices: { position: positions },
      indices: index,
    },
  },
  material: groundMaterial,
  primitive:{
    topology:"triangle-list",
    cullMode:"none"
  },
  wireFrame: {
    color: [1, 1, 1, 1],
    enable: true,
  },
});
window.groundMesh = groundMesh;
window.instanceGround = await scene.add(groundMesh);
