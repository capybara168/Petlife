/* =====================================================================
 * PetLife+ 智慧寵物生活管理系統 — 網頁示意版
 * ---------------------------------------------------------------------
 * 模組一：寵物健康與美容照護管理（醫療紀錄、美容照護紀錄、線上預約、通知提醒）
 * 模組二：智慧地圖整合服務（地圖查詢、分類篩選、導航與路線規劃）
 *         ・Google Maps JavaScript API + Places API (New) + Directions
 *         ・未設定金鑰時自動改用 OpenStreetMap / Overpass / OSRM
 * 模組三：家庭共同管理（家庭群組綁定、資訊即時同步）
 * 資料層：localStorage（對應 Firebase Database 結構），跨分頁即時同步
 * 通知：瀏覽器 Notification API（模擬 Firebase Cloud Messaging）
 * ===================================================================== */

const CFG = window.PETLIFE_CONFIG || {};
const $ = (s, el = document) => el.querySelector(s);
const uid = () => Math.random().toString(36).slice(2, 10);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = (n) => String(n).padStart(2, '0');
const store = {
  get(k, s = localStorage) { try { return s.getItem(k); } catch (e) { return null; } },
  set(k, v, s = localStorage) { try { v == null ? s.removeItem(k) : s.setItem(k, v); } catch (e) { /* ignore */ } },
};

/* ---------- 日期工具 ---------- */
const toDate = (s) => (s ? new Date(s.length === 10 ? s + 'T00:00' : s) : null);
const localISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const localDate = (d) => localISO(d).slice(0, 10);
function dOff(days, time = '10:00') { const d = new Date(); d.setDate(d.getDate() + days); return `${localDate(d)}T${time}`; }
const fmtDate = (s) => { const d = toDate(s); return d ? `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}` : '—'; };
const fmtTime = (s) => { const d = toDate(s); return d ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : ''; };
const fmtDT = (s) => (s ? `${fmtDate(s)} ${fmtTime(s)}` : '—');
const WEEK = ['日', '一', '二', '三', '四', '五', '六'];
function dayDiff(s) { const d = toDate(s); const t = new Date(); t.setHours(0, 0, 0, 0); const x = new Date(d); x.setHours(0, 0, 0, 0); return Math.round((x - t) / 864e5); }
function rel(s) {
  if (!s) return ''; const n = dayDiff(s);
  if (n === 0) return '今天'; if (n === 1) return '明天'; if (n === 2) return '後天'; if (n === -1) return '昨天';
  return n > 0 ? `${n} 天後` : `${-n} 天前`;
}
function relWhen(s) {
  const n = dayDiff(s); const d = toDate(s);
  if (n >= 0 && n <= 2) return `${rel(s)} ${fmtTime(s)}`;
  if (n > 2 && n < 7) return `週${WEEK[d.getDay()]} ${fmtTime(s)}`;
  if (n >= 7 && n < 14) return `下週${WEEK[d.getDay()]} ${fmtTime(s)}`;
  return `${d.getMonth() + 1}/${d.getDate()} ${fmtTime(s)}`;
}
function ago(ts) {
  const m = Math.round((Date.now() - ts) / 6e4);
  if (m < 1) return '剛剛'; if (m < 60) return `${m} 分鐘前`;
  const h = Math.round(m / 60); if (h < 24) return `${h} 小時前`;
  return `${Math.round(h / 24)} 天前`;
}
function age(birthday) {
  const b = toDate(birthday); if (!b) return '';
  const n = new Date(); let months = (n.getFullYear() - b.getFullYear()) * 12 + n.getMonth() - b.getMonth();
  if (n.getDate() < b.getDate()) months--;
  return months >= 12 ? `${Math.floor(months / 12)} 歲 ${months % 12} 個月` : `${Math.max(months, 0)} 個月`;
}
const money = (n) => (n ? `$${Number(n).toLocaleString()}` : '—');
const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

/* ---------- 常數 ---------- */
const SPECIES = { 狗: '🐕', 貓: '🐈', 兔: '🐇', 鳥: '🦜', 鼠: '🐹', 其他: '🐾' };
const PET_COLORS = ['#ffe0b2', '#c8e6c9', '#e1bee7', '#ffcdd2', '#bbdefb', '#fff9c4'];
const MED_TYPES = ['看診', '疫苗', '驅蟲', '健康檢查', '回診追蹤', '手術', '牙科', '用藥', '其他'];
const GROOM_TYPES = ['洗澡', '美容剪毛', '修毛', '剪指甲', '清耳朵', '刷牙', '擠肛門腺', 'SPA', '其他'];
const REPEAT = { none: '不重複', daily: '每天', weekly: '每週', monthly: '每月', yearly: '每年' };
const APPT_STATUS = { pending: ['待確認', 'orange'], confirmed: ['已確認', 'green'], done: ['已完成', ''], cancelled: ['已取消', 'red'] };
const MEMBER_EMOJI = ['👩', '👨', '👦', '👧', '👵', '👴', '🧑'];
const MEMBER_COLORS = ['#ffe0b2', '#c8e6c9', '#e1bee7', '#bbdefb', '#ffcdd2', '#fff9c4'];
const KIND_COLOR = { med: '#e53935', groom: '#fb8c00', appt: '#1e88e5', rem: '#43a047' };

const NAV = [
  ['主要功能'],
  ['home', '🏠', '首頁'],
  ['map', '📍', '智慧地圖'],
  ['notifications', '🔔', '通知提醒'],
  ['照護管理'],
  ['pets', '🐶', '寵物檔案'],
  ['medical', '🩺', '醫療紀錄'],
  ['grooming', '✂️', '美容照護'],
  ['appointments', '📅', '診所預約'],
  ['家庭與帳號'],
  ['family', '👨‍👩‍👧', '家庭共同管理'],
  ['me', '👤', '我的'],
  ['settings', '⚙️', '設定'],
];
const TAB_NAV = [['home', '🏠', '首頁'], ['map', '📍', '地圖'], ['notifications', '🔔', '通知'], ['me', '👤', '我的']];
const TITLES = { home: 'PetLife+', map: '智慧地圖', notifications: '通知提醒', pets: '寵物檔案', pet: '寵物檔案', medical: '醫療紀錄', grooming: '美容照護', appointments: '診所預約', family: '家庭共同管理', me: '我的', settings: '設定' };

/* =====================================================================
 * 資料層（對應 ER Model：User / Pet / Family_Member / Medical_Record /
 *        Grooming_Record / Appointment / Location）
 * ===================================================================== */
const KEY = 'petlife.v2';
const SESSION = 'petlife.session';

function seed() {
  const members = [
    { id: 'm1', name: '媽媽', email: 'mom@petlife.demo', password: '1234', phone: '0912-345-678', role: '管理員', emoji: '👩', color: MEMBER_COLORS[0] },
    { id: 'm2', name: '爸爸', email: 'dad@petlife.demo', password: '1234', phone: '0922-111-222', role: '成員', emoji: '👨', color: MEMBER_COLORS[1] },
    { id: 'm3', name: '小雯', email: 'wen@petlife.demo', password: '1234', phone: '0933-555-666', role: '成員', emoji: '👧', color: MEMBER_COLORS[2] },
  ];
  const now = Date.now();
  const L = (name, type, addr, lat, lng, phone) => ({ placeKey: 'demo:' + name, place: name, placeType: type, addr, lat, lng, phone });
  const vet = L('快樂動物醫院', 'vet', '桃園市龜山區文化一路（示意）', 25.0352, 121.3871, '03-327-0000');
  const salon = L('汪星人美容沙龍', 'grooming', '桃園市龜山區復興一路（示意）', 25.0301, 121.3920, '03-328-0000');
  const cat = L('喵喵貓專科醫院', 'vet', '桃園市林口區文化三路（示意）', 25.0705, 121.3655, '03-397-0000');
  return {
    version: 2,
    family: { id: 'f1', name: '溫馨小家庭', code: genCode(), members },
    pets: [
      { id: 'p1', name: '豆豆', species: '狗', breed: '柴犬', gender: '公', birthday: '2021-03-15', weight: 10.5, chip: '900123456789012', neutered: '是', color: PET_COLORS[0], notes: '對雞肉過敏；散步容易暴衝。' },
      { id: 'p2', name: '咪咪', species: '貓', breed: '米克斯', gender: '母', birthday: '2022-07-01', weight: 4.2, chip: '900987654321098', neutered: '是', color: PET_COLORS[1], notes: '怕吹風機，美容前需先安撫。' },
    ],
    medical: [
      { id: uid(), petId: 'p1', date: dOff(-210).slice(0, 10), type: '疫苗', clinic: vet.place, title: '狂犬病疫苗', detail: '年度施打，無不良反應', medication: '', cost: 400, weight: 9.8, nextDate: dOff(1).slice(0, 10), by: 'm1' },
      { id: uid(), petId: 'p1', date: dOff(-32).slice(0, 10), type: '看診', clinic: vet.place, title: '皮膚炎', detail: '背部紅疹，需保持乾燥', medication: '外用藥膏、口服抗生素 7 天', cost: 1250, weight: 10.3, nextDate: '', by: 'm2' },
      { id: uid(), petId: 'p1', date: dOff(-3).slice(0, 10), type: '回診追蹤', clinic: vet.place, title: '皮膚炎回診', detail: '已改善，停藥觀察', medication: '', cost: 500, weight: 10.5, nextDate: '', by: 'm1' },
      { id: uid(), petId: 'p2', date: dOff(-60).slice(0, 10), type: '健康檢查', clinic: cat.place, title: '年度健檢', detail: '血檢正常，牙結石輕微', medication: '', cost: 2800, weight: 4.0, nextDate: '', by: 'm1' },
      { id: uid(), petId: 'p2', date: dOff(-25).slice(0, 10), type: '驅蟲', clinic: cat.place, title: '體內外驅蟲', detail: '滴劑', medication: '蚤不到滴劑', cost: 650, weight: 4.2, nextDate: dOff(5).slice(0, 10), by: 'm3' },
    ],
    grooming: [
      { id: uid(), petId: 'p1', date: dOff(-14).slice(0, 10), type: '洗澡', shop: salon.place, detail: '洗澡＋修腳底毛', cost: 800, nextDate: dOff(14).slice(0, 10), by: 'm2' },
      { id: uid(), petId: 'p2', date: dOff(-7).slice(0, 10), type: '剪指甲', shop: '在家', detail: '由小雯協助', cost: 0, nextDate: '', by: 'm3' },
      { id: uid(), petId: 'p1', date: dOff(-45).slice(0, 10), type: '美容剪毛', shop: salon.place, detail: '夏季修剪', cost: 1500, nextDate: '', by: 'm1' },
    ],
    appointments: [
      { id: uid(), petId: 'p1', datetime: dOff(1, '10:00'), service: '狂犬病疫苗施打', ...vet, status: 'confirmed', notes: '記得帶疫苗手冊', by: 'm1', online: true },
      { id: uid(), petId: 'p1', datetime: dOff(((9 - new Date().getDay()) % 7) + 7, '14:00'), service: '寵物洗澡與修毛', ...salon, status: 'confirmed', notes: '', by: 'm2', online: true },
      { id: uid(), petId: 'p2', datetime: dOff(10, '10:30'), service: '牙科檢查', ...cat, status: 'pending', notes: '', by: 'm3', online: false },
      { id: uid(), petId: 'p1', datetime: dOff(-3, '16:00'), service: '皮膚炎回診', ...vet, status: 'done', notes: '', by: 'm1', online: true },
    ],
    reminders: [
      { id: uid(), petId: 'p1', title: '餵心絲蟲預防藥', kind: 'med', due: dOff(2, '20:00'), repeat: 'monthly', done: false, notified: false, note: '' },
      { id: uid(), petId: 'p2', title: '清貓砂', kind: 'rem', due: dOff(0, '21:00'), repeat: 'daily', done: false, notified: false, note: '' },
      { id: uid(), petId: 'p1', title: '飯後餵益生菌', kind: 'med', due: localISO(new Date(now - 36e5)), repeat: 'none', done: false, notified: true, note: '' },
    ],
    notifications: [
      { id: uid(), ts: now - 36e5, title: '⏰ 豆豆：飯後餵益生菌', body: '提醒時間已到', read: false },
      { id: uid(), ts: now - 36e5 * 20, title: '📅 預約成功', body: '汪星人美容沙龍已確認豆豆的洗澡與修毛預約', read: true },
    ],
    favorites: [],
    activity: [
      { id: uid(), ts: now - 36e5 * 3, userId: 'm3', text: '新增了 咪咪 的美容紀錄「剪指甲」' },
      { id: uid(), ts: now - 36e5 * 20, userId: 'm2', text: '線上預約了 汪星人美容沙龍（豆豆）' },
      { id: uid(), ts: now - 36e5 * 26, userId: 'm1', text: '新增了 豆豆 的醫療紀錄「皮膚炎回診」' },
    ],
    updatedAt: now, updatedBy: 'm1',
  };
}
function genCode() { return Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join(''); }
function load() {
  try { const d = JSON.parse(store.get(KEY)); if (d && d.version === 2) return d; } catch (e) { /* ignore */ }
  const s = seed(); store.set(KEY, JSON.stringify(s)); return s;
}
let db = load();

function meId() {
  const id = store.get(SESSION, sessionStorage) || store.get(SESSION);
  return db.family.members.some((m) => m.id === id) ? id : null;
}
const me = () => member(meId());
const member = (id) => db.family.members.find((m) => m.id === id) || { name: '已離開的成員', emoji: '👤', color: '#ddd', role: '' };
const pet = (id) => db.pets.find((p) => p.id === id) || { name: '（已刪除）', species: '其他', color: '#eee' };
const petEmoji = (p) => SPECIES[p.species] || '🐾';
const isAdmin = () => me().role === '管理員';

function save(activityText, rerender = true) {
  if (activityText) db.activity.unshift({ id: uid(), ts: Date.now(), userId: meId(), text: activityText });
  db.activity = db.activity.slice(0, 300);
  db.notifications = (db.notifications || []).slice(0, 100);
  db.updatedAt = Date.now(); db.updatedBy = meId();
  try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { toast('儲存失敗：' + e.message); }
  if (rerender) render();
}

/* 跨分頁即時同步（模擬 Firebase Realtime Database：家人在其他裝置更新資料） */
window.addEventListener('storage', (e) => {
  if (e.key !== KEY || !e.newValue) return;
  try {
    db = JSON.parse(e.newValue);
    const latest = db.activity[0];
    if (latest && db.updatedBy !== meId() && Date.now() - latest.ts < 5000) toast(`🔄 ${member(latest.userId).name}${latest.text}`);
    if (!meId()) { render(); return; }
    if (currentRoute() === 'map' && MP) { renderChrome(); renderMapAll(); } else render();
  } catch (err) { /* ignore */ }
});

/* =====================================================================
 * UI 工具
 * ===================================================================== */
function toast(msg, cls = '') {
  const t = document.createElement('div');
  t.className = 'toast ' + cls; t.textContent = msg;
  $('#toasts').appendChild(t);
  setTimeout(() => t.remove(), 4800);
}
const avatarHtml = (p, cls = '') => `<div class="avatar ${cls}" style="background:${p.color}">${petEmoji(p)}</div>`;
const memberAvatar = (m, cls = '') => `<div class="avatar ${cls}" style="background:${m.color}">${m.emoji}</div>`;
const petOptions = () => db.pets.map((p) => [p.id, `${petEmoji(p)} ${p.name}`]);
const starStr = (r) => (r == null ? '' : `★ ${Number(r).toFixed(1)}`);

/* ---------- 通用表單 Dialog ---------- */
let formHandlers = null;
function fieldHtml(f, v) {
  const val = v ?? f.value ?? '';
  const req = f.required ? 'required' : '';
  let input;
  if (f.type === 'select') {
    input = `<select name="${f.name}" ${req}>${(f.options || []).map((o) => {
      const [ov, ol] = Array.isArray(o) ? o : [o, o];
      return `<option value="${esc(ov)}" ${String(ov) === String(val) ? 'selected' : ''}>${esc(ol)}</option>`;
    }).join('')}</select>`;
  } else if (f.type === 'textarea') {
    input = `<textarea name="${f.name}" placeholder="${esc(f.placeholder || '')}" ${req}>${esc(val)}</textarea>`;
  } else {
    input = `<input name="${f.name}" type="${f.type || 'text'}" value="${esc(val)}" placeholder="${esc(f.placeholder || '')}" ${f.step ? `step="${f.step}"` : ''} ${req}>`;
  }
  return `<div class="f ${f.half ? 'half' : ''}"><label>${esc(f.label)}${f.required ? ' *' : ''}</label>${input}${f.hint ? `<div class="hint">${esc(f.hint)}</div>` : ''}</div>`;
}
function openForm({ title, fields, data = {}, submitText = '儲存', onSubmit, onDelete }) {
  const dlg = $('#dlg');
  dlg.innerHTML = `<form class="form" id="dlg-form">
    <header><h3>${esc(title)}</h3><button type="button" class="icon-btn" data-close>✕</button></header>
    <div class="form-body">${fields.map((f) => fieldHtml(f, data[f.name])).join('')}</div>
    <footer>${onDelete ? '<button type="button" class="btn ghost danger" data-del>🗑 刪除</button>' : ''}<span class="spacer"></span>
      <button type="button" class="btn ghost" data-close>取消</button><button class="btn primary" type="submit">${esc(submitText)}</button></footer>
  </form>`;
  formHandlers = { fields, onSubmit, onDelete };
  if (!dlg.open) dlg.showModal();
}
document.addEventListener('submit', (e) => {
  if (e.target.id === 'dlg-form') {
    e.preventDefault();
    const fd = new FormData(e.target); const out = {};
    formHandlers.fields.forEach((f) => {
      let v = fd.get(f.name);
      if (f.type === 'number') v = v === '' ? '' : Number(v);
      out[f.name] = typeof v === 'string' ? v.trim() : v;
    });
    if (formHandlers.onSubmit(out) !== false) $('#dlg').close();
  }
  if (e.target.id === 'login-form') { e.preventDefault(); doLogin(new FormData(e.target)); }
  if (e.target.id === 'register-form') { e.preventDefault(); doRegister(new FormData(e.target)); }
});
document.addEventListener('click', (e) => {
  if (e.target.closest('[data-close]')) $('#dlg').close();
  if (e.target.closest('[data-del]') && formHandlers?.onDelete) {
    if (confirm('確定要刪除嗎？此動作無法復原。')) { formHandlers.onDelete(); $('#dlg').close(); }
  }
});

/* =====================================================================
 * 登入 / 註冊
 * ===================================================================== */
const authUi = { mode: 'login' };
function viewAuth() {
  const isLogin = authUi.mode === 'login';
  return `<div class="auth-wrap">
    <div class="auth-hero">
      <div class="row" style="gap:12px"><span class="logo" style="background:rgba(255,255,255,.2);width:52px;height:52px;font-size:28px">🐾</span><h1>PetLife+</h1></div>
      <p>智慧寵物生活管理系統 —— 以「智慧地圖整合服務」為核心，一個 APP 完成醫療管理、美容照護與生活資訊查詢。</p>
      <div class="feat"><span>🩺</span>寵物健康與美容照護管理</div>
      <div class="feat"><span>📍</span>智慧地圖：動物醫院、24H 急診、美容、友善場所</div>
      <div class="feat"><span>👨‍👩‍👧</span>家庭共同管理，資訊即時同步</div>
    </div>
    <div class="auth-form">
      <div class="card">
        <div class="tabs" style="margin-bottom:10px"><button class="${isLogin ? 'on' : ''}" data-act="auth-mode" data-id="login">登入</button><button class="${!isLogin ? 'on' : ''}" data-act="auth-mode" data-id="register">註冊</button></div>
        ${isLogin ? `<form id="login-form">
          <label>電子郵件</label><input class="input" name="email" type="email" required value="mom@petlife.demo" autocomplete="username">
          <label>密碼</label><input class="input" name="password" type="password" required value="1234" autocomplete="current-password">
          <button class="btn primary lg block" style="margin-top:18px">登入</button>
        </form>
        <div class="small muted" style="margin-top:16px">示範帳號（密碼皆為 1234）</div>
        <div class="list">${db.family.members.map((m) => `<button class="dd-item" data-act="quick-login" data-id="${m.id}">${memberAvatar(m)}<span style="flex:1">${esc(m.name)} <span class="muted small">${esc(m.email)}</span></span><span class="tag ${m.role === '管理員' ? 'green' : ''}">${m.role}</span></button>`).join('')}</div>`
        : `<form id="register-form">
          <label>你的稱呼</label><input class="input" name="name" required placeholder="例：奶奶">
          <label>電子郵件</label><input class="input" name="email" type="email" required>
          <label>密碼</label><input class="input" name="password" type="password" required minlength="4">
          <label>家庭邀請碼（加入既有家庭）</label><input class="input" name="code" placeholder="示範：${db.family.code}" style="text-transform:uppercase">
          <div class="small muted" style="margin-top:6px">留空則建立一個全新的家庭群組（會清除示範資料）。</div>
          <button class="btn primary lg block" style="margin-top:18px">註冊並進入</button>
        </form>`}
      </div>
    </div>
  </div>`;
}
function setSession(id) { store.set(SESSION, id); store.set(SESSION, id, sessionStorage); }
function doLogin(fd) {
  const m = db.family.members.find((x) => x.email.toLowerCase() === String(fd.get('email')).toLowerCase() && x.password === fd.get('password'));
  if (!m) return toast('❌ 帳號或密碼錯誤');
  setSession(m.id); toast(`歡迎回來，${m.name}！`); location.hash = '#/home'; render();
}
function doRegister(fd) {
  const name = fd.get('name').trim(), email = fd.get('email').trim(), password = fd.get('password'), code = fd.get('code').trim().toUpperCase();
  if (db.family.members.some((x) => x.email.toLowerCase() === email.toLowerCase()) && code) return toast('此電子郵件已註冊');
  if (code) {
    if (code !== db.family.code) return toast('❌ 邀請碼錯誤');
    const m = { id: uid(), name, email, password, phone: '', role: '成員', emoji: '🧑', color: MEMBER_COLORS[db.family.members.length % MEMBER_COLORS.length] };
    db.family.members.push(m); setSession(m.id); save('透過邀請碼加入了家庭 🎉', false);
  } else {
    if (!confirm('建立新家庭會清除目前的示範資料，確定嗎？')) return;
    const m = { id: uid(), name, email, password, phone: '', role: '管理員', emoji: '🧑', color: MEMBER_COLORS[0] };
    db = { version: 2, family: { id: uid(), name: `${name}的家`, code: genCode(), members: [m] }, pets: [], medical: [], grooming: [], appointments: [], reminders: [], notifications: [], favorites: [], activity: [], updatedAt: Date.now() };
    setSession(m.id); save('建立了家庭群組', false);
  }
  location.hash = db.pets.length ? '#/home' : '#/pets'; render();
  if (!db.pets.length) setTimeout(() => { toast('第一步：建立你的寵物資料'); petForm(); }, 300);
}

/* =====================================================================
 * 路由 & 外框
 * ===================================================================== */
const ui = { recPet: 'all', recQ: '', apptFilter: 'upcoming', calMonth: null, calDay: null, remFilter: 'active', actFilter: 'all' };
const currentRoute = () => (location.hash.split('/')[1] || 'home');

function renderChrome() {
  const r = currentRoute(); const navKey = r === 'pet' ? 'pets' : r;
  $('#side-nav').innerHTML = NAV.map(([k, i, l]) => (i ? `<a href="#/${k}" class="${navKey === k ? 'active' : ''}"><span class="ico">${i}</span>${l}</a>` : `<div class="grp">${k}</div>`)).join('');
  const due = dueReminders().length + unreadCount();
  $('#tabbar').innerHTML = TAB_NAV.map(([k, i, l]) => `<a href="#/${k}" class="${navKey === k || (k === 'me' && ['me', 'family', 'settings', 'pets', 'pet'].includes(navKey)) ? 'active' : ''}"><span class="ico">${i}</span>${l}${k === 'notifications' && due ? `<span class="badge">${due}</span>` : ''}</a>`).join('');
  const m = me();
  $('#me-chip').innerHTML = `${memberAvatar(m)}<span>${esc(m.name)}</span>`;
  $('#side-foot').innerHTML = `<div>🏠 ${esc(db.family.name)}・${db.family.members.length} 位成員</div><div>最後同步：${ago(db.updatedAt)}（${esc(member(db.updatedBy).name)}）</div>`;
  const b = $('#bell-badge'); b.hidden = !due; b.textContent = due;
}

function render() {
  const view = $('#view');
  if (!meId()) {
    if (MP) { MP.destroy(); MP = null; }
    document.body.classList.add('auth'); view.className = 'view full'; view.innerHTML = viewAuth(); return;
  }
  document.body.classList.remove('auth');
  const r = currentRoute(); const id = location.hash.split('/')[2];
  $('#page-title').textContent = TITLES[r] || 'PetLife+';
  renderChrome();
  if (r !== 'map' && MP) { MP.destroy(); MP = null; }
  view.className = 'view' + (r === 'map' ? ' full' : '');
  if (r === 'map' && MP) { renderMapAll(); return; }
  if (r === 'map' && mapMounting && $('#map')) return;
  const active = document.activeElement?.id; const caret = document.activeElement?.selectionStart;
  view.innerHTML = (VIEWS[r] || VIEWS.home)(id);
  if (r === 'map') mountMap();
  if (active && document.getElementById(active)) { const el = document.getElementById(active); el.focus(); try { el.setSelectionRange(caret, caret); } catch (e) { /* ignore */ } }
}
window.addEventListener('hashchange', () => { closeDropdowns(); render(); window.scrollTo(0, 0); });

/* =====================================================================
 * 頁面：首頁（家庭群組狀態列、核心功能格、重要通知卡片）
 * ===================================================================== */
const VIEWS = {};
function upcomingNotices(limit = 6) {
  const now = new Date(); const out = [];
  db.appointments.filter((a) => toDate(a.datetime) >= now && ['pending', 'confirmed'].includes(a.status)).forEach((a) => {
    const kind = a.placeType === 'grooming' || /美容|洗澡|修毛|剪/.test(a.service) ? 'groom' : 'med';
    out.push({ when: a.datetime, kind, title: a.service, sub: `📍 ${a.place}・${pet(a.petId).name}`, act: 'edit-appt', id: a.id });
  });
  db.reminders.filter((r) => !r.done).forEach((r) => out.push({ when: r.due, kind: r.kind || 'rem', title: r.title, sub: `${petEmoji(pet(r.petId))} ${pet(r.petId).name}${r.repeat !== 'none' ? '・🔁' + REPEAT[r.repeat] : ''}`, act: 'edit-rem', id: r.id, overdue: toDate(r.due) <= now }));
  return out.sort((a, b) => a.when.localeCompare(b.when)).slice(0, limit);
}
function noticeCard(n) {
  return `<div class="notice" style="--c:${KIND_COLOR[n.kind] || KIND_COLOR.rem}" data-act="${n.act}" data-id="${n.id}">
    <div style="min-width:0"><div class="nt">${esc(n.title)}</div><div class="ns">${esc(n.sub)}</div></div>
    <div class="nw">${n.overdue ? '已到期' : relWhen(n.when)}</div></div>`;
}
VIEWS.home = () => {
  const now = new Date();
  const monthKey = localDate(now).slice(0, 7);
  const monthCost = [...db.medical, ...db.grooming].filter((r) => r.date?.startsWith(monthKey)).reduce((s, r) => s + (Number(r.cost) || 0), 0);
  const upAppts = db.appointments.filter((a) => toDate(a.datetime) >= now && ['pending', 'confirmed'].includes(a.status)).length;
  const notices = upcomingNotices();
  return `<div class="stack">
    <a class="group-bar" href="#/family">
      <div style="flex:1"><div class="gl">目前群組</div><div class="gn">🏠 ${esc(db.family.name)} 的寵物</div>
        <div class="small muted">${db.pets.length} 隻寵物・${db.family.members.length} 位家人共同照顧</div></div>
      <div class="avatars">${db.family.members.slice(0, 5).map((m) => memberAvatar(m, 'md')).join('')}</div>
    </a>

    <div>
      <div class="sec-title">功能服務</div>
      <div class="tiles">
        <a class="tile" href="#/map"><span class="ti">🗺️</span>智慧地圖<span class="td">醫院・美容・友善場所</span></a>
        <a class="tile" href="#/medical"><span class="ti">🏥</span>醫療紀錄<span class="td">病歷・疫苗・用藥</span></a>
        <a class="tile" href="#/grooming"><span class="ti">✂️</span>美容照護<span class="td">洗澡・修毛・日常照護</span></a>
        <a class="tile" href="#/appointments"><span class="ti">📅</span>診所預約<span class="td">查看空班・一鍵預約</span></a>
      </div>
    </div>

    <div class="grid g2" style="align-items:start">
      <div>
        <div class="sec-title">近期通知提醒<span class="spacer"></span><a class="small" href="#/notifications">全部 →</a></div>
        ${notices.map(noticeCard).join('') || '<div class="card empty">目前沒有待辦行程 🎉</div>'}
        <div class="row small muted" style="margin-top:10px"><span class="dot" style="background:${KIND_COLOR.med}"></span>醫療 <span class="dot" style="background:${KIND_COLOR.groom}"></span>美容 <span class="dot" style="background:${KIND_COLOR.rem}"></span>日常照護</div>
      </div>
      <div class="stack" style="gap:16px">
        <div>
          <div class="sec-title">我的毛孩<span class="spacer"></span><button class="btn sm" data-act="add-pet">＋ 新增</button></div>
          <div class="stack" style="gap:10px">${db.pets.map(petCard).join('') || '<div class="card empty">還沒有寵物，先新增一隻吧！</div>'}</div>
        </div>
        <div class="grid g3" style="gap:10px">
          <div class="card stat" style="padding:14px"><span class="n">${upAppts}</span><span class="l">待赴預約</span></div>
          <div class="card stat" style="padding:14px"><span class="n">${dueReminders().length}</span><span class="l">到期提醒</span></div>
          <div class="card stat" style="padding:14px"><span class="n" style="font-size:22px">${money(monthCost)}</span><span class="l">本月花費</span></div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-h"><h3>👨‍👩‍👧 家庭動態</h3><span class="spacer"></span><a href="#/family" class="small">查看全部 →</a></div>
      <div class="list">${db.activity.slice(0, 4).map(activityRow).join('') || '<div class="empty">尚無動態</div>'}</div>
    </div>
  </div>`;
};
function petCard(p) {
  const nextMed = db.medical.filter((r) => r.petId === p.id && r.nextDate && dayDiff(r.nextDate) >= 0).sort((a, b) => a.nextDate.localeCompare(b.nextDate))[0];
  return `<a class="card pet-card" href="#/pet/${p.id}" style="padding:14px">
    ${avatarHtml(p, 'lg')}
    <div style="min-width:0;flex:1">
      <div style="font-weight:700;font-size:17px">${esc(p.name)} <span class="muted small">${p.gender === '公' ? '♂' : p.gender === '母' ? '♀' : ''}</span></div>
      <div class="muted small">${esc(p.breed || p.species)}・${age(p.birthday)}・${p.weight || '—'} kg</div>
      ${nextMed ? `<span class="tag red" style="margin-top:4px">下次${esc(nextMed.type)}：${rel(nextMed.nextDate)}</span>` : '<span class="tag green" style="margin-top:4px">近期無待辦醫療</span>'}
    </div></a>`;
}
function reminderRow(r) {
  const overdue = toDate(r.due) <= new Date(); const p = pet(r.petId);
  return `<div class="li">
    <button class="icon-btn" data-act="rem-done" data-id="${r.id}" title="${r.done ? '重新開啟' : '完成打卡'}">${r.done ? '✅' : '⬜'}</button>
    <span class="dot" style="background:${KIND_COLOR[r.kind] || KIND_COLOR.rem}"></span>
    <div class="main-txt"><div class="t" style="${r.done ? 'text-decoration:line-through;opacity:.6' : ''}">${esc(r.title)}</div>
      <div class="s">${petEmoji(p)} ${esc(p.name)}・${fmtDT(r.due)}${r.repeat !== 'none' ? `・🔁${REPEAT[r.repeat]}` : ''}</div></div>
    ${r.done ? '<span class="tag">已完成</span>' : overdue ? '<span class="tag red">已到期</span>' : `<span class="tag">${rel(r.due)}</span>`}
    <button class="btn sm ghost" data-act="edit-rem" data-id="${r.id}">編輯</button>
  </div>`;
}
function activityRow(a) {
  const m = member(a.userId);
  return `<div class="li">${memberAvatar(m)}<div class="main-txt"><div><b>${esc(m.name)}</b> ${esc(a.text)}</div><div class="s">${ago(a.ts)}</div></div></div>`;
}

/* =====================================================================
 * 頁面：寵物檔案
 * ===================================================================== */
VIEWS.pets = () => `<div class="stack">
  <div class="row"><div class="muted">家庭成員皆可查看與更新寵物資料，修改會即時同步給所有家人。</div><span class="spacer"></span><button class="btn primary" data-act="add-pet">＋ 新增寵物</button></div>
  <div class="grid g3">${db.pets.map(petCard).join('') || '<div class="card empty">還沒有寵物</div>'}</div>
</div>`;

VIEWS.pet = (id) => {
  const p = db.pets.find((x) => x.id === id);
  if (!p) return '<div class="card empty">找不到這隻寵物。<a href="#/pets">回寵物列表</a></div>';
  const meds = db.medical.filter((r) => r.petId === id);
  const grooms = db.grooming.filter((r) => r.petId === id);
  const appts = db.appointments.filter((r) => r.petId === id);
  const tl = [
    ...meds.map((r) => ({ d: r.date, c: KIND_COLOR.med, icon: '🩺', t: `${r.type}・${r.title}`, s: [r.clinic, r.detail, r.medication && '用藥：' + r.medication].filter(Boolean).join('｜'), act: 'edit-med', id: r.id })),
    ...grooms.map((r) => ({ d: r.date, c: KIND_COLOR.groom, icon: '✂️', t: r.type, s: [r.shop, r.detail].filter(Boolean).join('｜'), act: 'edit-groom', id: r.id })),
    ...appts.map((r) => ({ d: r.datetime, c: KIND_COLOR.appt, icon: '📅', t: `預約・${r.service}`, s: `${r.place}｜${APPT_STATUS[r.status][0]}`, act: 'edit-appt', id: r.id })),
  ].sort((a, b) => b.d.localeCompare(a.d));
  const totalCost = [...meds, ...grooms].reduce((s, r) => s + (Number(r.cost) || 0), 0);
  const weights = meds.filter((r) => r.weight).sort((a, b) => a.date.localeCompare(b.date)).map((r) => ({ d: r.date, w: Number(r.weight) }));
  const vaccines = meds.filter((r) => r.type === '疫苗').sort((a, b) => b.date.localeCompare(a.date));

  return `<div class="stack">
    <a href="#/pets" class="small">← 返回寵物列表</a>
    <div class="card row" style="gap:18px;align-items:flex-start">
      ${avatarHtml(p, 'xl')}
      <div style="flex:1;min-width:220px">
        <div class="row"><h2>${esc(p.name)}</h2><span class="tag">${esc(p.species)}</span><span class="tag">${esc(p.gender || '—')}</span>${p.neutered === '是' ? '<span class="tag green">已結紮</span>' : ''}</div>
        <div class="grid g2" style="margin-top:10px;gap:4px 18px">
          <div><span class="muted small">品種</span><div>${esc(p.breed || '—')}</div></div>
          <div><span class="muted small">生日 / 年齡</span><div>${fmtDate(p.birthday)}（${age(p.birthday)}）</div></div>
          <div><span class="muted small">體重</span><div>${p.weight || '—'} kg</div></div>
          <div><span class="muted small">晶片號碼</span><div>${esc(p.chip || '—')}</div></div>
        </div>
        ${p.notes ? `<div style="margin-top:10px" class="tag orange">📝 ${esc(p.notes)}</div>` : ''}
      </div>
      <div class="row"><button class="btn" data-act="print-pet" data-id="${p.id}">🖨 病史摘要</button><button class="btn" data-act="edit-pet" data-id="${p.id}">✏️ 編輯</button></div>
    </div>
    <div class="grid g4">
      <div class="card stat"><span class="n">${meds.length}</span><span class="l">醫療紀錄</span></div>
      <div class="card stat"><span class="n">${grooms.length}</span><span class="l">美容照護紀錄</span></div>
      <div class="card stat"><span class="n">${appts.filter((a) => toDate(a.datetime) >= new Date() && ['pending', 'confirmed'].includes(a.status)).length}</span><span class="l">待赴預約</span></div>
      <div class="card stat"><span class="n">${money(totalCost)}</span><span class="l">累計花費</span></div>
    </div>
    <div class="grid g2">
      <div class="card"><div class="card-h"><h3>📈 體重變化</h3></div>${weightChart(weights)}</div>
      <div class="card"><div class="card-h"><h3>💉 疫苗紀錄</h3></div>
        <div class="list">${vaccines.map((v) => `<div class="li"><div class="main-txt"><div class="t">${esc(v.title)}</div><div class="s">${fmtDate(v.date)}・${esc(v.clinic)}</div></div>${v.nextDate ? `<span class="tag ${dayDiff(v.nextDate) <= 7 ? 'red' : ''}">下次 ${fmtDate(v.nextDate)}</span>` : ''}</div>`).join('') || '<div class="empty">尚無疫苗紀錄</div>'}</div>
        <div class="row" style="margin-top:10px">
          <button class="btn sm" data-act="add-med" data-pet="${p.id}">🩺 醫療</button><button class="btn sm" data-act="add-groom" data-pet="${p.id}">✂️ 美容</button>
          <button class="btn sm" data-act="add-appt" data-pet="${p.id}">📅 預約</button><button class="btn sm" data-act="add-rem" data-pet="${p.id}">⏰ 提醒</button></div>
      </div>
    </div>
    <div class="card">
      <div class="card-h"><h3>🗂 照護時間軸</h3></div>
      ${tl.length ? `<div class="timeline">${tl.map((x) => `<div class="tl-item" style="--c:${x.c}">
        <div class="row" style="gap:6px"><span class="muted small">${fmtDate(x.d)}</span><b>${x.icon} ${esc(x.t)}</b>
        <button class="btn sm ghost" data-act="${x.act}" data-id="${x.id}">編輯</button></div>
        <div class="muted small">${esc(x.s)}</div></div>`).join('')}</div>` : '<div class="empty">尚無紀錄</div>'}
    </div>
  </div>`;
};
function weightChart(pts) {
  if (pts.length < 2) return '<div class="empty">至少需要兩筆含體重的醫療紀錄才能繪製趨勢</div>';
  const W = 460, H = 150, P = 28;
  const ws = pts.map((p) => p.w); const min = Math.min(...ws) - 0.3, max = Math.max(...ws) + 0.3;
  const x = (i) => P + (i * (W - P * 2)) / (pts.length - 1);
  const y = (w) => H - P - ((w - min) / (max - min)) * (H - P * 2);
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.w)}`).join(' ');
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto" role="img" aria-label="體重變化折線圖">
    <path d="${path}" fill="none" stroke="var(--primary)" stroke-width="2.5"/>
    ${pts.map((p, i) => `<circle cx="${x(i)}" cy="${y(p.w)}" r="4" fill="var(--primary)"/><text x="${x(i)}" y="${y(p.w) - 9}" text-anchor="middle" font-size="11" fill="var(--text)">${p.w}</text><text x="${x(i)}" y="${H - 8}" text-anchor="middle" font-size="10" fill="var(--muted)">${p.d.slice(5)}</text>`).join('')}
  </svg>`;
}

/* =====================================================================
 * 頁面：醫療紀錄 / 美容照護
 * ===================================================================== */
function recordsView(isMed) {
  const rows = (isMed ? db.medical : db.grooming)
    .filter((r) => ui.recPet === 'all' || r.petId === ui.recPet)
    .filter((r) => !ui.recQ || JSON.stringify(r).includes(ui.recQ))
    .sort((a, b) => b.date.localeCompare(a.date));
  const total = rows.reduce((s, r) => s + (Number(r.cost) || 0), 0);
  return `<div class="stack">
    <div class="row">
      <select class="select" id="rec-pet" data-model="recPet"><option value="all">全部寵物</option>${petOptions().map(([v, l]) => `<option value="${v}" ${ui.recPet === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>
      <input class="input" id="rec-q" data-model="recQ" placeholder="🔍 搜尋紀錄內容…" value="${esc(ui.recQ)}" style="flex:1;max-width:300px">
      <span class="muted small">共 ${rows.length} 筆・合計 ${money(total)}</span>
      <span class="spacer"></span>
      <a class="btn" href="#/map">📍 查詢附近${isMed ? '動物醫院' : '美容店'}</a>
      <button class="btn primary" data-act="${isMed ? 'add-med' : 'add-groom'}">＋ 新增${isMed ? '醫療' : '照護'}紀錄</button>
    </div>
    <div class="card tbl-wrap" style="padding:6px 12px">
      ${rows.length ? `<table class="tbl"><thead><tr><th>日期</th><th>寵物</th><th>類型</th><th>${isMed ? '診斷 / 醫院' : '地點'}</th><th>${isMed ? '治療・用藥' : '說明'}</th><th>費用</th><th>下次</th><th>紀錄者</th></tr></thead><tbody>
      ${rows.map((r) => { const p = pet(r.petId); return `<tr class="clickable" data-act="${isMed ? 'edit-med' : 'edit-groom'}" data-id="${r.id}">
        <td style="white-space:nowrap">${fmtDate(r.date)}</td><td style="white-space:nowrap">${petEmoji(p)} ${esc(p.name)}</td><td><span class="tag ${isMed ? 'red' : 'orange'}">${esc(r.type)}</span></td>
        <td>${isMed ? `<b>${esc(r.title)}</b><div class="muted small">${esc(r.clinic)}</div>` : esc(r.shop)}</td>
        <td class="small">${esc(r.detail)}${isMed && r.medication ? `<div>💊 ${esc(r.medication)}</div>` : ''}${isMed && r.weight ? `<div class="muted">體重 ${r.weight} kg</div>` : ''}</td>
        <td>${money(r.cost)}</td><td style="white-space:nowrap">${r.nextDate ? `${fmtDate(r.nextDate)}<div class="muted small">${rel(r.nextDate)}</div>` : '—'}</td>
        <td style="white-space:nowrap">${member(r.by).emoji} ${esc(member(r.by).name)}</td></tr>`; }).join('')}
      </tbody></table>` : '<div class="empty">沒有符合條件的紀錄</div>'}
    </div>
  </div>`;
}
VIEWS.medical = () => recordsView(true);
VIEWS.grooming = () => recordsView(false);

/* =====================================================================
 * 頁面：診所預約（清單 + 月曆）
 * ===================================================================== */
VIEWS.appointments = () => {
  if (!ui.calMonth) ui.calMonth = localDate(new Date()).slice(0, 7);
  const now = new Date();
  let list = [...db.appointments];
  if (ui.calDay) list = list.filter((a) => a.datetime.startsWith(ui.calDay));
  else if (ui.apptFilter === 'upcoming') list = list.filter((a) => toDate(a.datetime) >= now && ['pending', 'confirmed'].includes(a.status));
  else if (ui.apptFilter === 'past') list = list.filter((a) => toDate(a.datetime) < now || ['done', 'cancelled'].includes(a.status));
  list.sort((a, b) => (ui.apptFilter === 'past' ? b.datetime.localeCompare(a.datetime) : a.datetime.localeCompare(b.datetime)));
  const favs = db.favorites.filter((f) => ['vet', 'er', 'grooming', 'care'].includes(f.cat));

  return `<div class="grid" style="grid-template-columns:minmax(0,1fr) minmax(0,330px);align-items:start" id="appt-grid">
    <div class="stack">
      <div class="card row" style="background:var(--primary-2);border-color:transparent">
        <div style="flex:1;min-width:220px"><b>🗓️ 線上預約合作店家</b><div class="small muted">在智慧地圖上選擇動物醫院或美容店，即可查看空班時段並一鍵完成預約。</div></div>
        <a class="btn primary" href="#/map">📍 開啟地圖找店家</a>
      </div>
      ${favs.length ? `<div><div class="sec-title" style="font-size:15px">⭐ 從家庭收藏快速預約</div><div class="row">${favs.map((f) => `<button class="btn sm" data-act="book-fav" data-id="${esc(f.id)}">${CATS[f.cat]?.icon || '📍'} ${esc(f.name)}</button>`).join('')}</div></div>` : ''}
      <div class="row">
        <div class="tabs">${[['upcoming', '即將到來'], ['past', '歷史紀錄'], ['all', '全部']].map(([k, l]) => `<button class="${ui.apptFilter === k && !ui.calDay ? 'on' : ''}" data-act="appt-filter" data-id="${k}">${l}</button>`).join('')}</div>
        ${ui.calDay ? `<span class="tag orange">📅 ${fmtDate(ui.calDay)} <a href="javascript:void 0" data-act="cal-day" data-id="">✕</a></span>` : ''}
        <span class="spacer"></span>
        <button class="btn" data-act="add-appt">＋ 手動新增</button>
      </div>
      <div class="card" style="padding:6px 14px">
        ${list.map((a) => {
          const p = pet(a.petId); const [sl, sc] = APPT_STATUS[a.status];
          const nav = a.lat ? gmapsDir(a.lat, a.lng, 'driving') : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(a.place + ' ' + (a.addr || ''))}`;
          return `<div class="li" style="align-items:flex-start">
            ${avatarHtml(p, 'md')}
            <div class="main-txt"><div class="t">${esc(a.service)}・${esc(p.name)} <span class="tag ${sc}">${sl}</span> ${a.online ? '<span class="tag blue">線上預約</span>' : ''}</div>
              <div class="s">🕒 ${fmtDT(a.datetime)}（${rel(a.datetime)}）</div>
              <div class="s">📍 ${esc(a.place)}${a.addr ? `・${esc(a.addr)}` : ''}${a.phone ? `・📞 ${esc(a.phone)}` : ''}</div>
              ${a.notes ? `<div class="s">📝 ${esc(a.notes)}</div>` : ''}
              <div class="s">由 ${esc(member(a.by).name)} 建立</div>
            </div>
            <div class="row" style="flex-direction:column;align-items:stretch;gap:4px">
              ${a.status === 'pending' ? `<button class="btn sm" data-act="appt-status" data-id="${a.id}" data-status="confirmed">✔ 確認</button>` : ''}
              ${['pending', 'confirmed'].includes(a.status) ? `<button class="btn sm" data-act="appt-done" data-id="${a.id}">完成並記錄</button>` : ''}
              <a class="btn sm" target="_blank" rel="noopener" href="${nav}">🧭 導航</a>
              <button class="btn sm ghost" data-act="edit-appt" data-id="${a.id}">編輯</button>
            </div>
          </div>`;
        }).join('') || '<div class="empty">沒有預約</div>'}
      </div>
    </div>
    <div class="card">${calendar()}</div>
  </div>
  <style>@media (max-width: 900px){ #appt-grid{grid-template-columns:1fr !important} }</style>`;
};
function calendar() {
  const [y, m] = ui.calMonth.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const start = new Date(first); start.setDate(1 - first.getDay());
  const todayS = localDate(new Date());
  let cells = '';
  for (let i = 0; i < 42; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    const ds = localDate(d);
    const nA = db.appointments.filter((a) => a.datetime.startsWith(ds) && a.status !== 'cancelled').length;
    const nR = db.reminders.filter((r) => !r.done && r.due.startsWith(ds)).length;
    cells += `<button class="${d.getMonth() !== m - 1 ? 'other' : ''} ${ds === todayS ? 'today' : ''} ${ui.calDay === ds ? 'sel' : ''}" data-act="cal-day" data-id="${ds}">
      ${d.getDate()}<span class="dots">${'<i></i>'.repeat(Math.min(nA, 3))}${'<i class="r"></i>'.repeat(Math.min(nR, 2))}</span></button>`;
  }
  return `<div class="card-h"><button class="icon-btn" data-act="cal-nav" data-id="-1">‹</button><h3 style="flex:1;text-align:center">${y} 年 ${m} 月</h3><button class="icon-btn" data-act="cal-nav" data-id="1">›</button></div>
    <div class="cal">${WEEK.map((w) => `<div class="dow">${w}</div>`).join('')}${cells}</div>
    <div class="row small muted" style="margin-top:10px"><span class="dot" style="background:var(--accent)"></span>預約 <span class="dot" style="background:var(--primary)"></span>提醒</div>`;
}

/* ---------- 線上預約：查看空班時段 ---------- */
let book = null;
function openBooking(place) {
  if (!needPets()) return;
  const isGroom = ['grooming', 'care'].includes(place.cat);
  book = { place, date: localDate(new Date()), slot: null, petId: db.pets[0].id, service: isGroom ? '洗澡' : '一般門診', notes: '', remind: 'both', isGroom };
  renderBooking(); $('#dlg').showModal();
}
function slotsFor(key, dateStr) {
  const out = []; const d = toDate(dateStr); const dow = d.getDay();
  const closed = hash(key) % 7 === dow && dow !== 6; // 每家店一天公休（示意）
  for (let h = 9; h < 20; h++) for (const mm of [0, 30]) {
    if (h === 12 || (h === 13 && mm === 0)) continue; // 午休
    const t = `${pad(h)}:${pad(mm)}`; const dt = `${dateStr}T${t}`;
    const mine = db.appointments.some((a) => a.placeKey === key && a.datetime === dt && a.status !== 'cancelled');
    const busy = closed || hash(key + dt) % 10 < 3;
    out.push({ t, dt, avail: !busy && !mine && toDate(dt) > new Date(), mine });
  }
  return { closed, slots: out };
}
function renderBooking() {
  const b = book; const p = b.place;
  const days = Array.from({ length: 10 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() + i); return localDate(d); });
  const { closed, slots } = slotsFor(p.id, b.date);
  const services = b.isGroom ? ['洗澡', '洗澡＋修毛', '全身美容', '剪指甲', 'SPA', '寵物住宿'] : ['一般門診', '疫苗施打', '健康檢查', '回診追蹤', '驅蟲', '牙科檢查', '急診'];
  $('#dlg').innerHTML = `<div class="form">
    <header><h3>📅 線上預約</h3><button type="button" class="icon-btn" data-close>✕</button></header>
    <div class="form-body" style="display:flex;flex-direction:column;gap:14px">
      <div class="card" style="padding:12px;background:var(--surface-2);box-shadow:none">
        <b>${CATS[p.cat]?.icon || '📍'} ${esc(p.name)}</b> ${p.rating != null ? `<span class="tag star">${starStr(p.rating)}</span>` : ''}
        <div class="small muted">${esc(p.addr || '')}${p.phone ? '・📞 ' + esc(p.phone) : ''}</div>
      </div>
      <div class="grid g2" style="gap:10px">
        <div class="f"><label>寵物</label><select id="bk-pet">${petOptions().map(([v, l]) => `<option value="${v}" ${v === b.petId ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></div>
        <div class="f"><label>服務項目</label><select id="bk-svc">${services.map((s) => `<option ${s === b.service ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
      </div>
      <div><label>選擇日期</label><div class="days" style="margin-top:4px">${days.map((d) => { const x = toDate(d); return `<button type="button" class="${d === b.date ? 'on' : ''}" data-act="bk-date" data-id="${d}"><span class="small">${dayDiff(d) === 0 ? '今天' : '週' + WEEK[x.getDay()]}</span><b>${x.getMonth() + 1}/${x.getDate()}</b></button>`; }).join('')}</div></div>
      <div><label>空班時段 <span class="muted small">（灰色為已滿或非營業時間）</span></label>
        ${closed ? '<div class="empty">本日公休，請選擇其他日期</div>' : `<div class="slots" style="margin-top:6px">${slots.map((s) => `<button type="button" ${s.avail ? '' : 'disabled'} class="${b.slot === s.dt ? 'on' : ''}" data-act="bk-slot" data-id="${s.dt}">${s.t}</button>`).join('')}</div>`}
      </div>
      <div class="grid g2" style="gap:10px">
        <div class="f"><label>事前提醒</label><select id="bk-remind"><option value="both" ${b.remind === 'both' ? 'selected' : ''}>1 天前 + 1 小時前</option><option value="1440" ${b.remind === '1440' ? 'selected' : ''}>1 天前</option><option value="60" ${b.remind === '60' ? 'selected' : ''}>1 小時前</option><option value="0" ${b.remind === '0' ? 'selected' : ''}>不提醒</option></select></div>
        <div class="f"><label>備註給店家</label><input id="bk-notes" value="${esc(b.notes)}" placeholder="例：怕生、需要嘴套"></div>
      </div>
    </div>
    <footer><span class="small muted" style="align-self:center">${b.slot ? `已選：${fmtDT(b.slot)}` : '請選擇時段'}</span><span class="spacer"></span>
      <button type="button" class="btn ghost" data-close>取消</button><button type="button" class="btn primary" data-act="bk-confirm" ${b.slot ? '' : 'disabled'}>確認預約</button></footer>
  </div>`;
}
function syncBookingInputs() {
  if (!book || !$('#bk-pet')) return;
  book.petId = $('#bk-pet').value; book.service = $('#bk-svc').value; book.remind = $('#bk-remind').value; book.notes = $('#bk-notes').value;
}
function confirmBooking() {
  syncBookingInputs(); const b = book; const p = b.place;
  const a = { id: uid(), petId: b.petId, datetime: b.slot, service: b.service, placeKey: p.id, place: p.name, placeType: p.cat, addr: p.addr || '', lat: p.lat, lng: p.lng, phone: p.phone || '', status: 'confirmed', notes: b.notes, by: meId(), online: true };
  db.appointments.push(a);
  const t = toDate(a.datetime).getTime(); const kind = b.isGroom ? 'groom' : 'med';
  const mk = (min) => autoReminder(a.petId, `預約：${a.service}＠${a.place}`, localISO(new Date(t - min * 6e4)), '09:00', kind);
  if (b.remind === '60' || b.remind === 'both') mk(60);
  if (b.remind === '1440' || b.remind === 'both') mk(1440);
  addNotification('📅 預約成功', `${p.name} 已確認 ${pet(a.petId).name} 的「${a.service}」，時間 ${fmtDT(a.datetime)}`);
  $('#dlg').close(); book = null;
  save(`線上預約了 ${p.name}「${a.service}」（${pet(a.petId).name}，${fmtDT(a.datetime)}）`, currentRoute() !== 'map');
  if (currentRoute() === 'map') renderChrome();
  toast('✅ 預約成功！已同步通知所有家人');
}

/* =====================================================================
 * 頁面：通知提醒
 * ===================================================================== */
const unreadCount = () => (db.notifications || []).filter((n) => !n.read).length;
VIEWS.notifications = () => {
  const perm = 'Notification' in window ? Notification.permission : 'unsupported';
  let list = [...db.reminders];
  if (ui.remFilter === 'active') list = list.filter((r) => !r.done);
  if (ui.remFilter === 'done') list = list.filter((r) => r.done);
  list.sort((a, b) => a.due.localeCompare(b.due));
  const notifs = db.notifications || [];
  return `<div class="stack">
    ${perm !== 'granted' ? `<div class="card row" style="background:var(--accent-2);border-color:transparent">
      <div style="flex:1;min-width:220px">🔔 <b>開啟推播通知</b><div class="small muted">${perm === 'unsupported' ? '此瀏覽器不支援系統通知，將以站內通知提醒。' : perm === 'denied' ? '你已封鎖通知，請到瀏覽器網站設定中允許。' : '允許後，提醒時間到時會跳出系統推播（模擬 Firebase Cloud Messaging）。'}</div></div>
      ${perm === 'default' ? '<button class="btn accent" data-act="notif-perm">允許通知</button>' : ''}</div>` : ''}
    <div class="grid g2" style="align-items:start">
      <div class="stack" style="gap:12px">
        <div class="row">
          <div class="tabs">${[['active', '進行中'], ['done', '已完成'], ['all', '全部']].map(([k, l]) => `<button class="${ui.remFilter === k ? 'on' : ''}" data-act="rem-filter" data-id="${k}">${l}</button>`).join('')}</div>
          <span class="spacer"></span><button class="btn primary" data-act="add-rem">＋ 新增提醒</button>
        </div>
        <div class="card" style="padding:6px 12px"><div class="list">${list.map(reminderRow).join('') || '<div class="empty">沒有提醒</div>'}</div></div>
        <div class="muted small">💡 填寫醫療 / 美容紀錄的「下次日期」或建立預約時，會自動產生提醒；重複提醒完成打卡後自動排入下一次，家人可即時看到誰已完成（避免重複餵藥）。</div>
      </div>
      <div class="card">
        <div class="card-h"><h3>📬 推播通知紀錄</h3><span class="spacer"></span><button class="btn sm ghost" data-act="test-notif">🧪 測試</button>${unreadCount() ? '<button class="btn sm" data-act="read-all">全部已讀</button>' : ''}</div>
        <div class="list">${notifs.slice(0, 30).map((n) => `<div class="li"><span class="dot" style="background:${n.read ? 'var(--line)' : 'var(--danger)'}"></span><div class="main-txt"><div class="t">${esc(n.title)}</div><div class="s">${esc(n.body)}・${ago(n.ts)}</div></div></div>`).join('') || '<div class="empty">尚無通知</div>'}</div>
      </div>
    </div>
  </div>`;
};
function dueReminders() { const now = new Date(); return db.reminders.filter((r) => !r.done && toDate(r.due) <= now); }
function addNotification(title, body) { db.notifications = db.notifications || []; db.notifications.unshift({ id: uid(), ts: Date.now(), title, body, read: false }); }
function checkReminders() {
  if (!meId()) return;
  const now = new Date(); let changed = false;
  db.reminders.forEach((r) => {
    if (!r.done && !r.notified && toDate(r.due) <= now) {
      r.notified = true; changed = true;
      const title = `⏰ ${pet(r.petId).name}：${r.title}`;
      addNotification(title, `提醒時間 ${fmtDT(r.due)}`); pushNotify(title, `提醒時間 ${fmtDT(r.due)}`);
    }
  });
  if (changed) save(null, currentRoute() !== 'map'); else renderChrome();
}
function pushNotify(title, body) {
  toast(`${title}｜${body}`, 'notify');
  if ('Notification' in window && Notification.permission === 'granted') { try { new Notification(title, { body, tag: title }); } catch (e) { /* ignore */ } }
}
function advanceRepeat(r) {
  const d = toDate(r.due);
  const step = { daily: () => d.setDate(d.getDate() + 1), weekly: () => d.setDate(d.getDate() + 7), monthly: () => d.setMonth(d.getMonth() + 1), yearly: () => d.setFullYear(d.getFullYear() + 1) }[r.repeat];
  step(); while (d <= new Date()) step();
  r.due = localISO(d); r.notified = false; r.done = false;
}
function autoReminder(petId, title, dateStr, time = '09:00', kind = 'rem') {
  if (!dateStr) return;
  const due = dateStr.length === 10 ? `${dateStr}T${time}` : dateStr;
  if (db.reminders.some((r) => r.petId === petId && r.title === title && r.due === due)) return;
  db.reminders.push({ id: uid(), petId, title, kind, due, repeat: 'none', done: false, notified: toDate(due) <= new Date(), note: '' });
}

/* =====================================================================
 * 頁面：家庭共同管理
 * ===================================================================== */
VIEWS.family = () => {
  const f = db.family;
  const acts = db.activity.filter((a) => ui.actFilter === 'all' || a.userId === ui.actFilter);
  const link = `${location.href.split('#')[0]}#/join/${f.code}`;
  return `<div class="stack">
    <div class="grid g2">
      <div class="card">
        <div class="card-h"><h3>🏠 ${esc(f.name)}</h3><span class="spacer"></span>${isAdmin() ? '<button class="btn sm" data-act="edit-family">編輯</button>' : ''}</div>
        <div class="muted small">家庭邀請碼</div>
        <div class="row" style="margin:4px 0 10px"><span style="font-size:30px;font-weight:700;letter-spacing:6px;font-family:Consolas,monospace;color:var(--primary-d)">${f.code}</span>
          <button class="btn sm" data-act="copy" data-text="${esc(link)}">📋 複製邀請連結</button>
          ${isAdmin() ? '<button class="btn sm ghost" data-act="regen-code">🔄 重新產生</button>' : ''}</div>
        <div class="muted small">家人註冊時輸入邀請碼即可綁定同一個寵物群組，共同查看與更新寵物資料。</div>
        <div class="row" style="margin-top:12px"><button class="btn primary" data-act="join-family">🔑 以邀請碼新增成員</button></div>
      </div>
      <div class="card">
        <div class="card-h"><h3>🔄 資訊即時同步（示範）</h3></div>
        <ol class="small" style="margin:0;padding-left:18px">
          <li>在新分頁開啟本網站（<a href="${esc(location.href.split('#')[0])}#/home" target="_blank">點我開新分頁</a>）。</li>
          <li>在新分頁右上角切換成另一位家人。</li>
          <li>任一分頁新增紀錄、完成餵藥打卡或預約，另一分頁會<b>即時同步</b>並跳出通知。</li>
        </ol>
        <div class="muted small" style="margin-top:8px">正式版以 Firebase Realtime Database 達成多裝置同步；本示意版以瀏覽器儲存事件模擬。</div>
      </div>
    </div>
    <div class="card">
      <div class="card-h"><h3>家庭成員（${f.members.length}）</h3></div>
      <div class="list">${f.members.map((m) => `<div class="li">
        ${memberAvatar(m, 'lg')}
        <div class="main-txt"><div class="t">${esc(m.name)} ${m.id === meId() ? '<span class="tag green">你</span>' : ''} ${m.role === '管理員' ? '<span class="tag orange">👑 管理員</span>' : ''}</div>
          <div class="s">${esc(m.email || '')}・${db.activity.filter((a) => a.userId === m.id).length} 筆動態</div></div>
        ${m.id !== meId() ? `<button class="btn sm" data-act="switch-user" data-id="${m.id}">切換身分</button>` : ''}
        ${isAdmin() || m.id === meId() ? `<button class="btn sm ghost" data-act="edit-member" data-id="${m.id}">編輯</button>` : ''}
      </div>`).join('')}</div>
    </div>
    <div class="card">
      <div class="card-h"><h3>📜 共同管理動態</h3><span class="spacer"></span>
        <select class="select" id="act-filter" data-model="actFilter"><option value="all">所有成員</option>${f.members.map((m) => `<option value="${m.id}" ${ui.actFilter === m.id ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</select></div>
      <div class="list">${acts.slice(0, 40).map(activityRow).join('') || '<div class="empty">沒有動態</div>'}</div>
    </div>
  </div>`;
};
VIEWS.join = (code) => { setTimeout(() => { location.hash = '#/family'; actions['join-family'](null, { code }); }, 0); return ''; };

/* =====================================================================
 * 頁面：我的 / 設定
 * ===================================================================== */
VIEWS.me = () => {
  const m = me();
  const mine = db.activity.filter((a) => a.userId === m.id).length;
  return `<div class="stack" style="max-width:820px">
    <div class="card row" style="gap:16px">${memberAvatar(m, 'xl')}
      <div style="flex:1"><h2>${esc(m.name)}</h2><div class="muted">${esc(m.email || '')}${m.phone ? '・' + esc(m.phone) : ''}</div>
        <div class="row" style="margin-top:6px"><span class="tag green">🏠 ${esc(db.family.name)}</span><span class="tag">${m.role}</span><span class="tag">${mine} 筆動態</span></div></div>
      <button class="btn" data-act="edit-member" data-id="${m.id}">編輯個人資料</button></div>
    <div class="grid g2">
      <a class="card li clickable" href="#/pets" style="padding:16px"><span style="font-size:26px">🐶</span><div class="main-txt"><div class="t">寵物檔案</div><div class="s">${db.pets.length} 隻寵物</div></div>›</a>
      <a class="card li clickable" href="#/family" style="padding:16px"><span style="font-size:26px">👨‍👩‍👧</span><div class="main-txt"><div class="t">家庭共同管理</div><div class="s">${db.family.members.length} 位成員・邀請碼 ${db.family.code}</div></div>›</a>
      <a class="card li clickable" href="#/appointments" style="padding:16px"><span style="font-size:26px">📅</span><div class="main-txt"><div class="t">我的預約</div><div class="s">${db.appointments.filter((a) => ['pending', 'confirmed'].includes(a.status) && toDate(a.datetime) >= new Date()).length} 個即將到來</div></div>›</a>
      <a class="card li clickable" href="#/map" style="padding:16px"><span style="font-size:26px">⭐</span><div class="main-txt"><div class="t">家庭收藏地點</div><div class="s">${db.favorites.length} 個地點</div></div>›</a>
      <a class="card li clickable" href="#/settings" style="padding:16px"><span style="font-size:26px">⚙️</span><div class="main-txt"><div class="t">系統設定</div><div class="s">地圖金鑰、通知、資料備份</div></div>›</a>
      <button class="card li clickable" data-act="logout" style="padding:16px;text-align:left;font:inherit;color:inherit"><span style="font-size:26px">🚪</span><div class="main-txt"><div class="t">登出</div><div class="s">切換其他帳號</div></div>›</button>
    </div>
  </div>`;
};
const getKey = () => store.get('petlife.gkey') || CFG.GOOGLE_MAPS_API_KEY || '';
VIEWS.settings = () => {
  const key = getKey(); const fromCfg = !store.get('petlife.gkey') && CFG.GOOGLE_MAPS_API_KEY;
  return `<div class="stack" style="max-width:800px">
  <div class="card">
    <div class="card-h"><h3>🗺️ 地圖服務（Google Maps API）</h3><span class="spacer"></span>${key && !gmFailed ? '<span class="provider g">● Google Maps 已啟用</span>' : '<span class="provider o">● 使用 OpenStreetMap</span>'}</div>
    <div class="small muted" style="margin-bottom:8px">需啟用 <b>Maps JavaScript API</b>、<b>Places API (New)</b>、<b>Directions API</b>、<b>Geocoding API</b>。啟用後可顯示 Google 店家評價、營業時間與路線規劃。${fromCfg ? '目前金鑰來自 config.js。' : ''}</div>
    <div class="row"><input class="input" id="gkey" style="flex:1;font-family:Consolas,monospace" placeholder="AIza..." value="${esc(store.get('petlife.gkey') || '')}">
      <button class="btn primary" data-act="save-key">儲存並套用</button>${store.get('petlife.gkey') ? '<button class="btn ghost danger" data-act="clear-key">清除</button>' : ''}</div>
    ${gmFailed ? '<div class="small" style="color:var(--danger);margin-top:6px">⚠️ 上次載入 Google Maps 失敗（金鑰無效、未啟用 API 或未開帳單），已暫時改用 OpenStreetMap。</div>' : ''}
  </div>
  <div class="card">
    <div class="card-h"><h3>🔔 通知</h3></div>
    <div class="row"><span>系統通知權限：<b>${'Notification' in window ? { granted: '已允許', denied: '已封鎖', default: '尚未設定' }[Notification.permission] : '不支援'}</b></span><span class="spacer"></span>
      <button class="btn" data-act="notif-perm">要求權限</button><button class="btn" data-act="test-notif">測試通知</button></div>
  </div>
  <div class="card">
    <div class="card-h"><h3>💾 資料管理</h3></div>
    <div class="row">
      <button class="btn" data-act="export">⬇️ 匯出 JSON 備份</button>
      <label class="btn">⬆️ 匯入備份<input type="file" accept=".json,application/json" id="import-file" hidden></label>
      <button class="btn danger" data-act="reset">↺ 重設為示範資料</button>
    </div>
  </div>
  <div class="card">
    <div class="card-h"><h3>🧩 系統架構對照（專題規格 → 網頁示意版）</h3></div>
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>專題規格</th><th>示意版實作</th></tr></thead><tbody>
      <tr><td>前端：Flutter / Android Studio</td><td>HTML + CSS + JavaScript（RWD，手機版底部導覽：首頁／地圖／通知／我的）</td></tr>
      <tr><td>後端：Java ／ 資料庫：Firebase、MySQL</td><td>瀏覽器 localStorage；資料表對應 ER Model（User、Pet、Family_Member、Medical_Record、Grooming_Record、Appointment、Location）</td></tr>
      <tr><td>地圖服務：Google Maps API</td><td>Maps JavaScript API、Places API (New) 文字搜尋、Directions 路線規劃、Google Maps 導航連結；無金鑰時以 OpenStreetMap 備援</td></tr>
      <tr><td>通知：Firebase Cloud Messaging</td><td>瀏覽器 Notification API + 站內提醒排程</td></tr>
      <tr><td>家庭共同管理</td><td>邀請碼綁定、角色權限、動態紀錄、跨分頁即時同步</td></tr>
    </tbody></table></div>
  </div>
</div>`;
};

/* =====================================================================
 * 表單定義（CRUD）
 * ===================================================================== */
function petForm(p) {
  const isNew = !p;
  openForm({
    title: isNew ? '建立寵物資料' : `編輯 ${p.name}`,
    data: p || { species: '狗', gender: '公', neutered: '否' },
    fields: [
      { name: 'name', label: '名字', required: true, half: true },
      { name: 'species', label: '物種', type: 'select', options: Object.keys(SPECIES), half: true },
      { name: 'breed', label: '品種', half: true, placeholder: '例：柴犬' },
      { name: 'gender', label: '性別', type: 'select', options: ['公', '母', '不明'], half: true },
      { name: 'birthday', label: '生日', type: 'date', half: true },
      { name: 'weight', label: '體重 (kg)', type: 'number', step: '0.1', half: true },
      { name: 'chip', label: '晶片號碼', half: true },
      { name: 'neutered', label: '結紮', type: 'select', options: ['是', '否'], half: true },
      { name: 'notes', label: '備註（過敏、習性等）', type: 'textarea' },
    ],
    onSubmit: (v) => {
      if (isNew) { db.pets.push({ id: uid(), color: PET_COLORS[db.pets.length % PET_COLORS.length], ...v }); save(`新增了寵物「${v.name}」`); }
      else { Object.assign(p, v); save(`更新了 ${p.name} 的基本資料`); }
    },
    onDelete: isNew ? null : () => {
      db.pets = db.pets.filter((x) => x.id !== p.id);
      ['medical', 'grooming', 'appointments', 'reminders'].forEach((k) => { db[k] = db[k].filter((r) => r.petId !== p.id); });
      save(`移除了寵物「${p.name}」`); location.hash = '#/pets';
    },
  });
}
function needPets() { if (!db.pets.length) { toast('請先建立寵物資料'); petForm(); return false; } return true; }

function medForm(r, preset = {}) {
  if (!needPets()) return;
  const isNew = !r;
  openForm({
    title: isNew ? '新增醫療紀錄' : '編輯醫療紀錄',
    data: r || { petId: preset.petId || db.pets[0].id, date: localDate(new Date()), type: preset.type || '看診', clinic: preset.clinic || '' },
    fields: [
      { name: 'petId', label: '寵物', type: 'select', options: petOptions(), half: true },
      { name: 'date', label: '就診日期', type: 'date', required: true, half: true },
      { name: 'type', label: '類型', type: 'select', options: MED_TYPES, half: true },
      { name: 'title', label: '診斷 / 項目', required: true, half: true, placeholder: '例：狂犬病疫苗、皮膚炎' },
      { name: 'clinic', label: '醫院 / 診所', placeholder: '可從智慧地圖直接建立' },
      { name: 'detail', label: '病況與醫囑', type: 'textarea' },
      { name: 'medication', label: '用藥', placeholder: '例：口服抗生素 7 天' },
      { name: 'cost', label: '費用 (NT$)', type: 'number', half: true },
      { name: 'weight', label: '當次體重 (kg)', type: 'number', step: '0.1', half: true },
      { name: 'nextDate', label: '下次回診 / 施打日期', type: 'date', hint: '填寫後會自動建立推播提醒' },
    ],
    onSubmit: (v) => {
      if (isNew) db.medical.push({ id: uid(), by: meId(), ...v }); else Object.assign(r, v);
      if (v.weight) { const latest = db.medical.filter((m) => m.petId === v.petId && m.weight).sort((a, b) => b.date.localeCompare(a.date))[0]; const pp = db.pets.find((x) => x.id === v.petId); if (latest && pp) pp.weight = latest.weight; }
      autoReminder(v.petId, `${v.type}：${v.title}（回診/施打）`, v.nextDate, '09:00', 'med');
      save(`${isNew ? '新增' : '更新'}了 ${pet(v.petId).name} 的醫療紀錄「${v.title}」`, currentRoute() !== 'map');
      if (currentRoute() === 'map') { renderChrome(); toast('✅ 已新增醫療紀錄'); }
    },
    onDelete: isNew ? null : () => { db.medical = db.medical.filter((x) => x.id !== r.id); save(`刪除了 ${pet(r.petId).name} 的醫療紀錄「${r.title}」`); },
  });
}
function groomForm(r, preset = {}) {
  if (!needPets()) return;
  const isNew = !r;
  openForm({
    title: isNew ? '新增美容及照護紀錄' : '編輯美容及照護紀錄',
    data: r || { petId: preset.petId || db.pets[0].id, date: localDate(new Date()), type: preset.type || '洗澡', shop: preset.shop || '' },
    fields: [
      { name: 'petId', label: '寵物', type: 'select', options: petOptions(), half: true },
      { name: 'date', label: '日期', type: 'date', required: true, half: true },
      { name: 'type', label: '項目', type: 'select', options: GROOM_TYPES, half: true },
      { name: 'shop', label: '美容店 / 地點', half: true, placeholder: '例：汪星人美容沙龍、在家' },
      { name: 'detail', label: '說明', type: 'textarea' },
      { name: 'cost', label: '費用 (NT$)', type: 'number', half: true },
      { name: 'nextDate', label: '下次預計日期', type: 'date', half: true, hint: '填寫後會自動建立提醒' },
    ],
    onSubmit: (v) => {
      if (isNew) db.grooming.push({ id: uid(), by: meId(), ...v }); else Object.assign(r, v);
      autoReminder(v.petId, `${v.type}（定期照護）`, v.nextDate, '09:00', 'groom');
      save(`${isNew ? '新增' : '更新'}了 ${pet(v.petId).name} 的美容紀錄「${v.type}」`, currentRoute() !== 'map');
      if (currentRoute() === 'map') { renderChrome(); toast('✅ 已新增美容紀錄'); }
    },
    onDelete: isNew ? null : () => { db.grooming = db.grooming.filter((x) => x.id !== r.id); save(`刪除了 ${pet(r.petId).name} 的美容紀錄「${r.type}」`); },
  });
}
function apptForm(a, preset = {}) {
  if (!needPets()) return;
  const isNew = !a;
  openForm({
    title: isNew ? '手動新增預約' : '編輯預約',
    data: a || { petId: preset.petId || db.pets[0].id, datetime: dOff(1, '10:00'), status: 'pending', remind: 'both' },
    fields: [
      { name: 'petId', label: '寵物', type: 'select', options: petOptions(), half: true },
      { name: 'datetime', label: '日期時間', type: 'datetime-local', required: true, half: true },
      { name: 'service', label: '服務項目', required: true, half: true, placeholder: '例：疫苗施打、洗澡美容' },
      { name: 'status', label: '狀態', type: 'select', options: Object.entries(APPT_STATUS).map(([k, [l]]) => [k, l]), half: true },
      { name: 'place', label: '地點名稱', required: true, placeholder: '非合作店家可手動輸入；合作店家請從地圖線上預約' },
      { name: 'addr', label: '地址', half: true },
      { name: 'phone', label: '電話', half: true },
      ...(isNew ? [{ name: 'remind', label: '事前提醒', type: 'select', options: [['both', '1 天前 + 1 小時前'], ['1440', '1 天前'], ['60', '1 小時前'], ['0', '不提醒']] }] : []),
      { name: 'notes', label: '備註', type: 'textarea' },
    ],
    onSubmit: (v) => {
      const remind = v.remind; delete v.remind;
      if (isNew) {
        db.appointments.push({ id: uid(), by: meId(), lat: null, lng: null, placeKey: 'manual:' + v.place, placeType: /美容|洗澡|修毛/.test(v.service) ? 'grooming' : 'vet', online: false, ...v });
        const t = toDate(v.datetime).getTime(); const kind = /美容|洗澡|修毛/.test(v.service) ? 'groom' : 'med';
        const mk = (min) => autoReminder(v.petId, `預約：${v.service}＠${v.place}`, localISO(new Date(t - min * 6e4)), '09:00', kind);
        if (remind === '60' || remind === 'both') mk(60);
        if (remind === '1440' || remind === 'both') mk(1440);
      } else Object.assign(a, v);
      save(`${isNew ? '建立' : '更新'}了預約「${v.service}」（${pet(v.petId).name}，${fmtDT(v.datetime)}）`);
    },
    onDelete: isNew ? null : () => { db.appointments = db.appointments.filter((x) => x.id !== a.id); save(`刪除了預約「${a.service}」`); },
  });
}
function remForm(r, petId) {
  if (!needPets()) return;
  const isNew = !r;
  openForm({
    title: isNew ? '新增提醒' : '編輯提醒',
    data: r || { petId: petId || db.pets[0].id, due: dOff(0, '20:00'), repeat: 'none', kind: 'rem' },
    fields: [
      { name: 'petId', label: '寵物', type: 'select', options: petOptions(), half: true },
      { name: 'title', label: '提醒內容', required: true, half: true, placeholder: '例：餵藥、疫苗施打' },
      { name: 'kind', label: '分類', type: 'select', options: [['med', '🔴 醫療（疫苗、用藥、回診）'], ['groom', '🟠 美容'], ['rem', '🟢 日常照護']], half: true },
      { name: 'repeat', label: '重複', type: 'select', options: Object.entries(REPEAT), half: true },
      { name: 'due', label: '提醒時間', type: 'datetime-local', required: true },
      { name: 'note', label: '備註', type: 'textarea' },
    ],
    onSubmit: (v) => {
      if (isNew) db.reminders.push({ id: uid(), done: false, notified: false, ...v });
      else { const changedDue = v.due !== r.due; Object.assign(r, v); if (changedDue) r.notified = toDate(v.due) <= new Date(); }
      save(`${isNew ? '新增' : '更新'}了提醒「${v.title}」（${pet(v.petId).name}）`);
    },
    onDelete: isNew ? null : () => { db.reminders = db.reminders.filter((x) => x.id !== r.id); save(`刪除了提醒「${r.title}」`); },
  });
}
function memberForm(m) {
  const admins = db.family.members.filter((x) => x.role === '管理員');
  openForm({
    title: `編輯成員：${m.name}`, data: m,
    fields: [
      { name: 'name', label: '稱呼', required: true, half: true },
      { name: 'emoji', label: '頭像', type: 'select', options: MEMBER_EMOJI, half: true },
      { name: 'email', label: '電子郵件', type: 'email', half: true },
      { name: 'phone', label: '電話', half: true },
      ...(isAdmin() ? [{ name: 'role', label: '角色', type: 'select', options: ['管理員', '成員'] }] : []),
    ],
    onSubmit: (v) => {
      if (v.role === '成員' && m.role === '管理員' && admins.length === 1) { toast('家庭至少需要一位管理員'); return false; }
      Object.assign(m, v); save(`更新了成員「${m.name}」的資料`);
    },
    onDelete: isAdmin() && m.id !== meId() ? () => { db.family.members = db.family.members.filter((x) => x.id !== m.id); save(`將「${m.name}」移出家庭`); } : null,
  });
}
function printPet(p) {
  const meds = db.medical.filter((r) => r.petId === p.id).sort((a, b) => b.date.localeCompare(a.date));
  const w = window.open('', '_blank'); if (!w) return toast('請允許彈出視窗');
  w.document.write(`<html><head><meta charset="utf-8"><title>${esc(p.name)} 病史摘要</title><style>body{font-family:"Microsoft JhengHei",sans-serif;padding:32px;color:#222}h1{font-size:22px}table{width:100%;border-collapse:collapse;font-size:13px}td,th{border:1px solid #ccc;padding:6px;text-align:left}</style></head><body>
    <h1>🐾 ${esc(p.name)} 病史摘要</h1><p>${esc(p.species)}・${esc(p.breed || '')}・${esc(p.gender || '')}・生日 ${fmtDate(p.birthday)}（${age(p.birthday)}）・體重 ${p.weight || '—'} kg・晶片 ${esc(p.chip || '—')}</p>
    ${p.notes ? `<p><b>注意事項：</b>${esc(p.notes)}</p>` : ''}
    <table><tr><th>日期</th><th>類型</th><th>診斷 / 項目</th><th>醫院</th><th>病況與醫囑</th><th>用藥</th></tr>
    ${meds.map((r) => `<tr><td>${fmtDate(r.date)}</td><td>${esc(r.type)}</td><td>${esc(r.title)}</td><td>${esc(r.clinic)}</td><td>${esc(r.detail)}</td><td>${esc(r.medication || '')}</td></tr>`).join('')}</table>
    <p style="color:#888;font-size:12px">由 PetLife+ 產生於 ${fmtDT(localISO(new Date()))}</p><script>print()<\/script></body></html>`);
  w.document.close();
}

/* =====================================================================
 * 事件代理
 * ===================================================================== */
const findBy = (k, id) => db[k].find((x) => x.id === id);
const actions = {
  'auth-mode': (el) => { authUi.mode = el.dataset.id; render(); },
  'quick-login': (el) => { setSession(el.dataset.id); toast(`歡迎回來，${member(el.dataset.id).name}！`); location.hash = '#/home'; render(); },
  logout: () => { store.set(SESSION, null); store.set(SESSION, null, sessionStorage); closeDropdowns(); render(); },
  'add-pet': () => petForm(),
  'edit-pet': (el) => petForm(findBy('pets', el.dataset.id)),
  'print-pet': (el) => printPet(findBy('pets', el.dataset.id)),
  'add-med': (el) => medForm(null, { petId: el?.dataset.pet }),
  'edit-med': (el) => medForm(findBy('medical', el.dataset.id)),
  'add-groom': (el) => groomForm(null, { petId: el?.dataset.pet }),
  'edit-groom': (el) => groomForm(findBy('grooming', el.dataset.id)),
  'add-appt': (el) => apptForm(null, { petId: el?.dataset.pet }),
  'edit-appt': (el) => apptForm(findBy('appointments', el.dataset.id)),
  'appt-status': (el) => { const a = findBy('appointments', el.dataset.id); a.status = el.dataset.status; save(`將預約「${a.service}」標記為${APPT_STATUS[a.status][0]}`); },
  'appt-done': (el) => {
    const a = findBy('appointments', el.dataset.id); a.status = 'done'; save(`完成了預約「${a.service}」`);
    const isG = a.placeType === 'grooming' || a.placeType === 'care' || /美容|洗澡|修毛/.test(a.service);
    isG ? groomForm(null, { petId: a.petId, shop: a.place }) : medForm(null, { petId: a.petId, clinic: a.place, type: /疫苗/.test(a.service) ? '疫苗' : '看診' });
  },
  'appt-filter': (el) => { ui.apptFilter = el.dataset.id; ui.calDay = null; render(); },
  'cal-day': (el) => { ui.calDay = ui.calDay === el.dataset.id ? null : el.dataset.id || null; if (ui.calDay) ui.calMonth = ui.calDay.slice(0, 7); render(); },
  'cal-nav': (el) => { const [y, m] = ui.calMonth.split('-').map(Number); ui.calMonth = localDate(new Date(y, m - 1 + Number(el.dataset.id), 1)).slice(0, 7); render(); },
  'book-fav': (el) => openBooking(db.favorites.find((f) => f.id === el.dataset.id)),
  'bk-date': (el) => { syncBookingInputs(); book.date = el.dataset.id; book.slot = null; renderBooking(); },
  'bk-slot': (el) => { syncBookingInputs(); book.slot = el.dataset.id; renderBooking(); },
  'bk-confirm': () => confirmBooking(),
  'add-rem': (el) => remForm(null, el?.dataset.pet),
  'edit-rem': (el) => remForm(findBy('reminders', el.dataset.id)),
  'rem-done': (el) => {
    const r = findBy('reminders', el.dataset.id);
    if (!r.done && r.repeat !== 'none') { const t = r.title; advanceRepeat(r); save(`完成打卡「${t}」（${pet(r.petId).name}），下次 ${fmtDT(r.due)}`); }
    else { r.done = !r.done; save(r.done ? `完成打卡「${r.title}」（${pet(r.petId).name}）` : `重新開啟提醒「${r.title}」`); }
  },
  'rem-filter': (el) => { ui.remFilter = el.dataset.id; render(); },
  'read-all': () => { db.notifications.forEach((n) => { n.read = true; }); save(null); },
  'notif-perm': async () => {
    if (!('Notification' in window)) return toast('此瀏覽器不支援系統通知');
    const p = await Notification.requestPermission();
    toast(p === 'granted' ? '已開啟系統通知 ✅' : '未取得通知權限'); render();
  },
  'test-notif': () => { addNotification('🐾 PetLife+ 測試通知', '通知功能運作正常！'); pushNotify('🐾 PetLife+ 測試通知', '通知功能運作正常！'); save(null); },
  'toggle-bell': () => {
    const p = $('#bell-panel'); const open = p.hidden; closeDropdowns(); if (!open) return;
    const due = dueReminders(); const soon = upcomingNotices(4).filter((n) => !n.overdue);
    p.innerHTML = `<div class="dd-title">已到期（${due.length}）</div>${due.map(reminderRow).join('') || '<div class="empty" style="padding:10px">沒有到期事項</div>'}
      <div class="dd-title">即將到來</div><div style="padding:4px">${soon.map(noticeCard).join('') || '<div class="empty" style="padding:10px">—</div>'}</div>
      <a class="dd-item" href="#/notifications" style="justify-content:center">查看所有通知 →</a>`;
    p.hidden = false;
  },
  'switch-menu': () => {
    const p = $('#me-panel'); const open = p.hidden; closeDropdowns(); if (!open) return;
    p.innerHTML = `<div class="dd-title">切換家庭成員（示範同步用）</div>${db.family.members.map((m) => `<button class="dd-item" data-act="switch-user" data-id="${m.id}">${memberAvatar(m)}<span style="flex:1">${esc(m.name)}<div class="small muted">${m.role}</div></span>${m.id === meId() ? '✔' : ''}</button>`).join('')}
      <a class="dd-item" href="#/me">👤 我的</a><button class="dd-item" data-act="logout">🚪 登出</button>`;
    p.hidden = false;
  },
  'switch-user': (el) => { store.set(SESSION, el.dataset.id, sessionStorage); closeDropdowns(); toast(`已切換為「${member(el.dataset.id).name}」`); render(); },
  'edit-member': (el) => memberForm(db.family.members.find((m) => m.id === el.dataset.id)),
  'edit-family': () => openForm({ title: '編輯家庭群組', data: db.family, fields: [{ name: 'name', label: '家庭名稱', required: true }], onSubmit: (v) => { db.family.name = v.name; save(`將家庭名稱改為「${v.name}」`); } }),
  'regen-code': () => { db.family.code = genCode(); save('重新產生了家庭邀請碼'); },
  'join-family': (el, pre = {}) => openForm({
    title: '以邀請碼加入家庭', submitText: '加入', data: { code: pre.code || '', emoji: '👵' },
    fields: [
      { name: 'code', label: '家庭邀請碼', required: true, placeholder: '6 碼英數字', hint: `示範用：目前家庭的邀請碼是 ${db.family.code}` },
      { name: 'name', label: '稱呼', required: true, half: true, placeholder: '例：奶奶' },
      { name: 'emoji', label: '頭像', type: 'select', options: MEMBER_EMOJI, half: true },
      { name: 'email', label: '電子郵件', type: 'email', required: true },
    ],
    onSubmit: (v) => {
      if (v.code.toUpperCase() !== db.family.code) { toast('❌ 邀請碼錯誤'); return false; }
      const m = { id: uid(), name: v.name, emoji: v.emoji, email: v.email, password: '1234', phone: '', role: '成員', color: MEMBER_COLORS[db.family.members.length % MEMBER_COLORS.length] };
      db.family.members.push(m);
      save(`邀請「${v.name}」加入了家庭 🎉`); toast(`已加入！${v.name} 可用 ${v.email} / 1234 登入`);
    },
  }),
  copy: (el) => { navigator.clipboard?.writeText(el.dataset.text).then(() => toast('已複製到剪貼簿'), () => prompt('請手動複製：', el.dataset.text)); },
  export: () => {
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `petlife-backup-${localDate(new Date())}.json`; a.click();
  },
  reset: () => { if (confirm('確定要清除所有資料並還原為示範資料？')) { db = seed(); setSession('m1'); save('重設了示範資料'); toast('已重設'); } },
  'save-key': () => { store.set('petlife.gkey', $('#gkey').value.trim() || null); gmFailed = false; toast('已儲存，重新載入以套用…'); setTimeout(() => location.reload(), 600); },
  'clear-key': () => { store.set('petlife.gkey', null); toast('已清除，重新載入…'); setTimeout(() => location.reload(), 600); },
  /* 地圖 */
  'map-cat': (el) => toggleCat(el.dataset.id),
  'map-locate': () => locateUser(true),
  'map-search-area': () => searchArea(),
  'map-select': (el) => selectPlace(el.dataset.id, true),
  'map-close': () => { mapState.selected = null; clearRoute(); renderMapAll(); },
  'map-route': (el) => routeTo(el.dataset.mode),
  'map-fav': () => {
    const p = mapState.selected; const i = db.favorites.findIndex((f) => f.id === p.id);
    const { dist, ...clean } = p;
    if (i >= 0) { db.favorites.splice(i, 1); save(`取消收藏「${p.name}」`, false); } else { db.favorites.push(clean); save(`收藏了地點「${p.name}」`, false); }
    renderChrome(); renderMapAll();
  },
  'map-book': () => openBooking(mapState.selected),
  'map-record': () => { const p = mapState.selected; ['grooming', 'care'].includes(p.cat) ? groomForm(null, { shop: p.name }) : medForm(null, { clinic: p.name }); },
};
function closeDropdowns() { $('#bell-panel').hidden = true; $('#me-panel').hidden = true; }

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) { if (!e.target.closest('.dropdown')) closeDropdowns(); return; }
  const fn = actions[el.dataset.act];
  if (fn) { if (el.tagName === 'A' && el.getAttribute('href')?.startsWith('javascript')) e.preventDefault(); fn(el); }
});
document.addEventListener('input', (e) => {
  const k = e.target.dataset?.model; if (!k) return;
  ui[k] = e.target.value; render();
});
document.addEventListener('change', (e) => {
  if (e.target.id === 'import-file') {
    const file = e.target.files[0]; if (!file) return;
    file.text().then((t) => { const d = JSON.parse(t); if (d.version !== 2) throw new Error('格式不符'); db = d; save('匯入了備份資料'); toast('匯入成功'); }).catch((err) => toast('匯入失敗：' + err.message));
  }
});

/* =====================================================================
 * 智慧地圖整合服務
 * ===================================================================== */
const CATS = {
  vet:        { label: '獸醫院',     icon: '🏥', color: '#e53935', gq: '動物醫院' },
  er:         { label: '24H急診',    icon: '🚑', color: '#c62828', gq: '24小時 動物醫院 急診' },
  grooming:   { label: '寵物美容',   icon: '✂️', color: '#8e24aa', gq: '寵物美容' },
  care:       { label: '寵物照護/旅館', icon: '🏨', color: '#1e88e5', gq: '寵物旅館 寵物安親' },
  restaurant: { label: '寵物友善餐廳', icon: '🍽️', color: '#fb8c00', gq: '寵物友善餐廳' },
  park:       { label: '公園/友善場所', icon: '🌳', color: '#43a047', gq: '寵物公園 狗狗公園' },
  petshop:    { label: '寵物用品',   icon: '🛍️', color: '#6d4c41', gq: '寵物用品店' },
};
const DEFAULT_CENTER = CFG.DEFAULT_CENTER || [25.0336, 121.3893];
let MP = null;          // 目前使用的地圖轉接器（Google 或 OSM）
let gmFailed = false;   // Google Maps 載入或驗證失敗旗標
const mapState = {
  places: [], cats: new Set(['vet', 'er', 'grooming', 'care', 'restaurant', 'park']), q: '', radius: 'all', minRating: 0, openNow: false, sort: 'dist',
  selected: null, userLoc: null, loading: false, route: null, showFav: false, center: null, zoom: 14, error: '', searched: false,
};
const fmtKm = (km) => (km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`);
const fmtMin = (s) => { const m = Math.round(s / 60); return m >= 60 ? `${Math.floor(m / 60)} 小時 ${m % 60} 分` : `${m} 分鐘`; };
const gmapsDir = (lat, lng, mode) => `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=${mode}`;
function haversine(a, b) {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (b[0] - a[0]) * rad, dLng = (b[1] - a[1]) * rad;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}
const refPoint = () => mapState.userLoc || (MP ? MP.center() : DEFAULT_CENTER);
const pinHtml = (p, sel) => { const c = CATS[p.cat] || CATS.park; return `<div class="pin ${sel ? 'sel' : ''}" style="background:${c.color}"><span>${c.icon}</span></div>`; };

/* ---------- 營業時間判斷 ---------- */
function gOpenInfo(roh) {
  const p = roh?.periods; if (!p?.length) return { openNow: null, is24: false };
  const is24 = (p.length === 1 && !p[0].close) || (p.length === 7 && p.every((x) => x.open.hour === 0 && x.open.minute === 0 && x.close && ((x.close.hour === 23 && x.close.minute >= 59) || (x.close.hour === 0 && x.close.minute === 0))));
  if (is24) return { openNow: true, is24 };
  const n = new Date(); const W = 7 * 1440; const w = n.getDay() * 1440 + n.getHours() * 60 + n.getMinutes();
  const openNow = p.some((x) => {
    if (!x.close) return true;
    const o = x.open.day * 1440 + x.open.hour * 60 + x.open.minute; let c = x.close.day * 1440 + x.close.hour * 60 + x.close.minute;
    if (c <= o) c += W;
    return (w >= o && w < c) || (w + W >= o && w + W < c);
  });
  return { openNow, is24 };
}
function osmOpenNow(oh) {
  if (!oh) return null; if (/24\/7/.test(oh)) return true;
  const D = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']; const now = new Date(); const today = D[(now.getDay() + 6) % 7];
  const mins = now.getHours() * 60 + now.getMinutes(); let result = null;
  for (const raw of oh.split(';')) {
    const r = raw.trim(); if (!r || /^(PH|SH)/.test(r)) continue;
    const m = r.match(/^((?:Mo|Tu|We|Th|Fr|Sa|Su)(?:\s*[-,]\s*(?:Mo|Tu|We|Th|Fr|Sa|Su))*)?\s*(.*)$/); if (!m) continue;
    if (m[1]) {
      const set = new Set();
      m[1].replace(/\s/g, '').split(',').forEach((part) => { const [a, b] = part.split('-'); let i = D.indexOf(a); const j = D.indexOf(b || a); if (i < 0 || j < 0) return; for (let k = 0; k < 7; k++) { set.add(D[i]); if (i === j) break; i = (i + 1) % 7; } });
      if (!set.has(today)) continue;
    }
    if (/off|closed/i.test(m[2])) { result = false; continue; }
    const ranges = m[2].match(/\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}/g); if (!ranges) continue;
    result = ranges.some((rg) => { const [s, e] = rg.split('-').map((t) => { const [h, mm] = t.trim().split(':').map(Number); return h * 60 + mm; }); return e > s ? mins >= s && mins < e : mins >= s || mins < e; });
  }
  return result;
}

/* ---------- 共用：OSRM 路線（Google 失敗時的備援 / OSM 模式） ---------- */
async function osrmRoute(from, to, mode) {
  const server = { car: 'routed-car', foot: 'routed-foot', bike: 'routed-bike' }[mode];
  const url = `https://routing.openstreetmap.de/${server}/route/v1/driving/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson&steps=true`;
  const j = await (await fetch(url)).json();
  if (j.code !== 'Ok' || !j.routes?.length) throw new Error(j.message || '找不到可行路線');
  const r = j.routes[0];
  return { distance: r.distance, duration: r.duration, coords: r.geometry.coordinates.map(([lng, lat]) => [lat, lng]), steps: r.legs[0].steps.map((s) => ({ text: osrmStepText(s), dist: s.distance })), provider: 'OSRM' };
}
function osrmStepText(s) {
  const m = s.maneuver || {};
  const dir = { left: '左轉', right: '右轉', 'slight left': '稍向左', 'slight right': '稍向右', 'sharp left': '向左急轉', 'sharp right': '向右急轉', straight: '直行', uturn: '迴轉' }[m.modifier] || '繼續前進';
  const road = s.name ? `，進入${s.name}` : '';
  switch (m.type) {
    case 'depart': return `出發${s.name ? '，沿' + s.name + '前進' : ''}`;
    case 'arrive': return '抵達目的地';
    case 'roundabout': case 'rotary': return `進入圓環，從第 ${m.exit || 1} 個出口離開${road}`;
    case 'merge': return `併入${s.name || '道路'}`;
    case 'on ramp': return `${dir}駛入匝道${road}`;
    case 'off ramp': return `${dir}駛出匝道${road}`;
    case 'fork': return `於岔路${dir}${road}`;
    case 'end of road': return `道路盡頭${dir}${road}`;
    case 'new name': return `繼續沿${s.name || '道路'}前進`;
    default: return `${dir}${road}`;
  }
}
const ROUTE_COLOR = { car: '#1a73e8', foot: '#43a047', bike: '#fb8c00' };

/* ---------- 轉接器：Google Maps ---------- */
function loadGoogle(key) {
  return new Promise((resolve, reject) => {
    if (window.google?.maps?.importLibrary) return resolve();
    window.__gmReady = () => resolve();
    window.gm_authFailure = () => {
      gmFailed = true; toast('⚠️ Google Maps 金鑰驗證失敗，已改用 OpenStreetMap');
      if (currentRoute() === 'map') { MP = null; render(); }
    };
    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly&language=zh-TW&region=TW&loading=async&callback=__gmReady`;
    s.async = true; s.onerror = () => reject(new Error('無法載入 Google Maps 指令碼'));
    document.head.appendChild(s);
    setTimeout(() => reject(new Error('載入逾時')), 15000);
  });
}
const G_FIELDS = ['id', 'displayName', 'formattedAddress', 'location', 'rating', 'userRatingCount', 'regularOpeningHours', 'utcOffsetMinutes', 'nationalPhoneNumber', 'websiteURI', 'googleMapsURI', 'businessStatus', 'types', 'viewport'];
function guessCatG(types = [], name = '') {
  if (types.includes('veterinary_care') || /動物醫院|獸醫|動物診所/.test(name)) return 'vet';
  if (/美容|grooming/i.test(name)) return 'grooming';
  if (/旅館|住宿|安親|寄宿/.test(name)) return 'care';
  if (types.includes('pet_store') || /寵物用品/.test(name)) return 'petshop';
  if (types.includes('dog_park') || (types.includes('park') && /寵物|狗/.test(name))) return 'park';
  if ((types.includes('restaurant') || types.includes('cafe')) && /寵物|狗|毛孩/.test(name)) return 'restaurant';
  return null;
}
function normG(pl, cat) {
  const { openNow, is24 } = gOpenInfo(pl.regularOpeningHours);
  const wd = pl.regularOpeningHours?.weekdayDescriptions || [];
  const c = cat === 'vet' && is24 ? 'er' : cat;
  return {
    id: 'g:' + pl.id, src: 'google', cat: c, name: pl.displayName || '（未命名）', lat: pl.location.lat(), lng: pl.location.lng(),
    addr: (pl.formattedAddress || '').replace(/^\d{3,6}台灣/, '').replace(/^台灣/, ''), phone: pl.nationalPhoneNumber || '',
    rating: pl.rating ?? null, ratingCount: pl.userRatingCount || 0, openNow, is24,
    today: wd[(new Date().getDay() + 6) % 7] || '', hoursText: wd.join('\n'), website: pl.websiteURI || '', gmapsUrl: pl.googleMapsURI || '',
    closedPerm: pl.businessStatus === 'CLOSED_PERMANENTLY',
  };
}
const GoogleAdapter = {
  name: 'google',
  async init(el, center, zoom) {
    await loadGoogle(getKey());
    const { Map } = await google.maps.importLibrary('maps');
    const { AdvancedMarkerElement } = await google.maps.importLibrary('marker');
    const { Place } = await google.maps.importLibrary('places');
    this.lib = { AdvancedMarkerElement, Place };
    this.map = new Map(el, { center: { lat: center[0], lng: center[1] }, zoom, mapId: 'DEMO_MAP_ID', mapTypeControl: false, streetViewControl: false, fullscreenControl: false, clickableIcons: false, gestureHandling: 'greedy', zoomControl: true });
    this.markers = [];
    this.map.addListener('idle', () => { mapState.center = this.center(); mapState.zoom = this.map.getZoom(); });
    await new Promise((r) => { google.maps.event.addListenerOnce(this.map, 'idle', r); setTimeout(r, 3000); });
  },
  center() { const c = this.map.getCenter(); return [c.lat(), c.lng()]; },
  zoom() { return this.map.getZoom(); },
  bounds() { const b = this.map.getBounds(); if (!b) return null; const ne = b.getNorthEast(), sw = b.getSouthWest(); return { s: sw.lat(), w: sw.lng(), n: ne.lat(), e: ne.lng() }; },
  setView(ll, z) { this.map.setCenter({ lat: ll[0], lng: ll[1] }); if (z) this.map.setZoom(z); },
  fitBounds(b) { this.map.fitBounds({ south: b.s, west: b.w, north: b.n, east: b.e }); },
  setMarkers(places, selId, onClick) {
    this.markers.forEach((m) => { m.map = null; });
    this.markers = places.map((p) => {
      const d = document.createElement('div'); d.innerHTML = pinHtml(p, p.id === selId);
      const m = new this.lib.AdvancedMarkerElement({ map: this.map, position: { lat: p.lat, lng: p.lng }, content: d.firstChild, title: p.name, zIndex: p.id === selId ? 999 : 1 });
      m.addListener('click', () => onClick(p.id)); return m;
    });
  },
  setUser(ll) {
    if (this.userM) this.userM.map = null;
    const d = document.createElement('div'); d.className = 'user-dot';
    this.userM = new this.lib.AdvancedMarkerElement({ map: this.map, position: { lat: ll[0], lng: ll[1] }, content: d, title: '你的位置', zIndex: 1000 });
  },
  async search(cats, b) {
    const errs = []; const all = new Map();
    await Promise.all(cats.map(async (k) => {
      try {
        const { places } = await this.lib.Place.searchByText({ textQuery: CATS[k].gq, fields: G_FIELDS, locationRestriction: { north: b.n, south: b.s, east: b.e, west: b.w }, maxResultCount: 20, language: 'zh-TW', region: 'tw' });
        places.forEach((pl) => {
          const p = normG(pl, k); if (p.closedPerm) return;
          const ex = all.get(p.id);
          if (!ex || (p.cat === 'er' && ex.cat !== 'er')) all.set(p.id, p);
        });
      } catch (e) { console.warn('[Places]', k, e); errs.push(e); }
    }));
    if (errs.length === cats.length && cats.length) throw new Error('Places API 查詢失敗：' + (errs[0].message || errs[0]));
    return [...all.values()];
  },
  async textSearch(text) {
    const { places } = await this.lib.Place.searchByText({ textQuery: text, fields: G_FIELDS, locationBias: { lat: this.center()[0], lng: this.center()[1] }, maxResultCount: 20, language: 'zh-TW', region: 'tw' });
    const pets = places.map((pl) => ({ pl, cat: guessCatG(pl.types, pl.displayName) })).filter((x) => x.cat);
    if (pets.length) return { places: pets.map((x) => normG(x.pl, x.cat)) };
    if (!places.length) return null;
    const vp = places[0].viewport;
    if (vp) { const ne = vp.getNorthEast(), sw = vp.getSouthWest(); return { bounds: { s: sw.lat(), w: sw.lng(), n: ne.lat(), e: ne.lng() } }; }
    return { center: [places[0].location.lat(), places[0].location.lng()] };
  },
  async route(from, to, mode) {
    this.clearRoute();
    try {
      const { DirectionsService, DirectionsRenderer } = await google.maps.importLibrary('routes');
      const res = await new DirectionsService().route({ origin: { lat: from[0], lng: from[1] }, destination: { lat: to[0], lng: to[1] }, travelMode: { car: 'DRIVING', foot: 'WALKING', bike: 'BICYCLING' }[mode] });
      this.renderer = new DirectionsRenderer({ map: this.map, directions: res, suppressMarkers: true, polylineOptions: { strokeColor: ROUTE_COLOR[mode], strokeWeight: 6, strokeOpacity: 0.9 } });
      const leg = res.routes[0].legs[0];
      return { distance: leg.distance.value, duration: leg.duration.value, steps: leg.steps.map((s) => ({ text: s.instructions.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(), dist: s.distance.value })), provider: 'Google Directions' };
    } catch (e) {
      console.warn('[Directions] 改用 OSRM', e);
      const r = await osrmRoute(from, to, mode);
      this.poly = new google.maps.Polyline({ map: this.map, path: r.coords.map(([lat, lng]) => ({ lat, lng })), strokeColor: ROUTE_COLOR[mode], strokeWeight: 6, strokeOpacity: 0.9 });
      const bb = new google.maps.LatLngBounds(); r.coords.forEach(([lat, lng]) => bb.extend({ lat, lng })); this.map.fitBounds(bb, 60);
      r.provider = 'OSRM（Google Directions 未啟用時備援）'; return r;
    }
  },
  clearRoute() { if (this.renderer) { this.renderer.setMap(null); this.renderer = null; } if (this.poly) { this.poly.setMap(null); this.poly = null; } },
  destroy() { this.markers?.forEach((m) => { m.map = null; }); this.clearRoute(); },
};

/* ---------- 轉接器：OpenStreetMap（Leaflet + Overpass + Nominatim + OSRM） ---------- */
const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter'];
function classifyOsm(t) {
  const name = t.name || '';
  if (t.amenity === 'veterinary') return /24\/7/.test(t.opening_hours || '') || /急診|24/.test(name) ? 'er' : 'vet';
  if (t.shop === 'pet_grooming' || t.amenity === 'animal_grooming') return 'grooming';
  if (t.amenity === 'animal_boarding' || t.amenity === 'animal_shelter') return 'care';
  if (t.shop === 'pet') return /美容/.test(name) ? 'grooming' : 'petshop';
  if (t.leisure === 'dog_park') return 'park';
  if (t.dog || t.pets) return ['restaurant', 'cafe', 'fast_food', 'bar', 'ice_cream'].includes(t.amenity) ? 'restaurant' : 'park';
  return null;
}
function addrOsm(t) {
  if (t['addr:full']) return t['addr:full'];
  return [t['addr:city'], t['addr:district'], t['addr:suburb'], t['addr:street'] || t['addr:place'], t['addr:housenumber'] ? t['addr:housenumber'] + '號' : ''].filter(Boolean).join('');
}
const OsmAdapter = {
  name: 'osm',
  async init(el, center, zoom) {
    this.map = L.map(el, { zoomControl: false }).setView(center, zoom);
    L.control.zoom({ position: 'bottomright' }).addTo(this.map);
    const osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' });
    const esri = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: 'Tiles &copy; Esri' });
    // 以 file:// 開啟時沒有 Referer，OSM 官方圖磚會拒絕，改用 Esri 街道圖
    (location.protocol === 'file:' ? esri : osm).addTo(this.map);
    L.control.layers({ 'OpenStreetMap': osm, 'Esri 街道圖': esri }, null, { position: 'bottomright' }).addTo(this.map);
    L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(this.map);
    this.layer = L.layerGroup().addTo(this.map);
    this.map.on('moveend', () => { mapState.center = this.center(); mapState.zoom = this.map.getZoom(); });
  },
  center() { const c = this.map.getCenter(); return [c.lat, c.lng]; },
  zoom() { return this.map.getZoom(); },
  bounds() { const b = this.map.getBounds(); return { s: b.getSouth(), w: b.getWest(), n: b.getNorth(), e: b.getEast() }; },
  setView(ll, z) { this.map.setView(ll, z || this.map.getZoom()); },
  fitBounds(b) { this.map.fitBounds([[b.s, b.w], [b.n, b.e]], { maxZoom: 16 }); },
  setMarkers(places, selId, onClick) {
    this.layer.clearLayers();
    places.forEach((p) => {
      const sel = p.id === selId;
      L.marker([p.lat, p.lng], { icon: L.divIcon({ className: '', iconSize: sel ? [46, 46] : [36, 36], iconAnchor: sel ? [23, 46] : [18, 36], html: pinHtml(p, sel) }), zIndexOffset: sel ? 1000 : 0, title: p.name })
        .on('click', () => onClick(p.id)).addTo(this.layer);
    });
  },
  setUser(ll) {
    if (this.userM) this.userM.remove();
    this.userM = L.marker(ll, { icon: L.divIcon({ className: '', iconSize: [18, 18], iconAnchor: [9, 9], html: '<div class="user-dot"></div>' }), zIndexOffset: 2000 }).addTo(this.map).bindTooltip('你的位置');
  },
  async search(cats, b) {
    const bbox = [b.s, b.w, b.n, b.e].map((x) => x.toFixed(5)).join(',');
    const q = `[out:json][timeout:25];(
      nwr["amenity"~"^(veterinary|animal_boarding|animal_grooming)$"](${bbox});
      nwr["shop"~"^(pet|pet_grooming)$"](${bbox});
      nwr["leisure"="dog_park"](${bbox});
      nwr["dog"~"^(yes|leashed|outside|designated)$"]["name"](${bbox});
      nwr["pets"~"^(yes|leashed)$"]["name"](${bbox});
    );out center tags 600;`;
    let data = null, lastErr = null;
    for (const url of OVERPASS) {
      try {
        const res = await fetch(url, { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        data = await res.json(); break;
      } catch (err) { lastErr = err; }
    }
    if (!data) throw new Error('Overpass 查詢失敗（' + (lastErr?.message || '網路錯誤') + '）');
    const seen = new Set();
    return data.elements.map((el) => {
      const t = el.tags || {}; const cat = classifyOsm(t); if (!cat) return null;
      const lat = el.lat ?? el.center?.lat, lng = el.lon ?? el.center?.lon; if (lat == null) return null;
      const name = t['name:zh'] || t.name || `${CATS[cat].label}（未命名）`;
      const key = name + lat.toFixed(4) + lng.toFixed(4); if (seen.has(key)) return null; seen.add(key);
      return { id: `osm:${el.type}/${el.id}`, src: 'osm', cat, name, lat, lng, addr: addrOsm(t), phone: t.phone || t['contact:phone'] || '', rating: null, ratingCount: 0,
        openNow: osmOpenNow(t.opening_hours), is24: /24\/7/.test(t.opening_hours || ''), today: '', hoursText: t.opening_hours || '', website: t.website || t['contact:website'] || '', gmapsUrl: '' };
    }).filter(Boolean);
  },
  async textSearch(text) {
    const arr = await (await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=tw&accept-language=zh-TW&q=${encodeURIComponent(text)}`)).json();
    if (!arr.length) return null;
    const r = arr[0];
    if (r.boundingbox) { const [s, n, w, e] = r.boundingbox.map(Number); return { bounds: { s, w, n, e } }; }
    return { center: [+r.lat, +r.lon] };
  },
  async route(from, to, mode) {
    this.clearRoute();
    const r = await osrmRoute(from, to, mode);
    this.routeLayer = L.layerGroup([
      L.polyline(r.coords, { color: '#fff', weight: 10, opacity: 0.9 }),
      L.polyline(r.coords, { color: ROUTE_COLOR[mode], weight: 6, opacity: 0.95, dashArray: mode === 'foot' ? '2 9' : null }),
      L.circleMarker(from, { radius: 6, color: '#fff', weight: 2, fillColor: '#222', fillOpacity: 1 }).bindTooltip('起點'),
    ]).addTo(this.map);
    this.map.fitBounds(L.latLngBounds(r.coords), { padding: [60, 60] });
    return r;
  },
  async reverse(p) {
    const r = await (await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&accept-language=zh-TW&lat=${p.lat}&lon=${p.lng}`)).json();
    const a = r.address || {};
    return [a.city || a.county, a.suburb || a.town || a.city_district, a.road, a.house_number ? a.house_number + '號' : ''].filter(Boolean).join('') || r.display_name || '';
  },
  clearRoute() { if (this.routeLayer) { this.routeLayer.remove(); this.routeLayer = null; } },
  destroy() { this.map.remove(); },
};

/* ---------- 地圖頁面 ---------- */
VIEWS.map = () => `<div class="map-layout">
  <div class="map-panel">
    <div class="sec">
      <div class="row" style="gap:6px"><b>搜尋結果</b><span class="provider" id="map-provider"></span><span class="spacer"></span>
        <select class="select" id="map-sort" style="padding:4px 8px;font-size:13px"><option value="dist">依距離</option><option value="rating">依評價</option><option value="name">依名稱</option></select></div>
      <div class="filters">
        <select class="select" id="map-radius" title="距離"><option value="all">距離不限</option><option value="1">1 km 內</option><option value="3">3 km 內</option><option value="5">5 km 內</option><option value="10">10 km 內</option></select>
        <select class="select" id="map-rating" title="評價"><option value="0">評價不限</option><option value="3.5">★ 3.5 以上</option><option value="4">★ 4.0 以上</option><option value="4.5">★ 4.5 以上</option></select>
        <label class="select row" style="gap:4px;font-size:13px;cursor:pointer"><input type="checkbox" id="map-open"> 營業中</label>
      </div>
      <div class="small muted" id="map-count"></div>
    </div>
    <div class="place-list" id="map-list"></div>
  </div>
  <div class="map-wrap">
    <div id="map"></div>
    <div class="map-top">
      <div class="map-search">🔍<input id="map-q" placeholder="搜尋 龜山區／林口區 附近醫療與美容…" value="${esc(mapState.q)}" enterkeyhint="search"><button class="btn primary sm" data-act="map-go">搜尋</button></div>
      <div class="chips" id="map-chips"></div>
    </div>
    <button class="btn sm map-area-btn" data-act="map-search-area">🔄 搜尋此區域</button>
    <button class="map-loc-btn" data-act="map-locate" title="定位到目前位置">🎯</button>
    <div class="map-status" id="map-status" hidden></div>
    <div id="place-card"></div>
  </div>
</div>`;
actions['map-go'] = () => { const v = $('#map-q').value.trim(); if (v) textSearch(v); };

let mapMounting = false;
async function mountMap() {
  const el = $('#map'); const center = mapState.center || mapState.userLoc || DEFAULT_CENTER;
  const useG = !!getKey() && !gmFailed;
  let adapter = Object.create(useG ? GoogleAdapter : OsmAdapter);
  setStatus(useG ? '🗺️ 載入 Google Maps…' : '');
  mapMounting = true;
  try { await adapter.init(el, center, mapState.zoom); }
  catch (e) {
    if (!useG) { mapMounting = false; setStatus('地圖載入失敗：' + e.message); return; }
    gmFailed = true; toast('Google Maps 載入失敗，改用 OpenStreetMap：' + e.message);
    el.innerHTML = ''; adapter = Object.create(OsmAdapter); await adapter.init(el, center, mapState.zoom);
  }
  mapMounting = false;
  if (currentRoute() !== 'map' || !document.body.contains(el)) { try { adapter.destroy(); } catch (e) { /* ignore */ } return; }
  MP = adapter; setStatus('');
  bindMapInputs();
  if (mapState.userLoc) MP.setUser(mapState.userLoc);
  // 換了地圖供應商時，清掉另一來源的結果
  if (mapState.places.length && mapState.places[0].src !== MP.name) { mapState.places = []; mapState.selected = null; mapState.searched = false; }
  mapState.route = null;
  renderMapAll();
  if (!mapState.searched) {
    if (!mapState.userLoc && !mapState.center) await locateUser(false);
    searchArea();
  }
}
function bindMapInputs() {
  const q = $('#map-q');
  q.addEventListener('input', () => { mapState.q = q.value; renderMapList(); });
  q.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); actions['map-go'](); } });
  const bind = (id, k, fn) => { const el = $(id); el.value = String(mapState[k]); el.addEventListener('change', () => { mapState[k] = fn(el); renderMapList(); }); };
  bind('#map-sort', 'sort', (el) => el.value);
  bind('#map-radius', 'radius', (el) => el.value);
  bind('#map-rating', 'minRating', (el) => Number(el.value));
  const o = $('#map-open'); o.checked = mapState.openNow; o.addEventListener('change', () => { mapState.openNow = o.checked; renderMapList(); });
}
function setStatus(msg) { const s = $('#map-status'); if (!s) return; s.hidden = !msg; s.innerHTML = msg || ''; }
function toggleCat(k) {
  if (k === 'fav') mapState.showFav = !mapState.showFav;
  else {
    mapState.showFav = false;
    const had = mapState.cats.has(k); had ? mapState.cats.delete(k) : mapState.cats.add(k);
    // Google 模式下每個分類需要另外查詢 Places，新開啟的分類自動補查
    if (!had && MP?.name === 'google' && !mapState.places.some((p) => p.cat === k)) { searchArea(); return; }
  }
  renderMapAll();
}
function locateUser(fly) {
  return new Promise((resolve) => {
    if (!navigator.geolocation) { if (fly) toast('此瀏覽器不支援定位'); return resolve(); }
    setStatus('📍 取得目前位置中…');
    navigator.geolocation.getCurrentPosition((pos) => {
      mapState.userLoc = [pos.coords.latitude, pos.coords.longitude]; setStatus('');
      if (MP) { MP.setUser(mapState.userLoc); MP.setView(mapState.userLoc, 15); if (fly) searchArea(); }
      resolve();
    }, (err) => {
      setStatus('');
      if (fly) toast('無法取得定位：' + (err.code === 1 ? '權限被拒絕' : err.message) + '（請以 http://localhost 開啟並允許定位）');
      resolve();
    }, { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 });
  });
}
async function searchArea() {
  if (!MP) return;
  let b = MP.bounds(); if (!b) return;
  if (b.n - b.s > 0.12 || b.e - b.w > 0.12) { const [lat, lng] = MP.center(); b = { s: lat - 0.05, n: lat + 0.05, w: lng - 0.06, e: lng + 0.06 }; toast('範圍較大，僅查詢地圖中心附近約 5 公里'); }
  mapState.loading = true; mapState.error = ''; mapState.searched = true;
  setStatus(MP.name === 'google' ? '🔎 透過 Google Places 查詢中…' : '🔎 查詢 OpenStreetMap 地點中…'); renderMapList();
  const which = MP.name;
  try {
    const cats = MP.name === 'google' ? [...mapState.cats] : Object.keys(CATS);
    const res = await MP.search(cats, b);
    if (!MP || MP.name !== which) return;
    mapState.places = res;
    setStatus(`找到 ${res.length} 個地點`); setTimeout(() => setStatus(''), 2200);
  } catch (e) { mapState.error = e.message; setStatus(''); }
  mapState.loading = false;
  renderMapAll();
  if (/demo=route/.test(location.search) && !mapState._demoDone) { // 展示 / 截圖用：自動選取最近的動物醫院並規劃路線
    mapState._demoDone = true;
    const first = filteredPlaces().find((p) => ['vet', 'er'].includes(p.cat));
    if (first) { selectPlace(first.id, false); routeTo('car'); }
  }
  if (/demo=book/.test(location.search) && !mapState._demoBook) {
    mapState._demoBook = true;
    const first = filteredPlaces().find((p) => ['vet', 'er'].includes(p.cat));
    if (first) {
      selectPlace(first.id, false); openBooking(first);
      book.date = localDate(new Date(Date.now() + 864e5)); book.service = '疫苗施打';
      book.slot = slotsFor(first.id, book.date).slots.find((s) => s.avail)?.dt || null; renderBooking();
    }
  }
}
async function textSearch(text) {
  const local = mapState.places.filter((p) => p.name.includes(text));
  if (local.length) { selectPlace(local[0].id, true); return; }
  setStatus('🔎 搜尋中…');
  try {
    const r = await MP.textSearch(text);
    setStatus('');
    if (!r) { toast('找不到這個地點'); return; }
    if (r.places) {
      r.places.forEach((p) => { if (!mapState.places.some((x) => x.id === p.id)) mapState.places.push(p); mapState.cats.add(p.cat); });
      mapState.q = ''; $('#map-q').value = ''; mapState.showFav = false;
      selectPlace(r.places[0].id, true); return;
    }
    if (r.bounds) MP.fitBounds(r.bounds); else MP.setView(r.center, 15);
    mapState.q = ''; $('#map-q').value = '';
    setTimeout(searchArea, 400);
  } catch (e) { setStatus(''); toast('搜尋失敗：' + e.message); }
}
function filteredPlaces() {
  const ref = refPoint();
  let arr = mapState.showFav ? db.favorites.map((f) => ({ ...f })) : mapState.places.filter((p) => mapState.cats.has(p.cat));
  if (mapState.q) arr = arr.filter((p) => (p.name + p.addr).toLowerCase().includes(mapState.q.toLowerCase()));
  arr.forEach((p) => { p.dist = haversine(ref, [p.lat, p.lng]); });
  if (mapState.radius !== 'all') arr = arr.filter((p) => p.dist <= Number(mapState.radius));
  if (mapState.minRating) arr = arr.filter((p) => p.rating != null && p.rating >= mapState.minRating);
  if (mapState.openNow) arr = arr.filter((p) => p.openNow === true);
  const by = { dist: (a, b) => a.dist - b.dist, rating: (a, b) => (b.rating ?? -1) - (a.rating ?? -1) || a.dist - b.dist, name: (a, b) => a.name.localeCompare(b.name, 'zh-Hant') }[mapState.sort];
  return arr.sort(by);
}
function renderMapAll() { renderMapChips(); renderMapList(); renderPlaceCard(); }
function renderMapChips() {
  const el = $('#map-chips'); if (!el) return;
  const counts = {}; mapState.places.forEach((p) => { counts[p.cat] = (counts[p.cat] || 0) + 1; });
  el.innerHTML = Object.entries(CATS).map(([k, c]) => `<button class="chip ${!mapState.showFav && mapState.cats.has(k) ? 'on' : ''}" data-act="map-cat" data-id="${k}">${c.icon} ${c.label}${counts[k] ? `<span class="cnt">${counts[k]}</span>` : ''}</button>`).join('') +
    `<button class="chip ${mapState.showFav ? 'on' : ''}" data-act="map-cat" data-id="fav">⭐ 家庭收藏<span class="cnt">${db.favorites.length}</span></button>`;
  const pv = $('#map-provider');
  if (pv && MP) { pv.className = 'provider ' + (MP.name === 'google' ? 'g' : 'o'); pv.textContent = MP.name === 'google' ? 'Google Maps' : 'OpenStreetMap'; }
}
function renderMapList() {
  const list = $('#map-list'); if (!list) return;
  const arr = filteredPlaces();
  const cnt = $('#map-count');
  const noRatingHint = mapState.minRating && MP?.name === 'osm' ? '<div style="color:var(--danger)">OpenStreetMap 無評價資料，請設定 Google Maps API Key 以使用評價篩選。</div>' : '';
  cnt.innerHTML = mapState.loading ? '查詢中…' : mapState.error ? `<span style="color:var(--danger)">${esc(mapState.error)}</span> <button class="btn sm" data-act="map-search-area">重試</button>`
    : `${mapState.showFav ? '家庭收藏' : '此區域'} ${arr.length} 個地點・距離以${mapState.userLoc ? '你的位置' : '地圖中心'}計算${noRatingHint}`;
  list.innerHTML = arr.map((p) => {
    const c = CATS[p.cat] || CATS.park;
    return `<div class="place ${mapState.selected?.id === p.id ? 'sel' : ''}" data-act="map-select" data-id="${esc(p.id)}">
      <div class="pi" style="background:${c.color}1f">${c.icon}</div>
      <div style="flex:1;min-width:0"><div class="pn">${esc(p.name)}</div>
        <div class="small muted">${p.rating != null ? `<span class="stars">★ ${p.rating.toFixed(1)}</span> (${p.ratingCount})・` : ''}${c.label}${p.is24 ? '・24H' : ''}</div>
        ${p.addr ? `<div class="small muted" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(p.addr)}</div>` : ''}
        ${p.openNow === true ? '<span class="small" style="color:var(--primary-d)">● 營業中</span>' : p.openNow === false ? '<span class="small" style="color:var(--danger)">● 休息中</span>' : ''}</div>
      <div class="small muted" style="white-space:nowrap">${fmtKm(p.dist)}</div></div>`;
  }).join('') || (mapState.loading ? '' : '<div class="empty">此區域沒有符合條件的地點<br>試著移動地圖後按「搜尋此區域」，或調整篩選條件</div>');
  if (MP) MP.setMarkers(arr, mapState.selected?.id, (id) => selectPlace(id, false));
}
function selectPlace(id, fly) {
  const p = mapState.places.find((x) => x.id === id) || db.favorites.find((x) => x.id === id);
  if (!p) return;
  if (mapState.selected?.id !== p.id) clearRoute();
  mapState.selected = p;
  if (fly && MP) MP.setView([p.lat, p.lng], Math.max(MP.zoom(), 16));
  renderPlaceCard(); renderMapList();
  document.querySelector('.place.sel')?.scrollIntoView({ block: 'nearest' });
  if (!p.addr && !p._rev && MP?.reverse) { p._rev = true; MP.reverse(p).then((a) => { p.addr = a; p.addrApprox = true; if (mapState.selected?.id === p.id) renderPlaceCard(); }).catch(() => {}); }
}
function renderPlaceCard() {
  const el = $('#place-card'); if (!el) return;
  const p = mapState.selected; if (!p) { el.innerHTML = ''; return; }
  const c = CATS[p.cat] || CATS.park;
  const fav = db.favorites.some((f) => f.id === p.id);
  const r = mapState.route?.to === p.id ? mapState.route : null;
  const dist = haversine(refPoint(), [p.lat, p.lng]);
  const tags = [p.is24 && '<span class="tag red">24 小時</span>', p.openNow === true && '<span class="tag green">營業中</span>', p.openNow === false && '<span class="tag">休息中</span>', ['vet', 'er'].includes(p.cat) && '<span class="tag green">犬貓看診</span>', ['vet', 'er', 'grooming', 'care'].includes(p.cat) && '<span class="tag blue">可線上預約</span>'].filter(Boolean).join('');
  el.innerHTML = `<div class="place-card">
    <div class="row" style="align-items:flex-start;flex-wrap:nowrap">
      <div style="flex:1;min-width:0"><span class="tag" style="background:${c.color}1f;color:${c.color};border-color:transparent">${c.icon} ${c.label}</span>
        <h3 style="margin-top:6px">${esc(p.name)}</h3></div>
      ${p.rating != null ? `<span class="tag star" style="font-size:14px">★ ${p.rating.toFixed(1)} <span class="muted small">(${p.ratingCount})</span></span>` : ''}
      <button class="icon-btn" data-act="map-close" title="關閉">✕</button></div>
    <div class="small muted">📍 ${p.addr ? esc(p.addr) + (p.addrApprox ? '（約略）' : '') : '查詢地址中…'} ｜ 距離 ${fmtKm(dist)}</div>
    ${tags ? `<div class="row" style="gap:6px">${tags}</div>` : ''}
    <div class="kv">
      ${p.today || p.hoursText ? `<span>🕒</span><span>${esc(p.today || p.hoursText)}</span>` : ''}
      ${p.phone ? `<span>📞</span><span><a href="tel:${esc(p.phone)}">${esc(p.phone)}</a></span>` : ''}
      ${p.website ? `<span>🌐</span><span><a href="${esc(p.website)}" target="_blank" rel="noopener">${esc(p.website.replace(/^https?:\/\//, '').slice(0, 40))}</a></span>` : ''}
      ${p.rating == null && p.src === 'osm' ? '<span>ℹ️</span><span class="muted">評價資料需 Google Maps API</span>' : ''}
    </div>
    <div class="grid g2" style="gap:8px">
      <button class="btn outline" data-act="map-route" data-mode="car">🧭 開始導航</button>
      ${['vet', 'er', 'grooming', 'care'].includes(p.cat) ? '<button class="btn primary" data-act="map-book">📅 立即預約</button>' : `<a class="btn primary" target="_blank" rel="noopener" href="${p.gmapsUrl || gmapsDir(p.lat, p.lng, 'driving')}">🗺️ Google 地圖</a>`}
    </div>
    <div class="row" style="gap:6px">
      <button class="btn sm" data-act="map-fav">${fav ? '★ 已收藏' : '☆ 收藏'}</button>
      ${['vet', 'er', 'grooming', 'care'].includes(p.cat) ? '<button class="btn sm" data-act="map-record">📝 建立照護紀錄</button>' : ''}
      ${p.gmapsUrl ? `<a class="btn sm" target="_blank" rel="noopener" href="${esc(p.gmapsUrl)}">查看評論</a>` : ''}
    </div>
    ${r ? `<div class="route-box">
      <div class="row" style="gap:6px"><b class="small">路線規劃</b><span class="spacer"></span>
        ${[['car', '🚗'], ['foot', '🚶'], ['bike', '🚲']].map(([m, l]) => `<button class="btn sm ${r.mode === m ? 'primary' : ''}" data-act="map-route" data-mode="${m}">${l}</button>`).join('')}</div>
      ${r.loading ? '<div class="small muted" style="margin-top:6px">規劃路線中…</div>' : ''}
      ${r.error ? `<div class="small" style="color:var(--danger);margin-top:6px">${esc(r.error)}</div>` : ''}
      ${r.data ? `<div style="margin-top:6px"><b style="font-size:20px">${fmtMin(r.data.duration)}</b> <span class="muted">・${fmtKm(r.data.distance / 1000)}</span>
        <div class="small muted">${!mapState.userLoc ? '※ 未取得定位，起點為地圖中心（按 🎯 定位）・' : ''}資料來源：${esc(r.data.provider)}</div>
        <a class="btn sm primary" style="margin-top:6px" target="_blank" rel="noopener" href="${gmapsDir(p.lat, p.lng, { car: 'driving', foot: 'walking', bike: 'bicycling' }[r.mode])}">在 Google Maps 開始即時導航 →</a></div>
        <ol class="route-steps">${r.data.steps.map((s) => `<li>${esc(s.text)}${s.dist > 0 ? ` <span class="muted">${fmtKm(s.dist / 1000)}</span>` : ''}</li>`).join('')}</ol>` : ''}
    </div>` : ''}
  </div>`;
}
async function routeTo(mode) {
  const p = mapState.selected; if (!p || !MP) return;
  const from = refPoint();
  mapState.route = { mode, loading: true, to: p.id }; renderPlaceCard();
  try {
    const data = await MP.route(from, [p.lat, p.lng], mode);
    if (mapState.selected?.id !== p.id) return;
    mapState.route = { mode, data, to: p.id };
  } catch (err) { mapState.route = { mode, to: p.id, error: '路線規劃失敗：' + err.message }; }
  renderPlaceCard();
}
function clearRoute() { MP?.clearRoute(); mapState.route = null; }

/* =====================================================================
 * 啟動
 * ===================================================================== */
{ // 示範用：網址加上 ?as=m1 可直接以該成員登入（方便展示 / 截圖）
  const as = new URLSearchParams(location.search).get('as');
  if (as && db.family.members.some((m) => m.id === as)) setSession(as);
}
render();
checkReminders();
setInterval(checkReminders, 20000);
setInterval(() => { if (meId() && currentRoute() !== 'map') renderChrome(); }, 60000);
