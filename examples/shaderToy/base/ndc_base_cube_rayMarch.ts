import { mat4 } from "wgpu-matrix";
import { IV_DrawCommandGenerator, DrawCommandGenerator, IV_DC, IV_Scene, userDefineEventCall, eventOfScene, initScene, E_renderPassName, Scene, weGetBinaryResourceFromGzip } from '@we3d';

declare global {
  interface Window {
    scene: any
    DC: any
  }
}
let input: IV_Scene = {
  canvas: "render",
  backgroudColor: [1, 1, 1, 0.5],
  reversedZ: true,
  modeNDC: true,
};
let scene = await initScene({
  initConfig: input,
  runImmediately: false,
});
window.scene = scene;

//////////////////////////////////////////////////////////////
//volume shader
let shader = `   

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

/// 射线-AABB求交，本地空间AABB [-1,1]³
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

// 立方体体积采样，输出RGB介质反照率
fn volume(p: vec3f, rd: vec3f) -> vec3f {
    if (p.x * p.x > 1.0 || p.y * p.y > 1.0 || p.z * p.z > 1.0) {
        return vec3f(0.0);
    }
    var col = vec3f(0.0);
    col.r = smoothstep(-1.0, 1.0, p.x);
    col.g = smoothstep(-1.0, 1.0, p.y);
    col.b = smoothstep(-1.0, 1.0, p.z);
    return col;
}
// 光线步进：使用比尔朗伯指数吸收模型重写
fn trace(ro: vec3f, rd: vec3f) -> vec3f {
    var transmittance = vec3f(1.0); // 累积透射率，初始完全透光
    var radiance = vec3f(0.0);      // 累积接收光线颜色
    var t_range = rayAABB(ro, rd);
    var t_enter = t_range.x;
    var t_exit = t_range.y;
    var total_t=t_enter;
    var pos_local=ro+rd*t_enter;

    for(var i:i32=0;i<142;i++){ //??, sqrt(3)*1 /0.02=86.6 ,but real need 140+
        pos_local= ro+rd*total_t;
        let albedo = volume(pos_local, rd);
        let attenuation = exp(-sigma * dx * albedo);        // 比尔朗伯：单步指数衰减
        radiance += transmittance * albedo * dx;        // 当前剩余透射光照射该点，叠加颜色
        transmittance *= attenuation;     // 更新总透射率（穿过当前介质后光线衰减）
        total_t+=dx;
        if(total_t >t_exit) {break;}
    }
    return radiance;
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

//////////////////////////////////////////////////////////////
struct st_uniform_toy {
    u_resolution: vec2f,
    u_mouse_xy: vec2f,
    u_mouse_btn: i32,
    u_time: f32,
};
@group(0) @binding(0) var<uniform> u_toy: st_uniform_toy;
struct VertexOutput {
  @builtin(position) Position : vec4f,
  @location(0) uv: vec2f,
}

@vertex fn vs(
  @builtin(vertex_index) VertexIndex : u32
) -> VertexOutput {
  var pos = array<vec2f, 3>(
    vec2(-1.0, 3.0),
    vec2(-1.0, -1.0),
    vec2(3.0, -1.0)
  );
  var xy = pos[VertexIndex];
  return VertexOutput(
    vec4f(xy, 0.0, 1.0),
    vec2(xy)*0.5+0.5,
  );
}

@fragment
fn fs(fsInput: VertexOutput) -> @location(0) vec4f {

  var p =  fsInput.uv - 0.5;
  p.x*=u_toy.u_resolution.x/u_toy.u_resolution.y;

  var ro = vec3f(0,0,3.);
  var rd = normalize(vec3(p,-.5));

  var mo:vec2f = (u_toy.u_mouse_xy / u_toy.u_resolution.xy -0.5)*2.0;// 速度增加2倍

  if(u_toy.u_mouse_btn == 0)
  {
     mo=vec2f(-u_toy.u_time/3.,-0.6);
  }
  else{
    	mo.x *= u_toy.u_resolution.x/u_toy.u_resolution.y;
      mo.y = -mo.y;//反转y轴
  }

  // var m = -(u_toy.u_mouse_xy * 2.0 - u_toy.u_resolution.xy) / u_toy.u_resolution.xy;
  // if (u_toy.u_mouse_btn == 0) {
  //       m = vec2f(-u_toy.u_time / 3.0, 0.4);
  //   }

  var cam:mat3x3f = rot_x(-mo.y)*rot_y(-mo.x);
	rd *= cam;
  ro *= cam;
  let color =trace(ro,rd);  

  return vec4f(color,1.0);
}
`;
//////////////////////////////////////////////////////////////
//uniform buffer
const uniformBufferSize = 4 * 8; // 4x4 matrix
const uniformBuffer = scene.device.createBuffer({
  size: uniformBufferSize,
  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
});
const st_uniform_toyValues = new ArrayBuffer(uniformBufferSize);
const st_uniform_toyViews = {
  u_resolution: new Float32Array(st_uniform_toyValues, 0, 2),
  u_mouse_xy: new Float32Array(st_uniform_toyValues, 8, 2),
  u_mouse_btn: new Uint32Array(st_uniform_toyValues, 16, 1),
  u_time: new Float32Array(st_uniform_toyValues, 20, 1),
};

//////////////////////////////////////////////////////////////
//bindgroup  and layout 

let layout: GPUBindGroupLayout = scene.device.createBindGroupLayout({
  label: "volumeLayout",
  entries: [
    {
      binding: 0,
      visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.VERTEX,
      buffer: {
        type: "uniform",
      },
    },
  ],
});

const bindGroupDescriptor: GPUBindGroupDescriptor = {
  layout: layout,
  entries: [
    {
      binding: 0,
      resource: uniformBuffer,
    },
  ],
};
const bindGroup = scene.device.createBindGroup(bindGroupDescriptor);
///////////////////////////////////////////////////////////////////////////////
//DC

let inputDC: IV_DrawCommandGenerator = {
  scene: scene,
  parent: scene,
}
let DCManager = new DrawCommandGenerator(inputDC);

let valueDC: IV_DC = {
  label: "dc1",
  data: {
    uniforms: [bindGroup],
    unifromLayout: [layout],
  },
  render: {
    vertex: {
      code: shader,
      entryPoint: "vs",
    },
    fragment: {
      entryPoint: "fs",
      targets: [{ format: scene.colorFormatOfLinearSpace }],
      aliasName: "test NDC",
    },
    drawMode: {
      vertexCount: 3
    },
  },
}

let dc = DCManager.generateDrawCommand(valueDC);
scene.BPC.update(scene.clock);
scene.memoryBlockManager.update(scene.clock);
dc.submit();
// // scene.renderToSurface();

// // let renderManager = scene.renderManager;
// // scene.renderManager.push({
// //   command: dc,
// //   kind: E_renderPassName.ndc,
// // })

// // // dc.submit()

/**
0：没有按键或者是没有初始化
1：第一按键（通常是鼠标左键）
2：第二按键（通常是鼠标右键）
4：辅助按键（通常是鼠标滚轮键或鼠标中键）
8：第四按键（通常是“浏览器后退”按键）
16：第五按键（通常是“浏览器前进”按键）
 */
let isMouseDown = false;
scene.canvas.addEventListener('pointerdown', (event) => {
  isMouseDown = true;
  // st_uniform_toyViews.u_mouse_btn[0] = (event as PointerEvent).buttons;
  st_uniform_toyViews.u_mouse_xy[0] = (event as PointerEvent).clientX;
  st_uniform_toyViews.u_mouse_xy[1] = (event as PointerEvent).clientY;
  // console.log(event.buttons, event.clientX, event.clientY, st_uniform_toyViews.u_mouse_btn[0],st_uniform_toyViews.u_mouse_xy[0],st_uniform_toyViews.u_mouse_xy[1]);
});
scene.canvas.addEventListener('pointerup', (event) => {
  isMouseDown = false;
  st_uniform_toyViews.u_mouse_btn[0] = 0;
  st_uniform_toyViews.u_mouse_xy[0] = event.clientX;
  st_uniform_toyViews.u_mouse_xy[1] = event.clientY;
  // console.log(event.buttons, event.clientX, event.clientY, st_uniform_toyViews.u_mouse_btn[0],st_uniform_toyViews.u_mouse_xy[0],st_uniform_toyViews.u_mouse_xy[1]);

});
scene.canvas.addEventListener("pointermove", (event) => {
  if (!isMouseDown) {
    return;
  }
  st_uniform_toyViews.u_mouse_xy[0] = event.clientX;
  st_uniform_toyViews.u_mouse_xy[1] = event.clientY;
  // console.log(st_uniform_toyViews.u_mouse_btn[0],st_uniform_toyViews.u_mouse_xy[0],st_uniform_toyViews.u_mouse_xy[1]);
});

let timer = 0;
let oneCall: userDefineEventCall = {
  call: (scope: Scene) => {
    timer += 0.016667;
    st_uniform_toyViews.u_time[0] = timer;
    st_uniform_toyViews.u_mouse_btn[0] = isMouseDown ? 1 : 0;
    st_uniform_toyViews.u_resolution[0] = scene.surface.size.width
    st_uniform_toyViews.u_resolution[1] = scene.surface.size.height;
    scene.device.queue.writeBuffer(uniformBuffer, 0, st_uniform_toyValues);

    scope.renderManager.push({
      command: dc,
      kind: E_renderPassName.ndc,
    })
  },
  name: "",
  state: true,
  event: eventOfScene.onUpdate
}
scene.addUserDefineEvent(oneCall);

scene.run();
