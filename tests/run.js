/* Тесты Quiet English.
   Запуск:  cd english/tests && npm i jsdom && node run.js
   Проверяют три вещи: алгоритм повторений, целостность данных и живой интерфейс. */

const {JSDOM} = require('jsdom');
const fs = require('fs');
const path = require('path');
const APP = path.join(__dirname, '..', 'index.html');

let fail = 0;
const ok = (c, m) => { if(!c){ console.log('  ПРОВАЛ:', m); fail++; } else console.log('  ок —', m); };
const head = t => console.log('\n' + t);

/* ---------- поднимаем приложение в jsdom ---------- */
const errs = [];
const dom = new JSDOM(fs.readFileSync(APP, 'utf8'), {
  url: 'http://localhost/', runScripts: 'dangerously', pretendToBeVisual: true,
  beforeParse(w){
    w.speechSynthesis = {getVoices:()=>[], speak(){}, cancel(){}};
    w.SpeechSynthesisUtterance = function(){};
    w.confirm = () => true;
    w.scrollTo = () => {};
    w.addEventListener('error', e => errs.push('ошибка окна: ' + e.message));
  }
});
const w = dom.window, d = w.document;
const E = s => w.eval(s);                 // доступ к let/const внутри скрипта
const origErr = w.console.error;
w.console.error = (...a) => { errs.push('console.error: ' + a.join(' ')); origErr(...a); };
/* Только видимый экран. Через body.textContent пролезал бы исходник <script>,
   и проверки на текст давали бы ложное «прошло». */
const txt = () => [...d.querySelectorAll('.screen.on')].map(x => x.textContent).join(' ').replace(/\s+/g, ' ');

/* ================= 1. АЛГОРИТМ ПОВТОРЕНИЙ ================= */
head('[1] Алгоритм интервальных повторений (SM-2)');
const {schedule, newState, addDays, diffDays} = {
  schedule: E('schedule'), newState: E('newState'), addDays: E('addDays'), diffDays: E('diffDays')
};

ok(addDays('2026-08-05', 1) === '2026-08-06', 'прибавление дня');
ok(addDays('2026-02-28', 1) === '2026-03-01', 'переход через конец февраля');
ok(addDays('2024-02-28', 1) === '2024-02-29', 'високосный год');
ok(addDays('2026-12-31', 1) === '2027-01-01', 'переход через новый год');
ok(diffDays('2026-08-01', '2026-08-05') === 4 && diffDays('2026-08-05', '2026-08-01') === -4, 'разница дат в обе стороны');

let s = newState(), day = '2026-08-05', ladder = [];
for(let i=0;i<7;i++){ s = schedule(s, 2, day); ladder.push(s.iv); day = s.due; }
ok(ladder[0] === 1 && ladder[1] === 3, 'первые интервалы 1 и 3 дня');
ok(ladder.every((v,i) => i === 0 || v > ladder[i-1]), 'интервалы растут: ' + ladder.join(' → ') + ' дней');

let a = newState(); a = schedule(a, 2, '2026-08-05'); a = schedule(a, 2, a.due); a = schedule(a, 2, a.due);
const efBefore = a.ef;
a = schedule(a, 0, '2026-09-01');
ok(a.iv === 0, 'оценка «не помню» возвращает карточку в текущую сессию');
ok(a.reps === 0 && a.lapses === 1, 'счётчик повторений сброшен, промах зафиксирован');
ok(a.ef < efBefore, 'коэффициент лёгкости снижен');

let b = newState(); for(let i=0;i<40;i++) b = schedule(b, 0, '2026-08-05');
ok(b.ef >= 1.3, 'коэффициент не падает ниже 1.3 (факт ' + b.ef.toFixed(2) + ')');
let c = newState(), cd = '2026-08-05'; for(let i=0;i<40;i++){ c = schedule(c, 3, cd); cd = c.due; }
ok(c.ef <= 3.0 && c.iv <= 365, 'коэффициент и интервал не улетают в бесконечность');

let base = newState(); base = schedule(base, 2, '2026-08-05'); base = schedule(base, 2, base.due); base = schedule(base, 2, base.due);
const hard = schedule(base,1,'2026-08-20').iv, good = schedule(base,2,'2026-08-20').iv, easy = schedule(base,3,'2026-08-20').iv;
ok(hard < good && good < easy, `оценки упорядочены: трудно ${hard}д < нормально ${good}д < легко ${easy}д`);

/* Главное обещание продукта: пропуск не наказывается */
let p = newState(), pd = '2026-08-05';
for(let i=0;i<4;i++){ p = schedule(p, 2, pd); pd = p.due; }
const snap = JSON.stringify(p);
const late = schedule(JSON.parse(snap), 2, '2026-12-31');
const onTime = schedule(JSON.parse(snap), 2, p.due);
ok(late.iv === onTime.iv && late.ef === onTime.ef, 'опоздание на три месяца не меняет ни интервал, ни коэффициент');
ok(diffDays('2026-12-31', late.due) === late.iv, 'следующий показ считается от дня ответа, а не от плановой даты');

let z = newState(), zd = '2026-08-05';
for(let i=0;i<200;i++){ z = schedule(z, [0,1,2,3][i%4], zd); zd = z.due; }
ok(Number.isFinite(z.iv) && Number.isFinite(z.ef) && /^\d{4}-\d{2}-\d{2}$/.test(z.due), 'состояние остаётся валидным после 200 ответов');

/* ================= 2. ДАННЫЕ ================= */
head('[2] Целостность данных');
const DECKS = E('DECKS'), GRAMMAR = E('GRAMMAR'), SOUNDS = E('SOUNDS'), TEXTS = E('TEXTS'), TRIPS = E('TRIPS'), CARDS = E('CARDS');
const resolve = E('resolve'), lemmas = E('lemmas');

const allWords = [];
DECKS.forEach(dk => dk.words.forEach(x => allWords.push(x[0].toLowerCase())));
const dups = allWords.filter((x,i) => allWords.indexOf(x) !== i);
ok(dups.length === 0, `в колодах нет дублей (${allWords.length} слов, ${CARDS.length} уникальных карточек)`);

let bad = 0;
DECKS.forEach(dk => dk.words.forEach(x => {
  if(x.length !== 6 || x.some(f => !String(f).trim())) bad++;
  if(!/^[a-zA-Z' -]+$/.test(x[0])) bad++;
  if(!/[а-яё]/i.test(x[2])) bad++;
  if(!/^[A-Z]/.test(x[4]) || !/[.!?]$/.test(x[4])) bad++;
  if(!/[.!?]$/.test(x[5])) bad++;
}));
ok(bad === 0, 'у каждого слова заполнены все шесть полей, перевод по-русски, пример — законченное предложение');

let gbad = 0;
GRAMMAR.forEach(g => {
  ['id','title','sub','core','why','trap'].forEach(k => { if(!g[k]) gbad++; });
  if(g.examples.length < 3 || g.quiz.length < 3) gbad++;
  g.quiz.forEach(q => {
    if(!Number.isInteger(q.a) || q.a < 0 || q.a >= q.o.length) gbad++;
    if(new Set(q.o).size !== q.o.length) gbad++;
    if(!q.e || q.e.length < 45) gbad++;
  });
});
ok(gbad === 0, `грамматика: ${GRAMMAR.length} тем, ${GRAMMAR.reduce((n,g)=>n+g.quiz.length,0)} вопросов, у всех верный индекс ответа и развёрнутое объяснение`);

let sbad = 0;
SOUNDS.forEach(x => {
  ['sym','name','words','lipread','trap','side','front'].forEach(k => { if(!x[k]) sbad++; });
  if(x.steps.length < 3 || x.pairs.length < 3) sbad++;
  if(x.pairs.some(pr => pr.length !== 2 || pr[0] === pr[1])) sbad++;
});
ok(sbad === 0, `звуки: ${SOUNDS.length} штук, у каждого две схемы, шаги и минимальные пары`);

/* Покрытие переводом: ни одного слова без подсказки */
let uncovered = [];
TEXTS.forEach(t => {
  const words = [...new Set((t.body.map(x=>x[0]).join(' ').toLowerCase().match(/[a-z']+/g) || []))];
  words.forEach(x => { const k = x.replace(/^'+|'+$/g,''); if(k && !resolve(k, t)) uncovered.push(t.id + ':' + k); });
  Object.keys(t.gloss).forEach(k => { if(!words.includes(k)) uncovered.push(t.id + ': лишняя глосса ' + k); });
});
ok(uncovered.length === 0, `в текстах переведены все слова${uncovered.length ? ': ' + uncovered.join(' ') : ''}`);

let tripMiss = [];
TRIPS.forEach(g => g.scenes.forEach(sc => [...sc.say, ...sc.hear].forEach(pr => {
  (pr[0].toLowerCase().match(/[a-z']+/g) || []).forEach(x => {
    const k = x.replace(/^'+|'+$/g,''); if(k && !resolve(k, null)) tripMiss.push(k);
  });
})));
const scenes = TRIPS.reduce((n,g)=>n+g.scenes.length,0);
const says = TRIPS.reduce((n,g)=>n+g.scenes.reduce((m,x)=>m+x.say.length,0),0);
const hears = TRIPS.reduce((n,g)=>n+g.scenes.reduce((m,x)=>m+x.hear.length,0),0);
ok(tripMiss.length === 0, `разговорник: ${scenes} сцен, ${says} своих реплик и ${hears} ответных, все слова переведены${tripMiss.length?': '+[...new Set(tripMiss)].join(' '):''}`);

let trbad = 0;
TRIPS.forEach(g => g.scenes.forEach(sc => {
  if(!sc.id || !sc.t || !sc.say.length || !sc.hear.length) trbad++;
  [...sc.say, ...sc.hear].forEach(pr => { if(pr.length !== 2 || !/[а-яё]/i.test(pr[1])) trbad++; });
}));
const sceneIds = TRIPS.flatMap(g => g.scenes.map(x => x.id));
ok(trbad === 0 && new Set(sceneIds).size === sceneIds.length, 'у всех сцен уникальные идентификаторы и парные переводы');

const lem = [['words','word'],['minutes','minute'],['stopped','stop'],['making','make'],['tries','try'],['boxes','box'],['happier','happy'],['studies','study']];
ok(lem.every(([f,exp]) => lemmas(f).includes(exp)), 'словоформы приводятся к начальной форме (' + lem.length + ' проверок)');

/* ================= 3. ИНТЕРФЕЙС ================= */
head('[3] Экран знакомства');
ok(/Коротко о том, как это работает/.test(txt()), 'при первом запуске показан экран знакомства');
ok(/ничего не сгорает/i.test(txt()) && /Чтение важнее аудирования/.test(txt()), 'объяснены ключевые принципы методики');
{ // интерфейс говорит одним голосом — на «ты»
  const uiScreens = ['S.seen=false;go("home")','S.seen=true;go("home")','go("home","path")','go("home","how")',
    'go("home");go("cards")','go("trip")','go("read")','go("gram")','go("sound")'];
  const vy = [];
  uiScreens.forEach(code => { w.eval(code);
    const t = d.querySelector('.screen.on').textContent.replace(/\s+/g,' ');
    (t.match(/\b(вы|вам|вас|ваш|ваша|ваше|ваши|вами)\b/gi) || []).forEach(x => vy.push(x)); });
  ok(vy.length === 0, 'интерфейс обращается на «ты» без сбоев на «вы»' + (vy.length ? ': ' + [...new Set(vy)].join(', ') : ''));
  w.eval('S.seen=false;go("home")');
}
[...d.querySelectorAll('#home-body button')].find(x => /Понятно/.test(x.textContent)).click();
ok(E('S').seen === true && !/Коротко о том/.test(txt()), 'экран закрывается по кнопке');
w.load(); w.render();
ok(!/Коротко о том/.test(txt()), 'после перезагрузки состояния больше не появляется');

head('[3b] Маршрут и объяснение механики');
w.eval('S.seen=true;save()');
w.go('home');
ok(/Путь · шаг 1 из 9/.test(txt()), 'на главной видно, на каком шаге маршрута человек находится');
w.go('home','path');
const steps = d.querySelectorAll('#home-body .pstep');
ok(steps.length === 9, 'маршрут состоит из девяти шагов');
ok(d.querySelectorAll('#home-body .pstep.now').length === 1, 'ровно один шаг помечен как текущий');
ok(/вы здесь/.test(txt()), 'текущий шаг подписан «вы здесь»');
ok([...steps].every(x => x.querySelector('.ptitle') && x.querySelector('.pmark')), 'у каждого шага есть название и номер');
const before1 = d.querySelectorAll('#home-body .pstep.done').length;
w.eval('addScene("help")'); w.go('home','path');
ok(d.querySelectorAll('#home-body .pstep.done').length === before1 + 1, 'шаг отмечается автоматически, когда задача выполнена');
w.go('home','how');
const how = txt();
ok(/Не помню/.test(how) && /Легко/.test(how), 'механика оценок объяснена');
ok(/интервал/i.test(how) && /выучено/.test(how), 'объяснено, откуда берутся интервалы и что значит «выучено»');
ok(/счётчик|счётчика/i.test(how), 'объяснено, почему нет счётчика дней подряд');
ok(!/он, она/.test(txt()) , 'загадочная подпись «он, она» больше не встречается');
w.go('home');

head('[3c] Числа на главной не противоречат друг другу');
w.eval('S.cards={}; CARDS.slice(0,90).forEach((c,i)=>{S.cards[c.id]={ef:2.5,iv:6,reps:i<70?3:1,lapses:0,due:today()}}); save()');
w.go('home');
{
  const m = [...d.querySelectorAll('#home-body .metrics > div')].map(x => +x.querySelector('b').textContent);
  ok(m[0] === 70 && m[1] === 20, `«выучено» и «учатся» — разные числа и в сумме дают начатые карточки: ${m[0]} + ${m[1]}`);
  ok(m[1] === Object.keys(E('S').cards).length - m[0], '«учатся» — это начатые минус выученные, а не общее число');
  const ttl = d.querySelectorAll('#home-body .ttl')[0].textContent;
  const sub = d.querySelectorAll('#home-body .sub')[0].textContent;
  const num = +(ttl.match(/шаг (\d+)/) || [0,0])[1];
  const steps = E('pathSteps')();
  ok(steps[num-1] && steps[num-1].t === sub.trim(), 'номер шага на главной совпадает с названием шага под ним');
  w.eval('CARDS.slice(0,60).forEach(c=>{S.cards[c.id]={ef:2.5,iv:6,reps:3,lapses:0,due:today()}}); save()');
  w.go('home');
  const ttl2 = d.querySelectorAll('#home-body .ttl')[0].textContent;
  const sub2 = d.querySelectorAll('#home-body .sub')[0].textContent;
  const num2 = +(ttl2.match(/шаг (\d+)/) || [0,0])[1];
  ok(E('pathSteps')()[num2-1].t === sub2.trim(), 'номер и название сходятся даже если шаг выполнен не по порядку');
}

head('[4] Навигация');
['cards','trip','gram','sound','read','home'].forEach(v => {
  w.go(v);
  ok(d.querySelector('#s-'+v).classList.contains('on') && d.querySelector('#'+v+'-body').innerHTML.length > 100, 'экран «' + v + '»');
});

head('[5] Сессия карточек');
w.go('cards'); w.startSession();
ok(E('session').total > 0, 'сессия собрана, карточек: ' + E('session').total);
E('delete S.cards[CARDS[0].id]; session.q.unshift(CARDS[0].id)'); w.render();   // новое слово спрашивается «англ → рус»
ok(/\/[^/]+\//.test(d.querySelector('.face.front').textContent), 'на лицевой стороне нового слова показана транскрипция');
ok(!/Не помню/.test(d.querySelector('#cards-body').textContent), 'оценки скрыты до переворота');
d.querySelector('.face').dispatchEvent(new w.MouseEvent('click', {bubbles:true}));
ok(/Не помню/.test(d.querySelector('#cards-body').textContent), 'после переворота появились оценки');
const prevs = [...d.querySelectorAll('.grade span')].map(x => x.textContent.trim());
ok(prevs.length === 4 && prevs.every(Boolean), 'у каждой оценки есть прогноз: ' + prevs.join(' | '));
let guard = 0;
while(E('session').q.length && guard++ < 900){
  const f = d.querySelector('.face'); if(f) f.dispatchEvent(new w.MouseEvent('click', {bubbles:true}));
  const g = d.querySelector('.grade.g' + (guard % 4)); if(!g) break; g.click();
}
ok(E('session').q.length === 0, 'сессия проходится до конца за ' + guard + ' шагов');
ok(/Готово/.test(txt()) && !/провал|плохо|мало|потерял/i.test(txt()), 'финальный экран без упрёков');
ok(d.querySelector('.finish .cat'), 'на финале встречает кот');
ok(/долгую память|ничего нового не закрепилось/.test(txt()), 'финал говорит, что именно сдвинулось');
const saved = JSON.parse(w.localStorage.getItem('quiet-english-v1'));
ok(saved && Object.keys(saved.cards).length > 0, 'прогресс сохранён: ' + Object.keys(saved.cards).length + ' карточек');
ok(Object.values(saved.cards).every(x => /^\d{4}-\d{2}-\d{2}$/.test(x.due) && x.ef >= 1.3), 'все сохранённые карточки валидны');

head('[5b] Оживление и быстрый старт');
w.go('home');
ok(d.querySelector('#home-body svg.scene'), 'на главной есть иллюстрация-пейзаж');
ok(d.querySelector('#home-body svg.cat'), 'на главной есть кот');
ok(d.querySelector('#home-body .arch'), 'герой оформлен аркой');
const quick=[...d.querySelectorAll('#home-body button')].find(x=>/Только пять/.test(x.textContent));
if(quick){ quick.click(); ok(E('session').total===5, 'режим «только пять карточек» ограничивает сессию'); }
else ok(true, 'быстрый режим скрыт: очередь и так короткая');
w.go('cards'); w.startSession();
const flipEl=d.querySelector('.flip');
ok(flipEl && !flipEl.classList.contains('flipped'), 'карточка не перевёрнута на старте');
ok(d.querySelectorAll('.flip-inner > .face').length===2, 'обе стороны карточки в разметке — переворот настоящий, а не перерисовка');
d.querySelector('.face').dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
ok(d.querySelector('.flip').classList.contains('flipped'), 'после нажатия карточка переворачивается');
ok(typeof w.shareCard === 'function', 'генератор картинки для шеринга подключён');
const svgs = E('SOUNDS').length;
ok(E('scene')('morning').includes('<svg') && E('cat')(80,'sleep').includes('<svg'), 'иллюстрации рисуются своим кодом, без внешних картинок');
ok(!/<img|url\(http|background-image/i.test(fs.readFileSync(APP,'utf8')), 'в проекте нет ни одной внешней или чужой картинки');

head('[5c] Формы глаголов');
const IRREG = E('IRREG'), verbForms = E('verbForms');
const vTotal = IRREG.reduce((n,g)=>n+g.verbs.length,0);
let vbad = 0;
IRREG.forEach(g => { if(!g.id||!g.name||!g.note||!g.verbs.length) vbad++;
  g.verbs.forEach(v => { if(v.length!==4) vbad++;
    if(!/^[a-z]+$/.test(v[0])||!/^[a-z]+$/.test(v[1])||!/^[a-z]+$/.test(v[2])) vbad++;
    if(!/[а-яё]/i.test(v[3])) vbad++; }); });
ok(vbad === 0, `неправильные глаголы: ${vTotal} штук в ${IRREG.length} группах, у всех три формы и перевод`);
const regular = [['work','worked'],['like','liked'],['study','studied'],['stop','stopped'],
  ['play','played'],['carry','carried'],['travel','travelled'],['plan','planned'],['visit','visited']];
ok(regular.every(([v,exp]) => verbForms(v).past === exp), 'правило для правильных глаголов работает, включая удвоение и -ied');
const irregSample = [['go','went','gone'],['buy','bought','bought'],['put','put','put'],
  ['sing','sang','sung'],['know','knew','known'],['write','wrote','written']];
ok(irregSample.every(([v,p,pp]) => verbForms(v).past === p && verbForms(v).part === pp && verbForms(v).irregular),
   'неправильные глаголы берутся из таблицы и помечены как неправильные');
w.go('gram','verbs');
ok(/Формы глаголов/.test(txt()) && d.querySelectorAll('#gram-body .vtable').length === IRREG.length,
   'экран форм глаголов показывает все группы таблицами');
const vWas = Object.keys(E('S').cards).length;
[...d.querySelectorAll('#gram-body button')].find(x=>/Учить эту группу/.test(x.textContent)).click();
ok(Object.keys(E('S').cards).length > vWas, 'группу глаголов можно взять в повторение одной кнопкой');
w.go('cards'); w.startSession();
let vId = null, vg = 0;
while(E('session').q.length && vg++ < 600){
  const id = E('session').q[0];
  if(id.indexOf('v:') === 0){ vId = id; break; }
  const f = d.querySelector('.face'); if(f) f.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
  const g = d.querySelector('.grade.g2'); if(!g) break; g.click();
}
ok(vId, 'карточка форм глагола попадает в очередь: ' + vId);
if(vId){
  ok(/какие формы/.test(d.querySelector('.face.front').textContent), 'лицевая сторона спрашивает формы, а не значение');
  const vb = d.querySelector('.face.back').textContent;
  ok(/начальная форма/.test(vb) && /вчера/.test(vb) && /после have/.test(vb), 'на обороте все три формы с понятными подписями');
}
// формы обычного глагола прямо на карточке слова
w.go('cards'); E('flip=true'); w.render();
const anyVerb = E('CARDS').find(c => c.pos === 'гл');
const fb = E('formsBlock')(anyVerb.w);
ok(fb.includes('he, she, it') && fb.includes('I have') && !fb.includes('он, она'),
   'подписи форм объясняют, где форма используется, вместо загадочного «он, она»');

head('[5d] Упражнение на вписывание');
const clozeFor = E('clozeFor');
const canCloze = E('CARDS').filter(c => clozeFor(c)).length;
ok(canCloze / E('CARDS').length > 0.9, `пропуск строится для ${canCloze} из ${E('CARDS').length} слов`);
const cBuy = clozeFor(E('CARDS').find(c => c.w === 'buy'));
ok(cBuy && cBuy.answer === 'bought' && cBuy.changed,
   'в примере находится изменённая форма слова и помечается как изменённая');
const cWater = clozeFor(E('CARDS').find(c => c.w === 'water'));
ok(cWater && cWater.text.includes('_____') && !cWater.text.includes('water'), 'само слово из примера убрано');
w.eval('const id=CARDS.find(c=>c.w==="water").id; S.cards[id]={ef:2.5,iv:3,reps:2,lapses:0,due:today()}; save(); go("cards"); startSession(); session.q=[id]; render();');
ok(!!d.getElementById('cloze-in'), 'у слова с двумя повторениями спрашивают ввод, а не переворот');
d.getElementById('cloze-in').value = 'water';
[...d.querySelectorAll('#cards-body button')].find(x=>/Проверить/.test(x.textContent)).click();
ok(/Верно/.test(d.querySelector('.cloze-res').textContent) && d.querySelectorAll('.grade').length === 4,
   'верный ответ засчитывается и открывает оценки');
w.eval('session.cloze=null; render()');
d.getElementById('cloze-in').value = 'wotter';
[...d.querySelectorAll('#cards-body button')].find(x=>/Проверить/.test(x.textContent)).click();
ok(/Правильно/.test(d.querySelector('.cloze-res').textContent) && /wotter/.test(d.querySelector('.cloze-res').textContent),
   'при ошибке показан верный ответ и то, что было написано');
w.eval('S.opts.write=false; save(); session.cloze=null; go("cards"); startSession(); session.q=[CARDS.find(c=>c.w==="water").id]; render()');
ok(!d.getElementById('cloze-in'), 'упражнение можно выключить в настройках');
w.eval('S.opts.write=true; save()');

head('[5e] Трудные слова, поиск и резервная копия');
w.eval('const id=CARDS.find(c=>c.w==="water").id; S.cards[id]={ef:1.6,iv:1,reps:1,lapses:5,due:today()}; save()');
w.go('home'); w.go('cards');   // выходим из сессии, чтобы увидеть экран со списками
ok(E('leechList')().length >= 1, 'слово с пятью промахами попадает в список трудных');
ok(/Трудные слова/.test(txt()), 'на экране слов появился раздел трудных слов');
w.prompt = () => 'вода — «уотэ», как «вот э стакан»';
w.eval('editNote(CARDS.find(c=>c.w==="water").id)');
ok(Object.keys(E('S').notes).length === 1, 'к слову можно записать свою подсказку');
ok(E('noteBlock')(E('CARDS').find(c=>c.w==='water').id).includes('уотэ'), 'подсказка показывается на карточке');
const si = d.querySelector('#cards-body input[type=search]');
si.value = 'вод'; si.dispatchEvent(new w.Event('input'));
ok(d.querySelectorAll('#cards-body .list-item').length > 0, 'поиск по русскому переводу находит слова');
si.value = 'water'; si.dispatchEvent(new w.Event('input'));
ok([...d.querySelectorAll('#cards-body .ttl')].some(x=>/water/.test(x.textContent)), 'поиск по английскому написанию работает');
let blob = null;
w.URL.createObjectURL = b => { blob = b; return 'blob:x'; };
w.URL.revokeObjectURL = () => {};
w.eval('exportProgress()');
ok(blob && blob.type === 'application/json', 'прогресс выгружается файлом');
ok(typeof w.importProgress === 'function', 'есть функция восстановления из файла');

head('[5f] Сложность текстов');
const textKnown = E('textKnown');
w.eval('S.cards={}; save()');
const zero = E('TEXTS').map(t => textKnown(t));
w.eval('CARDS.slice(0,600).forEach(c=>{S.cards[c.id]={ef:2.5,iv:6,reps:3,lapses:0,due:today()}}); save()');
const full = E('TEXTS').map(t => textKnown(t));
ok(zero.every(x => x > 20 && x < 60), 'на старте доля знакомых слов честная: служебные считаются, остальные нет');
ok(full.every((x,i) => x > zero[i]), 'доля растёт по мере изучения словаря');
ok(full.some(x => x >= 80), 'после 600 слов часть текстов становится комфортной: ' + Math.max(...full) + '%');
w.go('read');
ok(d.querySelectorAll('#read-body .know').length === E('TEXTS').length, 'у каждого текста показана его сложность');

head('[2b] Английский материал');
{
  const bare = x => x.replace(/[ˈˌ]/g,'');
  const words = [];
  DECKS.forEach(dk => dk.words.forEach(x => words.push({w:x[0].toLowerCase(), ipa:x[1], ex:x[4], exru:x[5]})));
  Object.entries(E('COMMON')).forEach(([k,v]) => words.push({w:k, ipa:v[0]}));

  // транскрипция не спорит с написанием
  const rules = [[/^th/,/^[ðθ]/],[/tion$/,/ʃ(ə)?n$/],[/^wr/,/^r/],[/^kn/,/^n/],
                 [/ing$/,/ɪŋ$/],[/ck$/,/k$/],[/^ph/,/^f/],[/dge$/,/dʒ$/],[/^qu/,/^kw/]];
  const ipaBad = words.filter(x => /^[a-z']+$/.test(x.w) &&
    rules.some(([sp,ph]) => sp.test(x.w) && !ph.test(bare(x.ipa))));
  ok(ipaBad.length === 0, `транскрипции согласуются с написанием (${words.length} слов)` +
     (ipaBad.length ? ': ' + ipaBad.slice(0,5).map(x=>x.w).join(', ') : ''));

  // артикли a / an по звуку, а не по букве
  const sentences = [];
  words.forEach(x => { if(x.ex) sentences.push(x.ex); });
  TRIPS.forEach(g => g.scenes.forEach(sc => [...sc.say, ...sc.hear].forEach(p => sentences.push(p[0]))));
  TEXTS.forEach(t => t.body.forEach(b => sentences.push(b[0])));
  GRAMMAR.forEach(g => g.examples.forEach(e => sentences.push(e[0])));
  const artBad = [];
  sentences.forEach(en => [...en.matchAll(/\b(a|an)\s+([A-Za-z]+)/g)].forEach(m => {
    const art = m[1].toLowerCase(), next = m[2].toLowerCase();
    const vowelSound = (/^[aeiou]/.test(next) && !/^(uni|use|user|euro|one|once)/.test(next)) || /^(hour|honest)/.test(next);
    if(vowelSound !== (art === 'an')) artBad.push(m[0]);
  }));
  ok(artBad.length === 0, `артикли a и an выбраны по звуку в ${sentences.length} предложениях` +
     (artBad.length ? ': ' + artBad.slice(0,5).join(', ') : ''));

  // оформление предложений
  const fmtBad = sentences.filter(en => !/^[A-Z"']/.test(en) || !/[.!?]$/.test(en) || /\bi\b/.test(en));
  ok(fmtBad.length === 0, 'все предложения с заглавной, с конечным знаком и с большим I' +
     (fmtBad.length ? ': ' + fmtBad.slice(0,3).join(' | ') : ''));

  // формы неправильных глаголов против эталона
  const REF = {go:['went','gone'],be:['was','been'],do:['did','done'],see:['saw','seen'],take:['took','taken'],
    give:['gave','given'],write:['wrote','written'],speak:['spoke','spoken'],buy:['bought','bought'],
    think:['thought','thought'],teach:['taught','taught'],know:['knew','known'],fly:['flew','flown'],
    sing:['sang','sung'],drink:['drank','drunk'],begin:['began','begun'],come:['came','come'],run:['ran','run'],
    put:['put','put'],cost:['cost','cost'],say:['said','said'],pay:['paid','paid'],lose:['lost','lost'],
    stand:['stood','stood'],understand:['understood','understood'],eat:['ate','eaten'],forget:['forgot','forgotten']};
  const vBad = [];
  E('IRREG').forEach(g => g.verbs.forEach(v => {
    const r = REF[v[0]]; if(!r) return;
    if(v[1] !== r[0] || v[2] !== r[1]) vBad.push(v[0]);
  }));
  ok(vBad.length === 0, 'формы неправильных глаголов совпадают с эталоном' + (vBad.length ? ': ' + vBad.join(', ') : ''));

  // ни один глагол не попал в таблицу дважды
  const vSeen = {}; const vDup = [];
  E('IRREG').forEach(g => g.verbs.forEach(v => { if(vSeen[v[0]]) vDup.push(v[0]); vSeen[v[0]] = 1; }));
  ok(vDup.length === 0, `в таблице глаголов нет повторов (${Object.keys(vSeen).length} глаголов)` +
     (vDup.length ? ': ' + vDup.join(', ') : ''));

  // вопросы не повторяются между темами
  const qSeen = {}, qDup = [];
  GRAMMAR.forEach(g => g.quiz.forEach(q => { const k = q.q + q.o.join(); if(qSeen[k]) qDup.push(q.q); qSeen[k] = 1; }));
  ok(qDup.length === 0, 'вопросы не дублируются между темами' + (qDup.length ? ': ' + qDup.join(' | ') : ''));
}

head('[6] Грамматика');
w.go('gram', 0);
ok(/Почему так/.test(txt()) && /Ловушка/.test(txt()), 'тема содержит блоки «почему» и «ловушка»');
const g0 = GRAMMAR[0];
for(let i=0;i<g0.quiz.length;i++){
  const opts = [...d.querySelectorAll('#quiz .opt')];
  if(!opts.length){ ok(false, 'вопрос ' + (i+1) + ' не отрисован'); break; }
  opts[g0.quiz[i].a].click();
  const next = [...d.querySelectorAll('#quiz button')].find(x => /Дальше/.test(x.textContent));
  if(next) next.click();
}
ok(/3 \/ 3/.test(d.querySelector('#quiz').textContent) && E('S').quiz[g0.id].score === 3, 'квиз считает и сохраняет результат');
w.go('gram', 1); E('quizState=null'); w.renderQuiz(GRAMMAR[1]);
const q1 = GRAMMAR[1].quiz[0];
[...d.querySelectorAll('#quiz .opt')][q1.a === 0 ? 1 : 0].click();
ok(d.querySelector('#quiz .opt.wrong') && d.querySelector('#quiz .opt.correct') && d.querySelector('#quiz .trap'),
   'при ошибке видно и неверный, и верный вариант, и объяснение');

head('[7] Звуки');
let bads = 0;
SOUNDS.forEach((x,i) => {
  w.go('sound', i);
  const body = d.querySelector('#sound-body');
  if(body.querySelectorAll('svg.mouth').length !== 2) bads++;
  if(!body.querySelector('.tongue') || !body.querySelector('.lipsF')) bads++;
  if(!/Как это выглядит снаружи/.test(body.textContent)) bads++;
});
ok(bads === 0, 'у всех ' + SOUNDS.length + ' звуков: разрез сбоку с языком, вид спереди с губами, подсказка для чтения по губам');

head('[8] Чтение');
w.go('read', 0);
const spans = [...d.querySelectorAll('#read-body .w')];
const tokens = d.querySelector('#read-body .text-body').textContent.match(/[A-Za-z']+/g).length;
ok(spans.length >= tokens * 0.98, 'тапабельно ' + Math.round(spans.length/tokens*100) + '% слов текста');
spans[5].dispatchEvent(new w.MouseEvent('click', {bubbles:true}));
ok(d.querySelector('#pop').classList.contains('on') && /\//.test(d.querySelector('#pop').textContent), 'попап с транскрипцией открылся');
const before = Object.keys(E('S').cards).length;
const addBtn = [...d.querySelectorAll('#pop button')].find(x => /в карточки/.test(x.textContent));
if(addBtn){ addBtn.click(); ok(Object.keys(E('S').cards).length > before, 'слово из текста добавляется в карточки'); }
else ok(/уже в карточках/.test(d.querySelector('#pop').textContent), 'слово уже отслеживается');
w.lookup('minutes', 0);
ok(/форма слова/.test(d.querySelector('#pop').textContent), 'словоформа распознана и помечена как форма');
w.toggleRu(0); ok(/Скрыть перевод/.test(d.querySelector('#read-body').textContent), 'перевод переключается');
w.markRead(0); ok(E('S').read[TEXTS[0].id].done, 'текст отмечается прочитанным');

head('[9] Разговорник');
w.go('trip');
ok(d.querySelectorAll('#trip-body .list-item').length === scenes, 'в списке все ' + scenes + ' сцен');
w.go('trip', 'help');
ok(/Просьба о помощи/.test(txt()), 'сцена открывается');
ok(/Говоришь ты/.test(txt()) && /Услышишь в ответ/.test(txt()), 'есть оба блока: свои реплики и ответные');
ok(d.querySelectorAll('#trip-body .phrase .w').length > 20, 'слова во фразах тапабельны: ' + d.querySelectorAll('#trip-body .phrase .w').length);
[...d.querySelectorAll('#trip-body .mini')].find(x => /показать/.test(x.textContent)).click();
ok(d.querySelector('#big').classList.contains('on') && /Can you help me/.test(d.querySelector('#big .txt').textContent),
   'режим «показать собеседнику» выводит фразу на весь экран');
d.querySelector('#big').dispatchEvent(new w.MouseEvent('click', {bubbles:true}));
ok(!d.querySelector('#big').classList.contains('on'), 'закрывается нажатием в любом месте');
w.go('trip','taxi');   // сцену help уже брали в проверке маршрута, берём другую
const was = Object.keys(E('S').cards).length;
const addAll = [...d.querySelectorAll('#trip-body button')].find(x => /Учить эти/.test(x.textContent));
ok(!!addAll, 'на непройденной сцене есть кнопка «учить всю сцену»');
addAll.click();
ok(Object.keys(E('S').cards).length === was + 5, 'вся сцена уходит в карточки одной кнопкой');
ok(/Все фразы уже в карточках/.test(txt()), 'кнопка меняет состояние');

w.go('cards'); w.startSession();
let phraseId = null, g2 = 0;
while(E('session').q.length && g2++ < 500){
  const id = E('session').q[0];
  if(id.indexOf('p:') === 0){ phraseId = id; break; }
  const f = d.querySelector('.face'); if(f) f.dispatchEvent(new w.MouseEvent('click', {bubbles:true}));
  const g = d.querySelector('.grade.g2'); if(!g) break; g.click();
}
ok(phraseId, 'фраза попадает в очередь повторений наравне со словами');
if(phraseId){
  d.querySelector('.face').dispatchEvent(new w.MouseEvent('click', {bubbles:true}));
  const body = d.querySelector('#cards-body').textContent;
  ok(!/\/\//.test(body), 'у фразы не рисуется пустая транскрипция');
  ok(/показать собеседнику/.test(body), 'на обороте фразы есть кнопка показа');
}

head('[10] Настройки');
w.go('home');
const cbs = () => [...d.querySelectorAll('#home-body input[type=checkbox]')];
cbs()[0].checked = false; cbs()[0].dispatchEvent(new w.Event('change'));
ok(E('S').opts.audio === false, 'озвучку можно выключить');
w.go('cards'); w.startSession();
d.querySelector('.face').dispatchEvent(new w.MouseEvent('click', {bubbles:true}));
ok(!d.querySelector('#cards-body .speak'), 'при выключенном звуке кнопок озвучки нет');
w.go('home');
cbs()[0].checked = true; cbs()[0].dispatchEvent(new w.Event('change'));
const rng = d.querySelectorAll('#home-body input[type=range]');
rng[0].value = 15; rng[0].dispatchEvent(new w.Event('input'));
ok(E('S').opts.newPerSession === 15, 'лимит новых слов меняется');
rng[1].value = 24; rng[1].dispatchEvent(new w.Event('input'));
ok(d.documentElement.style.getPropertyValue('--fs') === '24px', 'размер шрифта меняется');
const deckBoxes = cbs().slice(-DECKS.length);
deckBoxes[0].checked = false; deckBoxes[0].dispatchEvent(new w.Event('change'));
ok(E('S').opts.decks[DECKS[0].id] === false, 'колоду можно отключить');
deckBoxes[0].checked = true; deckBoxes[0].dispatchEvent(new w.Event('change'));

head('[11] Перерыв в месяц');
const st = JSON.parse(w.localStorage.getItem('quiet-english-v1'));
Object.keys(st.cards).slice(0,5).forEach(k => { st.cards[k] = {ef:2.5, iv:6, reps:3, lapses:0, due:'2026-08-05'}; });
const learnedBefore = Object.values(st.cards).filter(x => x.reps >= 2).length;
Object.values(st.cards).forEach(x => x.due = '2026-07-01');
w.localStorage.setItem('quiet-english-v1', JSON.stringify(st));
w.load(); w.render(); w.go('cards'); w.startSession();
ok(E('session').total > 0, 'после месячного перерыва очередь просто длиннее (' + E('session').total + ' карточек)');
ok(w.learnedCount() === learnedBefore, 'выученное не обнулилось: было ' + learnedBefore + ', стало ' + w.learnedCount());
ok(Object.values(E('S').cards).every(x => x.ef >= 1.3), 'коэффициенты лёгкости не пострадали от простоя');
w.go('home');
const home = d.querySelector('#home-body').textContent.replace(/\s+/g, ' ');
const punish = (home.match(/сгорел\w*|штраф\w*|обнулен\w*|стрик\w*/gi) || []).filter(m => !new RegExp('(нет|не|без)\\s+[^.]{0,20}' + m, 'i').test(home));
ok(punish.length === 0, 'на экране нет лексики наказания вне отрицаний' + (punish.length ? ': ' + punish.join(', ') : ''));
ok(/счётчика дней подряд здесь нет/i.test(home) && /пропуск не откатывает прогресс/i.test(home), 'пользователю прямо сказано, что пропуск безопасен');

head('[12] Устойчивость');
w.localStorage.setItem('quiet-english-v1', '{сломано');
w.load(); w.render();
ok(d.querySelector('#home-body').innerHTML.length > 400, 'приложение переживает повреждённые данные и стартует заново');
ok(errs.length === 0, 'нет ошибок исполнения' + (errs.length ? ': ' + errs.slice(0,4).join(' // ') : ''));

console.log(fail ? `\n=== ПРОВАЛЕНО ПРОВЕРОК: ${fail} ===` : '\n=== Все проверки пройдены ===');
process.exit(fail ? 1 : 0);
