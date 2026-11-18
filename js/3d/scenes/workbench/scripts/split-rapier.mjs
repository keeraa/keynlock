import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../public/vendor');
const file = join(root, 'rapier.mjs');
const original = readFileSync(file, 'utf8');
const match = /"([A-Za-z0-9+/=]{1000000,})"/.exec(original);
if (!match) throw new Error('Rapier embedded WASM payload not found');

const payload = match[1];
const size = 450000;
const parts = [];
for (let offset = 0; offset < payload.length; offset += size) {
  const index = parts.length;
  const name = `rapier-wasm-${String(index).padStart(2, '0')}.mjs`;
  writeFileSync(join(root, name), `export default ${JSON.stringify(payload.slice(offset, offset + size))};\n`);
  parts.push({ name, identifier: `rapierWasm${index}` });
}

const imports = parts.map(({ name, identifier }) => `import ${identifier} from './${name}';`).join('\n');
const updated = `${imports}\n${original.slice(0, match.index)}(${parts.map(p => p.identifier).join('+')})${original.slice(match.index + match[0].length)}`;
writeFileSync(file, updated);
console.log(`Split ${payload.length} embedded WASM characters into ${parts.length} modules`);
