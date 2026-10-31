import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('skin photo guide includes exact provider dimensions and approved repair resources',async()=>{
  const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
  assert.match(app,/Minimum dimension/);
  assert.match(app,/480 px/);
  assert.match(app,/2,560 px/);
  assert.match(app,/JPG \/ PNG/);
  assert.match(app,/960 × 1280/);
  assert.match(app,/236 × 354/);
  assert.match(app,/Do(n't| not) have the right pixel dimensions/);
  assert.match(app,/www\.photopea\.com/);
  assert.match(app,/squoosh\.app/);
  assert.match(app,/cannot restore missing skin detail/);
  assert.match(app,/scan-photo-examples\.svg/);
});

test('educational example asset is provided locally with accessible descriptions',async()=>{
  const svg=await readFile(new URL('../public/scan-photo-examples.svg',import.meta.url),'utf8');
  assert.match(svg,/^<svg /);
  assert.match(svg,/<title id="title">/);
  assert.match(svg,/<desc id="desc">/);
  assert.match(svg,/GOOD PHOTO/);
  assert.match(svg,/TRY AGAIN/);
  assert.match(svg,/960 × 1280 px/);
  assert.match(svg,/236 × 354 px/);
  assert.match(svg,/<\/svg>\s*$/);
});
