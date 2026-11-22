/* Piuarfil: panoul recepției și al medicilor. Calendar pe zi (o coloană pe medic) și pe săptămână.
   Pacienții primesc automat email la fiecare pas; recepția anunță de mână doar pacienții fără email. */
let S={me:null,doctors:[],schedules:[],appts:[],daysOff:[],holidays:[],today:null,phone:"",
  view:null,calMode:"day",calDay:null,calDoc:"",listMode:"next",doc:"",q:"",range:null,lastPending:null};
const PPM=1.6; // pixeli pe minut în calendar
const docById=id=>S.doctors.find(d=>d.id===id)||{name:id,photo:"",slot_minutes:30};
const canEdit=()=>S.me&&S.me.role!=="doctor";
const isActive=a=>a.status==="pending"||a.status==="confirmed";
const nameOf=a=>a.child_name||a.patient_name;
const toMin=t=>{const [h,m]=String(t).split(":").map(Number);return h*60+m};
const toT=m=>`${String(Math.floor(m/60)).padStart(2,"0")}:${String(m%60).padStart(2,"0")}`;
const weekdayOf=d=>new Date(d+"T12:00:00Z").getUTCDay();
const mondayOf=d=>weekdayOf(d)===0?addDaysStr(d,1):addDaysStr(d,1-weekdayOf(d)); // duminica (clinica închisă) arată săptămâna care urmează
const nowTime=()=>new Date().toLocaleTimeString("en-GB",{timeZone:"Europe/Bucharest",hour:"2-digit",minute:"2-digit",hourCycle:"h23"});

/* WhatsApp: doar pentru pacienții fără email. Mesajul e gata scris, fără date medicale. */
const patientLink=t=>(window.pfLinkFor?window.pfLinkFor(t):location.origin+"/p/"+t);
function waNumber(p){let d=String(p).replace(/\D/g,"");if(d.startsWith("00"))d=d.slice(2);if(d.startsWith("0"))d="40"+d.slice(1);return d}
function waText(a,kind){
  const d=docById(a.doctor_id),cine=a.child_name?` pentru ${a.child_name}`:"",cand=`${fmtLong(a.day)}, ora ${a.slot}`,link=patientLink(a.token);
  return {confirm:`Bună ziua! Programarea dvs.${cine} la Piuarfil este confirmată: ${d.name}, ${cand}.\nDetalii sau anulare (cu minimum 48h înainte): ${link}\nVă așteptăm!`,
    move:`Bună ziua! Programarea dvs.${cine} la Piuarfil a fost mutată: ${d.name}, ${cand}.\nDetalii sau anulare: ${link}`,
    remind:`Bună ziua! Vă reamintim de programarea dvs.${cine} de mâine la Piuarfil: ${d.name}, ora ${a.slot}.\nDacă nu mai puteți ajunge, vă rugăm să ne anunțați. Vă mulțumim!`,
    expired:`Bună ziua! Ne cerem scuze, nu am reușit să confirmăm la timp cererea dvs.${cine} pentru ${d.name} (${cand}). Vă rugăm să ne răspundeți și găsim împreună o oră potrivită.`,
    reject:`Bună ziua! Din păcate nu putem confirma programarea${cine} cerută la ${d.name} (${cand}). ${a.note||""}\nVă rugăm să alegeți altă oră pe site sau să ne răspundeți aici.`,
    cancel:`Bună ziua! Programarea dvs.${cine} la Piuarfil (${d.name}, ${cand}) a fost anulată.\nPentru o programare nouă ne puteți scrie aici.`}[kind];
}
const WA_ICON='<svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.4.8 3.2.7a2.8 2.8 0 0 0 1.8-1.3 2.3 2.3 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3Z"/></svg>';
const waBtn=(a,kind)=>`<a class="btn btn-wa btn-sm" href="https://wa.me/${waNumber(a.phone)}?text=${encodeURIComponent(waText(a,kind))}" target="_blank" rel="noopener">${WA_ICON}WhatsApp</a>`;

/* anulări făcute de pacienți, încă nevăzute de recepție (memorat în acest browser) */
const SEEN_KEY="pf-seen-cancels";
function seenSet(){try{return new Set(JSON.parse(localStorage.getItem(SEEN_KEY)||"[]"))}catch(e){return new Set()}}
function markSeen(ids){try{const s=seenSet();ids.forEach(i=>s.add(i));localStorage.setItem(SEEN_KEY,JSON.stringify([...s].slice(-500)))}catch(e){}}
const byPatient=a=>a.status==="cancelled"&&a.cancelled_by==="patient";
function newCancels(){const s=seenSet();return S.appts.filter(a=>byPatient(a)&&a.day>=S.today&&!s.has(a.id))}

/* Excepțiile: ce nu a putut pleca automat pe email (pacient fără email sau email eșuat). */
function manualTodo(){
  const T=S.today,tom=addDaysStr(T,1),out=[];
  for(const a of S.appts){
    if(a.day<T)continue;
    if(a.status==="confirmed"&&!a.notified){const both=a.day<=tom&&!a.reminded_at;
      out.push({a,kind:/mutat/i.test(a.note||"")?"move":"confirm",what:"confirmarea"+(both?" (programarea e "+(a.day===T?"azi":"mâine")+")":""),act:both?[{action:"notified",value:true},{action:"reminded"}]:{action:"notified",value:true}});continue}
    else if((a.status==="rejected"||(a.status==="cancelled"&&!byPatient(a)))&&!a.notified)out.push({a,kind:a.status==="rejected"?"reject":a.cancelled_by==="system"?"expired":"cancel",what:a.status==="rejected"?"respingerea":a.cancelled_by==="system"?"că cererea a expirat":"anularea",act:{action:"notified",value:true}});
    // reminder de mână doar pentru cei fără email, programați cu mai mult de o zi și jumătate înainte
    if(a.day===tom&&a.status==="confirmed"&&!a.email&&!a.reminded_at&&Date.now()-new Date(a.created_at)>36*36e5)out.push({a,kind:"remind",what:"reminderul pentru mâine",act:{action:"reminded"}});
  }
  return out;
}

async function boot(){
  try{const r=await api("/api/staff/me");Object.assign(S,{me:r.me,doctors:r.doctors,schedules:r.schedules||[],today:r.today,phone:r.phone});
    S.calDay=S.calDay||S.today;S.view=S.view||"cal";
    if(S.me.role==="doctor"){S.calDoc=S.me.doctor_id;S.calMode=innerWidth<700?"day":"week"}
    else S.calDoc=S.calDoc||S.doctors[0]?.id||"";
    await load();startPolling()}
  catch(e){if(e.status===401)renderLogin();else $("#rxBody").innerHTML=`<div class="alert bad" style="margin-top:2rem">${esc(e.message)}</div>`}
}
function renderLogin(msg=""){
  $("#who").textContent="";$("#logout").hidden=true;
  $("#rxBody").innerHTML=`<form class="card login" id="rxLogin" novalidate><h3>Intră în panou</h3><p class="muted">Pentru recepție și medicii Piuarfil.</p>${window.pfDemoHint||""}
    <div class="field"><label for="lEmail">Email</label><input id="lEmail" type="email" autocomplete="username"></div>
    <div class="field"><label for="lPass">Parola</label><input id="lPass" type="password" autocomplete="current-password"></div>
    <p id="lErr" class="muted" style="color:var(--bad);margin:0" role="alert">${esc(msg)}</p><button class="btn btn-gold">Intră</button></form>`;
  $("#rxLogin").onsubmit=async e=>{e.preventDefault();const b=e.submitter||$("#rxLogin button");b.disabled=true;
    try{await api("/api/staff/login",{method:"POST",body:{email:$("#lEmail").value,password:$("#lPass").value}});boot()}
    catch(err){$("#lErr").textContent=err.message;b.disabled=false}};
  $("#lEmail").focus();
}
function wantedRange(){
  const T=S.today,c=S.calDay||T,from=[addDaysStr(T,-30),addDaysStr(c,-7)].sort()[0],to=[addDaysStr(T,60),addDaysStr(c,13)].sort()[1];
  return {from,to};
}
async function load(silent){
  try{
    const w=wantedRange();
    const r=await api(`/api/staff/appointments?from=${w.from}&to=${w.to}`);
    Object.assign(S,{appts:r.appointments,daysOff:r.daysOff||[],holidays:r.holidays||[],today:r.today,range:w});
    const pend=S.appts.filter(a=>a.status==="pending").length;
    if(S.lastPending!==null&&pend>S.lastPending&&canEdit())toast("Cerere nouă",`Ai ${plural(pend,"cerere","cereri")} de confirmat.`);
    const nc=newCancels().length;
    if(S.lastCancels!==undefined&&nc>S.lastCancels&&canEdit()){const a=newCancels().slice(-1)[0];toast("Anulare",`${nameOf(a)} a anulat ${fmtShort(a.day)}, ${a.slot} (${docById(a.doctor_id).name}). Ora e liberă.`)}
    S.lastCancels=nc;S.lastPending=pend;document.title=(pend&&canEdit()?`(${pend}) `:"")+"Panou · Piuarfil";
  }catch(e){if(e.status===401)return renderLogin("Sesiunea a expirat. Intră din nou.");if(!silent)toast("Eroare",e.message)}
  render();
}
let _poll=null;
function startPolling(){clearInterval(_poll);_poll=setInterval(()=>{if(!document.hidden&&!$("#modal").classList.contains("open"))load(true)},45000)}
function ensureRange(){const w=wantedRange();if(!S.range||w.from<S.range.from||w.to>S.range.to)load(true);else render()}

/* ---------------- randare ---------------- */
function render(){
  $("#who").textContent=S.me.name+(S.me.role==="doctor"?" · calendarul meu":"");$("#logout").hidden=false;
  const T=S.today,all=S.appts,ed=canEdit(),tom=addDaysStr(T,1);
  const pend=all.filter(a=>a.status==="pending"),nc=newCancels(),todo=ed?manualTodo():[];
  const nT=all.filter(a=>a.day===T&&isActive(a)).length,nM=all.filter(a=>a.day===tom&&isActive(a)).length;
  const tabs=ed?[["cal","Calendar"],["pending",`De confirmat (${pend.length})`],["list","Listă"],["cancelled",`Anulate${nc.length?` · ${nc.length} noi`:""}`]]:[["cal","Calendar"],["list","Listă"]];
  const stats=ed?`<button class="stat p" data-go="pending"><b>${pend.length}</b><span>Cereri de confirmat</span></button><button class="stat c" data-go="today"><b>${nT}</b><span>Programări azi</span></button><button class="stat" data-go="tomorrow"><b>${nM}</b><span>Programări mâine</span></button><button class="stat ${nc.length?"u":""}" data-go="cancelled"><b>${nc.length}</b><span>Anulări noi de la pacienți</span></button>`
    :`<button class="stat c" data-go="today"><b>${nT}</b><span>Pacienți azi</span></button><button class="stat" data-go="tomorrow"><b>${nM}</b><span>Pacienți mâine</span></button>`;
  let body="";
  if(S.view==="cal")body=calendar();
  else if(S.view==="pending")body=pendingView(pend);
  else if(S.view==="list")body=listView();
  else body=cancelledView();
  $("#rxBody").innerHTML=`
    ${ed&&nc.length?`<div class="alert warn" style="margin-top:1.4rem;align-items:center"><b>!</b><span style="flex:1">${nc.length===1?`${esc(nameOf(nc[0]))} a anulat programarea de ${fmtLong(nc[0].day)}, ${nc[0].slot} (${esc(docById(nc[0].doctor_id).name)}). Ora e liberă.`:`${nc.length} pacienți și-au anulat programările. Orele sunt libere.`}</span><button class="btn btn-ghost btn-sm" data-go="cancelled">Vezi</button><button class="btn btn-ghost btn-sm" id="ackCancels">Am văzut</button></div>`:""}
    <div class="stats" style="grid-template-columns:repeat(${ed?4:2},1fr)">${stats}</div>
    ${todo.length?todoBox(todo):""}
    <div class="rx-bar">
      <div class="tabs" role="tablist" style="margin:0">${tabs.map(([k,l])=>`<button role="tab" data-view="${k}" aria-selected="${S.view===k}">${l}</button>`).join("")}</div>
      ${ed?`<div style="display:flex;gap:.5rem;flex-wrap:wrap"><button class="btn btn-gold btn-sm" id="rxAdd">+ Programare telefonică</button><button class="btn btn-ghost btn-sm" id="rxOff">Zile libere medici</button>${window.pfDemoReset?'<button class="btn btn-ghost btn-sm" id="rxReset">Resetează demo</button>':""}</div>`:""}
    </div>
    ${body}`;
  const sc=$(".cal-scroll");if(sc&&S._scrollTop!=null){sc.scrollTop=S._scrollTop;sc.scrollLeft=S._scrollLeft||0}
}
function todoBox(todo){
  return `<section class="todo" aria-label="De anunțat telefonic"><h3>De anunțat telefonic (${todo.length})</h3>
    <p class="muted" style="margin:0 0 .3rem;font-size:.88rem">Pacienți fără email: sună-i sau scrie-le pe WhatsApp, apoi apasă Gata. Ceilalți primesc totul automat pe email.</p>
    ${todo.slice(0,S.todoAll?99:3).map(({a,kind,what},i)=>`<div class="todo-row"><span><b>${esc(nameOf(a))}</b> · de transmis ${what}<br><small class="muted">${esc(docById(a.doctor_id).name)}, ${fmtShort(a.day)}, ${a.slot} · ${fmtPhone(a.phone)}</small></span>
      <a class="btn btn-ghost btn-sm" href="${telHref(a.phone)}">Sună</a>${waBtn(a,kind)}<button class="btn btn-gold btn-sm" data-todo="${i}">Gata</button></div>`).join("")}
    ${todo.length>3?`<button class="linkbtn" id="todoAll" style="margin-top:.4rem;font-size:.9rem">${S.todoAll?"Arată mai puține":`Vezi toate (${todo.length})`}</button>`:""}</section>`;
}

/* ---------- calendar ---------- */
function schedFor(doc,day){return S.schedules.filter(s=>s.doctor_id===doc&&s.weekday===weekdayOf(day)).map(s=>[toMin(s.s),toMin(s.e)])}
function closedReason(doc,day){
  const h=S.holidays.find(x=>x.day===day);if(h)return "Sărbătoare legală<br>"+esc(h.name);
  const o=S.daysOff.find(x=>x.doctor_id===doc&&x.day===day);if(o)return "Zi liberă"+(o.reason?"<br>"+esc(o.reason):"");
  if(!schedFor(doc,day).length)return "Nu consultă";
  return null;
}
function calendar(){
  const ed=canEdit(),T=S.today,day=S.calDay;let cols;
  if(S.calMode==="day"){
    let docs=S.me.role==="doctor"?[S.calDoc]:S.doctors.map(d=>d.id);
    if(ed&&S.doc)docs=[S.doc];
    else if(ed){const busy=new Set(S.appts.filter(a=>a.day===day&&isActive(a)).map(a=>a.doctor_id));docs=docs.filter(id=>!closedReason(id,day)||busy.has(id))}
    cols=docs.map(id=>({doc:id,day}));
  }else{
    const mon=mondayOf(day);cols=[0,1,2,3,4,5,6].map(i=>({doc:S.calDoc,day:addDaysStr(mon,i)}))
      .filter(c=>weekdayOf(c.day)!==0||S.appts.some(a=>a.day===c.day&&a.doctor_id===c.doc&&isActive(a)));
  }
  // intervalul orar afișat: de la primul început de program la ultimul sfârșit (rotunjit la oră)
  let lo=24*60,hi=0;
  for(const c of cols){for(const [s,e] of schedFor(c.doc,c.day)){lo=Math.min(lo,s);hi=Math.max(hi,e)}
    for(const a of S.appts)if(a.day===c.day&&a.doctor_id===c.doc&&isActive(a)){const m=toMin(a.slot);lo=Math.min(lo,m);hi=Math.max(hi,m+docById(a.doctor_id).slot_minutes)}}
  if(lo>=hi){lo=8*60;hi=16*60}
  lo=Math.floor(lo/60)*60;hi=Math.ceil(hi/60)*60;
  const H=(hi-lo)*PPM,hours=[];for(let m=lo;m<=hi;m+=60)hours.push(m);
  const mon=mondayOf(day),label=S.calMode==="day"?fmtLong(day):`${dayNum(mon)} – ${fmtShort(addDaysStr(mon,5))}`;
  const docSel=ed?`<label class="sr" for="calDoc">Medic</label><select id="calDoc" class="search" style="margin:0;max-width:240px">${S.calMode==="day"?`<option value="">Toți medicii</option>`:""}${S.doctors.map(d=>`<option value="${d.id}" ${(S.calMode==="day"?S.doc:S.calDoc)===d.id?"selected":""}>${esc(d.name)}</option>`).join("")}</select>`:"";
  const bar=`<div class="cal-bar">
    <div class="cal-nav"><button class="btn btn-ghost btn-sm" data-cal="prev" aria-label="Înapoi">‹</button><button class="btn btn-ghost btn-sm" data-cal="today">Azi</button><button class="btn btn-ghost btn-sm" data-cal="next" aria-label="Înainte">›</button></div>
    <h2 class="cal-title">${label}</h2><span class="grow"></span>
    <div class="seg" role="group" aria-label="Vedere"><button data-mode="day" aria-pressed="${S.calMode==="day"}">Zi</button><button data-mode="week" aria-pressed="${S.calMode==="week"}">Săptămână</button></div>
    ${docSel}<input id="calDate" type="date" class="search" style="margin:0;max-width:160px" value="${day}" aria-label="Alege data"></div>
    <div class="cal-legend"><span><i style="background:#dce9f5;border-left:3px solid var(--blue)"></i>Confirmată</span><span><i style="background:#fbf3e1;outline:1.5px dashed #d9b46a"></i>De confirmat</span><span><i style="background:var(--bad)"></i>Urgență</span><span><i style="background:repeating-linear-gradient(135deg,#f1f4f7 0 3px,#e9eef3 3px 6px)"></i>În afara programului</span>${ed?"<span>Click pe o oră liberă: programare telefonică</span>":""}</div>`;
  if(!cols.length)return bar+`<div class="empty">Niciun medic nu consultă ${day===T?"azi":"în această zi"}${S.holidays.find(h=>h.day===day)?" (sărbătoare legală)":""}. Folosește săgețile ca să mergi la altă zi.</div>`;
  const head=c=>{if(S.calMode==="day"){const d=docById(c.doc);return `<button class="cal-head" data-weekdoc="${c.doc}" title="Vezi săptămâna lui ${esc(d.name)}"><img src="${esc(d.photo)}" alt=""><span><b>${esc(d.name)}</b><small>${esc((d.specs||[])[0]||d.role||"")}</small></span></button>`}
    const n=S.appts.filter(a=>a.day===c.day&&a.doctor_id===c.doc&&isActive(a)).length;
    return `<button class="cal-head ${c.day===T?"today":""}" data-dayjump="${c.day}"><span><b>${dayDow(c.day)} ${dayNum(c.day)} ${dayMon(c.day)}</b><small>${n?plural(n,"programare","programări"):"liber"}</small></span></button>`};
  const colHtml=c=>{
    const d=docById(c.doc),step=d.slot_minutes||30,closed=closedReason(c.doc,c.day),blocks=schedFor(c.doc,c.day);
    let h="";
    if(closed)h+=`<div class="cal-off" style="top:0;height:${H}px"></div><div class="cal-closed">${closed}</div>`;
    else{let cur=lo;for(const [s,e] of blocks){if(s>cur)h+=`<div class="cal-off" style="top:${(cur-lo)*PPM}px;height:${(s-cur)*PPM}px"></div>`;cur=Math.max(cur,e)}
      if(cur<hi)h+=`<div class="cal-off" style="top:${(cur-lo)*PPM}px;height:${(hi-cur)*PPM}px"></div>`}
    const evs=S.appts.filter(a=>a.day===c.day&&a.doctor_id===c.doc&&isActive(a));
    const taken=new Set(evs.map(a=>a.slot)),now=nowTime();
    if(ed&&!closed)for(const [s,e] of blocks)for(let m=s;m+step<=e;m+=step){const t=toT(m);
      if(taken.has(t)||c.day<T||(c.day===T&&t<=now))continue;
      h+=`<button class="cal-slot" data-free="${c.doc}|${c.day}|${t}" style="top:${(m-lo)*PPM+1}px;height:${step*PPM-2}px" aria-label="Programare telefonică ${t}">+ ${t}</button>`}
    for(const a of evs){const m=toMin(a.slot),ht=step*PPM-2,short=ht<40,past=c.day<T||(c.day===T&&a.slot<now);
      h+=`<button class="cal-ev ${a.status==="pending"?"pend":""} ${a.urgent?"urg":""} ${short?"short":""} ${past?"past":""}" data-open="${a.id}" style="top:${(m-lo)*PPM+1}px;height:${ht}px" title="${esc(a.slot+" · "+nameOf(a)+" · "+a.spec)}"><b>${a.slot}</b><span class="nm">${esc(nameOf(a))}</span>${a.urgent?" · urgent":""}${a.status==="pending"?" · de confirmat":""}<small>${esc(a.spec)}${a.source==="telefon"?" · telefon":""}</small></button>`}
    if(c.day===T){const nm=toMin(now);if(nm>=lo&&nm<=hi)h+=`<div class="cal-now" style="top:${(nm-lo)*PPM}px"></div>`}
    return `<div class="cal-col" style="height:${H}px;--hour:${60*PPM}px">${h}</div>`;
  };
  const minW=S.calMode==="day"?170:120;
  return bar+`<div class="cal-scroll"><div class="cal" style="grid-template-columns:56px repeat(${cols.length},minmax(${minW}px,1fr))">
    <div class="cal-corner"></div>${cols.map(head).join("")}
    <div class="cal-axis" style="height:${H}px">${hours.slice(0,-1).map(m=>`<span style="top:${Math.max(8,(m-lo)*PPM)}px">${toT(m)}</span>`).join("")}</div>${cols.map(colHtml).join("")}
  </div></div>`;
}

/* ---------- liste ---------- */
function item(a){
  const d=docById(a.doctor_id),ed=canEdit();
  let acts="";
  if(ed&&a.status==="pending")acts=`<button class="btn btn-gold btn-sm" data-a="confirm" data-id="${a.id}">Confirmă</button><button class="btn btn-ghost btn-sm" data-a="move" data-id="${a.id}">Altă oră</button><button class="btn btn-ghost btn-sm" data-a="reject" data-id="${a.id}">Respinge</button>`;
  if(ed&&byPatient(a)&&!seenSet().has(a.id)&&a.day>=S.today)acts=`<span class="pill urgent" style="background:var(--warn)">Anulare nouă</span><button class="btn btn-ghost btn-sm" data-a="seen" data-id="${a.id}">Am văzut</button>`;
  let wait="";
  if(ed&&a.status==="pending"){const h=Math.floor((Date.now()-new Date(a.created_at))/36e5);
    if(a.day===addDaysStr(S.today,1))wait='<span class="pill urgent" title="Dacă nu e confirmată azi, cererea expiră la miezul nopții și pacientul primește email">Expiră la miezul nopții</span>';
    else if(h>=24)wait=`<span class="pill urgent" style="background:var(--warn)">Așteaptă de ${h>=48?Math.floor(h/24)+" zile":h+" h"}</span>`;}
  if(a.status==="cancelled"&&a.cancelled_by==="system")wait='<span class="chip">expirată, neconfirmată la timp</span>';
  const who=a.child_name?`${esc(a.child_name)}<br><span class="muted" style="font-size:.85rem;font-weight:400">Copil${a.child_age?", "+esc(a.child_age):""} · părinte: ${esc(a.patient_name)}</span>`:esc(a.patient_name);
  return `<article class="rx-item ${a.urgent&&a.status==="pending"?"isurgent":""}"><div class="rx-row">
      <div class="rx-when"><b>${a.slot}</b><small>${fmtLong(a.day)}</small></div>
      <div><b>${who}</b> ${a.urgent?'<span class="pill urgent">URGENT</span>':""} ${wait}${a.source==="telefon"?' <span class="chip">telefon</span>':""}<br>
        <a class="muted" style="font-size:.88rem" href="${telHref(a.phone)}">${fmtPhone(a.phone)}</a>${a.email?`<span class="muted" style="font-size:.88rem"> · ${esc(a.email)}</span>`:'<span class="muted" style="font-size:.88rem"> · fără email</span>'}</div>
      <div><span style="display:flex;align-items:center;gap:.5rem"><img class="avatar" style="width:34px;height:34px" src="${esc(d.photo)}" alt=""><span><b style="font-size:.92rem">${esc(d.name)}</b><br><span class="muted" style="font-size:.85rem">${esc(a.spec)}</span></span></span></div>
      <div class="rx-actions">${statusPill(a.status)}${acts}<button class="btn btn-ghost btn-sm" data-open="${a.id}">Detalii</button></div>
    </div></article>`;
}
function filterList(list){
  if(S.doc&&canEdit())list=list.filter(a=>a.doctor_id===S.doc);
  if(S.q){const q=S.q.toLowerCase().replace(/\s/g,"");list=list.filter(a=>[a.patient_name,a.child_name,a.phone,a.ref,a.email].join(" ").toLowerCase().replace(/\s/g,"").includes(q))}
  return list;
}
function grouped(list){let last="";const T=S.today;return list.map(a=>{let h="";if(a.day!==last){last=a.day;const c=list.filter(x=>x.day===a.day).length;h=`<h4 class="rx-day">${a.day===T?"Azi · ":a.day===addDaysStr(T,1)?"Mâine · ":""}${fmtLong(a.day)} <span>${plural(c,"programare","programări")}</span></h4>`}return h+item(a)}).join("")}
function filters(extra=""){
  return `<div class="rx-bar"><div style="display:flex;gap:.6rem;flex-wrap:wrap;flex:1;align-items:center">${extra}
    ${canEdit()?`<label class="sr" for="rxDoc">Medic</label><select id="rxDoc" class="search" style="margin:0;max-width:240px"><option value="">Toți medicii</option>${S.doctors.map(d=>`<option value="${d.id}" ${S.doc===d.id?"selected":""}>${esc(d.name)}</option>`).join("")}</select>`:""}
    <label class="sr" for="rxQ">Caută</label><input id="rxQ" class="search" style="margin:0;max-width:260px" placeholder="Caută pacient, telefon sau email" value="${esc(S.q)}"></div>
    <button class="linkbtn" id="rxReload">Reîncarcă</button></div>`;
}
function pendingView(pend){
  const tom=addDaysStr(S.today,1);
  const list=filterList(pend.slice().sort((a,b)=>(b.urgent-a.urgent)||((a.day===tom?0:1)-(b.day===tom?0:1))||(a.day+a.slot).localeCompare(b.day+b.slot)));
  return filters()+`<p class="muted" style="margin:-.4rem 0 .8rem;font-size:.9rem">La confirmare, mutare sau respingere pacientul primește automat email.</p><div class="rx-list">${list.length?list.map(item).join(""):'<div class="empty">Nicio cerere nouă. Cererile de pe site apar aici și în calendar.</div>'}</div>`;
}
function listView(){
  const T=S.today,next=S.listMode==="next";
  let list=S.appts.filter(a=>next?(a.day>=T&&isActive(a)):(a.day<T&&a.status==="confirmed"));
  if(!next)list=list.slice().reverse();
  list=filterList(list);
  const seg=`<div class="seg" role="group" aria-label="Perioada"><button data-list="next" aria-pressed="${next}">Următoare</button><button data-list="past" aria-pressed="${!next}">Trecute</button></div>`;
  return filters(seg)+`<div class="rx-list">${list.length?grouped(list):`<div class="empty">${next?"Nicio programare în următoarele săptămâni.":"Nimic în istoric."}</div>`}</div>`;
}
function cancelledView(){
  const list=filterList(S.appts.filter(a=>a.status==="cancelled"||a.status==="rejected").sort((a,b)=>b.day.localeCompare(a.day)));
  return filters()+`<div class="rx-list">${list.length?list.map(item).join(""):'<div class="empty">Nicio anulare.</div>'}</div>`;
}

/* ---------- detaliile unei programări ---------- */
function openAppt(a){
  const d=docById(a.doctor_id),ed=canEdit(),future=a.day>=S.today,tom=a.day===addDaysStr(S.today,1);
  const mail=a.email?(a.status==="confirmed"&&future?(a.reminded_at?"Reminderul a plecat pe email.":"Primește automat emailurile, inclusiv reminderul din seara dinainte."):"Primește automat emailurile."):"Fără email: confirmarea și reminderul le transmite recepția, la telefon sau pe WhatsApp.";
  let acts="";
  if(ed&&a.status==="pending")acts=`<button class="btn btn-gold btn-sm" data-a="confirm" data-id="${a.id}">Confirmă</button><button class="btn btn-ghost btn-sm" data-a="move" data-id="${a.id}">Altă oră</button><button class="btn btn-ghost btn-sm" data-a="reject" data-id="${a.id}">Respinge</button>`;
  if(ed&&a.status==="confirmed"&&future)acts=`<button class="btn btn-ghost btn-sm" data-a="move" data-id="${a.id}">Mută</button><button class="btn btn-ghost btn-sm" data-a="cancel" data-id="${a.id}">Anulează</button>`;
  const contact=`<a class="btn btn-ghost btn-sm" href="${telHref(a.phone)}">Sună</a>${ed&&!a.email&&isActive(a)?waBtn(a,a.status==="confirmed"&&tom?"remind":"confirm"):""}`;
  openModal(`<div style="display:flex;justify-content:space-between;gap:1rem;align-items:start"><h3 style="margin:0">${esc(nameOf(a))}</h3><div>${statusPill(a.status)} ${a.urgent?'<span class="pill urgent">URGENT</span>':""}</div></div>
    <p class="muted" style="margin:0">${esc(d.name)} · ${esc(a.spec)}<br><b style="color:var(--navy);text-transform:capitalize">${fmtLong(a.day)}, ora ${a.slot}</b></p>
    <div class="ad">
      ${a.child_name?`<div><h4>Copil</h4>${esc(a.child_name)}${a.child_age?", "+esc(a.child_age):""}</div><div><h4>Părinte</h4>${esc(a.patient_name)}</div>`:""}
      <div><h4>Telefon</h4><a href="${telHref(a.phone)}">${fmtPhone(a.phone)}</a></div>
      <div><h4>Email</h4>${a.email?esc(a.email):"—"}</div>
      <div class="full"><h4>Motivul vizitei</h4>${esc(a.reason||"—")}</div>
      <div><h4>Analize anterioare</h4>${esc(a.prev_results||"Nu")}</div>
      <div><h4>Consulturi la alți medici</h4>${esc(a.prev_consults||"Nu")}</div>
      ${ed?`<div class="full alert ${a.email?"info":"warn"}" style="margin:0;font-size:.88rem"><span>${mail}</span></div>`:""}
      <div class="full muted" style="font-size:.8rem">Referință ${esc(a.ref)} · ${a.source==="telefon"?"programare telefonică":"cerere online"} · ${new Date(a.created_at).toLocaleString("ro-RO",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}${a.note?" · "+esc(a.note):""}</div>
    </div>
    <div class="ad-acts">${acts}${contact}<span style="flex:1"></span><button class="btn btn-dark btn-sm" data-close>Închide</button></div>`);
}

/* ---------- acțiuni ---------- */
const byId=id=>S.appts.find(a=>a.id===id);
async function act(a,body,okTitle,okMsg){
  try{const r=await api(`/api/staff/appointments/${a.id}`,{method:"POST",body});
    const tail=["confirm","move","reject","cancel"].includes(body.action)?(r.emailSent?" Pacientul a primit email.":" Pacientul nu are email: anunță-l telefonic (vezi caseta de sus)."):"";
    toast(okTitle,okMsg+tail);await load(true)}
  catch(e){toast("Nu s-a putut",e.message);await load(true)}
}
async function slotPicker(doctor,except){
  const r=await api(`/api/staff/slots?doctor=${encodeURIComponent(doctor)}${except?"&except="+except:""}`);
  return r.days.flatMap(d=>d.slots.map(t=>[d.day,t]));
}
function slotOptions(opts){return opts.length?opts.map(([d,t])=>`<option value="${d}|${t}">${fmtLong(d)}, ${t}</option>`).join(""):'<option value="">Nicio oră liberă în următoarele 5 săptămâni</option>'}
function keepScroll(){const sc=$(".cal-scroll");if(sc){S._scrollTop=sc.scrollTop;S._scrollLeft=sc.scrollLeft}else S._scrollTop=null}

document.addEventListener("click",async e=>{
  const t=e.target.closest("button,[data-open]");if(!t||!t.closest("#rxBody,#modalCard"))return;
  if(t.dataset.view){S.view=t.dataset.view;S._scrollTop=null;render();return}
  if(t.dataset.go){const g=t.dataset.go;S._scrollTop=null;
    if(g==="today"||g==="tomorrow"){S.view="cal";S.calMode="day";S.doc="";S.calDay=g==="today"?S.today:addDaysStr(S.today,1);ensureRange()}
    else{S.view=g;render()}return}
  if(t.dataset.mode){S.calMode=t.dataset.mode;S._scrollTop=null;render();return}
  if(t.dataset.cal){const k=t.dataset.cal,n=S.calMode==="day"?1:7;S.calDay=k==="today"?S.today:addDaysStr(S.calDay,k==="next"?n:-n);S._scrollTop=null;ensureRange();return}
  if(t.dataset.dayjump){S.calDay=t.dataset.dayjump;S.calMode="day";if(canEdit())S.doc="";S._scrollTop=null;render();return}
  if(t.dataset.weekdoc){if(!canEdit()&&S.me.role==="doctor"){S.calMode="week";render();return}S.calDoc=t.dataset.weekdoc;S.calMode="week";S._scrollTop=null;render();return}
  if(t.dataset.list){S.listMode=t.dataset.list;render();return}
  if(t.dataset.free){keepScroll();const [doc,day,slot]=t.dataset.free.split("|");phoneBooking({doc,day,slot});return}
  if(t.dataset.open){keepScroll();const a=byId(t.dataset.open);if(a)openAppt(a);return}
  if(t.dataset.todo!=null){keepScroll();const x=manualTodo()[+t.dataset.todo];if(x){t.disabled=true;const acts=[].concat(x.act);
    try{for(const b of acts)await api(`/api/staff/appointments/${x.a.id}`,{method:"POST",body:b});toast("Notat",`${nameOf(x.a)}: gata.`)}catch(e){toast("Nu s-a putut",e.message)}await load(true)}return}
  if(t.id==="todoAll"){S.todoAll=!S.todoAll;render();return}
  if(t.id==="rxReload"){load();return}
  if(t.id==="rxAdd"){keepScroll();phoneBooking();return}
  if(t.id==="rxOff"){daysOff();return}
  if(t.id==="rxReset"){pfDemoReset();S.lastPending=null;S.lastCancels=undefined;await load();toast("Demo","Datele au fost resetate.");return}
  if(t.id==="ackCancels"){markSeen(newCancels().map(a=>a.id));S.lastCancels=0;render();return}
  const a=byId(t.dataset.id);if(!a||!t.dataset.a)return;const name=nameOf(a);keepScroll();
  switch(t.dataset.a){
    case "confirm":t.disabled=true;t.textContent="Se confirmă…";closeModal();await act(a,{action:"confirm"},"Confirmată",`${name}: ${fmtShort(a.day)}, ${a.slot}.`);break;
    case "seen":markSeen([a.id]);S.lastCancels=newCancels().length;render();break;
    case "reject":openModal(`<h3>Respingi cererea lui ${esc(name)}?</h3><div class="field"><label for="rjWhy">Motivul (îl primește pacientul pe email)</label><textarea id="rjWhy">Medicul nu este disponibil în acest interval. Vă rugăm să alegeți altă oră.</textarea></div><p class="muted" style="font-size:.88rem">Ora devine liberă.</p><div style="display:flex;gap:.6rem;justify-content:flex-end"><button class="btn btn-ghost" data-close>Renunță</button><button class="btn btn-dark" id="cf">Respinge cererea</button></div>`,()=>{$("#cf").onclick=async()=>{const n=$("#rjWhy").value.trim();closeModal();await act(a,{action:"reject",note:n},"Cerere respinsă",`${name}.`)}});break;
    case "cancel":openModal(`<h3>Anulezi programarea lui ${esc(name)}?</h3><p class="muted">${esc(docById(a.doctor_id).name)}, ${fmtLong(a.day)}, ${a.slot}. Ora devine liberă, iar pacientul primește email.</p><div class="field"><label for="cnWhy">Motiv (opțional, apare în email)</label><input id="cnWhy" placeholder="ex. medicul are o urgență"></div><div style="display:flex;gap:.6rem;justify-content:flex-end"><button class="btn btn-ghost" data-close>Păstrează</button><button class="btn btn-dark" id="cf">Anulează programarea</button></div>`,()=>{$("#cf").onclick=async()=>{const n=$("#cnWhy").value.trim();closeModal();await act(a,{action:"cancel",note:n||undefined},"Programare anulată",`${name}.`)}});break;
    case "move":{
      openModal(`<h3>Altă oră pentru ${esc(name)}</h3><p class="muted">${esc(docById(a.doctor_id).name)} · acum: ${fmtLong(a.day)}, ${a.slot}</p><div class="field"><label for="mvSel">Ora nouă</label><select id="mvSel"><option>Se încarcă…</option></select></div><p class="muted" style="font-size:.85rem">Programarea devine confirmată la ora nouă, iar pacientul primește email.</p><div style="display:flex;gap:.6rem;justify-content:flex-end"><button class="btn btn-ghost" data-close>Renunță</button><button class="btn btn-gold" id="cf" disabled>Mută programarea</button></div>`);
      try{const o=await slotPicker(a.doctor_id,a.id);$("#mvSel").innerHTML=slotOptions(o);$("#cf").disabled=!o.length}catch(err){$("#mvSel").innerHTML=`<option>${esc(err.message)}</option>`}
      $("#cf").onclick=async()=>{const [d,s]=$("#mvSel").value.split("|");closeModal();await act(a,{action:"move",day:d,slot:s},"Programare mutată",`${name}: ${fmtShort(d)}, ${s}.`)};
      break;}
  }
});
$("#rxBody").addEventListener("change",e=>{
  if(e.target.id==="rxDoc"){S.doc=e.target.value;render()}
  if(e.target.id==="calDoc"){if(S.calMode==="day")S.doc=e.target.value;else S.calDoc=e.target.value;S._scrollTop=null;render()}
  if(e.target.id==="calDate"&&e.target.value){S.calDay=e.target.value;S._scrollTop=null;ensureRange()}
});
$("#rxBody").addEventListener("input",e=>{if(e.target.id==="rxQ"){S.q=e.target.value;const pos=e.target.selectionStart;render();const n=$("#rxQ");n.focus();n.setSelectionRange(pos,pos)}});
$("#logout").onclick=async()=>{await api("/api/staff/logout",{method:"POST",body:{}}).catch(()=>{});clearInterval(_poll);Object.assign(S,{lastPending:null,lastCancels:undefined,me:null,view:null,doc:"",q:"",calDay:null,calMode:"day",_scrollTop:null});renderLogin()};

function phoneBooking(pre){
  const fixed=pre&&pre.doc,d=fixed?docById(pre.doc):null;
  openModal(`<h3>Programare primită la telefon</h3><p class="muted" style="margin:0">Se salvează direct ca confirmată și ora dispare de pe site.</p>
    ${fixed?`<div class="alert info" style="margin:0"><span><b>${esc(d.name)}</b><br><span style="text-transform:capitalize">${fmtLong(pre.day)}</span>, ora ${pre.slot}</span></div>`
      :`<div class="field"><label for="pbDoc">Medic</label><select id="pbDoc">${S.doctors.map(x=>`<option value="${x.id}">${esc(x.name)} · ${esc(x.role)}</option>`).join("")}</select></div>
    <div class="field"><label for="pbSlot">Ziua și ora</label><select id="pbSlot"><option>Se încarcă…</option></select></div>`}
    <div class="field"><label for="pbName">Pacient</label><input id="pbName" placeholder="Nume și prenume" autocomplete="off"></div>
    <div class="field"><label for="pbChild">Copil (dacă e pentru un copil)</label><input id="pbChild" placeholder="Numele copilului" autocomplete="off"></div>
    <div class="field"><label for="pbPhone">Telefon</label><input id="pbPhone" inputmode="tel" autocomplete="off"></div>
    <div class="field"><label for="pbEmail">Email (opțional)</label><input id="pbEmail" type="email" autocomplete="off"><span class="hint">Dacă îl dă, primește confirmarea și reminderul automat.</span></div>
    <div class="field"><label for="pbReason">Motiv (opțional)</label><input id="pbReason" autocomplete="off"></div>
    <p id="pbErr" class="muted" style="color:var(--bad);margin:0" role="alert"></p>
    <div style="display:flex;gap:.6rem;justify-content:flex-end"><button class="btn btn-ghost" data-close>Renunță</button><button class="btn btn-gold" id="pbSave">Salvează programarea</button></div>`,()=>{
    if(!fixed){const fill=async()=>{$("#pbSlot").innerHTML="<option>Se încarcă…</option>";try{$("#pbSlot").innerHTML=slotOptions(await slotPicker($("#pbDoc").value))}catch(e){$("#pbErr").textContent=e.message}};
      fill();$("#pbDoc").onchange=fill}
    if(fixed)setTimeout(()=>$("#pbName").focus(),0);
    $("#pbSave").onclick=async()=>{let doctor,day,slot;
      if(fixed)({doc:doctor,day,slot}=pre);else{const v=$("#pbSlot").value;if(!v||!v.includes("|")){$("#pbErr").textContent="Alege ziua și ora.";return}[day,slot]=v.split("|");doctor=$("#pbDoc").value}
      const b=$("#pbSave");b.disabled=true;
      try{const r=await api("/api/staff/appointments",{method:"POST",body:{doctor,day,slot,name:$("#pbName").value,phone:$("#pbPhone").value,email:$("#pbEmail").value.trim(),reason:$("#pbReason").value,childName:$("#pbChild").value}});
        const nm=$("#pbName").value;closeModal();toast("Programare salvată",`${nm}, ${fmtShort(day)}, ${slot}.${r.emailSent?" Confirmarea a plecat pe email.":""}`);
        S.view="cal";S.calDay=day;if(S.calMode==="week")S.calDoc=doctor;await load(true)}
      catch(e){$("#pbErr").textContent=e.message;b.disabled=false}};
  });
}
async function daysOff(){
  const list=async()=>{const r=await api("/api/staff/days-off");return r.daysOff.length?r.daysOff.map(o=>`<div class="offrow"><span><b>${esc(o.doctor_name)}</b><br><span class="muted" style="font-size:.85rem">${fmtLong(o.day)}${o.reason?" · "+esc(o.reason):""}</span></span><button class="btn btn-ghost btn-sm" data-un="${o.doctor_id}|${o.day}">Șterge</button></div>`).join(""):'<p class="muted">Nicio zi liberă programată.</p>'};
  openModal(`<h3>Zile libere medici</h3><p class="muted" style="margin:0">În aceste zile pacienții nu pot alege medicul pe site.</p>
    <div class="field"><label for="offDoc">Medic</label><select id="offDoc">${S.doctors.map(d=>`<option value="${d.id}">${esc(d.name)}</option>`).join("")}</select></div>
    <div class="field"><label for="offDate">Ziua</label><input id="offDate" type="date" min="${S.today}"></div>
    <div class="field"><label for="offWhy">Motiv (opțional)</label><input id="offWhy" placeholder="ex. concediu, curs"></div>
    <p id="offMsg" class="muted" style="margin:0" role="status"></p>
    <button class="btn btn-gold btn-sm" id="offAdd" style="justify-self:start">Marchează ziua liberă</button>
    <div id="offList"><p class="muted">Se încarcă…</p></div>
    <div style="display:flex;justify-content:flex-end"><button class="btn btn-dark" data-close>Gata</button></div>`);
  const refresh=async()=>{$("#offList").innerHTML=await list()};refresh();
  $("#offAdd").onclick=async()=>{const doc=$("#offDoc").value,day=$("#offDate").value;if(!day){$("#offMsg").textContent="Alege ziua.";return}
    try{const r=await api("/api/staff/days-off",{method:"POST",body:{doctor:doc,day,reason:$("#offWhy").value}});
      $("#offMsg").innerHTML=r.clashes?`<span style="color:var(--warn)">Atenție: ${plural(r.clashes,"programare activă","programări active")} la acest medic în ziua aceea. Mută-le sau anulează-le din calendar.</span>`:"Ziua a fost marcată.";refresh();load(true)}
    catch(e){$("#offMsg").textContent=e.message}};
  $("#offList").onclick=async e=>{const b=e.target.closest("[data-un]");if(!b)return;const [doc,day]=b.dataset.un.split("|");await api(`/api/staff/days-off?doctor=${doc}&day=${day}`,{method:"DELETE"});refresh();load(true)};
}
boot();
