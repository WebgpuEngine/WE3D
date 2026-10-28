import { readdir, stat, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

/**
 * 生成 e2e-cases/index.html 索引页。
 *
 * 约定与 Playwright 扫描器（tests/e2e/examples-e2e.ts）保持一致：
 * - e2e-cases/ 下为一级目录（节点），每个一级目录下直接放置 *.html 测试页。
 * - 完整 url = /e2e-cases/<目录>/<文件>.html（由 vite dev 服务器 localhost:5173 提供）。
 * - index.html 自身不纳入列表。
 *
 * 用途：为 e2e 用例的人工开发与手动正确性测试提供可点击访问入口。
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const E2E_ROOT = join(__dirname, '..', 'e2e-cases');
const OUTPUT = join(E2E_ROOT, 'index.html');

async function scan(root) {
    const groups = [];
    const entries = await readdir(root);
    for (const entry of entries) {
        const dirPath = join(root, entry);
        const s = await stat(dirPath);
        if (!s.isDirectory()) continue;

        const files = [];
        for (const file of await readdir(dirPath)) {
            if (file.endsWith('.html') && file !== 'index.html') {
                files.push(file);
            }
        }
        files.sort((a, b) => a.localeCompare(b));
        if (files.length > 0) {
            groups.push({ dir: entry, files });
        }
    }
    groups.sort((a, b) => a.dir.localeCompare(b.dir));
    return groups;
}

function escapeHtml(value) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function renderGroups(groups) {
    if (groups.length === 0) {
        return '<p class="empty">暂无用例，请向 e2e-cases/ 一级目录添加 *.html 后重新生成。</p>';
    }

    return groups
        .map(({ dir, files }) => {
            const items = files
                .map((file) => {
                    const name = file.replace(/\.html$/, '');
                    const href = `./${dir}/${file}`;
                    const url = `/e2e-cases/${dir}/${file}`;
                    return (
                        `<li class="case">` +
                        `<a class="case-link" href="${escapeHtml(href)}">${escapeHtml(name)}</a>` +
                        `<span class="case-url">${escapeHtml(url)}</span>` +
                        `</li>`
                    );
                })
                .join('\n');
            return (
                `<section class="group">` +
                `<h2 class="group-title">${escapeHtml(dir)} <span class="count">${files.length}</span></h2>` +
                `<ul class="case-list">${items}</ul>` +
                `</section>`
            );
        })
        .join('\n');
}

async function main() {
    const groups = await scan(E2E_ROOT);
    const dirCount = groups.length;
    const caseCount = groups.reduce((sum, g) => sum + g.files.length, 0);

    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>E2E 测试用例目录</title>
    <style>
        :root { color-scheme: dark; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #1a1a2e; color: #c8d6e5;
            min-height: 100vh; padding: 40px 24px 80px;
        }
        .wrap { max-width: 900px; margin: 0 auto; }
        header { margin-bottom: 32px; }
        header h1 { font-size: 28px; font-weight: 800; color: #0f9bf2; letter-spacing: -0.5px; }
        header .sub { margin-top: 8px; font-size: 14px; color: #576574; }
        header .sub code { color: #c8d6e5; background: #16213e; padding: 2px 6px; border-radius: 4px; }
        .toolbar { margin-bottom: 24px; }
        #filterInput {
            width: 100%; padding: 10px 14px; font-size: 14px;
            color: #c8d6e5; background: #16213e;
            border: 1px solid #2c3e50; border-radius: 8px; outline: none;
        }
        #filterInput:focus { border-color: #0f9bf2; }
        #filterInput::placeholder { color: #576574; }
        .group { margin-bottom: 28px; }
        .group-title {
            font-size: 15px; font-weight: 600; color: #0f9bf2;
            text-transform: uppercase; letter-spacing: 0.8px;
            padding-bottom: 8px; margin-bottom: 12px; border-bottom: 1px solid #2c3e50;
        }
        .group-title .count {
            color: #576574; font-weight: 400; font-size: 12px;
            background: #16213e; padding: 2px 8px; border-radius: 10px; margin-left: 8px;
        }
        .case-list { list-style: none; display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 8px; }
        .case {
            position: relative;
            display: flex; flex-direction: column; gap: 2px;
            background: #16213e; border: 1px solid #2c3e50; border-radius: 8px;
            padding: 10px 14px; transition: border-color 0.15s;
        }
        .case:hover { border-color: #0f9bf2; }
        .case-link { color: #c8d6e5; font-size: 14px; font-weight: 500; text-decoration: none; }
        .case-link:hover { color: #0f9bf2; }
        .case-link::after { content: ""; position: absolute; inset: 0; }
        .case-url { font-size: 11px; color: #576574; word-break: break-all; }
        .case.hidden, .group.hidden { display: none !important; }
        .empty { color: #576574; font-size: 14px; padding: 24px 0; }
    </style>
</head>
<body>
    <div class="wrap">
        <header>
            <h1>E2E 测试用例</h1>
            <div class="sub">共 ${dirCount} 个目录，${caseCount} 个用例 · 通过 <code>npm run dev</code> 启动后点击访问（localhost:5173）</div>
        </header>
        <div class="toolbar">
            <input id="filterInput" type="search" placeholder="搜索用例 / 目录..." autocomplete="off">
        </div>
        <main id="list">
${renderGroups(groups)}
        </main>
    </div>
    <script>
        (function () {
            var input = document.getElementById('filterInput');
            input.addEventListener('input', function () {
                var q = input.value.trim().toLowerCase();
                document.querySelectorAll('.group').forEach(function (group) {
                    var matched = false;
                    group.querySelectorAll('.case').forEach(function (item) {
                        var hit = !q || item.textContent.toLowerCase().indexOf(q) !== -1;
                        item.classList.toggle('hidden', !hit);
                        if (hit) matched = true;
                    });
                    group.classList.toggle('hidden', !matched);
                });
            });
        })();
    </script>
</body>
</html>
`;

    await writeFile(OUTPUT, html, 'utf-8');
    console.log(`Generated ${OUTPUT} with ${dirCount} directories and ${caseCount} cases.`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
