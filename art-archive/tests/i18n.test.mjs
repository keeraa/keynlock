import test from 'node:test';
import assert from 'node:assert/strict';
import {t,setLanguage} from '../src/localization/i18n.js';
test('English hall titles and interface labels return to Russian without losing source text',()=>{
 setLanguage('en');assert.equal(t('Природа'),'Nature');assert.equal(t('Повседневный мир'),'Everyday Life');assert.equal(t('План этажа'),'Floor plan');
 setLanguage('ru');assert.equal(t('Nature'),'Природа');assert.equal(t('Floor plan'),'План этажа');assert.equal(t('Новый зал'),'Новый зал');
});
