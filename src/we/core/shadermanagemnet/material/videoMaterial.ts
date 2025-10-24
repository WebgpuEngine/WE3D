////////////////////////////////////////////////////////////////////////////////
//material
import videoTextureFSWGSL from "../../shader/material/texture/video.fs.wgsl?raw";
var videoTextureFS = videoTextureFSWGSL.toString();


import { E_shaderTemplateReplaceType, I_ShaderTemplate, SHT_replaceGBufferCommonValue, SHT_replaceGBufferFSOutput, SHT_replaceGBufferMSAA_FSOutput, SHT_replaceGBufferMSAAinfo_FSOutput, WGSL_replace_gbuffer_output, WGSL_replace_MSAA_gbuffer_output, WGSL_replace_MSAAinfo_gbuffer_output, WGSL_st_Guffer, WGSL_st_MSAA_Guffer, WGSL_st_MSAAinfo_Guffer } from "../base"

export var SHT_materialVideoTextureFS_mergeToVS: I_ShaderTemplate = {
    material: {
        owner: "ColorMaterial",
        add: [
            {
                name: "fsOnput",
                code: WGSL_st_Guffer,
            },
            {
                name: "fs",
                code: videoTextureFS,
            },

        ],
        replace: [
            //输出Gbuffer（三种，forward，msaa，msaaInfo）
            SHT_replaceGBufferFSOutput,                                            // WGSL_replace_gbuffer_output部分
            SHT_replaceGBufferCommonValue,                                            // WGSL_replace_gbuffer_commonValues部分

            //替换标识符，材质颜色，读取视频纹理
            {
                name: "materialColor",
                replace: "$materialColor",
                replaceType: E_shaderTemplateReplaceType.value,
            },
            //输出的color
            {
                name: "colorFS set color",
                replace: "$fsOutputColor",
                replaceType: E_shaderTemplateReplaceType.replaceCode,
                replaceCode: "output.color = materialColor; ",
            },
        ],

    }
}

export var SHT_materialVideoTextureFS_MSAA_mergeToVS: I_ShaderTemplate = {
    material: {
        owner: "ColorMaterial",
        add: [
            {
                name: "fsOnput",
                code: WGSL_st_MSAA_Guffer,
            },
            {
                name: "fs",
                code: videoTextureFS,
            },

        ],
        replace: [
            SHT_replaceGBufferMSAA_FSOutput,                                            // WGSL_replace_MSAA_gbuffer_output部分
            SHT_replaceGBufferCommonValue,                                            // WGSL_replace_gbuffer_commonValues部分

            //替换标识符，材质颜色，读取视频纹理
            {
                name: "materialColor",
                replace: "$materialColor",           //
                replaceType: E_shaderTemplateReplaceType.value,
            },
            {
                name: "colorFS set color",
                replace: "$fsOutputColor",           //取消设置颜色
                replaceType: E_shaderTemplateReplaceType.replaceCode,
                replaceCode: "output.color = materialColor; ",
            },
        ],

    }
}


export var SHT_materialVideoTextureFS_MSAA_info_mergeToVS: I_ShaderTemplate = {
    material: {
        owner: "ColorMaterial",
        add: [
            {
                name: "fsOnput",
                code: WGSL_st_MSAAinfo_Guffer,
            },
            {
                name: "fs",
                code: videoTextureFS,
            },

        ],
        replace: [
            SHT_replaceGBufferMSAAinfo_FSOutput,                                            // WGSL_replace_MSAAinfo_gbuffer_output部分
            SHT_replaceGBufferCommonValue,                                            // WGSL_replace_gbuffer_commonValues部分

            {
                name: "materialColor",
                replace: "$materialColor",           //
                replaceType: E_shaderTemplateReplaceType.replaceCode,
                replaceCode: "",
            },
            {
                name: "colorFS set color",
                replace: "$fsOutputColor",           //取消设置颜色
                replaceType: E_shaderTemplateReplaceType.replaceCode,
                replaceCode: "",
            },
        ],

    }
}

