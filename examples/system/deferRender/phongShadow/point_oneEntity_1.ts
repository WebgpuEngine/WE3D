import { PerspectiveCamera, IV_Scene, initScene, BoxGeometry, ColorMaterial, IV_MeshEntity, Mesh, PointLight, AmbientLight, SphereGeometry, PhongMaterial, DirectionalLight, PlaneGeometry, SpotLight } from '@we3d';

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
   renderMode:"deferRender",

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
  position: [0, 0, 5],
  // position: [5, 5, 0],
  lookAt: [0, 0, 0],
  controlType: "arcball",
});
await scene.add(camera);

/////////////////////////////////////////////////////////////
let ballGeometry = new SphereGeometry({
  radius: 0.1,
  widthSegments: 64,
  heightSegments: 64
});
let lightMaterial = new ColorMaterial({ color: [1, 1, 1, 1] });

//light mesh
let light1Entity1 = new Mesh(
  {
    attributes: {
      geometry: ballGeometry,
    },
    material: lightMaterial,
    shadow: {
      generate: false,
      accept: false,
    },
  });

let lightRadius = 3.5;
let lightZ = 2.;
let lightNode1 = await scene.add({
  entity: light1Entity1,
  position: [1, 1, -1],
});//node

let onelight = new PointLight(
  {
    position: [0, 0, 0],
    // position: [1, 1, 1],
    intensity: .5,
    shadow: true,
  }
);
await lightNode1.addChild(onelight);

let ambientLight = new AmbientLight(
  {
    color: [1, 1, 1],
    intensity: 0.01
  }
)
await scene.add(ambientLight);

///////////////////////////////////////////////////////////////////////
//geometry
let sphere = new SphereGeometry({
  widthSegments: 128,
  heightSegments: 128,
});

let box = new BoxGeometry();

let planeGeometry = new PlaneGeometry({
  width: 20,
  height: 20
});
///////////////////////////////////////////////////////////////////////////////////
//material
let phongMaterial = new PhongMaterial({
  color: [0, 0.9, 1, 1],
  roughness: 1,
  metalness: 0.1,
  shininess: 32
});
let groundMaterial = new PhongMaterial({
  color: [1, 1, 1, 1],
  roughness: 1,
  metalness: 0.1,
  shininess: 32
});
///////////////////////////////////////////////////////////////////////////////////
//entity

//sphere
let inputMeshsphere: IV_MeshEntity = {
  attributes: {
    geometry: sphere,
  },
  material: phongMaterial,
}

let meshSphere = new Mesh(inputMeshsphere);
await scene.add(meshSphere);

//box
let inputMeshbox: IV_MeshEntity = {
  attributes: {
    geometry: box,
  },
  material: phongMaterial,
  position: [0, 1, -2],
};
let meshBox = new Mesh(inputMeshbox);
await scene.add(meshBox);

//ground
let groundMesh = new Mesh({
  attributes: {
    geometry: planeGeometry,
  },
  material: groundMaterial,
  position: [0, -1, 0],
  rotate: [1, 0, 0, -Math.PI / 2]
});
await scene.add(groundMesh);
