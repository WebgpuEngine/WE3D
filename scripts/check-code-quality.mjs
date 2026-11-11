#!/usr/bin/env node
// 代码层质量 ratchet 门禁：指标只许下降，不许上升。
// 用法：npm run check:quality      —— 与基线比较，任一指标上升即非 0 退出
//       npm run quality:baseline   —— 显式刷新基线（治理见效后收紧，基线只能手工更新）
// 统计口径见 design/workBuddy/20260923项目与gltf分析/07-代码层质量治理分析与方案-20261111.md

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const weDir = join(root, 'src/we');
const baselinePath = join(root, 'scripts/code-quality-baseline.json');
const UPDATE = process.argv.includes('--update');

const norm = (p) => relative(root, p).split(sep).join('/');
const DATA_FILES = new Set([
    'src/we/model/simple/stanfordDragonData.ts',
    'src/we/model/simple/teapotData.ts',
]);
const SKIP_DIRS = new Set([
    'node_modules',
    '.git',
    'dist',
    'coverage',
    'docs',
    'doc',
    'test-results',
    'playwright-report',
    '.codebuddy',
]);
// 手工备份命名：'* copy*' / '*.todo' / '*.backup' / '*.bak' / '*.old' / '*副本*'
const BACKUP_NAME =
    /(?: copy(?:\s+\d+)?(?=\.|\s|$))|(?:\.(?:todo|backup|bak|old)$)|(?:副本)/i;

function walk(dir, accept, acc = []) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, entry.name);
        if (entry.isDirectory()) {
            if (!SKIP_DIRS.has(entry.name)) walk(p, accept, acc);
        } else if (entry.isFile() && accept(norm(p))) {
            acc.push(p);
        }
    }
    return acc;
}

// 去掉注释；blankStrings=true 时同时抹掉字符串内容（避免 WGSL 的 any() 等误计），保留换行。
function stripNonCode(src, blankStrings) {
    let out = '';
    let i = 0;
    let state = 'code';
    while (i < src.length) {
        const c = src[i];
        const n = src[i + 1];
        if (state === 'code') {
            if (c === '/' && n === '/') {
                state = 'line';
                i += 2;
                continue;
            }
            if (c === '/' && n === '*') {
                state = 'block';
                i += 2;
                continue;
            }
            if (c === "'" || c === '"' || c === '`') {
                state = c === "'" ? 'sq' : c === '"' ? 'dq' : 'tpl';
                if (!blankStrings) out += c;
                i += 1;
                continue;
            }
            out += c;
            i += 1;
            continue;
        }
        if (state === 'line' || state === 'block') {
            if (state === 'line' && c === '\n') {
                state = 'code';
                out += '\n';
                i += 1;
                continue;
            }
            if (state === 'block' && c === '*' && n === '/') {
                state = 'code';
                i += 2;
                continue;
            }
            out += c === '\n' ? '\n' : ' ';
            i += 1;
            continue;
        }
        if (c === '\\') {
            out += blankStrings ? '  ' : c + (n ?? '');
            i += 2;
            continue;
        }
        const quote = state === 'sq' ? "'" : state === 'dq' ? '"' : '`';
        if (c === quote) {
            state = 'code';
            if (!blankStrings) out += c;
            i += 1;
            continue;
        }
        out += blankStrings && c !== '\n' ? ' ' : c;
        i += 1;
    }
    return out;
}

const tsFiles = walk(weDir, (p) => p.endsWith('.ts'));
const prodFiles = tsFiles.filter((p) => !p.endsWith('.test.ts') && !DATA_FILES.has(norm(p)));

const COMMENTED_CODE =
    /^\s*\/\/\s*(?:export|class|function|const|let|if|for|return|this\.|async|import|override|await|throw)\b/;
const TYPE_ESCAPE = /^\s*(?:\/\/|\/\*)\s*@ts-(?:ignore|expect-error|nocheck)\b/;

const anyByFile = [];
const giantFiles = [];
const emptyStubFiles = [];
let explicitAny = 0;
let typeEscapes = 0;
let commentedCodeLines = 0;

for (const p of prodFiles) {
    const raw = readFileSync(p, 'utf8');
    const code = stripNonCode(raw, true);
    const count = (code.match(/\bany\b/g) ?? []).length;
    if (count) anyByFile.push({ file: norm(p), count });
    explicitAny += count;

    const lines = raw.split(/\r?\n/);
    if (lines.length > 1000) giantFiles.push({ file: norm(p), lines: lines.length });
    if (code.trim() === '') emptyStubFiles.push(norm(p));
    for (const line of lines) {
        if (TYPE_ESCAPE.test(line)) typeEscapes += 1;
        if (COMMENTED_CODE.test(line)) commentedCodeLines += 1;
    }
}

const backupNamedFiles = walk(root, (p) => BACKUP_NAME.test(p.split('/').pop() ?? ''))
    .map(norm)
    .sort();

const metrics = {
    explicitAny,
    typeEscapes,
    giantFiles: giantFiles.length,
    emptyStubFiles: emptyStubFiles.length,
    backupNamedFiles: backupNamedFiles.length,
    commentedCodeLines,
};
const details = {
    anyTopFiles: anyByFile.sort((a, b) => b.count - a.count).slice(0, 15),
    giantFiles: giantFiles.sort((a, b) => b.lines - a.lines),
    emptyStubFiles: emptyStubFiles.sort(),
    backupNamedFiles,
};

const labels = {
    explicitAny: '显式 any（生产源码）',
    typeEscapes: '@ts-ignore 类逃逸',
    giantFiles: '>1000 行源码文件',
    emptyStubFiles: '空/纯注释占位 .ts',
    backupNamedFiles: 'copy/备份命名文件',
    commentedCodeLines: '注释掉的代码行',
};

function printSnapshot(base) {
    console.log(`代码层质量快照（生产源码 ${prodFiles.length} 个 .ts；数据文件与测试已排除）`);
    console.log('指标'.padEnd(28) + '当前'.padStart(8) + '基线'.padStart(8) + '  说明');
    for (const [key, value] of Object.entries(metrics)) {
        const b = base ? base.metrics[key] : value;
        const delta = base ? (value > b ? '↑ 上升' : value < b ? '↓ 下降' : '=') : '基线值';
        console.log(
            labels[key].padEnd(24) + String(value).padStart(8) + String(b).padStart(8) + '  ' + delta,
        );
    }
}

if (UPDATE) {
    writeFileSync(
        baselinePath,
        JSON.stringify(
            {
                generatedAt: new Date().toISOString().slice(0, 10),
                scope: 'src/we 生产源码（排除 *.test.ts 与生成数据）+ 全仓备份命名文件',
                metrics,
                details,
            },
            null,
            4,
        ) + '\n',
    );
    printSnapshot(null);
    console.log('\n✅ 已写入基线：' + norm(baselinePath));
    console.log('   any 最多的文件：' + details.anyTopFiles.slice(0, 5).map((x) => `${x.file}(${x.count})`).join(', '));
    process.exit(0);
}

if (!existsSync(baselinePath)) {
    console.error('❌ 质量基线不存在，请先运行 npm run quality:baseline');
    process.exit(1);
}
const base = JSON.parse(readFileSync(baselinePath, 'utf8'));
printSnapshot(base);

const worse = [];
const better = [];
for (const [key, limit] of Object.entries(base.metrics)) {
    const value = metrics[key];
    if (typeof value !== 'number') {
        worse.push(`${key}: 指标缺失`);
    } else if (value > limit) {
        worse.push(`${key}: ${value} > 基线 ${limit}`);
    } else if (value < limit) {
        better.push(key);
    }
}

if (worse.length) {
    console.error('\n❌ ratchet 未通过（质量指标不允许上升）：');
    for (const w of worse) console.error('  - ' + w);
    console.error('  若是治理后的合理变化，请复核后再运行 npm run quality:baseline。');
    process.exit(1);
}
if (better.length) {
    console.log(`\n✅ ratchet 通过；${better.length} 项已下降（${better.join(', ')}）`);
    console.log('   请运行 npm run quality:baseline 收紧基线，并随本次治理一同提交。');
} else {
    console.log('\n✅ ratchet 通过（与基线一致）');
}
