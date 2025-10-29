//start : replace_infor_gbuffer.output.fs.wgsl 
//***GBuffer数量与内容需要人工保持正确性
    output.depth = depth;//fsInput.position.z;
    // output.color = vec4f(fsInput.color,1);
    // output.id = fsInput.entityID;
    // output.normal = vec4f(fsInput.normal, 1);
    // output.RMAO = vec4f(0,0,0, 1);
    // output.worldPosition = vec4f(fsInput.worldPosition,1);

    output.id = entityID;//fsInput.entityID;
    output.normal = vec4f(normal, encodeU8inF32x2ToF16(emissiveRGB.r,emissiveRGB.g));
    // defer_4xU8InF16=U8ToF32(materialKind);
    // output.RMAO = vec4f(defer_4xU8InF16,RMAO);
    output.RMAO = vec4f(RMAO,encodeFromF32AndU8ToF16(emissiveRGB.b,defer_4xU8InF16));
    output.worldPosition = vec4f(worldPosition,1);
    output.albedo = vec4f(albedo,emissiveIntensity);


//end :replace_infor_gbuffer.output.fs.wgsl 
