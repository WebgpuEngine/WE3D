//system
import systemOfCameraWGSL from "../shader/system/system.wgsl?raw"
var systemOfCamera = systemOfCameraWGSL.toString();
///////////////////////////////////////////////////////////////////////////
//
/*
1、每个shader的JSON由以下部分组成
    add,                //添加shader的代码的内容
    replace,            //替换的内容
    uniform,            //uniform的内容

2、replaceType有以下类型
    value,              //替换为程序的变量
    replaceString,      //替换为字符串
    replaceCode,        //替换为WGSL代码
    selectCode,         //选择性替换代码，根据check的内容进行替换（false，true）对应数组（0,1）
*/
///////////////////////////////////////////////////////////////////////////
/**
 * add 模拟部分内容
 */
export interface I_shaderTemplateAdd {
    name: string,
    code: string,
}
/**
 * replace 模板的内容
 */
export interface I_shaderTemplateReplace {
    name: string,
    replace: string,                //替换的内容， "$lightNumber",
    replaceType: E_shaderTemplateReplaceType,            //替换的类型，value,replaceString,replaceCode,selectCode
    check?: string,                 //检查的内容，根据check的内容进行替换（false，true）对应数组（0,1）
    selectCode?: string[],          //选择性替换代码，根据check的内容进行替换（false，true）对应数组（0,1）
    replaceCode?: string,                  //替换的代码
    description?: string,            //描述
    //////////////////////////////////
    //js 数值部分
    varOfJS?: string[],              //JS中的变量，aa.bb.cc
    varOfJSCheck?: any[],             //JS中的变量的检查，根据varOfJSCheck的内容进行替换（false，true）对应器内容
}
/**
 * 替换的类型，同时包含add和replace
 */
export interface I_shaderTemplateReplaceAndAdd extends I_shaderTemplateReplace {
    /**
     * 1、增加，并包含占位符的string
     * 2、如果没有，则有material部分生成，然后进行替换占位符
     */
    code?: string,
}

/**
 * 替换的类型
 */
export enum E_shaderTemplateReplaceType {
    value,              //替换为程序的变量
    // replaceString,      //替换为字符串
    replaceCode,        //替换为WGSL代码
    selectCode,         //选择性替换代码，根据check的内容进行替换（false，true）对应数组（0,1）
    checkVarOfJS,       //检查JS的变量
}
/**
 * 单个模板的内容组成部分
 */
export interface I_singleShaderTemplate {
    add?: I_shaderTemplateAdd[],
    replace?: I_shaderTemplateReplace[],
    groupAndBinding?: I_shaderTemplateReplaceAndAdd[],
    owner?: any,
}

/**
 * 着色器模板
 * 场景、实体、材质、DCG的着色器模板
 * 其中mesh一般由entity和material两部分合成，
 *      endity部分一般包含：scene，entity，DCG
 *      material部分一般包含：material，DCG，
 * 所以，DCG可能存在两个部分，需要在DCG的部分合并，先entity，后material的
 */
export interface I_ShaderTemplate {
    [name: string]: I_singleShaderTemplate,
    // scene?: I_singleShaderTemplateWithOwner,
    // entity?: I_singleShaderTemplateWithOwner,
    // material?: I_singleShaderTemplateWithOwner,
    // DCG?: I_singleShaderTemplateWithOwner,
}

export interface I_singleShaderTemplate_Final {
    templateString: string,
    groupAndBindingString: string,
    owner: any,
    binding?: number,
    dynamic?: boolean,
}
/**
 * 最终的模板内容
 */
export interface I_ShaderTemplate_Final {
    [name: string]: I_singleShaderTemplate_Final
}
/////////////////////////////////////////////////////////////////////////////////////////
//struct 定义

import st_GufferWGSL from "../shader/gbuffers/st_gbuffer.fs.wgsl?raw";
export var WGSL_st_Guffer = st_GufferWGSL.toString();

import st_MSAA_GufferWGSL from "../shader/gbuffers/st_MSAA_gbuffer.fs.wgsl?raw";
export var WGSL_st_MSAA_Guffer = st_MSAA_GufferWGSL.toString();

import st_MSAAinfo_GufferWGSL from "../shader/gbuffers/st_MSAAinfo_gbuffer.fs.wgsl?raw";
export var WGSL_st_MSAAinfo_Guffer = st_MSAAinfo_GufferWGSL.toString();

import st_transgparentbufferWGSL from "../shader/gbuffers/st_transgparentbuffer.fs.wgsl?raw";
export var WGSL_st_transparentbuffer = st_transgparentbufferWGSL.toString();


import st_locationWGSL from "../shader/entity/st_location_ref.vs.wgsl?raw"
export var WGSL_st_location = st_locationWGSL.toString();

import st_outputWGSL from "../shader/entity/st_output.vs.wgsl?raw"
export var WGSL_st_output = st_outputWGSL.toString();

import replace_gbuffer_outputWGSL from "../shader/gbuffers/replace_gbuffer_output.fs.wgsl?raw";
export var WGSL_replace_gbuffer_output = replace_gbuffer_outputWGSL.toString();

import replace_MSAA_gbuffer_outputWGSL from "../shader/gbuffers/replace_MSAA_gbuffer_output.fs.wgsl?raw";
export var WGSL_replace_MSAA_gbuffer_output = replace_MSAA_gbuffer_outputWGSL.toString();

import replace_MSAAinfo_gbuffer_outputWGSL from "../shader/gbuffers/replace_MSAAinfo_gbuffer_output.fs.wgsl?raw";
export var WGSL_replace_MSAAinfo_gbuffer_output = replace_MSAAinfo_gbuffer_outputWGSL.toString();




///////////////////////////////////////////////////////////////////////////
//base var
//ref values

export var SHT_ScenOfCamera: I_singleShaderTemplate = {
    add: [{
        name: "system",
        code: systemOfCamera,
    }],
    replace: [
        {
            name: "lightNumber",
            replace: "$lightNumber",
            replaceType: E_shaderTemplateReplaceType.value,                        //replaceType=value,替换为程序的变量
        },
        {
            name: "shadowMapNumber",
            replace: "$lightNumberShadowNumber",
            replaceType: E_shaderTemplateReplaceType.value,
        },
        {
            name: "shadowDepthTextureSize",
            replace: "override shadowDepthTextureSize : f32 = 1024.0;",
            replaceType: E_shaderTemplateReplaceType.value,
        },
    ],
};
export var SHT_refDCG: I_singleShaderTemplate = {
    replace: [
        {
            name: "refName",                    //创建的反射的其他location，使用entity的DCG的反射location
            replace: "$st_location_ref",
            replaceType: E_shaderTemplateReplaceType.value,
            description: "创建location,使用entity的DCG的反射location到WGSL中",
        },
        {
            name: "refName",
            replace: "$position",
            replaceType: E_shaderTemplateReplaceType.selectCode,                    //replaceType="selectCode",检查是否有属性,并根据check的检查属性进行替换
            check: "position",
            /**
             * 检查是否有position属性
             * 反射属性中没有，false，使用selectCode[0]
             * 反射属性中有，true，使用selectCode[1]
             */
            selectCode: [
                " let position= vec3f(0.0,0.0,0.0); \n ",
                " let position = attributes.position; \n ",
            ],

        },
        {
            name: "refName",
            replace: "$color",
            replaceType: E_shaderTemplateReplaceType.selectCode,                    //replaceType="selectCode",检查是否有属性,并根据check的检查属性进行替换
            check: "color",
            selectCode: [
                " let color= vec3f(0.0,0.0,0.0); \n ",
                " let color = attributes.color; \n ",
            ],
        },
        {
            name: "refName",
            replace: "$normal",
            replaceType: E_shaderTemplateReplaceType.selectCode,                    //replaceType="selectCode",检查是否有属性,并根据check的检查属性进行替换
            check: "normal",
            selectCode: [
                " let normal= vec3f(0.0,0.0,0.0); \n ",
                " let normal = attributes.normal; \n ",

            ],

        },
        {
            name: "refName",
            replace: "$uv",
            replaceType: E_shaderTemplateReplaceType.selectCode,                    //replaceType="selectCode",检查是否有属性,并根据check的检查属性进行替换
            check: "uv",
            selectCode: [
                " let uv= vec2f(0.0,0.0); \n ",
                " let uv = attributes.uv; \n ",
            ],
        },
    ]
};


import deferDepthWGSL from "../shader/defer/replace_deferDepthCompare.fs.wgsl?raw";
var deferDepthFS = deferDepthWGSL.toString();

export var SHT_replaceDefer: I_shaderTemplateReplace = {
    name: "replaceDefer",
    description: "根据scene.deferRender.deferRenderDepth 判断行为",
    replace: "$deferRender_Depth",
    replaceType: E_shaderTemplateReplaceType.checkVarOfJS,
    varOfJS: ["scene", "deferRender", "deferRenderDepth"],
    varOfJSCheck: [
        { "true": deferDepthFS },
        { "false": "" }],

}

export var SHT_replaceFSOutput: I_shaderTemplateReplace =
{
    name: "colorFS.output content",
    replace: "$fsOutput",           //
    replaceType: E_shaderTemplateReplaceType.replaceCode,
    replaceCode: WGSL_replace_gbuffer_output
}


//math
import mathConstWGSL from "../shader/math/baseconst.wgsl?raw"
var mathConst = mathConstWGSL.toString();
import mathTBNWGSL from "../shader/math/TBN.wgsl?raw"
var mathTBN = mathTBNWGSL.toString();
import mathRandomWGSL from "../shader/math/random.wgsl?raw"
var mathRandom = mathRandomWGSL.toString();


export var SHT_addMathBase: I_shaderTemplateAdd = {
    name: "mathBase",
    code: mathConst,
}
export var SHT_addMathTBN: I_shaderTemplateAdd = {
    name: "mathTBN",
    code: mathTBN,
}
export var SHT_addMathRandom: I_shaderTemplateAdd = {
    name: "mathRandom",
    code: mathRandom,
}

//shadow map MVP
import systemOfLightWGSL from "../shader/system/systemForLight.wgsl?raw"
var systemOfLight = systemOfLightWGSL.toString();


export var SHT_addSystemOfLight: I_shaderTemplateAdd = {
    name: "systemOfLight",
    code: systemOfLight,
}

//PCSS
//shadow map 
import shadowmapPCSSWGSL from "../shader/shadowmap/fn_pcss.wgsl?raw"
var shadowmapPCSS = shadowmapPCSSWGSL.toString();

export var SHT_addPCSS: I_shaderTemplateAdd = {
    name: "pcss",
    code: shadowmapPCSS,
}


