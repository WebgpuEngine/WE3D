
export function    createWrieFrame(position: number[], indeices: number[]) {
        const list: { [name: string]: number[] } = {};
        if (indeices.length == 0) {
            let i_index = 0;
            for (let i = 0; i < position.length / 3; i++) {
                list[i_index++] = [i, i + 1];
                list[i_index++] = [i + 1, i + 2];
                list[i_index++] = [i + 2, i];

            }
        }
        else {
            for (let i = 0; i < indeices.length; i += 3) {
                const A = indeices[i];
                const B = indeices[i + 1];
                const C = indeices[i + 2];
                const AB = [A, B].sort().toString();
                const BC = [B, C].sort().toString();
                const CA = [C, A].sort().toString();
                list[AB] = [A, B];
                list[BC] = [B, C];
                list[CA] = [C, A];
            }
        }
        const indeicesWireframe: number[] = [];
        for (const i in list) {
            indeicesWireframe.push(list[i][0], list[i][1]);
        }
        return indeicesWireframe;
    }