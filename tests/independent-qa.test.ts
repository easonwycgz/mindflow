import 'fake-indexeddb/auto';
import { afterEach, beforeEach, expect, it } from 'vitest';
import example from '../contracts/mindflow-card-example-v1.json';
import { backup, importCard, MindDB, restore } from '../src/db';
import { validateCard } from '../src/model';
let db: MindDB;
beforeEach(() => { db = new MindDB(crypto.randomUUID()); });
afterEach(async () => { await db.delete(); });
it('QA: exact depth 16 accepted, depth 17 and overlong text rejected', () => {
 const c = structuredClone(example); c.branches = [c.branches[0]]; let b = c.branches[0]; b.children = [];
 for (let i = 2; i <= 16; i++) { const n = {id: `d${i}`, title:'层', summary:'摘要', content:'正文', children:[]}; b.children = [n]; b = n; }
 expect(() => validateCard(c)).not.toThrow();
 b.children = [{id:'d17',title:'层',summary:'摘要',content:'正文',children:[]}];
 expect(() => validateCard(c)).toThrow(/深度/);
 expect(() => validateCard({...example,title:'中'.repeat(161)})).toThrow();
});
it('QA: interrupted import rolls back both stores and permits retry', async () => {
 const hook = () => { throw Error('QA quota failure'); }; db.reading.hook('creating', hook);
 await expect(importCard(JSON.stringify(example),db)).rejects.toThrow();
 expect(await db.cards.count()).toBe(0); expect(await db.reading.count()).toBe(0);
 db.reading.hook('creating').unsubscribe(hook);
 await importCard(JSON.stringify(example),db); expect(await db.cards.count()).toBe(1);
});
it('QA: simultaneous duplicate imports commit exactly one card and reading record', async () => {
 const results = await Promise.allSettled([importCard(JSON.stringify(example),db),importCard(JSON.stringify(example),db)]);
 expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
 expect(await db.cards.count()).toBe(1); expect(await db.reading.count()).toBe(1);
});
it('QA: exported valid multi-card library can restore its own backup', async () => {
 for (let j = 0; j < 2; j++) {
  const c = structuredClone(example); c.title = `QA synthetic wide card ${j}`;
  c.branches = [{id:'root',title:'根',summary:'摘要',content:'正文',children:Array.from({length:4500},(_,i)=>({id:`n${i}`,title:'节点',summary:'摘要',content:'合成内容',children:[]}))}];
  await importCard(JSON.stringify(c),db);
 }
 const text = await backup(db);
 await expect(restore(text,db)).resolves.toBeUndefined();
});
