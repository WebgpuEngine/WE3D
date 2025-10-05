//start : part_replace.st_gbuffer.output.fs.wgsl //这个文件是进行GBuffer输出,使用var定义output，//输出全部的output的值，具体FS shader的输出在这个之后进行
//***GBuffer数量与内容需要人工保持正确性
    output.color1 = color1;
    output.color2 = color2;
    output.color3 = color3;
    output.color4 = color4;
    output.depth = depthRender;
    output.id = idRender;
    // output.id = vec4u(2);
//end :part_replace.st_gbuffer.output.fs.wgsl
