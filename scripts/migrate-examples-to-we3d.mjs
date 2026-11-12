// 一次性脚本：将 examples 下对 src/we 的相对导入统一改为从 barrel `@we3d` 导入。
// 用法：
//   node scripts/migrate-examples-to-we3d.mjs            # 仅 dry-run，输出统计
//   node scripts/migrate-examples-to-we3d.mjs --apply    # 正式改写 + 补齐 index.ts 缺失导出
//
// 约定：
//  - 只改写路径中含 `src/we` 的静态 import；兄弟示例间的相对导入、第三方包、@we3d 不动。
//  - 每个文件可解析的符号合并为单条 `import { … } from '@we3d'`。
//  - 对 barrel 缺失且【真实存在于源模块导出】的符号，按源模块补 `export` / `export type`。
//  - 解析不到的符号（源模块实际未导出，多为示例原本引用了不存在的符号）：保留原相对导入，不污染 barrel。
//  - 含 default / namespace / 动态 import('…src/we…') 的文件标记为需人工处理，不自动改写。

import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const examplesDir = path.join(root, 'examples');
const weDir = path.join(root, 'src', 'we');
const indexPath = path.join(weDir, 'index.ts');
const APPLY = process.argv.includes('--apply');

// ---------- 解析 barrel 已有导出（区分 value / type，避免把 export type 误判为运行期可用） ----------
const indexText0 = fs.readFileSync(indexPath, 'utf8');
const exportedNames = new Set();
const exportedKind = new Map(); // name -> 'value' | 'type' | 'both'
const starModules = new Set();
{
  const reExp = /export\s+(type\s+)?\{([^}]*)\}\s*(?:from\s*['"]([^'"]+)['"])?/g;
  let m;
  while ((m = reExp.exec(indexText0))) {
    const isTypeStmt = !!m[1];
    const body = m[2];
    body.split(',').forEach((part) => {
      const t = part.trim();
      if (!t) return;
      let spec = t;
      let perType = isTypeStmt;
      const pm = t.match(/^type\s+(.+)$/);
      if (pm) {
        perType = true;
        spec = pm[1].trim();
      }
      const mm = spec.match(/^([\w$]+)(?:\s+as\s+([\w$]+))?$/);
      if (!mm) return;
      const name = mm[2] || mm[1];
      exportedNames.add(name);
      const k = perType ? 'type' : 'value';
      const prev = exportedKind.get(name);
      if (!prev) exportedKind.set(name, k);
      else if (prev !== k) exportedKind.set(name, 'both');
    });
  }
  const starRe = /export\s+\*\s+from\s*['"]([^'"]+)['"]/g;
  while ((m = starRe.exec(indexText0))) starModules.add(m[1]);
}

// ---------- 判定导出符号是 value 还是 type（并确认是否真实导出） ----------
const moduleCache = new Map();
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '') // 块注释
    .replace(/(^|[^:])\/\/.*$/gm, '$1'); // 行注释（避免误删 http:// 等）
}
function readModule(abs) {
  if (!moduleCache.has(abs)) {
    try {
      moduleCache.set(abs, stripComments(fs.readFileSync(abs, 'utf8')));
    } catch {
      moduleCache.set(abs, null);
    }
  }
  return moduleCache.get(abs);
}
function declKindInText(name, txt) {
  const re = new RegExp(
    `export\\s+(?:declare\\s+)?(?:async\\s+)?(?:interface|type|class|abstract class|function|const|let|var|enum)\\s+${name}\\b`,
  );
  const dm = txt.match(re);
  if (!dm) return null;
  const kw = dm[0].replace(/export\s+(?:declare\s+)?(?:async\s+)?/, '').split(/\s+/)[0];
  return kw === 'interface' || kw === 'type' ? 'type' : 'value';
}
function classify(name, moduleAbs, visited = new Set()) {
  const key = moduleAbs + '::' + name;
  if (visited.has(key)) return null;
  visited.add(key);
  const txt = readModule(moduleAbs);
  if (!txt) return null;
  const direct = declKindInText(name, txt);
  if (direct) return direct;
  const reExp = /export\s+(type\s+)?\{([^}]*)\}\s+from\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = reExp.exec(txt))) {
    const isType = !!m[1];
    const has = m[2].split(',').some((part) => {
      const mm = part.trim().match(/^([\w$]+)(?:\s+as\s+([\w$]+))?$/);
      return mm && (mm[2] || mm[1]) === name;
    });
    if (has) {
      if (isType) return 'type';
      const target = path.resolve(path.dirname(moduleAbs), m[3]);
      const k = classify(name, target, visited);
      if (k) return k;
    }
  }
  // 本地 re-export（无 from）：export { orig as name }
  const localRe = /export\s+(type\s+)?\{([^}]*)\}\s*;/g;
  while ((m = localRe.exec(txt))) {
    const isType = !!m[1];
    const part = m[2].split(',').find((p) => {
      const mm = p.trim().match(/^([\w$]+)(?:\s+as\s+([\w$]+))?$/);
      return mm && (mm[2] || mm[1]) === name;
    });
    if (part) {
      const orig = part.trim().match(/^([\w$]+)/)[1];
      const k = declKindInText(orig, txt);
      if (k) return k;
      // orig 可能是从他处导入的绑定，追不到声明时按 re-export 标志兜底
      return isType ? 'type' : 'value';
    }
  }
  const starRe = /export\s+\*\s+from\s*['"]([^'"]+)['"]/g;
  while ((m = starRe.exec(txt))) {
    const target = path.resolve(path.dirname(moduleAbs), m[1]);
    const k = classify(name, target, visited);
    if (k) return k;
  }
  return null;
}

// ---------- 路径工具 ----------
function isWePath(p) {
  return p === '@we3d' || /(^|[\\/])src[\\/]we([\\/]|$)/.test(p);
}
// 返回相对 src/we/index.ts 的模块路径（如 './core/camera/perspectiveCamera'）；
// 若路径指向 src/we 目录本身（即 barrel/index），返回 null（视为已覆盖）。非 src/we 返回 undefined。
function convertModuleRel(p) {
  if (p === '@we3d') return null;
  const norm = p.replace(/\\/g, '/');
  const idx = norm.indexOf('src/we/');
  if (idx >= 0) {
    let rel = './' + norm.slice(idx + 'src/we/'.length);
    return rel.replace(/\.ts$/, '');
  }
  if (/(^|[\\/])src[\\/]we$/.test(norm)) return null;
  return undefined;
}
function isDirectDecl(name, abs) {
  const txt = readModule(abs);
  if (!txt) return false;
  return new RegExp(
    `export\\s+(?:declare\\s+)?(?:async\\s+)?(?:interface|type|class|abstract class|function|const|let|var|enum)\\s+${name}\\b`,
  ).test(txt);
}

// 在 src/we 中查找某符号的「值声明」模块（用于把仅 type 导出的符号升级为值导出）
const valueModuleCache = new Map();
function findValueModule(name) {
  if (valueModuleCache.has(name)) return valueModuleCache.get(name);
  let found = null;
  const stack = [weDir];
  while (stack.length && !found) {
    const dir = stack.pop();
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        stack.push(p);
        continue;
      }
      if (!e.name.endsWith('.ts')) continue;
      const txt = readModule(p);
      if (txt && declKindInText(name, txt) === 'value') {
        found = './' + path.relative(weDir, p).replace(/\\/g, '/').replace(/\.ts$/, '');
        break;
      }
    }
  }
  valueModuleCache.set(name, found);
  return found;
}

// ---------- 解析 import 语句中的具名说明符 ----------
function parseSpecs(braceInner, typeFlag) {
  const out = [];
  braceInner.split(',').forEach((item) => {
    item = item.trim();
    if (!item) return;
    let kind = typeFlag ? 'type' : 'value';
    let nm = item;
    if (/^type\s+/.test(item)) {
      kind = 'type';
      nm = item.replace(/^type\s+/, '');
    }
    const asMatch = nm.match(/^([\w$]+)\s+as\s+([\w$]+)$/);
    let alias = null;
    if (asMatch) {
      nm = asMatch[1];
      alias = asMatch[2];
    }
    out.push({ name: nm, alias, kind });
  });
  return out;
}

// ---------- 扫描 examples ----------
const importRe = /import\s+(type\s+)?([\s\S]*?)\s+from\s*['"]([^'"]+)['"];?/g;
const dynRe = /import\(\s*['"]([^'"]+)['"]\s*\)/g;
const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.ts')) files.push(p);
  }
})(examplesDir);

const perFile = [];
const manualFiles = [];
const dynamicImports = [];
const globalSymbols = new Map(); // name -> { modules: Map<rel, true>, kind }
const we3dImportedSymbols = new Map(); // name -> 'value' | 'type'（示例从 @we3d 直接导入的符号，用于 type→value 升级）

for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');

  let dm;
  while ((dm = dynRe.exec(text))) {
    if (isWePath(dm[1])) {
      dynamicImports.push({ file: path.relative(root, file), path: dm[1] });
    }
  }

  const records = [];
  let needsManual = false;
  importRe.lastIndex = 0;
  let m;
  while ((m = importRe.exec(text))) {
    const typeFlag = !!m[1];
    const body = m[2];
    const p = m[3];
    const start = m.index;
    const end = m.index + m[0].length;
    if (!isWePath(p)) {
      records.push({ start, end, kind: 'other', orig: text.slice(start, end) });
      continue;
    }
    const defMatch = body.match(/^([A-Za-z_$][\w$]*)\s*(?:,|\s*$)/);
    if (defMatch && !body.trim().startsWith('{')) needsManual = true;
    if (/\*\s+as\s+[A-Za-z_$][\w$]*/.test(body)) needsManual = true;
    const brace = body.match(/\{([^}]*)\}/);
    if (!brace) {
      needsManual = true;
      records.push({ start, end, kind: 'other', orig: text.slice(start, end) });
      continue;
    }
    const rel = convertModuleRel(p); // null=barrel本身, undefined=非we(理论上不会到这)
    const specs = parseSpecs(brace[1], typeFlag);
    records.push({ start, end, kind: 'we', path: p, rel, specs, typeFlag });
    if (rel) {
      for (const s of specs) {
        if (!globalSymbols.has(s.name)) globalSymbols.set(s.name, { modules: new Map(), kind: null });
        const g = globalSymbols.get(s.name);
        g.modules.set(rel, true);
        if (s.kind === 'value') g.kind = 'value';
      }
    } else if (p === '@we3d') {
      for (const s of specs) {
        const prev = we3dImportedSymbols.get(s.name);
        if (!prev || s.kind === 'value') we3dImportedSymbols.set(s.name, s.kind);
      }
    }
  }

  if (needsManual) {
    manualFiles.push(path.relative(root, file));
    continue;
  }
  if (!records.some((r) => r.kind === 'we' && r.rel)) continue; // 无相对 src/we 导入则跳过（如已用 @we3d 的文件）
  perFile.push({ file, text, records });
}

// ---------- 计算 barrel 缺口 / 坏符号 ----------
const missingByModule = new Map(); // rel -> [{name, kind}]
const badSymbols = []; // 源模块未导出，保留相对导入
const collisions = [];

// 依据「barrel 现有导出形态(exportedKind)」与「符号真实类型(classify)」决定是否需要补导出。
// 关键：用 classify 的真实类型，而非示例导入时是否带 type 关键字（示例常以值导入语法导入类型）。
function decide(name, moduleRel) {
  const ek = exportedKind.get(name); // 'value' | 'type' | 'both' | undefined
  const moduleAbs = path.join(weDir, moduleRel.slice(2) + '.ts');
  const realKind = classify(name, moduleAbs);
  if (!realKind) return { action: 'bad' };
  if (ek === 'value' || ek === 'both') return { action: 'skip' }; // 已有值导出，足够
  if (ek === 'type') {
    // 已是 type 导出：符号本身若是值(enum/class/...)则需补 value 导出；否则已足够
    return realKind === 'value' ? { action: 'add', kind: 'value' } : { action: 'skip' };
  }
  return { action: 'add', kind: realKind }; // 完全缺失
}
function addMissing(name, moduleRel, kind) {
  if (starModules.has(moduleRel)) return;
  if (!missingByModule.has(moduleRel)) missingByModule.set(moduleRel, []);
  if (!missingByModule.get(moduleRel).some((s) => s.name === name)) {
    missingByModule.get(moduleRel).push({ name, kind });
  }
}

// 1) 来自相对 src/we 导入的符号
for (const [name, g] of globalSymbols) {
  if (g.modules.size === 0) continue;
  let rel;
  if (g.modules.size > 1) {
    rel = null;
    for (const cand of g.modules.keys()) {
      const abs = path.join(weDir, cand.slice(2) + '.ts');
      if (isDirectDecl(name, abs)) {
        rel = cand;
        break;
      }
    }
    if (!rel) rel = [...g.modules.keys()][0];
    if (rel !== [...g.modules.keys()][0]) collisions.push({ name, modules: [...g.modules.keys()] });
  } else {
    rel = [...g.modules.keys()][0];
  }
  const d = decide(name, rel);
  if (d.action === 'bad') {
    badSymbols.push({ name, rel });
    continue;
  }
  if (d.action === 'add') addMissing(name, rel, d.kind);
}

// 2) 来自 @we3d 导入的符号（示例已直接吃 barrel）。
//    - barrel 已导出：若符号是值却仅 type 导出，则升级补 value 导出（例 E_renderForDC）。
//    - barrel 完全未导出：找声明模块补全（value/type 由 classify 决定）。
for (const [name] of we3dImportedSymbols) {
  const moduleRel = findValueModule(name);
  if (!moduleRel) continue;
  const d = decide(name, moduleRel);
  if (d.action === 'add') addMissing(name, moduleRel, d.kind);
}

const addedNames = new Set();
for (const syms of missingByModule.values()) for (const s of syms) addedNames.add(s.name);
const resolvable = (name) => exportedNames.has(name) || addedNames.has(name);

// ---------- 输出报告 ----------
console.log('=== examples -> @we3d 迁移报告 ===');
console.log(`扫描 .ts 文件: ${files.length}`);
console.log(`将改写(合并)文件: ${perFile.length}`);
console.log(`需人工处理文件: ${manualFiles.length}`);
if (manualFiles.length) console.log('  人工文件: ' + manualFiles.join(', '));
console.log(`动态 import() 指向 src/we: ${dynamicImports.length}`);
const missingCount = [...missingByModule.values()].reduce((a, b) => a + b.length, 0);
console.log(`barrel 缺失(真实导出)符号数: ${missingCount}（涉及模块 ${missingByModule.size} 个）`);
console.log(`保留相对导入的坏符号数: ${badSymbols.length}`);
if (badSymbols.length) console.log('  坏符号: ' + badSymbols.map((b) => `${b.name} (<- ${b.rel})`).join(', '));
console.log('碰撞(同名多模块,已取声明模块): ' + (collisions.length ? JSON.stringify(collisions) : '无'));
console.log('\n--- 待补 barrel 导出（按模块）---');
for (const [rel, syms] of [...missingByModule.entries()].sort()) {
  const val = syms.filter((s) => s.kind === 'value').map((s) => s.name);
  const typ = syms.filter((s) => s.kind === 'type').map((s) => s.name);
  let line = `  ${rel}`;
  if (val.length) line += `\n    export { ${val.join(', ')} } from '${rel}';`;
  if (typ.length) line += `\n    export type { ${typ.join(', ')} } from '${rel}';`;
  console.log(line);
}

if (!APPLY) {
  console.log('\n(dry-run) 未做任何改动。加 --apply 正式执行。');
  process.exit(0);
}

// ---------- 正式改写 ----------
// 1) 补齐 barrel
let additions = '\n// --- examples barrel expansion (auto-migrated by scripts/migrate-examples-to-we3d.mjs) ---\n';
for (const [rel, syms] of [...missingByModule.entries()].sort()) {
  const val = syms.filter((s) => s.kind === 'value').map((s) => s.name);
  const typ = syms.filter((s) => s.kind === 'type').map((s) => s.name);
  if (val.length) additions += `export { ${val.join(', ')} } from '${rel}';\n`;
  if (typ.length) additions += `export type { ${typ.join(', ')} } from '${rel}';\n`;
}
fs.appendFileSync(indexPath, additions);

// 2) 改写示例文件
function buildWe3d(R) {
  const map = new Map();
  for (const s of R) {
    if (!map.has(s.name)) map.set(s.name, s);
    else if (s.kind === 'value') map.set(s.name, s);
  }
  const parts = [...map.values()].map((s) => {
    const core = s.alias ? `${s.name} as ${s.alias}` : s.name;
    return s.kind === 'type' ? `type ${core}` : core;
  });
  return `import { ${parts.join(', ')} } from '@we3d';`;
}
function buildRelative(U, origPath, typeFlag) {
  const parts = U.map((s) => {
    const core = s.alias ? `${s.name} as ${s.alias}` : s.name;
    return typeFlag || s.kind === 'type' ? `type ${core}` : core;
  });
  return `import { ${parts.join(', ')} } from '${origPath}';`;
}

let rewritten = 0;
for (const f of perFile) {
  const { text, records } = f;
  const R = [];
  let changed = false;
  for (const r of records) {
    if (r.kind !== 'we') continue;
    const rSpecs = r.specs.filter((s) => resolvable(s.name));
    const uSpecs = r.specs.filter((s) => !resolvable(s.name));
    if (rSpecs.length) R.push(...rSpecs);
    if (uSpecs.length) {
      r.replacement = buildRelative(uSpecs, r.path, r.typeFlag);
      changed = true;
    } else {
      r.replacement = ''; // 全部可解析 -> 移除，并入 @we3d
      changed = true;
    }
  }
  if (!changed) continue;
  const consolidated = R.length ? buildWe3d(R) : null;
  let out = '';
  let cursor = 0;
  let inserted = false;
  for (const r of records) {
    out += text.slice(cursor, r.start);
    let rep = r.replacement !== undefined ? r.replacement : r.orig;
    if (!inserted && r.kind === 'we' && consolidated) {
      rep = consolidated + '\n' + rep;
      inserted = true;
    }
    out += rep;
    cursor = r.end;
  }
  out += text.slice(cursor);
  fs.writeFileSync(f.file, out);
  rewritten++;
}
console.log(`\n[apply] 已补 barrel 导出至 src/we/index.ts，改写示例文件 ${rewritten} 个。`);
