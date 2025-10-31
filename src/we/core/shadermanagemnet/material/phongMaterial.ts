
import { E_shaderTemplateReplaceType, I_ShaderTemplate, I_shaderTemplateAdd, I_shaderTemplateReplace, SHT_addMathBase, SHT_addMathRandom, SHT_addMathTBN, SHT_addPCSS,  SHT_replaceGBufferCommonValue, SHT_replaceGBufferFSOutput, WGSL_replace_gbuffer_output, WGSL_replace_MSAA_gbuffer_output, WGSL_replace_MSAAinfo_gbuffer_output, WGSL_st_Guffer, WGSL_st_MSAA_Guffer, WGSL_st_MSAAinfo_Guffer } from "../base"
import add_Phong_function_WGSL from "../../shader/material/phong/phongfunction.wgsl?raw"
var WGSL_add_Phong_function = add_Phong_function_WGSL.toString();
//PBR 的光影函数单项
export var SHT_add_Phong_function: I_shaderTemplateAdd =
{
    name: "Phong_function",
    code: WGSL_add_Phong_function
}
//PBR forward的光影Code内容单项
var SHT_replace_Phong_mainColorCode: I_shaderTemplateReplace =
{
    name: "mainColorCode",
    replace: "$mainColorCode",
    replaceType: E_shaderTemplateReplaceType.replaceCode,
    replaceCode: `
    materialColor=calcLightAndShadowOfPhong(
        worldPosition,
        normal,
        inSpecularColor,
        metallic,
        roughness,
        shininess,
        materialColor,
        vec3f(0.0, 0.0, 0.0),
        1.0
    );
    `
}
//PBR forward的光影参数编码单项
var SHT_replace_Phong_LightAndShadow_encode: I_shaderTemplateReplace =
{
    name: "encodeLightAndShadow",
    replace: "$encodeLightAndShadow",
    replaceType: E_shaderTemplateReplaceType.replaceCode,
    replaceCode: `
    acceptShadow = 1;
    shadowKind = 0;
    acceptlight = 1;
    materialKind = 2;
    //延迟渲染的GBuffer输出,8位. 每个位分别表示;接受阴影、阴影、其他、材质类型
    defer_4xU8InF16=encodeLightAndShadowFromU8x4ToU8bit(acceptShadow,shadowKind,acceptlight,materialKind);`
}

import phongMaterialWGSL from "../../shader/material/phong/phongcolor.fs.wgsl?raw"
var phongFS = phongMaterialWGSL.toString();

export var SHT_materialPhongFS_mergeToVS: I_ShaderTemplate = {
    material: {
        owner: "PhongMaterial",
        add: [
            SHT_addMathBase,
            SHT_addMathTBN,
            SHT_addMathRandom,
            SHT_addPCSS,
            SHT_add_Phong_function,
            {
                name: "fsOnput",
                code: WGSL_st_Guffer,
            },
            {
                name: "fs",
                code: phongFS,
            },

        ],
        replace: [
            SHT_replace_Phong_mainColorCode,
            SHT_replaceGBufferFSOutput,                                            // WGSL_replace_gbuffer_output部分
            SHT_replaceGBufferCommonValue,                                            // WGSL_replace_gbuffer_commonValues部分
            {
                name: "materialColor",
                replace: "$materialColor",           //
                replaceType: E_shaderTemplateReplaceType.value,                //   var materialColor = $materialColor              //颜色或纹理颜色
            },
            {
                name: "normal",
                replace: "$normal",           //
                replaceType: E_shaderTemplateReplaceType.value,                 //var normal =$normal                             //来自VS，还是来自texture
            },
            {
                name: "specular",
                replace: "$specular",           //
                replaceType: E_shaderTemplateReplaceType.value,                //数值，metalness
            },
            SHT_replace_Phong_LightAndShadow_encode,
        ],
    }
}

export var SHT_materialPhongFS_MSAA_mergeToVS: I_ShaderTemplate = {
    material: {
        owner: "PhongMaterial",
        add: [
            SHT_addMathBase,
            SHT_addMathTBN,
            SHT_addMathRandom,
            SHT_addPCSS,
            SHT_add_Phong_function,
            {
                name: "fsOnput",
                code: WGSL_st_MSAA_Guffer,
            },
            {
                name: "fs",
                code: phongFS,
            },
        ],
        replace: [
            SHT_replace_Phong_mainColorCode,
            {
                name: "colorFS.output content",
                replace: "$fsOutput",           //
                replaceType: E_shaderTemplateReplaceType.replaceCode,
                replaceCode: WGSL_replace_MSAA_gbuffer_output
            },
            SHT_replaceGBufferCommonValue,                                            // WGSL_replace_gbuffer_commonValues部分

            {
                name: "materialColor",
                replace: "$materialColor",           //
                replaceType: E_shaderTemplateReplaceType.value,                //   var materialColor = $materialColor              //颜色或纹理颜色
            },
            {
                name: "normal",
                replace: "$normal",           //
                replaceType: E_shaderTemplateReplaceType.value,                 //var normal =$normal                             //来自VS，还是来自texture
            },
            {
                name: "specular",
                replace: "$specular",           //
                replaceType: E_shaderTemplateReplaceType.value,                //数值，metalness
            },
            SHT_replace_Phong_LightAndShadow_encode,
        ],
    }
}

import phongMaterial_MSAAinfo_WGSL from "../../shader/material/phong/phongMSAAinfo.fs.wgsl?raw"
var phongMSAAinfoFS = phongMaterial_MSAAinfo_WGSL.toString();
export var SHT_materialPhongFS_MSAA_info_mergeToVS: I_ShaderTemplate = {
    material: {
        owner: "PhongMaterial",
        add: [
            SHT_addMathBase,
            SHT_addMathTBN,
            SHT_addMathRandom,
            SHT_addPCSS,
            SHT_add_Phong_function,
            {
                name: "fsOnput",
                code: WGSL_st_MSAAinfo_Guffer,
            },
            {
                name: "fs",
                code: phongFS,
            },
        ],
        replace: [
            {
                name: "colorFS.output content",
                replace: "$fsOutput",           //
                replaceType: E_shaderTemplateReplaceType.replaceCode,
                replaceCode: WGSL_replace_MSAAinfo_gbuffer_output
            },
            SHT_replaceGBufferCommonValue,                                            // WGSL_replace_gbuffer_commonValues部分

            {
                name: "normal",
                replace: "$normal",           //
                replaceType: E_shaderTemplateReplaceType.value,                 //var normal =$normal                             //来自VS，还是来自texture
            },
            {
                name: "specular",
                replace: "$specular",           //
                replaceType: E_shaderTemplateReplaceType.replaceCode,                //数值，metalness
                replaceCode: "",
            },
            {
                name: "mainColorCode",
                replace: "$mainColorCode",
                replaceType: E_shaderTemplateReplaceType.replaceCode,
                replaceCode: ""
            },
            {
                name: "materialColor",
                replace: "$materialColor",           //
                replaceType: E_shaderTemplateReplaceType.replaceCode,                //   var materialColor = $materialColor              //颜色或纹理颜色
                replaceCode: "",
            },
            SHT_replace_Phong_LightAndShadow_encode,
        ],
    }
}

////////////////////////////////////////////////////////////////////////////////////////////////////
//defer
////////////////////////////////////////////////////////////////////////////////////////////////////

export var SHT_materialPhongFS_defer_mergeToVS: I_ShaderTemplate = {
    material: {
        owner: "PhongMaterial",
        add: [
            SHT_addMathBase,
            SHT_addMathTBN,
            // SHT_addMathRandom,
            // SHT_addPCSS,
            // SHT_add_Phong_function,
            {
                name: "fsOnput",
                code: WGSL_st_Guffer,
            },
            {
                name: "fs",
                code: phongFS,
            },

        ],
        replace: [
            {
                name: "mainColorCode",
                replace: "$mainColorCode",
                replaceType: E_shaderTemplateReplaceType.replaceCode,
                replaceCode: "",
            },
            SHT_replaceGBufferFSOutput,                                            // WGSL_replace_gbuffer_output部分
            SHT_replaceGBufferCommonValue,                                            // WGSL_replace_gbuffer_commonValues部分
            {
                name: "materialColor",
                replace: "$materialColor",           //
                replaceType: E_shaderTemplateReplaceType.value,                //   var materialColor = $materialColor              //颜色或纹理颜色
            },
            {
                name: "normal",
                replace: "$normal",           //
                replaceType: E_shaderTemplateReplaceType.value,                 //var normal =$normal                             //来自VS，还是来自texture
            },
            {
                name: "specular",
                replace: "$specular",           //
                replaceType: E_shaderTemplateReplaceType.value,                //数值，metalness
            },
            SHT_replace_Phong_LightAndShadow_encode,
        ],
    }
}