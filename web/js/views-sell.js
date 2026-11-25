/* =========================================================
   MuneemX — Dashboard, Scan & Sell (POS), receipts, Bills
   ========================================================= */
'use strict';

/* ---------- DASHBOARD ---------- */
VIEWS.dashboard = function () {
  const ids = scope(), now = Date.now(), t0 = sod(now), y0 = t0 - DAY;
  const td = liveSales(ids, t0), yd = liveSales(ids, y0, now - DAY);
  const rev = sum(td, s => s.total), yrev = sum(yd, s => s.total), gp = rev - sum(td, s => s.cost);
  const cash = sum(td, s => s.cash), upi = sum(td, s => s.upi);
  const udharT = sum(td, s => s.credit || 0), discT = sum(td, s => s.discount || 0), collT = sum((S.creditPayments || []).filter(p => p.ts >= t0 && ids.includes(p.shopId)), p => p.amount);
  const ex = sum(S.expenses.filter(e => ids.includes(e.shopId) && e.ts >= t0), e => e.amount);
  const u = sum(td, units), chg = yrev ? ((rev - yrev) / yrev * 100) : 0;
  const ovr = td.filter(s => s.items.some(i => i.m === 'ovr')).length;
  const voids = S.sales.filter(s => s.status === 'void' && ids.includes(s.shopId) && s.ts >= t0).length;
  const pm = {}; td.forEach(s => s.items.forEach(i => { pm[i.pid] = pm[i.pid] || { q: 0, r: 0 }; pm[i.pid].q += i.qty; pm[i.pid].r += i.qty * i.price; }));
  const top = Object.entries(pm).sort((a, b) => b[1].r - a[1].r).slice(0, 8);
  const sm = {}; td.forEach(s => { sm[s.userId] = sm[s.userId] || { b: 0, r: 0 }; sm[s.userId].b++; sm[s.userId].r += s.total; });
  const lead = Object.entries(sm).sort((a, b) => b[1].r - a[1].r);
  const low = []; ids.forEach(id => visibleProducts().forEach(p => { const q = stockOf(id, p.id); const th = p.pack === 'Quarter' || p.category === 'Beer' ? 24 : 6; if (q <= th) low.push({ id, p, q }); })); low.sort((a, b) => a.q - b.q);
  const feed = [...td].sort((a, b) => b.ts - a.ts).slice(0, 12);
  const packs = {}; td.forEach(s => s.items.forEach(i => { const p = prodById(i.pid); const k = p ? (p.category === 'Beer' ? 'Beer ' + p.pack : p.category === 'Wine' || p.category === 'RTD' ? p.category : p.pack) : '?'; packs[k] = (packs[k] || 0) + i.qty; }));
  const multi = ids.length > 1;
  $('#view').innerHTML = `
  <div class="grid g4">
   <div class="card kpi"><div class="l">Sales today</div><div class="v">${inr(rev)}</div><div class="s"><span class="${chg >= 0 ? 'up' : 'down'}">${chg >= 0 ? '▲' : '▼'} ${Math.abs(chg).toFixed(1)}%</span> vs same time yesterday</div></div>
   <div class="card kpi"><div class="l">Bills · Bottles</div><div class="v">${td.length} · ${u}</div><div class="s">Avg bill ${inr(td.length ? rev / td.length : 0)}</div></div>
   <div class="card kpi"><div class="l">Cash · UPI</div><div class="v" style="font-size:20px">${inrK(cash)} · ${inrK(upi)}</div><div class="s">${rev ? Math.round(upi / rev * 100) : 0}% digital${udharT ? ` · <span style="color:var(--warn)">${t('Udhar')} ${inr(udharT)}</span>` : ''}</div></div>
   <div class="card kpi"><div class="l">Gross margin − expenses</div><div class="v">${inr(gp - ex)}</div><div class="s">Margin ${inr(gp)} · expenses ${inr(ex)}</div></div>
  </div>
  <div class="card udharbar" id="udharbar" style="margin-top:14px"><div class="row wrap">${ic('book', 18)}<b>Udhar (credit) pending</b><span id="udp" class="b" style="font-size:20px;color:var(--warn)">…</span><span class="small mute" id="udn"></span><span class="sp"></span><span class="small">${t('Udhar given today')}: <b>${inr(udharT)}</b> · ${t('Collected today')}: <b>${inr(collT)}</b></span><button class="btn sm" id="goud">Open Udhar →</button></div></div>
  <div class="grid g21" style="margin-top:14px">
   <div class="card"><h3>Sales by hour <span class="sp"></span><span class="small mute">Today vs yesterday</span></h3><div class="chartbox"><canvas id="chH"></canvas></div></div>
   <div class="card"><h3><span class="dot live"></span> Last 60 minutes <span class="sp"></span><span class="small mute">₹ per minute</span></h3><div class="chartbox"><canvas id="chM"></canvas></div></div>
  </div>
  <div class="grid g3" style="margin-top:14px">
   <div class="card"><h3>Live bill feed<span class="sp"></span><span class="lock">${ic('lock', 14)} locked</span></h3><div class="feed">${feed.length ? feed.map((s, i) => `<div class="it ${i === 0 && s.ts > now - 6000 ? 'new' : ''}"><div class="mono small mute" style="width:42px">${tm(s.ts)}</div><div class="sp" style="min-width:0"><div class="b" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${s.items.map(i => esc(prodById(i.pid)?.brand) + (i.qty > 1 ? ' ×' + i.qty : '')).join(', ')}</div><div class="small mute">${esc(userById(s.userId)?.name)}${multi ? ' · ' + esc(shopById(s.shopId)?.name) : ''}</div></div><div style="text-align:right"><div class="b">${inr(s.total)}</div><span class="badge ${s.mode === 'UPI' ? 'br' : s.mode === 'Credit' ? 'warn' : ''}">${modeLabel(s.mode)}</span></div></div>`).join('') : '<div class="empty">No bills yet today</div>'}</div></div>
   <div class="card"><h3>Top products today</h3>${top.length ? `<table><tr><th>Product</th><th class="r">Qty</th><th class="r">Sales</th></tr>${top.map(([pid, v]) => { const p = prodById(pid); return `<tr><td><div class="b small">${esc(pname(p))}</div><div class="small mute">${ppack(p)}</div></td><td class="r">${v.q}</td><td class="r b">${inr(v.r)}</td></tr>`; }).join('')}</table>` : '<div class="empty">—</div>'}</div>
   <div class="card"><h3>Units by pack</h3><div class="chartbox sm"><canvas id="chP"></canvas></div>
    <h3 style="margin-top:14px">Control flags today</h3>
    <div class="sw"><span>Manual-override bills</span><span class="badge ${ovr ? 'warn' : 'ok'}">${ovr}</span></div>
    <div class="sw"><span>Voided bills</span><span class="badge ${voids ? 'warn' : 'ok'}">${voids}</span></div>
    <div class="sw"><span>Discounts given</span><span class="badge ${discT ? 'warn' : 'ok'}">${inr(discT)}</span></div>
    <div class="sw"><span>Low / out of stock SKUs</span><span class="badge ${low.length ? 'bad' : 'ok'}">${low.length}</span></div></div>
  </div>
  <div class="grid g3" style="margin-top:14px">
   <div class="card"><h3>Salesman leaderboard</h3>${lead.length ? `<table><tr><th>Salesman</th><th class="r">Bills</th><th class="r">Sales</th></tr>${lead.map(([id, v]) => `<tr><td><div class="b small">${esc(userById(id)?.name)}</div><div class="small mute">${esc(shopById(userById(id)?.shopId)?.name || '')}</div></td><td class="r">${v.b}</td><td class="r b">${inr(v.r)}</td></tr>`).join('')}</table>` : '<div class="empty">—</div>'}</div>
   <div class="card"><h3>${multi ? 'Shops today' : 'Last 7 days'}</h3>${multi ? `<table><tr><th>Shop</th><th class="r">Bills</th><th class="r">Cash</th><th class="r">UPI</th><th class="r">Total</th></tr>${ids.map(id => { const a = td.filter(s => s.shopId === id); return `<tr><td class="b">${esc(shopById(id).name)}</td><td class="r">${a.length}</td><td class="r">${inrK(sum(a, s => s.cash))}</td><td class="r">${inrK(sum(a, s => s.upi))}</td><td class="r b">${inrK(sum(a, s => s.total))}</td></tr>`; }).join('')}</table><div class="chartbox sm" style="margin-top:12px"><canvas id="chD"></canvas></div>` : `<div class="chartbox"><canvas id="chD"></canvas></div>`}</div>
   <div class="card"><h3>Reorder alerts<span class="sp"></span><a class="small" style="cursor:pointer;color:var(--brand)" id="goinv">Inventory →</a></h3>${low.length ? `<div class="tbl" style="max-height:300px;border:0"><table>${low.slice(0, 14).map(l => `<tr><td><div class="b small">${esc(pname(l.p))}</div><div class="small mute">${ppack(l.p)}${multi ? ' · ' + esc(shopById(l.id).name) : ''}</div></td><td class="r"><span class="badge ${l.q <= 0 ? 'bad' : 'warn'}">${l.q <= 0 ? 'Out' : l.q + ' left'}</span></td></tr>`).join('')}</table></div>` : '<div class="empty">All stocked up</div>'}</div>
  </div>`;
  $('#goinv').onclick = () => go('inventory');
  $('#goud').onclick = () => go('credit');
  API.creditSummary().then(rows => { const p = rows.filter(r => r.due > 0.5); if ($('#udp')) { $('#udp').textContent = inr(sum(p, r => r.due)); $('#udn').textContent = p.length + ' ' + t('customers'); } }, () => { if ($('#udp')) $('#udp').textContent = '—'; });
  if (!window.Chart) return;
  Chart.defaults.font.family = "'Plus Jakarta Sans',system-ui,sans-serif"; Chart.defaults.color = cssVar('--mute'); Chart.defaults.animation = false;
  const brand = getComputedStyle(document.documentElement).getPropertyValue('--brand').trim();
  const H = [...Array(15)].map((_, i) => i + 9);
  const hb = arr => H.map(h => sum(arr.filter(s => new Date(s.ts).getHours() === h), s => s.total));
  const yfull = liveSales(ids, y0, t0);
  charts.push(new Chart($('#chH'), { type: 'bar', data: { labels: H.map(h => pad(h) + ':00'), datasets: [{ label: t('Today'), data: hb(td), backgroundColor: brand, borderRadius: 4, order: 2 }, { label: t('Yesterday'), data: hb(yfull), type: 'line', borderColor: '#9aa1ad', borderDash: [4, 4], pointRadius: 0, tension: .3, order: 1 }] }, options: { maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 10 } }, tooltip: { callbacks: { label: c => c.dataset.label + ': ' + inr(c.raw) } } }, scales: { y: { ticks: { callback: v => inrK(v) }, grid: { color: cssVar('--grid') } }, x: { grid: { display: false } } } } }));
  const M = [...Array(60)].map((_, i) => now - (59 - i) * 6e4); const mm = M.map(t => sum(td.filter(s => s.ts > t - 6e4 && s.ts <= t), s => s.total));
  charts.push(new Chart($('#chM'), { type: 'bar', data: { labels: M.map(tm), datasets: [{ data: mm, backgroundColor: M.map((_, i) => i === 59 ? brand : brand + '99'), borderRadius: 2, barPercentage: 1, categoryPercentage: .85 }] }, options: { maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => inr(c.raw) } } }, scales: { y: { ticks: { callback: v => inrK(v) }, grid: { color: cssVar('--grid') } }, x: { ticks: { maxTicksLimit: 6 }, grid: { display: false } } } } }));
  const pk = Object.entries(packs).sort((a, b) => b[1] - a[1]);
  charts.push(new Chart($('#chP'), { type: 'bar', data: { labels: pk.map(x => t(x[0])), datasets: [{ data: pk.map(x => x[1]), backgroundColor: brand, borderRadius: 4 }] }, options: { indexAxis: 'y', maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { color: cssVar('--grid') } }, y: { grid: { display: false } } } } }));
  const D = [...Array(7)].map((_, i) => t0 - (6 - i) * DAY);
  charts.push(new Chart($('#chD'), { type: 'bar', data: { labels: D.map(d => new Date(d).toLocaleDateString('en-IN', { weekday: 'short' })), datasets: [{ label: t('Cash'), data: D.map(d => sum(liveSales(ids, d, d + DAY), s => s.cash)), backgroundColor: '#9aa1ad', borderRadius: 3 }, { label: t('UPI'), data: D.map(d => sum(liveSales(ids, d, d + DAY), s => s.upi)), backgroundColor: brand, borderRadius: 3 }] }, options: { maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 10 } }, tooltip: { callbacks: { label: c => c.dataset.label + ': ' + inr(c.raw) } } }, scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, ticks: { callback: v => inrK(v) }, grid: { color: cssVar('--grid') } } } } }));
};

/* ---------- SCAN & SELL ---------- */
VIEWS.pos = function () {
  const shopId = posShop();
  if (!shopId) { $('#view').innerHTML = `<div class="card empty"><p>Choose the shop counter you're billing from.</p><button class="btn p" id="pk">Pick shop</button></div>`; $('#pk').onclick = pickShopModal; pickShopModal(); return; }
  if (!CART || CART.shopId !== shopId) CART = { shopId, lines: [], mode: 'Cash', tender: '', split: '', upiOk: false, upiRef: '', approval: null, discType: '%', discVal: '', custName: '', custPhone: '', showCust: false };
  const P = pol(), mine = liveSales([shopId], sod(Date.now())).filter(s => s.userId === (S.me && S.me.id));
  const popular = visibleProducts().filter(p => p.tenantId === SES.tenantId || (p.w || 0) >= 1.5).sort((a, b) => (b.w || 0) - (a.w || 0)).slice(0, 12);
  $('#view').innerHTML = `<div class="pos">
  <div class="grid">
   <div class="card">
    <h3>${ic('scan', 18)} Scan product<span class="sp"></span>${P.requireScan ? `<span class="badge ok">${ic('lock', 12)} Scan-lock on</span>` : '<span class="badge warn">Scan-lock off</span>'}</h3>
    <div class="scan"><input id="scanin" placeholder="Scan or type barcode ⏎" autocomplete="off" inputmode="numeric"><button class="btn p" id="camlive" title="Live camera scanner">${ic('cam')} Camera</button><button class="btn" id="camb" title="Photo of barcode">Photo</button><button class="btn" id="aib">${ic('spark')} AI scan</button></div>
    <div id="flash"></div>
    <div class="small mute" style="margin-top:8px">USB / Bluetooth scanners work anywhere on this screen. <b>Camera</b> scans live with the phone or webcam. A new bottle barcode is linked to its product once, then it bills every time.</div>
   </div>
   <div class="card"><h3>Quick scan<span class="sp"></span><span class="small mute">${API.mode === 'demo' ? 'Tap a barcode to simulate a scan' : 'Top sellers — tap to add'}</span></h3>
    <div class="bars">${popular.map(p => `<button class="bc" data-bc="${p.barcode}"><div class="nm">${esc(p.brand)} · ${p.pack}</div>${barSvg(p.barcode)}<div class="cd">${p.barcode}</div></button>`).join('')}${API.mode === 'demo' ? `<button class="bc" data-bc="8901234567890"><div class="nm" style="color:var(--bad)">Unknown product</div>${barSvg('8901234567890')}<div class="cd">8901234567890</div></button>` : ''}</div>
   </div>
   <div class="card"><h3>${ic('search', 16)} Find without scanning<span class="sp"></span>${P.requireScan && P.override ? '<span class="small mute">Needs manager PIN</span>' : ''}</h3>
    <input id="msearch" placeholder="Search brand, e.g. Royal Stag quarter"><div id="mres"></div></div>
  </div>
  <div class="card cartcard">
   <h3>Current bill<span class="sp"></span><span class="small mute">${esc(shopById(shopId).name)} · ${esc(String(me().name).split(' ')[0])}</span></h3>
   <div id="cart"></div>
   <div class="small mute" style="margin-top:12px;display:flex;justify-content:space-between"><span>My bills today: <b>${mine.length}</b></span><span>My sales: <b>${inr(sum(mine, s => s.total))}</b></span></div>
  </div></div>`;
  const si = $('#scanin'); si.focus();
  si.onkeydown = e => { if (e.key === 'Enter' || e.key === 'NumpadEnter' || (e.key === 'Tab' && si.value.trim())) { e.preventDefault(); posScan(si.value); si.value = ''; } };
  autoSubmitBox(si, posScan);
  SCAN_HANDLER = code => posScan(code);
  $('#camlive').onclick = () => openCamera(code => posScan(code));
  $$('[data-bc]').forEach(b => b.onclick = () => { posScan(b.dataset.bc); si.focus(); });
  $('#camb').onclick = () => fileInput(async f => { flash('Reading barcode from photo…', 'info'); const code = await decodeBarcode(f); if (code) posScan(code); else flash('No barcode found in the photo. Try a sharper, closer shot — or use AI scan.', 'bad'); });
  $('#aib').onclick = () => fileInput(async f => {
    flash('<span class="spin dk"></span> AI is reading the label…', 'info');
    try {
      const r = await aiIdentify(f); const p = r.match_id && prodById(r.match_id);
      if (p && visibleProducts().includes(p) && (r.confidence || 0) >= .55) { addToCart(p, 'ai'); flash(`AI matched <b>${esc(pname(p))} ${ppack(p)}</b> (${Math.round((r.confidence || 0) * 100)}% sure). ${esc(r.note || '')}`, 'ok'); }
      else { beep(false); flash(`Sale locked — AI saw “${esc((r.brand || '?') + ' ' + (r.variant || ''))} ${r.size_ml ? r.size_ml + 'ml' : ''}” but it is not in your database${r.confidence ? ` (${Math.round(r.confidence * 100)}% sure)` : ''}. Enroll it in Inventory › Catalog.`, 'bad'); }
    } catch (e) { flash(esc(errText(e)), 'bad'); }
  });
  $('#msearch').oninput = e => {
    const q = e.target.value.toLowerCase().trim(); if (q.length < 2) { $('#mres').innerHTML = ''; return; }
    const words = q.split(/\s+/); const res = visibleProducts().filter(p => words.every(w => (pname(p) + ' ' + p.pack + ' ' + p.category + ' ' + p.sizeMl).toLowerCase().includes(w))).slice(0, 8);
    $('#mres').innerHTML = res.length ? `<table style="margin-top:8px">${res.map(p => `<tr><td><div class="b small">${esc(pname(p))}</div><div class="small mute">${ppack(p)} · stock ${stockOf(shopId, p.id)}</div></td><td class="r">${inr(p.mrp)}</td><td class="r"><button class="btn sm" data-add="${p.id}">${ic('plus')} Add</button></td></tr>`).join('')}</table>` : '<div class="small mute" style="padding:8px">No match</div>';
    $$('[data-add]').forEach(b => b.onclick = async () => {
      const p = prodById(b.dataset.add);
      if (P.requireScan) {
        if (!P.override) { flash('Scan-lock is on and overrides are disabled. Scan the product.', 'bad'); return; }
        const ap = await askPin(`Add “${pname(p)} ${ppack(p)}” without scanning. This line will be flagged on the bill and in reports.`, shopId); if (!ap) return;
        CART.approval = { approverId: ap.user.id, pin: ap.pin }; API.audit('Manual add approved', `${pname(p)} ${p.pack} by ${ap.user.name}`).catch(() => { }); addToCart(p, 'ovr');
      } else addToCart(p, 'man');
    });
  };
  renderCart();
};
function flash(html, k) { const f = $('#flash'); if (f) f.innerHTML = `<div class="flash ${k}">${html}</div>`; }
function posScan(code) {
  code = normCode(code); if (!code) return;
  const p = findByBarcode(code);
  if (!p) {
    beep(false);
    flash(`${ic('lock', 14)} Sale locked — barcode <span class="mono">${esc(code)}</span> is not in your product database. <button class="btn sm" id="linkit" style="margin-left:6px">Link to a product</button>`, 'bad');
    const b = $('#linkit'); if (b) b.onclick = () => linkBarcodeModal(code, p => { addToCart(p, 'scan'); const si = $('#scanin'); if (si) si.focus(); });
    API.audit('Unknown barcode scanned', code).catch(() => { }); return;
  }
  addToCart(p, 'scan');
}
function addToCart(p, m) {
  const P = pol(), stock = stockOf(CART.shopId, p.id), inCart = sum(CART.lines.filter(l => l.pid === p.id), l => l.qty);
  if (P.stockLock && inCart + 1 > stock) { beep(false); flash(`Stock lock — only ${stock} of ${esc(pname(p))} ${p.pack} in stock at this shop.`, 'bad'); return; }
  const l = CART.lines.find(l => l.pid === p.id && l.m === m); if (l) l.qty++; else CART.lines.unshift({ pid: p.id, qty: 1, price: p.mrp, cost: p.cost, m });
  beep(true); if (m === 'scan') flash(`✓ ${esc(pname(p))} · ${ppack(p)} · ${inr(p.mrp)}`, 'ok'); renderCart();
}
function cartCalc() {
  const gross = sum(CART.lines, l => l.qty * l.price);
  const dv = Math.max(0, +CART.discVal || 0);
  const disc = CART.discType === '%' ? Math.round(gross * Math.min(dv, 100) / 100) : Math.round(dv);
  const net = gross - disc, discOk = disc === 0 || disc < gross;
  const tender = +CART.tender || 0, splitCash = Math.min(+CART.split || 0, net);
  const phone = normPhone(CART.custPhone), name = (CART.custName || '').trim();
  let why = '';
  if (!CART.lines.length) why = 'Scan a bottle to start the bill';
  else if (!discOk) why = 'Discount must be less than the bill total';
  else if (CART.mode === 'Cash' && CART.tender && tender < net) why = 'Cash received is less than the total';
  else if ((CART.mode === 'UPI' || CART.mode === 'Split') && !CART.upiOk) why = 'Tick “Payment received on phone”';
  else if (CART.mode === 'Credit' && (!name || phone.length !== 10)) why = 'Udhar needs the customer name and a 10-digit mobile number';
  return { gross, disc, net, tender, splitCash, phone, name, ready: !why, why };
}
function renderCart() {
  const c = $('#cart'); if (!c) return; const P = pol();
  const qty = sum(CART.lines, l => l.qty), K = cartCalc();
  const mb = { scan: '<span class="badge ok">Scanned</span>', ai: '<span class="badge br">AI</span>', ovr: '<span class="badge warn">Override</span>', man: '<span class="badge">Manual</span>' };
  const credit = CART.mode === 'Credit', showCust = CART.showCust || credit;
  c.innerHTML = `${CART.lines.length ? CART.lines.map((l, i) => { const p = prodById(l.pid); return `<div class="cartline"><div style="min-width:0"><div class="b" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(pname(p))}</div><div class="small mute">${ppack(p)} · MRP ${inr(l.price)} ${mb[l.m]}</div></div><div class="qty"><button data-q="${i}" data-d="-1">−</button><span>${l.qty}</span><button data-q="${i}" data-d="1">+</button></div><div class="b" style="min-width:64px;text-align:right">${inr(l.qty * l.price)}</div></div>`; }).join('') : `<div class="empty">${ic('scan', 28)}<div>Scan a bottle to start the bill</div></div>`}
  <div class="row" style="margin:14px 0 2px"><span class="mute">${qty} item${qty === 1 ? '' : 's'}</span><span class="sp"></span><span class="mute small" id="cgross" style="text-decoration:line-through;${K.disc ? '' : 'display:none'}">${inr(K.gross)}</span><span class="total" id="cnet">${inr(K.net)}</span></div>
  ${P.mrpLock ? `<div class="small mute" style="margin-bottom:10px">${ic('lock', 12)} Prices locked at MRP</div>` : ''}
  <div class="opt"><div class="row"><span class="b small">Discount</span><span class="small mute">(optional)</span><span class="sp"></span>
    <div class="seg sm">${['%', '₹'].map(x => `<button class="${CART.discType === x ? 'on' : ''}" data-dt="${x}">${x}</button>`).join('')}</div>
    <input id="discv" type="number" inputmode="decimal" min="0" value="${esc(CART.discVal)}" placeholder="0" style="width:90px;text-align:right"></div>
    <div class="small" id="cdisc" style="margin-top:4px;${K.disc ? '' : 'display:none'}"><span class="${K.disc < K.gross ? 'up' : 'down'}">− ${inr(K.disc)}</span> <span class="mute"><span>off</span> ${inr(K.gross)}</span></div></div>
  <div class="opt">${showCust ? `<div class="row"><span class="b small">Customer</span><span class="small mute">${credit ? '' : '(optional)'}</span>${credit ? '<span class="badge warn">Required for Udhar</span>' : ''}<span class="sp"></span>${credit ? '' : '<button class="btn sm" id="custx">Hide</button>'}</div>
    <div class="row" style="margin-top:6px"><input id="cname" placeholder="Customer name" value="${esc(CART.custName)}" autocomplete="off"><input id="cphone" placeholder="Mobile number" inputmode="tel" value="${esc(CART.custPhone)}" autocomplete="off" maxlength="14" style="max-width:150px"></div>`
    : `<button class="btn sm" id="custadd">${ic('plus')} Add customer name &amp; mobile</button>`}</div>
  <div class="seg" style="width:100%;margin:10px 0">${['Cash', 'UPI', 'Split', 'Credit'].map(m => `<button style="flex:1" class="${CART.mode === m ? 'on' : ''}" data-mode="${m}">${modeLabel(m)}</button>`).join('')}</div>
  ${CART.mode === 'Cash' ? `<div class="row"><div class="sp"><label class="f">Cash received</label><input id="tender" type="number" inputmode="numeric" value="${esc(CART.tender)}" placeholder="${K.net}"></div><div class="sp"><label class="f">Return change</label><div class="b" style="font-size:20px;padding:6px 0" id="chg">${K.tender >= K.net && K.tender ? inr(K.tender - K.net) : '—'}</div></div></div>` :
    credit ? `<div class="flash info" style="margin:0">${ic('book', 14)} <span>Full bill amount goes to the customer's udhar (credit). It shows under Udhar until it is paid.</span></div>` :
    `${CART.mode === 'Split' ? `<label class="f">Cash part</label><input id="splitc" type="number" inputmode="numeric" value="${esc(CART.split)}" placeholder="0"><div class="small mute" style="margin:4px 0 8px">UPI part: <b>${inr(K.net - K.splitCash)}</b></div>` : ''}
   <div class="row" style="align-items:flex-start;gap:14px"><div id="qr" style="width:120px;height:120px;flex:none;background:#fff;border-radius:8px"></div><div class="sp"><div class="small mute">Customer scans to pay</div><div class="b" style="font-size:18px">${inr(CART.mode === 'Split' ? K.net - K.splitCash : K.net)}</div><div class="small mono mute">${esc(shopById(CART.shopId).upi || 'Set the UPI ID in Settings')}</div><input id="upiref" placeholder="UTR / ref no. (optional)" value="${esc(CART.upiRef)}" style="margin-top:8px"><label class="row small" style="margin-top:8px;font-weight:600"><input type="checkbox" id="upiok" style="width:auto" ${CART.upiOk ? 'checked' : ''}> Payment received on phone</label></div></div>`}
  <button class="btn p lg" id="pay" style="width:100%;justify-content:center;margin-top:12px" ${K.ready ? '' : 'disabled'}>${ic('lock')} <span id="paytxt">${credit ? 'Lock as Udhar' : 'Confirm & lock bill'} · ${inr(K.net)}</span></button>
  <div class="small mute" id="paywhy" style="margin-top:6px;text-align:center">${CART.lines.length && !K.ready ? esc(K.why) : ''}</div>
  ${CART.lines.length ? '<button class="btn sm" id="clr" style="margin-top:8px">Clear bill</button>' : ''}`;
  // light refresh while typing (keeps the cursor in the box)
  const refresh = () => {
    const k = cartCalc(); $('#cnet').textContent = inr(k.net);
    $('#cgross').style.display = k.disc ? '' : 'none'; $('#cgross').textContent = inr(k.gross);
    const cd = $('#cdisc'); cd.style.display = k.disc ? '' : 'none'; cd.innerHTML = `<span class="${k.disc < k.gross ? 'up' : 'down'}">− ${inr(k.disc)}</span> <span class="mute">${t('off')} ${inr(k.gross)}</span>`;
    if ($('#chg')) $('#chg').textContent = k.tender >= k.net && k.tender ? inr(k.tender - k.net) : '—';
    $('#pay').disabled = !k.ready; $('#paytxt').textContent = t(CART.mode === 'Credit' ? 'Lock as Udhar' : 'Confirm & lock bill') + ' · ' + inr(k.net);
    $('#paywhy').textContent = CART.lines.length && !k.ready ? t(k.why) : '';
  };
  $$('[data-q]').forEach(b => b.onclick = () => {
    const l = CART.lines[+b.dataset.q]; const d = +b.dataset.d;
    if (d > 0 && P.stockLock && sum(CART.lines.filter(x => x.pid === l.pid), x => x.qty) + 1 > stockOf(CART.shopId, l.pid)) { beep(false); flash('Stock lock — not enough stock', 'bad'); return; }
    l.qty += d; if (l.qty <= 0) CART.lines.splice(+b.dataset.q, 1); renderCart();
  });
  $$('[data-mode]').forEach(b => b.onclick = () => { CART.mode = b.dataset.mode; CART.upiOk = false; renderCart(); });
  $$('[data-dt]').forEach(b => b.onclick = () => { CART.discType = b.dataset.dt; renderCart(); });
  $('#discv').oninput = e => { CART.discVal = e.target.value; refresh(); };
  $('#discv').onchange = () => renderCart();
  if ($('#custadd')) $('#custadd').onclick = () => { CART.showCust = true; renderCart(); $('#cname').focus(); };
  if ($('#custx')) $('#custx').onclick = () => { CART.showCust = false; CART.custName = ''; CART.custPhone = ''; renderCart(); };
  if ($('#cname')) $('#cname').oninput = e => { CART.custName = e.target.value; refresh(); };
  if ($('#cphone')) {
    $('#cphone').oninput = e => { CART.custPhone = e.target.value; refresh(); };
    $('#cphone').onchange = () => { const c = (S.customers || []).find(x => x.phone === normPhone(CART.custPhone)); if (c && !CART.custName) { CART.custName = c.name; renderCart(); } };
  }
  if ($('#tender')) $('#tender').oninput = e => { CART.tender = e.target.value; refresh(); };
  if ($('#splitc')) $('#splitc').onchange = e => { CART.split = e.target.value; renderCart(); };
  if ($('#upiref')) $('#upiref').oninput = e => { CART.upiRef = e.target.value; };
  if ($('#upiok')) $('#upiok').onchange = e => { CART.upiOk = e.target.checked; refresh(); };
  if ($('#clr')) $('#clr').onclick = () => { CART = null; VIEWS.pos(); };
  if ($('#qr') && window.QRCode && K.net > 0 && shopById(CART.shopId).upi) {
    const sh = shopById(CART.shopId); const amt = CART.mode === 'Split' ? K.net - K.splitCash : K.net;
    try { new QRCode($('#qr'), { text: `upi://pay?pa=${encodeURIComponent(sh.upi)}&pn=${encodeURIComponent(tenant().name + ' ' + sh.name)}&am=${amt.toFixed(2)}&cu=INR&tn=${encodeURIComponent('Bill ' + sh.code + '-' + String(sh.seq + 1).padStart(5, '0'))}`, width: 120, height: 120, correctLevel: QRCode.CorrectLevel.M }); } catch (e) { }
  }
  $('#pay').onclick = async () => {
    const k = cartCalc(); if (!k.ready) return;
    if (CART.mode === 'Split' && (k.splitCash <= 0 || k.splitCash >= k.net)) { flash('For split, enter a cash part between ₹1 and the bill total.', 'bad'); return; }
    const pay = { mode: CART.mode, cash: CART.mode === 'Split' ? k.splitCash : 0, upiRef: CART.upiRef, discount: k.disc, custName: k.name, custPhone: k.phone };
    const sale = await run(() => API.lockSale(CART.shopId, CART.lines.map(l => ({ pid: l.pid, qty: l.qty, m: l.m })), pay, CART.approval), $('#pay'));
    if (!sale) return;
    CART = null;
    showReceipt(sale, true);
  };
}

/* ---------- receipts, WhatsApp & voids ---------- */
const custOf = s => s && s.customerId ? (S.customers || []).find(c => c.id === s.customerId) : null;
function receiptText(s) {
  const sh = shopById(s.shopId), tn = tenant(), cu = custOf(s), gross = s.gross || s.total;
  return [`*${tn.name}* — ${sh.name}`, `Bill ${s.no} · ${dtm(s.ts)}`, cu && cu.name ? `Customer: ${cu.name}` : '', '----------------------',
  ...s.items.map(i => { const p = prodById(i.pid); return `${pname(p)} ${p?.pack || ''} × ${i.qty} = ₹${i.qty * i.price}`; }), '----------------------',
  s.discount ? `Subtotal ₹${gross}\nDiscount −₹${s.discount}` : '', `*Total ₹${s.total}*`,
  s.mode === 'Credit' ? `Udhar (credit) — ₹${s.total} due` : `Paid: ${s.mode}${s.cash && s.upi ? ` (Cash ₹${s.cash} + UPI ₹${s.upi})` : ''}`,
  `Lock ${s.hash}`, tn.footer].filter(Boolean).join('\n');
}
function showReceipt(s, fresh) {
  const sh = shopById(s.shopId), tn = tenant(), cu = custOf(s), gross = s.gross || s.total;
  modal(`${fresh ? `<div class="flash ok" style="margin:0 0 12px">${ic('lock', 14)} Bill ${s.no} locked. Stock updated.</div>` : ''}
  <div class="receipt"><div class="c b">${esc(tn.name.toUpperCase())}</div><div class="c">${esc(sh.name)} · ${esc(sh.address)}</div><div class="c">Licence ${esc(sh.license)}</div><hr>
  <div>Bill <b>${s.no}</b> <span style="float:right">${dtm(s.ts)}</span></div><div>Salesman: ${esc(userById(s.userId)?.name)}</div>${cu ? `<div>Customer: ${esc(cu.name)}${cu.phone ? ' · ' + esc(cu.phone) : ''}</div>` : ''}<hr>
  ${s.items.map(i => { const p = prodById(i.pid); return `<div>${esc(pname(p))} ${esc(p?.pack || '')} ${i.m === 'ovr' ? '[OVR]' : i.m === 'ai' ? '[AI]' : ''}</div><div style="display:flex;justify-content:space-between;padding-left:10px"><span>${i.qty} × ${i.price}</span><span>${i.qty * i.price}</span></div>`; }).join('')}<hr>
  ${s.discount ? `<div style="display:flex;justify-content:space-between"><span>Subtotal</span><span>${inr(gross)}</span></div><div style="display:flex;justify-content:space-between"><span>Discount</span><span>− ${inr(s.discount)}</span></div>` : ''}
  <div style="display:flex;justify-content:space-between;font-size:15px" class="b"><span>TOTAL</span><span>${inr(s.total)}</span></div>
  ${s.mode === 'Credit' ? `<div class="b" style="color:var(--warn)">UDHAR (credit) — ${inr(s.total)} due</div>` : `<div>Paid: ${modeLabel(s.mode)}${s.cash && s.upi ? ` (Cash ${inr(s.cash)} + UPI ${inr(s.upi)})` : ''}${s.upiRef ? ' · Ref ' + esc(s.upiRef) : ''}</div>`}<hr>
  <div class="small">🔒 ${s.hash} ← ${s.prev}</div>${s.status === 'void' ? `<div class="b" style="color:var(--bad)">VOID — ${esc(s.voidReason)} (${esc(userById(s.voidBy)?.name)})</div>` : ''}<div class="c small" style="margin-top:6px">${esc(tn.footer)}</div></div>
  <div class="row" style="margin-top:12px"><input id="waph" placeholder="Mobile number" inputmode="tel" value="${esc(cu && cu.phone || '')}" style="max-width:170px"><a class="btn wa" id="wab" target="_blank" rel="noopener">${ic('wa')} WhatsApp bill</a></div>
  <div class="row wrap" style="margin-top:10px"><button class="btn" id="rcp">${ic('copy')} Copy receipt</button><button class="btn" id="rpr">Print</button>${!fresh && s.status !== 'void' && role() !== 'salesman' ? '<button class="btn d" id="rvoid">Void bill</button>' : ''}<span class="sp"></span><button class="btn p" id="rok">${fresh ? 'Next customer' : 'Close'}</button></div>`);
  const setWa = () => { const ph = normPhone($('#waph').value), a = $('#wab'); if (ph.length === 10) { a.href = waLink(ph, receiptText(s)); a.classList.remove('off'); } else { a.removeAttribute('href'); a.classList.add('off'); } };
  $('#waph').oninput = setWa; setWa();
  $('#wab').onclick = e => { if (!$('#wab').href) { e.preventDefault(); toast(t('Enter a 10-digit mobile number'), 'bad'); $('#waph').focus(); } };
  $('#rcp').onclick = () => copyText(receiptText(s));
  $('#rpr').onclick = () => { try { window.print(); } catch (e) { toast('Printing is not available here', 'bad'); } };
  $('#rok').onclick = () => { closeModal(); render(); };
  if ($('#rvoid')) $('#rvoid').onclick = () => voidSale(s);
}
function voidSale(s) {
  closeModal();
  modal(`<h2>Void bill ${s.no}?</h2><p class="mute">The bill stays in the ledger marked VOID and stock goes back. A reason and manager PIN are required.</p><label class="f">Reason</label><select id="vr"><option>Customer returned sealed bottle</option><option>Wrong item scanned</option><option>Duplicate bill</option><option>Payment failed</option></select><div class="row" style="margin-top:14px;justify-content:flex-end"><button class="btn" id="vc">Cancel</button><button class="btn p" id="vo">Continue</button></div>`);
  $('#vc').onclick = closeModal;
  $('#vo').onclick = async () => {
    const reason = $('#vr').value; const ap = await askPin(`Void bill ${s.no} (${inr(s.total)}) — ${reason}`, s.shopId); if (!ap) return;
    const ok = await run(async () => { await API.voidSale(s, reason, ap.user.id, ap.pin); return true; });
    if (ok) { toast('Bill voided, stock restored', 'ok'); render(); }
  };
}

/* ---------- BILLS ---------- */
VIEWS.bills = function () {
  SUB.date = SUB.date || dk(Date.now()); SUB.mode = SUB.mode || 'all'; SUB.user = SUB.user || 'all'; SUB.flag = SUB.flag || 'all';
  const ids = role() === 'owner' ? scope() : [S.me.shopId];
  const d0 = d0of(SUB.date);
  if (S.loadedFrom && d0 < S.loadedFrom) { $('#view').innerHTML = '<div class="card empty"><span class="spin dk"></span> Loading older bills…</div>'; API.ensureRange(d0).then(() => VIEWS.bills(), e => toast(errText(e), 'bad')); return; }
  let list = S.sales.filter(s => ids.includes(s.shopId) && s.ts >= d0 && s.ts < d0 + DAY);
  if (role() === 'salesman') list = list.filter(s => s.userId === S.me.id);
  if (SUB.mode !== 'all') list = list.filter(s => s.mode === SUB.mode);
  if (SUB.user !== 'all') list = list.filter(s => s.userId === SUB.user);
  if (SUB.flag === 'ovr') list = list.filter(s => s.items.some(i => i.m === 'ovr')); if (SUB.flag === 'void') list = list.filter(s => s.status === 'void'); if (SUB.flag === 'ai') list = list.filter(s => s.items.some(i => i.m === 'ai'));
  list.sort((a, b) => b.ts - a.ts);
  const live = list.filter(s => s.status !== 'void');
  const staff = tUsers().filter(u => ids.includes(u.shopId));
  $('#view').innerHTML = `<div class="card"><div class="row wrap" style="margin-bottom:14px">
   <div><label class="f">Business day</label><input type="date" id="bd" value="${SUB.date}" style="width:auto"></div>
   <div><label class="f">Payment</label><select id="bm" style="width:auto">${['all', 'Cash', 'UPI', 'Split', 'Credit'].map(m => `<option value="${m}" ${SUB.mode === m ? 'selected' : ''}>${m === 'all' ? t('all') : modeLabel(m)}</option>`).join('')}</select></div>
   ${role() !== 'salesman' ? `<div><label class="f">Staff</label><select id="bu" style="width:auto"><option value="all">Everyone</option>${staff.map(u => `<option value="${u.id}" ${SUB.user === u.id ? 'selected' : ''}>${esc(u.name)}</option>`).join('')}</select></div>
   <div><label class="f">Flags</label><select id="bf" style="width:auto"><option value="all">All bills</option><option value="ovr" ${SUB.flag === 'ovr' ? 'selected' : ''}>Manual override</option><option value="ai" ${SUB.flag === 'ai' ? 'selected' : ''}>AI scanned</option><option value="void" ${SUB.flag === 'void' ? 'selected' : ''}>Voided</option></select></div>` : ''}
   <span class="sp"></span>
   <div style="text-align:right"><div class="small mute">${live.length} bills · Cash ${inr(sum(live, s => s.cash))} · UPI ${inr(sum(live, s => s.upi))}${sum(live, s => s.credit || 0) ? ` · ${t('Udhar')} ${inr(sum(live, s => s.credit || 0))}` : ''}</div><div class="b" style="font-size:20px">${inr(sum(live, s => s.total))}</div></div>
   ${role() !== 'salesman' ? `<button class="btn" id="verify">${ic('shield')} Verify ledger</button>` : ''}
  </div>
  <div class="tbl"><table><tr><th>Bill</th><th>Time</th><th>Shop</th><th>Salesman</th><th>Items</th><th>Mode</th><th class="r">Amount</th><th></th></tr>
  ${list.slice(0, 500).map(s => `<tr style="${s.status === 'void' ? 'opacity:.55;text-decoration:line-through' : ''}"><td class="mono small b">${s.no}</td><td class="small">${tm(s.ts)}</td><td class="small">${esc(shopById(s.shopId)?.name)}</td><td class="small">${esc(userById(s.userId)?.name)}</td><td class="small">${s.items.map(i => esc(prodById(i.pid)?.brand) + ' ' + (prodById(i.pid)?.pack || '') + (i.qty > 1 ? ' ×' + i.qty : '')).join(', ')} ${s.items.some(i => i.m === 'ovr') ? '<span class="badge warn">OVR</span>' : ''}${s.items.some(i => i.m === 'ai') ? '<span class="badge br">AI</span>' : ''}</td><td><span class="badge ${s.mode === 'UPI' ? 'br' : s.mode === 'Credit' ? 'warn' : ''}">${modeLabel(s.mode)}</span></td><td class="r b">${inr(s.total)}</td><td><button class="btn sm" data-bill="${s.id}">View</button></td></tr>`).join('') || '<tr><td colspan="8" class="empty">No bills</td></tr>'}</table></div></div>`;
  $('#bd').onchange = e => { SUB.date = e.target.value; VIEWS.bills(); }; $('#bm').onchange = e => { SUB.mode = e.target.value; VIEWS.bills(); };
  if ($('#bu')) $('#bu').onchange = e => { SUB.user = e.target.value; VIEWS.bills(); }; if ($('#bf')) $('#bf').onchange = e => { SUB.flag = e.target.value; VIEWS.bills(); };
  $$('[data-bill]').forEach(b => b.onclick = () => showReceipt(S.sales.find(s => s.id === b.dataset.bill)));
  if ($('#verify')) $('#verify').onclick = async () => {
    const res = await run(() => API.verifyLedger(ids), $('#verify')); if (!res) return;
    modal(`<h2>${ic('shield', 18)} Ledger integrity</h2><p class="mute">Each bill's lock code is computed from its contents and the previous bill's code. Editing or deleting any past bill breaks the chain from that point on.</p><table>${res.map(r => `<tr><td class="b">${esc(shopById(r.id).name)}</td><td>${r.n} bills</td><td class="r">${r.bad ? `<span class="badge bad">${r.bad} broken</span>` : '<span class="badge ok">Chain intact</span>'}</td></tr>`).join('')}</table><div class="row" style="justify-content:flex-end;margin-top:14px"><button class="btn p" id="vdone">Done</button></div>`);
    $('#vdone').onclick = closeModal;
  };
};
