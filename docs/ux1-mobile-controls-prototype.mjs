/* global document, window */
// ISOLATED DESIGN MEASUREMENT ONLY. No import from src/public/dist; not production.
// Reparent only application controls. Card title, caveats, Hook/tags and core retain
// their existing document order and exact text. React implementation is NOT supplied.
export function applyControlsPrototype(entry) {
  const article=document.querySelector('article');
  const quick=article?.querySelector('section[aria-label="快速阅读"]');
  if(!article||!quick)throw Error('MISSING_QUICK_LAYER');
  const menu=document.createElement('details');menu.className='prototype-tools';
  const summary=document.createElement('summary');
  summary.textContent=article.querySelector('.discovery')?'随看中 · 不自动保存':'阅读状态';
  const status=document.querySelector('header .status');if(status)summary.append(status);
  const body=document.createElement('div');
  for(const selector of ['header .brand','article > .discovery']) {
    const control=document.querySelector(selector);if(control)body.append(control);
  }
  const bar=document.createElement('div');bar.className='prototype-tools-bar';
  menu.append(summary,body);bar.append(menu);
  const resume=body.querySelector('.discovery button');
  if(resume)bar.append(resume); // keep Continue immediately available, outside the menu
  article.insertBefore(bar,quick);
  const neutral=article.querySelector('.boundaries > p:not(.boundary-preview)');
  if(neutral)neutral.textContent='原文提醒，未作当前核实。';
  document.documentElement.classList.add('prototype-controls');
  if(entry==='random')document.getElementById('card-title')?.scrollIntoView({block:'start',behavior:'instant'});
  else window.scrollTo(0,0);
}
