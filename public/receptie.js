/* Piuarfil: panoul recepției (și agenda medicilor). Toate datele vin din /api/staff. */
let S={me:null,doctors:[],appts:[],today:null,phone:"",filter:null,doc:"",q:"",open:{},loading:false,lastPending:null};
const docById=id=>S.doctors.find(d=>d.id===id)||{name:id,photo:""};
const canEdit=()=>S.me&&S.me.role!=="doctor";
/* WhatsApp: deschide conversația cu mesajul gata scris; recepția apasă Trimite. Fără date medicale în mesaj. */
const patientLink=t=>(window.pfLinkFor?window.pfLinkFor(t):location.origin+"/p/"+t);
function waNumber(p){let d=String(p).replace(/\D/g,"");if(d.startsWith("00"))d=d.slice(2);if(d.startsWith("0"))d="40"+d.slice(1);return d}
function waText(a,kind){
  const d=docById(a.doctor_id),cine=a.child_name?` pentru ${a.child_name}`:"",cand=`${fmtLong(a.day)}, ora ${a.slot}`,link=patientLink(a.token);
  return {confirm:`Bună ziua! Programarea dvs.${cine} la Piuarfil este confirmată: ${d.name}, ${cand}.\nDetalii sau anulare (cu minimum 48h înainte): ${link}\nVă așteptăm!`,
    move:`Bună ziua! Programarea dvs.${cine} la Piuarfil a fost mutată: ${d.name}, ${cand}.\nDetalii sau anulare: ${link}`,
    remind:`Bună ziua! Vă reamintim de programarea dvs.${cine} de mâine la Piuarfil: ${d.name}, ora ${a.slot}.\nDacă nu mai puteți ajunge, vă rugăm să ne anunțați răspunzând la acest mesaj. Vă mulțumim!`,
    expired:`Bună ziua! Ne cerem scuze, nu am reușit să confirmăm la timp cererea dvs.${cine} pentru ${d.name} (${cand}). Vă rugăm să ne răspundeți aici și găsim împreună o oră potrivită.`,
    reject:`Bună ziua! Din păcate nu putem confirma programarea${cine} cerută la ${d.name} (${cand}). ${a.note||""}\nVă rugăm să alegeți altă oră pe site sau să ne răspundeți aici.`,
    cancel:`Bună ziua! Programarea dvs.${cine} la Piuarfil (${d.name}, ${cand}) a fost anulată. ${a.note&&!/recep/i.test(a.note)?a.note:""}\nPentru o programare nouă ne puteți scrie aici.`}[kind];
}
const waHref=(a,kind)=>`https://wa.me/${waNumber(a.phone)}?text=${encodeURIComponent(waText(a,kind))}`;
const WA_ICON='<svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.4.8 3.2.7a2.8 2.8 0 0 0 1.8-1.3 2.3 2.3 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3Z"/></svg>';
const waBtn=(a,kind,label)=>`<a class="btn btn-wa btn-sm" href="${waHref(a,kind)}" target="_blank" rel="noopener" data-wa="${kind}" data-id="${a.id}">${WA_ICON}${label}</a>`;
/* anulări făcute de pacienți, încă nevăzute de recepție (memorat în acest browser) */
const SEEN_KEY="pf-seen-cancels";
function seenSet(){try{return new Set(JSON.parse(localStorage.getItem(SEEN_KEY)||"[]"))}catch(e){return new Set()}}
function markSeen(ids){try{const s=seenSet();ids.forEach(i=>s.add(i));localStorage.setItem(SEEN_KEY,JSON.stringify([...s].slice(-500)))}catch(e){}}
const byPatient=a=>a.status==="cancelled"&&a.cancelled_by==="patient";
function newCancels(){const s=seenSet();return S.appts.filter(a=>byPatient(a)&&a.day>=S.today&&!s.has(a.id))}

async function boot(){
  try{const r=await api("/api/staff/me");Object.assign(S,{me:r.me,doctors:r.doctors,today:r.today,phone:r.phone});S.filter=S.filter||(canEdit()?"pending":"mine");await load();startPolling()}
  catch(e){if(e.status===401)renderLogin();else $("#rxBody").innerHTML=`<div class="alert bad" style="margin-top:2rem">${esc(e.message)}</div>`}
}
function renderLogin(msg=""){
  $("#who").textContent="";$("#logout").hidden=true;
  $("#rxBody").innerHTML=`<form class="card login" id="rxLogin" novalidate><h3>Intră în panou</h3><p class="muted">Pentru recepție și medicii Piuarfil.</p>
    <div class="field"><label for="lEmail">Email</label><input id="lEmail" type="email" autocomplete="username"></div>
    <div class="field"><label for="lPass">Parola</label><input id="lPass" type="password" autocomplete="current-password"></div>
    <p id="lErr" class="muted" style="color:var(--bad);margin:0" role="alert">${esc(msg)}</p><button class="btn btn-gold">Intră</button></form>`;
  $("#rxLogin").onsubmit=async e=>{e.preventDefault();const b=e.submitter||$("#rxLogin button");b.disabled=true;
    try{await api("/api/staff/login",{method:"POST",body:{email:$("#lEmail").value,password:$("#lPass").value}});boot()}
    catch(err){$("#lErr").textContent=err.message;b.disabled=false}};
  $("#lEmail").focus();
}
async function load(silent){
  if(!silent){S.loading=true}
  try{
    const r=await api(`/api/staff/appointments?from=${addDaysStr(S.today,-30)}&to=${addDaysStr(S.today,60)}`);
    S.appts=r.appointments;S.today=r.today;
    const pend=S.appts.filter(a=>a.status==="pending").length;
    if(S.lastPending!==null&&pend>S.lastPending&&canEdit())toast("Cerere nouă",`Ai ${plural(pend,"cerere","cereri")} de confirmat.`);
    const nc=newCancels().length;
    if(S.lastCancels!==undefined&&nc>S.lastCancels&&canEdit()){const a=newCancels().slice(-1)[0];toast("Anulare",`${a.child_name||a.patient_name} a anulat ${fmtShort(a.day)}, ${a.slot} (${docById(a.doctor_id).name}). Ora e liberă.`)}
    S.lastCancels=nc;
    S.lastPending=pend;document.title=(pend&&canEdit()?`(${pend}) `:"")+"Panou · Piuarfil";
  }catch(e){if(e.status===401)return renderLogin("Sesiunea a expirat. Intră din nou.");if(!silent)toast("Eroare",e.message)}
  S.loading=false;render();
}
let _poll=null;
function startPolling(){clearInterval(_poll);_poll=setInterval(()=>{if(!document.hidden&&!$("#modal").classList.contains("open"))load(true)},45000)}

function render(){
  $("#who").textContent=S.me.name+(S.me.role==="doctor"?" · agenda proprie":"");$("#logout").hidden=false;
  const T=S.today,all=S.appts,ed=canEdit();
  const pend=all.filter(a=>a.status==="pending"),urg=pend.filter(a=>a.urgent);
  const toCall=all.filter(a=>a.status==="confirmed"&&!a.notified&&a.day>=T);
  const tom=addDaysStr(T,1),toRemind=all.filter(a=>a.day===tom&&a.status==="confirmed"&&!a.reminded_at),nc=newCancels();
  const todayN=all.filter(a=>a.day===T&&a.status==="confirmed").length;
  const tomorrowN=all.filter(a=>a.day===addDaysStr(T,1)&&a.status==="confirmed").length;
  const tabs=ed?[["pending",`De confirmat (${pend.length})`],["call",`De anunțat (${toCall.length})`],["remind",`Reminder mâine (${toRemind.length})`],["today","Azi"],["agenda","Agendă"],["past","Istoric"],["cancelled",`Anulate${nc.length?` · ${nc.length} noi`:""}`]]
               :[["mine","Ziua mea"],["agenda","Agendă"],["past","Istoric"]];
  let list;
  switch(S.filter){
    case "pending":list=pend.slice().sort((a,b)=>(b.urgent-a.urgent)||((a.day===tom)?0:1)-((b.day===tom)?0:1)||(a.day+a.slot).localeCompare(b.day+b.slot));break;
    case "call":list=toCall;break;
    case "remind":list=all.filter(a=>a.day===tom&&a.status==="confirmed");break;
    case "today":list=all.filter(a=>a.day===T&&a.status==="confirmed");break;
    case "mine":list=all.filter(a=>(a.day===T||a.day===addDaysStr(T,1))&&a.status==="confirmed");break;
    case "agenda":list=all.filter(a=>a.status==="confirmed"&&a.day>=T);break;
    case "past":list=all.filter(a=>a.day<T&&a.status==="confirmed").reverse();break;
    case "cancelled":list=all.filter(a=>a.status==="cancelled"||a.status==="rejected").sort((a,b)=>b.day.localeCompare(a.day));break;
    default:list=[];
  }
  if(S.doc)list=list.filter(a=>a.doctor_id===S.doc);
  if(S.q){const q=S.q.toLowerCase().replace(/\s/g,"");list=list.filter(a=>[a.patient_name,a.child_name,a.phone,a.ref].join(" ").toLowerCase().replace(/\s/g,"").includes(q))}
  const grouped=!["pending","call","remind"].includes(S.filter);let last="";
  const rows=list.map(a=>{let h="";if(grouped&&a.day!==last){last=a.day;const c=list.filter(x=>x.day===a.day).length;h=`<h4 class="rx-day">${a.day===T?"Azi · ":a.day===addDaysStr(T,1)?"Mâine · ":""}${fmtLong(a.day)} <span>${plural(c,"programare","programări")}</span></h4>`}return h+item(a)}).join("");
  const stats=ed?`<div class="stat p"><b>${pend.length}</b><span>Cereri de confirmat</span></div><div class="stat u"><b>${urg.length}</b><span>Urgențe în așteptare</span></div><div class="stat c"><b>${toCall.length+toRemind.length}</b><span>Mesaje de trimis</span></div><div class="stat ${nc.length?"u":""}"><b>${nc.length}</b><span>Anulări noi de la pacienți</span></div>`
                :`<div class="stat c"><b>${todayN}</b><span>Pacienți azi</span></div><div class="stat"><b>${tomorrowN}</b><span>Pacienți mâine</span></div>`;
  const empty={pending:"Nicio cerere nouă. Cererile de pe site apar aici automat.",call:"Toți pacienții confirmați au fost anunțați.",remind:"Nicio programare mâine.",today:"Nicio programare azi.",mine:"Nicio programare azi sau mâine.",agenda:"Nicio programare confirmată în următoarele două luni.",past:"Nimic în istoric.",cancelled:"Nicio anulare."}[S.filter];
  $("#rxBody").innerHTML=`
    ${ed&&nc.length?`<div class="alert warn" style="margin-top:1.4rem;align-items:center"><b>!</b><span style="flex:1">${nc.length===1?`${esc(nc[0].child_name||nc[0].patient_name)} a anulat programarea de ${fmtLong(nc[0].day)}, ${nc[0].slot} (${esc(docById(nc[0].doctor_id).name)}). Ora e liberă.`:`${nc.length} pacienți și-au anulat programările. Orele sunt libere.`}</span><button class="btn btn-ghost btn-sm" id="seeCancels">Vezi</button><button class="btn btn-ghost btn-sm" id="ackCancels">Am văzut</button></div>`:""}
    <div class="stats" style="grid-template-columns:repeat(${ed?4:2},1fr)">${stats}</div>
    <div class="rx-bar">
      <div class="tabs" role="tablist" style="margin:0">${tabs.map(([k,l])=>`<button role="tab" data-filter="${k}" aria-selected="${S.filter===k}">${l}</button>`).join("")}</div>
      ${ed?`<div style="display:flex;gap:.5rem;flex-wrap:wrap"><button class="btn btn-gold btn-sm" id="rxAdd">+ Programare telefonică</button><button class="btn btn-ghost btn-sm" id="rxOff">Zile libere medici</button></div>`:""}
    </div>
    <div class="rx-bar">
      <div style="display:flex;gap:.6rem;flex-wrap:wrap;flex:1">
        ${ed?`<label class="sr" for="rxDoc">Medic</label><select id="rxDoc" class="search" style="margin:0;max-width:260px"><option value="">Toți medicii</option>${S.doctors.map(d=>`<option value="${d.id}" ${S.doc===d.id?"selected":""}>${esc(d.name)}</option>`).join("")}</select>`:""}
        <label class="sr" for="rxQ">Caută</label><input id="rxQ" class="search" style="margin:0;max-width:280px" placeholder="Caută pacient sau telefon" value="${esc(S.q)}">
      </div>
      <span class="muted" style="font-size:.88rem">${plural(list.length,"rezultat","rezultate")} · <button class="linkbtn" id="rxReload">Reîncarcă</button></span>
    </div>
    <div class="rx-list">${list.length?rows:`<div class="empty">${empty}</div>`}</div>`;
}
function item(a){
  const d=docById(a.doctor_id),open=S.open[a.id],ed=canEdit(),future=a.day>=S.today;
  let acts="";
  if(ed&&a.status==="pending")acts=`<button class="btn btn-gold btn-sm" data-a="confirm" data-id="${a.id}">Confirmă</button><button class="btn btn-ghost btn-sm" data-a="move" data-id="${a.id}">Altă oră</button><button class="btn btn-ghost btn-sm" data-a="reject" data-id="${a.id}">Respinge</button>`;
  if(ed&&a.status==="confirmed"&&future)acts=`${S.filter==="remind"?(a.reminded_at?'<span class="chip">✓ reminder trimis</span>':waBtn(a,"remind","Reminder")):!a.notified?`${waBtn(a,/mutat/i.test(a.note||"")?"move":"confirm","WhatsApp")}<a class="btn btn-ghost btn-sm" href="${telHref(a.phone)}">Sună</a><button class="btn btn-ghost btn-sm" data-a="notified" data-id="${a.id}">Am anunțat</button>`:""}<button class="btn btn-ghost btn-sm" data-a="move" data-id="${a.id}">Mută</button><button class="btn btn-ghost btn-sm" data-a="cancel" data-id="${a.id}">Anulează</button>`;
  if(ed&&(a.status==="rejected"||(a.status==="cancelled"&&!byPatient(a)))&&future&&!a.notified)acts=`${waBtn(a,a.status==="rejected"?"reject":a.cancelled_by==="system"?"expired":"cancel","Anunță pe WhatsApp")}<button class="btn btn-ghost btn-sm" data-a="notified" data-id="${a.id}">Am anunțat</button>`;
  if(ed&&byPatient(a)&&!seenSet().has(a.id)&&future)acts=`<span class="pill urgent" style="background:var(--warn)">Anulare nouă</span><button class="btn btn-ghost btn-sm" data-a="seen" data-id="${a.id}">Am văzut</button>`;
  let wait="";
  if(ed&&a.status==="pending"){const h=Math.floor((Date.now()-new Date(a.created_at))/36e5),tom=a.day===addDaysStr(S.today,1);
    if(tom)wait='<span class="pill urgent" title="Dacă nu e confirmată azi, cererea se anulează automat la miezul nopții">Expiră la miezul nopții</span>';
    else if(h>=24)wait=`<span class="pill urgent" style="background:var(--warn)">Așteaptă de ${h>=48?Math.floor(h/24)+" zile":h+" h"}</span>`;}
  if(a.status==="cancelled"&&a.cancelled_by==="system")wait='<span class="chip">expirată, neconfirmată la timp</span>';
  const who=a.child_name?`${esc(a.child_name)}<br><span class="muted" style="font-size:.85rem;font-weight:400">Copil${a.child_age?", "+esc(a.child_age):""} · părinte: ${esc(a.patient_name)}</span>`:esc(a.patient_name);
  return `<article class="rx-item ${a.urgent&&a.status==="pending"?"isurgent":""}">
    <div class="rx-row">
      <div class="rx-when"><b>${a.slot}</b><small>${fmtLong(a.day)}</small></div>
      <div><b>${who}</b> ${a.urgent?'<span class="pill urgent">URGENT</span>':""} ${wait}${a.source==="telefon"?' <span class="chip">telefon</span>':""}<br>
        <a class="muted" style="font-size:.88rem" href="${telHref(a.phone)}">${fmtPhone(a.phone)}</a>${a.email?`<span class="muted" style="font-size:.88rem"> · ${esc(a.email)}</span>`:""}
        ${ed&&a.status==="confirmed"&&future?`<br><span class="chip" style="margin-top:.3rem;display:inline-block">${a.notified?"✓ anunțat":"de anunțat"+(a.email?" (are email)":"")}</span>`:""}</div>
      <div><span style="display:flex;align-items:center;gap:.5rem"><img class="avatar" style="width:34px;height:34px" src="${esc(d.photo)}" alt=""><span><b style="font-size:.92rem">${esc(d.name)}</b><br><span class="muted" style="font-size:.85rem">${esc(a.spec)}</span></span></span></div>
      <div class="rx-actions">${statusPill(a.status)}${acts}<button class="btn btn-ghost btn-sm" data-a="toggle" data-id="${a.id}" aria-expanded="${!!open}">${open?"Ascunde":"Detalii"}</button></div>
    </div>
    ${open?`<div class="rx-detail">
      <div><h4>Motivul vizitei</h4>${esc(a.reason||"—")}</div>
      <div><h4>Analize anterioare</h4>${esc(a.prev_results||"Nu")}</div>
      <div><h4>Consulturi la alți medici</h4>${esc(a.prev_consults||"Nu")}</div>
      <div class="full muted" style="font-size:.82rem">Referință ${esc(a.ref)} · trimisă ${new Date(a.created_at).toLocaleString("ro-RO",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}${a.note?" · "+esc(a.note):""}</div>
    </div>`:""}
  </article>`;
}
const byId=id=>S.appts.find(a=>a.id===id);
async function act(a,body,okTitle,okMsg){
  try{const r=await api(`/api/staff/appointments/${a.id}`,{method:"POST",body});toast(okTitle,okMsg+(r.emailSent?" Email trimis pacientului.":""));await load(true)}
  catch(e){toast("Nu s-a putut",e.message);await load(true)}
}
async function slotPicker(doctor,except){
  const r=await api(`/api/staff/slots?doctor=${encodeURIComponent(doctor)}${except?"&except="+except:""}`);
  return r.days.flatMap(d=>d.slots.map(t=>[d.day,t]));
}
function slotOptions(opts){return opts.length?opts.map(([d,t])=>`<option value="${d}|${t}">${fmtLong(d)}, ${t}</option>`).join(""):'<option value="">Nicio oră liberă în următoarele 5 săptămâni</option>'}

$("#rxBody").addEventListener("click",e=>{
  const w=e.target.closest("[data-wa]");if(!w)return;const a=byId(w.dataset.id);if(!a)return;
  const body=w.dataset.wa==="remind"?{action:"reminded"}:{action:"notified",value:true};
  setTimeout(()=>act(a,body,w.dataset.wa==="remind"?"Reminder":"Notat",`Mesaj deschis în WhatsApp pentru ${a.child_name||a.patient_name}. Apasă Trimite acolo.`),400);
});
$("#rxBody").addEventListener("click",async e=>{
  const t=e.target.closest("button");if(!t)return;
  if(t.dataset.filter){S.filter=t.dataset.filter;render();return}
  if(t.id==="rxReload"){load();return}
  if(t.id==="rxAdd"){phoneBooking();return}
  if(t.id==="rxOff"){daysOff();return}
  if(t.id==="ackCancels"){markSeen(newCancels().map(a=>a.id));S.lastCancels=0;render();return}
  if(t.id==="seeCancels"){S.filter="cancelled";render();return}
  const a=byId(t.dataset.id);if(!a)return;const name=a.child_name||a.patient_name;
  switch(t.dataset.a){
    case "toggle":S.open[a.id]=!S.open[a.id];render();break;
    case "confirm":t.disabled=true;t.textContent="Se confirmă…";await act(a,{action:"confirm"},"Confirmată",`${name}: ${fmtShort(a.day)}, ${a.slot}. Sună pacientul să-l anunți.`);S.open={};break;
    case "seen":markSeen([a.id]);S.lastCancels=newCancels().length;render();break;
    case "notified":await act(a,{action:"notified",value:true},"Notat",`${name} a fost anunțat.`);break;
    case "reject":openModal(`<h3>Respingi cererea lui ${esc(name)}?</h3><div class="field"><label for="rjWhy">Motivul (îl vede pacientul în linkul lui)</label><textarea id="rjWhy">Medicul nu este disponibil în acest interval. Vă rugăm să alegeți altă oră.</textarea></div><p class="muted" style="font-size:.88rem">Ora devine liberă. Anunță pacientul telefonic: ${fmtPhone(a.phone)}.</p><div style="display:flex;gap:.6rem;justify-content:flex-end"><button class="btn btn-ghost" data-close>Renunță</button><button class="btn btn-dark" id="cf">Respinge cererea</button></div>`,()=>{$("#cf").onclick=async()=>{const n=$("#rjWhy").value.trim();closeModal();await act(a,{action:"reject",note:n},"Cerere respinsă",`${name}.`)}});break;
    case "cancel":openModal(`<h3>Anulezi programarea lui ${esc(name)}?</h3><p class="muted">${esc(docById(a.doctor_id).name)}, ${fmtLong(a.day)}, ${a.slot}. Ora devine liberă.</p><div class="field"><label for="cnWhy">Motiv (opțional)</label><input id="cnWhy" placeholder="ex. pacientul a sunat să anuleze"></div><div style="display:flex;gap:.6rem;justify-content:flex-end"><button class="btn btn-ghost" data-close>Păstrează</button><button class="btn btn-dark" id="cf">Anulează programarea</button></div>`,()=>{$("#cf").onclick=async()=>{const n=$("#cnWhy").value.trim();closeModal();await act(a,{action:"cancel",note:n||undefined},"Programare anulată",`${name}.`)}});break;
    case "move":{
      openModal(`<h3>Altă oră pentru ${esc(name)}</h3><p class="muted">${esc(docById(a.doctor_id).name)} · acum: ${fmtLong(a.day)}, ${a.slot}</p><div class="field"><label for="mvSel">Ora nouă</label><select id="mvSel"><option>Se încarcă…</option></select></div><p class="muted" style="font-size:.85rem">Programarea devine confirmată la ora nouă. Anunță pacientul telefonic.</p><div style="display:flex;gap:.6rem;justify-content:flex-end"><button class="btn btn-ghost" data-close>Renunță</button><button class="btn btn-gold" id="cf" disabled>Mută programarea</button></div>`);
      try{const o=await slotPicker(a.doctor_id,a.id);$("#mvSel").innerHTML=slotOptions(o);$("#cf").disabled=!o.length}catch(err){$("#mvSel").innerHTML=`<option>${esc(err.message)}</option>`}
      $("#cf").onclick=async()=>{const [d,s]=$("#mvSel").value.split("|");closeModal();await act(a,{action:"move",day:d,slot:s},"Programare mutată",`${name}: ${fmtShort(d)}, ${s}. Anunță pacientul.`)};
      break;}
  }
});
$("#rxBody").addEventListener("change",e=>{if(e.target.id==="rxDoc"){S.doc=e.target.value;render()}});
$("#rxBody").addEventListener("input",e=>{if(e.target.id==="rxQ"){S.q=e.target.value;const pos=e.target.selectionStart;render();const n=$("#rxQ");n.focus();n.setSelectionRange(pos,pos)}});
$("#logout").onclick=async()=>{await api("/api/staff/logout",{method:"POST",body:{}}).catch(()=>{});clearInterval(_poll);S.lastPending=null;renderLogin()};

function phoneBooking(){
  openModal(`<h3>Programare primită la telefon</h3><p class="muted" style="margin:0">Se salvează direct ca confirmată și ora dispare de pe site.</p>
    <div class="field"><label for="pbDoc">Medic</label><select id="pbDoc">${S.doctors.map(d=>`<option value="${d.id}">${esc(d.name)} · ${esc(d.role)}</option>`).join("")}</select></div>
    <div class="field"><label for="pbSlot">Ziua și ora</label><select id="pbSlot"><option>Se încarcă…</option></select></div>
    <div class="field"><label for="pbName">Pacient</label><input id="pbName" placeholder="Nume și prenume"></div>
    <div class="field"><label for="pbChild">Copil (dacă e pentru un copil)</label><input id="pbChild" placeholder="Numele copilului"></div>
    <div class="field"><label for="pbPhone">Telefon</label><input id="pbPhone" inputmode="tel"></div>
    <div class="field"><label for="pbReason">Motiv (opțional)</label><input id="pbReason"></div>
    <p id="pbErr" class="muted" style="color:var(--bad);margin:0" role="alert"></p>
    <div style="display:flex;gap:.6rem;justify-content:flex-end"><button class="btn btn-ghost" data-close>Renunță</button><button class="btn btn-gold" id="pbSave">Salvează programarea</button></div>`,()=>{
    const fill=async()=>{$("#pbSlot").innerHTML="<option>Se încarcă…</option>";try{$("#pbSlot").innerHTML=slotOptions(await slotPicker($("#pbDoc").value))}catch(e){$("#pbErr").textContent=e.message}};
    fill();$("#pbDoc").onchange=fill;
    $("#pbSave").onclick=async()=>{const v=$("#pbSlot").value;if(!v||!v.includes("|")){$("#pbErr").textContent="Alege ziua și ora.";return}
      const [day,slot]=v.split("|"),b=$("#pbSave");b.disabled=true;
      try{await api("/api/staff/appointments",{method:"POST",body:{doctor:$("#pbDoc").value,day,slot,name:$("#pbName").value,phone:$("#pbPhone").value,reason:$("#pbReason").value,childName:$("#pbChild").value}});
        closeModal();toast("Programare salvată",`${$("#pbName")?.value||""} ${fmtShort(day)}, ${slot}.`);S.filter="agenda";await load(true)}
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
      $("#offMsg").innerHTML=r.clashes?`<span style="color:var(--warn)">Atenție: ${plural(r.clashes,"programare activă","programări active")} la acest medic în ziua aceea. Mută-le sau anulează-le din listă.</span>`:"Ziua a fost marcată.";refresh();load(true)}
    catch(e){$("#offMsg").textContent=e.message}};
  $("#offList").onclick=async e=>{const b=e.target.closest("[data-un]");if(!b)return;const [doc,day]=b.dataset.un.split("|");await api(`/api/staff/days-off?doctor=${doc}&day=${day}`,{method:"DELETE"});refresh()};
}
boot();
