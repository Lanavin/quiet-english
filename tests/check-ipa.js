const {JSDOM}=require('jsdom'),fs=require('fs'),path=require('path');
const dom=new JSDOM(fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8'),
 {url:'http://localhost/',runScripts:'dangerously',beforeParse(w){w.speechSynthesis={getVoices:()=>[],speak(){},cancel(){}};w.SpeechSynthesisUtterance=function(){};w.scrollTo=()=>{}}});
const w=dom.window, E=s=>w.eval(s);
const DECKS=E('DECKS'), COMMON=E('COMMON');

const IPA = new Set([...'ɑɒæʌəɜɪiʊueɛɔɐaoːˈˌ', ...'pbtdkɡfvθðszʃʒhmnŋlrjw', ...'tʃdʒ', ...'ɪəeəʊəaɪaʊɔɪeɪəʊ', "'", '-', ' ']);
const problems=[];
const all=[];
DECKS.forEach(d=>d.words.forEach(x=>all.push([x[0],x[1],'колода '+d.id])));
Object.entries(COMMON).forEach(([k,v])=>all.push([k,v[0],'служебные']));

all.forEach(([word,ipa,src])=>{
  const bad=[...ipa].filter(c=>!IPA.has(c));
  if(bad.length) problems.push(`${word} /${ipa}/ — недопустимые знаки: ${bad.join(' ')} (${src})`);
  // ударение в многосложных
  const vowels=(ipa.match(/[ɑɒæʌəɜɪiʊueɔaoɐ]/g)||[]).length;
  if(vowels>=3 && !/[ˈˌ]/.test(ipa)) problems.push(`${word} /${ipa}/ — нет знака ударения (${src})`);
  // долгота там, где её быть не может
  if(/[æɪʊeɒʌə]ː/.test(ipa)) problems.push(`${word} /${ipa}/ — долгота у краткого гласного (${src})`);
  // ударение не в начале слога / двойное
  if((ipa.match(/ˈ/g)||[]).length>1) problems.push(`${word} /${ipa}/ — два главных ударения (${src})`);
  // характерные буквосочетания
  if(/^kn/.test(word) && /^kn/.test(ipa)) problems.push(`${word} /${ipa}/ — kn- читается как /n/ (${src})`);
  if(/^wr/.test(word) && /^wr/.test(ipa)) problems.push(`${word} /${ipa}/ — wr- читается как /r/ (${src})`);
  if(/ght/.test(word) && /ɡt|xt/.test(ipa)) problems.push(`${word} /${ipa}/ — -ght- не даёт /ɡ/ (${src})`);
  if(/tion$/.test(word) && !/ʃn|ʃən/.test(ipa)) problems.push(`${word} /${ipa}/ — -tion даёт /ʃn/ (${src})`);
  if(/^[aeiou]/.test(word)===false && /^ə/.test(ipa) && word.length>4 && !/^[^aeiou]*[aeiou]/.test(word[0])) {}
});

console.log('Проверено транскрипций:', all.length);
console.log('Найдено проблем:', problems.length);
problems.forEach(p=>console.log('  ', p));

// длина: транскрипция резко короче/длиннее слова
console.log('\nПодозрительно короткие/длинные транскрипции:');
all.forEach(([wd,ipa])=>{
  const clean=ipa.replace(/[ˈˌː]/g,'');
  if(clean.length < wd.length*0.35 || clean.length > wd.length*1.6)
    console.log(`   ${wd} /${ipa}/`);
});
