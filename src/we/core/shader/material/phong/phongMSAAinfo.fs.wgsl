
//start phongMSAAinfo.fs.wgsl
struct st_bulin_phong {
  shininess: f32,
  metalness: f32,
  roughness: f32,
  parallaxScale: f32,
}

@fragment fn fs(fsInput : VertexShaderOutput) -> ST_GBuffer {
    $gbufferCommonValues //初始化GBuffer的通用值

    initSystemOfFS();   

    $normal                             //来自VS，还是来自texture
    var output: ST_GBuffer;
    $fsOutput
    return output;
}
//end phongMSAAinfo.fs.wgsl
