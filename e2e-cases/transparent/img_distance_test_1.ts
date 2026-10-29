
import { PerspectiveCamera, IV_Scene, initScene, ColorMaterial, IV_MeshEntity, Mesh, SphereGeometry, PlaneGeometry, TextureMaterial } from "@we3d";

declare global {
  interface Window {
    scene: any
    DC: any
  }
}
let input: IV_Scene = {
  canvas: "render",
  backgroudColor: [0, 0., 0., 0.],
  reversedZ: true,
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
  position: [-16, 6, 16],
  // position: [0, 0.1, 5],

  lookAt: [0, 0, 0],
  controlType: "arcball",
});
await scene.add(camera);


////////////////////////////////////
//plane
let planeGeometry = new PlaneGeometry({
  width: 10,
  height: 10
});

let geometry = new SphereGeometry();

let colorMaterialRed = new ColorMaterial({ color: [1, 0.5, 0.5, 0.51], });
let colorMaterialGreen = new ColorMaterial({ color: [0, 1, 0, 0.51] });
let colorMaterialBlue = new ColorMaterial({ color: [0, 0, 1, 0.51] });
let textureMaterialAlpha = new TextureMaterial({
  texture: "/resource/images/img/we3D_alpha.png",
  transparentMode: "alphaTest",
  alphaTransparent: {
    alphaCutOff: 0.50,
  }
});
let textureMaterial = new TextureMaterial({
  texture: "/resource/images/img/we3D.png",
  // transparent: {
  //   type: E_TransparentType.alpha,
  //   // opacity: 0.5,
  //   alphaTest: 0.50,
  // }
});


let inputMeshWE3DAlpha: IV_MeshEntity = {
  name: "WE3DAlpha",
  attributes: {
    geometry: planeGeometry,
  },
  material: textureMaterialAlpha,
  // material: colorMaterial2,
  // position: [0, 0, -2],

  primitive: {
    cullMode: "none",
  }
}
let inputMeshWE3D: IV_MeshEntity = {
  name: "WE3D",
  attributes: {
    geometry: planeGeometry,
  },
  material: textureMaterial,
  // material: colorMaterial2,
  // position: [0, 0, -8],

  primitive: {
    cullMode: "none",
  }
}

let inputMeshRed: IV_MeshEntity = {
  name: "red",
  attributes: {
    geometry: planeGeometry,
  },
  material: colorMaterialRed,
  // position: [0, 0, 0],

  // rotate: [1, 0, 0, Math.PI / 2],
  primitive: {
    cullMode: "none",
  }
}
let inputMeshGreen: IV_MeshEntity = {
  name: "green",
  attributes: {
    geometry: planeGeometry,
  },
  material: colorMaterialGreen,
  // position: [0, 0, -4],

  // rotate: [1, 0, 0, Math.PI / 2],
  primitive: {
    cullMode: "none",
  }
}
let inputMeshBlue: IV_MeshEntity = {
  name: "blue",
  attributes: {
    geometry: planeGeometry,
  },
  material: colorMaterialBlue,
  // position: [0, 0, -6],

  // rotate: [1, 0, 0, Math.PI / 2],
  primitive: {
    cullMode: "none",
  }
}

let meshRed = new Mesh(inputMeshRed);
let meshGreen = new Mesh(inputMeshGreen);
let meshBlue = new Mesh(inputMeshBlue);
let meshWE3D = new Mesh(inputMeshWE3D);
let meshWE3DAlpha = new Mesh(inputMeshWE3DAlpha);
window.meshOfWE3D = meshWE3D;

await scene.add({ entity: meshRed, position: [0, 0, 0] });
await scene.add({ entity: meshGreen, position: [0, 0, -4] });
await scene.add({ entity: meshBlue, position: [0, 0, -6] });
await scene.add({ entity: meshWE3D, position: [0, 0, -8] });
await scene.add({ entity: meshWE3DAlpha, position: [0, 0, -2] });

