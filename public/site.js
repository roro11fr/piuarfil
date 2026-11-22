/* Piuarfil: site public. Datele vin din /api/public. */
let DOCS=[],SPECS=[],PHONE="0752 192 733";
const docById=id=>DOCS.find(d=>d.id===id);
const KIDS=["Pediatrie","Chirurgie pediatrică"];
function avatar(d,cls=""){return `<img class="avatar ${cls}" src="${d.photo}" alt="">`}

/* ---------------- programare (wizard) ---------------- */
const STEPS=[[0,"Specialitatea"],[2,"Medicul"],[3,"Ziua și ora"],[4,"Datele tale"]];
let st;
function resetBooking(){st={step:0,spec:null,doc:null,date:null,time:null,q:"",avail:null,loading:false,sending:false,showErr:false,
  form:{forChild:null,childName:"",childAge:"",name:"",phone:"",email:"",reason:"",prevResults:"",prevConsults:"",urgent:null,gdpr:false,website:""},done:null}}
resetBooking();

function renderSteps(){
  const d=st.doc&&docById(st.doc);
  const vals={0:st.spec,2:d&&d.name,3:st.date&&st.time&&(fmtShort(st.date)+", "+st.time),4:""};
  $("#stepList").innerHTML='<h3>Programarea ta</h3>'+STEPS.map(([i,s],k)=>`<div class="step ${i===st.step&&!st.done?"on":""} ${i<st.step||st.done?"done":""}"><span class="n">${i<st.step||st.done?"✓":k+1}</span><span>${s}<small>${esc(vals[i]||"")}</small></span></div>`).join("");
}
function foot(canNext,nextLabel="Continuă"){
  return `<div class="pane-foot">${st.step>0&&!st.done?'<button class="btn btn-ghost" data-act="back">Înapoi</button>':"<span></span>"}<button class="btn btn-gold" data-act="next" ${canNext?"":"disabled"}>${nextLabel}</button></div>`;
}
let _bkLast=null;
function renderBooking(){
  _renderBooking();
  const p=$("#pane"),key=st.done?"done":st.step,P={0:12,2:37,3:62,4:87,done:100};
  p.insertAdjacentHTML("afterbegin",`<div class="progress" aria-hidden="true"><i style="width:${P[_bkLast??key]}%"></i></div>`);
  requestAnimationFrame(()=>{const i=p.querySelector(".progress i");if(i)i.style.width=P[key]+"%"});
  if(_bkLast!==null&&_bkLast!==key&&!RM){const back=typeof key==="number"&&typeof _bkLast==="number"&&key<_bkLast;[...p.children].slice(1).forEach((el,k)=>el.animate([{opacity:0,transform:`translateX(${back?-18:18}px)`},{opacity:1,transform:"none"}],{duration:420,delay:k*35,easing:"cubic-bezier(.2,.8,.2,1)",fill:"backwards"}))}
  _bkLast=key;
}
async function loadSlots(){
  const doctor=st.doc;st.loading=true;st.loadErr=null;renderBooking();
  try{const r=await api("/api/public/slots?doctor="+encodeURIComponent(doctor));if(st.doc!==doctor)return;st.avail={doctor,days:r.days.filter(d=>new Date(d.day+"T12:00:00Z").getUTCDay()!==0)}}
  catch(e){st.loadErr=e.message}
  st.loading=false;
  if(st.avail&&(!st.date||!st.avail.days.find(d=>d.day===st.date&&d.open))){const f=st.avail.days.find(d=>d.open);st.date=f?f.day:null;st.time=null}
  if(st.step===3)renderBooking();
}
function _renderBooking(){
  renderSteps();
  const p=$("#pane");
  if(st.done){
    const b=st.done;
    p.innerHTML=`<div class="done-box">
      <div class="seal"><svg width="46" height="40" aria-hidden="true"><use href="#logo"/></svg></div>
      <h3>Cererea a fost trimisă</h3>
      <p class="muted" style="max-width:48ch">Ora e rezervată pentru tine. Recepția îți verifică cererea, iar confirmarea vine pe email, la <b>${esc(b.email)}</b>. Seara dinaintea programării primești și un reminder.</p>
      <div class="summary" style="width:100%;max-width:440px;text-align:left">
        <div><span>Medic</span><b>${esc(b.doctor)}</b></div>
        <div><span>Specialitate</span><b>${esc(b.spec)}</b></div>
        <div><span>Când</span><b>${fmtLong(b.day)}, ${b.time}</b></div>
        <div><span>Status</span>${statusPill("pending")}</div>
      </div>
      <div class="linkbox">
        <b>Linkul tău personal</b>
        <p class="muted">Salvează-l: din el îți vezi programarea și o poți anula, cu cel puțin 48 de ore înainte.</p>
        <div class="linkrow"><input id="myLink" readonly value="${esc(b.link)}" aria-label="Linkul tău personal"><button class="btn btn-dark btn-sm" data-act="copy">Copiază</button></div>
        <a class="link" href="${esc(b.link)}" target="_blank" rel="noopener">Deschide linkul</a>
      </div>
      <button class="btn btn-ghost" data-act="again">Fă altă programare</button>
    </div>`;
    return;
  }
  if(st.step===0){
    const list=SPECS.filter(s=>s.toLowerCase().includes(st.q.toLowerCase()));
    p.innerHTML=`<h3>Cu ce te putem ajuta?</h3><p class="sub">Alege specialitatea de care ai nevoie.</p>
      <label class="sr" for="q">Caută specialitatea</label><input id="q" class="search" placeholder="Caută: cardiologie, pediatrie…" value="${esc(st.q)}">
      <div class="opts">${list.map(s=>{const ds=DOCS.filter(d=>d.specs.includes(s));return `<button class="opt" data-spec="${esc(s)}" aria-pressed="${st.spec===s}"><span>${s}<span class="spec-faces">${ds.map(d=>`<img src="${d.photo}" alt="">`).join("")}</span><small>${plural(ds.length,"medic","medici")}</small></span></button>`}).join("")||'<p class="muted">Nu am găsit specialitatea. Încearcă alt cuvânt.</p>'}</div>
      ${foot(!!st.spec)}`;
    const q=$("#q");q.oninput=e=>{st.q=e.target.value;const pos=e.target.selectionStart;renderBooking();const n=$("#q");n.focus();n.setSelectionRange(pos,pos)};
  }
  if(st.step===2){
    const ds=DOCS.filter(d=>d.specs.includes(st.spec));
    p.innerHTML=`<h3>Alege medicul</h3><p class="sub">${esc(st.spec)} · ${plural(ds.length,"medic","medici")}</p>
      <div class="opts">${ds.map(d=>`<button class="opt" data-doc="${d.id}" aria-pressed="${st.doc===d.id}">${avatar(d)}<span>${d.name}<small>Consultă: ${d.days.map(x=>DOW[x]).join(", ")}</small></span></button>`).join("")}</div>
      ${foot(!!st.doc)}`;
  }
  if(st.step===3){
    const d=docById(st.doc);
    if(st.loading||!st.avail||st.avail.doctor!==st.doc){
      p.innerHTML=`<h3>Alege ziua și ora</h3><p class="sub">${d.name} · ${esc(st.spec)}</p>
        ${st.loadErr?`<div class="alert bad">${esc(st.loadErr)} <button class="btn btn-ghost btn-sm" data-act="retry">Încearcă din nou</button></div>`:'<p class="muted">Se încarcă orele libere…</p>'}${foot(false)}`;
      if(!st.loading&&!st.loadErr)loadSlots();
      return;
    }
    const days=st.avail.days,cur=days.find(x=>x.day===st.date);
    const anyOpen=days.some(x=>x.open);
    p.innerHTML=`<h3>Alege ziua și ora</h3><p class="sub">${d.name} · ${esc(st.spec)}</p>
      ${anyOpen?`<div class="days">${days.map(x=>{const why=x.open?"":(x.reason||"Nicio oră liberă");return `<button class="day" data-date="${x.day}" aria-pressed="${st.date===x.day}" ${x.open?"":"disabled"} title="${esc(why)}" aria-label="${fmtLong(x.day)}${why?", "+esc(why):""}"><small>${dayDow(x.day)}</small><b>${dayNum(x.day)}</b><small>${dayMon(x.day)}</small></button>`}).join("")}</div>
      <div class="times">${(cur?cur.slots:[]).map(s=>`<button class="time" data-time="${s.t}" aria-pressed="${st.time===s.t}" ${s.free?"":"disabled"} aria-label="${s.t}${s.free?"":", ocupat"}">${s.t}</button>`).join("")}</div>`
      :`<div class="alert info">${d.name} nu mai are ore libere online în următoarele trei săptămâni. Sună la recepție: <b>${esc(PHONE)}</b>.</div>`}
      ${foot(!!(st.date&&st.time))}`;
  }
  if(st.step===4){
    const f=st.form,d=docById(st.doc);if(f.forChild===null)f.forChild=KIDS.includes(st.spec);
    const miss=missingFields(f);
    p.innerHTML=`<h3>Câteva detalii</h3><p class="sub">Ajută medicul să se pregătească pentru consultație.</p>
      <form class="form" id="bform" novalidate>
        <div class="field full"><span class="flabel" id="whoL">Pentru cine e programarea?</span>
          <div class="yn" role="group" aria-labelledby="whoL"><button type="button" data-who="0" aria-pressed="${!f.forChild}">Pentru mine</button><button type="button" data-who="1" aria-pressed="${!!f.forChild}">Pentru copilul meu</button></div></div>
        ${f.forChild?`<div class="field"><label for="fChild">Numele copilului *</label><input id="fChild" data-f="childName" value="${esc(f.childName)}" maxlength="80"></div>
        <div class="field"><label for="fAge">Vârsta copilului</label><input id="fAge" data-f="childAge" value="${esc(f.childAge)}" placeholder="ex. 4 ani" maxlength="30"></div>`:""}
        <div class="field"><label for="fName">${f.forChild?"Numele părintelui *":"Nume și prenume *"}</label><input id="fName" data-f="name" value="${esc(f.name)}" autocomplete="name" maxlength="80"></div>
        <div class="field"><label for="fPhone">Telefon *</label><input id="fPhone" data-f="phone" value="${esc(f.phone)}" inputmode="tel" autocomplete="tel" placeholder="07xx xxx xxx" maxlength="20"><span class="hint">Recepția te sună doar dacă e nevoie.</span></div>
        <div class="field full"><label for="fEmail">Email *</label><input id="fEmail" data-f="email" value="${esc(f.email)}" type="email" autocomplete="email" maxlength="120"><span class="hint">Aici primești confirmarea, linkul programării și reminderul de cu o zi înainte.</span></div>
        <div class="field full"><label for="fReason">Motivul vizitei *</label><textarea id="fReason" data-f="reason" maxlength="1000" placeholder="Descrie pe scurt ce simți sau de ce vii">${esc(f.reason)}</textarea></div>
        <div class="field"><label for="fPrev">Ai rezultate la analize anterioare?</label><textarea id="fPrev" data-f="prevResults" maxlength="1000" placeholder="ex. analize de sânge din octombrie">${esc(f.prevResults)}</textarea><span class="hint">Adu-le la consultație, pe hârtie sau pe telefon.</span></div>
        <div class="field"><label for="fCons">Ai mai fost la alți medici pentru asta?</label><textarea id="fCons" data-f="prevConsults" maxlength="1000" placeholder="ex. medicul de familie, cardiolog la Suceava">${esc(f.prevConsults)}</textarea></div>
        <div class="field full"><span class="flabel" id="urgL">Este o urgență? *</span>
          <div class="yn" role="group" aria-labelledby="urgL"><button type="button" data-urg="1" aria-pressed="${f.urgent===true}">Da</button><button type="button" data-urg="0" aria-pressed="${f.urgent===false}">Nu</button></div></div>
        ${f.urgent?`<div class="alert warn full"><b>!</b><span>Pentru o urgență medicală sună imediat la <b>112</b>. Dacă nu e o urgență vitală, trimite cererea și recepția o tratează cu prioritate.</span></div>`:""}
        <div class="hp" aria-hidden="true"><label for="fWeb">Nu completa</label><input id="fWeb" data-f="website" tabindex="-1" autocomplete="off"></div>
        <label class="check full"><input type="checkbox" id="fGdpr" ${f.gdpr?"checked":""}><span>Sunt de acord ca Piuarfil să folosească datele de mai sus, inclusiv cele medicale, doar pentru această programare, conform <a href="#" data-privacy>politicii de confidențialitate</a>. *</span></label>
        <div class="summary full">
          <div><span>Medic</span><b>${d.name}</b></div>
          <div><span>Când</span><b>${fmtLong(st.date)}, ${st.time}</b></div>
        </div>
      </form>
      <div id="formErr" class="alert bad" role="alert" style="margin-top:1rem;${st.showErr&&miss.length?"":"display:none"}">${st.showErr&&miss.length?"<span>Mai completează: <b>"+miss.join(", ")+"</b>.</span>":""}</div>
      ${foot(!st.sending,st.sending?"Se trimite…":"Trimite cererea")}`;
    $("#bform").addEventListener("submit",e=>e.preventDefault());
    p.querySelectorAll("[data-f]").forEach(el=>el.addEventListener("input",e=>{f[e.target.dataset.f]=e.target.value;refreshErr()}));
    $("#fGdpr").onchange=e=>{f.gdpr=e.target.checked;refreshErr()};
  }
}
function missingFields(f){
  const m=[];
  if(f.forChild&&f.childName.trim().length<3)m.push("numele copilului");
  if(f.name.trim().length<3)m.push(f.forChild?"numele părintelui":"numele");
  const pd=f.phone.replace(/\D/g,"").length;if(pd<10||pd>13)m.push("telefonul (10 cifre)");
  if(!/^\S+@\S+\.\S+$/.test(f.email.trim()))m.push("emailul");
  if(f.reason.trim().length<3)m.push("motivul vizitei");
  if(f.urgent===null)m.push("dacă e o urgență (Da/Nu)");
  if(!f.gdpr)m.push("acordul pentru prelucrarea datelor");
  return m;
}
function refreshErr(){
  if(!st.showErr)return;const m=missingFields(st.form),el=$("#formErr");if(!el)return;
  if(m.length){el.style.display="";el.innerHTML="<span>Mai completează: <b>"+m.join(", ")+"</b>.</span>"}else el.style.display="none";
}
async function submitBooking(){
  if(missingFields(st.form).length){st.showErr=true;renderBooking();$("#formErr").scrollIntoView({behavior:RM?"auto":"smooth",block:"center"});return}
  const f=st.form,d=docById(st.doc);st.sending=true;renderBooking();
  try{
    const r=await api("/api/public/appointments",{method:"POST",body:{doctor:st.doc,spec:st.spec,day:st.date,slot:st.time,forChild:!!f.forChild,childName:f.childName,childAge:f.childAge,name:f.name,phone:f.phone,email:f.email.trim(),reason:f.reason,prevResults:f.prevResults,prevConsults:f.prevConsults,urgent:!!f.urgent,consent:f.gdpr,website:f.website}});
    st.done={...r,doctor:d.name,spec:st.spec,day:st.date,time:st.time,email:f.email.trim()};st.sending=false;renderBooking();
  }catch(e){
    st.sending=false;
    if(e.data&&e.data.code==="SLOT_TAKEN"){toast("Ora nu mai e liberă",e.message);st.avail=null;st.time=null;st.step=3;renderBooking();return}
    renderBooking();const el=$("#formErr");el.style.display="";el.innerHTML=`<span>${esc(e.message)}</span>`;
  }
}
$("#pane").addEventListener("click",e=>{
  const t=e.target.closest("button");if(!t)return;
  if(t.dataset.spec){if(st.spec!==t.dataset.spec){st.doc=null;st.date=null;st.time=null}st.spec=t.dataset.spec;renderBooking();return}
  if(t.dataset.doc){if(st.doc!==t.dataset.doc){st.date=null;st.time=null;st.avail=null}st.doc=t.dataset.doc;renderBooking();return}
  if(t.dataset.date){st.date=t.dataset.date;st.time=null;renderBooking();return}
  if(t.dataset.time){st.time=t.dataset.time;renderBooking();return}
  if(t.dataset.urg){st.form.urgent=t.dataset.urg==="1";renderBooking();return}
  if(t.dataset.who){st.form.forChild=t.dataset.who==="1";renderBooking();return}
  const a=t.dataset.act;
  if(a==="back"){st.step=st.step===2?0:st.step-1;renderBooking()}
  if(a==="retry"){st.loadErr=null;renderBooking()}
  if(a==="again"){resetBooking();renderBooking()}
  if(a==="copy"){const i=$("#myLink");i.select();(navigator.clipboard?navigator.clipboard.writeText(i.value):Promise.reject()).then(()=>toast("Copiat","Linkul e în clipboard. Păstrează-l, de exemplu într-un mesaj către tine.")).catch(()=>toast("Copiază manual","Linkul e selectat."))}
  if(a==="next"){
    if(st.step<4){if(st.step===2)st.avail=null;st.step=st.step===0?2:st.step+1;renderBooking();return}
    if(!st.sending)submitBooking();
  }
});
document.addEventListener("click",e=>{const a=e.target.closest("[data-privacy]");if(a){e.preventDefault();showPrivacy(PHONE)}});

/* ---------------- site: hero, echipă, specialități ---------------- */
function initSite(){
/* ---------------- site: hero, echipă, specialități ---------------- */
const FINE=matchMedia("(hover:hover) and (pointer:fine)").matches;
function goBook(spec,doc){
  resetBooking();st.spec=spec;if(doc){st.doc=doc;st.step=3}else st.step=2;renderBooking();
  document.getElementById("programare").scrollIntoView({behavior:RM?"auto":"smooth"});
}
function daysText(d){const L=["duminica","luni","marți","miercuri","joi","vineri","sâmbătă"];const a=d.days.map(x=>L[x]);return a.length>1?a.slice(0,-1).join(", ")+" și "+a[a.length-1]:a[0]}

/* header */
addEventListener("scroll",()=>$("#top").classList.toggle("scrolled",scrollY>10),{passive:true});

/* fețele din hero */
$("#heroFaces").innerHTML=DOCS.slice(0,5).map(d=>`<img src="${d.photo}" alt="">`).join("")+`<b>+${DOCS.length-5}</b>`;

/* carusel 3D cu echipa */
(function(){
  const view=$("#ringView"),ring=$("#ring"),N=DOCS.length,STEP=360/N;
  ring.innerHTML=DOCS.map((d,i)=>`<button class="rcard" data-i="${i}" tabindex="-1" aria-label="${d.name}, ${d.role}"><img src="${d.photo}" alt=""><span class="rc-txt"><b>${d.name}</b><small>${d.specs[0]}</small></span></button>`).join("");
  const cards=[...ring.children];
  let cw=196,R=320,angle=0,target=0,front=-1,paused=false,inView=true,drag=null,last=performance.now(),nextAt=last+3800;
  function size(){const w=view.clientWidth;cw=Math.round(Math.max(150,Math.min(236,w*.38)));R=Math.round(cw*1.62);view.style.setProperty("--cw",cw+"px");cards.forEach((c,i)=>c.style.transform=`rotateY(${i*STEP}deg) translateZ(${R}px)`)}
  size();addEventListener("resize",size);
  function setFront(i){if(i===front)return;front=i;const d=DOCS[i];$("#ringWho b").textContent=d.name;$("#ringWho span").textContent=d.role;cards.forEach((c,k)=>c.setAttribute("aria-current",k===i?"true":"false"))}
  function render(){
    ring.style.transform=`translateZ(${-R}px) rotateY(${-angle}deg)`;
    cards.forEach((c,i)=>{let rel=((i*STEP-angle)%360+540)%360-180;const cos=Math.cos(rel*Math.PI/180);c.style.opacity=(cos<.15?0:Math.min(1,(cos-.15)/.85)**1.3).toFixed(3);c.style.pointerEvents=cos<.5?"none":"";c.style.filter=cos<.9?`saturate(${(.6+.4*cos).toFixed(2)})`:""});
    setFront(((Math.round(angle/STEP)%N)+N)%N);
  }
  function tick(now){
    const dt=Math.min(50,now-last);last=now;
    if(!drag){
      if(!paused&&inView&&!RM&&now>nextAt){target+=STEP;nextAt=now+3800}
      angle+=(target-angle)*(RM?1:1-Math.pow(.0025,dt/1000));
    }
    render();requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
  const go=k=>{target=Math.round(target/STEP)*STEP+k*STEP;nextAt=performance.now()+6000};
  $("#ringPrev").onclick=()=>go(-1);$("#ringNext").onclick=()=>go(1);
  $("#ringBook").onclick=()=>{const d=DOCS[front];goBook(d.specs[0],d.id)};
  view.addEventListener("pointerenter",()=>paused=true);view.addEventListener("pointerleave",()=>{paused=false;nextAt=performance.now()+2500});
  view.addEventListener("keydown",e=>{if(e.key==="ArrowLeft"){go(-1);e.preventDefault()}if(e.key==="ArrowRight"){go(1);e.preventDefault()}if(e.key==="Enter"){$("#ringBook").click()}});
  view.tabIndex=0;
  view.addEventListener("pointerdown",e=>{drag={x:e.clientX,a:angle,v:0,lx:e.clientX,moved:false};view.setPointerCapture(e.pointerId);view.classList.add("dragging")});
  view.addEventListener("pointermove",e=>{if(!drag)return;const dx=e.clientX-drag.x;if(Math.abs(dx)>4)drag.moved=true;drag.v=e.clientX-drag.lx;drag.lx=e.clientX;angle=drag.a-dx*.32;target=angle});
  view.addEventListener("pointerup",e=>{
    if(!drag)return;view.classList.remove("dragging");
    if(!drag.moved){const el=document.elementFromPoint(e.clientX,e.clientY);const c=el&&el.closest(".rcard");if(c){const i=+c.dataset.i;if(i===front){$("#ringBook").click()}else{let rel=((i*STEP-angle)%360+540)%360-180;target=Math.round((angle+rel)/STEP)*STEP}}}
    else target=Math.round((angle-drag.v*2.2)/STEP)*STEP;
    drag=null;nextAt=performance.now()+5000;
  });
  if("IntersectionObserver" in window)new IntersectionObserver(es=>{inView=es[0].isIntersecting}).observe(view);
  document.addEventListener("visibilitychange",()=>{inView=!document.hidden});
})();

/* echipa: filtre + cartonașe 3D */
(function(){
  const team=$("#team"),filters=$("#filters");
  team.innerHTML=DOCS.map((d,i)=>`<article class="dcard" style="--i:${i}" data-specs="${esc(d.specs.join("|"))}" tabindex="0" aria-label="${d.name}, ${d.role}">
    <div class="dc-in">
      <div class="dc-ph"><img src="${d.photo}" alt="Portret ${d.name}"></div>
      <div class="dc-shade"></div><div class="dc-glare"></div>
      <div class="dc-body">
        <span class="dc-spec">${d.role}</span>
        <h3>${d.name}</h3>
        <div class="dc-more"><div><p>Consultă ${daysText(d)}.</p><button class="btn btn-sm" data-book="${d.id}" aria-label="Programează-te la ${d.name}">Programează-te</button></div></div>
      </div>
    </div></article>`).join("");
  const cards=[...team.children];
  const specsWithDocs=SPECS.filter(s=>DOCS.some(d=>d.specs.includes(s)));
  filters.innerHTML=[["","Toți medicii"],...specsWithDocs.map(s=>[s,s])].map(([v,l])=>`<button data-f="${esc(v)}" aria-pressed="${v===""}">${l}</button>`).join("");
  filters.addEventListener("click",e=>{
    const b=e.target.closest("[data-f]");if(!b)return;const f=b.dataset.f;
    filters.querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed",x===b));
    const before=new Map(cards.filter(c=>!c.hidden).map(c=>[c,c.getBoundingClientRect()]));
    cards.forEach(c=>c.hidden=!!f&&!c.dataset.specs.split("|").includes(f));
    if(RM)return;
    cards.filter(c=>!c.hidden).forEach(c=>{const a=before.get(c),r=c.getBoundingClientRect();
      if(a)c.animate([{transform:`translate(${a.left-r.left}px,${a.top-r.top}px)`},{transform:"none"}],{duration:550,easing:"cubic-bezier(.2,.8,.2,1)"});
      else c.animate([{opacity:0,transform:"scale(.92)"},{opacity:1,transform:"none"}],{duration:450,easing:"cubic-bezier(.2,.8,.2,1)"})});
  });
  team.addEventListener("click",e=>{
    const b=e.target.closest("[data-book]");if(b){const d=docById(b.dataset.book);goBook(d.specs[0],d.id);return}
    if(!FINE){const c=e.target.closest(".dcard");if(c)c.classList.toggle("open")}
  });
  if(FINE&&!RM)cards.forEach(c=>{
    const inn=c.querySelector(".dc-in");
    c.addEventListener("pointermove",e=>{const r=inn.getBoundingClientRect(),x=(e.clientX-r.left)/r.width,y=(e.clientY-r.top)/r.height;
      c.classList.add("tilting");inn.style.setProperty("--ry",((x-.5)*16).toFixed(2)+"deg");inn.style.setProperty("--rx",((.5-y)*12).toFixed(2)+"deg");
      inn.style.setProperty("--px",((x-.5)*-14).toFixed(1)+"px");inn.style.setProperty("--py",((y-.5)*-10).toFixed(1)+"px");
      inn.style.setProperty("--gx",(x*100).toFixed(1)+"%");inn.style.setProperty("--gy",(y*100).toFixed(1)+"%")});
    c.addEventListener("pointerleave",()=>{c.classList.remove("tilting");["--ry","--rx","--px","--py"].forEach(p=>inn.style.setProperty(p,"0"))});
  });
  /* dezvăluire în cascadă, o singură dată; dacă echipa e deja în ecran la încărcare, rămâne vizibilă */
  if(!RM&&"IntersectionObserver" in window&&team.getBoundingClientRect().top>innerHeight){
    /* cartonașele rămân vizibile în repaus; animația pornește doar când echipa intră în ecran */
    const io=new IntersectionObserver(es=>{if(!es[0].isIntersecting)return;io.disconnect();
      cards.forEach((c,i)=>c.animate([{opacity:0,transform:"translateY(46px) scale(.96)"},{opacity:1,transform:"none"}],{duration:900,delay:i*75,easing:"cubic-bezier(.2,.8,.2,1)",fill:"backwards"}))},{threshold:.12});
    io.observe(team);
  }
})();

/* specialități: index */
$("#specList").innerHTML=SPECS.map(s=>{const ds=DOCS.filter(d=>d.specs.includes(s));return `<li class="spec-row" data-spec="${esc(s)}">
  <h3>${s}</h3>
  <span class="who"><span class="faces">${ds.map(d=>`<img src="${d.photo}" alt="" title="${d.name}">`).join("")}</span></span>
  <button class="btn btn-gold btn-sm go" data-spec="${esc(s)}" aria-label="Programează-te la ${s}">Programează-te</button></li>`}).join("");
$("#specList").addEventListener("click",e=>{const r=e.target.closest("[data-spec]");if(r)goBook(r.dataset.spec)});

/* biserica se desenează o dată, când ajunge în ecran; în repaus e desenată complet și luminată */
(function(){
  const svg=document.querySelector(".church");if(!svg)return;
  const lit=()=>{svg.classList.remove("drawing");svg.classList.add("lit")};
  if(RM||!("IntersectionObserver" in window)||svg.getBoundingClientRect().top<innerHeight){lit();return}
  svg.classList.add("drawing");
  const io=new IntersectionObserver(es=>{if(!es[0].isIntersecting)return;io.disconnect();
    const ps=[...svg.querySelectorAll(".h-draw")];
    ps.forEach((p,i)=>{const L=p.getTotalLength();p.style.strokeDasharray=L;p.animate([{strokeDashoffset:L},{strokeDashoffset:0}],{duration:1000,delay:i*150,easing:"cubic-bezier(.6,.05,.3,1)",fill:"backwards"})});
    setTimeout(lit,ps.length*150+700);
  },{threshold:.35});io.observe(svg);
})();
}

/* ---------------- pornire ---------------- */
(async function(){
  try{
    const r=await api("/api/public/doctors");
    DOCS=r.doctors;PHONE=r.phone;
    SPECS=[...new Set(DOCS.flatMap(d=>d.specs))];
    document.querySelectorAll(".phone").forEach(e=>e.textContent=PHONE);
    document.querySelectorAll(".phone-link").forEach(e=>e.href=telHref(PHONE));
    initSite();renderBooking();
  }catch(e){
    $("#pane").innerHTML=`<div class="alert bad">Programările online nu sunt disponibile acum. Sună la recepție: <b>${esc(PHONE)}</b>.</div>`;
  }
})();
