
import { PerspectiveCamera, IV_Scene, initScene, BoxGeometry, ColorMaterial, IV_MeshEntity, Mesh, PointLight, AmbientLight, SphereGeometry, PhongMaterial, PlaneGeometry } from "@we3d";

declare global {
  interface Window {
    scene: any
    DC: any
  }
}
let input: IV_Scene = {
  canvas: "render",
  backgroudColor: [0, 0, 0, 1],
  // reversedZ:true,
};
let scene = await initScene({
  initConfig: input,
});
window.scene = scene;

let radius = 2;
let Y = 0;
let camera = new PerspectiveCamera({
  fov: Math.PI / 2,
  // fov: (2 * Math.PI) / 5,
  aspect: scene.aspect,
  near: 0.01,
  far: 100,
  position: [-2, 2, 6],
  lookAt: [0, 0, 0],
  controlType: "arcball",
  name: "相机",
});
await scene.add(camera);


//环境光
let ambientLight = new AmbientLight(
  {
    color: [1, 1, 1],
    intensity: 0.0071
  }
)
await scene.add(ambientLight);

let ballGeometry = new SphereGeometry({
  radius: 0.1,
  widthSegments: 64,
  heightSegments: 64
});
let lightMaterial = new ColorMaterial({ color: [1, 1, 1, 1] });

let light1Entity1 = new Mesh(
  {
    attributes: {
      geometry: ballGeometry,
    },
    material: lightMaterial,
    // position: [1, 1, 1],
    shadow: {
      generate: false,
      accept: false,
    },

  });

let lightNode1 = await scene.add({
  name: "light1 Ball instance",

  entity: light1Entity1,
  position: [1, 1, 1],
  // update: (scope: any) => {
  //   const now = Date.now() / 1000;
  //   let pos = [Math.sin(now) * lightRadius, lightZ, Math.cos(now) * lightRadius];
  //   scope.Position = pos;
  // }
});//node

let onelight = new PointLight(
  {
    name:"点光源",
    position: [0, 0, 0],
    // position: [1, 1, 1],
    intensity: .750,
    shadow: true,
    // update(scope) {
    //   const now = Date.now() / 1000;
    //   let pos = [Math.sin(now) * lightRadius, lightZ, Math.cos(now) * lightRadius];
    //   scope.Position = pos;
    //   // console.log("light position", pos,"worldPosition",[scope.worldPosition[0],scope.worldPosition[1],scope.worldPosition[2]]);
    // },
  }
);
await lightNode1.addChild(onelight);
// await scene.add(onelight);

////////////////////////////////////////////////
////6个实体 enities 初始化

//box
let sphereGeometry = new SphereGeometry({
  radius: 1,
  widthSegments: 128,
  heightSegments: 128
});
let boxGeometry = new BoxGeometry({
  width: 2,
  height: 2,
  depth: 2
});
//极简测试材质，red
let redMaterial = new PhongMaterial(
  {
    color: [0, 0.9, 1, 1],
    shininess: 32,
    metalness: 0.1,
    roughness: 1,
  });
//box实体
let sphereEntityNegZ = new Mesh(
  {
    attributes: {
      geometry: sphereGeometry,
    },
    material: redMaterial,
    // wireFrameColor: { red: 1, green: 1, blue: 1, alpha: 1 }
    position: [0, 0, -3],
  }
);
//增加实体到scene
await scene.add(sphereEntityNegZ)

let sphereEntityNegY = new Mesh(
  {
    attributes: {
      geometry: sphereGeometry,
    },
    material: redMaterial,
    position: [0, -3, 0],
  }
);
//增加实体到scene
await scene.add(sphereEntityNegY)

let sphereEntityNegX = new Mesh(
  {
    attributes: {
      geometry: sphereGeometry,
    },
    material: redMaterial,
    position: [-3, 0, 0],
  }
);
//增加实体到scene
await scene.add(sphereEntityNegX)
let sphereEntityPosY = new Mesh(
  {
    attributes: {
      geometry: boxGeometry,
    },
    material: redMaterial,
    position: [0, 3, 0],
    scale: [0.5, 0.5, 0.5],
  }
);
//增加实体到scene
await scene.add(sphereEntityPosY)

let sphereEntityPosX = new Mesh(
  {
    attributes: {
      geometry: boxGeometry,
    },
    material: redMaterial,
    position: [3, 0, 0],
    scale: [0.5, 0.5, 0.5],
  }
);
//增加实体到scene
await scene.add(sphereEntityPosX)

let sphereEntityPosZ = new Mesh(
  {
    attributes: {
      geometry: boxGeometry,
    },
    material: redMaterial,
    position: [0, 0, 3],
    scale: [0.5, 0.5, 0.5],
  }
);
//增加实体到scene
await scene.add(sphereEntityPosZ)

/////////////////////////////////////////////////////////
// 6个plane
let planeGeometry = new PlaneGeometry({
  width: 10,
  height: 10
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
  position: [0, -5, 0],
  rotate: [1, 0, 0, -Math.PI / 2]
});
let bottomPlaneNode = await scene.add(bottomPlane);
bottomPlaneNode.Name = "bottomPlane";

let topPlane = new Mesh({
  attributes: {
    geometry: planeGeometry
  },
  material: groundMaterial,
  position: [0, 5, 0],
  rotate: [1, 0, 0, Math.PI / 2],
});
let topPlaneNode = await scene.add(topPlane);
topPlaneNode.Name = "topPlane";

let backPlane = new Mesh({
  attributes: {
    geometry: planeGeometry
  },
  material: groundMaterial,
  position: [0, 0, -5],
});
let backPlaneNode = await scene.add(backPlane);
backPlaneNode.Name = "backPlane";

let frontPlane = new Mesh({
  attributes: {
    geometry: planeGeometry
  },
  material: groundMaterial,
  position: [0, 0, 5],

  rotate: [1, 0, 0, Math.PI],
});
let frontPlaneNode = await scene.add(frontPlane);
frontPlaneNode.Name = "frontPlane";

let leftPlane = new Mesh({
  attributes: {
    geometry: planeGeometry
  },
  material: groundMaterial,
  position: [-5, 0, 0],
  rotate: [0, 1, 0, Math.PI / 2],//正的,normal 相关
}
);
let leftPlaneNode = await scene.add(leftPlane);
leftPlaneNode.Name = "leftPlane";

let rightPlane = new Mesh({
  attributes: {
    geometry: planeGeometry
  },
  material: groundMaterial,
  position: [5, 0, 0],
  rotate: [0, 1, 0, -Math.PI / 2],//负的,normal 相关
});
let rightPlaneNode = await scene.add(rightPlane);
rightPlaneNode.Name = "rightPlane";
