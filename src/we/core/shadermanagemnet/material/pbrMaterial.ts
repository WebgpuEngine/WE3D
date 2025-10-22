
import {
    E_shaderTemplateReplaceType,
    I_ShaderTemplate,
    SHT_addMathBase,
    SHT_addMathRandom,
    SHT_addMathTBN,
    SHT_addPCSS,
    SHT_replaceFSOutput,
    WGSL_replace_MSAA_gbuffer_output,
    WGSL_replace_MSAAinfo_gbuffer_output,
    WGSL_st_Guffer,
    WGSL_st_MSAA_Guffer,
    WGSL_st_MSAAinfo_Guffer
} from "../base"

import PBRMaterialWGSL from "../../shader/material/PBR/PBR.fs.wgsl?raw"
var PBRFS = PBRMaterialWGSL.toString();

export var SHT_materialPBRFS_mergeToVS: I_ShaderTemplate = {
    material: {
        owner: "PhongMaterial",
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
            SHT_addMathRandom,
            SHT_addPCSS,
        ],
        replace: [
            // {
            //     name: "colorFS.output content",
            //     replace: "$fsOutput",           //
            //     replaceType: E_shaderTemplateReplaceType.replaceCode,
            //     replaceCode: WGSL_replace_gbuffer_output
            // },
            SHT_replaceFSOutput,                                            // WGSL_replace_gbuffer_output部分
            // {
            //     name: "PBR_Uniform",
            //     replace: "$PBR_Uniform",
            //     replaceType: E_shaderTemplateReplaceType.value,
            // },
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

            // SHT_replaceDefer,                                                   //延迟选用判断部分
        ],
    }
}

export var SHT_materialPBRFS_MSAA_mergeToVS: I_ShaderTemplate = {
    material: {
        owner: "PhongMaterial",
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
            SHT_addMathRandom,
            SHT_addPCSS,
        ],
        replace: [
            {
                name: "colorFS.output content",
                replace: "$fsOutput",           //
                replaceType: E_shaderTemplateReplaceType.replaceCode,
                replaceCode: WGSL_replace_MSAA_gbuffer_output
            },
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
        ],
    }
}

import PBRMaterialMSAAinfoWGSL from "../../shader/material/PBR/PBRMSAAinfo.fs.wgsl?raw"
var PBRFS_MSAAinfo = PBRMaterialMSAAinfoWGSL.toString();
export var SHT_materialPBRFS_MSAA_info_mergeToVS: I_ShaderTemplate = {
    material: {
        owner: "PhongMaterial",
        add: [
            {
                name: "fsOnput",
                code: WGSL_st_MSAAinfo_Guffer,
            },
            {
                name: "fs",
                code: PBRFS_MSAAinfo,
            },
            SHT_addMathBase,
            SHT_addMathTBN,
        ],
        replace: [
            {
                name: "colorFS.output content",
                replace: "$fsOutput",           //
                replaceType: E_shaderTemplateReplaceType.replaceCode,
                replaceCode: WGSL_replace_MSAAinfo_gbuffer_output
            },
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
            // {
            //     name: "PBR_color",
            //     replace: "$PBR_color",
            //     replaceType: E_shaderTemplateReplaceType.value,
            // },
        ],
    }
}