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

test('2D fallback applies toon controls without full-screen gouache overlay', () => {
  const source = readFileSync(new URL('../dist/js/fallback-canvas-renderer.js', import.meta.url), 'utf8');
  for (const control of ['toonEnabled', 'toonLight', 'toonSteps', 'cartoonMaterial']) {
    assert.match(source, new RegExp(`visualSettings\\.${control}|settings\\.${control}`));
  }
  assert.doesNotMatch(source, /createFallbackBrush|brushPattern/);
});

test('visual menu and GPU stages do not apply a screen-space gouache layer', () => {
  const page = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
  const painter = readFileSync(new URL('../dist/js/painted-renderer.js', import.meta.url), 'utf8');
  const shader = readFileSync(new URL('../dist/js/painted-shader.js', import.meta.url), 'utf8');
  assert.doesNotMatch(page, /brushExpression|strokeDetail|ГУАШЕВЫЙ МАТЕРИАЛ/);
  assert.doesNotMatch(painter, /brush:|createBrushShader|uBrush|uDetail/);
  assert.doesNotMatch(shader, /createBrushShader|brushContrast|uBrush|uDetail/);
});
