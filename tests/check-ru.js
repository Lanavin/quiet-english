const {JSDOM}=require('jsdom'),fs=require('fs'),path=require('path');
const dom=new JSDOM(fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8'),
 {url:'http://localhost/',runScripts:'dangerously',beforeParse(w){w.speechSynthesis={getVoices:()=>[],speak(){},cancel(){}};w.SpeechSynthesisUtterance=function(){};w.scrollTo=()=>{}}});
const w=dom.window,d=w.document,E=s=>w.eval(s);

const ru=new Set();
const add=t=>{ if(typeof t==='string' && /[а-яё]/i.test(t) && t.length>4) ru.add(t.replace(/<[^>]+>/g,'')); };
E('DECKS').forEach(x=>{ add(x.name); add(x.note); x.words.forEach(y=>{add(y[2]); add(y[5])}); });
E('GRAMMAR').forEach(g=>{ [g.title,g.sub,g.core,g.why,g.trap,g.pairsNote].forEach(add);
  g.examples.forEach(e=>add(e[1])); g.quiz.forEach(q=>{add(q.q); q.o.forEach(add); add(q.e)});
  (g.pairs||[]).forEach(p=>p.forEach(add)); });
E('SOUNDS').forEach(x=>{ [x.name,x.lipread,x.trap].forEach(add); x.steps.forEach(add); });
E('TEXTS').forEach(t=>{ [t.title,t.lead].forEach(add); t.body.forEach(b=>add(b[1]));
  Object.values(t.gloss).forEach(g=>add(g[1])); });
E('TRIPS').forEach(g=>{ [g.name,g.note].forEach(add);
  g.scenes.forEach(s=>{ add(s.t); add(s.tip); [...s.say,...s.hear].forEach(p=>add(p[1])); }); });
Object.values(E('COMMON')).forEach(v=>add(v[1]));

// плюс весь видимый текст всех экранов
w.eval('S.seen=true;save()');
['go("home")','go("cards");startSession();flip=true;render()','go("trip")','go("trip","help")',
 'go("gram",2)','go("sound",0)','go("read",0)','go("read")','go("cards");startSession(1);flip=true;render()']
 .forEach(code=>{ w.eval(code);
   d.querySelectorAll('.screen.on p, .screen.on h1, .screen.on h2, .screen.on .tiny, .screen.on .sub, .screen.on .ttl, .screen.on .unit, .screen.on .note')
     .forEach(el=>add(el.textContent.replace(/\s+/g,' ').trim())); });

const rules=[
 [/ {2,}/,'двойной пробел'],
 [/\s[,.;:!?](?![.)])/,'пробел перед знаком препинания'],
 [/[,;](?=[^\s\d»)"])/,'нет пробела после запятой'],
 [/(?:^|\s)-(?:\s)/,'дефис вместо тире'],
 [/\b([А-Яа-яё]{3,})\s+\1\b/i,'повтор слова'],
 [/[а-яё]{2}[A-ZА-ЯЁ]/,'склейка слов'],
 [/\d[А-Яа-яё]/,'цифра слиплась с буквой'],
 [/[А-Яа-яё]\d/,'буква слиплась с цифрой'],
 [/стрик/i,'жаргон «стрик»'],
 [/[a-z]{2}[А-ЯЁ]/,'склейка латиницы с русским'],
];
let n=0;
[...ru].sort().forEach(t=>{
  rules.forEach(([re,msg])=>{
    if(re.test(t)){
      // числа с единицами вида «5 фраз» ловим отдельно, тут только реальные склейки
      if(msg.includes('цифра') && /\d\s/.test(t)) return;
      console.log(`  ${msg}: «${t.slice(0,110)}»`); n++;
    }
  });
});
console.log('\nПроверено русских строк:', ru.size, '| замечаний:', n);
