/**
 * 自动探测 e2e-cases/ 下的测试页面（取代旧的静态清单 + 多级目录树）。
 *
 * - e2e-cases/ 下为一级目录（节点，仅一层），如 e2e-cases/geometry/
 * - 每个一级目录下直接放置 *.html 测试页，完整 url = /e2e-cases/<目录>/<文件>.html
 * - 运行期用 Node fs 扫描，无需维护静态清单，也无需显式指定 html
 */

import { readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface E2ETarget {
    /** 一级目录名（节点），如 geometry */
    dir: string;
    /** html 文件名，如 box.html */
    file: string;
    /** 去掉 .html 的可读名，如 box */
    name: string;
    /** 完整 url，如 /e2e-cases/geometry/box.html */
    url: string;
}

// 相对本文件定位仓库根的 e2e-cases/ 目录（tests/e2e/examples-e2e.ts -> ../../e2e-cases）
const E2E_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'e2e-cases');

function scan(root: string): E2ETarget[] {
    const targets: E2ETarget[] = [];
    for (const entry of readdirSync(root)) {
        const dirPath = join(root, entry);
        if (!statSync(dirPath).isDirectory()) continue;
        // 仅一层：直接读该目录下的 *.html，不再递归子目录
        for (const file of readdirSync(dirPath)) {
            if (!file.endsWith('.html')) continue;
            targets.push({
                dir: entry,
                file,
                name: file.replace(/\.html$/, ''),
                url: `/e2e-cases/${entry}/${file}`,
            });
        }
    }
    return targets.sort((a, b) => `${a.dir}/${a.file}`.localeCompare(`${b.dir}/${b.file}`));
}

export const e2eTargets: E2ETarget[] = scan(E2E_ROOT);
