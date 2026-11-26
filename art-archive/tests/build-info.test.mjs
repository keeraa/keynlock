import test from 'node:test';
import assert from 'node:assert/strict';
import {showBuildInfo} from '../src/app/build-info.js';
test('build caption exposes the short revision while keeping the complete identity for reports and diagnostics',()=>{
 const node={dataset:{}},sha='abcd1234'+'a'.repeat(32);
 showBuildInfo(node,sha);assert(node.textContent.endsWith('abcd1234'));assert.equal(node.title,sha);assert.equal(node.dataset.build,sha);
 showBuildInfo(node,sha+'-dirty');assert.match(node.textContent,/локальные изменения/);assert.equal(node.dataset.build,sha+'-dirty');
 showBuildInfo(null,sha);
});
