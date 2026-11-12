import { PerspectiveCamera, IV_MeshEntity, Mesh, BoxGeometry, SphereGeometry, IBL, AmbientLight, DirectionalLight, IV_PBRMaterial, PBRMaterial, CubeTextureMaterial, IV_Scene, initScene } from '@we3d';

declare global {
  interface Window {
    scene: any
    DC: any
  }
}
let input: IV_Scene = {
  canvas: "render",
  backgroudColor: [0, 0., 0., 0.],
  renderMode: "forwardRender"
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
  far:  100,
  position: [0, 0, 3],
  lookAt: [0, 0, 0],
  controlType: "orbit",
});
await scene.add(camera);

let onelight = new DirectionalLight({
  color: [1, 1, 1],
  direction: [0, 1, 0],
  intensity: 1,

});
await scene.add(onelight);

let ambientLight = new AmbientLight(
  {
    color: [1, 1, 1],
    intensity: 0.0000006
  }
)
await scene.add(ambientLight);

let geometry = new SphereGeometry({
  widthSegments: 128,
  heightSegments: 128,

});

// let colorMaterial = new ColorMaterial({
//   color: [0, 0.5, 0.5, 1]
// });
let PBROption: IV_PBRMaterial = {
  textures: {
    albedo: { value: [0.5, 0.5, 0.5, 1.0] },
    metallic: { value: 0.4 },
    roughness: { value: 0.6 },
  }
}
let pbrMaterial = new PBRMaterial(PBROption);

let inputMesh: IV_MeshEntity = {
  attributes: {
    geometry: geometry,
  },
  material: pbrMaterial,
  // wireFrame: {
  //   color: [1, 1, 1, 1],
  //   enable: true,
  //   // wireFrameOnly: true,
  // }
}
let mesh = new Mesh(inputMesh);
console.log(mesh);
await scene.add(mesh);

let ibl = new IBL(scene, {
  enable: true,
  ibl:
  {
    sh: [
      1.91613, 1.71772, 1.07797,
      -0.0591127, -0.0574315, -0.0346851,
      -3.8612e-05, -2.09015e-05, -1.35017e-05,

      0.439589, -0.431271, -0.0800766,
      -0.0306302, 0.0319348, 0.00328068,
      0.0758103, 0.0710374, 0.0591078,

      0.311676, 0.269456, 0.309399,
      -4.15644e-05, 6.26793e-05, 3.12488e-05,
      -0.541544, -0.468526, -0.536088,
    ],
    prefilteredCubeMap: "/IBL/pine_attic_2k/ktx1/output_ibl.ktx",

  },
  shAlreadyPreMultiplyConst: false
});
await ibl.init();
window.ibl = ibl;
console.log(ibl);

let textureMaterial = new CubeTextureMaterial({
  texture: "/IBL/CornellBox/CornellBox",
  cubeType: "sky",
});

let boxGeometry = new BoxGeometry();
let inputSkyMeshEntity: IV_MeshEntity = {
  attributes: {
    geometry: boxGeometry,
  },
  material: textureMaterial,
  // wireFrame: {
  //   color: [1, 1, 1, 1],
  //   enable: true,
  //   // wireFrameOnly: true,
  // },
  primitive: {
    cullMode: "none"
  },
  // position: [0, 0, 3],
  scale: [100, 100, 100],
}
let skyMesh = new Mesh(inputSkyMeshEntity);
console.log(skyMesh);
await scene.add(skyMesh);
