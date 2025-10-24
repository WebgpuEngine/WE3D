
import { E_shaderTemplateReplaceType, I_ShaderTemplate, SHT_addMathBase, SHT_addMathRandom, SHT_addMathTBN, SHT_addPCSS, SHT_replaceDefer, SHT_replaceGBufferCommonValue, SHT_replaceGBufferFSOutput, WGSL_replace_gbuffer_output, WGSL_replace_MSAA_gbuffer_output, WGSL_replace_MSAAinfo_gbuffer_output, WGSL_st_Guffer, WGSL_st_MSAA_Guffer, WGSL_st_MSAAinfo_Guffer } from "../base"

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
            // SHT_replaceDefer,                                                   //延迟选用判断部分
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
            // SHT_replaceDefer,                                                   //延迟选用判断部分
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
            {
                name: "fsOnput",
                code: WGSL_st_MSAAinfo_Guffer,
            },
            {
                name: "fs",
                code: phongMSAAinfoFS,
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

        ],
    }
}