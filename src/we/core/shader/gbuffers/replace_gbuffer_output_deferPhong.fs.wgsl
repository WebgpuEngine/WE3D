//start : part_replace.st_gbuffer.output.fs.wgsl //这个文件是进行GBuffer输出,使用var定义output，//输出全部的output的值，具体FS shader的输出在这个之后进行
//***GBuffer数量与内容需要人工保持正确性
    output.depth = fsInput.position.z;
    output.color = vec4f(fsInput.color,1);
    output.id = fsInput.entityID;
    output.normal = vec4f(fsInput.normal, 1);//world normal
    output.RMAO = vec4f(roughness,metallic,ao,defer_4xU8InF32);
    output.worldPosition = vec4f(fsInput.worldPosition,1);
    output.albedo = vec4f(albedo,1);
//end :part_replace.st_gbuffer.output.fs.wgsl
