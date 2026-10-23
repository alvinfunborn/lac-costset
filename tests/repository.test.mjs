import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
const temp=mkdtempSync(path.join(tmpdir(),'lac-test-'));
const out=path.join(temp,'bundle.cjs');
await build({entryPoints:['tests/entry.ts'],bundle:true,platform:'node',format:'cjs',outfile:out,alias:{obsidian:path.resolve('tests/mock-obsidian.ts')}});
const {Repository,createApp,Asset}=createRequire(import.meta.url)(out);
process.on('exit',()=>rmSync(temp,{recursive:true,force:true}));

test('daily cost preserves future, active and expired behavior',()=>{
 const asset=new Asset('Keyboard',{name:'Keyboard',detail:{price:1000,active_from:'2026-01-01',active_to:'2026-01-11',recycle_price:200}});
 assert.equal(asset.getDailyCost(new Date('2025-12-31')),0);
 assert.equal(asset.getDailyCost(new Date('2026-01-06')),200);
 assert.equal(asset.getDailyCost(new Date('2026-02-01')),80);
});
test('editing preserves comments, unrelated fields and root links',async()=>{
 const app=createApp(), repo=new Repository(app,'items/root.md');
 await app.vault.create('items/root.md','type = "root"\nrenders = ["costset"]\n[[Keyboard|alias]]\n');
 const file=await app.vault.create('items/Keyboard.md','# keep me\nname = "Keyboard"\n[detail]\nprice = 100\nactive_from = "2026-01-01"\n[custom]\nnote = "keep"\n');
 const [asset]=await repo.loadAll(); assert.equal(asset.price,100);asset.price=200;await repo.saveAsset(asset);
 const saved=await app.vault.read(file);assert.match(saved,/# keep me/);assert.match(saved,/note = "keep"/);
 assert.equal((await repo.loadAll())[0].price,200);
 assert.equal((await app.vault.read(app.vault.getAbstractFileByPath('items/root.md'))).match(/\[\[Keyboard/g).length,1);
});
test('TOML section paths cannot mutate Object.prototype',()=>{
 const repo=new Repository(createApp(),'root.md');
 const parsed=repo.parseToml('[__proto__]\nlac_review_polluted = "yes"\n[constructor.prototype]\nlac_review_polluted2 = "yes"');
 assert.equal({}.lac_review_polluted,undefined);assert.equal({}.lac_review_polluted2,undefined);
 assert.equal(parsed.__proto__.lac_review_polluted,'yes');
});
