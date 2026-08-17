const {JSDOM}=require('jsdom'), fs=require('fs'), path=require('path');
const APP=path.join(__dirname,'..','index.html');
const src=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const dom=new JSDOM(src,{url:'http://localhost/',runScripts:'dangerously',
  beforeParse(w){w.speechSynthesis={getVoices:()=>[],speak(){},cancel(){}};w.SpeechSynthesisUtterance=function(){};w.scrollTo=()=>{}}});
const w=dom.window,d=w.document;

w.eval(`
  S.seen=true;
  const ids=CARDS.slice(0,150).map(c=>c.id);
  ids.slice(0,86).forEach((id,i)=>{ S.cards[id]={ef:2.5,iv:6,reps:3,lapses:0,due:addDays(today(), i%9)} });
  ids.slice(86,124).forEach(id=>{ S.cards[id]={ef:2.3,iv:1,reps:1,lapses:0,due:today()} });
  for(let i=0;i<14;i++){ if(i%3) S.hist[addDays(today(),-i)] = 6+((i*9)%28) }
  S.quiz['g-order']={score:3}; S.read['t1']={done:true};
  save();
`);

const shots=[];
const grab=(title,setup)=>{ w.eval(setup); const on=d.querySelector('.screen.on');
  shots.push({title, html:on.innerHTML}); };

grab('Главная','go("home")');
grab('Карточка слова','go("cards"); startSession(); flip=true; render()');
grab('Разговорник · сцена','go("trip","help")');
grab('Разговорник · список','go("trip")');
grab('Грамматика · артикли','go("gram",2)');
grab('Звук θ','go("sound",0)');
grab('Чтение','go("read",0); toggleRu(0)');
grab('Вписать слово','const wid=CARDS.find(c=>c.w==="water").id; S.cards[wid]={ef:2.5,iv:3,reps:2,lapses:0,due:today()}; go("cards"); startSession(); session.q=[wid]; render()');
grab('Путь','go("home","path")');
grab('Как это устроено','go("home","how")');
grab('Формы глаголов','go("gram","verbs")');
grab('Карточка глагола','addVerbGroup("v-all"); go("cards"); startSession(); session.q.unshift("v:go"); flip=true; render()');
grab('Знакомство','S.seen=false; go("home")');

let css=src.split('<style>')[1].split('</style>')[0];
css=css.replace(/html\[data-theme="dark"\][\s\S]*?\n\}/g,'');
css=css.replace(/:root\{/,'.app{').replace(/\nbody\{/,'\n.app{');
css=css.replace(/position:fixed;/g,'position:static;');
css=css.replace(/backdrop-filter:[^;]+;|-webkit-backdrop-filter:[^;]+;/g,'');
// префиксуем все селекторы, чтобы стили приложения не текли на страницу-превью
css=css.replace(/(^|\})\s*([^@{}]+)\{/g,(m,br,sel)=>{
  if(/^\s*(from|to|\d+%)\s*$/.test(sel)) return m;
  const out=sel.split(',').map(x=>{
    x=x.trim(); if(!x) return x;
    if(x.startsWith('.app')) return x;
    if(x==='*'||x==='html,body'||x==='html') return '.app';
    return '.app '+x;
  }).join(', ');
  return br+'\n'+out+'{';
});
const nav=d.querySelector('nav').outerHTML;

const page=`<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Quiet English — превью экранов</title>
<style>
body{margin:0;background:#EDEDE9;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;color:#1A1A18}
.head{max-width:1180px;margin:0 auto;padding:40px 24px 8px}
.head h1{font-family:ui-serif,Georgia,serif;font-weight:500;font-size:28px;margin:0 0 6px}
.head p{color:#6C6C64;margin:0;font-size:15px;max-width:640px;line-height:1.6}
.grid{max-width:1180px;margin:0 auto;padding:24px;display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:32px}
figure{margin:0}
figcaption{font-size:13px;color:#6C6C64;margin-bottom:10px;letter-spacing:.02em}
.phone{width:100%;max-width:360px;height:720px;border-radius:28px;overflow:hidden;border:1px solid #D6D6CB;background:#FAFAF8;position:relative;box-shadow:0 2px 4px rgba(0,0,0,.04),0 18px 40px -20px rgba(0,0,0,.25)}
.view{height:100%;overflow:auto}
.app nav{position:sticky;bottom:0}
${css}
</style></head><body>
<div class="head"><h1>Quiet English — экраны</h1>
<p>Реальная вёрстка и реальные стили приложения, просто выведенные на одну страницу. Прокручивай каждый экран внутри рамки.</p></div>
<div class="grid">
${shots.map(s=>`<figure><figcaption>${s.title}</figcaption>
  <div class="phone"><div class="view app"><div class="wrap">${s.html}</div>${nav}</div></div></figure>`).join('\n')}
</div></body></html>`;
fs.writeFileSync(path.join(__dirname,'..','preview.html'),page);
console.log('превью собрано:', Math.round(page.length/1024)+' КБ,', shots.length, 'экранов');
