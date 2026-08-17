/* Проверка самого английского материала: транскрипции, грамматика примеров,
   формы глаголов. Всё, что можно проверить машиной, проверяется машиной. */
const {JSDOM}=require('jsdom'),fs=require('fs'),path=require('path');
const dom=new JSDOM(fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8'),
 {url:'http://localhost/',runScripts:'dangerously',beforeParse(w){w.speechSynthesis={getVoices:()=>[],speak(){},cancel(){}};w.SpeechSynthesisUtterance=function(){};w.scrollTo=()=>{}}});
const E=s=>dom.window.eval(s);
const DECKS=E('DECKS'), COMMON=E('COMMON'), IRREG=E('IRREG'), TRIPS=E('TRIPS'), TEXTS=E('TEXTS'), SOUNDS=E('SOUNDS');
const issues=[]; const add=(cat,msg)=>issues.push([cat,msg]);

/* ---------- 1. Транскрипция против написания ---------- */
const all=[];
DECKS.forEach(d=>d.words.forEach(x=>all.push({w:x[0].toLowerCase(), ipa:x[1], tr:x[2], pos:x[3], ex:x[4], exru:x[5], src:d.id})));
Object.entries(COMMON).forEach(([k,v])=>all.push({w:k, ipa:v[0], tr:v[1], src:'служебные'}));

const bare = ipa => ipa.replace(/[ˈˌ]/g,'');   // без знаков ударения: они мешали сопоставлять
const RULES=[
 [/^th/, /^[ðθ]/, 'слово на th- должно начинаться с θ или ð'],
 [/tion$/, /ʃ(ə)?n$/, 'окончание -tion читается как /ʃn/'],
 [/sion$/, /[ʃʒ](ə)?n$/, 'окончание -sion читается как /ʃn/ или /ʒn/'],
 [/^wr/, /^r/, 'wr- читается как /r/'],
 [/^kn/, /^n/, 'kn- читается как /n/'],
 [/ing$/, /ɪŋ$/, 'окончание -ing читается как /ɪŋ/'],
 [/ck$/, /k$/, '-ck читается как /k/'],
 [/^ph/, /^f/, 'ph- читается как /f/'],
 [/dge$/, /dʒ$/, '-dge читается как /dʒ/'],
 [/^qu/, /^kw/, 'qu- читается как /kw/'],
 [/ough$/, /(ʌf|əʊ|uː|ɒf|aʊ|ɔː)$/, '-ough имеет одно из известных чтений'],
];
all.forEach(x=>{
  if(!/^[a-z']+$/.test(x.w)) return;
  RULES.forEach(([sp,ph,msg])=>{ if(sp.test(x.w) && !ph.test(bare(x.ipa))) add('транскрипция', `${x.w} /${x.ipa}/ — ${msg}`); });
  // немая -e не должна звучать как чистое /e/
  if(/[^aeiou]e$/.test(x.w) && /e$/.test(bare(x.ipa)) && !/(the|be|he|she|we|me)$/.test(x.w))
    add('транскрипция', `${x.w} /${x.ipa}/ — конечная -e обычно немая`);
});
// одинаковая транскрипция у разных слов — либо омофоны, либо опечатка
const byIpa={};
all.forEach(x=>{ if(!/^[a-z]+$/.test(x.w)) return; (byIpa[x.ipa]=byIpa[x.ipa]||[]).push(x.w); });
const KNOWN_HOMOPHONES=[['read','red'],['son','sun'],['see','sea'],['their','there'],['two','to','too'],['no','know'],['write','right'],['hear','here'],['by','buy'],['one','won'],['week','weak'],['meat','meet'],['peace','piece'],['wear','where'],['flour','flower'],['knows','nose']];
Object.entries(byIpa).forEach(([ipa,ws])=>{
  const u=[...new Set(ws)];
  if(u.length<2) return;
  const known=KNOWN_HOMOPHONES.some(g=>u.every(x=>g.includes(x)));
  if(!known) add('омофоны (проверить глазами)', `/${ipa}/ — ${u.join(', ')}`);
});

/* ---------- 2. Грамматика примеров ---------- */
const VOWEL_LETTERS=/^[aeiou]/;
const A_EXCEPT_VOWEL=/^(hour|honest|honour)/;      // пишется на согласную, звучит на гласную
const AN_EXCEPT_CONS=/^(uni|use|user|euro|one|once)/; // пишется на гласную, звучит на согласную
const sentences=[];
all.forEach(x=>{ if(x.ex) sentences.push([x.ex, x.exru, 'пример к слову '+x.w]); });
TRIPS.forEach(g=>g.scenes.forEach(s=>{
  s.say.forEach(p=>sentences.push([p[0],p[1],'фраза, сцена «'+s.t+'»']));
  s.hear.forEach(p=>sentences.push([p[0],p[1],'ответная реплика, сцена «'+s.t+'»']));
}));
TEXTS.forEach(t=>t.body.forEach(b=>sentences.push([b[0],b[1],'текст «'+t.title+'»'])));
E('GRAMMAR').forEach(g=>g.examples.forEach(e=>sentences.push([e[0],e[1],'пример темы «'+g.title+'»'])));

sentences.forEach(([en,ru,src])=>{
  // артикль a / an
  const m=[...en.matchAll(/\b(a|an)\s+([A-Za-z]+)/g)];
  m.forEach(mm=>{
    const art=mm[1].toLowerCase(), next=mm[2].toLowerCase();
    const soundsVowel = (VOWEL_LETTERS.test(next) && !AN_EXCEPT_CONS.test(next)) || A_EXCEPT_VOWEL.test(next);
    if(soundsVowel && art==='a') add('артикль', `«${mm[0]}» → нужен an · ${src}`);
    if(!soundsVowel && art==='an') add('артикль', `«${mm[0]}» → нужен a · ${src}`);
  });
  // предложение начинается с заглавной и кончается знаком
  if(!/^[A-Z"']/.test(en)) add('оформление', `не с заглавной: «${en}» · ${src}`);
  if(!/[.!?]$/.test(en)) add('оформление', `нет конечного знака: «${en}» · ${src}`);
  if(/\s{2,}/.test(en)) add('оформление', `двойной пробел: «${en}» · ${src}`);
  if(/\bi\b/.test(en)) add('оформление', `местоимение I со строчной: «${en}» · ${src}`);
  // русский перевод есть и оформлен
  if(!/[а-яё]/i.test(ru)) add('перевод', `нет русского перевода: «${en}» · ${src}`);
  if(ru && !/[.!?»)]$/.test(ru)) add('перевод', `перевод без конечного знака: «${ru}» · ${src}`);
});

/* ---------- 3. Формы неправильных глаголов против эталона ---------- */
const REF={
 be:['was','been'],go:['went','gone'],do:['did','done'],see:['saw','seen'],take:['took','taken'],
 give:['gave','given'],write:['wrote','written'],speak:['spoke','spoken'],break:['broke','broken'],
 choose:['chose','chosen'],drive:['drove','driven'],eat:['ate','eaten'],fall:['fell','fallen'],
 forget:['forgot','forgotten'],wake:['woke','woken'],wear:['wore','worn'],hide:['hid','hidden'],
 steal:['stole','stolen'],rise:['rose','risen'],show:['showed','shown'],
 know:['knew','known'],grow:['grew','grown'],throw:['threw','thrown'],blow:['blew','blown'],
 fly:['flew','flown'],draw:['drew','drawn'],
 buy:['bought','bought'],bring:['brought','brought'],think:['thought','thought'],
 fight:['fought','fought'],catch:['caught','caught'],teach:['taught','taught'],
 have:['had','had'],make:['made','made'],say:['said','said'],get:['got','got'],
 find:['found','found'],hear:['heard','heard'],hold:['held','held'],keep:['kept','kept'],
 sleep:['slept','slept'],feel:['felt','felt'],leave:['left','left'],meet:['met','met'],
 lose:['lost','lost'],sit:['sat','sat'],stand:['stood','stood'],understand:['understood','understood'],
 pay:['paid','paid'],tell:['told','told'],sell:['sold','sold'],spend:['spent','spent'],
 send:['sent','sent'],lend:['lent','lent'],build:['built','built'],mean:['meant','meant'],
 feed:['fed','fed'],lead:['led','led'],learn:['learnt','learnt'],
 sing:['sang','sung'],drink:['drank','drunk'],swim:['swam','swum'],begin:['began','begun'],ring:['rang','rung'],
 come:['came','come'],become:['became','become'],run:['ran','run'],
 put:['put','put'],cut:['cut','cut'],let:['let','let'],set:['set','set'],hit:['hit','hit'],
 cost:['cost','cost'],shut:['shut','shut'],hurt:['hurt','hurt'],read:['read','read']
};
let checked=0;
IRREG.forEach(g=>g.verbs.forEach(v=>{
  const ref=REF[v[0]];
  if(!ref){ add('глаголы', `${v[0]} — нет в эталонном списке, проверить вручную`); return; }
  checked++;
  if(v[1]!==ref[0]) add('глаголы', `${v[0]}: прошедшее «${v[1]}», ожидалось «${ref[0]}»`);
  if(v[2]!==ref[1]) add('глаголы', `${v[0]}: третья форма «${v[2]}», ожидалось «${ref[1]}»`);
}));
// дубли внутри таблицы
const seenV={};
IRREG.forEach(g=>g.verbs.forEach(v=>{ if(seenV[v[0]]) add('глаголы',`${v[0]} встречается дважды: группы ${seenV[v[0]]} и ${g.id}`); seenV[v[0]]=g.id; }));

/* ---------- 4. Минимальные пары действительно минимальны ---------- */
SOUNDS.forEach(s=>s.pairs.forEach(p=>{
  const [a,b]=p;
  if(a===b) add('звуки', `пара ${a} — ${b} совпадает`);
  if(Math.abs(a.length-b.length)>3) add('звуки', `пара «${a} — ${b}» (${s.sym}) слишком разной длины`);
}));

/* ---------- вывод ---------- */
console.log('Проверено: '+all.length+' слов, '+sentences.length+' предложений, '+checked+' глаголов по эталону');
console.log(issues.length ? '\nНАЙДЕНО ЗАМЕЧАНИЙ: '+issues.length : '\nЗамечаний нет');
const byCat={};
issues.forEach(([c,m])=>{ (byCat[c]=byCat[c]||[]).push(m); });
Object.entries(byCat).forEach(([c,list])=>{
  console.log('\n── '+c.toUpperCase()+' ('+list.length+') ──');
  list.slice(0,40).forEach(m=>console.log('  • '+m));
  if(list.length>40) console.log('  … и ещё '+(list.length-40));
});
