import { vec3 } from "wgpu-matrix";
import {
    BaseGeometry,
    IV_Gemetry,
} from "./baseGeometry";



export interface optionSphereGeometry extends IV_Gemetry {
    radius?: number,
    widthSegments?: number,
    heightSegments?: number,
    phiStart?: number,
    phiLength?: number,
    thetaStart?: number,
    thetaLength?: number,

}

export class SphereGeometry extends BaseGeometry {



    /**box的参数 */
    parameters!: optionSphereGeometry;
    /** 计算过程中使用，应该改为私有模式，todo*/
    numberOfVertices !: number;
    /** 计算过程中使用，应该改为私有模式，todo*/
    groupStart !: number;

    constructor(input?: optionSphereGeometry) {
        const defaultValues = {
            radius: 1,
            widthSegments: 16,
            heightSegments: 16,
            phiStart: 0,
            phiLength: Math.PI * 2,
            thetaStart: 0,
            thetaLength: Math.PI * 2,
        }
        if (input == undefined) {
            input = defaultValues;
        }
        super(input);
        this.type = "SphereGeometry";
        this.parameters = {
            radius: input.radius ?? defaultValues.radius,
            widthSegments: input.widthSegments ?? defaultValues.widthSegments,
            heightSegments: input.heightSegments ?? defaultValues.heightSegments,
            phiStart: input.phiStart ?? defaultValues.phiStart,
            phiLength: input.phiLength ?? defaultValues.phiLength,
            thetaStart: input.thetaStart ?? defaultValues.thetaStart,
            thetaLength: input.thetaLength ?? defaultValues.thetaLength
        };



        // 确保heightSegments是偶数，为消除反半球用，因为/2，所以必须是偶数
        if (this.parameters.heightSegments! % 2 !== 0) {
            this.parameters.heightSegments!++;
        }
        //全球是heightSegments
        this.parameters.heightSegments! *= 2;

        this.parameters.widthSegments = Math.max(3, Math.floor(this.parameters.widthSegments as number));
        this.parameters.heightSegments = Math.max(2, Math.floor(this.parameters.heightSegments as number));
        this.init(this.parameters)
    }

    /** copy code from threejs */
    init(input: optionSphereGeometry) {

        const thetaEnd = Math.min(input.thetaStart! + input.thetaLength!, Math.PI);
        let index = 0;
        const grid = [];
        const vertex = vec3.create();
        let normal = vec3.create();
        // buffers

        // let indices = [];
        // let vertices = [];
        // let normals = [];
        // let uvs = [];
        const indices = this.buffer.indeices;
        const vertices = this.buffer.position;
        const normals = this.buffer.normal;
        const uvs = this.buffer.uv;

        const heightSegments = input.heightSegments!;
        const widthSegments = input.widthSegments!;
        const thetaStart = input.thetaStart!;
        const radius = input.radius!;
        const phiStart = input.phiStart!;
        const phiLength = input.phiLength!;
        const thetaLength = input.thetaLength!;
        // generate vertices, normals and uvs

        for (let iy = 0; iy <= heightSegments / 2; iy++) {//不计算反面的半球(除以2)

            const verticesRow = [];

            const v = iy / heightSegments;

            // special case for the poles

            let uOffset = 0;

            if (iy === 0 && thetaStart === 0) {

                uOffset = 0.5 / widthSegments;

            } else if (iy === heightSegments && thetaEnd === Math.PI) {

                uOffset = - 0.5 / widthSegments;

            }

            for (let ix = 0; ix <= widthSegments; ix++) {

                const u = ix / widthSegments;

                // vertex

                vertex[0] = - radius * Math.cos(phiStart + u * phiLength) * Math.sin(thetaStart + v * thetaLength);
                vertex[1] = radius * Math.cos(thetaStart + v * thetaLength);
                vertex[2] = radius * Math.sin(phiStart + u * phiLength) * Math.sin(thetaStart + v * thetaLength);

                vertices.push(vertex[0], vertex[1], vertex[2]);
                // console.log(iy, ix, "==========", vertex[0], vertex[1], vertex[2])
                // normal

                normal = vec3.normalize(vertex);
                normals.push(normal[0], normal[1], normal[2]);

                // uv

                uvs.push(u + uOffset, 1 - v * 2);

                verticesRow.push(index++);

            }

            grid.push(verticesRow);

        }

        // indices

        for (let iy = 0; iy < heightSegments / 2; iy++) {//不计算反面的半球(除以2)

            for (let ix = 0; ix < widthSegments; ix++) {

                const a = grid[iy][ix + 1];
                const b = grid[iy][ix];
                const c = grid[iy + 1][ix];
                const d = grid[iy + 1][ix + 1];

                // ==============================
                // 旧版（会出菱形）：webgl flat模式：默认最后一个顶点触发
                // indices.push(a, b, d);
                // indices.push(b, c, d);
                // ==============================
                // 新版（Flat 完美版）：flat 模式:webGPU 默认是first，首个顶点触发.20260427 使用 flat+either,设置没有成功(原则上可以的，原因未知)
                // indices.push(a, b, c);  // 三角 1
                // indices.push(a, c, d);  // 三角 2

                //ok,d 开始
                // if (iy !== 0 || thetaStart > 0) indices.push(d,a,b);
                // if (iy !== heightSegments - 1 || thetaEnd < Math.PI) indices.push(d,b,c);
                //ok,a 开始
                if (iy !== 0 || thetaStart > 0) indices.push(a, b, c);
                if (iy !== heightSegments - 1 || thetaEnd < Math.PI) indices.push(a, c, d);

                //webgl
                // if (iy !== 0 || thetaStart > 0) indices.push(a, b, d);
                // if (iy !== heightSegments - 1 || thetaEnd < Math.PI) indices.push(b, c, d);

            }

        }

        this.createWrieFrame();
        this._already = true;
    }



}