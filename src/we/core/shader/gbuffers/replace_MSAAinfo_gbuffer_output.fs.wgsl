//start : replace_infor_gbuffer.output.fs.wgsl 
//***GBuffer数量与内容需要人工保持正确性
    output.depth = fsInput.position.z;
    // output.color = vec4f(fsInput.color,1);
    // output.id = fsInput.entityID;
    // output.normal = vec4f(fsInput.normal, 1);
    // output.ru_ma_AO = vec4f(0,0,0, 1);
    // output.worldPosition = vec4f(fsInput.worldPosition,1);
    output.id = fsInput.entityID;
    output.normal = vec4f(fsInput.normal, 1);
    output.ru_ma_AO = vec4f(0,0,0, 1);
    output.worldPosition = vec4f(fsInput.worldPosition,1);
//end :replace_infor_gbuffer.output.fs.wgsl 
