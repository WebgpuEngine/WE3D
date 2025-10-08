//start : colorTT.fs.wgsl,
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


@fragment 
fn fs(fsInput: VertexShaderOutput) -> ST_TransParentGBuffer {    
    var output: ST_TransParentGBuffer;
    let isTransparent = checkDepthOfTransparent(fsInput);
        initSystemOfFS();

    //检查是否在不透明颜色之前    
    if(isTransparent)//u_camera_opacity_depth是固定的
    {      
        var color: vec4f = vec4f(0,0,0,0);
        var depth: f32 = fsInput.position.z;
        let id=fsInput.entityID;

        //1、颜色的alpha逻辑
        $Color    //输出颜色
        if(color.a>=1.0)    {
                discard; //如果颜色的a大于等于1.0， discard。
        }
        var color1: vec4f = vec4f(0,0,0,0);
        var color2: vec4f = vec4f(0,0,0,0);
        var color3: vec4f = vec4f(0,0,0,0);
        var color4: vec4f = vec4f(0,0,0,0);
        var depthRender: vec4f = vec4f(0.0);
        var idRender: vec4u = vec4u(0,0,0,0);

        //2、像素比较逻辑
         color1 = textureLoad(u_color1, vec2i(i32(fsInput.position.x), i32(fsInput.position.y)), 0);
         color2 = textureLoad(u_color2, vec2i(i32(fsInput.position.x), i32(fsInput.position.y)), 0);
         color3 = textureLoad(u_color3, vec2i(i32(fsInput.position.x), i32(fsInput.position.y)), 0);
         color4 = textureLoad(u_color4, vec2i(i32(fsInput.position.x), i32(fsInput.position.y)), 0);

         depthRender = textureLoad(u_depth, vec2i(i32(fsInput.position.x), i32(fsInput.position.y)), 0);   
         idRender = textureLoad(u_id, vec2i(i32(fsInput.position.x), i32(fsInput.position.y)), 0);

         
        if U_MVP.reversedZ == 1 {    //是否有reveredZ
  
            if(depth >  depthRender.a )
            {
                color1 = color2;
                color2 = color3;
                color3 = color4;
                color4 = color;

                depthRender.r = depthRender.g;
                depthRender.g = depthRender.b;
                depthRender.b = depthRender.a;
                depthRender.a = depth;

                idRender.r=idRender.g;
                idRender.g=idRender.b;
                idRender.b=idRender.a;
                idRender.a=id;
            }   
            else if( depth >depthRender.b)
            {
                color1 = color2;
                color2 = color3;
                color3 = color;
                depthRender.r = depthRender.g;
                depthRender.g = depthRender.b;
                depthRender.b = depth;
                
                idRender.r=idRender.g;
                idRender.g=idRender.b;
                idRender.b=id;
            }
            else if(depth > depthRender.g)
            {
                color1 = color2;
                color2 = color;

                depthRender.r = depthRender.g;
                depthRender.b = depth;

                idRender.r=idRender.g;
                idRender.g=id;
            }
   
            else if( depth >depthRender.r)
            {
                color1 = color;
                depthRender.r = depth;
                idRender.r=id;
            }
            else
            {
                discard;
            }
            
        }
        else {
            if(depth <  depthRender.a )
            {
                color1 = color2;
                color2 = color3;
                color3 = color4;
                color4 = color;

                depthRender.r = depthRender.g;
                depthRender.g = depthRender.b;
                depthRender.b = depthRender.a;
                depthRender.a = depth;

                idRender.r=idRender.g;
                idRender.g=idRender.b;
                idRender.b=idRender.a;
                idRender.a=id;
            }   
            else if( depth < depthRender.b)
            {
                color1 = color2;
                color2 = color3;
                color3 = color;
                depthRender.r = depthRender.g;
                depthRender.g = depthRender.b;
                depthRender.b = depth;
                
                idRender.r=idRender.g;
                idRender.g=idRender.b;
                idRender.b=id;
            }
            else if(depth < depthRender.g)
            {
                color1 = color2;
                color2 = color;

                depthRender.r = depthRender.g;
                depthRender.b = depth;

                idRender.r=idRender.g;
                idRender.g=id;
            }
   
            else if( depth < depthRender.r)
            {
                color1 = color;
                depthRender.r = depth;
                idRender.r=id;
            }
            else
            {
                discard;
            }

        }
       

        
        // 输出工作
        //输出替换
        $fsOutput
        return output;
    }
    else
    {
        discard;
    }
     return output;

}
//end : colorTT.fs.wgsl
