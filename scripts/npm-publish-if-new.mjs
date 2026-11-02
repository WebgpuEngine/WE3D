import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const local = pkg.version;

let published = '';
try {
  published = execSync(`npm view ${pkg.name}@latest version`, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
} catch {
  published = ''; // 包未发布过（404）
}

if (published === local) {
  console.log(`⏭ 版本号 ${local} 与 registry 一致，跳过发布`);
  process.exit(0);
}

console.log(`📦 发布 ${local}（registry 当前：${published || '<未发布>'}）`);
execSync('npm publish', { stdio: 'inherit' });
