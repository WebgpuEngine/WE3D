//start : texture.fs.wgsl
@fragment 
fn fs(fsInput: VertexShaderOutput) -> ST_GBuffer {    
    initSystemOfFS();
    var output: ST_GBuffer;
    $fsOutput
    var cubemapVec =  fsInput.cubeVecUV;
    $fsOutputColor
    return output;
}
//end : texture.fs.wgsl
