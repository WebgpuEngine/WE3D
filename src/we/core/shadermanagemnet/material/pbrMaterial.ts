
import {
    E_shaderTemplateReplaceType,
    I_ShaderTemplate,
    I_shaderTemplateAdd,
    I_shaderTemplateReplace,
    SHT_addMathBase,
    SHT_addMathRandom,
    SHT_addMathTBN,
    SHT_addPCSS,
    SHT_replaceGBufferCommonValue,
    SHT_replaceGBufferFSOutput,
    SHT_replaceGBufferMSAA_FSOutput,
    SHT_replaceGBufferMSAAinfo_FSOutput,
    WGSL_st_Guffer,
    WGSL_st_MSAA_Guffer,
    WGSL_st_MSAAinfo_Guffer
} from "../base"

import add_PBR_function_WGSL from "../../shader/material/PBR/PBRfunction.wgsl?raw"
var WGSL_add_PBR_function = add_PBR_function_WGSL.toString();
//PBR 的光影函数单项
export var SHT_add_PBR_function: I_shaderTemplateAdd =
{
    name: "PBR_function",
    code: WGSL_add_PBR_function
}
//PBR forward的光影Code内容单项
var SHT_replace_PBR_mainColorCode: I_shaderTemplateReplace =
{
    name: "mainColorCode",
    replace: "$mainColorCode",
    replaceType: E_shaderTemplateReplaceType.replaceCode,
    replaceCode: `
    materialColor = calcLightAndShadowOfPBR(
        worldPosition,
        normal,
        albedo,
        metallic,
        roughness,
        ao,
        materialColor,
        emissiveRGB,
        emissiveIntensity
        );
    `
}
var SHT_replace_PBR_mainColorCode_null: I_shaderTemplateReplace =
{
    name: "mainColorCode",
    replace: "$mainColorCode",
    replaceType: E_shaderTemplateReplaceType.replaceCode,
    replaceCode: "",
}
//PBR forward的光影参数编码单项
var SHT_replace_PBR_LightAndShadow_encode: I_shaderTemplateReplace =
{
    name: "encodeLightAndShadow",
    replace: "$encodeLightAndShadow",
    replaceType: E_shaderTemplateReplaceType.replaceCode,
    replaceCode: `
    acceptShadow = 1;
    shadowKind = 0;
    acceptlight = 1;
    materialKind = 1;
    //延迟渲染的GBuffer输出,8位. 每个位分别表示;接受阴影、阴影、其他、材质类型
    defer_4xU8InF16=encodeLightAndShadowFromU8x4ToU8bit(acceptShadow,shadowKind,acceptlight,materialKind);`
}

import PBRMaterialWGSL from "../../shader/material/PBR/PBR.fs.wgsl?raw"
var PBRFS = PBRMaterialWGSL.toString();

/**
 * PBR forward SHT。(未进行材质统一化)
 */
export var SHT_materialPBRFS_mergeToVS: I_ShaderTemplate = {
    material: {
        owner: "PBRMaterial",
        add: [
            {
                name: "fsOnput",
                code: WGSL_st_Guffer,
            },
            {
                name: "fs",
                code: PBRFS,
            },
            SHT_add_PBR_function,
            SHT_addMathBase,
            SHT_addMathTBN,
            SHT_addMathRandom,
            SHT_addPCSS,
        ],
        replace: [
            // {//进行uniform与纹理的材质统一化，todo
            //     name: "PBR_Uniform",
            //     replace: "$PBR_Uniform",
            //     replaceType: E_shaderTemplateReplaceType.value,
            // },       
            SHT_replace_PBR_mainColorCode,
            SHT_replaceGBufferFSOutput,                                            // WGSL_replace_gbuffer_output部分
            SHT_replaceGBufferCommonValue,                                            // WGSL_replace_gbuffer_commonValues部分
            {
                name: "PBR_albedo",
                replace: "$PBR_albedo",
                replaceType: E_shaderTemplateReplaceType.value,
            },
            {
                name: "PBR_metallic",
                replace: "$PBR_metallic",
                replaceType: E_shaderTemplateReplaceType.value,
            },
            {
                name: "PBR_roughness",
                replace: "$PBR_roughness",
                replaceType: E_shaderTemplateReplaceType.value,
            },
            {
                name: "PBR_ao",
                replace: "$PBR_ao",
                replaceType: E_shaderTemplateReplaceType.value,
            },
            {
                name: "PBR_normal",
                replace: "$PBR_normal",
                replaceType: E_shaderTemplateReplaceType.value,
            },
            {
                name: "PBR_color",
                replace: "$PBR_color",
                replaceType: E_shaderTemplateReplaceType.value,
            },
            SHT_replace_PBR_LightAndShadow_encode,
            //缺少alpha 透明处理，todo
        ],
    }
}

export var SHT_materialPBRFS_MSAA_mergeToVS: I_ShaderTemplate = {
    material: {
        owner: "PBRMaterial",
        add: [
            {
                name: "fsOnput",
                code: WGSL_st_MSAA_Guffer,
            },
            {
                name: "fs",
                code: PBRFS,
            },
            SHT_add_PBR_function,
            SHT_addMathBase,
            SHT_addMathTBN,
            SHT_addMathRandom,
            SHT_addPCSS,
        ],
        replace: [
            SHT_replace_PBR_mainColorCode,
            SHT_replaceGBufferMSAA_FSOutput,                                            // WGSL_replace_MSAA_gbuffer_output部分
            SHT_replaceGBufferCommonValue,                                            // WGSL_replace_gbuffer_commonValues部分
            {
                name: "PBR_albedo",
                replace: "$PBR_albedo",
                replaceType: E_shaderTemplateReplaceType.value,
            },
            {
                name: "PBR_metallic",
                replace: "$PBR_metallic",
                replaceType: E_shaderTemplateReplaceType.value,
            },
            {
                name: "PBR_roughness",
                replace: "$PBR_roughness",
                replaceType: E_shaderTemplateReplaceType.value,
            },
            {
                name: "PBR_ao",
                replace: "$PBR_ao",
                replaceType: E_shaderTemplateReplaceType.value,
            },
            {
                name: "PBR_normal",
                replace: "$PBR_normal",
                replaceType: E_shaderTemplateReplaceType.value,
            },
            {
                name: "PBR_color",
                replace: "$PBR_color",
                replaceType: E_shaderTemplateReplaceType.value,
            },
            SHT_replace_PBR_LightAndShadow_encode,
        ],
    }
}

import PBRMaterialMSAAinfoWGSL from "../../shader/material/PBR/PBRMSAAinfo.fs.wgsl?raw"
var PBRFS_MSAAinfo = PBRMaterialMSAAinfoWGSL.toString();
export var SHT_materialPBRFS_MSAA_info_mergeToVS: I_ShaderTemplate = {
    material: {
        owner: "PBRMaterial",
        add: [
            {
                name: "fsOnput",
                code: WGSL_st_MSAAinfo_Guffer,
            },
            {
                name: "fs",
                code: PBRFS,
            },
            SHT_addMathBase,
            SHT_addMathTBN,
        ],
        replace: [
            SHT_replace_PBR_mainColorCode_null,                                         //替换$mainColorCode为空字符串
            SHT_replaceGBufferMSAAinfo_FSOutput,                                      // WGSL_replace_MSAAinfo_gbuffer_output部分
            SHT_replaceGBufferCommonValue,                                            // WGSL_replace_gbuffer_commonValues部分
            {
                name: "PBR_albedo",
                replace: "$PBR_albedo",
                replaceType: E_shaderTemplateReplaceType.value,
            },
            {
                name: "PBR_metallic",
                replace: "$PBR_metallic",
                replaceType: E_shaderTemplateReplaceType.value,
            },
            {
                name: "PBR_roughness",
                replace: "$PBR_roughness",
                replaceType: E_shaderTemplateReplaceType.value,
            },
            {
                name: "PBR_ao",
                replace: "$PBR_ao",
                replaceType: E_shaderTemplateReplaceType.value,
            },
            {
                name: "PBR_normal",
                replace: "$PBR_normal",
                replaceType: E_shaderTemplateReplaceType.value,
            },
            SHT_replace_PBR_LightAndShadow_encode,
            //替换$PBR_color为空字符串
            {
                name: "PBR_color",
                replace: "$PBR_color",
                replaceType: E_shaderTemplateReplaceType.replaceCode,
                replaceCode: ""
            },
        ],
    }
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//defer PBR
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//PBR forward的光影Code内容单项
var SHT_replace_PBR_deferColorCode: I_shaderTemplateReplace =
{
    name: "mainColorCode",
    replace: "$mainColorCode",
    replaceType: E_shaderTemplateReplaceType.replaceCode,
    replaceCode: "",//延迟渲染中，颜色只计算颜色，不需要乘以albedo，albedo在光影中计算
    // replaceCode: `    materialColor=vec4f(albedo ,1);`
}

/**
 * forward defer PBR part of forward SHT。(未进行材质统一化)
 */
export var SHT_materialPBRFS_defer_mergeToVS: I_ShaderTemplate = {
    material: {
        owner: "PBRMaterial",
        add: [
            {
                name: "fsOnput",
                code: WGSL_st_Guffer,
            },
            {
                name: "fs",
                code: PBRFS,
            },
            SHT_addMathBase,
            SHT_addMathTBN,
        ],
        replace: [
            // {
            //     name: "PBR_Uniform",
            //     replace: "$PBR_Uniform",
            //     replaceType: E_shaderTemplateReplaceType.value,
            // },           
            //替换GBuffer输出的内容占位符为：PBR的延迟渲染的GBuffer输出内容，
            SHT_replace_PBR_deferColorCode,
            // SHT_replace_PBR_mainColorCode_null,                                         //替换$mainColorCode为 只有颜色的代码
            SHT_replaceGBufferFSOutput,                                            // WGSL_replace_gbuffer_output部分
            SHT_replaceGBufferCommonValue,                                            // WGSL_replace_gbuffer_commonValues部分
            {
                name: "PBR_albedo",
                replace: "$PBR_albedo",
                replaceType: E_shaderTemplateReplaceType.value,
            },
            {
                name: "PBR_metallic",
                replace: "$PBR_metallic",
                replaceType: E_shaderTemplateReplaceType.value,
            },
            {
                name: "PBR_roughness",
                replace: "$PBR_roughness",
                replaceType: E_shaderTemplateReplaceType.value,
            },
            {
                name: "PBR_ao",
                replace: "$PBR_ao",
                replaceType: E_shaderTemplateReplaceType.value,
            },
            {
                name: "PBR_normal",
                replace: "$PBR_normal",
                replaceType: E_shaderTemplateReplaceType.value,
            },
            {
                name: "PBR_color",
                replace: "$PBR_color",
                replaceType: E_shaderTemplateReplaceType.value,
            },
            SHT_replace_PBR_LightAndShadow_encode,
            //缺少alpha 透明处理，todo
        ],
    }
}

export var SHT_materialPBRFS_defer_MSAA_mergeToVS: I_ShaderTemplate = {
    material: {
        owner: "PBRMaterial",
        add: [
            {
                name: "fsOnput",
                code: WGSL_st_MSAA_Guffer,
            },
            {
                name: "fs",
                code: PBRFS,
            },
            SHT_addMathBase,
            SHT_addMathTBN,
        ],
        replace: [
            SHT_replace_PBR_mainColorCode_null,                                         //替换$mainColorCode为空字符串
            SHT_replaceGBufferMSAA_FSOutput,                                            // WGSL_replace_MSAA_gbuffer_output部分
            SHT_replaceGBufferCommonValue,                                            // WGSL_replace_gbuffer_commonValues部分
            {
                name: "PBR_albedo",
                replace: "$PBR_albedo",
                replaceType: E_shaderTemplateReplaceType.value,
            },
            {
                name: "PBR_metallic",
                replace: "$PBR_metallic",
                replaceType: E_shaderTemplateReplaceType.value,
            },
            {
                name: "PBR_roughness",
                replace: "$PBR_roughness",
                replaceType: E_shaderTemplateReplaceType.value,
            },
            {
                name: "PBR_ao",
                replace: "$PBR_ao",
                replaceType: E_shaderTemplateReplaceType.value,
            },
            {
                name: "PBR_normal",
                replace: "$PBR_normal",
                replaceType: E_shaderTemplateReplaceType.value,
            },
            {
                name: "PBR_color",
                replace: "$PBR_color",
                replaceType: E_shaderTemplateReplaceType.value,
            },
            SHT_replace_PBR_LightAndShadow_encode,
            //缺少alpha 透明处理
        ],
    }
}

export var SHT_materialPBRFS_defer_MSAA_info_mergeToVS: I_ShaderTemplate = SHT_materialPBRFS_MSAA_info_mergeToVS;


