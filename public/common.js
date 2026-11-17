/* Piuarfil: utilitare comune pentru site, linkul personal și recepție */
const $=s=>document.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const RM=matchMedia("(prefers-reduced-motion: reduce)").matches;
const DOW=["Dum","Lun","Mar","Mie","Joi","Vin","Sâm"];
const fmtLong=s=>new Date(s+"T12:00:00Z").toLocaleDateString("ro-RO",{weekday:"long",day:"numeric",month:"long",timeZone:"UTC"});
const fmtShort=s=>new Date(s+"T12:00:00Z").toLocaleDateString("ro-RO",{day:"numeric",month:"short",timeZone:"UTC"});
const dayNum=s=>Number(s.slice(8,10));
const dayMon=s=>new Date(s+"T12:00:00Z").toLocaleDateString("ro-RO",{month:"short",timeZone:"UTC"});
const dayDow=s=>DOW[new Date(s+"T12:00:00Z").getUTCDay()];
const plural=(n,one,many)=>n+" "+(n===1?one:many);
function addDaysStr(day,n){const d=new Date(day+"T00:00:00Z");d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)}
const telHref=p=>"tel:+4"+String(p).replace(/\D/g,"").replace(/^4?0?/,"0");
const fmtPhone=p=>{const d=String(p).replace(/\D/g,"");return d.length===10?d.replace(/(\d{4})(\d{3})(\d{3})/,"$1 $2 $3"):d};

async function api(path,{method="GET",body}={}){
  let r;
  try{r=await fetch(path,{method,headers:body?{"content-type":"application/json","x-pf":"1"}:{"x-pf":"1"},body:body?JSON.stringify(body):undefined,credentials:"same-origin"})}
  catch(e){throw Object.assign(new Error("Nu ne putem conecta. Verifică internetul și încearcă din nou."),{status:0})}
  const data=await r.json().catch(()=>({}));
  if(!r.ok)throw Object.assign(new Error(data.error||"A apărut o eroare. Încearcă din nou."),{status:r.status,data});
  return data;
}
function toast(title,msg){const el=document.createElement("div");el.className="toast";el.innerHTML=`<small>${esc(title)}</small>${esc(msg)}`;$("#toasts").appendChild(el);setTimeout(()=>el.remove(),5200)}
function statusPill(s){return {pending:'<span class="pill pending">În așteptare</span>',confirmed:'<span class="pill confirmed">Confirmată</span>',rejected:'<span class="pill rejected">Respinsă</span>',cancelled:'<span class="pill cancelled">Anulată</span>'}[s]||""}

let _lastFocus=null;
function openModal(html,after){_lastFocus=document.activeElement;$("#modalCard").innerHTML=html;$("#modal").classList.add("open");after&&after();const f=$("#modalCard").querySelector("input,select,textarea,button");f&&f.focus()}
function closeModal(){$("#modal").classList.remove("open");_lastFocus&&_lastFocus.focus&&_lastFocus.focus()}
document.addEventListener("click",e=>{if(e.target.id==="modal"||e.target.closest("[data-close]"))closeModal()});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&$("#modal")?.classList.contains("open"))closeModal()});

function showPrivacy(phone){openModal(`<h3>Politica de confidențialitate</h3>
  <p class="alert warn" style="margin:0">Draft. Se validează cu clinica și cu un jurist înainte de lansare.</p>
  <div style="display:grid;gap:.7rem;font-size:.93rem">
  <p><b>Cine prelucrează datele.</b> Piuarfil Clinică Medicală, Dumbrăveni, jud. Suceava (date de identificare de completat).</p>
  <p><b>Ce date colectăm.</b> Nume, telefon, email (opțional), numele copilului dacă programarea e pentru el, motivul vizitei, informații despre analize și consulturi anterioare, dacă e o urgență.</p>
  <p><b>De ce.</b> Doar pentru a programa consultația și a o pregăti. Datele despre sănătate le prelucrăm pe baza acordului tău explicit (art. 9 alin. 2 lit. a din GDPR).</p>
  <p><b>Cine le vede.</b> Recepția și medicul la care te programezi. Datele sunt găzduite în Uniunea Europeană. Nu le vindem și nu le folosim pentru reclame.</p>
  <p><b>Cât le păstrăm.</b> Perioadă de stabilit cu clinica, după care se șterg.</p>
  <p><b>Drepturile tale.</b> Poți cere acces, corectare sau ștergere și poți retrage acordul oricând, la recepție: ${esc(phone||"")}. Poți face plângere la ANSPDCP (dataprotection.ro).</p></div>
  <div style="display:flex;justify-content:flex-end"><button class="btn btn-dark" data-close>Am înțeles</button></div>`)}
