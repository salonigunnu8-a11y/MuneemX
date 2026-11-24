/* =========================================================
   MuneemX — Inventory, Expenses, Staff & Salary, Reports, Settings
   ========================================================= */
'use strict';

/* ---------- INVENTORY ---------- */
const INV = {};
VIEWS.inventory = function () {
  SUB.tab = SUB.tab || 'stock';
  const tabs = [['stock', 'Stock'], ['inward', 'Stock inward'], ...(tShops().length > 1 && role() === 'owner' ? [['transfer', 'Transfer']] : []), ['count', 'Physical count'], ['register', 'Daily register'], ['links', 'Link barcodes'], ['catalog', 'Product catalog']];
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
  <div class="tbl"><table><tr><th>Product</th><th>Pack</th><th>Barcode</th><th class="r">MRP</th>${ids.length > 1 ? ids.map(id => `<th class="r">${esc(shopById(id).name)}</th>`).join('') : ''}<th class="r">Stock</th><th></th></tr>
  ${rows.map(r => `<tr><td><div class="b small">${esc(pname(r.p))}</div><div class="small mute">${r.p.category}</div></td><td class="small">${ppack(r.p)}</td><td class="mono small">${r.p.barcode}</td><td class="r">${inr(r.p.mrp)}</td>${ids.length > 1 ? r.per.map(x => `<td class="r">${x}</td>`).join('') : ''}<td class="r b">${r.q}</td><td>${r.q <= 0 ? '<span class="badge bad">Out</span>' : r.q <= lowAt(r.p, ids.length) ? '<span class="badge warn">Low</span>' : '<span class="badge ok">OK</span>'}</td></tr>`).join('')}</table></div></div>`;
  $('#iq').oninput = e => { SUB.q = e.target.value; INV.stock(); const n = $('#iq'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); };
  $('#ic').onchange = e => { SUB.cat = e.target.value; INV.stock(); };
  $('#icsv').onclick = () => copyText(['Product,Pack,Size ml,Barcode,MRP,' + ids.map(id => shopById(id).name).join(',') + ',Total', ...rows.map(r => `"${pname(r.p)}",${r.p.pack},${r.p.sizeMl},${r.p.barcode},${r.p.mrp},${r.per.join(',')},${r.q}`)].join('\n'));
};
function productPicker(sel, onPick) {
  const el = $(sel); el.innerHTML = `<div class="row"><input placeholder="Scan barcode or search product" class="pp-in"><button class="btn" type="button" data-ppcam>${ic('cam')}</button></div><div class="pp-res"></div>`;
  const inp = el.querySelector('.pp-in'), res = el.querySelector('.pp-res');
  const byCode = code => { code = normCode(code); const p = findByBarcode(code); if (p) { onPick(p); beep(true); } else { beep(false); linkBarcodeModal(code, onPick); } };
  SCAN_HANDLER = byCode;
  el.querySelector('[data-ppcam]').onclick = () => openCamera(byCode);
  inp.onkeydown = e => { if (e.key === 'Enter' && inp.value.trim()) { e.preventDefault(); const v = inp.value; inp.value = ''; res.innerHTML = ''; byCode(v); } };
  inp.oninput = () => {
    const q = inp.value.toLowerCase().trim(); if (q.length < 2 || /^\d+$/.test(q)) { res.innerHTML = ''; return; } const w = q.split(/\s+/);
    const r = visibleProducts().filter(p => w.every(x => (pname(p) + ' ' + p.pack + ' ' + p.sizeMl).toLowerCase().includes(x))).slice(0, 6);
    res.innerHTML = r.map(p => `<button class="urow" style="margin-top:6px" data-pp="${p.id}"><div class="sp"><div class="b small">${esc(pname(p))}</div><div class="small mute">${ppack(p)} · ${p.barcode}</div></div></button>`).join('');
    res.querySelectorAll('[data-pp]').forEach(b => b.onclick = () => onPick(prodById(b.dataset.pp)));
  };
}
function invShopSel(id, label, cur) { const list = role() === 'owner' ? tShops().map(s => s.id) : [S.me.shopId]; const v = cur || (scope().length === 1 ? scope()[0] : list[0]); return `<div><label class="f">${label || 'Shop'}</label><select id="${id}">${list.map(x => `<option value="${x}" ${x === v ? 'selected' : ''}>${esc(shopById(x).name)}</option>`).join('')}</select></div>`; }
INV.inward = function () {
  SUB.lines = SUB.lines || [];
  const hist = S.moves.filter(m => m.type === 'inward' && scope().includes(m.shopId)); const byRef = {};
  hist.forEach(m => { const k = m.shopId + '|' + m.ref; byRef[k] = byRef[k] || { ref: m.ref, shop: m.shopId, ts: m.ts, party: m.party, q: 0, v: 0 }; byRef[k].q += m.qty; byRef[k].v += m.qty * (prodById(m.pid)?.cost || 0); });
  $('#inv').innerHTML = `<div class="grid g12"><div class="card"><h3>Receive stock</h3>
   <div class="grid">${invShopSel('ish', 'Shop', SUB.shop)}<div><label class="f">Supplier / depot</label><input id="isup" value="${esc(SUB.sup || '')}" placeholder="e.g. State Beverages Depot"></div><div><label class="f">Invoice / permit no.</label><input id="iinv" value="${esc(SUB.inv || '')}" placeholder="e.g. TP/2026/88123"></div>
   <div><label class="f">Add products (scan cases or search)</label><div id="ipick"></div></div></div></div>
   <div class="card"><h3>Lines<span class="sp"></span><span class="small mute">${sum(SUB.lines, l => l.q)} units · ${inr(sum(SUB.lines, l => l.q * prodById(l.pid).cost))} at cost</span></h3>
   ${SUB.lines.length ? `<table><tr><th>Product</th><th class="r">Qty (bottles)</th><th></th></tr>${SUB.lines.map((l, i) => { const p = prodById(l.pid); return `<tr><td><div class="b small">${esc(pname(p))}</div><div class="small mute">${ppack(p)}</div></td><td class="r"><input type="number" min="1" value="${l.q}" data-iq="${i}" style="width:100px;text-align:right"></td><td><button class="btn sm d" data-ix="${i}">Remove</button></td></tr>`; }).join('')}</table>
   <div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn p" id="isave">Receive into stock</button></div>` : '<div class="empty">Scan or search products to add them</div>'}
   <h3 style="margin-top:18px">Recent receipts</h3><div class="tbl" style="max-height:240px"><table><tr><th>Date</th><th>Shop</th><th>Ref</th><th>Supplier</th><th class="r">Units</th><th class="r">Value</th></tr>${Object.values(byRef).sort((a, b) => b.ts - a.ts).slice(0, 12).map(r => `<tr><td class="small">${dtm(r.ts)}</td><td class="small">${esc(shopById(r.shop)?.name)}</td><td class="mono small">${esc(r.ref)}</td><td class="small">${esc(r.party || '')}</td><td class="r">${r.q}</td><td class="r">${inr(r.v)}</td></tr>`).join('') || '<tr><td colspan="6" class="empty">None yet</td></tr>'}</table></div></div></div>`;
  const keep = () => { SUB.sup = $('#isup').value; SUB.inv = $('#iinv').value; SUB.shop = $('#ish').value; };
  productPicker('#ipick', p => { keep(); const l = SUB.lines.find(l => l.pid === p.id); const def = p.pack === 'Quarter' ? 48 : p.pack === 'Half' ? 24 : 12; if (l) l.q += def; else SUB.lines.push({ pid: p.id, q: def }); INV.inward(); const i = $('.pp-in'); if (i) i.focus(); });
  $$('[data-iq]').forEach(i => i.onchange = () => { SUB.lines[+i.dataset.iq].q = Math.max(1, +i.value || 1); });
  $$('[data-ix]').forEach(b => b.onclick = () => { keep(); SUB.lines.splice(+b.dataset.ix, 1); INV.inward(); });
  if ($('#isave')) $('#isave').onclick = async () => {
    keep(); const ref = SUB.inv || ('GRN-' + Date.now().toString().slice(-6));
    const ok = await run(async () => { await API.receiveStock(SUB.shop, ref, SUB.sup, SUB.lines); return true; }, $('#isave'));
    if (ok) { toast('Stock received', 'ok'); SUB = { tab: 'inward', shop: SUB.shop, sup: SUB.sup }; INV.inward(); }
  };
};
INV.transfer = function () {
  SUB.lines = SUB.lines || [];
  $('#inv').innerHTML = `<div class="grid g12"><div class="card"><h3>Move stock between shops</h3><div class="grid">${invShopSel('tfrom', 'From shop', SUB.from)}${invShopSel('tto', 'To shop', SUB.to || (tShops()[1] || {}).id)}<div><label class="f">Add products</label><div id="tpick"></div></div></div></div>
  <div class="card"><h3>Transfer lines</h3>${SUB.lines.length ? `<table><tr><th>Product</th><th class="r">Qty</th><th></th></tr>${SUB.lines.map((l, i) => { const p = prodById(l.pid); return `<tr><td class="small b">${esc(pname(p))} · ${ppack(p)}</td><td class="r"><input type="number" min="1" value="${l.q}" data-tq="${i}" style="width:90px;text-align:right"></td><td><button class="btn sm d" data-tx="${i}">Remove</button></td></tr>`; }).join('')}</table><div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn p" id="tsave">Transfer</button></div>` : '<div class="empty">Add products to move</div>'}</div></div>`;
  const keep = () => { SUB.from = $('#tfrom').value; SUB.to = $('#tto').value; };
  productPicker('#tpick', p => { keep(); SUB.lines.push({ pid: p.id, q: 6 }); INV.transfer(); });
  $$('[data-tq]').forEach(i => i.onchange = () => { SUB.lines[+i.dataset.tq].q = Math.max(1, +i.value || 1); });
  $$('[data-tx]').forEach(b => b.onclick = () => { keep(); SUB.lines.splice(+b.dataset.tx, 1); INV.transfer(); });
  if ($('#tsave')) $('#tsave').onclick = async () => {
    keep(); if (SUB.from === SUB.to) { toast('Pick two different shops', 'bad'); return; }
    const ref = await run(() => API.transferStock(SUB.from, SUB.to, SUB.lines), $('#tsave'));
    if (ref) { toast('Transferred · ' + ref, 'ok'); SUB = { tab: 'transfer', from: SUB.from, to: SUB.to }; INV.transfer(); }
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
INV.register = function () {
  SUB.date = SUB.date || dk(Date.now()); const sh = SUB.shop || scope()[0];
  const d0 = d0of(SUB.date), d1 = d0 + DAY;
  if (S.loadedFrom && d0 < S.loadedFrom) { $('#inv').innerHTML = '<div class="card empty"><span class="spin dk"></span> Loading…</div>'; API.ensureRange(d0).then(() => INV.register(), e => toast(errText(e), 'bad')); return; }
  const shopSales = S.sales.filter(s => s.shopId === sh && s.status !== 'void'), shopMoves = S.moves.filter(m => m.shopId === sh);
  const rows = visibleProducts().map(p => {
    const cur = stockOf(sh, p.id);
    const after = t => ({ mv: sum(shopMoves.filter(m => m.pid === p.id && m.ts >= t), m => m.qty), sold: sum(shopSales.filter(s => s.ts >= t), s => sum(s.items.filter(i => i.pid === p.id), i => i.qty)) });
    const a1 = after(d1), a0 = after(d0); const close = cur - a1.mv + a1.sold, open = cur - a0.mv + a0.sold;
    return { p, open, inw: a0.mv - a1.mv, sold: a0.sold - a1.sold, close };
  }).filter(r => r.open || r.inw || r.sold || r.close);
  $('#inv').innerHTML = `<div class="card"><h3>Daily stock register<span class="sp"></span><span class="small mute">Opening + received − sold = closing, per product</span></h3>
  <div class="row wrap" style="margin-bottom:12px"><input type="date" id="rd" value="${SUB.date}" style="width:auto">${role() === 'owner' ? `<select id="rsh" style="width:auto">${tShops().map(s => `<option value="${s.id}" ${s.id === sh ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select>` : ''}<span class="sp"></span><button class="btn" id="rcsv">${ic('copy')} Copy CSV</button></div>
  <div class="tbl"><table><tr><th>Product</th><th>Pack</th><th class="r">Opening</th><th class="r">Received</th><th class="r">Sold</th><th class="r">Closing</th><th class="r">Sales ₹</th></tr>${rows.map(r => `<tr><td class="small b">${esc(pname(r.p))}</td><td class="small">${ppack(r.p)}</td><td class="r">${r.open}</td><td class="r">${r.inw || ''}</td><td class="r b">${r.sold || ''}</td><td class="r">${r.close}</td><td class="r">${r.sold ? inr(r.sold * r.p.mrp) : ''}</td></tr>`).join('')}
  <tr style="background:var(--soft)"><td class="b">Total</td><td></td><td class="r b">${sum(rows, r => r.open)}</td><td class="r b">${sum(rows, r => r.inw)}</td><td class="r b">${sum(rows, r => r.sold)}</td><td class="r b">${sum(rows, r => r.close)}</td><td class="r b">${inr(sum(rows, r => r.sold * r.p.mrp))}</td></tr></table></div></div>`;
  $('#rd').onchange = e => { SUB.date = e.target.value; SUB.shop = sh; INV.register(); }; if ($('#rsh')) $('#rsh').onchange = e => { SUB.shop = e.target.value; INV.register(); };
  $('#rcsv').onclick = () => copyText(['Product,Pack,Size,Opening,Received,Sold,Closing', ...rows.map(r => `"${pname(r.p)}",${r.p.pack},${r.p.sizeMl},${r.open},${r.inw},${r.sold},${r.close}`)].join('\n'));
};
INV.links = function () {
  const rows = Object.entries(S.barcodes || {}).map(([code, pid]) => ({ code, p: prodById(pid) })).filter(r => r.p).sort((a, b) => pname(a.p).localeCompare(pname(b.p)));
  $('#inv').innerHTML = `<div class="grid g12"><div class="card"><h3>${ic('scan', 16)} Teach your real barcodes</h3>
   <p class="mute small" style="margin-top:0">Bottles from your depot carry the manufacturer's barcode. Scan each new bottle once here and pick its product. After that, Scan & Sell bills it instantly at every shop.</p>
   <div class="row"><input id="lkin" placeholder="Scan or type barcode ⏎" class="mono" autocomplete="off" inputmode="numeric"><button class="btn p" id="lkcam">${ic('cam')} Camera</button></div>
   <div id="lkmsg"></div></div>
   <div class="card"><h3>Linked barcodes<span class="sp"></span><span class="small mute">${rows.length}</span></h3>
   <div class="tbl"><table><tr><th>Barcode</th><th>Product</th><th>Pack</th><th></th></tr>${rows.map(r => `<tr><td class="mono small">${esc(r.code)}</td><td class="small b">${esc(pname(r.p))}</td><td class="small">${ppack(r.p)}</td><td class="r"><button class="btn sm d" data-unl="${esc(r.code)}">Remove</button></td></tr>`).join('') || '<tr><td colspan="4" class="empty">No linked barcodes yet — scan a bottle to start</td></tr>'}</table></div></div></div>`;
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
  const F = SUB.f || (SUB.f = { brand: '', name: '', category: 'Whisky', pack: 'Quarter', sizeMl: 180, mrp: '', cost: '', barcode: '' });
  const own = S.products.filter(p => p.tenantId === SES.tenantId);
  $('#inv').innerHTML = `<div class="grid g12"><div class="card"><h3>Enroll a product</h3>
   <div class="row wrap" style="margin-bottom:12px"><button class="btn p" id="cai">${ic('spark')} Fill from label photo</button><button class="btn" id="cbc">${ic('cam')} Barcode from photo</button></div>
   <div id="cmsg"></div>
   <div class="grid g2"><div><label class="f">Brand</label><input data-f="brand" value="${esc(F.brand)}"></div><div><label class="f">Variant</label><input data-f="name" value="${esc(F.name)}"></div>
   <div><label class="f">Category</label><select data-f="category">${CATS.map(c => `<option ${F.category === c ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
   <div><label class="f">Pack</label><select data-f="pack">${PACKS.map(c => `<option ${F.pack === c ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
   <div><label class="f">Size (ml)</label><input type="number" data-f="sizeMl" value="${esc(F.sizeMl)}"></div><div><label class="f">MRP ₹</label><input type="number" data-f="mrp" value="${esc(F.mrp)}"></div>
   <div><label class="f">Cost ₹</label><input type="number" data-f="cost" value="${esc(F.cost)}" placeholder="auto 84% of MRP"></div><div><label class="f">Barcode</label><input data-f="barcode" value="${esc(F.barcode)}" class="mono" placeholder="scan or leave blank"></div></div>
   <div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn p" id="csave">${ic('plus')} Save to database</button></div>
   <p class="small mute">Once saved, the product can be billed by barcode or AI label scan at every shop in this workspace. Unknown products stay locked out of billing.</p></div>
   <div class="card"><h3>Your catalog<span class="sp"></span><span class="small mute">${visibleProducts().length} products · ${own.length} added by you · rest from MuneemX master list</span></h3>
   <div class="tbl"><table><tr><th>Product</th><th>Pack</th><th>Barcode</th><th class="r">MRP</th><th class="r">Cost</th><th>Source</th></tr>${[...own, ...S.products.filter(p => !p.tenantId)].map(p => `<tr><td><div class="b small">${esc(pname(p))}</div><div class="small mute">${p.category}</div></td><td class="small">${ppack(p)}</td><td class="mono small">${p.barcode}</td><td class="r">${inr(p.mrp)}</td><td class="r">${inr(p.cost)}</td><td>${p.tenantId ? `<span class="badge br">${p.src === 'ai' ? 'AI enrolled' : 'Added'}</span>` : '<span class="badge">Master</span>'}</td></tr>`).join('')}</table></div></div></div>`;
  $$('[data-f]').forEach(i => i.oninput = i.onchange = () => { F[i.dataset.f] = i.value; if (i.dataset.f === 'pack' && PACK_ML[i.value]) { F.sizeMl = PACK_ML[i.value]; $('[data-f=sizeMl]').value = F.sizeMl; } });
  const msg = (h, k) => $('#cmsg').innerHTML = `<div class="flash ${k}" style="margin:0 0 12px">${h}</div>`;
  $('#cbc').onclick = () => fileInput(async f => { msg('Reading barcode…', 'info'); const c = await decodeBarcode(f); if (c) { F.barcode = c; INV.catalog(); msg('Barcode read: <span class="mono">' + esc(c) + '</span>', 'ok'); } else msg('No barcode found in that photo.', 'bad'); });
  $('#cai').onclick = () => fileInput(async f => {
    msg('<span class="spin dk"></span> AI is reading the label…', 'info');
    try {
      const [r, code] = await Promise.all([aiEnroll(f), decodeBarcode(f)]);
      Object.assign(F, { brand: r.brand || F.brand, name: r.name || F.name, category: CATS.includes(r.category) ? r.category : F.category, pack: PACKS.includes(r.pack) ? r.pack : F.pack, sizeMl: r.size_ml || F.sizeMl, mrp: r.mrp || F.mrp, barcode: code || r.barcode || F.barcode, _ai: true });
      INV.catalog(); msg(`AI filled the form — check it, add MRP if missing, then save. ${esc(r.note || '')}`, 'ok');
    } catch (e) { msg(esc(errText(e)), 'bad'); }
  });
  $('#csave').onclick = async () => {
    const F = SUB.f; if (!F.brand || !F.mrp) { msg('Brand and MRP are required.', 'bad'); return; }
    let bc = String(F.barcode || '').trim(); if (!bc) bc = ean('200' + String(Date.now()).slice(-9));
    if (visibleProducts().some(p => p.barcode === bc)) { msg('That barcode already exists in your database.', 'bad'); return; }
    const p = await run(() => API.addProduct({ brand: F.brand.trim(), name: F.name.trim(), category: F.category, pack: F.pack, sizeMl: +F.sizeMl || 0, mrp: +F.mrp, cost: +F.cost || Math.round(F.mrp * .84), barcode: bc, src: F._ai ? 'ai' : 'manual' }), $('#csave'));
    if (p) { SUB.f = null; toast('Saved. Receive stock in “Stock inward” to start selling.', 'ok'); INV.catalog(); }
  };
};

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
  const tabs = [['close', 'Day close'], ['pl', 'Monthly P&L'], ['brands', 'Brand performance'], ['audit', 'Audit trail']];
  $('#view').innerHTML = `<div class="tabs">${tabs.map(([k, t]) => `<a data-t="${k}" class="${SUB.tab === k ? 'on' : ''}">${t}</a>`).join('')}</div><div id="rep"></div>`;
  $$('[data-t]').forEach(a => a.onclick = () => { SUB = { tab: a.dataset.t }; VIEWS.reports(); });
  REP[SUB.tab]();
};
REP.close = function () {
  SUB.date = SUB.date || dk(Date.now()); const sh = SUB.shop || scope()[0]; const d0 = d0of(SUB.date);
  if (S.loadedFrom && d0 < S.loadedFrom) { $('#rep').innerHTML = '<div class="card empty"><span class="spin dk"></span> Loading…</div>'; API.ensureRange(d0).then(() => REP.close(), e => toast(errText(e), 'bad')); return; }
  const all = S.sales.filter(s => s.shopId === sh && s.ts >= d0 && s.ts < d0 + DAY), live = all.filter(s => s.status !== 'void');
  const cash = sum(live, s => s.cash), upi = sum(live, s => s.upi), cex = sum(S.expenses.filter(e => e.shopId === sh && e.ts >= d0 && e.ts < d0 + DAY && e.mode === 'Cash'), e => e.amount);
  const expected = cash - cex; const closed = S.closings.find(c => c.shopId === sh && c.date === SUB.date);
  const counted = SUB.counted ?? (closed ? closed.counted : ''); const v = counted === '' ? null : +counted - expected;
  const byU = {}; live.forEach(s => { byU[s.userId] = byU[s.userId] || { c: 0, u: 0, n: 0 }; byU[s.userId].c += s.cash; byU[s.userId].u += s.upi; byU[s.userId].n++; });
  $('#rep').innerHTML = `<div class="grid g12"><div class="card"><h3>Close the day</h3><div class="grid">
   <div class="row">${role() === 'owner' ? `<select id="csh2" style="width:auto">${tShops().map(s => `<option value="${s.id}" ${s.id === sh ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select>` : ''}<input type="date" id="cd" value="${SUB.date}" style="width:auto"></div>
   <div class="sw"><span>Gross sales (${live.length} bills)</span><b>${inr(cash + upi)}</b></div>
   <div class="sw"><span>UPI received</span><b>${inr(upi)}</b></div>
   <div class="sw"><span>Cash sales</span><b>${inr(cash)}</b></div>
   <div class="sw"><span>Cash expenses paid from counter</span><b>− ${inr(cex)}</b></div>
   <div class="sw"><span class="b">Expected cash in drawer</span><b style="font-size:18px">${inr(expected)}</b></div>
   <div><label class="f">Cash counted in drawer ₹</label><input id="ccount" type="number" inputmode="numeric" value="${esc(counted)}" ${closed ? 'disabled' : ''}></div>
   ${v != null ? `<div class="flash ${v === 0 ? 'ok' : Math.abs(v) <= 100 ? 'info' : 'bad'}">${v === 0 ? 'Cash tallies exactly.' : v > 0 ? `Excess cash ${inr(v)}` : `Short by ${inr(-v)}`}</div>` : ''}
   ${closed ? `<div class="flash ok">${ic('lock', 14)} Day closed by ${esc(userById(closed.by)?.name || '')} at ${dtm(closed.ts)}</div>` : `<button class="btn p" id="cclose" ${counted === '' ? 'disabled' : ''}>${ic('lock')} Close day & lock</button>`}
   <button class="btn" id="ccopy">${ic('copy')} Copy closing summary</button></div></div>
   <div class="card"><h3>Collection by salesman</h3><table><tr><th>Salesman</th><th class="r">Bills</th><th class="r">Cash to hand over</th><th class="r">UPI</th></tr>${Object.entries(byU).map(([u, x]) => `<tr><td class="b small">${esc(userById(u)?.name)}</td><td class="r">${x.n}</td><td class="r b">${inr(x.c)}</td><td class="r">${inr(x.u)}</td></tr>`).join('') || '<tr><td colspan="4" class="empty">No bills</td></tr>'}</table>
   <h3 style="margin-top:18px">Exceptions</h3><table><tr><th>Bill</th><th>Issue</th><th class="r">Amount</th></tr>${all.filter(s => s.status === 'void' || s.items.some(i => i.m === 'ovr')).map(s => `<tr><td class="mono small">${s.no}</td><td class="small">${s.status === 'void' ? '<span class="badge bad">Void</span> ' + esc(s.voidReason) : '<span class="badge warn">Manual override</span>'}</td><td class="r">${inr(s.total)}</td></tr>`).join('') || '<tr><td colspan="3" class="empty">No exceptions 🎉</td></tr>'}</table></div></div>`;
  if ($('#csh2')) $('#csh2').onchange = e => { SUB = { tab: 'close', shop: e.target.value, date: SUB.date }; REP.close(); };
  $('#cd').onchange = e => { SUB = { tab: 'close', shop: sh, date: e.target.value }; REP.close(); };
  $('#ccount').onchange = e => { SUB.counted = e.target.value; SUB.shop = sh; REP.close(); };
  if ($('#cclose')) $('#cclose').onclick = async () => { const ok = await run(async () => { await API.closeDay(sh, SUB.date, expected, +counted); return true; }, $('#cclose')); if (ok) { toast('Day closed', 'ok'); REP.close(); } };
  $('#ccopy').onclick = () => copyText(`${tenant().name} — ${shopById(sh).name}\nDay close ${SUB.date}\nBills: ${live.length}\nGross: ${inr(cash + upi)}\nUPI: ${inr(upi)}\nCash: ${inr(cash)}\nCash expenses: ${inr(cex)}\nExpected drawer: ${inr(expected)}${v != null ? `\nCounted: ${inr(counted)}\nVariance: ${inr(v)}` : ''}\nVoids: ${all.length - live.length}`);
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
   <button class="btn p" id="bsave">Save branding</button></div></div>
  <div class="card"><h3>${ic('lock', 16)} Sale-lock policies</h3>
   ${sw('requireScan', 'Require scan to sell', 'Only barcode or AI-matched products can be billed')}
   ${sw('override', 'Allow manager override', 'Manual add with manager PIN; flagged on the bill')}
   ${sw('mrpLock', 'Lock price at MRP', 'Salesmen cannot change prices')}
   ${sw('stockLock', 'Block sale beyond stock', 'Prevents billing bottles the system says you don\'t have')}
   ${sw('ageCheck', 'Age confirmation at checkout', 'Salesman confirms legal drinking age on every bill')}
   <div class="sw"><div><div class="b">Legal drinking age</div><div class="small mute">Varies by state</div></div><select id="agel" style="width:90px">${[18, 21, 23, 25].map(a => `<option ${P.ageLimit === a ? 'selected' : ''}>${a}</option>`).join('')}</select></div></div>
  <div class="card"><h3>Shops & UPI</h3><div class="tbl" style="border:0"><table><tr><th>Shop</th><th>Code</th><th>Licence</th><th>UPI ID</th></tr>${tShops().map(s => `<tr><td><input data-sh="${s.id}|name" value="${esc(s.name)}"></td><td class="mono small">${s.code}</td><td><input data-sh="${s.id}|license" value="${esc(s.license)}" class="mono"></td><td><input data-sh="${s.id}|upi" value="${esc(s.upi)}" class="mono" placeholder="name@bank"></td></tr>`).join('')}</table></div>
   <div class="row" style="margin-top:12px"><button class="btn" id="addshop">${ic('plus')} Add shop</button><span class="sp"></span><span class="small mute">Changes save when you leave a field</span></div></div>
  <div class="card"><h3>${API.mode === 'demo' ? 'Demo tools' : 'Connection'}</h3>${API.mode === 'demo' ? `<p class="mute" style="margin-top:0">This demo keeps its data in this browser. Reset to regenerate 7 days of realistic sales.</p><div class="row wrap"><button class="btn" id="simt"><span class="dot ${S.sim ? 'live' : ''}"></span> ${S.sim ? 'Stop' : 'Start'} live sales stream</button><button class="btn d" id="reset">Reset demo data</button></div>` : `<p class="mute" style="margin-top:0">Connected to Supabase. Bills, stock and staff are shared live across every device signed in to this workspace.</p><div class="small mono mute">${esc(MX_CONFIG.supabaseUrl)}</div>`}</div></div>`;
  $('#bsave').onclick = async () => {
    const patch = { name: $('#bn').value || t.name, logo: ($('#bl').value || t.logo).toUpperCase(), tagline: $('#bt').value, color: $('#bc').value, ...(API.mode === 'cloud' ? {} : { slug: slugify($('#bs').value) || t.slug }), footer: $('#bf').value };
    const ok = await run(async () => { await API.saveTenant(patch); return true; }, $('#bsave')); if (ok) { toast('Branding saved', 'ok'); render(); }
  };
  $('#bc').oninput = e => setBrand(e.target.value);
  $$('[data-pol]').forEach(i => i.onchange = () => run(() => API.saveTenant({ pol: { ...pol(), [i.dataset.pol]: i.checked } })).then(() => toast('Policy updated')));
  $('#agel').onchange = e => run(() => API.saveTenant({ pol: { ...pol(), ageLimit: +e.target.value } }));
  $$('[data-sh]').forEach(i => i.onchange = () => { const [id, k] = i.dataset.sh.split('|'); run(() => API.saveShop(id, { [k]: i.value })); });
  $('#addshop').onclick = async () => { await run(() => API.addShop(), $('#addshop')); render(); };
  if ($('#simt')) $('#simt').onclick = () => { S.sim = !S.sim; API.save(); render(); };
  if ($('#reset')) $('#reset').onclick = () => { modal(`<h2>Reset demo data?</h2><p class="mute">All bills, stock, staff and settings in this browser go back to the starting demo.</p><div class="row" style="justify-content:flex-end"><button class="btn" id="rsn">Cancel</button><button class="btn p" id="rsy">Reset</button></div>`); $('#rsn').onclick = closeModal; $('#rsy').onclick = async () => { API.reset(); closeModal(); await logout(); }; };
};
