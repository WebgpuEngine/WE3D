
import { PerspectiveCamera } from "../../../../src/we/core/camera/perspectiveCamera";
import { IV_Scene } from "../../../../src/we/core/scene/base";
import { initScene } from "../../../../src/we/core/scene/fn";
import { BoxGeometry } from "../../../../src/we/core/geometry/boxGeometry";
import { ColorMaterial } from "../../../../src/we/core/material/standard/colorMaterial";
import { IV_MeshEntity, Mesh } from "../../../../src/we/core/entity/mesh/mesh";
import { SphereGeometry } from "../../../../src/we/core/geometry/sphereGeometry";
import { PhongMaterial } from "../../../../src/we/core/material/phong/phongMaterial";
import { DirectionalLight } from "../../../../src/we/core/light/DirectionalLight";
import { AmbientLight } from "../../../../src/we/core/light/ambientLight";
import { PointLight } from "../../../../src/we/core/light/pointLight";
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
  deferRender: "color",

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


let ballGeometry = new SphereGeometry({
  radius: 0.01,
  widthSegments: 8,
  heightSegments: 8
});
let lightMaterial = new ColorMaterial(
  {
    color: [1, 1, 1, 1]
  });

let lightRadius = 0.65;
let lightRadiusFlag = true;
let lightZ = 1.
let light1Entity1 = new Mesh(
  {
    attributes: {
      geometry: ballGeometry,
    },
    material: lightMaterial,
    position: [1, 1, 1],
    update: (scope: any) => {
      const now = Date.now() / 2000;
      let pos = [Math.sin(now) * lightRadius, Math.cos(now) * lightRadius, lightZ];
      // console.log("pos set :", pos)
      scope.Position = pos;
      // console.log("Position = ",scope.Position[0],scope.Position[1],scope.Position[2])
      // console.log("worldPosition = ",scope.worldPosition[0],scope.worldPosition[1],scope.worldPosition[2])
    }
  });
await scene.add(light1Entity1);





let onelight = new PointLight(
  {
    position: [0,0,0],
    // position: [1, 1, 1],
    intensity: 1.0,
  }
);
await light1Entity1.addChild(onelight);



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
    scale: 0.01,
    layer: 10
  }
});

let inputMesh: IV_MeshEntity = {
  attributes: {
    geometry: geometry,
  },
  material: phongMaterial,
  // wireFrame: {
  //   color: [1, 1, 1, 1],
  //   enable: true,
  //   // wireFrameOnly: true,
  // }
}
let mesh = new Mesh(inputMesh);
console.log(mesh);
await scene.add(mesh);