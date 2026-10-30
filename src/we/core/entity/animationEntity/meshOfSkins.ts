import { DrawCommand } from '../../command/DrawCommand';
import { E_renderPassName } from '../../scene/renderManager';
import { E_shaderRegisterAlianName } from '../../SHR/include';
import { E_entityType, IV_BaseEntity } from '../base';
import { SkinsEntity } from './skinsEntity';

export class MeshSkins extends SkinsEntity {
    constructor(input: IV_BaseEntity) {
        super(input);

        this.kind = E_entityType.mesh;
        if (input.primitive) {
            this._primitive = input.primitive;
        } else {
            this._primitive = {
                topology: 'triangle-list',
                cullMode: this._cullMode,
            };
        }
    }
    createTransparent(): void {
        throw new Error('Method not implemented.');
    }
    _destroy(): void {
        throw new Error('Method not implemented.');
    }
    override createForwardDC(): void {
        const dc = this.generateOpacityDC(E_shaderRegisterAlianName['entity.skins']) as DrawCommand;
        this.renderPassArray[E_renderPassName.forward].push(dc);
    }
}
