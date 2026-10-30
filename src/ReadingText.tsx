import { Fragment } from 'react';
// A deliberately small React-only Markdown subset. No HTML parser, links or images.
function inline(text:string){return text.split(/(\*\*[^*\n]+\*\*)/g).map((part,i)=>part.startsWith('**')&&part.endsWith('**')?<strong key={i}>{part.slice(2,-2)}</strong>:<Fragment key={i}>{part}</Fragment>);}
export function ReadingText({text}:{text:string}){
 // Preserve suspicious source verbatim, visibly, without interpreting any of it.
 if(/<\/?[a-z!]/i.test(text))return <p className="prose">{text}</p>;
 const lines=text.split('\n');const blocks=[];
 for(let i=0;i<lines.length;i++){
  const line=lines[i];const heading=/^(#{1,6})\s+(.+)$/.exec(line);
  if(heading){blocks.push(<h4 key={i}>{inline(heading[2])}</h4>);continue;}
  if(/^[-*]\s+/.test(line)||/^\d+\.\s+/.test(line)){
   const ordered=/^\d+\./.test(line),items=[];const start=i;
   while(i<lines.length&&(ordered?/^\d+\.\s+/:/^[-*]\s+/).test(lines[i])){items.push(<li key={i}>{inline(lines[i].replace(ordered?/^\d+\.\s+/:/^[-*]\s+/,''))}</li>);i++;}i--;
   blocks.push(ordered?<ol className="md-list" key={start}>{items}</ol>:<ul className="md-list" key={start}>{items}</ul>);continue;
  }
  if(line.trim())blocks.push(<p className="prose" key={i}>{inline(line)}</p>);
 }
 return <div className="reading-text">{blocks}</div>;
}
