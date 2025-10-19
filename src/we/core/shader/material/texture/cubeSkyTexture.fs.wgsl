//start : texture.fs.wgsl
@fragment 
fn fs(fsInput: VertexShaderOutput) -> ST_GBuffer {    
    initSystemOfFS();
    var output: ST_GBuffer;
    $fsOutput
    var cubemapVec =  normalize(fsInput.worldPosition - defaultCameraPosition);
    $fsOutputColor
    return output;
}
//end : texture.fs.wgsl
