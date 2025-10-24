//start : wireFrame.fs.wgsl
@fragment 
fn fs(fsInput: VertexShaderOutput) -> ST_GBuffer {    
    $gbufferCommonValues //初始化GBuffer的通用值
    initSystemOfFS();
    var output: ST_GBuffer;
    $fsOutput
    $fsOutputColor    
    let scaleOffset=0.00001;
    let offsetWorld = max(scaleOffset, distance(fsInput.worldPosition.xyz, U_MVP.cameraPosition) * offsetOfWireframeVale*scaleOffset*scaleOffset);
    // let offsetWorld = max(scaleOffset,pow(scaleOffset,distance(fsInput.worldPosition.xyz, U_MVP.cameraPosition) * offsetOfWireframeVale));

    if(U_MVP.reversedZ ==1)
    {
        output.depth = fsInput.position.z + offsetWorld ;
    }
    else {
        output.depth = fsInput.position.z - offsetWorld;
    } 
    return output;
}
//end : wireFrame.fs.wgsl
