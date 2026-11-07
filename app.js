(() => {
  'use strict';
  const STORAGE_KEY = 'matlog-training-records-v1';
  const MAIN = document.getElementById('main');
  const $ = (id) => document.getElementById(id);
  const state = { entries: [], dailyNotes: [], historical: {}, seed: null, tab: 'overview', year: 'all', filter: 'all', search: '', page: 14, editingId: null, modalType: 'Gi|Gi', toastTimer: null, storageAvailable: true };

  const esc = (input) => String(input ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const today = () => { const d = new Date(); return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-'); };
  const prettyDate = (date) => new Date(date + 'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
  const weekday = (date) => new Date(date + 'T12:00:00').toLocaleDateString('en-US',{weekday:'short'});
  const dateShort = date => new Date(date + 'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'});
  const hours = n => Number(n||0).toLocaleString('en-US',{minimumFractionDigits: Number.isInteger(Number(n||0))?0:1,maximumFractionDigits:2});
  const number = n => Math.round(Number(n||0)).toLocaleString('en-US');
  const safeNumber = n => Number.isFinite(Number(n)) ? Number(n) : 0;
  const sum = (arr,fn) => arr.reduce((total,item)=>total+safeNumber(fn(item)),0);
  const titleCase = (str) => String(str).trim().toLocaleLowerCase('en-US');
  const cutoff = (str,max=100) => { const a=String(str||'').replace(/\s+/g,' ').trim(); return a.length>max ? a.slice(0,max-1)+'…':a; };
  const typeKey = e => e.type === 'Open Mat' ? `${e.format==='No-Gi'?'No-Gi':'Gi'} Open Mat` : e.type === 'Coaching' ? 'Coaching' : (e.type==='No-Gi'?'No-Gi Class':'Gi Class');
  const typeEmoji = e => e.type === 'Coaching' ? 'C' : e.type === 'Open Mat' ? '↗' : e.format === 'No-Gi' ? 'N' : 'G';

  function toast(text) {
    const node=$('toast'); node.textContent=text; node.hidden=false;
    clearTimeout(state.toastTimer); state.toastTimer=setTimeout(()=>node.hidden=true,3000);
  }
  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY,JSON.stringify({version:1,entries:state.entries,dailyNotes:state.dailyNotes,historical:state.historical}));
      state.storageAvailable=true;
      $('footerStatus').textContent='PRIVATE · SAVED ON THIS DEVICE';
      return true;
    } catch(err) {
      state.storageAvailable=false;
      $('footerStatus').textContent='NOT SAVED · EXPORT BACKUP';
      toast('Safari storage is unavailable. Export a backup to keep your entries.');
      return false;
    }
  }
  function readLocal() {
    try {const raw=localStorage.getItem(STORAGE_KEY); if (!raw) return null; const parsed=JSON.parse(raw); if (parsed.version!==1 || !Array.isArray(parsed.entries)) return null; return parsed;}
    catch(e){return null;}
  }
  async function boot() {
    try {
      const res=await fetch('./data/seed.json',{cache:'no-store'});
      if(!res.ok) throw new Error(`Unable to load the included training data (${res.status}).`);
      state.seed=await res.json();
      if(!Array.isArray(state.seed.entries))throw new Error('The training data is not in the expected format.');
      const local=readLocal();
      state.entries=local?local.entries:state.seed.entries;
      state.dailyNotes=local?.dailyNotes||state.seed.dailyNotes||[];
      state.historical=local?.historical||state.seed.historical||{};
      if(!local)persist();
      setupStaticHandlers(); render();
      if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('./service-worker.js').catch(()=>{});
    } catch(err) {
      MAIN.innerHTML=`<div class="empty-state"><strong>Could not load training data</strong><p>${esc(err.message)} Try hosting these files with GitHub Pages rather than opening index.html directly.</p></div>`;
      $('addBtn').hidden=true;
      $('settingsBtn').disabled=true;
    }
  }
  function yearList() {
    const ys=new Set(state.entries.map(e=>e.date?.slice(0,4)).filter(y=>/^20\d\d$/.test(y)));
    return [...ys].sort((a,b)=>b.localeCompare(a));
  }
  function periodEntries() {
    return state.year==='all' ? state.entries : state.entries.filter(e=>e.date.startsWith(state.year+'-'));
  }
  function totals(list){
    const all=sum(list,e=>e.hours);
    const coached=sum(list,e=>Number.isFinite(Number(e.coachedHours)) ? e.coachedHours : (e.type==='Gi'||e.type==='No-Gi'||e.type==='Coaching'?e.hours:0));
    const open=sum(list,e=>e.type==='Open Mat'?e.hours:0);
    const gi=sum(list,e=>e.format==='Gi'?e.hours:0);
    const noGi=sum(list,e=>e.format==='No-Gi'?e.hours:0);
    const other=Math.max(0,all-gi-noGi);
    return {all,coached,open,gi,noGi,other,classes:sum(list,e=>e.classes),days:new Set(list.filter(e=>safeNumber(e.hours)>0).map(e=>e.date)).size};
  }
  function renderYears(){
    const years=yearList();if(state.year!=='all'&&!years.includes(state.year))state.year='all';
    $('yearTabs').innerHTML=`<button class="year-pill ${state.year==='all'?'selected':''}" data-year="all" type="button">ALL TIME</button>` + years.map(y=>`<button class="year-pill ${state.year===y?'selected':''}" data-year="${esc(y)}" type="button">${esc(y)}</button>`).join('');
  }
  function render(){
    renderYears();
    document.querySelectorAll('[data-tab]').forEach(tab=>{
      const active=tab.dataset.tab===state.tab;tab.classList.toggle('is-active',active);tab.setAttribute('aria-selected',String(active));
    });
    const root=state.tab==='overview'?renderOverview():state.tab==='log'?renderLog():renderRollups();
    MAIN.innerHTML=root;
    document.title='MATLOG — '+({overview:'Overview',log:'Training Log',rollups:'Rollups'}[state.tab]);
  }
  function barChart(list){
    const byYear=state.year==='all';
    const slices=byYear?yearList().reverse().map(y=>({name:y,amount:sum(list.filter(e=>e.date.startsWith(y+'-')),e=>e.hours)})):
      Array.from({length:12},(_,month)=>({name:new Date(2024,month,1).toLocaleString('en-US',{month:'short'}).toUpperCase(),amount:sum(list.filter(e=>e.date.slice(5,7)===String(month+1).padStart(2,'0')),e=>e.hours)}));
    const max=Math.max(...slices.map(x=>x.amount),.01);
    return `<div class="chart" aria-label="Training hours by ${byYear?'year':'month'}">${slices.map(v=>`<div class="bar-holder"><div class="bar-numeric">${v.amount?hours(v.amount):'·'}</div><div class="bar-track"><div class="bar-fill" style="height:${Math.max(v.amount/max*100,0)}%"></div></div><div class="bar-lab">${esc(v.name)}</div></div>`).join('')}</div><div class="chart-legend"><span>Hours trained</span><strong>${byYear?'Yearly breakdown':state.year+' monthly breakdown'}</strong></div>`;
  }
  function metric(name,value,unit,note){return `<div class="metric"><div class="metric-label">${esc(name)}</div><div class="metric-number">${hours(value)}<small>${esc(unit)}</small></div><div class="metric-foot">${esc(note)}</div></div>`;}
  function renderOverview(){
    const list=periodEntries();const data=totals(list);const yearDesc=state.year==='all'?'2023 — PRESENT':`JAN — DEC ${state.year}`;
    const now=today();const mo=now.slice(0,7);
    const monthEntries=state.entries.filter(e=>e.date.startsWith(mo));
    const monthly=totals(monthEntries);
    const share=v=>data.all?Math.max(0,v/data.all*100):0;
    const recent=dayGroups(list,6,true);
    return `<section class="hero"><div class="eyebrow">${state.year==='all'?'ALL TIME':'YEAR '+esc(state.year)} · TRAINING TIME</div><div class="hero-number"><strong>${hours(data.all)}</strong><span>HRS</span></div><div class="hero-desc">TOTAL MAT HOURS</div><div class="hero-bottom"><span>${esc(yearDesc)}</span><span><strong>${number(data.days)}</strong> <em>TRAINING DAYS</em></span></div></section>
       <div class="metrics-grid">${metric('Coached hours',data.coached,'HRS','Time in structured classes')}${metric('Open mat hours',data.open,'HRS','All open mat sessions')}${metric('Classes',data.classes,'','Recorded class count')}${metric(state.year==='all'?'This month':'Training days',state.year==='all'?monthly.all:data.days,state.year==='all'?'HRS':'DAYS',state.year==='all'?'Your current month': 'Unique dates trained')}</div>
       <div class="section-title"><h2>Time on the mats</h2><small>${state.year==='all'?'BY YEAR':'BY MONTH'}</small></div><div class="panel">${barChart(list)}</div>
       <div class="section-title"><h2>Training split</h2><small>HOURS</small></div>
       <div class="panel"><div class="split-track" aria-label="Gi ${hours(data.gi)} hours, No-Gi ${hours(data.noGi)} hours, other ${hours(data.other)} hours"><div class="seg-gi" style="width:${share(data.gi)}%"></div><div class="seg-no" style="width:${share(data.noGi)}%"></div><div class="seg-other" style="width:${share(data.other)}%"></div></div>
          ${splitRow('GI','#24553e',data.gi)}${splitRow('NO-GI','#a6c78b',data.noGi)}${data.other>0?splitRow('OTHER / COACHING','#e4bd7c',data.other):''}</div>
       <div class="section-title"><h2>Recent training</h2><button type="button" data-action="go-log">VIEW ALL →</button></div><div class="feed-list">${recent.length?recent.map(renderDayCard).join(''):`<div class="empty-state"><strong>No recorded sessions</strong><p>Tap the plus button to log your first training session.</p></div>`}</div>`;
  }
  function splitRow(label,color,value){return `<div class="split-row"><span class="split-name"><span class="split-dot" style="background:${color}"></span>${esc(label)}</span><strong>${hours(value)} h</strong></div>`;}
  function notesFor(date){return state.dailyNotes.find(n=>n.date===date)||null;}
  function dayGroups(list,limit,excludeEmptyNotes=false){
    const map=new Map();
    list.forEach(e=>{const date=e.date;if(!map.has(date))map.set(date,{date,entries:[],notes:notesFor(date)});map.get(date).entries.push(e);});
    if(!excludeEmptyNotes){state.dailyNotes.filter(n=>state.year==='all'||n.date.startsWith(state.year+'-')).forEach(n=>{
      if(!map.has(n.date))map.set(n.date,{date:n.date,entries:[],notes:n});
    });}
    return [...map.values()].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,limit||Infinity);
  }
  function renderDayCard(day){
    const total=sum(day.entries,e=>e.hours);const desc=day.notes?cutoff([day.notes.notes,day.notes.watching].filter(Boolean).join(' • '),140):'';
    return `<article class="day-card"><div class="day-head"><span class="day-date">${esc(dateShort(day.date))}<small>${esc(weekday(day.date))} · ${esc(day.date.slice(0,4))}</small></span><span class="day-total">${hours(total)} HRS</span></div>
      ${day.entries.map(e=>`<div class="session-line ${e.format==='No-Gi'?'no-gi':e.type==='Coaching'?'coaching':''}"><div class="session-type-dot">${typeEmoji(e)}</div><button type="button" data-action="edit" data-id="${esc(e.id)}" class="session-edit"><div class="session-info"><div class="session-name">${esc(typeKey(e))}${e.gym?` · ${esc(e.gym)}`:''}</div>${e.technique||e.note?`<div class="session-description">${esc(cutoff(e.technique||e.note,90))}</div>`:''}</div><span class="session-duration">${hours(e.hours)}h</span><span class="edit-chevron">›</span></button></div>`).join('')}
      ${desc?`<div class="day-notes">${esc(desc)}</div>`:''}</article>`;
  }
  function filterEntries(list){
    const filter=state.filter;const term=titleCase(state.search);
    return list.filter(e=>{
      if(filter==='Gi' && e.format!=='Gi')return false;
      if(filter==='No-Gi' && e.format!=='No-Gi')return false;
      if(filter==='Open Mat' && e.type!=='Open Mat')return false;
      if(filter==='Coaching' && e.type!=='Coaching')return false;
      if(!term)return true;
      const notes=notesFor(e.date);
      return [e.date,e.type,e.format,e.gym,e.technique,e.note,notes?.notes,notes?.watching].join(' ').toLowerCase().includes(term);
    });
  }
  function renderLogResults(){
    const list=filterEntries(periodEntries());
    let groups=dayGroups(list,Infinity,state.filter!=='all'||!!state.search);
    if(state.search && state.filter==='all'){
      const term=titleCase(state.search);
      const manual=state.dailyNotes.filter(n=>(state.year==='all'||n.date.startsWith(state.year+'-'))&&[n.date,n.notes,n.watching].join(' ').toLowerCase().includes(term));
      const dates=new Set(groups.map(g=>g.date));
      manual.forEach(n=>{if(!dates.has(n.date))groups.push({date:n.date,entries:[],notes:n});});
      groups.sort((a,b)=>b.date.localeCompare(a.date));
    }
    const shown=groups.slice(0,state.page);
    return `<div class="log-count">${number(list.length)} TRAINING BLOCKS · ${number(groups.length)} DATED RECORDS</div><div class="feed-list">${shown.length?shown.map(renderDayCard).join(''):'<div class="empty-state"><strong>No matches found</strong><p>Try another search or remove a filter.</p></div>'}</div>
      ${groups.length>state.page?`<button class="load-more" data-action="more" type="button">SHOW MORE · ${number(groups.length-state.page)} DAYS REMAINING</button>`:''}`;
  }
  function renderLog(){
    const count=dayGroups(filterEntries(periodEntries()),Infinity,true).length;
    return `<div class="feed-heading"><div><h2>Training log</h2><p>Every session, every hour.</p></div><div class="eyebrow">${number(count)} DAYS</div></div>
      <div class="feed-toolbar"><div class="search-wrap"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg><input class="search-input" id="logSearch" type="search" placeholder="Search notes, gyms, dates…" value="${esc(state.search)}" autocomplete="off"></div>
        <div class="filters">${[['all','ALL'],['Gi','GI'],['No-Gi','NO-GI'],['Open Mat','OPEN MAT'],['Coaching','COACHING']].map(([k,label])=>`<button class="filter-pill ${state.filter===k?'selected':''}" type="button" data-filter="${k}">${label}</button>`).join('')}</div></div>
      <div id="logResults">${renderLogResults()}</div>`;
  }
  function renderRollups(){
    const yearly=yearList().reverse().map(y=>({year:y,...totals(state.entries.filter(e=>e.date.startsWith(y+'-')))}));
    const base=state.historical||{};
    const schools=new Map((base.schools||[]).map(v=>[titleCase(v.name),{name:v.name,hours:v.hours,added:0}]));
    state.entries.filter(e=>e.origin!=='imported'&&e.gym).forEach(e=>{
      const k=titleCase(e.gym);if(!schools.has(k))schools.set(k,{name:e.gym,hours:0,added:0});
      schools.get(k).hours+=safeNumber(e.hours);schools.get(k).added+=safeNumber(e.hours);
    });
    const topSchools=[...schools.values()].sort((a,b)=>b.hours-a.hours).slice(0,8);const highest=topSchools[0]?.hours||1;
    const dropins=[...(base.dropIns||[])].sort((a,b)=>b.visits-a.visits);
    const sems=[...(base.seminars||[])].sort((a,b)=>b.date.localeCompare(a.date));
    const belts=[...(base.belts||[])].sort((a,b)=>b.date.localeCompare(a.date));
    return `<h1 class="rollups-title">Your training history.</h1><p class="rollups-intro">The big picture, built from your original log and new entries.</p>
      <div class="section-title"><h2>Year over year</h2><small>ALL TIME</small></div><div class="panel"><div class="annual-list">${yearly.map(x=>`<div class="annual-row"><div><span class="year">${esc(x.year)}</span><small>${number(x.classes)} classes · ${number(x.days)} days trained</small></div><strong>${hours(x.all)} h</strong></div>`).join('')}</div></div>
      <div class="section-title"><h2>School hours</h2><small>ALL TIME</small></div><div class="panel">${topSchools.map(s=>`<div class="school-bar-row"><div class="names"><span>${esc(s.name)}</span><strong>${hours(s.hours)}h</strong></div><div class="track"><div class="fill" style="width:${(s.hours/highest*100).toFixed(2)}%"></div></div></div>`).join('')}<p class="small-explain">The four original school totals come from your Numbers summary. New entries with a named school add to these totals. Original daily sessions do not identify a school.</p></div>
      <div class="section-title"><h2>Belt milestones</h2><small>${number(belts.length)} RECORDED</small></div><div class="panel">${belts.map(b=>`<div class="milestone"><span class="belt-dot ${b.belt.startsWith('BL')?'blue':b.belt.startsWith('PB')?'purple':''}"></span><div><div class="text">${esc(b.belt)}</div><small>${esc(prettyDate(b.date))}</small></div></div>`).join('')}</div>
      <div class="section-title"><h2>School drop-ins</h2><small>${number((base.dropIns||[]).length)} SCHOOLS</small></div><div class="panel"><div class="dropins-list">${dropins.map(d=>`<div class="drop-row"><span>${esc(d.name)}</span><strong>${number(d.visits)}</strong></div>`).join('')}</div><p class="small-explain">Visits from your original Numbers summary (historical). New school visits are not automatically classified as drop-ins.</p></div>
      <div class="section-title"><h2>Seminars attended</h2><small>${number(sems.length)} EVENTS</small></div><div class="panel">${sems.map(s=>`<div class="seminar-row"><div><strong>${esc(s.instructor)}</strong><small>${esc(s.location||'')}</small></div><time>${esc(dateShort(s.date))} '${esc(s.date.slice(2,4))}</time></div>`).join('')}</div>`;
  }
  function gymChoices(){
    const all=new Set([...((state.historical?.schools||[]).map(x=>x.name)),...((state.historical?.dropIns||[]).map(x=>x.name)),...state.entries.map(e=>e.gym).filter(Boolean)]);
    $('gymSuggestions').innerHTML=[...all].sort().map(g=>`<option value="${esc(g)}"></option>`).join('');
  }
  function openOverlay(node){
    $('sheetBackdrop').hidden=false;node.hidden=false;document.body.style.overflow='hidden';$('addBtn').style.visibility='hidden';
  }
  function closeOverlay(){
    $('sheetBackdrop').hidden=true;$('entrySheet').hidden=true;$('settingsSheet').hidden=true;document.body.style.overflow='';$('addBtn').style.visibility='visible';state.editingId=null;
  }
  function setType(value,autoSetClasses=false){
    state.modalType=value;
    document.querySelectorAll('[data-type]').forEach(btn=>btn.classList.toggle('selected',btn.dataset.type===value));
    if(autoSetClasses)$('sessionClasses').checked=value.startsWith('Gi|')||value.startsWith('No-Gi|');
  }
  function quickSelected(){
    const val=safeNumber($('sessionHours').value);
    document.querySelectorAll('[data-hours]').forEach(btn=>btn.classList.toggle('selected',safeNumber(btn.dataset.hours)===val));
  }
  function openEntry(id=null){
    const e=id?state.entries.find(item=>item.id===id):null;
    if(id&&!e)return toast('Entry was not found.');
    state.editingId=e?.id||null;
    $('sheetTitle').textContent=e?'Edit training':'Add training';
    $('entryForm').reset();$('sessionDate').value=e?.date||today();$('sessionHours').value=e?.hours??1;
    $('sessionGym').value=e?.gym||'';$('sessionTechnique').value=e?.technique||'';$('sessionNote').value=e?.note||'';
    $('sessionClasses').checked=e?!!e.classes:true;
    setType(e?`${e.type}|${e.format}`:'Gi|Gi',!e);
    $('deleteEntry').hidden=!e;gymChoices();quickSelected();openOverlay($('entrySheet'));
  }
  function submitEntry(evt){
    evt.preventDefault();
    const day=$('sessionDate').value;
    const h=safeNumber($('sessionHours').value);
    if(!/^20\d\d-\d\d-\d\d$/.test(day)||Number.isNaN(new Date(day+'T12:00:00').getTime()))return toast('Enter a valid date.');
    if(h<=0||h>24||Math.round(h*4)!==h*4)return toast('Enter hours in 15-minute increments, up to 24h.');
    const [type,format]=state.modalType.split('|');
    const prev=state.entries.find(e=>e.id===state.editingId);
    const coachedRatio=prev?.type===type&&safeNumber(prev.hours)>0&&Number.isFinite(Number(prev.coachedHours)) ? safeNumber(prev.coachedHours)/safeNumber(prev.hours) : 1;
    const coachHours=type==='Open Mat'?0:Math.round(h*coachedRatio*10000)/10000;
    const update={id:prev?.id||('new-'+Date.now()+'-'+Math.random().toString(36).slice(2,9)),date:day,type,format,hours:h,coachedHours:coachHours,classes:$('sessionClasses').checked?1:0,
      gym:$('sessionGym').value.trim(),technique:$('sessionTechnique').value.trim(),note:$('sessionNote').value.trim(),origin:prev?.origin||'manual'};
    if(prev)state.entries=state.entries.map(e=>e.id===prev.id?update:e);
    else state.entries.push(update);
    persist();closeOverlay();render();toast(prev?'Training updated.':'Training saved.');
  }
  function deleteEntry(){
    if(!state.editingId)return;
    if(!confirm('Delete this training entry? This changes your totals and cannot be undone unless you have a backup.'))return;
    state.entries=state.entries.filter(e=>e.id!==state.editingId);
    persist();closeOverlay();render();toast('Entry deleted.');
  }
  function download(name,text,mime){
    const blob=new Blob([text],{type:mime});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;
    document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);
  }
  function exportJson(){
    const json={format:'matlog-backup',version:1,exportedAt:new Date().toISOString(),source:state.seed?.source||'',entries:state.entries,dailyNotes:state.dailyNotes,historical:state.historical};
    download(`matlog-backup-${today()}.json`,JSON.stringify(json,null,2),'application/json');toast('Full backup downloaded.');
  }
  function csvEscape(x){return '"'+String(x??'').replaceAll('"','""')+'"';}
  function exportCsv(){
    const fields=['Date','Type','Format','Hours','Coached Hours','Classes','School','Technique','Notes','Origin'];
    const rows=state.entries.slice().sort((a,b)=>a.date.localeCompare(b.date)).map(e=>[e.date,e.type,e.format,e.hours,e.coachedHours,e.classes,e.gym,e.technique,e.note,e.origin]);
    download(`matlog-sessions-${today()}.csv`,[fields,...rows].map(row=>row.map(csvEscape).join(',')).join('\r\n'),'text/csv;charset=utf-8');
    toast('Session CSV downloaded.');
  }
  async function importJson(e){
    const file=e.target.files?.[0];if(!file)return;
    try{
      const obj=JSON.parse(await file.text());
      if(!Array.isArray(obj.entries)||!obj.entries.every(x=>typeof x.id==='string'&&typeof x.date==='string'&&Number.isFinite(Number(x.hours))))throw new Error('This is not a compatible MATLOG backup.');
      if(!confirm(`Import ${number(obj.entries.length)} entries? Existing matching entry IDs will be updated; other entries will be kept.`))return;
      const map=new Map(state.entries.map(x=>[x.id,x]));obj.entries.forEach(x=>map.set(x.id,{...x,hours:safeNumber(x.hours)}));
      state.entries=[...map.values()];
      if(Array.isArray(obj.dailyNotes)){
        const notes=new Map(state.dailyNotes.map(n=>[n.date,n]));obj.dailyNotes.forEach(n=>{if(typeof n.date==='string')notes.set(n.date,n);});state.dailyNotes=[...notes.values()];
      }
      if(obj.historical&&typeof obj.historical==='object')state.historical=obj.historical;
      persist();closeOverlay();render();toast('Backup merged successfully.');
    } catch(err){toast(err?.message||'Backup could not be imported.');}
    finally{e.target.value='';}
  }
  function resetData(){
    if(!confirm('Restore the original Numbers dataset on this device? All entries you added or edited locally will be lost. Export a backup first if you need to keep them.'))return;
    state.entries=JSON.parse(JSON.stringify(state.seed.entries));state.dailyNotes=JSON.parse(JSON.stringify(state.seed.dailyNotes||[]));state.historical=JSON.parse(JSON.stringify(state.seed.historical||{}));
    state.year='all';state.tab='overview';state.search='';state.filter='all';persist();closeOverlay();render();toast('Original data restored.');
  }
  function setupStaticHandlers(){
    $('addBtn').addEventListener('click',()=>openEntry());
    $('settingsBtn').addEventListener('click',()=>openOverlay($('settingsSheet')));
    $('closeEntry').addEventListener('click',closeOverlay);$('closeSettings').addEventListener('click',closeOverlay);$('sheetBackdrop').addEventListener('click',closeOverlay);
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('sheetBackdrop').hidden)closeOverlay();});
    $('entryForm').addEventListener('submit',submitEntry);
    $('deleteEntry').addEventListener('click',deleteEntry);
    $('typePicker').addEventListener('click',e=>{const b=e.target.closest('[data-type]');if(b)setType(b.dataset.type,true);});
    $('quickTimes').addEventListener('click',e=>{const b=e.target.closest('[data-hours]');if(b){$('sessionHours').value=b.dataset.hours;quickSelected();}});
    $('sessionHours').addEventListener('input',quickSelected);
    $('exportJson').addEventListener('click',exportJson);$('exportCsv').addEventListener('click',exportCsv);
    $('importJson').addEventListener('click',()=>$('importFile').click());
    $('importFile').addEventListener('change',importJson);$('resetData').addEventListener('click',resetData);
    $('primaryNav').addEventListener('click',e=>{const b=e.target.closest('[data-tab]');if(!b)return;state.tab=b.dataset.tab;state.page=14;render();window.scrollTo({top:0,behavior:'instant'});});
    $('yearTabs').addEventListener('click',e=>{const b=e.target.closest('[data-year]');if(!b)return;state.year=b.dataset.year;state.page=14;render();});
    MAIN.addEventListener('click',e=>{
      const b=e.target.closest('[data-action],[data-filter]');if(!b)return;
      if(b.hasAttribute('data-filter')){state.filter=b.dataset.filter;state.page=14;render();return;}
      if(b.dataset.action==='go-log'){state.tab='log';state.filter='all';state.search='';render();window.scrollTo({top:0,behavior:'instant'});return;}
      if(b.dataset.action==='more'){state.page+=20;render();return;}
      if(b.dataset.action==='edit')openEntry(b.dataset.id);
    });
    MAIN.addEventListener('input',e=>{
      if(e.target.id==='logSearch'){
        state.search=e.target.value;state.page=14;
        const results=$('logResults');if(results)results.innerHTML=renderLogResults();
      }
    });
  }
  boot();
})();
