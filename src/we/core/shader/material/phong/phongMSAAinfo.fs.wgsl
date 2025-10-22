
//start phongMSAAinfo.fs.wgsl
struct st_bulin_phong {
  shininess: f32,
  metalness: f32,
  roughness: f32,
  parallaxScale: f32,
}

@fragment fn fs(fsInput : VertexShaderOutput) -> ST_GBuffer {
    initSystemOfFS();   
    var uv = fsInput.uv;
    var normal=fsInput.normal;
    $normal                             //来自VS，还是来自texture
    var output: ST_GBuffer;
    $fsOutput
    return output;
}
//end phongMSAAinfo.fs.wgsl
