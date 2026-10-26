import {
    WGSL_Include,
    WGSL_Replace,
    WGSL_ShaderCode,
    WGSL_AliasShaderCode,
    T_SHR_RenderMode,
    WGSL_V_Gbuffers_output,
    WGSL_V_Gbuffers_struct,
    WGSL_reflection_attributes,
} from "./include";



export class ShaderRegister {
    /**include file path,目的统一内外部使用方式 */
    _include: Map<string, string> = new Map();

    /**replace name,目的统一内外部使用方式 */
    _replace: Map<string, string> = new Map();

    _reflection: Map<string, string> = new Map();

    /**shader code,目的统一内外部使用方式 */
    _shaderCode: Map<string, string> = new Map();

    /**alias shader code, 外部调用数据 */
    _aliasShaderCode: Map<string, string> = new Map();

    /**const override ，目的统一内外部使用方式 */
    _override: Map<string, number> = new Map();

    /**tga shader code，目前包括两个tag：gbuffers、gbuffers.output
     * 1、"gbuffers"：GBuffer struct的资源（#tag gbuffers_output ）
     * 2、"gbuffers.output"：GBuffer output的资源（#tag gbuffers_output ）
     */
    _tag: Map<string, any> = new Map();

    constructor() {
        for (const key in WGSL_Include) {
            this.addInclude(key, WGSL_Include[key]);
        }
        // for (let key in WGSL_Replace) {
        //     this.addReplace(key, WGSL_Replace[key]);
        // }
        for (const key in WGSL_ShaderCode) {
            this.addShaderCode(key, WGSL_ShaderCode[key]);
        }
        //添加gbuffers tag
        this._tag.set("gbuffers", WGSL_V_Gbuffers_struct);
        //添加gbuffers.output tag
        this._tag.set("gbuffers.output", WGSL_V_Gbuffers_output);

        //初始化alias shader code
        this.initShaderCodeAlias();
    }
    /**
     * 20260628 新增,代替在entity，materila等中使用enum部分，以确保shader code name的一定存在和一致性
     * 获取shader code
     * 1、如果是material shader code，返回material name
     * 2、如果不是material shader code，返回shader code name
     * @param name shader code name
     * @returns 
     */
    getShaderName(name: string):
        string | Record<T_SHR_RenderMode, string | undefined> {
        let hasShaderName = false;
        let shaderCodeName = "";
        const materialName: Record<T_SHR_RenderMode, string | undefined> = {
            forward: undefined,
            defer: undefined,
            Msaa: undefined,
            MsaaInfo: undefined,
            blend: undefined,
        };
        let isMaterial = false;
        if (name.includes("material.")) {
            isMaterial = true;
            if (this._aliasShaderCode.has(name + ".forword")) {
                materialName.forward = name + ".forword";
                hasShaderName = true;
            }
            if (this._aliasShaderCode.has(name + ".defer")) {
                materialName.defer = name + ".defer";
                hasShaderName = true;
            }
            if (this._aliasShaderCode.has(name + ".msaa")) {
                materialName.Msaa = name + ".msaa";
                hasShaderName = true;
            }
            if (this._aliasShaderCode.has(name + ".msaaInfo")) {
                materialName.MsaaInfo = name + ".msaaInfo";
                hasShaderName = true;
            }
            if (this._aliasShaderCode.has(name + ".blend")) {
                materialName.blend = name + ".blend";
                hasShaderName = true;
            }
        }
        else {
            if (this._aliasShaderCode.has(name)) {
                shaderCodeName = name;
                hasShaderName = true;
            }
        }
        if (hasShaderName === true) {
            if (isMaterial === true) {
                return materialName;
            }
            else {
                return shaderCodeName;
            }
        }
        else {
            throw new Error(`shader code ${name} is not found`);
        }
    }
    /**
     * 初始化alias shader code（ this._aliasShaderCode）
     */
    initShaderCodeAlias() {
        for (const key in WGSL_AliasShaderCode) {
            const perAlias = WGSL_AliasShaderCode[key];
            if (perAlias.renderMode) {
                for (const renderMode in perAlias.renderMode) {
                    let shaderCode = "";
                    if (perAlias.renderMode[renderMode as T_SHR_RenderMode] === true) {
                        shaderCode = this.formatShaderOfRenderMode(perAlias.code, renderMode as T_SHR_RenderMode);
                        this.addAliasShaderName(key + "." + renderMode, shaderCode);
                    }
                }
            }
            else {
                const shaderCode = this.formatShaderOfRenderMode(perAlias.code, undefined);
                this.addAliasShaderName(key, shaderCode);
            }
        }
    }
    /**根据renderMode格式化shader code */
    formatShaderOfRenderMode(shaderCode: string, renderMode: T_SHR_RenderMode | undefined): string {
        const lines = this.splitByLine(shaderCode);
        const newLines = [];
        let weStart = false;
        let weStartRenderMode = false;
        for (const perLine of lines) {
            const lineTrimWithOutFirstSpace = perLine.trimStart();//只删开头空格
            if (lineTrimWithOutFirstSpace.startsWith("#includeFile")) {
                let enable = false;
                if (weStart === false) {//不在weStart中
                    enable = true;
                }
                //在weStart中，且在renderMode中
                else if ((weStart && weStartRenderMode)) {//如果后续增加其他#匹配符，再追加判断
                    enable = true;
                }
                if (enable === false) {
                    continue;
                }
                const includeFile = this.splitBySpace(lineTrimWithOutFirstSpace);
                let fileName = includeFile[1].replaceAll("\"", "");
                fileName = fileName.replace("\'", "");
                newLines.push(this.getInclude(fileName));
                continue;
            }
            else if (lineTrimWithOutFirstSpace.startsWith("#reflection")) {
                //DCG 反射代码
            }
            //
            else if (lineTrimWithOutFirstSpace.startsWith("#tag")) {
                const tag = this.splitBySpace(lineTrimWithOutFirstSpace);
                //gbuffers 相关只在FS中
                if (renderMode !== undefined) {
                    if (tag[1] === "gbuffers") {
                        newLines.push(this.getTagGBuffersStruct(renderMode));
                    }
                    else if (tag[1] === "gbuffers_output") {
                        newLines.push(this.getTagGBuffersOutput(renderMode));
                    }
                }
                else {
                    newLines.push(this.getTag(tag[1]));
                }
                continue;
            }
            else if (lineTrimWithOutFirstSpace.startsWith("#weStart")) {
                weStart = true;
                weStartRenderMode = false;
                continue;
            }
            else if (lineTrimWithOutFirstSpace.startsWith("#weEnd")) {
                weStart = false;
                weStartRenderMode = false;
                continue;
            }
            else if (renderMode !== undefined && weStart === true && lineTrimWithOutFirstSpace.startsWith("#renderMode")) {
                weStartRenderMode = false;//遇到renderMode，重置weStartRenderMode=false(新的判断)
                const renderModeInLine = this.splitBySpace(lineTrimWithOutFirstSpace);
                renderModeInLine.shift();//去掉#renderMode
                for (const key of renderModeInLine) {
                    if (key === renderMode) {
                        weStartRenderMode = true;
                    }
                }
                continue;
            }
            //非weStart
            if (weStart === false) {
                newLines.push(perLine);
            }
            //  weStart && renderMode
            else if ((weStart && weStartRenderMode)) {
                newLines.push(perLine);
            }

        }
        return newLines.join("\n");
    }
    /**根据tag name获取tag code（string） */
    getTag(tagName: string): string {
        const tagCode = this._tag.get(tagName);
        if (tagCode) {
            return tagCode;
        }
        else {
            throw new Error(tagName + " not found");
        }
    }
    /**根据renderMode获取需要include的 gbuffers struct code（string） */
    getTagGBuffersStruct(renderMode: T_SHR_RenderMode): string {
        const tagCode = this._tag.get("gbuffers")[renderMode];
        if (tagCode) {
            return tagCode;
        }
        else {
            throw new Error("gbuffers not found");
        }
    }
    /**根据renderMode获取gbuffers output 结构体 code（string） */
    getTagGBuffersOutput(renderMode: T_SHR_RenderMode): string {
        const tagCode = this._tag.get("gbuffers.output")[renderMode];
        if (tagCode) {
            return tagCode;
        }
        else {
            throw new Error("gbuffers.output not found");
        }
    }
    /**添加include file path */
    addInclude(filePath: string, code: string) {
        this._include.set(filePath, code);
    }
    /**根据include file path获取include code（string） */
    getInclude(filePath: string) {
        const includeCode = this._include.get(filePath);
        if (includeCode) {
            return includeCode;
        }
        else {
            throw new Error(filePath + " not found");
        }
    }
    /**
     * 20260626 未使用，预留
     * 根据replace name获取replace code（string） 
     * 用于替换 指定的 replaceName
    */
    getReplace(replaceName: string) {
        return this._replace.get(replaceName);
    }
    /**根据replace name获取replace code（string） 
     * 1、用于替换user_shader_code
     * 2、在vs、fs编译之前调用
    */
    replaceUserShaderCode(shaderCode: string, useShaderCode: string) {
        const lines = shaderCode.split("\n");
        for (const perLine_i in lines) {
            const perLine = lines[perLine_i];
            const lineTrimWithOutFirstSpace = perLine.trimStart();//只删开头空格
            if (lineTrimWithOutFirstSpace.startsWith("#replace") && perLine.includes("user_shader_code")) {
                lines[perLine_i] = useShaderCode;
            }
        }
        return lines.join("\n");
    }
    replaceUserShaderCodeFunction(shaderCode: string, useShaderCode: string) {
        const lines = shaderCode.split("\n");
        for (const perLine_i in lines) {
            const perLine = lines[perLine_i];
            const lineTrimWithOutFirstSpace = perLine.trimStart();//只删开头空格
            if (lineTrimWithOutFirstSpace.startsWith("#replace") && perLine.includes("user_shader_function_code")) {
                lines[perLine_i] = useShaderCode;
            }
        }
        return lines.join("\n");
    }
    /**添加replace name */
    addReplace(replaceName: string, replaceCode: string) {
        this._replace.set(replaceName, replaceCode);
    }
    /**添加shader code */
    addShaderCode(registerName: string, code: string) {
        this._shaderCode.set(registerName, code);
    }
    getShaderCode(registerName: string) {
        return this._shaderCode.get(registerName);
    }
    /**添加alias shader code */
    addAliasShaderName(registerName: string, code: string) {
        this._aliasShaderCode.set(registerName, code);
    }
    /**根据registerName获取shader code */
    getAliasShaderName(registerName: string, useShaderCode: string | undefined = undefined,userShaderCodeFunction: string | undefined = undefined): string {
        let code = this._aliasShaderCode.get(registerName);
        if (code) {
            if (useShaderCode) {
                code = this.replaceUserShaderCode(code, useShaderCode);
            }
            else {
                code = this.replaceUserShaderCode(code, "");
            }
            if (userShaderCodeFunction) {
                code = this.replaceUserShaderCodeFunction(code, userShaderCodeFunction);
            }
            else {
                code = this.replaceUserShaderCodeFunction(code, "");
            }
            return code;
        }
        else {
            throw new Error(registerName + " not found");
        }
    }
    split(code: string, spriteString: string) {
        return code.split(spriteString);
    }
    splitByLine(code: string) {
        return code.split("\r\n");
    }
    splitBySpace(code: string) {
        return code.split(/\s+/).filter(Boolean);
    }
    join(lines: string[], joinString: string) {
        return lines.join(joinString);
    }
    joinByEnter(lines: string[]) {
        return this.join(lines, "\n");
    }
    ////////////////////////////////////////////////////////////////////////////////////////
    //reflection 处理
    /** 处理reflection指令，DCG调用 */
    reflection(vsCode: string, refName: string[], locations: string[]): string {
        let code = this.reflectionLocations(vsCode, refName, locations);
        code = this.reflectionAttributes(code, refName, locations);
        code = this.reflectionMorphTarget(code, refName, locations);
        return code;
    }
    /** #reflection location */
    reflectionLocations(vsCode: string, refName: string[], locations: string[]): string {
        const locationString: string = locations.join("\n");
        if (vsCode.includes("#reflection location")) {
            vsCode = vsCode.replace("#reflection location", locationString);
            return vsCode;
        }
        else {
            // throw new Error("'#reflection location' not found");
            console.log("'#reflection location' not found");
            return vsCode;
        }
    }
    /** #reflection attributes */
    reflectionAttributes(vsCode: string, refName: string[], locations: string[]): string {
        if (vsCode.includes("#reflection attributes")) {
            const addonCode: string[] = [];
            for (const i in WGSL_reflection_attributes) {
                const perOne = WGSL_reflection_attributes[i];
                if (refName.includes(i)) {
                    addonCode.push(perOne[1]);
                }
                else {
                    addonCode.push(perOne[0]);
                }
            }
            vsCode = vsCode.replace("#reflection attributes", addonCode.join("\n"));
            return vsCode;
        }
        else {
            // throw new Error("'#reflection attributes' not found");
            console.log("'#reflection attributes' not found");
            return vsCode;
        }
    }
    /** #reflection morphTarget */
    reflectionMorphTarget(vsCode: string, refName: string[], locations: string[]): string {
        if (vsCode.includes("#reflection morphTarget")) {
            const positions: string[] = [];
            for (let i = 0; i < refName.length; i++) {
                if (refName[i].indexOf("position_") != -1) {
                    positions.push("attributes." + refName[i]);
                }
            }
            const positionsString: string = positions.join(",");
            const varPositions: string = `\n var positions :array<vec3f,${positions.length}>=array(${positionsString}); \n`;
            const morphTargetCode: string = ` 
  if(u_entity_base.animation_kind == 2||u_entity_base.animation_kind == 3||u_entity_base.animation_kind == 6||u_entity_base.animation_kind == 7) {
    let count = i32(u_entity_base.morpht_target_count);
    var position_morph_target :vec3f = attributes.position;
    for(var i=0 ;i < count;i++) {
        position_morph_target += positions[i] * morph_matrix[attributes.instanceIndex * u_entity_base.morpht_target_count+ u32(i)];
    }
    worldPosition = vec4f(world_matrix[attributes.instanceIndex] * vec4f(position_morph_target, 1.0));
    vsOutput.worldPosition = worldPosition.xyz / worldPosition.w;
    vsOutput.position = matrix_z * MVP *  vec4f(worldPosition.xyz, 1.0);
   }                
        `;
            vsCode = vsCode.replace("#reflection morphTarget", varPositions + morphTargetCode);
        }
        return vsCode;
    }

}