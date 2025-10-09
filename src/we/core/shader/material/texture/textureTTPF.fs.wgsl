//start : textureTTPF.fs.wgsl
    var materialColor=textureSample(u_colorTexture, u_Sampler, fsInput.uv );
    //如果有alpha，按照input规则输出，按照图像原始数据处理，否则 discard（这里的透明也写深度）
    if($materialColorRule)
    {
        discard;
    }
    $opacityPercent  
    color=materialColor;
//end : textureTTPF.fs.wgsl
