const {JSDOM}=require('jsdom'),fs=require('fs'),path=require('path');
const dom=new JSDOM(fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8'),
 {url:'http://localhost/',runScripts:'dangerously',beforeParse(w){w.speechSynthesis={getVoices:()=>[],speak(){},cancel(){}};w.SpeechSynthesisUtterance=function(){};w.scrollTo=()=>{}}});
const w=dom.window,d=w.document;
w.eval(`S.seen=true;
 const ids=CARDS.slice(0,140).map(c=>c.id);
 ids.slice(0,86).forEach((id,i)=>{S.cards[id]={ef:2.5,iv:6,reps:3,lapses:0,due:addDays(today(),i%9)}});
 ids.slice(86,120).forEach(id=>{S.cards[id]={ef:2.3,iv:1,reps:1,lapses:0,due:today()}});
 for(let i=0;i<14;i++){if(i%3)S.hist[addDays(today(),-i)]=6+((i*9)%28)}
 S.quiz['g-order']={score:3}; S.read['t1']={done:true}; save();`);

const screens=[['главная','go("home")'],['карточка','go("cards");startSession();flip=true;render()'],
 ['финал','go("cards");startSession(2);flip=true;render()'],
 ['разговорник','go("trip")'],['сцена','go("trip","help")'],['грамматика','go("gram",2)'],
 ['звук','go("sound",0)'],['чтение','go("read",0)'],['список текстов','go("read")'],['знакомство','S.seen=false;go("home")']];

// склейка = между двумя текстовыми узлами нет пробела, а по смыслу он нужен
const found=[];
function walk(root,scr){
  const it=d.createTreeWalker(root, w.NodeFilter.SHOW_TEXT);
  let prev=null,n;
  while(n=it.nextNode()){
    const t=n.nodeValue;
    if(!t.trim()){prev=null;continue}
    if(prev){
      const a=prev.replace(/\s+$/,''), b=t.replace(/^\s+/,'');
      const noGapA=!/\s$/.test(prev), noGapB=!/^\s/.test(t);
      if(noGapA&&noGapB&&a&&b){
        const pair=a.slice(-1)+b.slice(0,1);
        if(/[\wа-яёА-ЯЁ][\wа-яёА-ЯЁ]/u.test(pair) && !/[\d][\d]/.test(pair)){
          found.push({scr, frag:(a.slice(-18)+'▮'+b.slice(0,18))});
        }
      }
    }
    prev=t;
  }
}
screens.forEach(([name,code])=>{
  w.eval(code);
  const on=d.querySelector('.screen.on');
  walk(on,name);
  // ещё ищем в готовом тексте характерные склейки
  const txt=on.textContent.replace(/\s+/g,' ');
  const pats=[/[а-яё][A-ZА-ЯЁ]/g, /\d[А-Яа-яёA-Za-z]/g, /[а-яёa-z]\d/g, /[.!?][А-ЯA-Z]/g, /·[^\s]/g, /[^\s]·/g];
  pats.forEach(p=>{ const m=txt.match(p); if(m) m.slice(0,6).forEach(x=>{
    const i=txt.indexOf(x); found.push({scr:name, frag:txt.slice(Math.max(0,i-16),i+18)});
  });});
});
const uniq=[...new Map(found.map(f=>[f.scr+f.frag,f])).values()];
console.log('НАЙДЕНО ПОДОЗРИТЕЛЬНЫХ МЕСТ:', uniq.length);
uniq.forEach(f=>console.log('  ['+f.scr+']', JSON.stringify(f.frag)));
