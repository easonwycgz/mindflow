import Dexie, { type Table } from 'dexie';
import { z } from 'zod';
import { cardBoundary, hash, MAX_BYTES, parseJSON, type Card } from './model';
export interface StoredCard {id:string; hash:string; createdAt:number; updatedAt:number; content:Card}
export interface Reading {cardId:string; favorite:boolean; section:'summary'|'tree'|'faq'; nodeId:string|null; scroll:number}
const readingSchema=z.object({cardId:z.uuid(),favorite:z.boolean(),section:z.enum(['summary','tree','faq']),nodeId:z.string().max(100).nullable(),scroll:z.number().finite().min(0).max(10000000)}).strict();
const settingsSchema=z.object({id:z.literal('main'),fontSize:z.enum(['normal','large']),lastCardId:z.uuid().nullable()}).strict();
export type Settings=z.infer<typeof settingsSchema>;
export const defaults:Settings={id:'main',fontSize:'normal',lastCardId:null};
export class MindDB extends Dexie {
 cards!:Table<StoredCard,string>; reading!:Table<Reading,string>; settings!:Table<Settings,string>;
 constructor(name='mindflow-v1'){super(name);this.version(1).stores({cards:'id,&hash',reading:'cardId',settings:'id'});}
}
export const db=new MindDB();
export const newReading=(cardId:string):Reading=>({cardId,favorite:false,section:'summary',nodeId:null,scroll:0});
export async function importCard(text:string,target=db){
 const content=cardBoundary.parse(parseJSON(text)); const digest=await hash(content); const now=Date.now();
 const card:StoredCard={id:crypto.randomUUID(),hash:digest,createdAt:now,updatedAt:now,content};
 await target.transaction('rw',target.cards,target.reading,async()=>{
  if(await target.cards.where('hash').equals(digest).count()) throw Error('该内容已存在；原卡片与阅读状态保持不变');
  await target.cards.add(card);await target.reading.add(newReading(card.id));
 }); return card;
}
const recordSchema=z.object({id:z.uuid(),hash:z.string().regex(/^[a-f0-9]{64}$/),createdAt:z.number().int().nonnegative(),updatedAt:z.number().int().nonnegative(),content:cardBoundary}).strict();
const payloadSchema=z.object({cards:z.array(recordSchema).max(500),reading:z.array(readingSchema).max(500),settings:settingsSchema}).strict();
const backupSchema=z.object({version:z.literal(1),checksum:z.string().regex(/^[a-f0-9]{64}$/),payload:payloadSchema}).strict();
export async function backup(target=db){
 const payload=await target.transaction('r',target.cards,target.reading,target.settings,async()=>({cards:await target.cards.toArray(),reading:await target.reading.toArray(),settings:await target.settings.get('main')??defaults}));
 return JSON.stringify({version:1,checksum:await hash(payload),payload},null,2);
}
export async function restore(text:string,target=db){
 const envelope=backupSchema.parse(parseJSON(text,20*MAX_BYTES)); const {payload}=envelope;
 if(await hash(payload)!==envelope.checksum) throw Error('备份完整性校验失败');
 const ids=new Set<string>(),hashes=new Set<string>();
 for(const c of payload.cards){if(ids.has(c.id)||hashes.has(c.hash)||await hash(c.content)!==c.hash||c.updatedAt<c.createdAt) throw Error('备份卡片重复或内容校验失败');ids.add(c.id);hashes.add(c.hash);}
 const states=new Set<string>();
 for(const r of payload.reading){if(!ids.has(r.cardId)||states.has(r.cardId)) throw Error('备份阅读状态不完整');states.add(r.cardId);
  if(r.nodeId){const nodes=[...payload.cards.find(c=>c.id===r.cardId)!.content.branches];let found=false;while(nodes.length){const n=nodes.pop()!;if(n.id===r.nodeId)found=true;nodes.push(...n.children);}if(!found)throw Error('备份阅读节点不存在');}
 }
 if(states.size!==ids.size || (payload.settings.lastCardId && !ids.has(payload.settings.lastCardId))) throw Error('备份引用不完整');
 await target.transaction('rw',target.cards,target.reading,target.settings,async()=>{await target.cards.clear();await target.reading.clear();await target.settings.clear();await target.cards.bulkAdd(payload.cards);await target.reading.bulkAdd(payload.reading);await target.settings.put(payload.settings);});
}
