import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';

const input = createInterface({ input: process.stdin, crlfDelay: Infinity });
const firstLine = await new Promise(resolve => input.once('line', resolve));
const data = JSON.parse(firstLine);
input.close();

const directory = new URL('../public/assets', import.meta.url).pathname;
mkdirSync(directory, { recursive: true });
for (const asset of data) {
  if (!/^[a-z0-9-]+\.(?:jpg|webp|png)$/.test(asset.name)) throw new Error('Unsafe asset name');
  writeFileSync(join(directory, asset.name), Buffer.from(asset.base64.replace(/\s/g, ''), 'base64'));
}
process.stdout.write(`Imported ${data.length} existing game assets\n`);
