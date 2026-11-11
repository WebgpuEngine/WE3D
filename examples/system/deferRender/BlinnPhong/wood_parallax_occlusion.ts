import { PerspectiveCamera, IV_Scene, initScene, BoxGeometry, ColorMaterial, IV_MeshEntity, Mesh, SphereGeometry, PhongMaterial, DirectionalLight, AmbientLight, PointLight } from '@we3d';

import { vec3 } from "wgpu-matrix";

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
  // AA: {
  //   MSAA: {
  //     enable: true
  //   }
  // },   
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
  position: [0, 0, 3],
  lookAt: [0, 0, 0],
  controlType: "arcball",
});
await scene.add(camera);

let ambientLight = new AmbientLight(
  {
    color: [1, 1, 1],
    intensity: 0.13
  }
)
await scene.add(ambientLight);

////////////////////////////////////////////////////////   mesh part 
let ballGeometry = new SphereGeometry({
  radius: 0.01,
  widthSegments: 8,
  heightSegments: 8
});
let lightMaterial = new ColorMaterial(
  {
    color: [1, 1, 1, 1]
  });

let lightBall = new Mesh(
  {
    attributes: {
      geometry: ballGeometry,
    },
    material: lightMaterial,
    // position: [1, 1, 1],//instance 改造后，这个是local position
  });

/////////////////////////// nodeInstance  light ball 
let lightRadius = 0.65;
let lightZ = 1.

let nodeLight1 = await scene.add(
  {
    entity: lightBall,
    update: (scope: any) => {
      const now = Date.now() / 2000;
      let pos = [Math.sin(now) * lightRadius, Math.cos(now) * lightRadius, lightZ];
      scope.Position = pos;
    }
  }
);
//////////////////////////////////  light  add to nodeLight1
let onelight = new PointLight(
  {
    position: [0, 0, 0],
    // position: [1, 1, 1],
    intensity: 1.0,
  }
);
await nodeLight1.addChild(onelight);

let geometry = new BoxGeometry();
let phongMaterial = new PhongMaterial({
  // color: [0, 0.9, 1, 1],
  // roughness:0.5,
  // metalness:1.5,
  // shininess:32,
  textures: {
    color: {
      source: "/resource/images/parallax/wood.png",
    },
    normal: {
      source: "/resource/images/parallax/toy_box_normal.png",
    },
    parallax: {
      source: "/resource/images/parallax/toy_box_disp.png",
    }
  },
  parallax: {
    scale: 0.21,//0.01
    layer: 10
  }
});

let inputMesh: IV_MeshEntity = {
  attributes: {
    geometry: geometry,
  },
  material: phongMaterial,
}
let mesh = new Mesh(inputMesh);
console.log(mesh);
await scene.add(mesh);
