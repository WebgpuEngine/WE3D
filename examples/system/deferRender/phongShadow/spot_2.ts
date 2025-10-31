
import { PerspectiveCamera } from "../../../../src/we/core/camera/perspectiveCamera";
import { IV_Scene } from "../../../../src/we/core/scene/base";
import { initScene } from "../../../../src/we/core/scene/fn";
import { BoxGeometry } from "../../../../src/we/core/geometry/boxGeometry";
import { ColorMaterial } from "../../../../src/we/core/material/standard/colorMaterial";
import { IV_MeshEntity, Mesh } from "../../../../src/we/core/entity/mesh/mesh";
import { PointLight } from "../../../../src/we/core/light/pointLight";
import { AmbientLight } from "../../../../src/we/core/light/ambientLight";
import { SphereGeometry } from "../../../../src/we/core/geometry/sphereGeometry";
import { PhongMaterial } from "../../../../src/we/core/material/phong/phongMaterial";
import { DirectionalLight } from "../../../../src/we/core/light/DirectionalLight";
import { PlaneGeometry } from "../../../../src/we/core/geometry/planeGeomertry";
import { SpotLight } from "../../../../src/we/core/light/SpotLight";

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
  deferRender: "color",
  
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
  direction: [1, 1,-1],
  intensity: 0.13,
  shadow: true,
  update: (light) => {
    const now = Date.now() / 200; 
    light.Direction=[Math.sin(now), 1,Math.cos(now)];
  }
});
//方向光2
let onelightDirectional_2 = new DirectionalLight({
  color: [1, 1, 1],
  direction: [1, 1,-1],
  intensity: 0.3,
  shadow: true,
  update: (light) => {
    const now = Date.now() / 2000; 
    light.Direction=[Math.sin(now), 1,Math.cos(now)];
  }
});
// let onelight= new PointLight(
//   {
//     position: [0.0, 0.0, 8.0],
//     intensity: 2.0,
//   }
// );
let ballGeometry = new SphereGeometry({
  radius: 0.1,
  widthSegments: 64,
  heightSegments: 64
});
let lightMaterial = new ColorMaterial({ color: [1, 1, 1, 1] });
let lightRadius = 3.5;
let lightZ = 3.;
let light1Entity1 = new Mesh(
  {
    name: "ballLightMesh",
    attributes: {
      geometry: ballGeometry,
    },
    material: lightMaterial,
    position: [3, 3, 3],
    shadow: {
      generate: false,
      accept: false,
    },
    update: (scope: any) => {
      const now = Date.now() / 1000;
      let pos = [Math.sin(now) * lightRadius, lightZ, Math.cos(now) * lightRadius];
      scope.Position = pos;
    }
  });
await scene.add(light1Entity1);

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


// await scene.add(onelight);

let ambientLight = new AmbientLight(
  {
    color: [1, 1, 1],
    intensity: 0.001
  }
)
await light1Entity1.addChild(onelight);
await scene.add(ambientLight);
await scene.add(onelightDirectional_1);
await scene.add(onelightDirectional_2);



///////////////////////////////////////////////////////////////////////
let sphere = new SphereGeometry({
  widthSegments: 128,
  heightSegments: 128,
});


// let colorMaterial = new ColorMaterial({
//   color: [0, 0.5, 0.5, 1]
// });
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
// 6个plane
let planeGeometry = new PlaneGeometry({
  width: 30,
  height: 30
});
let groundMaterial = new PhongMaterial(
  {
    color: [1, 1, 1, 1],
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

// let topPlane = new Mesh({
//   attributes: {
//     geometry: planeGeometry
//   },
//   material: groundMaterial,
//   position: [0, 15, 0],
//   rotate: [1, 0, 0, Math.PI / 2],
// });
// await scene.add(topPlane);

// let backPlane = new Mesh({
//   attributes: {
//     geometry: planeGeometry
//   },
//   material: groundMaterial,
//   position: [0, 0, -15],
// });
// await scene.add(backPlane);

// let frontPlane = new Mesh({
//   attributes: {
//     geometry: planeGeometry
//   },
//   material: groundMaterial,
//   position: [0, 0, 15],

//   rotate: [1, 0, 0, Math.PI],
// });
// await scene.add(frontPlane);

// let leftPlane = new Mesh({
//   attributes: {
//     geometry: planeGeometry
//   },
//   material: groundMaterial,
//   position: [-15, 0, 0],
//   rotate: [0, 1, 0, Math.PI / 2],//正的,normal 相关
// }
// );
// await scene.add(leftPlane);

// let rightPlane = new Mesh({
//   attributes: {
//     geometry: planeGeometry
//   },
//   material: groundMaterial,
//   position: [15, 0, 0],
//   rotate: [0, 1, 0, -Math.PI / 2],//负的,normal 相关
// });
// await scene.add(rightPlane);

// scene.run();