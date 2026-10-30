import { I_Update, weVec2, weVec3 } from '../../base/coreDefine';

/** Hillaire大气参数
 * 1、大气参数结构部分对应shader中的Atmosphere
 * 2、剩余部分对应override constant
 */
export interface I_HillaireAtmosphereParams extends I_Update {
    //大气参数结构
    rayleigh_scattering?: weVec3; // Rayleigh散射系数
    rayleigh_density_exp_scale?: number; // Rayleigh密度指数分布缩放因子
    mie_scattering?: weVec3; // Mie散射系数
    mie_density_exp_scale?: number; // Mie密度指数分布缩放因子
    mie_extinction?: weVec3; // Mie消光系数
    mie_phase_param?: number; // Mie相位参数（Cornette-Shanks偏心率或HG-Draine水滴直径）
    mie_absorption?: weVec3; // Mie吸收系数
    absorption_density_0_layer_height?: number; // 吸收层0的高度
    absorption_density_0_constant_term?: number; // 吸收层0的常数项
    absorption_density_0_linear_term?: number; // 吸收层0的线性项
    absorption_density_1_constant_term?: number; // 吸收层1的常数项
    absorption_density_1_linear_term?: number; // 吸收层1的线性项
    absorption_extinction?: weVec3; // 吸收消光系数（如臭氧）
    bottom_radius?: number; // 行星半径（球心到地面）
    ground_albedo?: weVec3; // 地面反照率
    top_radius?: number; // 大气顶部半径（球心到大气顶）
    planet_center?: weVec3; // 行星球心在世界空间中的位置（Z轴向上）
    multi_scattering_factor?: number; // 多重散射因子
    ////////////override params //////////////
    /** 单位转换因子，将距离从米(或其他单位)转换为千米 ，默认为：m->km,1/1000*/
    FROM_KM_SCALE?: number;
    /** 是否使用月亮， 默认为false ;todo,wgsl中未实现(暂时注解掉了)*/
    USE_MOON?: boolean;
    // /** 是否使用太阳阴影地图， 默认为true;todo,wgsl中未实现(暂时注解掉了) */
    // sunShadowMap?: boolean;
    // /** 是否使用月亮阴影地图， 默认为true;todo,wgsl中未实现(暂时注解掉了) */
    // moonShadowMap?: boolean;
    mode?: 'lut' | 'rayMarch';
    ray_march_min_spp?: number; // 光线步进最小采样数
    ray_march_max_spp?: number; // 光线步进最大采样数
}
export interface IV_HillaireAtmosphereLightParams {
    directionalLight: DirectionalLight;
    // illuminance: weVec3,         // 光源照度（W/m²）；这个使用DirectionalLight的intensity*color计算
    disk_diameter?: number; // 光源视直径（弧度）
    disk_luminance_scale?: number; // 光源盘面亮度缩放因子
}
/** Hillaire大气光源参数,对应shader中的Light结构 */
export interface I_HillaireAtmosphereLight {
    illuminance: weVec3; // 光源照度（W/m²）
    disk_diameter: number; // 光源视直径（弧度）
    direction: weVec3; // 光源方向（指向光源）
    disk_luminance_scale: number; // 光源盘面亮度缩放因子
}

/**
 * Hillaire统一参数,对应shader中的Uniforms结构
 */
export interface I_HillaireUniforms {
    inverse_projection: ArrayBuffer; // 逆投影矩阵
    inverse_view: ArrayBuffer; // 逆视图矩阵
    camera_world_position: weVec3; // 相机世界坐标
    frame_id: number; // 当前帧ID
    screen_resolution: weVec2; // 屏幕分辨率
    ray_march_min_spp: number; // 光线步进最小采样数
    ray_march_max_spp: number; // 光线步进最大采样数
    sun: I_HillaireAtmosphereLight; // 太阳参数
    moon: I_HillaireAtmosphereLight; // 月亮参数
}

import shader_aerial_perspective from '../../shaders/atmosphere/hillaire/common/aerial_perspective.wgsl?raw';
import shader_const from '../../shaders/atmosphere/hillaire/common/const.wgsl?raw';
import shader_coordinate_system from '../../shaders/atmosphere/hillaire/common/coordinate_system.wgsl?raw';
import shader_intersection from '../../shaders/atmosphere/hillaire/common/intersection.wgsl?raw';
import shader_medium from '../../shaders/atmosphere/hillaire/common/medium.wgsl?raw';
import shader_multi_scattering from '../../shaders/atmosphere/hillaire/common/multi_scattering.wgsl?raw';
import shader_phase from '../../shaders/atmosphere/hillaire/common/phase.wgsl?raw';
import shader_sample_segment_t from '../../shaders/atmosphere/hillaire/common/sample_segment_t.wgsl?raw';
import shader_struct from '../../shaders/atmosphere/hillaire/common/struct.wgsl?raw';
import shader_sun_disk from '../../shaders/atmosphere/hillaire/common/sun_disk.wgsl?raw';
import shader_uv from '../../shaders/atmosphere/hillaire/common/uv.wgsl?raw';
import shader_override from '../../shaders/atmosphere/hillaire/common/override.wgsl?raw';

import shader_LutTrans from '../../shaders/atmosphere/hillaire/lut_trans.wgsl?raw';
import shader_LutMulittrans from '../../shaders/atmosphere/hillaire/lut_multipleScatter.wgsl?raw';
import shader_LutSkyview from '../../shaders/atmosphere/hillaire/lut_skyview.wgsl?raw';
import shader_LutAp from '../../shaders/atmosphere/hillaire/lut_ap.wgsl?raw';
import shader_RenderWithLUT from '../../shaders/atmosphere/hillaire/renderWithLUT.wgsl?raw';
import shader_RenderWithRayMarching from '../../shaders/atmosphere/hillaire/renderRayMarching.wgsl?raw';
import { DirectionalLight } from '../../light/DirectionalLight';
import shader_shadowmap from '../../shaders/atmosphere/hillaire/common/shadowmap.wgsl?raw';

// import shader_three_point_vs_in from "../../shaders/quad/quad_three_point.vs.wgsl?raw";
// export var shader_three_point_vs = shader_three_point_vs_in;
export { default as shader_three_point_vs } from '../../shaders/quad/quad_three_point.vs.wgsl?raw';

export const shaderLutTrans =
    shader_override +
    shader_const +
    shader_intersection +
    shader_medium +
    shader_struct +
    shader_LutTrans;
export const shaderLutMulittrans =
    shader_override +
    shader_const +
    shader_intersection +
    shader_medium +
    shader_struct +
    shader_uv +
    shader_LutMulittrans;
export const shaderLutSkyview =
    shader_override +
    shader_const +
    shader_struct +
    shader_intersection +
    shader_medium +
    shader_phase +
    shader_uv +
    shader_coordinate_system +
    shader_shadowmap +
    shader_multi_scattering +
    shader_LutSkyview;
export const shaderLutAp =
    shader_override +
    shader_const +
    shader_struct +
    shader_intersection +
    shader_medium +
    shader_phase +
    shader_uv +
    shader_coordinate_system +
    shader_multi_scattering +
    shader_aerial_perspective +
    shader_shadowmap +
    shader_sample_segment_t +
    shader_LutAp;
export const shaderRenderWithRayMarching =
    shader_override +
    shader_const +
    shader_struct +
    shader_intersection +
    shader_medium +
    shader_phase +
    shader_uv +
    shader_coordinate_system +
    shader_multi_scattering +
    shader_sun_disk +
    shader_shadowmap +
    shader_sample_segment_t +
    shader_RenderWithRayMarching;
export const shaderRenderWithLUT =
    shader_override +
    shader_const +
    shader_struct +
    shader_intersection +
    shader_medium +
    shader_uv +
    shader_coordinate_system +
    shader_aerial_perspective +
    shader_sun_disk +
    shader_sample_segment_t +
    shader_RenderWithLUT;
