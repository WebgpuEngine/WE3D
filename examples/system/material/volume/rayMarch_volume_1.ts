import { IV_Scene, E_ToneMappingType, initScene, weGetBinaryByUrl, Texture3D, BoxGeometry, IV_MeshEntity, Mesh, ColorMaterial, PerspectiveCamera, VolumeShaderMaterial } from '@we3d';

declare global {
  interface Window {
    scene: any
    DC: any
  }
}
let input: IV_Scene = {
  canvas: "render",
  backgroudColor: [0, 0, 0, 1],
  // backgroudColor: [1, 1, 1, 0.1],
  reversedZ: true,
  // modeNDC: true,
  toneMapping: E_ToneMappingType.linear
};
let scene = await initScene({
  initConfig: input,
  // runImmediately: false,
});
window.scene = scene;

let camera = new PerspectiveCamera({
  fov: (2 * Math.PI) / 5,
  aspect: scene.aspect,
  near: 0.01,
  far: 100,
  position: [0, 0, 5],
  lookAt: [0, 0, 0],
  controlType: "orbit",
});
await scene.add(camera);

//////////////////////////////////////////////////////////////
//volume texture
const width = 256;
const height = 256;
const depth = 109;

// let decompressedArrayBuffer = await weGetBinaryByUrl("/volume/head256x256x109");
// let texture3D = new Texture3D({
//   source: decompressedArrayBuffer,
//   format: "r8unorm",
//   size: { width, height, depth },
// }, scene.device, scene);
// await texture3D.init();

let shaderCode = `//////////////////////////////////////////////////////////
    // 体积渲染
    // 1. 构建相机射线（世界空间）
    let camera_position = u_mvp.cameraPosition;
    let ray_direction = normalize(fsInput.worldPosition - camera_position);
    // 2. 射线转换到立方体本地 [-1,1] 空间
    // let inverse_entity_matrix = u_volume.invert_entity_world_matrix;
    let inverse_entity_matrix = u_volume.invert_entity_world_matrix;
    let ro_local = (inverse_entity_matrix * vec4f(camera_position, 1.0)).xyz;
    let m3=mat3x3f(inverse_entity_matrix[0].xyz, inverse_entity_matrix[1].xyz, inverse_entity_matrix[2].xyz);
    let rd_local = m3 * ray_direction;
    
    materialColor =  trace(ro_local,rd_local);  
    // 体积渲染 end
    //////////////////////////////////////////////////////////`;

let shaderCodeFunction = `/// 射线-AABB求交，本地空间AABB [-1,1]³
/// @param ro 射线原点(camera positon)
/// @param rd 射线方向
/// @return 射线进入AABB的时间范围 [tEnter, tExit]
fn rayAABB(ro: vec3f, rd: vec3f) -> vec2f {
  let aabbMin = vec3f(-1.0);
  let aabbMax = vec3f(1.0);
  var tMin = (aabbMin - ro) / rd;
  var tMax = (aabbMax - ro) / rd;
  let tNear = min(tMin, tMax);
  let tFar = max(tMin, tMax);
  let tEnter = max(max(tNear.x, tNear.y), tNear.z);
  let tExit = min(min(tFar.x, tFar.y), tFar.z);
  return vec2f(tEnter, tExit);
}

// 渲染常量
const dx: f32 = 0.015;
const sigma: f32 = 0.8;    // 介质吸收系数，越大立方体越不透光
const gamma: f32 = 2.2;
const MAX_STEPS: i32 = 64; // 修改：固定64次光线步进

fn dot2(v: vec3f) -> f32 {
    return dot(v, v);
}

fn mat2_rot(angle: f32) -> mat2x2f {
    let c = cos(angle);
    let s = sin(angle);
    return mat2x2f(vec2f(c, -s), vec2f(s, c));
}
// 立方体体积采样，输出RGB介质反照率
fn volume(p: vec3f, rd: vec3f) -> vec3f {
    if (p.x * p.x > 1.0 || p.y * p.y > 1.0 || p.z * p.z > 1.0) {
        return vec3f(0.0);
    }
    var col = smoothstep( vec3f(-1.0), vec3f(1.0),  p);
    col.r = smoothstep(-1.0, 1.0, p.x);
    col.g = smoothstep(-1.0, 1.0, p.y);
    col.b = smoothstep(-1.0, 1.0, p.z);
    return col;
}
// 光线步进：使用比尔朗伯指数吸收模型重写
fn trace(ro: vec3f, rd: vec3f) -> vec4f {
    var transmittance = vec3f(1.0); // 累积透射率，初始完全透光
    var radiance = vec3f(0.0);      // 累积接收光线颜色
    var t_range = rayAABB(ro, rd);
    var t_enter = t_range.x;
    var t_exit = t_range.y;
    var total_t=t_enter;
    var pos_local=ro+rd*t_enter;

    for(var i:i32=0;i<231;i++){ //[-1,1], sqrt(3)*2 /0.015=230.6
        pos_local= ro+rd*total_t;
        let albedo = volume(pos_local, rd);
        let attenuation = exp(-sigma * dx * albedo);        // 比尔朗伯：单步指数衰减
        radiance += transmittance * albedo * dx;        // 当前剩余透射光照射该点，叠加颜色
        transmittance *= attenuation;     // 更新总透射率（穿过当前介质后光线衰减）
        total_t+=dx;
        if(total_t >t_exit) {break;}
    }
    return vec4f(radiance,1);
}
fn rot_x( a:f32)->mat3x3f
{
  let sa = sin(a); 
  let ca = cos(a); 
  return mat3x3f(1., 0.0, 0.0, 0.0, ca, sa, 0.0, -sa, ca);
}
fn rot_y( a:f32)->mat3x3f
{
  let sa = sin(a); 
  let ca = cos(a); 
  return mat3x3f(ca,.0,sa,    .0,1.,.0,   -sa,.0,ca);
}
fn rot_z( a:f32)->mat3x3f
{
  let sa = sin(a); 
  let ca = cos(a); 
  return mat3x3f(ca,sa,.0,    -sa,ca,.0,  .0,.0,1.);
}
`    ;
let volumeMaterial = new VolumeShaderMaterial({
  // channel: "R",
  absorbScale: 1,
  maxSteps: 64,
  shaderCode: shaderCode,
  shaderCodeFunction: shaderCodeFunction,
});

let boxGeometry = new BoxGeometry(
  {
    width: 2,
    height: 2,
    depth: 2,
  }
);

let colorMaterial = new ColorMaterial({
  color: [0, 0.1, 0.2, 1]
});

let inputMesh: IV_MeshEntity = {
  attributes: {
    geometry: boxGeometry,
  },
  material: volumeMaterial,
  // wireFrame: {
  //   color: [1, 1, 1, 1],
  //   enable: true,
  //   // wireFrameOnly: true,
  // }
}
let mesh = new Mesh(inputMesh);

console.log(mesh);
window.mesh = mesh;
window.instanceMash = await scene.add({
  entity: mesh,
  // position: [1.5, 0, 0],
  // scale: [1, 1, 0.7],
  // rotate: [1, 0, 0, Math.PI],
});
volumeMaterial.setEntityWorldMatrix(window.instanceMash.matrixWorld);
