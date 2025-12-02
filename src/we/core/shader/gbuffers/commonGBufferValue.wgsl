//commonGBufferValue.wgsl start 
//color,无输出需求，定义，方便使用
var color:vec3f = fsInput.color;
//UV,无输出需求，定义，方便使用
var uv:vec2f = fsInput.uv.xy;
var uv1:vec2f = fsInput.uv.zw;
//GBuffer的通用值
var depth:f32 = fsInput.position.z;
var materialColor:vec4f = vec4f(0);
var entityID:u32 = fsInput.entityID;
var normal:vec3f = fsInput.normal;
var RMAO:vec3f = vec3f(0,0,0);
var worldPosition=fsInput.worldPosition;
var albedo:vec3f = vec3f(0);
//自发光
var emissiveRGB:vec3f = vec3f(0);
var emissiveIntensity:f32 = 1;
//AMRO
var roughness:f32 = 0;
var metallic:f32 = 0;
var ao:f32 = 1;
//光影的通用初始化数据
var acceptShadow:u32 = 1;
var shadowKind:u32 = 0;
var acceptlight:u32 = 1;
var materialKind:u32 = 2;
var defer_4xU8InF16:u32 = 0;
//commonGBufferValue.wgsl end
