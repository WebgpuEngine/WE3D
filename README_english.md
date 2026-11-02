[Chinese](./README.md)  |    [English](./README_english.md)

# WE 3D Rendering Engine (WebGPU engine 3D)

[![npm version](https://img.shields.io/npm/v/we3d)](https://www.npmjs.com/package/we3d)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6)
![WebGPU](https://img.shields.io/badge/WebGPU-API-00A6A6)

## ✨ Key Highlights

- **Pure WebGPU native engine**: Built from the ground up with TypeScript + the WebGPU API, without any WebGL compatibility layer — oriented toward the next-generation Web graphics standard.
- **Command-set rendering architecture**: Shader submission is unified through a Draw / Compute / Copy Command set, with a clean low-level abstraction close to native WebGPU (architecture references Babylon / three.js / Cesium / UE).
- **ECS throughout the stack**: Entities, materials, light/shadow, cameras, input, animation, and textures are uniformly managed via ECS — flexible to compose and easy to extend.
- **Advanced atmosphere & clouds**: Three built-in atmosphere schemes (real-time integration / Bruneton / Hillaire) with volumetric clouds, Tyndall effects, and cloud shadows.
- **Dual volume-rendering approaches**: 3D texture sampling and real-time ray marching, covering simulation and volumetric scenarios.
- **Complete rendering features**: Forward + deferred dual pipelines, multi-channel GBuffer (56 bits per pixel), IBL + SH, PCSS soft shadows, reversed Z, MSAA / FXAA, sRGB and Display P3 color spaces.
- **GPU picking + BVH acceleration**: GPU picking by default; CPU-side ray combined with BVH and the physics engine for high-performance picking.
- **Rigorous engineering**: Vitest (Node + real-device browser) unit tests, Playwright screenshot-baseline e2e, ESLint / Prettier / Typedoc / CI gating, published to npm as ESM + `.d.ts`.

WE3D consists of two major parts: the base engine and the editor. (WE3D is currently in its early development stage, so features, modules, and structure will be adjusted frequently.)

1. The base engine includes five modules: core functionality, graphics functionality, model functionality, physics engine integration, and animation management.
This project: https://github.com/WebgpuEngine/WE3D
Current development version docs: https://WebgpuEngine.github.io/WE3D
2. npm packages
    Install via npm:
         npm i we3d
         npm i webgpu-we3d
    npm publish addresses:
        https://www.npmjs.com/package/we3d
        https://www.npmjs.com/package/webgpu-we3d
    npm published version docs: https://webgpuengine.github.io/doc
3. doing, example code: https://github.com/WebgpuEngine/example
4. doing, demo: https://github.com/WebgpuEngine/demo
5. todo, the editor part includes four modules: material editor, animation editor, scene editor, and build manager, to enable visual workflows. At [https://github.com/WebgpuEngine/editor](https://)
6. todo, in later stages WE3D will also consider reducing backend services to support server-side live links, USD, NeRF workflows, 3D reconstruction, etc., as well as AI adaptation.

# Engine Basics

* WE 3D is a web-based 3D rendering engine developed with TypeScript and the WebGPU API.
* The base engine covers scenes, entities, textures, materials, cameras, light sources, shadows, post-processing, ECS, GPU picking, AA, color space, tonemapping, deferred rendering, BVH, etc.
* Graphics functionality includes: IBL, SSGI, SSR, SSAO, etc.
* For the physics engine, Rapier is used to handle physics simulation.
* The model part involves models such as gltf, obj, fbx, etc.
* The animation management part covers: keyframes, skeletal animation, morph targets, particle systems, etc.
* The rendering engine architecture is independently designed and implemented from the ground up, referencing Babylon, three, cesium, UE, etc.
* At the low-level mechanism, shader submission is performed via a command set (Draw Command, Compute Command, Copy Command).
* On the update mechanism and event mechanism, ECS is the core mechanism along with Event handling.

# More Feature Descriptions

* Supports sRGB and Display P3 color spaces. WE3D internally works in a linear space and supports multiple color mapping output modes.
* Light sources support ambient light, directional light, point light, spot light, and area light.
* Shadow implementation is based on shadow maps and supports PCSS.
* In depth, both forward Z and reversed Z are supported; reversed Z is enabled by default.
* Supports MSAA and FXAA, with TAA planned. Currently MSAA and deferred rendering cannot be used simultaneously (this may be improved later by adding edge detection to allow simultaneous use).
* Rendering modes support forward rendering and deferred rendering; transparent object rendering supports alpha transparency and physical transparency.
* The rendering GBuffer uses multiple channels (56 bits per pixel), covering color, depth, position, normal, albedo, roughness, metallic, ao, emissive, material, id, etc.
* Entities support mesh, lines, points, sprite, and instancing, with data attributes in both array form and ArrayBuffer form with various attribute combinations.
* Models support gltf, obj, fbx, etc. (in progress). It also supports simulation data and volume rendering data, and geospatial data is planned (todo).
* Materials support simple material, Blinn-Phong, and PBR material.
* Cameras support orthographic and perspective, as well as viewport mode, multiple cameras, multiple views, etc.
* Picking supports two modes: GPU-side and CPU-side. The GPU-side picking is used by default, while the CPU-side ray function is implemented with BVH and the physics engine.
* Physics engine integration is primarily Rapier (in progress).
* The render manager internally supports multiple channels, including: compute, texture, material, render target, opaque shadow, transparent shadow, depth, MSAA, forward rendering, deferred rendering, transparent rendering, sprite, sprite transparency, toneMapping, post-processing, ui, stage, and many others. Each channel includes two working modes: content line and time line.
* Post-processing is composed of a manager and post-processing functions; currently there are FXAA, blue, colordemo, etc.
* There are four stages: the default world, ui, stage1 (navigation, etc.), stage2 (maps, etc.).
* ECS is used extensively, e.g. entities, materials, light/shadow, cameras, input management, animation, textures, etc. are all managed using the ECS concept.
* The animation system includes: keyframes, morph targets, skeletal animation, and physics-driven animation implemented via the physics engine.
* The volume rendering material has two implementation approaches: one is the 3D texture approach (3D sampling), and the other is the ray march shader approach (computed in real time).
* For the atmosphere, there are real-time integration, the Bruneton approach, and the Hillaire approach.
* Overlaid on the atmosphere are also volumetric clouds, Tyndall light effects, cloud shadows, etc.
* todo: particle system, SSGI, SSR, SSAO, TAA.

## Quick Start

Install:

```bash
npm i we3d
```

Prepare a canvas in HTML and import the engine via an ES Module:

```html
<canvas id="render"></canvas>
<script type="module" src="./main.ts"></script>
```

`main.ts` — initialize the scene, camera, and your first mesh:

```ts
import {
    initScene,
    PerspectiveCamera,
    BoxGeometry,
    ColorMaterial,
    Mesh,
} from 'we3d';

// 1. Initialize the scene (binds to <canvas id="render">)
const scene = await initScene({
    initConfig: {
        canvas: 'render',
        backgroudColor: [0, 0, 0, 1],
    },
});

// 2. Create a perspective camera (arcball controller)
const camera = new PerspectiveCamera({
    fov: (2 * Math.PI) / 5,
    aspect: scene.aspect,
    near: 0.01,
    far: 100,
    position: [0, 0, 3],
    lookAt: [0, 0, 0],
    controlType: 'arcball',
});
await scene.add(camera);

// 3. Geometry + material + mesh entity
const boxGeometry = new BoxGeometry();
const colorMaterial = new ColorMaterial({ color: [0, 0.1, 0.2, 1] });
const mesh = new Mesh({
    attributes: { geometry: boxGeometry },
    material: colorMaterial,
});
await scene.add(mesh);
```

> More runnable examples are in the "Simple Examples" section below and the [`e2e-cases/`](./e2e-cases) directory; the full API reference is in [`design/workBuddy/core/03-API速查手册.md`](./design/workBuddy/core/03-API速查手册.md).

## Feature Overview

> Status legend: ✅ implemented · 🔄 in progress · 🕓 planned (to avoid misreading planned items as delivered capabilities)

| ✅ Implemented | 🔄 In Progress | 🕓 Planned |
| --- | --- | --- |
| sRGB / Display P3, linear workflow, multi-mode toneMapping | Physics engine (Rapier) | TAA |
| Ambient / directional / point / spot light + PCSS soft shadows | gltf / obj / fbx models | SSGI / SSR / SSAO |
| Forward + deferred pipelines, multi-channel GBuffer (56 bits/pixel) | Area light | Particle system |
| IBL + SH, volume rendering (3D texture / ray march) | Physical transparency / A-Buffer | Fluid system |
| Three atmosphere schemes + volumetric clouds + Tyndall + cloud shadows | Simulation data / geospatial | Editor (material/animation/scene/build manager) |
| MSAA / FXAA, reversed Z (default) |  | Server-side live links / USD / NeRF / 3D reconstruction / AI adaptation |
| Skeletal / morph-target / keyframe / physics-driven animation |  |  |
| GPU picking + BVH, 1024 lights, full-stack ECS |  |  |

# Simple Examples

| ReversedZ                                         | material alpha blend                             | pixel level alpha transparent material           |
| ------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------- |
| ![1763628630397](images/README/1763628630397.png) | ![1763692901994](images/README/1763692901994.png) | ![1763628670056](images/README/1763628670056.png) |
| specular texture                                 | parallax texture                                  | normal texture                                    |
| ![1763628478518](images/README/1763628478518.png) | ![1763632177789](images/README/1763632177789.png) | ![1763629809872](images/README/1763629809872.png) |
| direction light +PCSS shadow                      | point light+PCSS shadow                           | spot light +PCSS shadow                           |
| ![1763628678235](images/README/1763628678235.png) | ![1763628690056](images/README/1763628690056.png) | ![1763628700051](images/README/1763628700051.png) |
| point light + parallax texture                    | viewpot                                           | PBR                                               |
| ![1763628725930](images/README/1763628725930.png) | ![1763628774853](images/README/1763628774853.png) | ![1763629421784](images/README/1763629421784.png) |
| PBR                                               | PBR+spot+shadow                                   | PBR+point light+shadow                            |
| ![1763628732926](images/README/1763628732926.png) | ![1763650026549](images/README/1763650026549.png) | ![1763650035163](images/README/1763650035163.png) |
| 1024 lights                                       | MSAA                                              | FXAA                                              |
| ![1763629587110](images/README/1763629587110.png) | ![1763630052789](images/README/1763630052789.png) | ![1763631597397](images/README/1763631597397.png) |
| post process blue 3*3                             | post process red to 1                             | deferred render: PBR                              |
| ![1763631648964](images/README/1763631648964.png) | ![1763631691112](images/README/1763631691112.png) | ![1763631752890](images/README/1763631752890.png) |
| deferred render: PBR                              | deferred render: BlinnPhong                       | deferred render: BlinnPhong                       |
| ![1763631817758](images/README/1763631817758.png) | ![1763631965740](images/README/1763631965740.png) | ![1763631975198](images/README/1763631975198.png) |
| skeleton animation                                | morph target                                      | gltf Fox skeletal animation                       |
| ![1772438077121](images/README/1772438077121.png) | ![1772438257776](images/README/1772438257776.png) | ![1772437632575](images/README/1772437632575.png) |
| gltf Hen skeletal animation                       | gltf LittlestTokyo                                | rapier demo with WE3D                             |
| ![1772470423684](images/README/1772470423684.png) | ![1782467345720](images/README/1782467345720.png) | ![1782468932611](images/README/1782468932611.png) |
| PBR+IBL+SH                                        | PBR+IBL+SH+preview wave+skybox                    | volume render 3D texture                          |
| ![1782468776687](images/README/1782468776687.png) | ![1782467363680](images/README/1782467363680.png) | ![1782467443074](images/README/1782467443074.png) |
| volume render ray march                           | atmosphere real-time integration                  | atmosphere Bruneton                               |
| ![1782608331334](images/README/1782608331334.png) | ![1783090247925](images/README/1783090247925.png) | ![1783745555533](images/README/1783745555533.png) |
| atmosphere Hillaire LUT                           | atmosphere Hillaire ray march                     | volumetric cloud                                  |
| ![1784266416463](images/README/1784266416463.png) | ![1785089949978](images/README/1785089949978.png) |                                                   |
| atmosphere + cloud                                | atmosphere + cloud + shadow                       | atmosphere + cloud + Tyndall + cloud shadow       |
|                                                   |                                                   |                                                   |
| SSAO                                              | SSGI                                              | SSR                                               |
|                                                   |                                                   |                                                   |
| simulation cloud map                              | simulation contour volume render                  | simulation streamline                             |
|                                                   |                                                   |                                                   |
| clip global                                       | clip local                                        | clip sdf                                          |
|                                                   |                                                   |                                                   |
| area light                                        | physical transparency                             | A-Buffer                                          |
|                                                   |                                                   |                                                   |
| particle system                                   | fluid system                                      |                                                   |
|                                                   |                                                   |                                                   |

## Project Structure & Development Environment

**Source organization** (core engine under [`src/we/core`](./src/we/core)):

| Module | Responsibility |
| --- | --- |
| `scene` / `organization` / `entity` | Scene, node space (ECS), entities (Mesh/Lines/Points/Sprite) |
| `command` / `commandInfo` | Draw / Compute / Copy Command set and generator (low-level rendering abstraction) |
| `material` / `texture` / `geometry` / `shaders` | Materials (PBR/BlinnPhong/Color…), textures/cube maps/HDR, geometry, WGSL |
| `camera` / `control` / `light` / `shadow` | Cameras, controllers, lights, and shadows |
| `ibl` / `gbuffers` / `postprocess` / `pickup` | IBL, deferred-render GBuffer, post-processing, GPU/CPU picking |
| `animation` / `particle` / `physics` | Keyframe/skeletal/morph-target, particles, Rapier physics |
| `atmosphere` / `SHR` | Three atmosphere schemes, spherical harmonics |
| `math` / `base` / `resources` | Math library, base types, resource/buffer management |

**Runtime requirements**:
- A WebGPU-capable browser is required (e.g. Chrome / Edge 113+, or Firefox / Safari Technology Preview with WebGPU enabled).
- Local development runs via `npm run dev` (Vite); WebGPU works under `http://localhost`. Deploying to the public internet requires **HTTPS** or `localhost`.
- Node.js is required for building / testing / documentation (see `package.json` `devDependencies` for versions).

**Roadmap**:
- Physics engine integration (Rapier), and completing gltf/obj/fbx model loading;
- Area light, physical transparency, A-Buffer;
- Global illumination (SSGI / SSR / SSAO), TAA, particle and fluid systems;
- Simulation data / geospatial data support;
- Visual editor (material / animation / scene / build manager);
- Server-side live links, USD / NeRF workflows, 3D reconstruction, AI adaptation.

# Engineering and Development Conventions

* For directory structure conventions, AI working conventions, development workflow, and release conventions, see [AGENTS.md](./AGENTS.md).
* For the engineering improvement plan (vitest / ESLint / Prettier / Playwright / CI / lib bundling), see [design/engineering-plan.md](./design/engineering-plan.md).
* For known defects and the fix roadmap, see [design/workbuddy/core/04-问题缺陷与改进建议.md](./design/workbuddy/core/04-问题缺陷与改进建议.md).
* Before committing to git, you must run the `examples/` verification (or key Playwright examples) to prevent source changes from breaking normal functionality.
* Package name `we3d`, published to npm as a lib (ESM + `.d.ts`); no web app bundling.

# References and Recommendations

* WebGPU standard: <https://www.w3.org/TR/webgpu/>
* WGSL standard: <https://www.w3.org/TR/wgsl/>
* Excellent examples: <https://github.com/webgpu/webgpu-samples>
* Google's Dawn: <https://github.com/google/dawn>
* Mozilla's wgpu: <https://github.com/gfx-rs/wgpu>
* MDN's WebGPU docs: <https://developer.mozilla.org/zh-CN/docs/Web/API/WebGPU_API>
* Great WebGPU tutorial: <https://webgpufundamentals.org/>
* Great WebGL2 tutorial: <https://webgl2fundamentals.org/>
* Great WebGL1 tutorial: <https://webglfundamentals.org/>
* Dawn's C examples: <https://github.com/samdauwe/webgpu-native-examples>
* A very practical simple JS-side graphics math library, currently the main library used: <https://github.com/greggman/wgpu-matrix>
* Another classic graphics math library: <https://github.com/toji/gl-matrix>
* WebGPU Samples <https://webgpu.github.io/webgpu-samples/>
* WebGPU API reference, handy and practical: <https://gpuweb.github.io/types/index.html>
* webgpu-utils for reference: <https://github.com/greggman/webgpu-utils>
* filament can be learned from and referenced: <https://github.com/google/filament>
* PBRT book, excellent: <https://www.pbr-book.org/>
* Ray tracing book: <https://raytracing.github.io/>
* NVIDIA books: <https://developer.nvidia.com/gpugems/gpugems/contributors>
* gltf docs <https://registry.khronos.org/glTF/specs/2.0/>
* gltf tutorials  <https://github.com/KhronosGroup/glTF-Tutorials>
* rapier [Rapier physics engine | Rapier](https://rapier.rs/)
* [Bullet Real-Time Physics Simulation](https://pybullet.org/wordpress/)  <https://pybullet.org/>
* CSS Color Module Level 4 <https://www.w3.org/TR/css-color-4/>
* Self Shadow  <https://blog.selfshadow.com/>
* Bruneton atmosphere: <https://ebruneton.github.io/precomputed_atmospheric_scattering/>
* Hillaire atmosphere approach WebGPU implementation: <https://github.com/JolifantoBambla/webgpu-sky-atmosphere>
* Sebastien Hillaire's Unreal Engine example repository, <https://github.com/sebh/UnrealEngineSkyAtmosphere>
