
fn checkDepthOfTransparent(fsInput: VertexShaderOutput) -> bool {
    //u_camera_opacity_depth:texture_depth_2d  是uniform
    let depth = textureLoad(u_camera_opacity_depth, vec2i(i32(fsInput.position.x), i32(fsInput.position.y)), 0);//u_camera_opacity_depth是固定的
    let z = fsInput.position.z;
    if U_MVP.reversedZ == 1 {    //是否有reveredZ
        if (z> depth)
        {            //输出depth,uv,normal,id，原来的值,透明的在pickup等操作上是穿透的
            return true;
        } else {
            return false;
        }
    }
    else
    {
        if (z < depth)
        {            //输出depth,uv,normal,id，原来的值,透明的在pickup等操作上是穿透的
            return true;
        } else {
            return false;
        }
    }
}

