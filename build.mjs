import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {join,dirname} from 'node:path';

const base = dirname(fileURLToPath(import.meta.url));
const styleVersion = createHash('sha256').update(readFileSync(join(base,'docs','style.css'))).digest('hex').slice(0,10);
const {articles,timeline} = JSON.parse(readFileSync(join(base,'archive.json'),'utf8'));
const talks = JSON.parse(readFileSync(join(base,'talks.json'),'utf8'));
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const link = (url,label,attrs='') => `<a href="${esc(url)}" ${attrs}>${esc(label)}</a>`;
const locales = [
  {code:'en',label:'EN'},
  {code:'zh-CN',label:'中文'},
  {code:'ja',label:'日本語'}
];
const japanese = JSON.parse(readFileSync(join(base,'japanese.json'),'utf8'));
function file(slug,locale) {
  if (slug === 'index') {
    if (locale === 'en') return 'index.html';
    return locale === 'ja' ? 'index-ja.html' : 'index-zh.html';
  }
  return slug + (locale === 'zh-CN' ? '' : '-'+locale) + '.html';
}

function cover(key, eager=false) {
  return `<img class="cover" src="assets/covers/${esc(key)}.jpg" alt="" loading="${eager ? 'eager' : 'lazy'}" decoding="async">`;
}

function clock(seconds) {
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const pad = n => String(n).padStart(2,'0');
  return (hours ? hours + ':' + pad(minutes % 60) : minutes) + ':' + pad(seconds % 60);
}

function build(locale) {
  function t(zh,english,ja) {
    if (locale === 'en') return english;
    if (locale === 'zh-CN') return zh;
    if (typeof ja !== 'string' || !ja.trim()) throw new Error('Missing Japanese translation for '+english);
    return ja;
  }
  const home = file('index',locale);
  const tagline = t('一个热爱 poteto 的粉丝维护的小百科','A little encyclopedia maintained by a fan who loves poteto.','poteto が大好きなファンの手による、小さな百科事典。');
  const sections = [['articles',t('文章精读','Reading room','記事を読む')],['talks',t('演讲放映室','Screening room','講演シアター')],['life',t('人物履历','Biography','経歴')]];
  function page(slug,title,body) {
    const nav = sections.map(([id,label]) => link(id === 'talks' ? file('screenings',locale) : home+'#'+id,label)).join('\n');
    const languages = locales.map(({code,label}) =>
      link(file(slug,code),label,`lang="${code}" hreflang="${code}" ${code===locale?'aria-current="page"':''}`)).join('');
    const alternates = locales.map(({code}) =>
      `<link rel="alternate" hreflang="${code}" href="${file(slug,code)}">`).join('');
    const html = `<!doctype html>
<html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
${alternates}<title>${esc(title)} · LovePoteto</title><link rel="stylesheet" href="style.css?v=${styleVersion}"></head>
<body><header><a class="brand" href="${home}"><b aria-hidden="true">♥</b>Love poteto</a>
<nav aria-label="${t('栏目','Sections','サイト内メニュー')}">${nav}</nav><div class="lang" aria-label="${t('语言','Language','言語')}">${languages}</div></header>
<main>${body}</main><footer><p>LovePoteto · ${tagline}</p>
<p>${link('https://x.com/poteto','X · @poteto')}　 ${link('https://github.com/poteto','GitHub')}</p></footer></body></html>\n`;
    writeFileSync(join(base,'docs',file(slug,locale)),html);
    if (slug === 'index' && locale === 'en') writeFileSync(join(base,'docs','index-en.html'),html);
  }
  function heading(id,label,count) {
    return `<div class="section-head"><h2 id="${id}">${label}</h2><span class="meta">${count}</span></div>`;
  }
  const cards = articles.map(([slug,,date,original,zh,english]) =>
    `<a class="card" href="${file(slug,locale)}">${cover(slug)}<time datetime="${date}">${date}</time><strong>${esc(t(zh,english,japanese.articles[slug].title))}</strong><small lang="en">${esc(original)}</small></a>`).join('\n');
  const room = file('screenings',locale);
  const filmPage = talk => file('film-'+talk.id,locale);
  const videoUrl = id => 'https://www.youtube.com/watch?v='+id;
  const yearOf = talk => talk.event.slice(0,4);
  const years = [...new Set(talks.map(yearOf))].sort().reverse();
  function filmCard(talk) {
    return `<a class="film-card" href="${filmPage(talk)}">
      <div class="film-still">${cover(talk.id)}<span class="runtime">${clock(talk.duration)}</span></div>
      <span class="film-event">${esc(talk.event)}</span><strong>${esc(t(talk.titleZh,talk.title,japanese.talks[talk.id].title))}</strong></a>`;
  }
  const byNewest = [...talks].sort((a,b) =>
    yearOf(b).localeCompare(yearOf(a)) || Date.parse(b.youtubePublishedAt)-Date.parse(a.youtubePublishedAt));
  const recentFilms = byNewest.slice(0,articles.length).map(talk => {
    const date = talk.youtubePublishedAt.slice(0,10);
    return `<a class="card" href="${filmPage(talk)}">${cover(talk.id)}
      <time datetime="${esc(talk.youtubePublishedAt)}">YouTube · ${date}</time><strong>${esc(t(talk.titleZh,talk.title,japanese.talks[talk.id].title))}</strong>
      <small>${esc(talk.event)} · ${clock(talk.duration)}</small></a>`;
  }).join('\n');
  const archiveSections = years.map(year => `<section class="film-year" id="y${year}"><h2>${year}</h2>
    <div class="film-grid">${byNewest.filter(talk=>yearOf(talk)===year).map(filmCard).join('')}</div></section>`).join('');
  page('screenings',t('演讲放映室','Screening room','講演シアター'),`<div class="cinema-index">
    <div class="room-title"><h1>${t('演讲放映室','Screening room','講演シアター')}</h1><p>${t('从 Ember 组件、React 编译器，到会验证自己工作的 Agent。这里收录了 Lauren 主讲或参与的 '+talks.length+' 场演讲、对谈与工作坊，可按年份浏览，点击时间戳观看原片。','From Ember components and the React compiler to agents that can test their own work. Explore '+talks.length+' talks, conversations and workshops featuring Lauren Tan. Choose a year or jump to a moment in a recording.','Ember のコンポーネントから React コンパイラ、自分の仕事を検証できるエージェントまで。ローレン・タンが登壇した講演、対談、ワークショップを計 '+talks.length+' 本収録しました。年別に探したり、タイムスタンプから気になる場面に飛んだりできます。')}</p></div>
    <nav class="years" aria-label="${t('按年份浏览','Browse by year','年別に探す')}">${years.map(y=>link('#y'+y,y)).join('')}</nav>
    ${archiveSections}</div>`);
  for (const talk of talks) {
    const watch = videoUrl(talk.id);
    const chapters = talk.chapters.map(([seconds,zh,english]) => {
      const stamp = clock(seconds);
      return `<li><a href="${esc(watch+'&t='+seconds+'s')}"><b>${stamp}</b><span>${esc(t(zh,english,japanese.talks[talk.id].chapters[seconds]))}</span><i aria-hidden="true">▶</i></a></li>`;
    }).join('');
    const sourceLabel = talk.reupload
      ? t('作者或主办方原版','Original from the speaker or host','登壇者・主催者によるオリジナル版')
      : t('场次资料','Session source','講演の関連資料');
    const extra = talk.source && talk.source!==watch ? link(talk.source,sourceLabel) : '';
    const evidence = talk.timingSource && talk.timingSource!==watch && talk.timingSource!==talk.source
      ? link(talk.timingSource,t('带时间的参考资料','Timestamp reference','タイムスタンプの参考資料')) : '';
    page('film-'+talk.id,t(talk.titleZh,talk.title,japanese.talks[talk.id].title),`<article class="reading film-reading">
      ${link(room+'#y'+yearOf(talk),t('返回演讲放映室','Back to the screening room','講演シアターに戻る'))}
      <p class="film-event">${esc(talk.event)}</p><h1>${esc(t(talk.titleZh,talk.title,japanese.talks[talk.id].title))}</h1>
      ${locale === 'en' ? '' : `<p class="original-title" lang="en">${esc(talk.title)}</p>`}
      <a class="film-poster" href="${watch}" aria-label="${esc(t('观看录像','Watch the recording','録画を見る')+' · '+talk.title)}">${cover(talk.id,true)}<span class="play" aria-hidden="true">▶</span></a>
      <h2>${t('演讲精读','Viewing notes','見どころと解説')}</h2><p>${esc(t(talk.zh,talk.en,japanese.talks[talk.id].notes))}</p>
      ${talk.edition==='abridged' ? `<p class="edition">${t('下列时间戳对应 YouTube 剪辑版中 Lauren 参与的实作环节。主办方在 X 发布的全天回放使用另一条时间轴。','These timestamps locate the group build in the edited YouTube recording. The organizer’s full-day broadcast on X has a different timeline.','以下のタイムスタンプは、YouTube の編集版でローレンが共同制作に参加している場面を示します。主催者が X で公開している全編の録画とは再生位置が異なります。')}</p>` : ''}
      <h2>${t('关键时间戳','Moments to watch','注目の場面')}</h2><ol class="cue-list">${chapters}</ol>
      <div class="source">${link(watch,t(talk.reupload?'在 YouTube 观看转载':'在 YouTube 观看录像',talk.reupload?'Watch the YouTube reupload':'Watch on YouTube',talk.reupload?'YouTube で転載版を見る':'YouTube で録画を見る'))}${extra}${evidence}</div>
      </article>`);
  }
  const milestones = timeline.map(([when,zh,english,cn,us,source,url]) =>
    `<article><span class="meta">${esc(when)}</span><h3>${esc(t(zh,english,japanese.timeline[when].title))}</h3><p>${esc(t(cn,us,japanese.timeline[when].notes))}</p>${link(url,source)}</article>`).join('\n');

  page('index', t('首页','Home','ホーム'),`<section class="hero"><div class="halo"><div class="portrait" role="img" aria-label="${t('戴圆眼镜的卡通 Lauren，双手捧着露出金黄内芯的烤红薯','Cartoon Lauren in round glasses, holding a steaming golden sweet potato','丸眼鏡をかけたローレンのイラスト。両手には、割ると黄金色の中身がのぞく焼き芋。')}"></div><span aria-hidden="true" class="star s1">✧</span><span aria-hidden="true" class="star s2">✦</span><span aria-hidden="true" class="star s3">✧</span></div>
<h1 lang="en">Love <i>poteto</i></h1><p>${tagline}</p>
<div class="hero-links">${link('#articles',t('文章精读','Reading room','記事を読む'),'class="button"')}${link(room,t('演讲放映室','Screening room','講演シアター'),'class="button pale"')}</div></section>
<section class="section">${heading('articles',sections[0][1],articles.length + t(' 篇选读',' readings',' 本の記事'))}<div class="cards">${cards}</div><p class="meta">${t('2026 年 11 月 21 日核对。收录 Lauren 在 X 文章栏公开列出的作品，发布日期按北京时间显示。','Checked against Lauren’s public Articles tab on 21 November 2026. Publication dates use Beijing time (UTC+8).','2026年11月21日、ローレンが X の「記事」タブで公開している作品を確認しました。公開日は北京時間（UTC+8）で表記しています。')} ${link('https://x.com/poteto/articles',t('查看 X 文章目录','View the X Articles index','X の記事一覧へ'))}</p></section>
<section class="section">${heading('talks',sections[1][1],talks.length + t(' 场录像',' recordings',' 本の映像'))}<div class="cards">${recentFilms}</div><p>${link(room,t('浏览全部 '+talks.length+' 场录像','Browse all '+talks.length+' recordings','全 '+talks.length+' 本の映像を見る'),'class="button pale"')}</p></section>
<section class="section">${heading('life',sections[2][1],t('根据互联网公开信息整理','Compiled from publicly available online sources','インターネット上の公開情報をもとに作成'))}<div class="timeline">${milestones}</div></section>`);
  for (const [idx,a] of articles.entries()) {
    const [slug,id,date,original,zh,english,mirror,openZh,openEn,exampleZh,exampleEn,noteZh,noteEn,detail]=a;
    const next=articles[(idx+1)%articles.length];
    page(slug,t(zh,english,japanese.articles[slug].title),`<article class="reading">
${link(home+'#articles',t('返回精读室','Back to the reading room','記事一覧に戻る'))}<p class="meta"><time>${date}</time> · Lauren Tan · X</p>
<h1>${esc(t(zh,english,japanese.articles[slug].title))}</h1><div lang="en">${esc(original)}</div>
${cover(slug,true)}
<h2>${t('从哪里读起','Where to begin','読む手がかり')}</h2><p>${esc(t(openZh,openEn,japanese.articles[slug].opening))}</p>
<h2>${t('再看一个细节','A closer look','具体例を読み解く')}</h2><p>${esc(t(exampleZh,exampleEn,japanese.articles[slug].example))}</p>
<h2>${esc(t(detail[0],detail[1],japanese.articles[slug].detailTitle))}</h2><p>${esc(t(detail[2],detail[3],japanese.articles[slug].detail))}</p>
<aside class="editor"><h2>${t('编者手记','Editor’s notebook','編集ノート')}</h2><p>${esc(t(noteZh,noteEn,japanese.articles[slug].note))}</p></aside>
<div class="source">${link('https://x.com/poteto/status/'+id,t('阅读 X 原文','Original on X','X で原文を読む'))}${mirror ? link(mirror,t('英文正文镜像','English text mirror','英語原文のミラー')) : ''}</div>
<hr><p>${t('接着读','Read next','次に読む')} · ${link(file(next[0],locale),t(next[4],next[5],japanese.articles[next[0]].title))}</p></article>`);
  }
}
for (const {code} of locales) build(code);
