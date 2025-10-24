//start : cubeLocationtexture.fs.wgsl
@fragment 
fn fs(fsInput: VertexShaderOutput) -> ST_GBuffer {    
    $gbufferCommonValues //初始化GBuffer的通用值
    initSystemOfFS();
    var output: ST_GBuffer;
    $fsOutput
    var cubemapVec =  fsInput.cubeVecUV;
    $fsOutputColor
    return output;
}
//end : cubeLocationtexture.fs.wgsl
