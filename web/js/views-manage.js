/* =========================================================
   MuneemX — Inventory, Expenses, Staff & Salary, Reports, Settings
   ========================================================= */
'use strict';

/* ---------- INVENTORY ---------- */
const INV = {};
VIEWS.inventory = function () {
  SUB.tab = SUB.tab || 'stock';
  const tabs = [['stock', 'Stock'], ['inward', 'Stock inward'], ...(tShops().length > 1 && (role() === 'owner' || role() === 'manager') ? [['transfer', 'Transfer']] : []), ['count', 'Physical count'], ['register', 'Daily register'], ['links', 'Link barcodes'], ['catalog', 'Product catalog']];
  $('#view').innerHTML = `<div class="tabs">${tabs.map(([k, t]) => `<a data-t="${k}" class="${SUB.tab === k ? 'on' : ''}">${t}</a>`).join('')}</div><div id="inv"></div>`;
  $$('[data-t]').forEach(a => a.onclick = () => { SUB = { tab: a.dataset.t }; VIEWS.inventory(); });
  INV[SUB.tab]();
};
const lowAt = (p, n) => (p.pack === 'Quarter' || p.category === 'Beer' ? 24 : 6) * (n || 1);
INV.stock = function () {
  const ids = scope(); SUB.q = SUB.q || ''; SUB.cat = SUB.cat || 'all';
  let ps = visibleProducts(); if (SUB.cat !== 'all') ps = ps.filter(p => p.category === SUB.cat);
  if (SUB.q) { const w = SUB.q.toLowerCase().split(/\s+/); ps = ps.filter(p => w.every(x => (pname(p) + ' ' + p.pack + ' ' + p.barcode).toLowerCase().includes(x))); }
  const rows = ps.map(p => { const per = ids.map(id => stockOf(id, p.id)); return { p, per, q: sum(per, x => x) }; });
  $('#inv').innerHTML = `<div class="grid g4" style="margin-bottom:14px"><div class="card kpi"><div class="l">SKUs</div><div class="v">${rows.length}</div></div><div class="card kpi"><div class="l">Units in stock</div><div class="v">${sum(rows, r => r.q).toLocaleString('en-IN')}</div></div><div class="card kpi"><div class="l">Stock value (cost)</div><div class="v">${inrK(sum(rows, r => r.q * r.p.cost))}</div></div><div class="card kpi"><div class="l">Stock value (MRP)</div><div class="v">${inrK(sum(rows, r => r.q * r.p.mrp))}</div></div></div>
  <div class="card"><div class="row wrap" style="margin-bottom:12px"><input id="iq" placeholder="Search product or barcode" value="${esc(SUB.q)}" style="max-width:320px"><select id="ic" style="width:auto"><option value="all">All categories</option>${CATS.map(c => `<option ${SUB.cat === c ? 'selected' : ''}>${c}</option>`).join('')}</select><span class="sp"></span><button class="btn" id="icsv">${ic('copy')} Copy CSV</button></div>
  <div class="tbl"><table><tr><th>Product</th><th>Pack</th><th>Barcode</th><th class="r">MRP</th>${ids.length > 1 ? ids.map(id => `<th class="r">${esc(shopById(id).name)}</th>`).join('') : ''}<th class="r">Stock</th><th></th><th></th></tr>
  ${rows.map(r => `<tr><td><div class="row" style="gap:8px">${pimg(r.p, 30)}<div><div class="b small">${esc(pname(r.p))}</div><div class="small mute">${r.p.category}</div></div></div></td><td class="small">${ppack(r.p)}</td><td class="mono small">${r.p.barcode}</td><td class="r">${inr(r.p.mrp)}</td>${ids.length > 1 ? r.per.map(x => `<td class="r">${x}</td>`).join('') : ''}<td class="r b">${r.q}</td><td>${r.q <= 0 ? '<span class="badge bad">Out</span>' : r.q <= lowAt(r.p, ids.length) ? '<span class="badge warn">Low</span>' : '<span class="badge ok">OK</span>'}</td><td><button class="btn sm" data-edit="${r.p.id}">Edit</button></td></tr>`).join('')}</table></div></div>`;
  $('#iq').oninput = e => { SUB.q = e.target.value; INV.stock(); const n = $('#iq'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); };
  $('#ic').onchange = e => { SUB.cat = e.target.value; INV.stock(); };
  $$('[data-edit]').forEach(b => b.onclick = () => editProductModal(prodById(b.dataset.edit), () => INV.stock()));
  $('#icsv').onclick = () => copyText(['Product,Pack,Size ml,Barcode,MRP,' + ids.map(id => shopById(id).name).join(',') + ',Total', ...rows.map(r => `"${pname(r.p)}",${r.p.pack},${r.p.sizeMl},${r.p.barcode},${r.p.mrp},${r.per.join(',')},${r.q}`)].join('\n'));
};
// onPick(p, units): units = bottles from a scan (1 or carton size); null when picked from search
function productPicker(sel, onPick, opts = {}) {
  const el = $(sel); el.innerHTML = `<div class="row"><input placeholder="Scan carton / bottle barcode or search" class="pp-in"><button class="btn" type="button" data-ppcam>${ic('cam')}</button></div><div class="pp-res"></div>`;
  const inp = el.querySelector('.pp-in'), res = el.querySelector('.pp-res');
  const byCode = code => { code = normCode(code); const h = lookupCode(code); if (h) { beep(true); onPick(h.p, h.units); } else { beep(false); linkBarcodeModal(code, (p, u) => onPick(p, u), { carton: opts.carton }); } };
  SCAN_HANDLER = byCode;
  el.querySelector('[data-ppcam]').onclick = () => openCamera(byCode);
  inp.onkeydown = e => { if (e.key === 'Enter' && inp.value.trim()) { e.preventDefault(); const v = inp.value; inp.value = ''; res.innerHTML = ''; byCode(v); } };
  autoSubmitBox(inp, v => { res.innerHTML = ''; byCode(v); });
  inp.oninput = () => {
    const q = inp.value.toLowerCase().trim(); if (q.length < 2 || /^\d+$/.test(q)) { res.innerHTML = ''; return; } const w = q.split(/\s+/);
    const r = visibleProducts().filter(p => w.every(x => (pname(p) + ' ' + p.pack + ' ' + p.sizeMl).toLowerCase().includes(x))).slice(0, 6);
    res.innerHTML = r.map(p => `<button class="urow" style="margin-top:6px" data-pp="${p.id}">${pimg(p, 30)}<div class="sp"><div class="b small">${esc(pname(p))}</div><div class="small mute">${ppack(p)} · ${t('carton')} ${caseSize(p)}</div></div></button>`).join('');
    res.querySelectorAll('[data-pp]').forEach(b => b.onclick = () => { inp.value = ''; res.innerHTML = ''; onPick(prodById(b.dataset.pp), null); });
  };
}
function invShopSel(id, label, cur, list) { list = list || (role() === 'owner' ? tShops().map(s => s.id) : [S.me.shopId]); const v = cur || (scope().length === 1 && list.includes(scope()[0]) ? scope()[0] : list[0]); return `<div><label class="f">${label || 'Shop'}</label><select id="${id}">${list.map(x => `<option value="${x}" ${x === v ? 'selected' : ''}>${esc(shopById(x).name)}${shopById(x).isMain ? ' ★' : ''}</option>`).join('')}</select></div>`; }
const mainShop = () => tShops().find(s => s.isMain);
// editable lines: cartons + loose bottles
function linesTable(lines, prefix, avail) {
  return `<div class="tbl" style="border:0"><table><tr><th>Product</th><th class="r">${t('Per carton')}</th><th class="r">${t('Cartons')}</th><th class="r">${t('+ Bottles')}</th><th class="r">${t('Total bottles')}</th>${avail ? `<th class="r">${t('Available')}</th>` : ''}<th></th></tr>
  ${lines.map((l, i) => { const p = prodById(l.pid), cs = caseSize(p), c = Math.floor(l.q / cs), r = l.q - c * cs, have = avail ? avail(l.pid) : null;
    return `<tr><td><div class="row" style="gap:8px">${pimg(p, 30)}<div><div class="b small">${esc(pname(p))}</div><div class="small mute">${ppack(p)}</div></div></div></td>
    <td class="r small">${cs}</td><td class="r"><input type="number" min="0" value="${c}" data-${prefix}c="${i}" style="width:70px;text-align:right"></td>
    <td class="r"><input type="number" min="0" value="${r}" data-${prefix}b="${i}" style="width:70px;text-align:right"></td>
    <td class="r b">${l.q}</td>${avail ? `<td class="r"><span class="badge ${have < l.q ? 'bad' : 'ok'}">${have}</span></td>` : ''}
    <td class="r" style="white-space:nowrap"><button class="btn sm" data-${prefix}add="${i}">+1 ${t('ctn')}</button> <button class="btn sm d" data-${prefix}x="${i}">✕</button></td></tr>`; }).join('')}</table></div>`;
}
function wireLines(lines, prefix, redraw) {
  const set = i => { const p = prodById(lines[i].pid), cs = caseSize(p); const c = Math.max(0, +$(`[data-${prefix}c="${i}"]`).value || 0), b = Math.max(0, +$(`[data-${prefix}b="${i}"]`).value || 0); lines[i].q = c * cs + b; };
  $$(`[data-${prefix}c],[data-${prefix}b]`).forEach(x => x.onchange = () => { set(+(x.dataset[prefix + 'c'] ?? x.dataset[prefix + 'b'])); if (lines[+(x.dataset[prefix + 'c'] ?? x.dataset[prefix + 'b'])].q <= 0) lines.splice(+(x.dataset[prefix + 'c'] ?? x.dataset[prefix + 'b']), 1); setTimeout(redraw, 0); });
  $$(`[data-${prefix}add]`).forEach(b => b.onclick = () => { const l = lines[+b.dataset[prefix + 'add']]; l.q += caseSize(prodById(l.pid)); redraw(); });
  $$(`[data-${prefix}x]`).forEach(b => b.onclick = () => { lines.splice(+b.dataset[prefix + 'x'], 1); redraw(); });
}
function addLine(lines, p, units) { const n = units == null ? caseSize(p) : units; const l = lines.find(l => l.pid === p.id); if (l) l.q += n; else lines.unshift({ pid: p.id, q: n }); return n; }

INV.inward = function () {
  SUB.lines = SUB.lines || []; SUB.log = SUB.log || [];
  if (SUB.shop == null) SUB.shop = (mainShop() && (role() === 'owner') ? mainShop().id : null);
  const hist = S.moves.filter(m => m.type === 'inward' && scope().includes(m.shopId)); const byRef = {};
  hist.forEach(m => { const k = m.shopId + '|' + m.ref; byRef[k] = byRef[k] || { ref: m.ref, shop: m.shopId, ts: m.ts, party: m.party, q: 0, v: 0 }; byRef[k].q += m.qty; byRef[k].v += m.qty * (prodById(m.pid)?.cost || 0); byRef[k].ts = Math.max(byRef[k].ts, m.ts); });
  const tq = sum(SUB.lines, l => l.q), tc = sum(SUB.lines, l => Math.floor(l.q / caseSize(prodById(l.pid))));
  $('#inv').innerHTML = `<div class="grid g12"><div class="card"><h3>${ic('box', 16)} Receive stock</h3>
   <div class="grid">${invShopSel('ish', 'Shop', SUB.shop)}<div><label class="f">Supplier / depot</label><input id="isup" value="${esc(SUB.sup || '')}" placeholder="e.g. State Beverages Depot"></div><div><label class="f">Invoice / permit no.</label><input id="iinv" value="${esc(SUB.inv || '')}" placeholder="e.g. TP/2026/88123"></div>
   <div><label class="f">Scan cartons or bottles</label><div id="ipick"></div></div>
   <label class="row small opt" style="font-weight:600;margin:0"><input type="checkbox" id="iinst" style="width:auto" ${SUB.instant ? 'checked' : ''}> <span>${t('Instant mode: each scan goes straight into stock')}</span></label>
   <p class="small mute" style="margin:0">${t('A carton barcode adds the whole carton. A bottle barcode adds one bottle. Search adds one carton. New carton barcodes are linked once in Inventory → Link barcodes.')}</p></div></div>
   <div class="card">${SUB.instant ? `<h3>${t('Scanned into stock')}<span class="sp"></span><span class="small mute">${sum(SUB.log, x => x.q)} ${t('bottles')}</span></h3>
     ${SUB.log.length ? `<table>${SUB.log.slice(0, 30).map(x => `<tr><td class="small mute">${tm(x.ts)}</td><td class="small b">${esc(pname(prodById(x.pid)))} · ${prodById(x.pid).pack}</td><td class="r"><span class="badge ok">+${cq(x.q, caseSize(prodById(x.pid)))}</span></td></tr>`).join('')}</table>` : `<div class="empty">${ic('scan', 26)}<div>${t('Scan a carton to add it to stock')}</div></div>`}`
   : `<h3>Lines<span class="sp"></span><span class="small mute">${tc} ${t('cartons')} · ${tq} ${t('bottles')} · ${inr(sum(SUB.lines, l => l.q * prodById(l.pid).cost))} at cost</span></h3>
   ${SUB.lines.length ? linesTable(SUB.lines, 'i') + `<div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn p" id="isave">${ic('plus')} Receive into stock</button></div>` : '<div class="empty">Scan or search products to add them</div>'}`}
   <h3 style="margin-top:18px">Recent receipts</h3><div class="tbl" style="max-height:240px"><table><tr><th>Date</th><th>Shop</th><th>Ref</th><th>Supplier</th><th class="r">Units</th><th class="r">Value</th></tr>${Object.values(byRef).sort((a, b) => b.ts - a.ts).slice(0, 12).map(r => `<tr><td class="small">${dtm(r.ts)}</td><td class="small">${esc(shopById(r.shop)?.name)}</td><td class="mono small">${esc(r.ref)}</td><td class="small">${esc(r.party || '')}</td><td class="r">${r.q}</td><td class="r">${inr(r.v)}</td></tr>`).join('') || '<tr><td colspan="6" class="empty">None yet</td></tr>'}</table></div></div></div>`;
  const keep = () => { SUB.sup = $('#isup').value; SUB.inv = $('#iinv').value; SUB.shop = $('#ish').value; };
  $('#iinst').onchange = e => { keep(); SUB.instant = e.target.checked; INV.inward(); };
  productPicker('#ipick', async (p, units) => {
    keep();
    if (SUB.instant) {
      const n = units == null ? caseSize(p) : units, ref = SUB.inv || ('SCAN-' + dk(Date.now()));
      const ok = await run(async () => { await API.receiveStock(SUB.shop, ref, SUB.sup, [{ pid: p.id, q: n }]); return true; });
      if (ok) { SUB.log.unshift({ pid: p.id, q: n, ts: Date.now() }); toast(`+${n} ${pname(p)} ${p.pack}`, 'ok'); }
    } else addLine(SUB.lines, p, units);
    INV.inward(); const i = $('.pp-in'); if (i) i.focus();
  }, { carton: true });
  if (!SUB.instant && SUB.lines.length) wireLines(SUB.lines, 'i', () => { keep(); INV.inward(); });
  if ($('#isave')) $('#isave').onclick = async () => {
    keep(); const ref = SUB.inv || ('GRN-' + Date.now().toString().slice(-6));
    const ok = await run(async () => { await API.receiveStock(SUB.shop, ref, SUB.sup, SUB.lines); return true; }, $('#isave'));
    if (ok) { toast(`${t('Stock received')} · ${tq} ${t('bottles')}`, 'ok'); SUB = { tab: 'inward', shop: SUB.shop, sup: SUB.sup }; INV.inward(); }
  };
};
INV.transfer = function () {
  SUB.lines = SUB.lines || [];
  const fromList = role() === 'owner' ? tShops().map(s => s.id) : [S.me.shopId];
  if (!SUB.from) SUB.from = role() === 'owner' ? (mainShop() || tShops()[0]).id : S.me.shopId;
  const toList = tShops().map(s => s.id).filter(id => id !== SUB.from);
  if (!SUB.to || !toList.includes(SUB.to)) SUB.to = toList[0];
  const tq = sum(SUB.lines, l => l.q), short = SUB.lines.some(l => stockOf(SUB.from, l.pid) < l.q);
  const groups = {}; S.moves.filter(m => m.type === 'transfer' && m.qty < 0 && (role() === 'owner' || m.shopId === S.me.shopId || (m.party || '').endsWith(shopById(S.me.shopId)?.name || '~'))).forEach(m => { const g = groups[m.ref] = groups[m.ref] || { ref: m.ref, ts: m.ts, from: m.shopId, to: m.party, q: 0, n: 0 }; g.q -= m.qty; g.n++; });
  $('#inv').innerHTML = `<div class="grid g12"><div class="card"><h3>${ic('box', 16)} Move stock between shops</h3><div class="grid">
   ${invShopSel('tfrom', 'From shop', SUB.from, fromList)}${invShopSel('tto', 'To shop', SUB.to, toList)}
   <div><label class="f">Scan cartons or bottles</label><div id="tpick"></div></div>
   <p class="small mute" style="margin:0">${t('Stock is taken out of the sending shop and added to the receiving shop in one step. Both shops see it in their Daily register and in Reports → Stock movements.')}</p></div></div>
  <div class="card"><h3>Transfer lines<span class="sp"></span><span class="small mute">${tq} ${t('bottles')}</span></h3>${SUB.lines.length ? linesTable(SUB.lines, 't', pid => stockOf(SUB.from, pid)) + `${short ? `<div class="flash bad">${t('Some lines are more than the stock at the sending shop.')}</div>` : ''}<div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn p" id="tsave" ${short ? 'disabled' : ''}>${t('Transfer')} ${tq} ${t('bottles')} → ${esc(shopById(SUB.to)?.name || '')}</button></div>` : '<div class="empty">Add products to move</div>'}
   <h3 style="margin-top:18px">${t('Recent transfers')}</h3><div class="tbl" style="max-height:240px"><table><tr><th>Date</th><th>Ref</th><th>From</th><th>To</th><th class="r">${t('Products')}</th><th class="r">${t('Bottles')}</th></tr>${Object.values(groups).sort((a, b) => b.ts - a.ts).slice(0, 15).map(g => `<tr><td class="small">${dtm(g.ts)}</td><td class="mono small">${esc(g.ref)}</td><td class="small">${esc(shopById(g.from)?.name || '')}</td><td class="small">${esc((g.to || '').replace(/^To /, ''))}</td><td class="r">${g.n}</td><td class="r b">${g.q}</td></tr>`).join('') || '<tr><td colspan="6" class="empty">None yet</td></tr>'}</table></div></div></div>`;
  $('#tfrom').onchange = e => { SUB.from = e.target.value; SUB.to = null; INV.transfer(); };
  $('#tto').onchange = e => { SUB.to = e.target.value; INV.transfer(); };
  productPicker('#tpick', (p, units) => { addLine(SUB.lines, p, units); INV.transfer(); const i = $('.pp-in'); if (i) i.focus(); }, { carton: true });
  if (SUB.lines.length) wireLines(SUB.lines, 't', () => INV.transfer());
  if ($('#tsave')) $('#tsave').onclick = async () => {
    if (SUB.from === SUB.to) { toast('Pick two different shops', 'bad'); return; }
    const ref = await run(() => API.transferStock(SUB.from, SUB.to, SUB.lines), $('#tsave'));
    if (ref) { toast(`${t('Transferred')} · ${ref}`, 'ok'); SUB = { tab: 'transfer', from: SUB.from, to: SUB.to }; INV.transfer(); }
  };
};
INV.count = function () {
  const sh = SUB.shop || scope()[0]; SUB.cnt = SUB.cnt || {}; SUB.cat = SUB.cat || 'Whisky';
  const ps = visibleProducts().filter(p => p.category === SUB.cat), counted = Object.keys(SUB.cnt).length;
  $('#inv').innerHTML = `<div class="card"><h3>Physical stock count<span class="sp"></span><span class="small mute">Count shelves, enter what you see. Differences are posted as adjustments and logged.</span></h3>
  <div class="row wrap" style="margin-bottom:12px">${role() === 'owner' ? `<select id="csh" style="width:auto">${tShops().map(s => `<option value="${s.id}" ${s.id === sh ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select>` : ''}<div class="seg" style="flex-wrap:wrap">${CATS.map(c => `<button data-cc="${c}" class="${SUB.cat === c ? 'on' : ''}">${c}</button>`).join('')}</div></div>
  <div class="tbl"><table><tr><th>Product</th><th class="r">System</th><th class="r">Counted</th><th class="r">Variance</th><th class="r">Value</th></tr>${ps.map(p => { const sys = stockOf(sh, p.id), c = SUB.cnt[p.id], v = c == null ? null : c - sys; return `<tr><td><div class="b small">${esc(pname(p))}</div><div class="small mute">${ppack(p)}</div></td><td class="r">${sys}</td><td class="r"><input type="number" min="0" data-cnt="${p.id}" value="${c ?? ''}" style="width:90px;text-align:right"></td><td class="r">${v == null ? '—' : `<span class="badge ${v < 0 ? 'bad' : v > 0 ? 'warn' : 'ok'}">${v > 0 ? '+' : ''}${v}</span>`}</td><td class="r">${v ? inr(v * p.cost) : ''}</td></tr>`; }).join('')}</table></div>
  <div class="row" style="margin-top:12px"><span class="mute small">${counted} product(s) counted · net variance ${inr(sum(Object.entries(SUB.cnt), ([pid, c]) => (c - stockOf(sh, pid)) * prodById(pid).cost))} at cost</span><span class="sp"></span><button class="btn p" id="cpost" ${counted ? '' : 'disabled'}>Post adjustments</button></div></div>`;
  if ($('#csh')) $('#csh').onchange = e => { SUB.shop = e.target.value; SUB.cnt = {}; INV.count(); };
  $$('[data-cc]').forEach(b => b.onclick = () => { SUB.cat = b.dataset.cc; SUB.shop = sh; INV.count(); });
  $$('[data-cnt]').forEach(i => i.onchange = () => { if (i.value === '') delete SUB.cnt[i.dataset.cnt]; else SUB.cnt[i.dataset.cnt] = Math.max(0, +i.value); SUB.shop = sh; INV.count(); });
  $('#cpost').onclick = async () => {
    const n = await run(() => API.adjustStock(sh, SUB.cnt), $('#cpost'));
    if (n !== undefined) { toast(`${n} adjustment(s) posted`, 'ok'); SUB = { tab: 'count', shop: sh, cat: SUB.cat }; INV.count(); }
  };
};
// per-product movement for a shop between [d0, d1): opening, inward, transfers in/out, adjustments, sold, closing
function stockRegister(sh, d0, d1) {
  const sales = S.sales.filter(s => s.shopId === sh && s.status !== 'void'), moves = S.moves.filter(m => m.shopId === sh);
  return visibleProducts().map(p => {
    const cur = stockOf(sh, p.id), mv = moves.filter(m => m.pid === p.id), sl = sales.map(s => ({ ts: s.ts, q: sum(s.items.filter(i => i.pid === p.id), i => i.qty) })).filter(x => x.q);
    const after = t => ({ mv: sum(mv.filter(m => m.ts >= t), m => m.qty), sold: sum(sl.filter(x => x.ts >= t), x => x.q) });
    const a1 = after(d1), a0 = after(d0), inn = mv.filter(m => m.ts >= d0 && m.ts < d1);
    const r = { p, open: cur - a0.mv + a0.sold, close: cur - a1.mv + a1.sold, sold: a0.sold - a1.sold,
      inw: sum(inn.filter(m => m.type === 'inward' || m.type === 'opening'), m => m.qty), tin: sum(inn.filter(m => m.type === 'transfer' && m.qty > 0), m => m.qty),
      tout: -sum(inn.filter(m => m.type === 'transfer' && m.qty < 0), m => m.qty), adj: sum(inn.filter(m => m.type === 'adjust'), m => m.qty) };
    return r;
  }).filter(r => r.open || r.inw || r.tin || r.tout || r.adj || r.sold || r.close);
}
INV.register = function () {
  SUB.date = SUB.date || dk(Date.now()); const sh = SUB.shop || scope()[0];
  const d0 = d0of(SUB.date), d1 = d0 + DAY;
  if (S.loadedFrom && d0 < S.loadedFrom) { $('#inv').innerHTML = '<div class="card empty"><span class="spin dk"></span> Loading…</div>'; API.ensureRange(d0).then(() => INV.register(), e => toast(errText(e), 'bad')); return; }
  const rows = stockRegister(sh, d0, d1), T = k => sum(rows, r => r[k]);
  $('#inv').innerHTML = `<div class="card"><h3>Daily stock register<span class="sp"></span><span class="small mute">${t('Opening + received + transfer in − transfer out ± adjust − sold = closing')}</span></h3>
  <div class="row wrap" style="margin-bottom:12px"><input type="date" id="rd" value="${SUB.date}" style="width:auto">${role() === 'owner' ? `<select id="rsh" style="width:auto">${tShops().map(s => `<option value="${s.id}" ${s.id === sh ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select>` : ''}<span class="sp"></span><button class="btn" id="rcsv">${ic('copy')} Copy CSV</button></div>
  <div class="tbl"><table><tr><th>Product</th><th>Pack</th><th class="r">Opening</th><th class="r">Received</th><th class="r">${t('Transfer in')}</th><th class="r">${t('Transfer out')}</th><th class="r">${t('Adjust')}</th><th class="r">Sold</th><th class="r">Closing</th><th class="r">Sales ₹</th></tr>${rows.map(r => `<tr><td class="small b">${esc(pname(r.p))}</td><td class="small">${ppack(r.p)}</td><td class="r">${r.open}</td><td class="r">${r.inw || ''}</td><td class="r up">${r.tin ? '+' + r.tin : ''}</td><td class="r down">${r.tout ? '−' + r.tout : ''}</td><td class="r">${r.adj ? (r.adj > 0 ? '+' : '') + r.adj : ''}</td><td class="r b">${r.sold || ''}</td><td class="r">${r.close}</td><td class="r">${r.sold ? inr(r.sold * r.p.mrp) : ''}</td></tr>`).join('')}
  <tr style="background:var(--soft)"><td class="b">Total</td><td></td><td class="r b">${T('open')}</td><td class="r b">${T('inw')}</td><td class="r b">${T('tin')}</td><td class="r b">${T('tout')}</td><td class="r b">${T('adj')}</td><td class="r b">${T('sold')}</td><td class="r b">${T('close')}</td><td class="r b">${inr(sum(rows, r => r.sold * r.p.mrp))}</td></tr></table></div></div>`;
  $('#rd').onchange = e => { SUB.date = e.target.value; SUB.shop = sh; INV.register(); }; if ($('#rsh')) $('#rsh').onchange = e => { SUB.shop = e.target.value; INV.register(); };
  $('#rcsv').onclick = () => copyText(['Product,Pack,Size,Opening,Received,Transfer in,Transfer out,Adjust,Sold,Closing', ...rows.map(r => `"${pname(r.p)}",${r.p.pack},${r.p.sizeMl},${r.open},${r.inw},${r.tin},${r.tout},${r.adj},${r.sold},${r.close}`)].join('\n'));
};
INV.links = function () {
  const rows = Object.entries(S.barcodes || {}).map(([code, pid]) => ({ code, p: prodById(pid), u: (S.bcUnits || {})[code] || 1 })).filter(r => r.p).sort((a, b) => pname(a.p).localeCompare(pname(b.p)));
  $('#inv').innerHTML = `<div class="grid g12"><div class="card"><h3>${ic('scan', 16)} Teach your real barcodes</h3>
   <p class="mute small" style="margin-top:0">Bottles from your depot carry the manufacturer's barcode. Scan each new bottle once here and pick its product. After that, Scan & Sell bills it instantly at every shop.</p>
   <div class="row"><input id="lkin" placeholder="Scan or type barcode ⏎" class="mono" autocomplete="off" inputmode="numeric"><button class="btn p" id="lkcam">${ic('cam')} Camera</button></div>
   <div id="lkmsg"></div></div>
   <div class="card"><h3>Linked barcodes<span class="sp"></span><span class="small mute">${rows.length}</span></h3>
   <div class="tbl"><table><tr><th>Barcode</th><th>Product</th><th>Pack</th><th>${t('Type')}</th><th></th></tr>${rows.map(r => `<tr><td class="mono small">${esc(r.code)}</td><td class="small b">${esc(pname(r.p))}</td><td class="small">${ppack(r.p)}</td><td>${r.u > 1 ? `<span class="badge br">${t('Carton')} × ${r.u}</span>` : `<span class="badge">${t('Bottle')}</span>`}</td><td class="r"><button class="btn sm d" data-unl="${esc(r.code)}">Remove</button></td></tr>`).join('') || '<tr><td colspan="5" class="empty">No linked barcodes yet — scan a bottle to start</td></tr>'}</table></div></div></div>`;
  const msg = (h, k) => { const m = $('#lkmsg'); if (m) m.innerHTML = `<div class="flash ${k}">${h}</div>`; };
  const handle = code => {
    code = normCode(code); if (!code) return;
    const p = findByBarcode(code);
    if (p) { beep(true); msg(`<span class="mono">${esc(code)}</span> → <b>${esc(pname(p))} ${ppack(p)}</b> <button class="btn sm" id="relink" style="margin-left:6px">Change</button>`, 'ok'); const b = $('#relink'); if (b) b.onclick = () => linkBarcodeModal(code, () => INV.links()); return; }
    beep(false); linkBarcodeModal(code, () => { INV.links(); const i = $('#lkin'); if (i) i.focus(); });
  };
  SCAN_HANDLER = handle;
  const inp = $('#lkin'); inp.focus();
  inp.onkeydown = e => { if (e.key === 'Enter' && inp.value.trim()) { e.preventDefault(); const v = inp.value; inp.value = ''; handle(v); } };
  $('#lkcam').onclick = () => openCamera(handle, { continuous: false });
  $$('[data-unl]').forEach(b => b.onclick = async () => { const ok = await run(async () => { await API.unlinkBarcode(b.dataset.unl); return true; }, b); if (ok) INV.links(); });
};
INV.catalog = function () {
  const F = SUB.f || (SUB.f = { brand: '', name: '', category: 'Whisky', pack: 'Quarter', sizeMl: 180, mrp: '', cost: '', barcode: '', img: null });
  const own = S.products.filter(p => p.tenantId === SES.tenantId), master = S.products.filter(p => !p.tenantId);
  SUB.cq = SUB.cq || '';
  let list = [...own, ...master];
  if (SUB.cq) { const w = SUB.cq.toLowerCase().split(/\s+/); list = list.filter(p => w.every(x => (pname(p) + ' ' + p.pack + ' ' + p.barcode + ' ' + p.category).toLowerCase().includes(x))); }
  $('#inv').innerHTML = `<div class="grid g12"><div class="card"><h3>Enroll a product</h3>
   <div class="row wrap" style="margin-bottom:12px"><button class="btn p" id="cai">${ic('spark')} Fill from label photo</button><button class="btn" id="cbc">${ic('cam')} Barcode from photo</button></div>
   <div id="cmsg"></div>
   <div class="row" style="margin-bottom:12px;align-items:center">${F.img ? `<img class="pimg" src="${F.img.url}" style="width:72px;height:72px">` : `<span class="pimg ph" style="width:72px;height:72px">${ic('cam', 22)}</span>`}
    <div><div class="b small">Product photo <span class="mute">(optional)</span></div><div class="row" style="margin-top:6px"><button class="btn sm" id="cimg">${ic('plus')} ${F.img ? 'Change photo' : 'Add photo'}</button>${F.img ? '<button class="btn sm d" id="cimgx">Remove</button>' : ''}</div></div></div>
   <div class="grid g2"><div><label class="f">Brand</label><input data-f="brand" value="${esc(F.brand)}"></div><div><label class="f">Variant</label><input data-f="name" value="${esc(F.name)}"></div>
   <div><label class="f">Category</label><select data-f="category">${CATS.map(c => `<option ${F.category === c ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
   <div><label class="f">Pack</label><select data-f="pack">${PACKS.map(c => `<option ${F.pack === c ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
   <div><label class="f">Size (ml)</label><input type="number" data-f="sizeMl" value="${esc(F.sizeMl)}"></div><div><label class="f">MRP ₹</label><input type="number" data-f="mrp" value="${esc(F.mrp)}"></div>
   <div><label class="f">Cost ₹</label><input type="number" data-f="cost" value="${esc(F.cost)}" placeholder="auto 84% of MRP"></div><div><label class="f">Barcode</label><input data-f="barcode" value="${esc(F.barcode)}" class="mono" placeholder="scan or leave blank"></div></div>
   <div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn p" id="csave">${ic('plus')} Save to database</button></div>
   <p class="small mute">Once saved, the product can be billed by barcode or AI label scan at every shop in this workspace. Unknown products stay locked out of billing.</p></div>
   <div class="card"><div class="row wrap" style="margin-bottom:12px"><h3 style="margin:0">Your catalog</h3><span class="sp"></span><input id="catq" placeholder="Search product or barcode" value="${esc(SUB.cq)}" style="max-width:240px"></div>
   <div class="small mute" style="margin-bottom:8px">${visibleProducts().length} products · ${own.length} added by you · rest from MuneemX master list</div>
   <div class="tbl"><table><tr><th></th><th>Product</th><th>Pack</th><th>Barcode</th><th class="r">MRP</th><th class="r">Cost</th><th>Source</th><th></th></tr>${list.map(p => `<tr style="${p.active === false ? 'opacity:.5' : ''}"><td style="width:46px">${pimg(p)}</td><td><div class="b small">${esc(pname(p))}</div><div class="small mute">${p.category}${p.active === false ? ' · <span>Hidden</span>' : ''}</div></td><td class="small">${ppack(p)}</td><td class="mono small">${p.barcode}</td><td class="r">${inr(p.mrp)}</td><td class="r">${inr(p.cost)}</td><td>${p.tenantId ? `<span class="badge br">${p.src === 'ai' ? 'AI enrolled' : 'Added'}</span>` : `<span class="badge">Master</span>${p.custom ? ' <span class="badge warn">Edited</span>' : ''}`}</td><td><button class="btn sm" data-edit="${p.id}">Edit</button></td></tr>`).join('')}</table></div></div></div>`;
  $$('[data-f]').forEach(i => i.oninput = i.onchange = () => { F[i.dataset.f] = i.value; if (i.dataset.f === 'pack' && PACK_ML[i.value]) { F.sizeMl = PACK_ML[i.value]; $('[data-f=sizeMl]').value = F.sizeMl; } });
  $('#catq').oninput = e => { SUB.cq = e.target.value; INV.catalog(); const n = $('#catq'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); };
  $$('[data-edit]').forEach(b => b.onclick = () => editProductModal(prodById(b.dataset.edit), () => INV.catalog()));
  $('#cimg').onclick = () => pickImage(im => { F.img = im; INV.catalog(); });
  if ($('#cimgx')) $('#cimgx').onclick = () => { F.img = null; INV.catalog(); };
  const msg = (h, k) => $('#cmsg').innerHTML = `<div class="flash ${k}" style="margin:0 0 12px">${h}</div>`;
  $('#cbc').onclick = () => fileInput(async f => { msg('Reading barcode…', 'info'); const c = await decodeBarcode(f); if (c) { F.barcode = c; INV.catalog(); msg('Barcode read: <span class="mono">' + esc(c) + '</span>', 'ok'); } else msg('No barcode found in that photo.', 'bad'); });
  $('#cai').onclick = () => fileInput(async f => {
    msg('<span class="spin dk"></span> AI is reading the label…', 'info');
    if (!F.img) { try { F.img = await makeImage(f); } catch (e) { } }
    try {
      const [r, code] = await Promise.all([aiEnroll(f), decodeBarcode(f)]);
      Object.assign(F, { brand: r.brand || F.brand, name: r.name || F.name, category: CATS.includes(r.category) ? r.category : F.category, pack: PACKS.includes(r.pack) ? r.pack : F.pack, sizeMl: r.size_ml || F.sizeMl, mrp: r.mrp || F.mrp, barcode: code || r.barcode || F.barcode, _ai: true });
      INV.catalog(); msg(`AI filled the form — check it, add MRP if missing, then save. ${esc(r.note || '')}`, 'ok');
    } catch (e) { INV.catalog(); msg(esc(errText(e)), 'bad'); }
  });
  $('#csave').onclick = async () => {
    const F = SUB.f; if (!F.brand || !F.mrp) { msg('Brand and MRP are required.', 'bad'); return; }
    let bc = String(F.barcode || '').trim(); if (!bc) bc = ean('200' + String(Date.now()).slice(-9));
    if (visibleProducts().some(p => p.barcode === bc)) { msg('That barcode already exists in your database.', 'bad'); return; }
    const p = await run(() => API.addProduct({ brand: F.brand.trim(), name: F.name.trim(), category: F.category, pack: F.pack, sizeMl: +F.sizeMl || 0, mrp: +F.mrp, cost: +F.cost || Math.round(F.mrp * .84), barcode: bc, src: F._ai ? 'ai' : 'manual' }, F.img), $('#csave'));
    if (p) { SUB.f = null; toast('Saved. Receive stock in “Stock inward” to start selling.', 'ok'); INV.catalog(); }
  };
};
function editProductModal(p, done) {
  const own = !!p.tenantId; let img; // undefined = unchanged
  const draw = () => {
    const cur = img === undefined ? p.img : img === null ? null : img.url;
    modal(`<h2>${ic('box', 18)} Edit product</h2>
    ${own ? '' : `<div class="flash info" style="margin:0 0 12px">MuneemX master product: you can change the MRP, cost and photo for your shops. Name, pack and barcode stay as in the master list.</div>`}
    <div class="row" style="margin-bottom:12px;align-items:center">${cur ? `<img class="pimg" src="${esc(cur)}" style="width:84px;height:84px">` : `<span class="pimg ph" style="width:84px;height:84px">${ic('cam', 24)}</span>`}
     <div><div class="b small">Product photo <span class="mute">(optional)</span></div><div class="row" style="margin-top:6px"><button class="btn sm" id="eimg">${ic('plus')} ${cur ? 'Change photo' : 'Add photo'}</button>${cur ? '<button class="btn sm d" id="eimgx">Remove</button>' : ''}</div></div></div>
    <div class="grid g2"><div><label class="f">Brand</label><input id="eb" value="${esc(p.brand)}" ${own ? '' : 'disabled'}></div><div><label class="f">Variant</label><input id="en" value="${esc(p.name)}" ${own ? '' : 'disabled'}></div>
    <div><label class="f">Category</label><select id="ec" ${own ? '' : 'disabled'}>${CATS.map(c => `<option ${p.category === c ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
    <div><label class="f">Pack</label><select id="ep" ${own ? '' : 'disabled'}>${PACKS.map(c => `<option ${p.pack === c ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
    <div><label class="f">Size (ml)</label><input id="es" type="number" value="${p.sizeMl}" ${own ? '' : 'disabled'}></div><div><label class="f">Barcode</label><input id="ebc" class="mono" value="${esc(p.barcode)}" ${own ? '' : 'disabled'}></div>
    <div><label class="f">MRP ₹</label><input id="em" type="number" value="${p.mrp}"></div><div><label class="f">Cost ₹</label><input id="eco" type="number" value="${p.cost}"></div></div>
    ${own ? `<label class="row small" style="margin-top:12px;font-weight:600"><input type="checkbox" id="eact" style="width:auto" ${p.active === false ? 'checked' : ''}> Hide this product (stop selling it)</label>` : ''}
    <p class="small mute">New MRP applies to bills from now on. Old bills keep the price they were sold at.</p>
    <div id="eerr" class="flash bad" style="display:none"></div>
    <div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn" id="ex">Cancel</button><button class="btn p" id="eok">Save changes</button></div>`);
    if (own) $('#ep').onchange = e => { if (PACK_ML[e.target.value]) $('#es').value = PACK_ML[e.target.value]; };
    $('#eimg').onclick = () => pickImage(im => { keep(); img = im; draw(); restore(); });
    if ($('#eimgx')) $('#eimgx').onclick = () => { keep(); img = null; draw(); restore(); };
    $('#ex').onclick = closeModal;
    $('#eok').onclick = async () => {
      const f = own ? { brand: $('#eb').value.trim(), name: $('#en').value.trim(), category: $('#ec').value, pack: $('#ep').value, sizeMl: +$('#es').value || 0, barcode: $('#ebc').value.trim(), mrp: +$('#em').value, cost: +$('#eco').value, active: !$('#eact').checked }
        : { mrp: +$('#em').value, cost: +$('#eco').value };
      const err = m => { $('#eerr').style.display = 'block'; $('#eerr').textContent = t(m); };
      if (own && (!f.brand || !f.barcode)) return err('Brand and barcode are required.');
      if (!(f.mrp > 0) || f.cost < 0) return err('Enter a valid MRP and cost.');
      const ok = await run(async () => { await API.updateProduct(p, f, img); return true; }, $('#eok'));
      if (ok) { closeModal(); toast(t('Product updated'), 'ok'); done && done(); }
    };
  };
  let saved = null;
  const keep = () => { saved = {}; ['eb', 'en', 'ec', 'ep', 'es', 'ebc', 'em', 'eco'].forEach(k => { const el = $('#' + k); if (el) saved[k] = el.value; }); if ($('#eact')) saved.eact = $('#eact').checked; };
  const restore = () => { if (!saved) return; Object.entries(saved).forEach(([k, v]) => { const el = $('#' + k); if (!el) return; if (k === 'eact') el.checked = v; else el.value = v; }); };
  draw();
}

/* ---------- EXPENSES ---------- */
VIEWS.expenses = function () {
  const ids = scope(), m0 = monthStart();
  const list = S.expenses.filter(e => ids.includes(e.shopId)).sort((a, b) => b.ts - a.ts);
  const month = list.filter(e => e.ts >= m0); const bc = {}; month.forEach(e => bc[e.cat] = (bc[e.cat] || 0) + e.amount);
  const gm = sum(liveSales(ids, m0), s => s.total - s.cost);
  $('#view').innerHTML = `<div class="grid g12"><div class="card"><h3>Add expense</h3><div class="grid">
   ${invShopSel('xsh')}<div><label class="f">Category</label><select id="xc">${ECATS.map(c => `<option>${c}</option>`).join('')}</select></div>
   <div class="row"><div class="sp"><label class="f">Amount ₹</label><input id="xa" type="number" inputmode="numeric"></div><div class="sp"><label class="f">Paid by</label><select id="xm"><option>Cash</option><option>UPI</option><option>Bank</option></select></div></div>
   <div><label class="f">Note</label><input id="xn" placeholder="e.g. Ice & glasses"></div><button class="btn p" id="xs">${ic('plus')} Add expense</button>
   <p class="small mute" style="margin:0">Cash expenses are deducted from expected cash at day close.</p></div>
   <h3 style="margin-top:18px">This month by category</h3><div class="chartbox sm"><canvas id="chX"></canvas></div></div>
   <div class="card"><div class="grid g3" style="margin-bottom:14px"><div class="kpi"><div class="l">Expenses this month</div><div class="v">${inr(sum(month, e => e.amount))}</div></div><div class="kpi"><div class="l">Gross margin this month</div><div class="v">${inr(gm)}</div></div><div class="kpi"><div class="l">Expense / margin</div><div class="v">${gm ? Math.round(sum(month, e => e.amount) / gm * 100) : 0}%</div></div></div>
   <div class="tbl"><table><tr><th>Date</th><th>Shop</th><th>Category</th><th>Note</th><th>Mode</th><th class="r">Amount</th></tr>${list.slice(0, 300).map(e => `<tr><td class="small">${dtm(e.ts)}</td><td class="small">${esc(shopById(e.shopId)?.name)}</td><td><span class="badge">${esc(e.cat)}</span></td><td class="small">${esc(e.note)}</td><td class="small">${e.mode}</td><td class="r b">${inr(e.amount)}</td></tr>`).join('') || '<tr><td colspan="6" class="empty">No expenses yet</td></tr>'}</table></div></div></div>`;
  $('#xs').onclick = async () => {
    const a = +$('#xa').value; if (!a || a < 0) { toast('Enter an amount', 'bad'); return; }
    const ok = await run(async () => { await API.addExpense({ shopId: $('#xsh').value, cat: $('#xc').value, amount: a, note: $('#xn').value, mode: $('#xm').value }); return true; }, $('#xs'));
    if (ok) { toast('Expense added', 'ok'); VIEWS.expenses(); }
  };
  if (window.Chart) {
    const brand = getComputedStyle(document.documentElement).getPropertyValue('--brand').trim(); const e = Object.entries(bc).sort((a, b) => b[1] - a[1]);
    charts.push(new Chart($('#chX'), { type: 'bar', data: { labels: e.map(x => t(x[0])), datasets: [{ data: e.map(x => x[1]), backgroundColor: brand, borderRadius: 4 }] }, options: { indexAxis: 'y', maintainAspectRatio: false, animation: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => inr(c.raw) } } }, scales: { x: { ticks: { callback: v => inrK(v) }, grid: { color: cssVar('--grid') } }, y: { grid: { display: false } } } } }));
  }
};

/* ---------- STAFF & SALARY ---------- */
function payCalc(u) {
  const mk = monthKey(), d = new Date(Date.now() - BIZ), dim = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const days = Object.entries(S.attendance[u.id] || {}).filter(([k]) => k.startsWith(mk));
  const P = days.filter(x => x[1] === 'P').length, H = days.filter(x => x[1] === 'H').length, A = days.filter(x => x[1] === 'A').length;
  const m0 = monthStart(); const sales = sum(S.sales.filter(s => s.userId === u.id && s.status !== 'void' && s.ts >= m0), s => s.total);
  const earned = Math.round(u.salary / dim * (P + H * .5)), com = Math.round(sales * (u.commission || 0) / 100);
  const adv = sum(S.advances.filter(a => a.userId === u.id && a.ts >= m0), a => a.amount);
  return { P, H, A, sales, earned, com, adv, net: earned + com - adv, paid: S.payroll.find(p => p.userId === u.id && p.month === mk), dim };
}
VIEWS.staff = function () {
  SUB.tab = SUB.tab || 'team';
  const ids = scope(); const staff = tUsers().filter(u => u.role !== 'owner' && ids.includes(u.shopId));
  const tabs = [['team', 'Team & payroll'], ['att', 'Attendance'], ['adv', 'Advances']];
  const mk = monthKey(), d = new Date(Date.now() - BIZ), dim = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  let body = '';
  if (SUB.tab === 'team') {
    const rows = staff.map(u => ({ u, c: payCalc(u) }));
    body = `<div class="grid g4" style="margin-bottom:14px"><div class="card kpi"><div class="l">Staff</div><div class="v">${staff.length}</div></div><div class="card kpi"><div class="l">Payroll so far (${d.toLocaleDateString('en-IN', { month: 'short' })})</div><div class="v">${inr(sum(rows, r => r.c.net))}</div></div><div class="card kpi"><div class="l">Commission earned</div><div class="v">${inr(sum(rows, r => r.c.com))}</div></div><div class="card kpi"><div class="l">Advances this month</div><div class="v">${inr(sum(rows, r => r.c.adv))}</div></div></div>
    <div class="card"><h3>Team<span class="sp"></span>${role() === 'owner' ? `<button class="btn sm p" id="addst">${ic('plus')} Add staff</button>` : ''}</h3><div class="tbl"><table><tr><th>Name</th><th>Role · Shop</th><th class="r">Monthly salary</th><th class="r">P / ½ / A</th><th class="r">Sales (month)</th><th class="r">Earned</th><th class="r">Commission</th><th class="r">Advance</th><th class="r">Payable</th><th></th></tr>
    ${rows.map(({ u, c }) => `<tr><td><div class="row"><div class="av">${ini(u.name)}</div><div><div class="b small">${esc(u.name)}</div><div class="small mute">@${esc(u.username || '')} · ${esc(u.phone || '')}</div></div></div></td><td class="small">${u.role} · ${esc(shopById(u.shopId)?.name)}</td><td class="r">${inr(u.salary)}</td><td class="r small">${c.P} / ${c.H} / ${c.A}</td><td class="r">${inrK(c.sales)}</td><td class="r">${inr(c.earned)}</td><td class="r">${u.commission ? inr(c.com) + ` <span class="small mute">(${u.commission}%)</span>` : '—'}</td><td class="r">${c.adv ? '−' + inr(c.adv) : ''}</td><td class="r b">${inr(c.net)}</td><td>${c.paid ? '<span class="badge ok">Paid</span>' : `<button class="btn sm" data-pay="${u.id}">Pay</button>`}</td></tr>`).join('') || '<tr><td colspan="10" class="empty">No staff yet</td></tr>'}</table></div>
    <p class="small mute">Earned = monthly salary ÷ ${dim} days × (present + ½ half-days). Commission is a % of the salesman's locked bills. Paying posts a Salary expense.</p></div>`;
  }
  if (SUB.tab === 'att') {
    body = `<div class="card"><h3>Attendance — ${d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}<span class="sp"></span><span class="small mute">Tap a day to cycle Present → Half → Absent</span></h3><div style="overflow:auto"><table><tr><th>Staff</th><th><div class="att">${[...Array(dim)].map((_, i) => `<span style="width:24px;text-align:center">${i + 1}</span>`).join('')}</div></th></tr>
    ${staff.map(u => `<tr><td class="small b" style="white-space:nowrap">${esc(u.name)}</td><td><div class="att">${[...Array(dim)].map((_, i) => { const k = mk + '-' + pad(i + 1); const v = (S.attendance[u.id] || {})[k] || ''; const fut = i + 1 > d.getDate(); return `<button class="${v}" ${fut ? 'disabled style="opacity:.3"' : ''} data-at="${u.id}|${k}">${v}</button>`; }).join('')}</div></td></tr>`).join('')}</table></div></div>`;
  }
  if (SUB.tab === 'adv') {
    const list = S.advances.filter(a => staff.some(u => u.id === a.userId)).sort((a, b) => b.ts - a.ts);
    body = `<div class="grid g12"><div class="card"><h3>Give advance</h3><div class="grid"><div><label class="f">Staff</label><select id="avu">${staff.map(u => `<option value="${u.id}">${esc(u.name)}</option>`).join('')}</select></div><div><label class="f">Amount ₹</label><input id="ava" type="number" inputmode="numeric"></div><div><label class="f">Note</label><input id="avn"></div><button class="btn p" id="avs">Record advance</button><p class="small mute" style="margin:0">Deducted from this month's payable.</p></div></div>
    <div class="card"><h3>Advances</h3><table><tr><th>Date</th><th>Staff</th><th>Note</th><th class="r">Amount</th></tr>${list.map(a => `<tr><td class="small">${dtm(a.ts)}</td><td class="small b">${esc(userById(a.userId)?.name)}</td><td class="small">${esc(a.note)}</td><td class="r b">${inr(a.amount)}</td></tr>`).join('') || '<tr><td colspan="4" class="empty">None</td></tr>'}</table></div></div>`;
  }
  $('#view').innerHTML = `<div class="tabs">${tabs.map(([k, t]) => `<a data-t="${k}" class="${SUB.tab === k ? 'on' : ''}">${t}</a>`).join('')}</div>${body}`;
  $$('[data-t]').forEach(a => a.onclick = () => { SUB = { tab: a.dataset.t }; VIEWS.staff(); });
  $$('[data-at]').forEach(b => b.onclick = async () => {
    const [u, k] = b.dataset.at.split('|'); const cur = (S.attendance[u] || {})[k] || ''; const nx = { '': 'P', P: 'H', H: 'A', A: 'P' }[cur];
    b.className = nx; b.textContent = nx; await run(() => API.setAttendance(u, k, nx));
  });
  $$('[data-pay]').forEach(b => b.onclick = async () => {
    const u = userById(b.dataset.pay), c = payCalc(u); const ap = await askPin(`Pay ${u.name} ${inr(c.net)} for ${mk}`, u.shopId); if (!ap) return;
    const ok = await run(async () => { await API.paySalary(u.id, mk, c.net, ap.user.id, ap.pin); return true; }); if (ok) { toast('Salary recorded', 'ok'); VIEWS.staff(); }
  });
  if ($('#avs')) $('#avs').onclick = async () => { const a = +$('#ava').value; if (!a) { toast('Enter amount', 'bad'); return; } const ok = await run(async () => { await API.addAdvance($('#avu').value, a, $('#avn').value); return true; }, $('#avs')); if (ok) VIEWS.staff(); };
  if ($('#addst')) $('#addst').onclick = () => {
    const pinLen = API.mode === 'cloud' ? 6 : 4;
    modal(`<h2>Add staff</h2><div class="grid g2"><div><label class="f">Name</label><input id="nn"></div><div><label class="f">Username (for login)</label><input id="nu" class="mono" placeholder="e.g. ravi"></div><div><label class="f">Role</label><select id="nr"><option value="salesman">Salesman</option><option value="manager">Shop manager</option></select></div><div><label class="f">Shop</label><select id="ns">${tShops().map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select></div><div><label class="f">Monthly salary ₹</label><input id="nsal" type="number" value="12000"></div><div><label class="f">Commission % of sales</label><input id="ncom" type="number" step=".1" value="0.5"></div><div><label class="f">Phone</label><input id="np"></div><div><label class="f">PIN (${pinLen} digits)</label><input id="npin" class="mono" inputmode="numeric" maxlength="${pinLen}"></div></div>
    <p class="small mute">They sign in on the counter with workspace code <b class="mono">${esc(tenant().slug)}</b>, their username and this PIN. Managers also use it as their approval PIN.</p>
    <div id="nerr" class="flash bad" style="display:none"></div><div class="row" style="justify-content:flex-end;margin-top:14px"><button class="btn" id="ncancel">Cancel</button><button class="btn p" id="nsave">Add</button></div>`);
    $('#nn').oninput = e => { if (!$('#nu').dataset.t) $('#nu').value = slugify(e.target.value.split(' ')[0]); }; $('#nu').oninput = e => e.target.dataset.t = 1;
    $('#ncancel').onclick = closeModal;
    $('#nsave').onclick = async () => {
      const f = { name: $('#nn').value.trim(), username: slugify($('#nu').value), role: $('#nr').value, shopId: $('#ns').value, salary: +$('#nsal').value || 0, commission: +$('#ncom').value || 0, phone: $('#np').value, pin: $('#npin').value };
      const err = m => { $('#nerr').style.display = 'block'; $('#nerr').textContent = m; };
      if (!f.name || !f.username) return err('Name and username are required.');
      if (!new RegExp('^\\d{' + pinLen + '}$').test(f.pin)) return err(`PIN must be exactly ${pinLen} digits.`);
      const ok = await run(async () => { await API.addStaff(f); return true; }, $('#nsave'));
      if (ok) { closeModal(); toast(`${f.name} can now sign in`, 'ok'); VIEWS.staff(); }
    };
  };
};

/* ---------- REPORTS ---------- */
const REP = {};
VIEWS.reports = function () {
  SUB.tab = SUB.tab || 'close';
  const tabs = [['close', 'Day close'], ['sales', 'Sales report'], ['moves', 'Stock movements'], ['pl', 'Monthly P&L'], ['brands', 'Brand performance'], ['audit', 'Audit trail']];
  $('#view').innerHTML = `<div class="tabs">${tabs.map(([k, t]) => `<a data-t="${k}" class="${SUB.tab === k ? 'on' : ''}">${t}</a>`).join('')}</div><div id="rep"></div>`;
  $$('[data-t]').forEach(a => a.onclick = () => { SUB = { tab: a.dataset.t, rk: SUB.rk, rf: SUB.rf, rt: SUB.rt, rs: SUB.rs }; VIEWS.reports(); });
  REP[SUB.tab]();
};
REP.close = function () {
  SUB.date = SUB.date || dk(Date.now()); const sh = SUB.shop || scope()[0]; const d0 = d0of(SUB.date);
  if (S.loadedFrom && d0 < S.loadedFrom) { $('#rep').innerHTML = '<div class="card empty"><span class="spin dk"></span> Loading…</div>'; API.ensureRange(d0).then(() => REP.close(), e => toast(errText(e), 'bad')); return; }
  const all = S.sales.filter(s => s.shopId === sh && s.ts >= d0 && s.ts < d0 + DAY), live = all.filter(s => s.status !== 'void');
  const cash = sum(live, s => s.cash), upi = sum(live, s => s.upi), cex = sum(S.expenses.filter(e => e.shopId === sh && e.ts >= d0 && e.ts < d0 + DAY && e.mode === 'Cash'), e => e.amount);
  const credit = sum(live, s => s.credit || 0), cpay = (S.creditPayments || []).filter(p => p.shopId === sh && p.ts >= d0 && p.ts < d0 + DAY);
  const ccash = sum(cpay.filter(p => p.mode === 'Cash'), p => p.amount), cupi = sum(cpay.filter(p => p.mode === 'UPI'), p => p.amount);
  const expected = cash + ccash - cex; const closed = S.closings.find(c => c.shopId === sh && c.date === SUB.date);
  const counted = SUB.counted ?? (closed ? closed.counted : ''); const v = counted === '' ? null : +counted - expected;
  const byU = {}; live.forEach(s => { byU[s.userId] = byU[s.userId] || { c: 0, u: 0, n: 0 }; byU[s.userId].c += s.cash; byU[s.userId].u += s.upi; byU[s.userId].n++; });
  $('#rep').innerHTML = `<div class="grid g12"><div class="card"><h3>Close the day</h3><div class="grid">
   <div class="row">${role() === 'owner' ? `<select id="csh2" style="width:auto">${tShops().map(s => `<option value="${s.id}" ${s.id === sh ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select>` : ''}<input type="date" id="cd" value="${SUB.date}" style="width:auto"></div>
   <div class="sw"><span>Gross sales (${live.length} bills)</span><b>${inr(cash + upi + credit)}</b></div>
   <div class="sw"><span>UPI received</span><b>${inr(upi)}</b></div>
   ${credit ? `<div class="sw"><span>Udhar given (not in drawer)</span><b style="color:var(--warn)">${inr(credit)}</b></div>` : ''}
   <div class="sw"><span>Cash sales</span><b>${inr(cash)}</b></div>
   ${ccash || cupi ? `<div class="sw"><span>Udhar collected in cash</span><b>+ ${inr(ccash)}</b></div>${cupi ? `<div class="sw"><span>Udhar collected by UPI</span><b>${inr(cupi)}</b></div>` : ''}` : ''}
   <div class="sw"><span>Cash expenses paid from counter</span><b>− ${inr(cex)}</b></div>
   <div class="sw"><span class="b">Expected cash in drawer</span><b style="font-size:18px">${inr(expected)}</b></div>
   <div><label class="f">Cash counted in drawer ₹</label><input id="ccount" type="number" inputmode="numeric" value="${esc(counted)}" ${closed ? 'disabled' : ''}></div>
   ${v != null ? `<div class="flash ${v === 0 ? 'ok' : Math.abs(v) <= 100 ? 'info' : 'bad'}">${v === 0 ? 'Cash tallies exactly.' : v > 0 ? `Excess cash ${inr(v)}` : `Short by ${inr(-v)}`}</div>` : ''}
   ${closed ? `<div class="flash ok">${ic('lock', 14)} Day closed by ${esc(userById(closed.by)?.name || '')} at ${dtm(closed.ts)}</div>` : `<button class="btn p" id="cclose" ${counted === '' ? 'disabled' : ''}>${ic('lock')} Close day & lock</button>`}
   <button class="btn" id="ccopy">${ic('copy')} Copy closing summary</button></div></div>
   <div class="card"><h3>Collection by salesman</h3><table><tr><th>Salesman</th><th class="r">Bills</th><th class="r">Cash to hand over</th><th class="r">UPI</th></tr>${Object.entries(byU).map(([u, x]) => `<tr><td class="b small">${esc(userById(u)?.name)}</td><td class="r">${x.n}</td><td class="r b">${inr(x.c)}</td><td class="r">${inr(x.u)}</td></tr>`).join('') || '<tr><td colspan="4" class="empty">No bills</td></tr>'}</table>
   <h3 style="margin-top:18px">Exceptions</h3><table><tr><th>Bill</th><th>Issue</th><th class="r">Amount</th></tr>${all.filter(s => s.status === 'void' || s.items.some(i => i.m === 'ovr') || s.discount > 0).map(s => `<tr><td class="mono small">${s.no}</td><td class="small">${s.status === 'void' ? '<span class="badge bad">Void</span> ' + esc(s.voidReason) : s.items.some(i => i.m === 'ovr') ? '<span class="badge warn">Manual override</span>' : `<span class="badge warn">${t('Discount')}</span> − ${inr(s.discount)}`}</td><td class="r">${inr(s.total)}</td></tr>`).join('') || '<tr><td colspan="3" class="empty">No exceptions 🎉</td></tr>'}</table></div></div>`;
  if ($('#csh2')) $('#csh2').onchange = e => { SUB = { tab: 'close', shop: e.target.value, date: SUB.date }; REP.close(); };
  $('#cd').onchange = e => { SUB = { tab: 'close', shop: sh, date: e.target.value }; REP.close(); };
  $('#ccount').onchange = e => { SUB.counted = e.target.value; SUB.shop = sh; REP.close(); };
  if ($('#cclose')) $('#cclose').onclick = async () => { const ok = await run(async () => { await API.closeDay(sh, SUB.date, expected, +counted); return true; }, $('#cclose')); if (ok) { toast('Day closed', 'ok'); REP.close(); } };
  $('#ccopy').onclick = () => copyText(`${tenant().name} — ${shopById(sh).name}\nDay close ${SUB.date}\nBills: ${live.length}\nGross: ${inr(cash + upi + credit)}\nUPI: ${inr(upi)}\nCash: ${inr(cash)}\nUdhar given: ${inr(credit)}\nUdhar collected: ${inr(ccash + cupi)}\nCash expenses: ${inr(cex)}\nExpected drawer: ${inr(expected)}${v != null ? `\nCounted: ${inr(counted)}\nVariance: ${inr(v)}` : ''}\nVoids: ${all.length - live.length}`);
};
REP.pl = function () {
  const ids = scope(), d = new Date(Date.now() - BIZ), m0 = monthStart();
  const ls = liveSales(ids, m0), rev = sum(ls, s => s.total), cogs = sum(ls, s => s.cost);
  const ex = S.expenses.filter(e => ids.includes(e.shopId) && e.ts >= m0); const bc = {}; ex.forEach(e => bc[e.cat] = (bc[e.cat] || 0) + e.amount);
  const pending = sum(tUsers().filter(u => ids.includes(u.shopId) && u.role !== 'owner'), u => { const c = payCalc(u); return c.paid ? 0 : c.net; });
  const tex = sum(ex, e => e.amount);
  const row = (l, v, b, neg) => `<div class="sw"><span class="${b ? 'b' : ''}">${l}</span><span class="${b ? 'b' : ''}">${neg ? '− ' : ''}${inr(v)}</span></div>`;
  $('#rep').innerHTML = `<div class="grid g2"><div class="card"><h3>Profit & loss — ${d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })} to date</h3>
  ${row('Sales', rev, true)}${row('Cost of goods sold', cogs, false, true)}${row('Gross margin (' + (rev ? (100 * (rev - cogs) / rev).toFixed(1) : 0) + '%)', rev - cogs, true)}
  ${Object.entries(bc).sort((a, b) => b[1] - a[1]).map(([k, v]) => row(k, v, false, true)).join('')}
  ${row('Salary accrued, not yet paid', pending, false, true)}
  <div class="sw" style="border-top:2px solid var(--ink);margin-top:6px"><span class="b" style="font-size:16px">Net profit</span><span class="b" style="font-size:16px;color:${rev - cogs - tex - pending >= 0 ? 'var(--ok)' : 'var(--bad)'}">${inr(rev - cogs - tex - pending)}</span></div></div>
  <div class="card"><h3>Per shop</h3><table><tr><th>Shop</th><th class="r">Sales</th><th class="r">Margin</th><th class="r">Expenses</th><th class="r">Net</th></tr>${ids.map(id => { const a = ls.filter(s => s.shopId === id), r = sum(a, s => s.total), m = r - sum(a, s => s.cost), e = sum(ex.filter(x => x.shopId === id), x => x.amount); return `<tr><td class="b">${esc(shopById(id).name)}</td><td class="r">${inrK(r)}</td><td class="r">${inrK(m)}</td><td class="r">${inrK(e)}</td><td class="r b">${inrK(m - e)}</td></tr>`; }).join('')}</table></div></div>`;
};
REP.brands = function () {
  const ids = scope(), t0 = sod(Date.now()) - 6 * DAY; const ls = liveSales(ids, t0); const m = {};
  ls.forEach(s => s.items.forEach(i => { const p = prodById(i.pid); if (!p) return; const k = p.brand; m[k] = m[k] || { q: 0, r: 0, g: 0, cat: p.category, packs: {} }; m[k].q += i.qty; m[k].r += i.qty * i.price; m[k].g += i.qty * (i.price - i.cost); m[k].packs[p.pack] = (m[k].packs[p.pack] || 0) + i.qty; }));
  const rows = Object.entries(m).sort((a, b) => b[1].r - a[1].r); const tot = sum(rows, r => r[1].r) || 1;
  $('#rep').innerHTML = `<div class="card"><h3>Brand performance — last 7 days</h3><div class="tbl"><table><tr><th>Brand</th><th>Category</th><th>Pack mix</th><th class="r">Units</th><th class="r">Sales</th><th class="r">Share</th><th class="r">Margin</th></tr>${rows.map(([b, v]) => `<tr><td class="b">${esc(b)}</td><td class="small">${v.cat}</td><td class="small">${Object.entries(v.packs).map(([k, q]) => `${k} ${q}`).join(' · ')}</td><td class="r">${v.q}</td><td class="r b">${inrK(v.r)}</td><td class="r"><div style="display:flex;align-items:center;gap:6px;justify-content:flex-end"><div style="width:60px;height:6px;background:var(--chip);border-radius:3px"><div style="width:${(v.r / tot * 100).toFixed(1)}%;height:100%;background:var(--brand);border-radius:3px"></div></div>${(v.r / tot * 100).toFixed(1)}%</div></td><td class="r">${inrK(v.g)}</td></tr>`).join('') || '<tr><td colspan="7" class="empty">No sales yet</td></tr>'}</table></div></div>`;
};
REP.audit = function () {
  const a = S.audit.filter(x => x.t === SES.tenantId).sort((x, y) => y.ts - x.ts);
  $('#rep').innerHTML = `<div class="card"><h3>${ic('shield', 16)} Audit trail<span class="sp"></span><span class="small mute">Every override, void, stock change and payment</span></h3><div class="tbl"><table><tr><th>When</th><th>Who</th><th>Action</th><th>Detail</th></tr>${a.map(x => `<tr><td class="small">${dtm(x.ts)}</td><td class="small b">${esc(userById(x.by)?.name || (x.by === 'u0' ? 'Platform Admin' : 'System'))}</td><td class="small">${esc(x.a)}</td><td class="small">${esc(x.d)}</td></tr>`).join('') || '<tr><td colspan="4" class="empty">Nothing yet</td></tr>'}</table></div>${API.mode === 'cloud' ? '<p class="small mute">Shows the latest 300 entries loaded at sign-in. Sign out and in again to refresh.</p>' : ''}</div>`;
};

/* ---------- SETTINGS (white label) ---------- */
VIEWS.settings = function () {
  const t = tenant(), P = pol();
  const sw = (k, l, d) => `<div class="sw"><div><div class="b">${l}</div><div class="small mute">${d}</div></div><label class="tg"><input type="checkbox" data-pol="${k}" ${P[k] ? 'checked' : ''}><span></span></label></div>`;
  $('#view').innerHTML = `<div class="grid g2"><div class="card"><h3>White-label branding</h3><div class="grid">
   <div class="row"><div class="mark" style="width:54px;height:54px;font-size:18px">${esc(t.logo)}</div><div><div class="b" style="font-size:16px">${esc(t.name)}</div><div class="small mute">Workspace code: <span class="mono">${esc(t.slug)}</span></div></div></div>
   <div class="grid g2"><div><label class="f">Business name</label><input id="bn" value="${esc(t.name)}"></div><div><label class="f">Logo initials</label><input id="bl" value="${esc(t.logo)}" maxlength="3"></div></div>
   <div><label class="f">Tagline</label><input id="bt" value="${esc(t.tagline)}"></div>
   <div class="grid g2"><div><label class="f">Brand colour</label><input id="bc" type="color" value="${t.color}" style="height:42px;padding:4px"></div><div><label class="f">Workspace code (staff type this to sign in)</label><input id="bs" value="${esc(t.slug)}" class="mono" ${API.mode === 'cloud' ? 'disabled title="Fixed after creation because staff logins use it"' : ''}></div></div>
   <div><label class="f">Receipt footer</label><input id="bf" value="${esc(t.footer)}"></div>
   <div><label class="f">Owner WhatsApp number (reports are sent here)</label><input id="bwa" value="${esc(P.ownerPhone || '')}" inputmode="tel" placeholder="98XXXXXXXX"></div>
   <button class="btn p" id="bsave">Save branding</button></div></div>
  <div class="card"><h3>${ic('lock', 16)} Sale-lock policies</h3>
   ${sw('requireScan', 'Require scan to sell', 'Only barcode or AI-matched products can be billed')}
   ${sw('override', 'Allow manager override', 'Manual add with manager PIN; flagged on the bill')}
   ${sw('mrpLock', 'Lock price at MRP', 'Salesmen cannot change prices')}
   ${sw('stockLock', 'Block sale beyond stock', 'Prevents billing bottles the system says you don\'t have')}
  <div class="card"><h3>Shops & UPI</h3><div class="tbl" style="border:0"><table><tr><th>Main store</th><th>Shop</th><th>Code</th><th>Licence</th><th>UPI ID</th></tr>${tShops().map(s => `<tr><td class="c"><input type="radio" name="mainshop" value="${s.id}" ${s.isMain ? 'checked' : ''} style="width:auto"></td><td><input data-sh="${s.id}|name" value="${esc(s.name)}"></td><td class="mono small">${s.code}</td><td><input data-sh="${s.id}|license" value="${esc(s.license)}" class="mono"></td><td><input data-sh="${s.id}|upi" value="${esc(s.upi)}" class="mono" placeholder="name@bank"></td></tr>`).join('')}</table></div>
   <div class="row" style="margin-top:12px"><button class="btn" id="addshop">${ic('plus')} Add shop</button><span class="sp"></span><span class="small mute">Changes save when you leave a field · ★ = main store / godown (default source for transfers)</span></div></div>
  <div class="card"><h3>${ic('scan', 16)} Barcode scanner test</h3><p class="mute small" style="margin-top:0">Click the box and scan any bottle. It shows what your USB / Bluetooth scanner sends and whether it is set up correctly.</p><input id="sctest" class="mono" placeholder="Click here, then scan" autocomplete="off"><div id="scout"></div></div>
  <div class="card"><h3>${API.mode === 'demo' ? 'Demo tools' : 'Connection'}</h3>${API.mode === 'demo' ? `<p class="mute" style="margin-top:0">This demo keeps its data in this browser. Reset to regenerate 7 days of realistic sales.</p><div class="row wrap"><button class="btn" id="simt"><span class="dot ${S.sim ? 'live' : ''}"></span> ${S.sim ? 'Stop' : 'Start'} live sales stream</button><button class="btn d" id="reset">Reset demo data</button></div>` : `<p class="mute" style="margin-top:0">Connected to Supabase. Bills, stock and staff are shared live across every device signed in to this workspace.</p><div class="small mono mute">${esc(MX_CONFIG.supabaseUrl)}</div>`}</div></div>`;
  scannerTest($('#sctest'), $('#scout'));
  $$('[name=mainshop]').forEach(r => r.onchange = async () => { const ok = await run(async () => { await API.setMainShop(r.value); return true; }); if (ok) toast('Main store set', 'ok'); });
  $('#bsave').onclick = async () => {
    const ph = normPhone($('#bwa').value); if ($('#bwa').value && ph.length !== 10) { toast('Enter a 10-digit mobile number', 'bad'); return; }
    await API.saveTenant({ pol: { ...pol(), ownerPhone: ph } });
    const patch = { name: $('#bn').value || t.name, logo: ($('#bl').value || t.logo).toUpperCase(), tagline: $('#bt').value, color: $('#bc').value, ...(API.mode === 'cloud' ? {} : { slug: slugify($('#bs').value) || t.slug }), footer: $('#bf').value };
    const ok = await run(async () => { await API.saveTenant(patch); return true; }, $('#bsave')); if (ok) { toast('Branding saved', 'ok'); render(); }
  };
  $('#bc').oninput = e => setBrand(e.target.value);
  $$('[data-pol]').forEach(i => i.onchange = () => run(() => API.saveTenant({ pol: { ...pol(), [i.dataset.pol]: i.checked } })).then(() => toast('Policy updated')));
  $$('[data-sh]').forEach(i => i.onchange = () => { const [id, k] = i.dataset.sh.split('|'); run(() => API.saveShop(id, { [k]: i.value })); });
  $('#addshop').onclick = async () => { await run(() => API.addShop(), $('#addshop')); render(); };
  if ($('#simt')) $('#simt').onclick = () => { S.sim = !S.sim; API.save(); render(); };
  if ($('#reset')) $('#reset').onclick = () => { modal(`<h2>Reset demo data?</h2><p class="mute">All bills, stock, staff and settings in this browser go back to the starting demo.</p><div class="row" style="justify-content:flex-end"><button class="btn" id="rsn">Cancel</button><button class="btn p" id="rsy">Reset</button></div>`); $('#rsn').onclick = closeModal; $('#rsy').onclick = async () => { API.reset(); closeModal(); await logout(); }; };
};
