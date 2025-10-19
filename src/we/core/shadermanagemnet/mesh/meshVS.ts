import { E_shaderTemplateReplaceType, I_ShaderTemplate, SHT_addSystemOfLight, SHT_ScenOfCamera, WGSL_st_location, WGSL_st_output } from "../base";

//entity
import meshMainWGSL from "../../shader/entity/mesh/main.vs.wgsl?raw"
var meshMain = meshMainWGSL.toString();

import st_entityWGSL from "../../shader/entity/st_entity.vs.wgsl?raw"
var st_entity = st_entityWGSL.toString();

import replace_meshoutputWGSL from "../../shader/entity/mesh/replace_output.vs.wgsl?raw"
var replace_meshoutput = replace_meshoutputWGSL.toString();

/** Mesh SHT */
export var SHT_MeshVS: I_ShaderTemplate = {
    scene: SHT_ScenOfCamera,
    entity: {
        add: [
            {
                name: "st_output",
                code: WGSL_st_output,
            },
            {
                name: "st_location",            //创建location，使用entity的DCG的反射location
                code: WGSL_st_location,              //mesh,line,point都是一个结构体
            },
            {
                name: "st_entity",
                code: st_entity,
            },
            {
                name: "vs",
                code: meshMain,
            },

        ],
        replace: [
            {
                name: "st_output",
                replace: "$vsOutput",
                replaceType: E_shaderTemplateReplaceType.replaceCode,
                replaceCode: replace_meshoutput,
            },
            {
                name: "st_entity",
                replace: "$instacnce",
                replaceType: E_shaderTemplateReplaceType.value,
                // replaceCode: replace_meshoutput,
            },
            {
                name: "userCodeVS",
                replace: "$userCodeVS",         //这个是meshMain中的占位符$userCodeVS
                replaceType: E_shaderTemplateReplaceType.replaceCode,
                replaceCode: "",                       //这里将被用户自定义代码替换,code将会替换replace；如果code="",默认情况,即没有用户自定义代码
            }],
    },
};

/**Mesh shadow map SHT */
export var SHT_MeshShadowMapVS: I_ShaderTemplate = {
   
    entity: {
        add: [
            SHT_addSystemOfLight,
            {
                name: "st_output",
                code: WGSL_st_output,
            },
            {
                name: "st_location",            //创建location，使用entity的DCG的反射location
                code: WGSL_st_location,              //mesh,line,point都是一个结构体
            },
            {
                name: "st_entity",
                code: st_entity,
            },
            {
                name: "vs",
                code: meshMain,
            },

        ],
        replace: [
            {
                name: "st_output",
                replace: "$vsOutput",
                replaceType: E_shaderTemplateReplaceType.replaceCode,
                replaceCode: replace_meshoutput,
            },
            {
                name: "st_entity",
                replace: "$instacnce",
                replaceType: E_shaderTemplateReplaceType.value,
                // replaceCode: replace_meshoutput,
            },
            {
                name: "userCodeVS",
                replace: "$userCodeVS",         //这个是meshMain中的占位符$userCodeVS
                replaceType: E_shaderTemplateReplaceType.replaceCode,
                replaceCode: "",                       //这里将被用户自定义代码替换,code将会替换replace；如果code="",默认情况,即没有用户自定义代码
            }],
    },
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

import wireFrameWGSL from "../../shader/entity/mesh/wireframe.vs.wgsl?raw"
var wireFrameMain = wireFrameWGSL.toString();
/**Mesh wireframe SHT */
export var SHT_MeshWireframeVS: I_ShaderTemplate = {
    scene: SHT_ScenOfCamera,
    entity: {
        add: [
            {
                name: "st_output",
                code: WGSL_st_output,
            },
            {
                name: "st_location",
                code: WGSL_st_location,
            },
            {
                name: "st_entity",
                code: st_entity,
            },
            {
                name: "vs",
                code: wireFrameMain,
            },

        ],
        replace: [
            {
                name: "st_output",
                replace: "$vsOutput",
                replaceType: E_shaderTemplateReplaceType.replaceCode,
                replaceCode: replace_meshoutput,
            },
            {
                name: "st_entity",
                replace: "$instacnce",
                replaceType: E_shaderTemplateReplaceType.value,
            },
            {
                name: "userCodeVS",
                replace: "$userCodeVS",
                replaceType: E_shaderTemplateReplaceType.replaceCode,
                replaceCode: "",
            }],
    },
};
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
import lineMainWGSL from "../../shader/entity/line/main.vs.wgsl?raw";
var lineMain = lineMainWGSL.toString();
export var SHT_LineVS: I_ShaderTemplate = {
    scene: SHT_ScenOfCamera,
    entity: {
        add: [
            {
                name: "st_output",
                code: WGSL_st_output,
            },
            {
                name: "st_location",
                code: WGSL_st_location,
            },
            {
                name: "st_entity",
                code: st_entity,
            },
            {
                name: "vs",
                code: lineMain,
            },

        ],
        replace: [
            {
                name: "st_output",
                replace: "$vsOutput",
                replaceType: E_shaderTemplateReplaceType.replaceCode,
                replaceCode: replace_meshoutput,
            },
            {
                name: "st_entity",
                replace: "$instacnce",
                replaceType: E_shaderTemplateReplaceType.value,
                // replaceCode: replace_meshoutput,
            },
            {
                name: "userCodeVS",
                replace: "$userCodeVS",
                replaceType: E_shaderTemplateReplaceType.replaceCode,
                replaceCode: "",
            }],

    },
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export var SHT_PointVS: I_ShaderTemplate = {
    scene: SHT_ScenOfCamera,
    entity: {
        add: [
            {
                name: "st_output",
                code: WGSL_st_output,
            },
            {
                name: "st_location",
                code: WGSL_st_location,
            },
            {
                name: "st_entity",
                code: st_entity,
            },
            {
                name: "vs",
                code: meshMain,             //这里使用的是meshMain，后期适配为point的
            },

        ],
        replace: [
            {
                name: "st_output",
                replace: "$vsOutput",
                replaceType: E_shaderTemplateReplaceType.replaceCode,
                replaceCode: replace_meshoutput,
            },
            {
                name: "st_entity",
                replace: "$instacnce",
                replaceType: E_shaderTemplateReplaceType.value,
            },
            {
                name: "userCodeVS",
                replace: "$userCodeVS",
                replaceType: E_shaderTemplateReplaceType.replaceCode,
                replaceCode: "",
            }],

    },
}

import pointEmuSpriteWGSL from "../../shader/entity/point/mainSprite.vs.wgsl?raw"
var pointEmuSpriteMain = pointEmuSpriteWGSL.toString();

export var SHT_PointEmuSpriteVS: I_ShaderTemplate = {
    scene: SHT_ScenOfCamera,
    entity: {
        add: [
            {
                name: "st_output",
                code: WGSL_st_output,
            },
            {
                name: "st_location",
                code: WGSL_st_location,
            },
            {
                name: "st_entity",
                code: st_entity,
            },
            {
                name: "vs",
                code: pointEmuSpriteMain,             //这里使用的是meshMain，后期适配为point的
            },

        ],
        replace: [
            {
                name: "st_output",
                replace: "$vsOutput",
                replaceType: E_shaderTemplateReplaceType.replaceCode,
                replaceCode: replace_meshoutput,
            },
            {
                name: "st_entity",
                replace: "$instacnce",
                replaceType: E_shaderTemplateReplaceType.value,
            },
            {
                name: "userCodeVS",
                replace: "$userCodeVS",
                replaceType: E_shaderTemplateReplaceType.replaceCode,
                replaceCode: "",
            }],

    },
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
import oneCubeColorWGSL from "../../shader/entity/mesh/oneColorCube.vs.wgsl?raw"
var oneCubeColor = oneCubeColorWGSL.toString();

export var SHT_OneCubeColorVS: I_ShaderTemplate = {
    scene: SHT_ScenOfCamera,
    entity: {
        add: [
            {
                name: "st_output",
                code: WGSL_st_output,
            },
            {
                name: "st_location",
                code: WGSL_st_location,
            },
            {
                name: "st_entity",
                code: st_entity,
            },
            {
                name: "vs",
                code: oneCubeColor,             //这里使用的是meshMain，后期适配为point的
            },

        ],
        replace: [
            {
                name: "st_output",
                replace: "$vsOutput",
                replaceType: E_shaderTemplateReplaceType.replaceCode,
                replaceCode: replace_meshoutput,
            },
            {
                name: "st_entity",
                replace: "$instacnce",
                replaceType: E_shaderTemplateReplaceType.value,
            },
            {
                name: "userCodeVS",
                replace: "$userCodeVS",
                replaceType: E_shaderTemplateReplaceType.replaceCode,
                replaceCode: "",
            }],

    },
}