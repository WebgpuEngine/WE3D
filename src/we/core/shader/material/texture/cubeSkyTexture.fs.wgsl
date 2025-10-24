//start : cubeSkytexture.fs.wgsl
@fragment 
fn fs(fsInput: VertexShaderOutput) -> ST_GBuffer {    
    $gbufferCommonValues //初始化GBuffer的通用值
    initSystemOfFS();
    var output: ST_GBuffer;
    $fsOutput
    var cubemapVec =  normalize(fsInput.worldPosition - defaultCameraPosition);
    $fsOutputColor
    // output.color=vec4f(1,0,0,1);
    return output;
}
//end : cubeSkytexture.fs.wgsl
