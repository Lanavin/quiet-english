const {JSDOM}=require('jsdom'),fs=require('fs'),path=require('path');
const APP=path.join(__dirname,'..','index.html');
const src=fs.readFileSync(APP,'utf8');
const found=[];
const note=(cat,msg)=>found.push(cat+': '+msg);

const boot=()=>{ const dom=new JSDOM(src,{url:'http://localhost/',runScripts:'dangerously',pretendToBeVisual:true,
  beforeParse(w){w.speechSynthesis={getVoices:()=>[],speak(){},cancel(){}};w.SpeechSynthesisUtterance=function(){};
    w.scrollTo=()=>{};w.confirm=()=>true;w.alert=()=>{};w.prompt=()=>'x';}});
  return dom.window; };

/* ---- 1. Пустые и предельные состояния ---- */
{
  const w=boot(), d=w.document;
  w.eval('S.seen=true;save();go("home")');
  const t=()=>[...d.querySelectorAll('.screen.on')].map(x=>x.textContent).join(' ').replace(/\s+/g,' ');
  if(!/Путь/.test(t())) note('пустое состояние','на чистом старте не видно маршрута');
  // всё выучено
  w.eval('CARDS.forEach(c=>{S.cards[c.id]={ef:2.5,iv:200,reps:9,lapses:0,due:addDays(today(),60)}}); save(); go("home")');
  if(!/повторять нечего/i.test(t())) note('пустое состояние','когда очередь пуста, нет внятного сообщения');
  const btns=[...d.querySelectorAll('#home-body button')].map(x=>x.textContent.trim());
  if(!btns.some(x=>/Почитать|позаниматься/.test(x))) note('пустое состояние','нечего делать, когда очередь пуста');
  // маршрут пройден полностью
  w.eval('GRAMMAR.forEach(g=>S.quiz[g.id]={score:3}); TEXTS.forEach(t=>S.read[t.id]={done:true}); TRIPS.forEach(g=>g.scenes.forEach(s=>addScene(s.id))); addVerbGroup("v-all"); save(); go("home","path")');
  if(d.querySelectorAll('#home-body .pstep.now').length!==0 && !/Все шаги пройдены/.test(t()))
    note('маршрут','после прохождения всех шагов нет финального состояния');
  w.eval('go("home")');
  if(/шаг 10 из 9/.test(t())) note('маршрут','счётчик шагов выходит за пределы');
  // сессия из одной карточки
  w.eval('S.cards={}; save(); go("cards"); startSession(1); flip=true; render()');
  if(d.querySelectorAll('.grade').length!==4) note('сессия','в сессии из одной карточки нет оценок');
  // поиск без запроса и с бессмыслицей
  w.eval('go("home");go("cards")');
  const si=d.querySelector('#cards-body input[type=search]');
  if(!si) note('поиск','поле поиска не найдено');
  else { si.value='щщщ'; si.dispatchEvent(new w.Event('input'));
    if(!/Ничего не нашлось/.test(t())) note('поиск','нет сообщения о пустом результате'); }
}

/* ---- 2. Обе темы: все экраны рисуются, ничего не пропадает ---- */
{
  const w=boot(), d=w.document;
  w.eval('S.seen=true; CARDS.slice(0,80).forEach(c=>{S.cards[c.id]={ef:2.5,iv:6,reps:3,lapses:0,due:today()}}); addScene("help"); addVerbGroup("v-iau"); save()');
  const screens=[['home','go("home")'],['путь','go("home","path")'],['механика','go("home","how")'],
    ['слова','go("home");go("cards")'],['карточка','go("cards");startSession();flip=true;render()'],
    ['разговорник','go("trip")'],['сцена','go("trip","help")'],['грамматика','go("gram",2)'],
    ['глаголы','go("gram","verbs")'],['звук','go("sound",0)'],['чтение','go("read",0)'],['тексты','go("read")']];
  ['light','dark'].forEach(theme=>{
    w.eval(`S.opts.theme="${theme}"; save(); applyTheme();`);
    screens.forEach(([name,code])=>{
      w.eval(code);
      const on=d.querySelector('.screen.on');
      if(!on || on.innerHTML.length<200) note('тема '+theme, 'экран «'+name+'» почти пустой');
      // ищем жёстко заданные цвета в разметке — они не переживают смену темы
      const hard=on.innerHTML.match(/(?:color|background)\s*:\s*#[0-9a-f]{3,6}/gi);
      if(hard) note('тема '+theme, 'экран «'+name+'» содержит цвет мимо переменных: '+[...new Set(hard)].join(', '));
    });
  });
}

/* ---- 3. Целевые размеры нажатия и доступность ---- */
{
  const css=src.split('<style>')[1].split('</style>')[0];
  const small=[];
  [...css.matchAll(/\.([\w-]+)\{[^}]*min-height:(\d+)px/g)].forEach(m=>{ if(+m[2]<34) small.push('.'+m[1]+' '+m[2]+'px'); });
  if(small.length) note('нажатие','мелкие цели: '+small.join(', '));
  if(!/:focus/.test(css)) note('доступность','нигде не описан видимый фокус для клавиатуры');
  if(!/prefers-reduced-motion/.test(css)) note('доступность','не учтено системное «уменьшить движение»');
  // подписи у полей ввода
  const inputs=[...src.matchAll(/<input[^>]*type="(search|text)"[^>]*>/g)].map(m=>m[0]);
  inputs.forEach(i=>{ if(!/placeholder=|aria-label=/.test(i)) note('доступность','поле ввода без подписи: '+i.slice(0,60)); });
  // язык страницы и заголовок
  if(!/<html lang="ru"/.test(src)) note('доступность','не указан язык страницы');
  // альтернативы у svg
  const svgs=[...src.matchAll(/<svg[^>]*>/g)].map(m=>m[0]);
  const noRole=svgs.filter(x=>!/role="img"|aria-hidden/.test(x)).length;
  if(noRole>svgs.length*0.5) note('доступность', noRole+' из '+svgs.length+' рисунков без описания (иконки — норма)');
}

/* ---- 4. Длинные слова и предельный текст ---- */
{
  const w=boot(), d=w.document;
  w.eval('S.seen=true; S.custom["zz"]={id:"zz",deck:"custom",w:"internationalization",ipa:"ˌɪntəˌnæʃnəlaɪˈzeɪʃn",tr:"интернационализация процессов разработки",pos:"сущ",ex:"Internationalization takes time.",exru:"Интернационализация занимает время."}; S.cards["zz"]=newState(); save(); go("cards"); startSession(); session.q=["zz"]; flip=true; render()');
  const term=d.querySelector('.face.back .term');
  const style=w.getComputedStyle(term);
  if(style.overflowWrap!=='anywhere' && style.wordBreak!=='break-word')
    note('вёрстка','длинное слово может вылезти за карточку');
  if(parseFloat(style.fontSize)>34) note('вёрстка','для длинного слова не уменьшается кегль: '+style.fontSize);
}

/* ---- 5. Единство формулировок ---- */
{
  const w=boot(), d=w.document;
  w.eval('S.seen=true;save()');
  const texts=[];
  [['home','go("home")'],['cards','go("home");go("cards")'],['trip','go("trip")'],['read','go("read")'],['gram','go("gram")'],['sound','go("sound")']]
    .forEach(([n,c])=>{ w.eval(c); texts.push(d.querySelector('.screen.on').textContent); });
  const all=texts.join(' ');
  if(/\bвы\b/i.test(all) && /\bты\b/i.test(all)) {
    const tyi=(all.match(/\b(ты|тебе|твой|твоя|тебя)\b/gi)||[]).length;
    const vy=(all.match(/\b(вы|вам|ваш|ваша|вас)\b/gi)||[]).length;
    note('формулировки','смешаны обращения на «ты» ('+tyi+') и на «вы» ('+vy+')');
  }
}

console.log(found.length ? 'НАЙДЕНО ЗАМЕЧАНИЙ: '+found.length : 'Замечаний нет');
found.forEach(f=>console.log('  • '+f));
