/* =========================================================
   MuneemX — core: state, helpers, icons, dialogs, AI & barcode
   Classic script: everything here is shared by the other files.
   ========================================================= */
'use strict';

// ---- global state ----
let S = null;          // workspace data (same shape in demo and cloud mode)
let SES = null;        // { userId, tenantId, shop:'all'|shopId, imp:bool, admin:bool }
let VIEW = 'dashboard', SUB = {}, CART = null, LASTSALES = 0;
const charts = [];
const VIEWS = {};   // screen renderers, filled by views-*.js

const DAY = 864e5;
const BIZ = 5 * 36e5; // business day runs 05:00 → 05:00
const PACKS = ['Full', 'Half', 'Quarter', 'Pint', 'Can', 'Bottle', 'Nip'];
const PACK_ML = { Full: 750, Half: 375, Quarter: 180, Pint: 650, Can: 500, Bottle: 275, Nip: 90 };
const CATS = ['Whisky', 'Scotch', 'Rum', 'Vodka', 'Brandy', 'Gin', 'Beer', 'Wine', 'RTD'];
const ECATS = ['Rent', 'Electricity', 'Salary', 'Transport', 'Tea & snacks', 'Maintenance', 'Security', 'Licence & fees', 'Breakage', 'Police/Local', 'Other'];
const DEF_POL = { requireScan: true, override: true, mrpLock: true, stockLock: true, ageCheck: true, ageLimit: 21 };
const PLANS = [
  { k: 'Starter', p: 799, u: 'per shop / month', f: ['1 shop, up to 3 logins', 'Scan-locked billing, Cash + UPI', 'Stock, expenses, day close', 'Daily WhatsApp summary'] },
  { k: 'Pro', p: 1499, u: 'per shop / month', f: ['Everything in Starter', 'AI label scan & enrollment', 'Staff salary & commission', 'Live per-minute dashboard'] },
  { k: 'Contractor', p: 3999, u: 'per month, up to 5 shops', f: ['Everything in Pro', 'Multi-shop control room', 'Stock transfers between shops', '₹599 per extra shop'] },
  { k: 'White-label partner', p: null, u: 'custom', f: ['Your brand, your domain', 'Resell to your own clients', 'Revenue share', 'Partner console & support'] }];

// ---- icons ----
const ICON = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/>',
  scan: '<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 8v8M10.5 8v8M14 8v8M17 8v8"/>',
  box: '<path d="M21 8l-9-5-9 5v8l9 5 9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>',
  receipt: '<path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
  wallet: '<path d="M3 7h15a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H3z"/><path d="M3 7V6a2 2 0 0 1 2-2h11M16 14h2"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2 20c0-3.5 3-6 7-6s7 2.5 7 6M16 4.5a3.5 3.5 0 0 1 0 7M18 14c2.4.6 4 2.8 4 6"/>',
  chart: '<path d="M3 3v18h18M7 15v3M12 10v8M17 6v12"/>',
  cog: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.8.8 1 1.5 1 2.5h6c0-1 .2-1.7 1-2.5A6 6 0 0 0 12 3z"/>',
  out: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>',
  cam: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  cloud: '<path d="M7 18a5 5 0 1 1 1-9.9A6 6 0 0 1 19.5 10 4 4 0 0 1 18 18z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>'
};
const ic = (n, s) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" ${s ? `style="width:${s}px;height:${s}px"` : ''}>${ICON[n] || ''}</svg>`;

// ---- small helpers ----
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const inr = n => '₹' + Math.round(n || 0).toLocaleString('en-IN');
const inrK = n => { n = Math.round(n || 0); const a = Math.abs(n); if (a >= 1e7) return '₹' + (n / 1e7).toFixed(2) + ' Cr'; if (a >= 1e5) return '₹' + (n / 1e5).toFixed(2) + ' L'; return inr(n); };
const pad = n => String(n).padStart(2, '0');
const dk = ts => { const d = new Date(ts - BIZ); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
const sod = ts => { const d = new Date(ts - BIZ); d.setHours(0, 0, 0, 0); return d.getTime() + BIZ; };
const d0of = k => new Date(k + 'T00:00:00').getTime() + BIZ;
const tm = ts => { const d = new Date(ts); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
const dtm = ts => new Date(ts).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const ini = n => String(n || '?').split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
const sum = (a, f) => a.reduce((x, y) => x + f(y), 0);
const units = s => sum(s.items, i => i.qty);
const monthKey = () => { const d = new Date(Date.now() - BIZ); return d.getFullYear() + '-' + pad(d.getMonth() + 1); };
const monthStart = () => { const d = new Date(Date.now() - BIZ); return new Date(d.getFullYear(), d.getMonth(), 1).getTime() + BIZ; };
function fnv(s) { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16).padStart(8, '0'); }
function ean(b12) { let s = 0; for (let i = 0; i < 12; i++) s += (+b12[i]) * (i % 2 ? 3 : 1); return b12 + ((10 - s % 10) % 10); }
const cssVar = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim() || '#e5e7eb';
const slugify = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

function toast(msg, kind) { const t = document.createElement('div'); t.className = 'toast ' + (kind || ''); t.textContent = msg; $('#toasts').appendChild(t); setTimeout(() => t.remove(), 3600); }
let AC = null;
function beep(ok) { try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); const o = AC.createOscillator(), g = AC.createGain(); o.frequency.value = ok ? 1650 : 220; o.type = ok ? 'sine' : 'square'; g.gain.value = .06; o.connect(g); g.connect(AC.destination); o.start(); o.stop(AC.currentTime + (ok ? .09 : .25)); } catch (e) { } }
async function copyText(t) { try { await navigator.clipboard.writeText(t); toast('Copied to clipboard', 'ok'); } catch (e) { toast('Copy blocked by the browser', 'bad'); } }
function lsGet(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }

// Run an API call with a busy button and a friendly error toast.
async function run(fn, btn) {
  let html;
  if (btn) { html = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<span class="spin"></span>'; }
  try { return await fn(); }
  catch (e) { console.error(e); toast(errText(e), 'bad'); return undefined; }
  finally { if (btn && btn.isConnected) { btn.disabled = false; btn.innerHTML = html; } }
}
function errText(e) { const m = (e && (e.message || e.error_description || e.msg)) || String(e); return m.replace(/^.*?ERROR:\s*/, ''); }

// ---- accessors ----
const me = () => S.me;
const role = () => SES.imp ? 'owner' : (SES.admin ? 'superadmin' : S.me.role);
const tenant = () => S.tenants.find(t => t.id === SES.tenantId);
const pol = () => ({ ...DEF_POL, ...(tenant().pol || {}) });
const shopById = id => S.shops.find(s => s.id === id);
const userById = id => S.users.find(u => u.id === id);
const prodById = id => S.products.find(p => p.id === id);
const tShops = () => S.shops.filter(s => s.tenantId === SES.tenantId);
const tUsers = () => S.users.filter(u => u.tenantId === SES.tenantId);
const visibleProducts = () => S.products.filter(p => (!p.tenantId || p.tenantId === SES.tenantId) && p.active !== false);
const pname = p => p ? `${p.brand} ${p.name}`.trim() : '(deleted)';
const ppack = p => p ? `${p.pack} · ${p.sizeMl}ml` : '';
function scope() { if (role() === 'owner') return SES.shop && SES.shop !== 'all' ? [SES.shop] : tShops().map(s => s.id); return [S.me.shopId]; }
function posShop() { if (role() === 'owner') return SES.shop && SES.shop !== 'all' ? SES.shop : (tShops().length === 1 ? tShops()[0].id : null); return S.me.shopId; }
const stockOf = (shopId, pid) => (S.stock[shopId] || {})[pid] || 0;
const liveSales = (ids, from, to) => S.sales.filter(s => s.status !== 'void' && ids.includes(s.shopId) && s.ts >= from && (!to || s.ts < to));

// ---- dialogs ----
function modal(html, wide) { $('#modal').innerHTML = `<div class="modal-bg" id="mbg"><div class="modal ${wide ? 'w' : ''}">${html}</div></div>`; $('#mbg').onclick = e => { if (e.target.id === 'mbg') closeModal(); }; }
function closeModal() { $('#modal').innerHTML = ''; }

// Ask a manager / owner for their approval PIN. Resolves {user, pin} or null.
function askPin(reason, shopId) {
  return new Promise(res => {
    const appr = tUsers().filter(u => u.active !== false && (u.role === 'owner' || (u.role === 'manager' && (!shopId || u.shopId === shopId))));
    modal(`<h2>${ic('lock', 18)} Manager approval</h2><p class="mute" style="margin-top:0">${esc(reason)}</p>
    <label class="f">Approver</label><select id="apu">${appr.map(u => `<option value="${u.id}" ${S.me && u.id === S.me.id ? 'selected' : ''}>${esc(u.name)} (${u.role})</option>`).join('')}</select>
    <label class="f" style="margin-top:10px">Approval PIN</label><input id="appin" type="password" inputmode="numeric" class="mono" autocomplete="off">
    <div id="aperr" class="flash bad" style="display:none">Wrong PIN</div>
    <div class="row" style="margin-top:14px;justify-content:flex-end"><button class="btn" id="apc">Cancel</button><button class="btn p" id="apo">Approve</button></div>`);
    setTimeout(() => $('#appin') && $('#appin').focus(), 30);
    const ok = async () => {
      const u = userById($('#apu').value), pin = $('#appin').value;
      const good = await run(() => API.verifyApproval(shopId, u.id, pin), $('#apo'));
      if (good) { closeModal(); res({ user: u, pin: good === true ? pin : good }); } // cloud returns a one-time token else if ($('#aperr')) $('#aperr').style.display = 'block';
    };
    $('#apo').onclick = ok; $('#appin').onkeydown = e => { if (e.key === 'Enter') ok(); }; $('#apc').onclick = () => { closeModal(); res(null); };
  });
}
function pickShopModal() {
  modal(`<h2>Pick a counter</h2><p class="mute">Billing happens at one shop. Choose which shop you are selling from.</p><div class="grid">${tShops().map(s => `<button class="urow" data-s="${s.id}"><div class="av">${ini(s.name)}</div><div><div class="b">${esc(s.name)}</div><div class="small mute">${esc(s.address)}</div></div></button>`).join('')}</div>`);
  $$('#modal [data-s]').forEach(b => b.onclick = () => { SES.shop = b.dataset.s; saveSes(); closeModal(); render(); });
}

// ---- photos, barcodes, AI ----
function fileInput(cb) { const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.capture = 'environment'; i.onchange = () => { if (i.files[0]) cb(i.files[0]); }; i.click(); }
async function shrink(file) { try { const bmp = await createImageBitmap(file); const k = Math.min(1, 1100 / Math.max(bmp.width, bmp.height)); const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k); c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height); return await new Promise(r => c.toBlob(r, 'image/jpeg', .85)); } catch (e) { return file; } }
const blobToB64 = b => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(b); });
function parseJSON(t) { const m = String(t).match(/\{[\s\S]*\}/); if (!m) throw new Error('No JSON in AI reply'); return JSON.parse(m[0]); }
function loadScript(src) { return new Promise((res, rej) => { if (document.querySelector(`script[src="${src}"]`)) return res(); const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); }); }
async function decodeBarcode(file) {
  if ('BarcodeDetector' in window) { try { const bd = new BarcodeDetector(); const r = await bd.detect(await createImageBitmap(file)); if (r.length) return r[0].rawValue; } catch (e) { } }
  try { await loadScript('https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js'); const url = URL.createObjectURL(file); try { const rd = new ZXing.BrowserMultiFormatReader(); const res = await rd.decodeFromImageUrl(url); return res.getText(); } finally { URL.revokeObjectURL(url); } } catch (e) { return null; }
}
const catalogText = () => visibleProducts().map(p => `${p.id}|${pname(p)}|${p.pack} ${p.sizeMl}ml|${p.category}|${p.barcode}`).join('\n');
const AI_PROMPTS = {
  identify: cat => `You are the product recogniser in a liquor-shop billing system. Look at the photo of a bottle, can or carton. Read the brand, variant and pack size (ml) from the label, and any barcode digits if legible. Then choose the ONE matching product id from the catalog below, or null if nothing matches with confidence (brand AND size must match).
CATALOG (id|product|pack|category|barcode):
${cat}
Reply with only JSON: {"match_id":string|null,"brand":string,"variant":string,"size_ml":number|null,"category":string,"barcode":string|null,"confidence":number between 0 and 1,"note":"one short sentence"}`,
  enroll: () => `You are cataloguing a new product for an Indian liquor shop. From the photo of the bottle/can label, extract the fields. Use pack names: Full (750ml), Half (375ml), Quarter (180ml), Pint (650ml beer), Can, Bottle, Nip. Category is one of: ${CATS.join(', ')}.
Reply with only JSON: {"brand":string,"name":string (variant, e.g. "Deluxe Whisky"),"category":string,"pack":string,"size_ml":number,"mrp":number|null (only if printed on label),"barcode":string|null (only if digits are legible),"note":"one short sentence"}`
};
const aiIdentify = file => API.aiScan('identify', file, catalogText());
const aiEnroll = file => API.aiScan('enroll', file, '');
function barSvg(code) { let x = 0, out = ''; const s = String(code); for (let i = 0; i < s.length; i++) { const d = +s[i] || 0; for (let k = 0; k < 3; k++) { const w = ((d + k * 3 + i) % 3) + 1; if ((i + k) % 2 === 0) out += `<rect x="${x}" y="0" width="${w}" height="26"/>`; x += w + 1; } } return `<svg viewBox="0 0 ${x} 26" preserveAspectRatio="none" fill="currentColor">${out}</svg>`; }
function hashSale(s) { return fnv(s.prev + '|' + s.no + '|' + s.ts + '|' + s.total + '|' + s.mode + '|' + s.items.map(i => i.pid + 'x' + i.qty + '@' + i.price).join(',')); }
function saveSes() { try { sessionStorage.setItem('mx_ses_' + API.mode, JSON.stringify(SES)); } catch (e) { } }
function loadSes() { try { return JSON.parse(sessionStorage.getItem('mx_ses_' + API.mode)); } catch (e) { return null; } }

// ---- language & theme toggles (shown in the top bar and on the sign-in page) ----
const isDark = () => document.documentElement.dataset.theme === 'dark';
function toolsHtml() {
  return `<button class="tool" id="langbtn" title="${LANG.cur === 'hi' ? 'English' : 'हिन्दी'}">${LANG.cur === 'hi' ? 'EN' : 'हिं'}</button><button class="tool" id="themebtn" title="${isDark() ? t('Light mode') : t('Dark mode')}">${ic(isDark() ? 'sun' : 'moon')}</button>`;
}
function wireTools(rerender) {
  const lb = $('#langbtn'), tb = $('#themebtn');
  if (lb) lb.onclick = () => { setLang(LANG.cur === 'hi' ? 'en' : 'hi'); rerender(); };
  if (tb) tb.onclick = () => { const d = isDark() ? 'light' : 'dark'; document.documentElement.dataset.theme = d; try { localStorage.setItem('mx_theme', d); } catch (e) { } rerender(); };
}
