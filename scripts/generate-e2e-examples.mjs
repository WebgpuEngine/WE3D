// 生成 e2e 示例清单：从 examples/ 全量递归扫描 *.html（排除 gallery index），
// 按一级子目录分组，输出到 e2e/examples-e2e.json。
// 用户后续手工裁剪为「每类一个测试 url」（事项1.3）。
import { readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const EXAMPLES = 'examples';
const OUT = 'e2e/examples-e2e.json';
const SKIP = new Set(['index.html', 'indexClaude.html']);

const result = {};

function walk(dir) {
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        const st = statSync(full);
        if (st.isDirectory()) {
            walk(full);
        } else if (entry.endsWith('.html') && !SKIP.has(entry)) {
            const rel = '/' + relative(process.cwd(), full).split('\\').join('/');
            // rel = /examples/<category>/.../file.html  -> 取 <category>
            const category = rel.split('/')[2] || 'root';
            (result[category] ||= []).push(rel);
        }
    }
}

walk(EXAMPLES);

mkdirSync('e2e', { recursive: true });
writeFileSync(OUT, JSON.stringify(result, null, 2) + '\n');

const total = Object.values(result).reduce((a, b) => a + b.length, 0);
console.log(`wrote ${OUT}: ${Object.keys(result).length} categories, ${total} urls`);
