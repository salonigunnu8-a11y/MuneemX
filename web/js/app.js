/* =========================================================
   MuneemX — app shell: boot, sign-in, navigation, live updates
   ========================================================= */
'use strict';
const MX_CONFIG = window.MX_CONFIG || {};
const FORCE_DEMO = new URLSearchParams(location.search).has('demo') || lsGet('mx_force_demo', false);
const API = (!FORCE_DEMO && MX_CONFIG.supabaseUrl && MX_CONFIG.supabaseAnonKey) ? CloudAPI : DemoAPI;


const NAV = [
  { k: 'platform', t: 'Clients', i: 'globe', roles: ['superadmin'] },
  { k: 'ideas', t: 'Growth roadmap', i: 'bulb', roles: ['superadmin'] },
  { k: 'dashboard', t: 'Dashboard', i: 'grid', roles: ['owner', 'manager'] },
  { k: 'pos', t: 'Scan & Sell', i: 'scan', roles: ['owner', 'manager', 'salesman'] },
  { k: 'bills', t: 'Bills', i: 'receipt', roles: ['owner', 'manager', 'salesman'] },
  { k: 'inventory', t: 'Inventory', i: 'box', roles: ['owner', 'manager'] },
  { k: 'expenses', t: 'Expenses', i: 'wallet', roles: ['owner', 'manager'] },
  { k: 'staff', t: 'Staff & Salary', i: 'users', roles: ['owner', 'manager'] },
  { k: 'reports', t: 'Reports', i: 'chart', roles: ['owner', 'manager'] },
  { k: 'settings', t: 'Settings', i: 'cog', roles: ['owner'] }];

function setBrand(c) { document.documentElement.style.setProperty('--brand', c || '#6d28d9'); const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = c || '#6d28d9'; }
function homeView() { return role() === 'superadmin' ? 'platform' : role() === 'salesman' ? 'pos' : 'dashboard'; }
function allowed(v) { return NAV.some(n => n.k === v && n.roles.includes(role())); }
function go(v, fromHash) { closeCamera(); closeModal(); if (!allowed(v)) v = homeView(); VIEW = v; SUB = {}; if (!fromHash) try { location.hash = v; } catch (e) { } render(); window.scrollTo(0, 0); }

async function boot() {
  $('#app').innerHTML = `<div class="boot"><div class="mark">MX</div><span class="spin dk"></span></div>`;
  let signedIn = false;
  try { signedIn = await API.init(); } catch (e) { console.error(e); toast(errText(e), 'bad'); }
  API.subscribe(() => { if (VIEW === 'dashboard' && !$('#modal').innerHTML) render(); });
  window.addEventListener('hashchange', () => { if (SES && !SES.onboarding) { const h = location.hash.slice(1); if (h && h !== VIEW) go(h, true); } });
  if (signedIn) afterSignIn(); else renderLogin();
  setInterval(tick, 4000);
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => { });
}
function afterSignIn() {
  if (SES.onboarding) return renderOnboarding();
  const h = location.hash.slice(1); VIEW = allowed(h) ? h : homeView();
  try { location.hash = VIEW; } catch (e) { }
  render();
}
async function logout() { await run(() => API.signOut()); CART = null; renderLogin(); }

/* ---------------- sign-in ---------------- */
let LOGIN = { ws: 't1', user: null, tab: 'staff', brand: null };
const ROLE_TXT = { owner: 'Owner / Contractor', manager: 'Shop manager', salesman: 'Salesman', superadmin: 'MuneemX platform' };
function heroHtml(b, subtitle) {
  return `<div class="hero">
  <div class="row"><div class="mark">${esc(b ? b.logo : 'MX')}</div><div><div class="b" style="font-size:17px">${esc(b ? b.name : 'MuneemX')}</div><div class="small" style="color:#aab0bb">${esc(subtitle)}</div></div></div>
  <h2>${b ? 'Every bottle scanned. Every rupee accounted.' : 'Run every liquor shop on one platform.'}</h2>
  <p>${b && b.tagline ? `<span>${esc(b.tagline)}.</span> ` : ''}<span>Scan-locked billing, live sales by the minute, stock, expenses and staff salary in one place.</span></p>
  <div class="feat"><div><b>Scan-locked sales</b>Only products matched in the database can be billed.</div><div><b>AI label scan</b>Photo of a bottle → matched to your catalog.</div><div><b>Live per-minute sales</b>Cash vs UPI, per shop, per salesman.</div><div><b>Tamper-evident bills</b>Each bill is chained to the previous one.</div></div>
  <div style="margin-top:auto;padding-top:24px" class="small"><span style="color:#8c93a0">Powered by</span> <b>MuneemX</b></div></div>`;
}
function renderLogin() { API.mode === 'demo' ? renderDemoLogin() : renderCloudLogin(); }

function renderDemoLogin() {
  const t = LOGIN.ws ? API.demoWorkspaces().find(x => x.id === LOGIN.ws) : null;
  setBrand(t ? t.color : '#0f766e');
  const users = API.demoUsers(t && t.id);
  if (!users.find(u => u.id === LOGIN.user)) LOGIN.user = users[0].id;
  $('#app').innerHTML = `<div class="login">${heroHtml(t, t ? t.slug + '.muneemx.app' : 'admin.muneemx.app')}
  <div class="form"><div class="tools">${toolsHtml()}</div><div class="box">
   <div class="demo-pill">${ic('cloud', 14)} Demo mode · data stays in this browser</div>
   <h2 style="margin:10px 0 4px">Sign in</h2><div class="mute" style="margin-bottom:18px">Every demo PIN is <b class="mono">1234</b></div>
   <label class="f">Workspace</label>
   <select id="lws">${API.demoWorkspaces().map(x => `<option value="${x.id}" ${x.id === LOGIN.ws ? 'selected' : ''}>${esc(x.name)} — ${esc(x.type)}</option>`).join('')}<option value="__p" ${!t ? 'selected' : ''}>MuneemX Platform (super admin)</option></select>
   <label class="f" style="margin-top:14px">Who's signing in?</label>
   <div class="users">${users.map(u => `<button class="urow ${u.id === LOGIN.user ? 'on' : ''}" data-u="${u.id}"><div class="av">${ini(u.name)}</div><div class="sp"><div class="b">${esc(u.name)}</div><div class="small mute">${ROLE_TXT[u.role]}${u.shopId ? ' · ' + esc(S.shops.find(s => s.id === u.shopId).name) : ''}</div></div></button>`).join('')}</div>
   <label class="f">PIN</label><input id="lpin" type="password" inputmode="numeric" maxlength="8" placeholder="••••" class="mono" style="font-size:18px;letter-spacing:.3em">
   <button class="btn p lg" style="width:100%;justify-content:center;margin-top:14px" id="lgo">${ic('lock')} Sign in</button>
   <div id="lerr" class="flash bad" style="display:none"></div>
  </div></div></div>`;
  wireTools(renderDemoLogin);
  $('#lws').onchange = e => { LOGIN.ws = e.target.value === '__p' ? null : e.target.value; LOGIN.user = null; renderDemoLogin(); };
  $$('.urow').forEach(b => b.onclick = () => { LOGIN.user = b.dataset.u; renderDemoLogin(); $('#lpin').focus(); });
  const doLogin = async () => { try { await API.signInDemo(LOGIN.user, $('#lpin').value); afterSignIn(); } catch (e) { $('#lerr').style.display = 'block'; $('#lerr').textContent = errText(e); } };
  $('#lgo').onclick = doLogin; $('#lpin').onkeydown = e => { if (e.key === 'Enter') doLogin(); };
}

async function renderCloudLogin() {
  const urlWs = new URLSearchParams(location.search).get('w');
  const slug = (urlWs || lsGet('mx_ws', '') || '').toLowerCase();
  if (slug && (!LOGIN.brand || LOGIN.brand.slug !== slug)) { try { LOGIN.brand = await API.workspaceBrand(slug); } catch (e) { LOGIN.brand = null; } }
  const b = LOGIN.brand && LOGIN.brand.slug === slug ? LOGIN.brand : null;
  setBrand(b ? b.color : '#0f766e');
  const T = LOGIN.tab;
  $('#app').innerHTML = `<div class="login">${heroHtml(b, b ? b.slug + '.muneemx.app' : 'Liquor Retail OS')}
  <div class="form"><div class="tools">${toolsHtml()}</div><div class="box">
   <div class="seg" style="width:100%;margin-bottom:18px"><button style="flex:1" class="${T === 'staff' ? 'on' : ''}" data-tab="staff">Staff PIN</button><button style="flex:1" class="${T === 'email' ? 'on' : ''}" data-tab="email">Owner / Admin</button><button style="flex:1" class="${T === 'signup' ? 'on' : ''}" data-tab="signup">New business</button></div>
   ${T === 'staff' ? `<h2 style="margin:0 0 4px">Counter sign-in</h2><div class="mute" style="margin-bottom:16px">Salesmen and managers sign in with their username and PIN.</div>
    <label class="f">Workspace code</label><input id="cws" value="${esc(slug)}" placeholder="e.g. royal-spirits" autocapitalize="off">
    <label class="f" style="margin-top:12px">Username</label><input id="cun" placeholder="e.g. ravi" autocapitalize="off">
    <label class="f" style="margin-top:12px">PIN</label><input id="cpin" type="password" inputmode="numeric" class="mono" style="font-size:18px;letter-spacing:.3em" placeholder="••••••">`
    : T === 'email' ? `<h2 style="margin:0 0 4px">Owner sign-in</h2><div class="mute" style="margin-bottom:16px">Owners and the MuneemX platform admin sign in with e-mail.</div>
    <label class="f">E-mail</label><input id="cem" type="email" autocomplete="email"><label class="f" style="margin-top:12px">Password</label><input id="cpw" type="password" autocomplete="current-password">`
    : `<h2 style="margin:0 0 4px">Create a business account</h2><div class="mute" style="margin-bottom:16px">Start your own MuneemX workspace. You'll set up your shop next.</div>
    <label class="f">E-mail</label><input id="sem" type="email" autocomplete="email"><label class="f" style="margin-top:12px">Password (min 6)</label><input id="spw" type="password" autocomplete="new-password">`}
   <button class="btn p lg" style="width:100%;justify-content:center;margin-top:16px" id="lgo">${ic('lock')} ${T === 'signup' ? 'Create account' : 'Sign in'}</button>
   <div id="lerr" class="flash bad" style="display:none"></div>
  </div></div></div>`;
  wireTools(renderCloudLogin);
  $$('[data-tab]').forEach(x => x.onclick = () => { LOGIN.tab = x.dataset.tab; renderCloudLogin(); });
  if ($('#cws')) $('#cws').onchange = async e => { const s = slugify(e.target.value); lsSet('mx_ws', s); LOGIN.brand = null; renderCloudLogin(); };
  const fail = e => { $('#lerr').style.display = 'block'; $('#lerr').textContent = errText(e); };
  const doIt = async () => {
    const btn = $('#lgo'); btn.disabled = true;
    try {
      if (T === 'staff') await API.signInStaff(slugify($('#cws').value), $('#cun').value.trim().toLowerCase(), $('#cpin').value);
      else if (T === 'email') await API.signInEmail($('#cem').value.trim(), $('#cpw').value);
      else await API.signUpOwner($('#sem').value.trim(), $('#spw').value);
      afterSignIn();
    } catch (e) { fail(e); btn.disabled = false; }
  };
  $('#lgo').onclick = doIt; $$('.box input').forEach(i => i.onkeydown = e => { if (e.key === 'Enter') doIt(); });
}

function renderOnboarding() {
  setBrand('#0f766e');
  $('#app').innerHTML = `<div class="login">${heroHtml(null, 'Set up your workspace')}<div class="form"><div class="tools">${toolsHtml()}</div><div class="box" style="max-width:460px">
   <h2 style="margin:0 0 4px">Set up your business</h2><div class="mute" style="margin-bottom:16px">Signed in as ${esc(S.me.email || S.me.name)}. This creates your branded workspace, first shop and owner profile.</div>
   <div class="grid g2"><div><label class="f">Business name</label><input id="on" placeholder="Maa Durga Wines"></div><div><label class="f">Workspace code</label><input id="osl" placeholder="maa-durga-wines" class="mono"></div>
   <div><label class="f">City</label><input id="oc"></div><div><label class="f">Type</label><select id="ot"><option>Individual shop</option><option>Contractor</option><option>Bar / wholesale</option></select></div>
   <div><label class="f">First shop name</label><input id="osh" placeholder="Main Road"></div><div><label class="f">Brand colour</label><input id="oco" type="color" value="#6d28d9" style="height:42px;padding:4px"></div>
   <div><label class="f">Your name</label><input id="oow"></div><div><label class="f">Your username</label><input id="oun" value="owner" class="mono"></div>
   <div><label class="f">Approval PIN (4–6 digits)</label><input id="opin" type="password" inputmode="numeric" class="mono"></div></div>
   <p class="small mute">The approval PIN is what you type when approving overrides, voids and salary payments.</p>
   <button class="btn p lg" style="width:100%;justify-content:center" id="ogo">Create workspace</button>
   <button class="btn" style="width:100%;justify-content:center;margin-top:8px" id="oout">Sign out</button>
   <div id="lerr" class="flash bad" style="display:none"></div></div></div></div>`;
  wireTools(renderOnboarding);
  $('#on').oninput = e => { if (!$('#osl').dataset.touched) $('#osl').value = slugify(e.target.value); };
  $('#osl').oninput = e => e.target.dataset.touched = 1;
  $('#oout').onclick = logout;
  $('#ogo').onclick = async () => {
    const f = { name: $('#on').value.trim(), slug: slugify($('#osl').value), city: $('#oc').value.trim(), type: $('#ot').value, shop: $('#osh').value.trim(), color: $('#oco').value, owner: $('#oow').value.trim() || 'Owner', username: slugify($('#oun').value) || 'owner', pin: $('#opin').value };
    if (!f.name || !f.slug) { $('#lerr').style.display = 'block'; $('#lerr').textContent = 'Business name and workspace code are required.'; return; }
    if (!/^\d{4,6}$/.test(f.pin)) { $('#lerr').style.display = 'block'; $('#lerr').textContent = 'Approval PIN must be 4–6 digits.'; return; }
    const r = await run(() => API.createWorkspace(f), $('#ogo')); if (r) { toast('Workspace created', 'ok'); afterSignIn(); }
  };
}

/* ---------------- shell ---------------- */
function render() {
  while (charts.length) charts.pop().destroy();
  SCAN_HANDLER = null; closeCamera();
  const t = SES.tenantId ? tenant() : null;
  setBrand(t ? t.color : '#0f766e');
  const nav = NAV.filter(n => n.roles.includes(role()));
  const title = (NAV.find(n => n.k === VIEW) || {}).t || '';
  const shops = t ? tShops() : [];
  $('#app').innerHTML = `${SES.imp ? `<div class="imp">${ic('shield', 16)} Platform admin viewing <b>${esc(t.name)}</b> as owner${API.mode === 'cloud' ? ' (read-only)' : ''}. Actions are logged. <span class="sp"></span><button class="btn sm" id="impx">Exit workspace</button></div>` : ''}
  ${API.mode === 'demo' ? `<div class="demo-bar">${ic('cloud', 14)} Demo mode — sample data in this browser. Connect Supabase to go live.</div>` : ''}
  <div class="shell"><aside class="side">
   <div class="logo"><div class="mark">${esc(t ? t.logo : 'MX')}</div><div><div class="n">${esc(t ? t.name : 'MuneemX')}</div><div class="t">${esc(t ? t.slug + '.muneemx.app' : 'Platform console')}</div></div></div>
   <nav class="nav">${nav.map(n => `<a href="#${n.k}" data-k="${n.k}" class="${n.k === VIEW ? 'on' : ''}">${ic(n.i)}<span>${n.t}</span></a>`).join('')}
    <a data-k="__out" href="#">${ic('out')}<span>Sign out</span></a></nav>
   <div class="foot">Powered by MuneemX</div>
  </aside><main>
   <div class="top"><h1>${title}</h1><span class="sp"></span>
    ${role() === 'owner' && shops.length > 1 ? `<select id="shopsel" style="width:auto">${['all', ...shops.map(s => s.id)].map(id => `<option value="${id}" ${SES.shop === id ? 'selected' : ''}>${id === 'all' ? 'All shops (' + shops.length + ')' : esc(shopById(id).name)}</option>`).join('')}</select>` : t && role() !== 'superadmin' && posShop() ? `<span class="chip">${esc(shopById(posShop()).name)}</span>` : ''}
    ${t ? (API.mode === 'demo' ? `<button class="chip" id="simbtn" title="Generates demo sales every few seconds"><span class="dot ${S.sim ? 'live' : ''}"></span>${S.sim ? 'Live demo on' : 'Live demo off'}</button>` : `<span class="chip"><span class="dot live"></span>Live</span>`) : ''}
    ${toolsHtml()}
    <span class="chip"><span class="av" style="width:22px;height:22px;font-size:10px">${ini(me().name)}</span>${esc(String(me().name).split(/[ @]/)[0])} · ${role()}</span>
   </div>
   <div class="content" id="view"></div>
  </main></div>`;
  $$('.nav a').forEach(a => a.onclick = e => { e.preventDefault(); a.dataset.k === '__out' ? logout() : go(a.dataset.k); });
  wireTools(render);
  if ($('#shopsel')) $('#shopsel').onchange = e => { SES.shop = e.target.value; saveSes(); CART = null; render(); };
  if ($('#simbtn')) $('#simbtn').onclick = () => { S.sim = !S.sim; API.save(); render(); toast(S.sim ? 'Live demo: sales will stream in from salesmen' : 'Live demo paused'); };
  if ($('#impx')) $('#impx').onclick = async () => { await run(() => API.exitWorkspace()); go('platform'); };
  try { (VIEWS[VIEW] || VIEWS.dashboard)(); } catch (e) { console.error(e); $('#view').innerHTML = `<div class="card flash bad">Something went wrong on this screen: ${esc(errText(e))}</div>`; }
  LASTSALES = S.sales.length;
}
function tick() {
  if (!SES || !SES.tenantId || API.mode !== 'demo') return;
  if (S.sim) API.simulateSale();
  if (S.sales.length !== LASTSALES && VIEW === 'dashboard' && !$('#modal').innerHTML) { LASTSALES = S.sales.length; render(); }
}

document.addEventListener('DOMContentLoaded', boot);
