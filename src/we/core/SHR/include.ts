import include_toneMappingWGSL from '../shaders/colorSpace/toneMapping.wgsl?raw';
import DeferRenderFS_WGSL from '../shaders/defer/deferRender.fs.wgsl?raw';
import toneMappingWGSL from '../shaders/toneMapping/toneMapping.wgsl?raw';

//////////////////////////////////////////////////////////////////////////////////
// entity bindgroup
import include_bindgroup_entiy_base_wgsl from '../shaders/entity/bindgroup_entiy_base.wgsl?raw';
import include_bindgroup_add_morphTarget_wgsl from '../shaders/entity/morphTarget/bindgroup_add_morphTarget.wgsl?raw';
import include_bindgroup_add_skins_wgsl from '../shaders/entity/skins/bindgroup_add_skins.wgsl?raw';

// VS  :entity
import include_structEntity_wgsl from '../shaders/entity/structEntity.wgsl?raw';
import include_st_vertex_output_wgsl from '../shaders/entity/st_vertex_output.wgsl?raw';
import include_code_entity_output_wgsl from '../shaders/entity/code_entity_output.vs.wgsl?raw';
import meshMain_wgsl from '../shaders/entity/mesh/main.vs.wgsl?raw';
// import lineMain_wgsl from "../shaders/entity/mesh/main.vs.wgsl?raw";
// import pointsMain_wgsl from "../shaders/entity/point/main.vs.wgsl?raw"
import shadowmapMain_wgsl from '../shaders/entity/shadowmap/main.vs.wgsl?raw';
import sprite_wgsl from '../shaders/entity/sprite/main.vs.wgsl?raw';
// import wireFrame_wgsl from "../shaders/entity/mesh/wireframe.vs.wgsl?raw"
import oneCubeColor_wgsl from '../shaders/entity/oneColorCube/oneColorCube.vs.wgsl?raw';

import meshMorphTargetMain_wgsl from '../shaders/entity/morphTarget/morphTarget.vs.wgsl?raw';
import meshSkinsMain_wgsl from '../shaders/entity/skins/skins.vs.wgsl?raw';

import quadVS_wgsl from '../shaders/quad/quad.vs.wgsl?raw';
//////////////////////////////////////////////////////////////////////////////////
//GBuffer
//struct 定义
import include_gbuffer_commonValues_wgsl from '../shaders/gbuffers/commonGBufferValue.wgsl?raw';

import tag_st_GBuffer_wgsl from '../shaders/gbuffers/st_gbuffer.fs.wgsl?raw';
import tag_st_MSAA_GBuffer_wgsl from '../shaders/gbuffers/st_MSAA_gbuffer.fs.wgsl?raw';
import tag_st_MSAAinfo_GBuffer_wgsl from '../shaders/gbuffers/st_MSAAinfo_gbuffer.fs.wgsl?raw';
import tag_st_blend_GBuffer_wgsl from '../shaders/gbuffers/st_blend_gbuffer.fs.wgsl?raw';

// import include_st_transgparent_GBuffer_wgsl from "../shaders/gbuffers/st_transgparentbuffer.fs.wgsl?raw";
import tag_gbuffer_output_wgsl from '../shaders/gbuffers/replace_gbuffer_output.fs.wgsl?raw';
import tag_MSAA_gbuffer_output_wgsl from '../shaders/gbuffers/replace_MSAA_gbuffer_output.fs.wgsl?raw';
import tag_MSAAinfo_gbuffer_output_wgsl from '../shaders/gbuffers/replace_MSAAinfo_gbuffer_output.fs.wgsl?raw';
import tag_blend_gbuffer_output_wgsl from '../shaders/gbuffers/replace_blend_gbuffer_output.fs.wgsl?raw';

//////////////////////////////////////////////////////////////////////////////////
//math

import include_mathConst_wgsl from '../shaders/math/baseconst.wgsl?raw';
import include_mathTBN_wgsl from '../shaders/math/TBN.wgsl?raw';
import include_mathRandom_wgsl from '../shaders/math/random.wgsl?raw';

//////////////////////////////////////////////////////////////////////////////////
//material
import include_encodeDecodeFunction_wgsl from '../shaders/function/encodeAndDecode.wgsl?raw';
// import include_bindgroup_material_base_wgsl from "../shaders/material/bindgroup_material_base.wgsl?raw";
// import include_bindgroup_material_base_MSAA_wgsl from "../shaders/material/MSAA/bindgroup_Msaa.wgsl?raw";

import include_MsaaString_wgsl from '../shaders/material/MSAA/msaa.wgsl?raw';
import colorFS_wgsl from '../shaders/material/color/color.fs.wgsl?raw';
import vertexColorFS_wgsl from '../shaders/material/vertexColor/color.fs.wgsl?raw';
import textureFSWGSL from '../shaders/material/texture/texture.fs.wgsl?raw';
import videoTextureFSWGSL from '../shaders/material/texture/video.fs.wgsl?raw';
import videoExternalTextureFSWGSL from '../shaders/material/texture/videoExternal.fs.wgsl?raw';
import wireFrameFSWGSL from '../shaders/material/wirframe/wireFrame.fs.wgsl?raw';
import cubeSKyTextureFSWGSL from '../shaders/material/texture/cubeSkyTexture.fs.wgsl?raw';
import cubePositionTextureFSWGSL from '../shaders/material/texture/cubeLocalTexture.fs.wgsl?raw';
import volumeTextureFSWGSL from '../shaders/material/volume/volumeTexture.fs.wgsl?raw';
import testRayMarchVolumeFSWGSL from '../shaders/material/volume/testRayMarchVolume.fs.wgsl?raw';

import include_Phong_function_WGSL from '../shaders/material/phong/phongFunction.wgsl?raw';
import phongMaterialWGSL from '../shaders/material/phong/phongcolor.fs.wgsl?raw';

import include_PBR_function_WGSL from '../shaders/material/PBR/PBRfunction.wgsl?raw';
import PBRMaterialWGSL from '../shaders/material/PBR/PBR.fs.wgsl?raw';
//////////////////////////////////////////////////////////////////////////////////
//pp
import PP_Blur3x3_FS_WGSL from '../shaders/PostProcess/blur/blur3x3.fs.wgsl?raw';
import PP_FXAA_FS_WGSL from '../shaders/PostProcess/AA/FXAA.fs.wgsl?raw';
import PP_RedToOne_FS_WGSL from '../shaders/PostProcess/test/redToOne.wgsl?raw';
import include_PP_struct_WGSL from '../shaders/PostProcess/PPstruct.wgsl?raw';

//////////////////////////////////////////////////////////////////////////////////
//shadow map MVP
import systemOfLight_wgsl from '../shaders/system/systemForLight.wgsl?raw';
import shadowmapPCSS_wgsl from '../shaders/shadowmap/fn_pcss.wgsl?raw';
import systemOfCamera_wgsl from '../shaders/system/system.wgsl?raw';
import structOfCamera_wgsl from '../shaders/system/structOfCamera.wgsl?raw';
//////////////////////////////////////////////////////////////////////////////////
//IBL
import include_bindgroup3_wgsl from '../shaders/graphic/bindgroup3/bindgroup.wgsl?raw';
// import  include_struct_ibl_wgsl from "../shaders/graphic/ibl/struct_ibl.wgsl?raw"
import include_ibl_fn_wgsl from '../shaders/graphic/ibl/ibl_fn.wgsl?raw';

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/**渲染模式 */
export type T_SHR_RenderMode = 'forward' | 'defer' | 'Msaa' | 'MsaaInfo' | 'blend';

/**include代码 ：基础代码
 * 1、为vs、fs的wgsl代码服务，提供include资源
 */
export const WGSL_Include: Record<string, string> = {
    'colorSpace/toneMapping.wgsl': include_toneMappingWGSL,

    'entity/bindgroup_entiy_base.wgsl': include_bindgroup_entiy_base_wgsl,
    'entity/morphTarget/bindgroup_add_morphTarget.wgsl': include_bindgroup_add_morphTarget_wgsl,
    'entity/skins/bindgroup_add_skins.wgsl': include_bindgroup_add_skins_wgsl,

    'entity/structEntity.wgsl': include_structEntity_wgsl,
    'entity/st_vertex_output.wgsl': include_st_vertex_output_wgsl,
    'entity/code_entity_output.vs.wgsl': include_code_entity_output_wgsl,

    // "quad/st_quad_output.wgsl": include_st_quad_output_wgsl,
    'entity/quad/quad.vs.wgsl': quadVS_wgsl,

    'gbuffers/commonGBufferValue.wgsl': include_gbuffer_commonValues_wgsl,

    'material/MSAA/msaa.wgsl': include_MsaaString_wgsl,

    // "material/bindgroup_material_base.wgsl": include_bindgroup_material_base_wgsl,

    'material/PBR/PBRfunction.wgsl': include_PBR_function_WGSL,
    'material/phong/phongfunction.wgsl': include_Phong_function_WGSL,

    'math/baseconst.wgsl': include_mathConst_wgsl,
    'math/TBN.wgsl': include_mathTBN_wgsl,
    'math/random.wgsl': include_mathRandom_wgsl,

    'PostProcess/PPstruct.wgsl': include_PP_struct_WGSL,

    'shadowmap/fn_pcss.wgsl': shadowmapPCSS_wgsl,

    'system/systemForLight.wgsl': systemOfLight_wgsl,
    'system/structOfCamera.wgsl': structOfCamera_wgsl,
    'system/system.wgsl': systemOfCamera_wgsl,
    'function/encodeAndDecode.wgsl': include_encodeDecodeFunction_wgsl,

    'graphic/bindgroup3/bindgroup.wgsl': include_bindgroup3_wgsl,
    // "graphic/ibl/struct_ibl.wgsl": include_struct_ibl_wgsl,
    'graphic/ibl/ibl_fn.wgsl': include_ibl_fn_wgsl,
};

/**指定GBuffer struct
 * 1、为fs的wgsl代码服务，提供选择性include GBufer结构体功能
 * 2、在WGSL文件中的形式如：#tag gbuffers
 *
 */
export const WGSL_V_Gbuffers_struct: Record<T_SHR_RenderMode, string> = {
    forward: tag_st_GBuffer_wgsl,
    defer: tag_st_GBuffer_wgsl,
    Msaa: tag_st_MSAA_GBuffer_wgsl,
    MsaaInfo: tag_st_MSAAinfo_GBuffer_wgsl,
    blend: tag_st_blend_GBuffer_wgsl,
};
/**指定GBuffer output
 * 1、为fs的wgsl代码服务，提供选择性include GBufer output 结构体的定义
 * 2、在WGSL文件中的形式如：#tag gbuffers_output
 */
export const WGSL_V_Gbuffers_output: Record<T_SHR_RenderMode, string> = {
    forward: tag_gbuffer_output_wgsl,
    defer: tag_gbuffer_output_wgsl,
    Msaa: tag_MSAA_gbuffer_output_wgsl,
    MsaaInfo: tag_MSAAinfo_gbuffer_output_wgsl,
    blend: tag_blend_gbuffer_output_wgsl,
};
/**replace代码 */
export const WGSL_Replace: Record<string, string> = {
    test1: ' ',
};
/**主shader代码
 * 1、为WGSL_AliasShaderCode中的code部分的string赋值
 */
export const WGSL_ShaderCode: Record<string, string> = {
    'entity/mesh/main.vs.wgsl': meshMain_wgsl,
    'entity/shadowmap/main.vs.wgsl': shadowmapMain_wgsl,
    // "entity/line/main.vs.wgsl": lineMain_wgsl,
    'entity/morphTarget/morphTarget.vs.wgsl': meshMorphTargetMain_wgsl,
    'entity/mesh/oneColorCube.vs.wgsl': oneCubeColor_wgsl,
    // "entity/point/main.vs.wgsl": pointsMain_wgsl,
    'entity/quad/quad.vs.wgsl': quadVS_wgsl,
    'entity/sprite/main.vs.wgsl': sprite_wgsl,
    'entity/skins/skins.vs.wgsl': meshSkinsMain_wgsl,
    // "entity/mesh/wireframe.vs.wgsl": wireFrame_wgsl,

    'material/color/color.fs.wgsl': colorFS_wgsl,
    'material/vertexColor/color.fs.wgsl': vertexColorFS_wgsl,
    'material/texture/texture.fs.wgsl': textureFSWGSL,
    'material/texture/video.fs.wgsl': videoTextureFSWGSL,
    'material/texture/videoExternal.fs.wgsl': videoExternalTextureFSWGSL,
    'material/wirframe/wireFrame.fs.wgsl': wireFrameFSWGSL,
    'material/texture/cubeSkyTexture.fs.wgsl': cubeSKyTextureFSWGSL,
    'material/texture/cubeLocalTexture.fs.wgsl': cubePositionTextureFSWGSL,
    'material/phong/phongcolor.fs.wgsl': phongMaterialWGSL,
    'material/PBR/PBR.fs.wgsl': PBRMaterialWGSL,

    'material/volume/volumeTexture.fs.wgsl': volumeTextureFSWGSL,
    'material/volume/testRayMarchVolume.fs.wgsl': testRayMarchVolumeFSWGSL,

    'PostProcess/blur/blur3x3.fs.wgsl': PP_Blur3x3_FS_WGSL,
    'PostProcess/AA/FXAA.fs.wgsl': PP_FXAA_FS_WGSL,
    'PostProcess/test/redToOne.fs.wgsl': PP_RedToOne_FS_WGSL,

    'defer/deferRender.fs.wgsl': DeferRenderFS_WGSL,
    'toneMapping/toneMapping.fs.wgsl': toneMappingWGSL,
};
/**alias shader代码 */
export interface I_aliasShaderCode {
    /**shader类型 ,用途注释*/
    type: 'vs' | 'fs' | 'quadVs' | 'quadFs' | 'vs+fs';
    code: string;
    renderMode?: Record<T_SHR_RenderMode, boolean>;
    // renderMode?: Record<string, boolean>
}
/**alias shader名称
 * 1、对外输出的shader名称,名称与E_shaderRegisterAlianName中的名称一致
 * 2、material中的渲染模式部分 ，如：material.color.xxx 是在SHR中注册的别名
 */
export const WGSL_AliasShaderCode: Record<string, I_aliasShaderCode> = {
    toneMapping: {
        type: 'vs+fs',
        code: WGSL_ShaderCode['toneMapping/toneMapping.fs.wgsl'],
    },

    defer: {
        type: 'fs',
        code: WGSL_ShaderCode['defer/deferRender.fs.wgsl'],
    },

    'entity.mesh': {
        //mesh file
        type: 'vs',
        code: WGSL_ShaderCode['entity/mesh/main.vs.wgsl'],
    },
    'entity.lines': {
        //mesh file
        type: 'vs',
        code: WGSL_ShaderCode['entity/mesh/main.vs.wgsl'],
    },
    'entity.points': {
        //mesh file
        type: 'vs',
        code: WGSL_ShaderCode['entity/mesh/main.vs.wgsl'],
    },
    'entity.wireframe': {
        //mesh file
        type: 'vs',
        code: WGSL_ShaderCode['entity/mesh/main.vs.wgsl'],
    },
    'entity.shadowmap': {
        type: 'vs',
        code: WGSL_ShaderCode['entity/shadowmap/main.vs.wgsl'],
    },
    'entity.sprite': {
        type: 'vs',
        code: WGSL_ShaderCode['entity/sprite/main.vs.wgsl'],
    },
    'entity.oneColorCube': {
        //mesh file
        type: 'vs',
        code: WGSL_ShaderCode['entity/mesh/oneColorCube.vs.wgsl'],
    },
    'entity.morphTarget': {
        type: 'vs',
        code: WGSL_ShaderCode['entity/morphTarget/morphTarget.vs.wgsl'],
    },
    'entity.skins': {
        type: 'vs',
        code: WGSL_ShaderCode['entity/skins/skins.vs.wgsl'],
    },
    'entity.quad': {
        type: 'quadVs',
        code: WGSL_ShaderCode['entity/quad/quad.vs.wgsl'],
    },

    'material.color': {
        type: 'fs',
        code: WGSL_ShaderCode['material/color/color.fs.wgsl'],
        renderMode: {
            forward: true,
            defer: false,
            Msaa: true,
            MsaaInfo: true,
            blend: true,
        },
    },
    'material.vertexColor': {
        type: 'fs',
        code: WGSL_ShaderCode['material/vertexColor/color.fs.wgsl'],
        renderMode: {
            forward: true,
            defer: false,
            Msaa: true,
            MsaaInfo: true,
            blend: true,
        },
    },
    'material.texture': {
        type: 'fs',
        code: WGSL_ShaderCode['material/texture/texture.fs.wgsl'],
        renderMode: {
            forward: true,
            defer: false,
            Msaa: true,
            MsaaInfo: true,
            blend: true,
        },
    },
    'material.wireframe': {
        type: 'fs',
        code: WGSL_ShaderCode['material/wirframe/wireFrame.fs.wgsl'],
        renderMode: {
            forward: true,
            defer: false,
            Msaa: true,
            MsaaInfo: true,
            blend: false,
        },
    },
    'material.video': {
        type: 'fs',
        code: WGSL_ShaderCode['material/texture/video.fs.wgsl'],
        renderMode: {
            forward: true,
            defer: false,
            Msaa: true,
            MsaaInfo: true,
            blend: false,
        },
    },
    'material.videoExternal': {
        type: 'fs',
        code: WGSL_ShaderCode['material/texture/videoExternal.fs.wgsl'],
        renderMode: {
            forward: true,
            defer: false,
            Msaa: true,
            MsaaInfo: true,
            blend: false,
        },
    },
    'material.cube': {
        type: 'fs',
        code: WGSL_ShaderCode['material/texture/cubeLocalTexture.fs.wgsl'],
        renderMode: {
            forward: true,
            defer: false,
            Msaa: true,
            MsaaInfo: true,
            blend: false,
        },
    },
    'material.cubeSky': {
        type: 'fs',
        code: WGSL_ShaderCode['material/texture/cubeSkyTexture.fs.wgsl'],
        renderMode: {
            forward: true,
            defer: false,
            Msaa: true,
            MsaaInfo: true,
            blend: false,
        },
    },
    'material.phong': {
        type: 'fs',
        code: WGSL_ShaderCode['material/phong/phongcolor.fs.wgsl'],
        renderMode: {
            forward: true,
            defer: true,
            Msaa: true,
            MsaaInfo: true,
            blend: false,
        },
    },
    'material.pbr': {
        type: 'fs',
        code: WGSL_ShaderCode['material/PBR/PBR.fs.wgsl'],
        renderMode: {
            forward: true,
            defer: true,
            Msaa: true,
            MsaaInfo: true,
            blend: true,
        },
    },
    'material.volumeTexture': {
        type: 'fs',
        code: WGSL_ShaderCode['material/volume/volumeTexture.fs.wgsl'],
        renderMode: {
            forward: true,
            defer: false,
            Msaa: true,
            MsaaInfo: true,
            blend: false,
        },
    },
    'material.testRayMarchVolume': {
        type: 'fs',
        code: testRayMarchVolumeFSWGSL,
        renderMode: {
            forward: true,
            defer: false,
            Msaa: true,
            MsaaInfo: true,
            blend: false,
        },
    },

    'postProcess.blur3x3': {
        type: 'fs',
        code: WGSL_ShaderCode['PostProcess/blur/blur3x3.fs.wgsl'],
    },
    'postProcess.FXAA': {
        type: 'fs',
        code: WGSL_ShaderCode['PostProcess/AA/FXAA.fs.wgsl'],
    },
    'postProcess.redToOne': {
        type: 'fs',
        code: WGSL_ShaderCode['PostProcess/test/redToOne.fs.wgsl'],
    },
};
/**
 * 着色器注册的别名
 * 1、20260628,这里有个问题，需要多处保障名称的一致性
 *   包括：
 *       E_shaderRegisterAlianName：全部名称
 *       WGSL_AliasShaderCode：部分名称+material的后缀，需要整合后完全对应
 *       ShaderRegister._aliasShaderCode: 与E_shaderRegisterAlianName需要完全对应
 *   所以，在ShaderRegister中，增加getShaderName()，以简化，并保障最终一致性，错误时会报错
 */
export enum E_shaderRegisterAlianName {
    toneMapping = 'toneMapping',
    defer = 'defer',
    'entity.mesh' = 'entity.mesh',
    'entity.lines' = 'entity.lines',
    'entity.points' = 'entity.points',
    'entity.wireframe' = 'entity.wireframe',
    'entity.shadowmap' = 'entity.shadowmap',
    'entity.sprite' = 'entity.sprite',
    'entity.oneColorCube' = 'entity.oneColorCube',
    'entity.morphTarget' = 'entity.morphTarget',
    'entity.skins' = 'entity.skins',
    'entity.quad' = 'entity.quad',

    'material.color.forward' = 'material.color.forward',
    'material.color.Msaa' = 'material.color.Msaa',
    'material.color.MsaaInfo' = 'material.color.MsaaInfo',
    'material.color.blend' = 'material.color.blend',

    'material.vertexColor.forward' = 'material.vertexColor.forward',
    'material.vertexColor.Msaa' = 'material.vertexColor.Msaa',
    'material.vertexColor.MsaaInfo' = 'material.vertexColor.MsaaInfo',
    'material.vertexColor.blend' = 'material.vertexColor.blend',

    'material.texture.forward' = 'material.texture.forward',
    'material.texture.Msaa' = 'material.texture.Msaa',
    'material.texture.MsaaInfo' = 'material.texture.MsaaInfo',
    'material.texture.blend' = 'material.texture.blend',

    'material.wireframe.forward' = 'material.wireframe.forward',
    'material.wireframe.Msaa' = 'material.wireframe.Msaa',
    'material.wireframe.MsaaInfo' = 'material.wireframe.MsaaInfo',

    'material.videoExternal.forward' = 'material.videoExternal.forward',
    'material.videoExternal.Msaa' = 'material.videoExternal.Msaa',
    'material.videoExternal.MsaaInfo' = 'material.videoExternal.MsaaInfo',

    'material.video.forward' = 'material.video.forward',
    'material.video.Msaa' = 'material.video.Msaa',
    'material.video.MsaaInfo' = 'material.video.MsaaInfo',

    'material.cube.forward' = 'material.cube.forward',
    'material.cube.Msaa' = 'material.cube.Msaa',
    'material.cube.MsaaInfo' = 'material.cube.MsaaInfo',

    'material.cubeSky.forward' = 'material.cubeSky.forward',
    'material.cubeSky.Msaa' = 'material.cubeSky.Msaa',
    'material.cubeSky.MsaaInfo' = 'material.cubeSky.MsaaInfo',

    'material.phong.forward' = 'material.phong.forward',
    'material.phong.defer' = 'material.phong.defer',
    'material.phong.Msaa' = 'material.phong.Msaa',
    'material.phong.MsaaInfo' = 'material.phong.MsaaInfo',

    'material.pbr.forward' = 'material.pbr.forward',
    'material.pbr.defer' = 'material.pbr.defer',
    'material.pbr.Msaa' = 'material.pbr.Msaa',
    'material.pbr.MsaaInfo' = 'material.pbr.MsaaInfo',
    'material.pbr.blend' = 'material.pbr.blend',

    'material.volumeTexture.forward' = 'material.volumeTexture.forward',
    'material.volumeTexture.Msaa' = 'material.volumeTexture.Msaa',
    'material.volumeTexture.MsaaInfo' = 'material.volumeTexture.MsaaInfo',

    'material.testRayMarchVolume.forward' = 'material.testRayMarchVolume.forward',
    'material.testRayMarchVolume.Msaa' = 'material.testRayMarchVolume.Msaa',
    'material.testRayMarchVolume.MsaaInfo' = 'material.testRayMarchVolume.MsaaInfo',

    'postProcess.blur3x3' = 'postProcess.blur3x3',
    'postProcess.FXAA' = 'postProcess.FXAA',
    'postProcess.redToOne' = 'postProcess.redToOne',
}
/** 反射attribute属性预定义 */
export const WGSL_reflection_attributes: Record<string, string[]> = {
    position: [
        ' let position= vec3f(0.0,0.0,0.0); \n ',
        ' let position = attributes.position; \n ',
    ],
    normal: [' let normal= vec3f(0.0,0.0,0.0); \n ', ' let normal = attributes.normal; \n '],
    color: [' let color= vec3f(1.0,1.0,1.0); \n ', ' let color = attributes.color; \n '],
    uv: [' var uv= vec4f(0.0,0.0,0.0,0.0); \n ', ' var uv =vec4f(attributes.uv,0.0,0.0); \n '],
    uv1: ['', ' uv[2]= attributes.uv1[0]; \n uv[3]= attributes.uv1[1]; \n '],
};
