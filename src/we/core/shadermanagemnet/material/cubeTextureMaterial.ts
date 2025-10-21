////////////////////////////////////////////////////////////////////////////////
//material
import { E_shaderTemplateReplaceType, I_ShaderTemplate, WGSL_replace_gbuffer_output, WGSL_replace_MSAA_gbuffer_output, WGSL_replace_MSAAinfo_gbuffer_output, WGSL_st_Guffer, WGSL_st_MSAA_Guffer, WGSL_st_MSAAinfo_Guffer } from "../base"


import cubeSKyTextureFSWGSL from "../../shader/material/texture/cubeSkyTexture.fs.wgsl?raw";
var cubeSkyTextureFS = cubeSKyTextureFSWGSL.toString();
/**天空盒类的，与观察位置相关的 */
export var SHT_materialCubeSkyTextureFS_mergeToVS: I_ShaderTemplate = {
    material: {
        owner: "ColorMaterial",
        add: [
            {
                name: "fsOnput",
                code: WGSL_st_Guffer,
            },
            {
                name: "fs",
                code: cubeSkyTextureFS,
            },
        ],
        replace: [
            {
                name: "colorFS.output content",
                replace: "$fsOutput",
                replaceType: E_shaderTemplateReplaceType.replaceCode,
                replaceCode: WGSL_replace_gbuffer_output
            },
            //判断是否有output.color 输入(MSAA info 没有)
            {
                name: "output.color",
                replace: "$fsOutputColor",
                replaceType: E_shaderTemplateReplaceType.replaceCode,
                replaceCode: `output.color = textureSample(u_cubeTexture, u_Sampler, cubemapVec); \n`,
            },
        ],
    }
}
export var SHT_materialCubeSkyTextureFS_MSAA_mergeToVS: I_ShaderTemplate = {
    material: {
        owner: "ColorMaterial",
        add: [
            {
                name: "fsOnput",
                code: WGSL_st_MSAA_Guffer,
            },
            {
                name: "fs",
                code: cubeSkyTextureFS,
            },
        ],
        replace: [
            {
                name: "colorFS.output content",
                replace: "$fsOutput",
                replaceType: E_shaderTemplateReplaceType.replaceCode,
                replaceCode: WGSL_replace_MSAA_gbuffer_output
            },
            //判断是否有output.color 输入(MSAA info 没有)
            {
                name: "output.color",
                replace: "$fsOutputColor",
                replaceType: E_shaderTemplateReplaceType.replaceCode,
                replaceCode: `output.color = textureSample(u_cubeTexture, u_Sampler, cubemapVec); \n`,
            },
        ],
    }
}
export var SHT_materialCubeSkyTextureFS_MSAAinfo_mergeToVS: I_ShaderTemplate = {
    material: {
        owner: "ColorMaterial",
        add: [
            {
                name: "fsOnput",
                code: WGSL_st_MSAAinfo_Guffer,
            },
            {
                name: "fs",
                code: cubeSkyTextureFS,
            },
        ],
        replace: [
            {
                name: "colorFS.output content",
                replace: "$fsOutput",
                replaceType: E_shaderTemplateReplaceType.replaceCode,
                replaceCode: WGSL_replace_MSAAinfo_gbuffer_output
            },
            //判断是否有output.color 输入(MSAA info 没有)
            {
                name: "output.color",
                replace: "$fsOutputColor",
                replaceType: E_shaderTemplateReplaceType.replaceCode,
                replaceCode: "",
            },
        ],
    }
}
import cubePositionTextureFSWGSL from "../../shader/material/texture/cubeLocalTexture.fs.wgsl?raw";
var cubePositionTextureFS = cubePositionTextureFSWGSL.toString();
/** cube 位置纹理类的，与观察位置无关的 */
export var SHT_materialCubePositionTextureFS_mergeToVS: I_ShaderTemplate = {
    material: {
        owner: "ColorMaterial",
        add: [
            {
                name: "fsOnput",
                code: WGSL_st_Guffer,
            },
            {
                name: "fs",
                code: cubePositionTextureFS,
            },

        ],
        replace: [
            {
                name: "colorFS.output content",
                replace: "$fsOutput",           //
                replaceType: E_shaderTemplateReplaceType.replaceCode,
                replaceCode: WGSL_replace_gbuffer_output
            },
            //判断是否有output.color 输入(MSAA info 没有)
            {
                name: "output.color",
                replace: "$fsOutputColor",
                replaceType: E_shaderTemplateReplaceType.replaceCode,
                replaceCode: `output.color = textureSample(u_cubeTexture, u_Sampler, cubemapVec); \n`,
            },
        ],

    }
}

export var SHT_materialCubePositionTextureFS_MSAA_mergeToVS: I_ShaderTemplate = {
    material: {
        owner: "ColorMaterial",
        add: [
            {
                name: "fsOnput",
                code: WGSL_st_MSAA_Guffer,
            },
            {
                name: "fs",
                code: cubePositionTextureFS,
            },
        ],
        replace: [
            {
                name: "colorFS.output content",
                replace: "$fsOutput",           //
                replaceType: E_shaderTemplateReplaceType.replaceCode,
                replaceCode: WGSL_replace_MSAA_gbuffer_output
            },
            //判断是否有output.color 输入(MSAA info 没有)
            {
                name: "output.color",
                replace: "$fsOutputColor",
                replaceType: E_shaderTemplateReplaceType.replaceCode,
                replaceCode: `output.color = textureSample(u_cubeTexture, u_Sampler, cubemapVec); \n`,
            },
        ],
    }
}
export var SHT_materialCubePositionTextureFS_MSAAinfo_mergeToVS: I_ShaderTemplate = {
    material: {
        owner: "ColorMaterial",
        add: [
            {
                name: "fsOnput",
                code: WGSL_st_MSAAinfo_Guffer,
            },
            {
                name: "fs",
                code: cubePositionTextureFS,
            },
        ],
        replace: [
            {
                name: "colorFS.output content",
                replace: "$fsOutput",           //
                replaceType: E_shaderTemplateReplaceType.replaceCode,
                replaceCode: WGSL_replace_MSAAinfo_gbuffer_output
            },
            //判断是否有output.color 输入(MSAA info 没有)
            {
                name: "output.color",
                replace: "$fsOutputColor",
                replaceType: E_shaderTemplateReplaceType.replaceCode,
                replaceCode: "",
            },
        ],
    }
}