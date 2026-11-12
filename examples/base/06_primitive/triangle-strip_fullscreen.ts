import { DrawCommandGenerator, IV_DrawCommandGenerator, IV_DC, type IV_Scene, Scene } from '@we3d';

declare global {
  interface Window {
    scene: any
    DC: any
  }
}
let input: IV_Scene = { canvas: "render", reversedZ: false ,modeNDC:true}
let scene = new Scene(input);
await scene._init();

window.scene = scene;

// scene.requestAnimationFrame();
//这里color输出乘以了0.16,为了区别表现
let shader = `   

  @vertex fn vs(@builtin(vertex_index) vertexIndex: u32) -> @builtin(position)  vec4f {
    let pos = array(
            vec2f( -1.0,  -1.0),  // bottom left
            vec2f( 1.0,  -1.0),  // top left
            vec2f( -1.0,  1.0),  // top right
            vec2f( 1.0,  1.0),  // bottom right
            );
    return vec4f(pos[vertexIndex], 0.0, 1.0);
   }

 @fragment fn fs(@builtin(position) pos: vec4f ) -> @location(0) vec4f {
        // return vec4f(1,1,0,1);
        return normalize(pos);
  }
`;
//====================================================

let rpd = scene.getRenderPassDescriptorForNDC();

let valueDC: IV_DC = {
  label: "dc0",
  data: {
  },
  render: {
    vertex: {
      code: shader,
      entryPoint: "vs",
    },
    fragment: {
      entryPoint: "fs",
      targets: [{ format: scene.colorFormatOfLinearSpace }],
      aliasName: "test NDC",
    },
    drawMode: {
      vertexCount: 4
    },
    depthStencil:  scene.depthMode.depthStencil,
    primitive: {
      topology: "triangle-strip",
    },

  },
  renderPassDescriptor: rpd,
};
//====================================================
let inputDC: IV_DrawCommandGenerator = {
  scene: scene
}
let DCManager = new DrawCommandGenerator(inputDC);
let dc0 = DCManager.generateDrawCommand(valueDC);
scene.BPC.update(scene.clock);
scene.memoryBlockManager.update(scene.clock);
dc0.submit()
scene.renderToSurface();
