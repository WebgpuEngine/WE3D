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
  // runImmediately:false,
});
window.scene = scene;

let radius = 2;
let Y = 0;
let camera = new PerspectiveCamera({
  fov: (2 * Math.PI) / 5,
  aspect: scene.aspect,
  near: 0.01,
  far: 100,
  position: [6, 9, -5],
  lookAt: [0, 0, 0],
  controlType: "arcball",
});
await scene.add(camera);

/////////////////////////////////////////////////////////////
//方向光1
let onelightDirectional_1 = new DirectionalLight({
  color: [1, 1, 1],
  direction: [1, 1, -1],
  intensity: 0.13,
  shadow: true,
  update: (light) => {
    const now = Date.now() / 200;
    light.Direction = [Math.sin(now), 1, Math.cos(now)];
  }
});
//方向光2
let onelightDirectional_2 = new DirectionalLight({
  color: [1, 1, 1],
  direction: [1, 1, -1],
  intensity: 0.3,
  shadow: true,
  update: (light) => {
    const now = Date.now() / 1000;
    light.Direction = [Math.sin(now), 1, Math.cos(now)];
  }
});

//////////////////////
//spot light
let ballGeometry = new SphereGeometry({
  radius: 0.1,
  widthSegments: 64,
  heightSegments: 64
});
let lightMaterial = new ColorMaterial({ color: [1, 1, 1, 1] });

//mesh of  light 
let light1Entity1 = new Mesh(
  {
    name: "ballLightMesh",
    attributes: {
      geometry: ballGeometry,
    },
    material: lightMaterial,
    // position: [3, 3, 3],
    shadow: {
      generate: false,
      accept: false,
    },
  });

//node object  of point light
let lightRadius = 3.5;
let lightZ = 3.;
let lightNode1 = await scene.add({
  entity: light1Entity1,
  position: [3, 3, 3],
  update: (scope: any) => {
    const now = Date.now() / 1000;
    let pos = [Math.sin(now) * lightRadius, lightZ, Math.cos(now) * lightRadius];
    scope.Position = pos;
  }
});

// add spot to node child
let onelight = new SpotLight({
  // direction: [-1, -1, -1],
  // direction: [-1.0, 1.0, -1.0],
  direction: [0, 0, 0],
  isLookAt: true,
  position: [0, 0, 0],
  // position: [3, 3, 3],
  intensity: 1.0,
  // angle: 25 / 180 * Math.PI,
  // angleOut: 30 / 180 * Math.PI,
  angle: 20 * (Math.PI) / 180,
  angleOut: 20 * (Math.PI) / 180,
  shadow: true,
});

// ambient light
let ambientLight = new AmbientLight(
  {
    color: [1, 1, 1],
    intensity: 0.01
  }
)
/////////////////////////////////////////////
//add all light
await scene.add(ambientLight);
await scene.add(onelightDirectional_1);
await scene.add(onelightDirectional_2);
await lightNode1.addChild(onelight);

///////////////////////////////////////////////////////////////////////
//sphere
let sphere = new SphereGeometry({
  widthSegments: 128,
  heightSegments: 128,
});

let phongMaterial = new PhongMaterial({
  color: [0, 0.9, 1, 1],
  roughness: 1,
  metalness: 0.1,
  shininess: 32
});

let inputMeshsphere: IV_MeshEntity = {
  attributes: {
    geometry: sphere,
  },
  material: phongMaterial,
}
let meshSphere = new Mesh(inputMeshsphere);
await scene.add(meshSphere);

//box
let box = new BoxGeometry();
let inputMeshbox: IV_MeshEntity = {
  attributes: {
    geometry: box,
  },
  material: phongMaterial,
  position: [0, 1, -2],
};
let meshBox = new Mesh(inputMeshbox);
await scene.add(meshBox);

/////////////////////////////////////////////////////////
// plane
let planeGeometry = new PlaneGeometry({
  width: 30,
  height: 30
});
let groundMaterial = new PhongMaterial(
  {
    color: [0.5, 0.5, 0.1, 1],
    shininess: 1,
    metalness: 0.0,
    roughness: 1,
  });

let bottomPlane = new Mesh({
  attributes: {
    geometry: planeGeometry
  },
  material: groundMaterial,
  position: [0, -1, 0],
  rotate: [1, 0, 0, -Math.PI / 2]
});
await scene.add(bottomPlane);
