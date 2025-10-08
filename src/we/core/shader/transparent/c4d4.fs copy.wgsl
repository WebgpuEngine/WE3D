//start : colorTT.fs.wgsl,

@fragment 
fn fs(fsInput: VertexShaderOutput) -> ST_TransParentGBuffer {    
    var output: ST_TransParentGBuffer;
    initSystemOfFS();

    
        var color: vec4f = vec4f(0,0,0,0);
        var depth: f32 = fsInput.position.z;
        let id=fsInput.entityID;      

        //1、颜色的alpha逻辑
        $Color    //输出颜色
        if(color.a>=1.0)    {
                discard; //如果颜色的a大于等于1.0， discard。
        }
        // var color1: vec4f = vec4f(0,0,0,0);

        var depthRender: vec4f = vec4f(0.0);
        // var idUniform: vec4u = vec4u(0,0,0,0);
        var idRender: vec4u = vec4u(0,0,0,0);

        //2、像素比较逻辑
         depthRender = textureLoad(u_depth, vec2i(i32(fsInput.position.x), i32(fsInput.position.y)), 0);   
         idRender = textureLoad(u_id, vec2i(i32(fsInput.position.x), i32(fsInput.position.y)), 0);

         let depth1 = depthRender.r;  //r 距离camera far
         let depth2 = depthRender.g;
         let depth3 = depthRender.b;
         let depth4 = depthRender.a;    //a near
         
        if U_MVP.reversedZ == 1 {    //是否有reveredZ
  
            if(depth > depth1 )
            {
                depthRender.a = depthRender.b;
                depthRender.b = depthRender.g;
                depthRender.g = depthRender.r;
                depthRender.r = depth;
                idRender.a=idRender.b;
                idRender.b=idRender.g;
                idRender.g=idRender.r;
                idRender.r=id;
            } 
            else if( depth > depth2)
            {
                depthRender.a = depthRender.b;
                depthRender.b = depthRender.g;
                depthRender.g = depth;
                idRender.a=idRender.b;
                idRender.b=idRender.g;
                idRender.g=id;
            }
            else if( depth > depth3)
            {
                depthRender.a = depthRender.b;
                depthRender.b = depth;
                idRender.a=idRender.b;
                idRender.b=id;
            }
            
            else if(depth >depth4)
            {
                depthRender.a = depth;
                idRender.a=id;
            }
            else
            {
                discard;
            }
            
        }
        else {
            if(depth < depth1 )
            {
                depthRender.a = depthRender.b;
                depthRender.b = depthRender.g;
                depthRender.g = depthRender.r;
                depthRender.r = depth;
                idRender.a=idRender.b;
                idRender.b=idRender.g;
                idRender.g=idRender.r;
                idRender.r=id;
            } 
            else if( depth < depth2)
            {
                depthRender.a = depthRender.b;
                depthRender.b = depthRender.g;
                depthRender.g = depth;
                idRender.a=idRender.b;
                idRender.b=idRender.g;
                idRender.g=id;
            }
            else if( depth < depth3)
            {
                depthRender.a = depthRender.b;
                depthRender.b = depth;
                idRender.a=idRender.b;
                idRender.b=id;
            }
            
            else if(depth < depth4)
            {
                depthRender.a = depth;
                idRender.a=id;
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
//end : colorTT.fs.wgsl
