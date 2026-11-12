import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

/**
 * 第 4 期门禁固化：ratchet 管「总量不升」，ESLint 管「新增 any 一律拦截」。
 * 下列文件是 2026-11-12 的存量债务（63 文件 / 132 处显式 any），暂时豁免。
 * 每清理完一个文件，就从本数组删除对应行；**禁止把新文件加进来**。
 * 基线由 scripts/check-code-quality.mjs 锁定（当前 explicitAny = 112）。
 */
const LEGACY_EXPLICIT_ANY_FILES = [
  'src/we/core/SHR/shaderRegister.ts',
  'src/we/core/animation/animationGroup.ts',
  'src/we/core/animation/base.ts',
  'src/we/core/animation/skin.ts',
  'src/we/core/atmosphere/atmosphere.ts',
  'src/we/core/atmosphere/base.ts',
  'src/we/core/atmosphere/hillaire/atmosphereHillaire.ts',
  'src/we/core/atmosphere/renderBase.ts',
  'src/we/core/base/coreDefine.ts',
  'src/we/core/bufferBlock/BOL.ts',
  'src/we/core/camera/baseCamera.ts',
  'src/we/core/camera/cameraPositionAndinvertVP.ts',
  'src/we/core/camera/orthographicCamera.ts',
  'src/we/core/camera/perspectiveCamera.ts',
  'src/we/core/command/BaseCommand.ts',
  'src/we/core/command/DrawCommand.ts',
  'src/we/core/command/DrawCommandGenerator.test.ts',
  'src/we/core/command/DrawCommandGenerator.ts',
  'src/we/core/command/SimpleDrawCommand.ts',
  'src/we/core/command/drawCommandGeneratorTypes.ts',
  'src/we/core/commandInfo/base.ts',
  'src/we/core/entity/baseEntity.ts',
  'src/we/core/entity/mesh/lines.ts',
  'src/we/core/entity/mesh/mesh.ts',
  'src/we/core/entity/mesh/points.ts',
  'src/we/core/entity/sprite/sprite.ts',
  'src/we/core/gbuffers/GBuffers.ts',
  'src/we/core/geometry/baseGeometry.ts',
  'src/we/core/input/baseInputControl.ts',
  'src/we/core/input/inputManager.test.ts',
  'src/we/core/input/inputManager.ts',
  'src/we/core/light/DirectionalLight.ts',
  'src/we/core/light/SpotLight.ts',
  'src/we/core/light/ambientLight.ts',
  'src/we/core/light/pointLight.ts',
  'src/we/core/material/baseMaterial.ts',
  'src/we/core/material/standard/colorMaterial.ts',
  'src/we/core/material/standard/cubeTextureMaterial.ts',
  'src/we/core/material/standard/textureMaterial.ts',
  'src/we/core/material/standard/vertexColorMaterial.ts',
  'src/we/core/material/standard/videoMaterial.ts',
  'src/we/core/material/standard/volumeMaterial.ts',
  'src/we/core/material/standard/volumeTexture3DMaterial.ts',
  'src/we/core/material/standard/wireFrameMaterial.ts',
  'src/we/core/model/BaseModel.ts',
  'src/we/core/organization/featureClass.ts',
  'src/we/core/organization/root.test.ts',
  'src/we/core/organization/root.ts',
  'src/we/core/physics/physicModel.ts',
  'src/we/core/pickup/pickup.ts',
  'src/we/core/postprocess/basePostProcess.ts',
  'src/we/core/resources/resourcesGPU.ts',
  'src/we/core/scene/renderManager.ts',
  'src/we/core/scene/rootManager.ts',
  'src/we/core/texture/base.ts',
  'src/we/core/texture/baseTexture.ts',
  'src/we/core/texture/defaultCubeTexture.ts',
  'src/we/core/texture/defaultTexture.ts',
  'src/we/core/texture/texture.ts',
  'src/we/core/texture/videoTexture.ts',
  'src/we/model/gltf/gltf.ts',
  'src/we/model/gltf/gltfTransformContract.browser.test.ts',
  'src/we/model/simple/utils.ts',
];

export default tseslint.config(
  {
    ignores: [
      'examples/**',
      'e2e-cases/**',
      'docs/**',
      'node_modules/**',
      'dist/**',
      'coverage/**',
      'test-results/**',
      '**/*.wgsl',
      '**/stanfordDragonData.ts',
      'public/**',
      'doc/**',
      'scripts/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    files: ['src/we/**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
      // 第 4 期：硬规则落地。新增 any / @ts-ignore 一律报错，存量见下方 overrides。
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/ban-ts-comment': 'error',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-namespace': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-unused-expressions': 'off',
      'no-empty': 'off',
      'no-constant-condition': ['error', { checkLoops: false }],
    },
  },
  {
    // 存量债务豁免：仅这些文件允许显式 any；ratchet 仍锁定总量不升。
    // 新文件不在名单内 → 新增 any 直接 lint 失败。逐期清理后从数组删除。
    files: LEGACY_EXPLICIT_ANY_FILES,
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    // Playwright e2e 规格与配置：测试文件允许 any（如 window 断言）
    files: ['tests/e2e/**/*.ts', 'playwright.config.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  }
);
