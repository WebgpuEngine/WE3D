//start : replace_MSAA_gbuffer.output.fs.wgsl 
//***GBuffer数量与内容需要人工保持正确性
    output.depth = depth;//fsInput.position.z;
    output.color = materialColor;//vec4f(fsInput.color,1);
//end :replace_MSAA_gbuffer.output.fs.wgsl
