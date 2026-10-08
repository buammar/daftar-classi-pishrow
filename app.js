const API_URL = 'https://script.google.com/macros/s/AKfycbzSt9jJZa38K4WqfjuuXOB6Y3krQ7iz59hNsnG5fgXfkQb0a6jEpUFnLYUO3RnXWije/exec';
const state = {token:localStorage.getItem('manager_token')||'', bootstrap:null};

const $ = id => document.getElementById(id);

// ============ توابع کمکی تاریخ شمسی ============
function toJalali(gy, gm, gd) {
  const g_d_m = [0,31,59,90,120,151,181,212,243,273,304,334];
  let jy = (gy <= 1600) ? 0 : 979;
  gy -= (gy <= 1600) ? 621 : 1600;
  const gy2 = (gm > 2) ? (gy + 1) : gy;
  let days = (365 * gy) + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400) - 80 + gd + g_d_m[gm - 1];
  jy += 33 * Math.floor(days / 12053);
  days %= 12053;
  jy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) { jy += Math.floor((days - 1) / 365); days = (days - 1) % 365; }
  const jm = (days < 186) ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
  const jd = 1 + ((days < 186) ? (days % 31) : ((days - 186) % 30));
  return [jy, jm, jd];
}

function getTodayJalali() {
  const now = new Date();
  const [jy, jm, jd] = toJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());
  return `${jy}/${String(jm).padStart(2,'0')}/${String(jd).padStart(2,'0')}`;
}

const WEEKDAYS = ['یکشنبه','دوشنبه','سه‌شنبه','چهارشنبه','پنجشنبه','جمعه','شنبه'];

function getWeekdayFromJalali(jalaliStr) {
  // تبدیل تاریخ شمسی به میلادی برای محاسبه روز هفته
  const parts = jalaliStr.replace(/-/g,'/').split('/').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return '';
  const [jy, jm, jd] = parts;
  // تبدیل شمسی به میلادی
  let gy = (jy <= 979) ? 621 : 1600;
  const gm = jm;
  gy += (jy <= 979) ? jy : (jy - 979);
  let days = 0;
  // محاسبه دقیق‌تر
  const g_d_m = [0,31,59,90,120,151,181,212,243,273,304,334];
  const jy2 = jy - 979;
  const jm2 = jm;
  const jd2 = jd;
  let gy2 = 1600 + jy2;
  const gm2 = 3;
  const gd2 = 21;
  // روش ساده‌تر: استفاده از Date با تبدیل معکوس
  // الگوریتم jalaali-js
  function jalCal(jy) {
    const breaks = [-61,9,38,199,426,686,756,818,1111,1181,1210,1635,2060,2097,2192,2262,2324,2394,2456,3178];
    let bl = breaks.length, gy = jy + 621, leapJ = -14, jp = breaks[0];
    if (jy < jp || jy >= breaks[bl-1]) throw new Error('Invalid Jalaali year');
    for (let i = 1; i < bl; i += 1) {
      const jm = breaks[i]; const jump = jm - jp;
      if (jy < jm) break;
      leapJ = leapJ + div(jump, 33) * 8 + div(mod(jump, 33), 4);
      jp = jm;
    }
    let n = jy - jp;
    leapJ = leapJ + div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
    if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;
    const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
    const march = 20 + leapJ - leapG;
    return {gy, march};
  }
  function div(a,b){return ~~(a/b)}
  function mod(a,b){return a - ~~(a/b)*b}
  function j2d(jy,jm,jd){
    const r = jalCal(jy);
    return g2d(r.gy, 3, r.march) + (jm-1)*31 - div(jm,7)*(jm-7) + jd - 1;
  }
  function g2d(gy,gm,gd){
    let d = div((gy + div(gm - 8, 6) + 100100) * 1461, 4) + div(153 * mod(gm + 9, 12) + 2, 5) + gd - 34840408;
    d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
    return d;
  }
  function d2g(jdn){
    let j = 4 * jdn + 139361631;
    j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
    const i = div(mod(j, 1461), 4) * 5 + 308;
    const gd = div(mod(i, 153), 5) + 1;
    const gm = mod(div(i, 153), 12) + 1;
    const gy = div(j, 1461) - 100100 + div(8 - gm, 6);
    return {gy, gm, gd};
  }
  const jdn = j2d(jy, jm, jd);
  const g = d2g(jdn);
  const date = new Date(g.gy, g.gm - 1, g.gd);
  // در تقویم ایرانی، شنبه اول هفته است
  const jsDay = date.getDay(); // 0=Sunday, 6=Saturday
  const persianDayIndex = (jsDay + 1) % 7; // 0=Saturday, 1=Sunday, ... 6=Friday
  const names = ['شنبه','یکشنبه','دوشنبه','سه‌شنبه','چهارشنبه','پنجشنبه','جمعه'];
  return names[persianDayIndex];
}

function updateWeekdayLabels() {
  const md = $('monitorDate').value.trim();
  const ad = $('absenceDate').value.trim();
  if ($('monitorWeekday')) $('monitorWeekday').textContent = md ? getWeekdayFromJalali(md) : '';
  if ($('absenceWeekday')) $('absenceWeekday').textContent = ad ? getWeekdayFromJalali(ad) : '';
}

// ============ API ============
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
  
  // ✅ اصلاح: استفاده از تاریخ امروز به‌جای اولین تاریخ ثبت‌شده
  const todayJalali = getTodayJalali();
  $('monitorDate').value = todayJalali;
  $('absenceDate').value = todayJalali;
  updateWeekdayLabels();
  
  setState('متصل به Google Sheets');
  await refreshDashboard(todayJalali);
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
  const weekday = getWeekdayFromJalali(date);
  $('todayText').textContent = weekday ? `${weekday} — ${date}` : date;
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
  const weekday = getWeekdayFromJalali(date);
  const key='monitoring_'+date+'_'+filter;
  const cachedData=cached(key);
  if(cachedData){
    $('monitorSummary').textContent=`${weekday||''} ${date} — دادهٔ ذخیره‌شده`;
    renderClasses($('monitorGrid'),cachedData.classes||[]);
  }
  const r=await api('manager_monitoring',{date,filter},key);
  if(!r.ok){$('monitorSummary').textContent='خطا: '+r.error;return;}
  const wd = r.weekday || weekday;
  $('monitorSummary').textContent=`${wd} ${date} — ${r.classes.length} کلاس`;
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
  
  // ✅ اصلاح: عدم نمایش نام دانش‌آموزان — ستون دانش‌آموز حذف شد
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
      <thead><tr><th>#</th><th>وضعیت</th><th>تأخیر</th></tr></thead>
      <tbody>${rows.map((x,i)=>`<tr><td>${i+1}</td><td class="${statusClass(x.status)}">${esc(x.status)}</td><td>${esc(x.delay)}</td></tr>`).join('')}</tbody>
    </table></div>`);
}

async function loadAbsences(){
  const date=$('absenceDate').value.trim(), classCode=$('classSelect').value, period=$('periodSelect').value;
  const r=await api('manager_absences',{date,classCode,period});
  if(!r.ok){$('absenceResult').innerHTML='<div class="notice">خطا: '+esc(r.error)+'</div>';return;}
  $('periodSelect').innerHTML='<option value="">همه زنگ‌ها</option>'+r.periods.map(p=>`<option value="${esc(p.period)}">${esc(p.period)} — ${esc(p.subjectTitle)}</option>`).join('');
  if(period) $('periodSelect').value=period;
  
  // ✅ اصلاح: عدم نمایش نام دانش‌آموزان — ستون دانش‌آموز حذف شد
  const weekday = getWeekdayFromJalali(date);
  $('absenceResult').innerHTML = `<div class="notice">${weekday} ${date}</div>` + r.periods.map(p=>`
    <div class="panel">
      <div class="panel-head"><h2>${esc(p.period)} — ${esc(p.subjectTitle)}</h2><span>${p.recorded?'🟢 ثبت شده':'🔴 ثبت نشده'}</span></div>
      <div class="stats">
        <div class="stat">حاضر<b>${p.counts['حاضر']||0}</b></div>
        <div class="stat">غایب<b>${p.counts['غایب']||0}</b></div>
        <div class="stat">ثبت نشده<b>${p.counts['ثبت نشده']||0}</b></div>
      </div>
      <div class="table-wrap"><table class="table">
      <thead><tr><th>#</th><th>وضعیت</th><th>تأخیر</th></tr></thead>
      <tbody>${p.students.map((s,i)=>`<tr><td>${i+1}</td><td class="${statusClass(s.status)}">${esc(s.status)}</td><td>${esc(s.delay)}</td></tr>`).join('')}</tbody>
      </table></div>
    </div>`).join('');
}

function statusClass(s){return s==='حاضر'?'status-present':s==='غایب'?'status-absent':s==='تأخیر'?'status-late':'status-unset'}
function openModal(html){$('modalContent').innerHTML=html;$('modal').hidden=false}
function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}

// ============ Event Listeners ============
$('loginBtn').onclick=login;
$('refreshBtn').onclick=()=>boot();
$('monitorBtn').onclick=monitor;
$('absenceBtn').onclick=loadAbsences;
$('closeModal').onclick=()=>$('modal').hidden=true;
$('classSelect').onchange=()=>{ $('periodSelect').innerHTML='<option value="">همه زنگ‌ها</option>'; };

// ✅ به‌روزرسانی خودکار روز هفته هنگام تغییر تاریخ
$('monitorDate').addEventListener('input', updateWeekdayLabels);
$('absenceDate').addEventListener('input', updateWeekdayLabels);

tabs();

if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(()=>{});
if(state.token && !API_URL.includes('PASTE_')) boot().catch(showLogin); else showLogin();

setInterval(()=>{ if(state.token && !document.hidden) boot().catch(()=>{}); }, 60000);
