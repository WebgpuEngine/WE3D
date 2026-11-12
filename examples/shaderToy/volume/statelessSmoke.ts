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

fn rot_x(a: f32) -> mat3x3f {
    let sa = sin(a);
    let ca = cos(a);
    return mat3x3f(
        vec3f(1.0, 0.0, 0.0),
        vec3f(0.0, ca, sa),
        vec3f(0.0, -sa, ca)
    );
}
fn rot_y(a: f32) -> mat3x3f {
    let sa = sin(a);
    let ca = cos(a);
    return mat3x3f(
        vec3f(ca, 0.0, sa),
        vec3f(0.0, 1.0, 0.0),
        vec3f(-sa, 0.0, ca)
    );
}
fn rot_z(a: f32) -> mat3x3f {
    let sa = sin(a);
    let ca = cos(a);
    return mat3x3f(
        vec3f(ca, sa, 0.0),
        vec3f(-sa, ca, 0.0),
        vec3f(0.0, 0.0, 1.0)
    );
}
fn mm2(a: f32) -> mat2x2f {
    let c = cos(a);
    let s = sin(a);
    return mat2x2f(vec2f(c, s), vec2f(-s, c));
}

// 原代码固定混沌4x4矩阵
const M4_BASE: mat4x4f = mat4x4f(
    vec4f(-0.164, -0.223, -0.455, 0.846),
    vec4f(-0.714,  0.576,  0.344, 0.198),
    vec4f(-0.526, -0.782,  0.301, -0.146),
    vec4f(-0.431,  0.084, -0.764, -0.473)
);
const M4: mat4x4f = M4_BASE * 1.93;

// ===================== 核心密度场 map 函数 =====================
fn map(position: vec3f) -> f32 {
   var p = position;
    var d = 0.0;
    let lp = length(p.xz);
    // XZ平面随高度+时间旋转扭曲
    let xz= mm2(p.y * 0.05 - u_toy.u_time * 0.015) * p.xz;
    p.x = xz.x;
    p.z = xz.y;
    p.y *= 0.58;
    // 升维4D向量，第4维绑定时间实现流动
    var q = vec4f(p, u_toy.u_time * 0.4 - p.y * 0.55);
    q.y -= u_toy.u_time * 0.16;
    let cl = dot(p.xz, p.xz);
    var bp = p;
    q *= 0.85;
    var z = 1.15;
    var trk = 1.0;

    // 6层混沌分形迭代
    for (var i = 0; i < 6; i += 1) {
        let cq = cos(q * 0.85);
        let sq = sin(q.yzwx);
        d += 0.75 - abs(dot(cq, sq) - 0.9) * z;

        z *= 0.65;
        q = M4 * q;
        let perturb = sin(q.zxwy * trk) + cos(q * 1.5 - 2.5) * 0.3;
        q += perturb * 0.3;
        trk *= 1.4;
    }
    return d * 1.2 - cl * 0.2;
}

// ===================== 光线步进积分渲染函数 =====================
fn render(ro: vec3f, rd: vec3f) -> vec4f {
    const lpos: vec3f = vec3f(0.5, 1.0, 1.0);
    var rez = vec4f(0.0);
    var t = 6.5+camera_z; // 近裁剪距离（原代码固定值，无AABB修改）
    const MAX_STEPS = 70;
    let  MAX_T = 18.0+camera_z;

    for (var i = 0; i < MAX_STEPS; i += 1) {
        if (rez.a > 0.97 || t > MAX_T) {
            break;
        }
        let pos = ro + t * rd;
        let dn = map(pos);
        let den = clamp(dn, 0.0, 1.0);

        // 无密度区域大步跳过
        if (dn < 0.0) {
            t += 0.2;
            continue;
        }
        // 基础烟雾底色，随Y高度渐变
        let base_col = 1.3 * vec3f(0.105, 0.105, 0.11) * smoothstep(-12.0, 5.0, pos.y);
        var col = vec4f(base_col, 0.08) * den;

        // 差分梯度简易光照（偏移采样模拟法线明暗）
        let dif = clamp((dn - map(pos * vec3f(1.2) + 0.3)) / 8.0, 0.01, 1.0);
        let dif2 = clamp((dn - map(pos * vec3f(1.1) + 0.7)) / 6.0, 0.01, 1.0);
        // col.xyz *= vec3f(0.01, 0.01, 0.01) + vec3f(0.14, 0.12, 0.1) * dif + vec3f(0.15, 0.12, 0.1) * dif2;
        let xyz = vec3f(0.01, 0.01, 0.01) + vec3f(0.14, 0.12, 0.1) * dif + vec3f(0.15, 0.12, 0.1) * dif2;
        col.x *= xyz.x;
        col.y *= xyz.y;
        col.z *= xyz.z;

        // 半透明介质后向混合
        rez += col * (1.0 - rez.a);
        // 自适应步长：密度越高步长越小
        let step_size = clamp(0.12 - den * 0.1, 0.05, 0.15);
        t += step_size;
    }
    return clamp(rez, vec4f(0.0), vec4f(1.0));
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
//////////////////////////////////////////////////////////////

var<private > camera_z = .0;   // 相机Z位置，在采样基础上偏移
var<private > camera_z_base = 12.5;// 采样的基础距离
@fragment
fn fs(fsInput: VertexOutput) -> @location(0) vec4f {

  var p =  fsInput.uv - 0.5;
  p.x*=u_toy.u_resolution.x/u_toy.u_resolution.y;

// 初始相机射线
  var ro = vec3f(0,0,camera_z+camera_z_base);
  var rd = normalize(vec3(p,-1.5));

// 鼠标视角处理，无鼠标时使用默认偏移
  var mo:vec2f = (u_toy.u_mouse_xy / u_toy.u_resolution.xy -0.5);
  if (all(mo <= vec2f(-0.5))) {
        mo = vec2f(0.12, 0.15);
  }
   mo *= 5.0;// 速度增加
  // mo.y = clamp(mo.y * 0.6 - 0.5, -4.0, 0.15);

  if(u_toy.u_mouse_btn == 0)
  {
     mo=vec2f(-u_toy.u_time/3.,-0.6);
     	// mo.x *= u_toy.u_resolution.x/u_toy.u_resolution.y;
      // mo.y = mo.y;//反转y轴
      // mo*=vec2f(-u_toy.u_time/3.,-0.6);

  }
  else{
    	mo.x *= u_toy.u_resolution.x/u_toy.u_resolution.y;
      mo.y = -mo.y;//反转y轴
  }

// 鼠标旋转相机
  var cam:mat3x3f = rot_x(-mo.y)*rot_y(-mo.x);
	rd *= cam;
  ro *= cam;
// 光线步进得到烟雾颜色
    let scn = render(ro, rd);

// 背景渐变天空
    var bg_col = vec3f(0.1, 0.1, 0.11) * smoothstep(-1.0, 1.0, rd.y) * 7.0;
// 烟雾与背景Alpha混合
    var final_col = bg_col * (1.0 - scn.w) + scn.xyz;

// 伽马校正
    final_col = pow(final_col, vec3f(0.45));
// 边缘暗角 Vignette
    let vignette = pow(16.0 *  fsInput.uv.x * fsInput.uv.y * (1.0 - fsInput.uv.x) * (1.0 - fsInput.uv.y), 0.1) * 0.9 + 0.1;
    final_col *= vignette;

    return vec4f(final_col, 1.0);
  // return vec4f(1.0,.0,.0,1.0);
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
