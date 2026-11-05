import { describe, it, expect, beforeEach } from 'vitest';
import { ShaderRegister } from './shaderRegister';

describe('ShaderRegister shader 合成', () => {
    let sr: ShaderRegister;

    beforeEach(() => {
        sr = new ShaderRegister();
    });

    describe('构造与别名注册', () => {
        it('注册 entity 与 material 别名', () => {
            expect(sr._aliasShaderCode.has('entity.mesh')).toBe(true);
            expect(sr._aliasShaderCode.has('entity.morphTarget')).toBe(true);
            expect(sr._aliasShaderCode.has('material.pbr.forward')).toBe(true);
            expect(sr._aliasShaderCode.has('material.pbr.defer')).toBe(true);
            expect(sr._aliasShaderCode.has('material.pbr.Msaa')).toBe(true);
            expect(sr._aliasShaderCode.has('material.pbr.blend')).toBe(true);
        });
    });

    describe('#includeFile', () => {
        it('合成后不再残留 #includeFile 指令', () => {
            const code = sr.getAliasShaderName('entity.mesh');
            expect(code).not.toContain('#includeFile');
        });
        it('include 内容被展开（struct st_entity）', () => {
            const code = sr.getAliasShaderName('entity.mesh');
            expect(code).toContain('struct st_entity');
        });
    });

    describe('#replace', () => {
        it('传入用户代码时替换 user_shader_code', () => {
            const code = sr.getAliasShaderName('entity.mesh', '// MY_CUSTOM_CODE');
            expect(code).toContain('// MY_CUSTOM_CODE');
            expect(code).not.toContain('#replace');
        });
        it('未传入时占位符被清空', () => {
            const code = sr.getAliasShaderName('entity.mesh');
            expect(code).not.toContain('#replace');
        });
    });

    describe('#weStart / #weEnd / #renderMode', () => {
        it('Msaa 模式包含 MSAA 采样逻辑', () => {
            const code = sr.getAliasShaderName('material.pbr.Msaa');
            expect(code).toContain('u_texture_normal_msaainfo');
        });
        it('forward 模式不包含 MSAA 采样逻辑', () => {
            const code = sr.getAliasShaderName('material.pbr.forward');
            expect(code).not.toContain('u_texture_normal_msaainfo');
        });
        it('不同渲染模式合成结果不同', () => {
            const forward = sr.getAliasShaderName('material.pbr.forward');
            const defer = sr.getAliasShaderName('material.pbr.defer');
            expect(forward).not.toEqual(defer);
        });
        it('合成后不再残留 #renderMode / #weStart / #weEnd', () => {
            const code = sr.getAliasShaderName('material.pbr.forward');
            expect(code).not.toContain('#renderMode');
            expect(code).not.toContain('#weStart');
            expect(code).not.toContain('#weEnd');
        });
    });

    describe('#tag gbuffers', () => {
        it('forward 模式注入 GBuffer 结构体', () => {
            const code = sr.getAliasShaderName('material.pbr.forward');
            expect(code).toContain('struct ST_GBuffer');
        });
    });

    describe('#reflection', () => {
        it('location 反射注入', () => {
            const result = sr.reflection('#reflection location', ['position'], ['@location(0) position : vec3f ,']);
            expect(result).toContain('@location(0) position : vec3f');
            expect(result).not.toContain('#reflection location');
        });
        it('attributes 反射：有属性用 attributes.x，无属性用默认值', () => {
            const result = sr.reflection('#reflection attributes', ['position'], []);
            expect(result).toContain('attributes.position');
            expect(result).toContain('let normal= vec3f(0.0,0.0,0.0)');
            expect(result).not.toContain('attributes.normal');
        });
        it('morphTarget 反射动态生成 position_* 数组', () => {
            const result = sr.reflection('#reflection morphTarget', ['position', 'position_1', 'position_2'], []);
            expect(result).toContain('array<vec3f,2>');
            expect(result).toContain('attributes.position_1');
            expect(result).toContain('attributes.position_2');
        });
    });

    describe('getShaderName 别名一致性', () => {
        it('非材质名返回字符串', () => {
            expect(sr.getShaderName('entity.mesh')).toBe('entity.mesh');
        });
        it('材质名返回 renderMode 映射', () => {
            const name = sr.getShaderName('material.color') as Record<string, string | undefined>;
            expect(name.forward).toBe('material.color.forward');
            expect(name.Msaa).toBe('material.color.Msaa');
            expect(name.MsaaInfo).toBe('material.color.MsaaInfo');
            expect(name.blend).toBe('material.color.blend');
        });
        it('不存在的名字抛错', () => {
            expect(() => sr.getShaderName('not.exist')).toThrow();
        });
    });
});
