
import {
    E_shaderTemplateReplaceType,
    I_ShaderTemplate,
    I_shaderTemplateAdd,
    I_shaderTemplateReplace,
    SHT_addMathBase,
    SHT_addMathRandom,
    SHT_addMathTBN,
    SHT_addPCSS,
    SHT_replaceGBufferFSOutput,
    WGSL_replace_MSAA_gbuffer_output,
    WGSL_replace_MSAAinfo_gbuffer_output,
    WGSL_st_Guffer,
    WGSL_st_MSAA_Guffer,
    WGSL_st_MSAAinfo_Guffer
} from "../base"

import add_PBR_function_WGSL from "../../shader/material/PBR/PBRfunction.wgsl?raw"
var WGSL_add_PBR_function = add_PBR_function_WGSL.toString();
var SHT_add_PBR_function: I_shaderTemplateAdd =
{
    name: "PBR_function",
    code: WGSL_add_PBR_function
}


import PBRMaterialWGSL from "../../shader/material/PBR/PBR.fs.wgsl?raw"
var PBRFS = PBRMaterialWGSL.toString();

/**
 * PBR forward SHT。(未进行材质统一化)
 */
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
            SHT_add_PBR_function,
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
            SHT_replaceGBufferFSOutput,                                            // WGSL_replace_gbuffer_output部分
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
            //缺少alpha 透明处理
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
            SHT_add_PBR_function,
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

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//defer PBR
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
import replace_gbuffer_deferPBR_outputWGSL from "../../shader/gbuffers/replace_gbuffer_output_deferPBR.fs.wgsl?raw";
var WGSL_replace_gbuffer_deferPBR_output = replace_gbuffer_deferPBR_outputWGSL.toString();
var SHT_replaceGBufferFSOutput_deferPBR: I_shaderTemplateReplace =
{
    name: "colorFS.output content",
    replace: "$fsOutput",           //
    replaceType: E_shaderTemplateReplaceType.replaceCode,
    replaceCode: WGSL_replace_gbuffer_deferPBR_output
}


import PBR_deferMaterialWGSL from "../../shader/material/PBR/PBRdefer.fs.wgsl?raw"
var PBR_defer_FS = PBR_deferMaterialWGSL.toString();
/**
 * forward defer PBR part of forward SHT。(未进行材质统一化)
 */
export var SHT_materialPBRFS_defer_mergeToVS: I_ShaderTemplate = {
    material: {
        owner: "PhongMaterial",
        add: [
            {
                name: "fsOnput",
                code: WGSL_st_Guffer,
            },
            {
                name: "fs",
                code: PBR_defer_FS,
            },
            SHT_addMathBase,
            SHT_addMathTBN,
        ],
        replace: [
            // {
            //     name: "colorFS.output content",
            //     replace: "$fsOutput",           //
            //     replaceType: E_shaderTemplateReplaceType.replaceCode,
            //     replaceCode: WGSL_replace_gbuffer_output
            // },
            SHT_replaceGBufferFSOutput,                                            // WGSL_replace_gbuffer_output部分
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
            //缺少alpha 透明处理
        ],
    }
}
import PBR_defer_MSAA_MaterialWGSL from "../../shader/material/PBR/PBRdeferMSAA.fs.wgsl?raw"
var PBR_defer_MSAA_FS = PBR_defer_MSAA_MaterialWGSL.toString();
export var SHT_materialPBRFS_defer_MSAA_mergeToVS: I_ShaderTemplate = {
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
        ],
        replace: [
            {
                name: "colorFS.output content",
                replace: "$fsOutput",           //
                replaceType: E_shaderTemplateReplaceType.replaceCode,
                replaceCode: WGSL_replace_MSAA_gbuffer_output
            },
            // {
            //     name: "PBR_albedo",
            //     replace: "$PBR_albedo",
            //     replaceType: E_shaderTemplateReplaceType.value,
            // },
            // {
            //     name: "PBR_metallic",
            //     replace: "$PBR_metallic",
            //     replaceType: E_shaderTemplateReplaceType.value,
            // },
            // {
            //     name: "PBR_roughness",
            //     replace: "$PBR_roughness",
            //     replaceType: E_shaderTemplateReplaceType.value,
            // },
            // {
            //     name: "PBR_ao",
            //     replace: "$PBR_ao",
            //     replaceType: E_shaderTemplateReplaceType.value,
            // },
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
            //缺少alpha 透明处理
        ],
    }
}

/**Defer PBR light and shadow shader template */
export var SHT_DeferPBR: I_ShaderTemplate = {
    material: {
        owner: "Defer DC, cameraManager",
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
        ],
    }
}