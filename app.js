const API_URL = 'https://script.google.com/macros/s/AKfycbzSt9jJZa38K4WqfjuuXOB6Y3krQ7iz59hNsnG5fgXfkQb0a6jEpUFnLYUO3RnXWije/exec';
const state = {token:localStorage.getItem('manager_token')||'', bootstrap:null};

const $ = id => document.getElementById(id);

function api(action, params={}, cacheKey='') {
  const q = new URLSearchParams({action, token:state.token, ...params});
  const url = `${API_URL}?${q.toString()}`;
  return fetch(url, {cache:'no-store'}).then(async r=>{
    const data=await r.json();
    if(data && data.success !== undefined && data.ok === undefined) data.ok=data.success;
    if(cacheKey && data.ok) localStorage.setItem('cache_'+cacheKey, JSON.stringify(data));
    return data;
  });
}
function cached(key){
  try{return JSON.parse(localStorage.getItem('cache_'+key)||'null')}catch(_){return null}
}
function setState(t){$('connectionState').textContent=t}
function showLogin(){ $('loginView').hidden=false; $('mainView').hidden=true; }
function showMain(){ $('loginView').hidden=true; $('mainView').hidden=false; }

async function login(){
  const password=$('password').value;
  $('loginError').textContent='';
  if(API_URL.includes('PASTE_')){$('loginError').textContent='ابتدا API_URL را در app.js تنظیم کنید.';return;}
  try{
    const r=await api('manager_login',{masterCode:password,token:''});
    if(!r.ok) throw new Error(r.error||'ورود ناموفق');
    state.token=r.token; localStorage.setItem('manager_token',r.token);
    await boot();
  }catch(e){$('loginError').textContent='ورود ناموفق: '+e.message}
}
async function boot(){
  setState('در حال اتصال…');
  const cachedBoot=cached('bootstrap');
  if(cachedBoot){state.bootstrap=cachedBoot; showMain(); populateClasses(); setState('نمایش سریع از کش — در حال به‌روزرسانی…');}
  const r=await api('manager_bootstrap',{},'bootstrap');
  if(!r.ok){localStorage.removeItem('manager_token');state.token='';showLogin();setState('نیاز به ورود');return;}
  state.bootstrap=r;
  showMain();
  populateClasses();
  const defaultDate=r.recordedDates?.[0] || '';
  $('monitorDate').value=defaultDate;
  $('absenceDate').value=defaultDate;
  setState('متصل به Google Sheets');
  await refreshDashboard(defaultDate);
}
function populateClasses(){
  $('classSelect').innerHTML=(state.bootstrap.classes||[]).map(c=>`<option value="${esc(c.code)}">${esc(c.title)}</option>`).join('');
}
function tabs(){
  document.querySelectorAll('.tabs button').forEach(b=>b.onclick=()=>{
    document.querySelectorAll('.tabs button').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
    document.querySelectorAll('.tab').forEach(x=>x.hidden=true);
    $(b.dataset.tab+'Tab').hidden=false;
  });
}
async function refreshDashboard(date){
  if(!date){$('todayMonitoring').innerHTML='<div class="notice">برای این تاریخ جلسه‌ای ثبت نشده است.</div>';return;}
  $('todayText').textContent=date;
  const key='monitoring_'+date+'_all';
  const cachedData=cached(key);
  if(cachedData) renderClasses($('todayMonitoring'),cachedData.classes||[]);
  const r=await api('manager_monitoring',{date,filter:'all'},key);
  if(!r.ok){$('todayMonitoring').innerHTML='<div class="notice">خطا در دریافت داده</div>';return;}
  renderStats(r.totals);
  renderClasses($('todayMonitoring'),r.classes);
}
function renderStats(t){
  $('stats').innerHTML=`
    <div class="stat">ثبت شده<b>${t.recorded||0}</b></div>
    <div class="stat">ثبت نشده<b>${t.unrecorded||0}</b></div>
    <div class="stat">نیاز به تطبیق<b>${t.ambiguous||0}</b></div>`;
}
async function monitor(){
  const date=$('monitorDate').value.trim(), filter=$('monitorFilter').value;
  const key='monitoring_'+date+'_'+filter;
  const cachedData=cached(key);
  if(cachedData){$('monitorSummary').textContent=`${cachedData.weekday||''} — دادهٔ ذخیره‌شده`;renderClasses($('monitorGrid'),cachedData.classes||[]);}
  const r=await api('manager_monitoring',{date,filter},key);
  if(!r.ok){$('monitorSummary').textContent='خطا: '+r.error;return;}
  $('monitorSummary').textContent=`${r.weekday} — ${r.classes.length} کلاس`;
  renderClasses($('monitorGrid'),r.classes);
}
function renderClasses(el,classes){
  if(!classes.length){el.innerHTML='<div class="notice">موردی برای نمایش وجود ندارد.</div>';return;}
  el.innerHTML=classes.map(c=>`
    <div class="class-card">
      <h3>${esc(c.classTitle)}</h3>
      <div class="periods">
        ${c.periods.map(p=>`
          <div class="period ${p.status}">
            <button onclick='openSession(${JSON.stringify({
              date:$('monitorDate').value.trim()||$('absenceDate').value.trim(),
              classCode:c.classCode, period:p.period,
              subjectCode:p.subjectCode, teacherCode:p.teacherCode
            })})'>
              <small>${esc(p.period)}</small>
              <strong>${esc(p.subjectTitle)}</strong>
              <span>${labelStatus(p.status)}</span>
            </button>
          </div>`).join('')}
      </div>
    </div>`).join('');
}
function labelStatus(s){
  return s==='recorded'?'🟢 ثبت شده':s==='unrecorded'?'🔴 ثبت نشده':'🟡 نیاز به تطبیق';
}
async function openSession(x){
  const r=await api('manager_session',x);
  if(!r.ok){openModal(`<h2>خطا</h2><p>${esc(r.error)}</p>`);return;}
  const s=r.session;
  const rows=s.rows||[];
  const counts={};
  rows.forEach(x=>counts[x.status]=(counts[x.status]||0)+1);
  openModal(`
    <button class="print-btn" onclick="window.print()">چاپ / ذخیره PDF</button>
    <h2>${esc(s.classTitle)} — ${esc(s.period)}</h2>
    <p>${esc(s.subjectTitle)} | ${esc(s.date)} | ${esc(s.teacherName)}</p>
    ${s.ambiguous?'<div class="notice">این جلسه ثبت شده ولی چون زنگ در منبع حضورغیاب مشخص نشده و درس در چند زنگ تکرار شده، تطبیق دقیق زنگ نیاز به اصلاح منبع دارد.</div>':''}
    <div class="stats">
      <div class="stat">حاضر<b>${counts['حاضر']||0}</b></div>
      <div class="stat">غایب<b>${counts['غایب']||0}</b></div>
      <div class="stat">تأخیر<b>${counts['تأخیر']||0}</b></div>
    </div>
    <div class="table-wrap"><table class="table">
      <thead><tr><th>دانش‌آموز</th><th>وضعیت</th><th>تأخیر</th></tr></thead>
      <tbody>${rows.map(x=>`<tr><td>${esc(x.studentName)}</td><td class="${statusClass(x.status)}">${esc(x.status)}</td><td>${esc(x.delay)}</td></tr>`).join('')}</tbody>
    </table></div>`);
}
async function loadAbsences(){
  const date=$('absenceDate').value.trim(), classCode=$('classSelect').value, period=$('periodSelect').value;
  const r=await api('manager_absences',{date,classCode,period});
  if(!r.ok){$('absenceResult').innerHTML='<div class="notice">خطا: '+esc(r.error)+'</div>';return;}
  $('periodSelect').innerHTML='<option value="">همه زنگ‌ها</option>'+r.periods.map(p=>`<option value="${esc(p.period)}">${esc(p.period)} — ${esc(p.subjectTitle)}</option>`).join('');
  if(period) $('periodSelect').value=period;
  $('absenceResult').innerHTML=r.periods.map(p=>`
    <div class="panel">
      <div class="panel-head"><h2>${esc(p.period)} — ${esc(p.subjectTitle)}</h2><span>${p.recorded?'🟢 ثبت شده':'🔴 ثبت نشده'}</span></div>
      <div class="stats">
        <div class="stat">حاضر<b>${p.counts['حاضر']||0}</b></div>
        <div class="stat">غایب<b>${p.counts['غایب']||0}</b></div>
        <div class="stat">ثبت نشده<b>${p.counts['ثبت نشده']||0}</b></div>
      </div>
      <div class="table-wrap"><table class="table">
      <thead><tr><th>دانش‌آموز</th><th>وضعیت</th><th>تأخیر</th></tr></thead>
      <tbody>${p.students.map(s=>`<tr><td>${esc(s.studentName)}</td><td class="${statusClass(s.status)}">${esc(s.status)}</td><td>${esc(s.delay)}</td></tr>`).join('')}</tbody>
      </table></div>
    </div>`).join('');
}
function statusClass(s){return s==='حاضر'?'status-present':s==='غایب'?'status-absent':s==='تأخیر'?'status-late':'status-unset'}
function openModal(html){$('modalContent').innerHTML=html;$('modal').hidden=false}
function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}

$('loginBtn').onclick=login;
$('refreshBtn').onclick=()=>boot();
$('monitorBtn').onclick=monitor;
$('absenceBtn').onclick=loadAbsences;
$('closeModal').onclick=()=>$('modal').hidden=true;
$('classSelect').onchange=()=>{ $('periodSelect').innerHTML='<option value="">همه زنگ‌ها</option>'; };
tabs();

if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(()=>{});
if(state.token && !API_URL.includes('PASTE_')) boot().catch(showLogin); else showLogin();

// Background refresh keeps the manager view fresh without reloading the page.
setInterval(()=>{ if(state.token && !document.hidden) boot().catch(()=>{}); }, 60000);
