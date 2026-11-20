import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('visual post-process can recover from a failed frame without capturing unrelated shader errors', () => {
  const source = readFileSync(new URL('../dist/js/painted-renderer.js', import.meta.url), 'utf8');
  const changeSettings = source.slice(source.indexOf('function setSettings('), source.indexOf('function render()'));
  assert.match(changeSettings, /stage\.failed\s*=\s*false/);
  assert.match(changeSettings, /stage\.pending\s*=\s*true/);
  assert.match(source, /readRenderTargetPixels\(target/);
  assert.doesNotMatch(source, /gl\.readPixels\(/);
  assert.match(source, /function getStatus\(\)/);
  assert.doesNotMatch(source, /debug\.onShaderError\s*=/);
});

test('visual menu and GPU stages do not apply a screen-space gouache layer', () => {
  const page = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
  const painter = readFileSync(new URL('../dist/js/painted-renderer.js', import.meta.url), 'utf8');
  const shader = readFileSync(new URL('../dist/js/painted-shader.js', import.meta.url), 'utf8');
  assert.doesNotMatch(page, /brushExpression|strokeDetail|ГУАШЕВЫЙ МАТЕРИАЛ/);
  assert.doesNotMatch(painter, /brush:|createBrushShader|uBrush|uDetail/);
  assert.doesNotMatch(shader, /createBrushShader|brushContrast|uBrush|uDetail/);
});
