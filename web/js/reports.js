/* =========================================================
   MuneemX — Sales report (any date range) + Stock movements
   One-click PDF, Excel (.xlsx), print, and WhatsApp to the owner.
   PDF and Excel files are written by small built-in writers below,
   so reports work without any outside service.
   ========================================================= */
'use strict';

/* ---------------- date ranges ---------------- */
const RANGES = [['today', 'Today'], ['yesterday', 'Yesterday'], ['week', 'This week'], ['7d', 'Last 7 days'], ['month', 'This month'], ['lastmonth', 'Last month'], ['custom', 'Custom']];
function rangeOf(k, from, to) {
  const t0 = sod(Date.now()), d = new Date(t0 - BIZ), dow = (d.getDay() + 6) % 7;
  const ms = monthStart(), md = new Date(ms - BIZ), lms = new Date(md.getFullYear(), md.getMonth() - 1, 1).getTime() + BIZ;
  switch (k) {
    case 'today': return [t0, t0 + DAY];
    case 'yesterday': return [t0 - DAY, t0];
    case 'week': return [t0 - dow * DAY, t0 + DAY];
    case '7d': return [t0 - 6 * DAY, t0 + DAY];
    case 'month': return [ms, t0 + DAY];
    case 'lastmonth': return [lms, ms];
    default: { const a = d0of(from || dk(Date.now())), b = d0of(to || dk(Date.now())) + DAY; return [Math.min(a, b - DAY), Math.max(b, a + DAY)]; }
  }
}
const dday = ts => new Date(ts).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' });
const fmtD = ts => new Date(ts).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
const rangeLabel = (a, b) => b - a <= DAY ? fmtD(a) : `${fmtD(a)} – ${fmtD(b - DAY)}`;
function rangeBar(onChange) {
  SUB.rk = SUB.rk || 'today'; SUB.rf = SUB.rf || dk(Date.now() - 6 * DAY); SUB.rt = SUB.rt || dk(Date.now());
  const shopSel = role() === 'owner' && tShops().length > 1 ? `<select id="rgs" style="width:auto"><option value="all">All shops</option>${tShops().map(s => `<option value="${s.id}" ${SUB.rs === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select>` : '';
  const html = `<div class="row wrap" style="gap:8px"><div class="seg" style="flex-wrap:wrap">${RANGES.map(([k, l]) => `<button data-rk="${k}" class="${SUB.rk === k ? 'on' : ''}">${l}</button>`).join('')}</div>
    ${SUB.rk === 'custom' ? `<input type="date" id="rgf" value="${SUB.rf}" style="width:auto"><span class="mute">→</span><input type="date" id="rgt" value="${SUB.rt}" style="width:auto">` : ''}${shopSel}</div>`;
  const wire = () => {
    $$('[data-rk]').forEach(b => b.onclick = () => { SUB.rk = b.dataset.rk; onChange(); });
    if ($('#rgf')) $('#rgf').onchange = e => { SUB.rf = e.target.value; onChange(); };
    if ($('#rgt')) $('#rgt').onchange = e => { SUB.rt = e.target.value; onChange(); };
    if ($('#rgs')) $('#rgs').onchange = e => { SUB.rs = e.target.value; onChange(); };
  };
  return { html, wire };
}
const reportShops = () => role() === 'owner' ? (SUB.rs && SUB.rs !== 'all' ? [SUB.rs] : scope()) : [S.me.shopId];

/* ---------------- report data ---------------- */
function buildReport(ids, a, b) {
  const all = S.sales.filter(s => ids.includes(s.shopId) && s.ts >= a && s.ts < b), live = all.filter(s => s.status !== 'void');
  const exp = S.expenses.filter(e => ids.includes(e.shopId) && e.ts >= a && e.ts < b);
  const cpay = (S.creditPayments || []).filter(p => ids.includes(p.shopId) && p.ts >= a && p.ts < b);
  const moves = S.moves.filter(m => ids.includes(m.shopId) && m.ts >= a && m.ts < b);
  const tot = {
    bills: live.length, voids: all.length - live.length, bottles: sum(live, units),
    gross: sum(live, s => s.gross || s.total), discount: sum(live, s => s.discount || 0), net: sum(live, s => s.total),
    cash: sum(live, s => s.cash), upi: sum(live, s => s.upi), credit: sum(live, s => s.credit || 0), cost: sum(live, s => s.cost),
    collCash: sum(cpay.filter(p => p.mode === 'Cash'), p => p.amount), collUpi: sum(cpay.filter(p => p.mode === 'UPI'), p => p.amount),
    expenses: sum(exp, e => e.amount), cashExp: sum(exp.filter(e => e.mode === 'Cash'), e => e.amount),
    inward: sum(moves.filter(m => m.type === 'inward'), m => m.qty), tin: sum(moves.filter(m => m.type === 'transfer' && m.qty > 0), m => m.qty), tout: -sum(moves.filter(m => m.type === 'transfer' && m.qty < 0), m => m.qty)
  };
  tot.margin = tot.net - tot.cost; tot.profit = tot.margin - tot.expenses;
  const days = []; for (let d = a; d < b; d += DAY) {
    const ds = live.filter(s => s.ts >= d && s.ts < d + DAY), de = exp.filter(e => e.ts >= d && e.ts < d + DAY);
    days.push({ d, bills: ds.length, bottles: sum(ds, units), cash: sum(ds, s => s.cash), upi: sum(ds, s => s.upi), credit: sum(ds, s => s.credit || 0), discount: sum(ds, s => s.discount || 0), net: sum(ds, s => s.total), margin: sum(ds, s => s.total - s.cost), exp: sum(de, e => e.amount) });
  }
  const pm = {}; live.forEach(s => s.items.forEach(i => { const r = pm[i.pid] = pm[i.pid] || { q: 0, r: 0, c: 0 }; r.q += i.qty; r.r += i.qty * i.price; r.c += i.qty * i.cost; }));
  const products = Object.entries(pm).map(([pid, v]) => ({ p: prodById(pid), ...v })).filter(x => x.p).sort((x, y) => y.r - x.r);
  const sm = {}; live.forEach(s => { const r = sm[s.userId] = sm[s.userId] || { bills: 0, bottles: 0, net: 0, cash: 0, upi: 0, credit: 0 }; r.bills++; r.bottles += units(s); r.net += s.total; r.cash += s.cash; r.upi += s.upi; r.credit += s.credit || 0; });
  const staff = Object.entries(sm).map(([u, v]) => ({ u: userById(u), ...v })).sort((x, y) => y.net - x.net);
  const shops = ids.map(id => { const ss = live.filter(s => s.shopId === id); return { s: shopById(id), bills: ss.length, net: sum(ss, s => s.total), cash: sum(ss, s => s.cash), upi: sum(ss, s => s.upi), credit: sum(ss, s => s.credit || 0), exp: sum(exp.filter(e => e.shopId === id), e => e.amount) }; });
  const ec = {}; exp.forEach(e => ec[e.cat] = (ec[e.cat] || 0) + e.amount);
  const expCats = Object.entries(ec).sort((x, y) => y[1] - x[1]);
  const mg = {}; moves.filter(m => m.type !== 'opening').forEach(m => { const k = m.shopId + '|' + m.ref + '|' + m.type; const g = mg[k] = mg[k] || { ts: m.ts, shop: m.shopId, type: m.type, ref: m.ref, party: m.party, items: 0, qty: 0, value: 0 }; g.items++; g.qty += m.qty; g.value += m.qty * (prodById(m.pid)?.cost || 0); g.ts = Math.min(g.ts, m.ts); });
  const moveList = Object.values(mg).sort((x, y) => y.ts - x.ts);
  return { a, b, ids, tot, days, products, staff, shops, expCats, moveList, bills: all.sort((x, y) => x.ts - y.ts), exp };
}
const shopsLabel = ids => ids.length === tShops().length && ids.length > 1 ? 'All shops' : ids.map(id => shopById(id)?.name).join(', ');
const moveType = g => g.type === 'inward' ? 'Received' : g.type === 'transfer' ? (g.qty < 0 ? 'Transfer out' : 'Transfer in') : 'Adjust';

/* ---------------- Sales report screen ---------------- */
REP.sales = function () {
  const rb = rangeBar(() => REP.sales()); const [a, b] = rangeOf(SUB.rk, SUB.rf, SUB.rt);
  if (S.loadedFrom && a < S.loadedFrom) { $('#rep').innerHTML = `<div class="card empty"><span class="spin dk"></span> Loading…</div>`; API.ensureRange(a).then(() => REP.sales(), e => toast(errText(e), 'bad')); return; }
  const ids = reportShops(), R = buildReport(ids, a, b), T = R.tot, multi = ids.length > 1;
  const kv = (l, v, c) => `<div class="sw"><span>${l}</span><b ${c ? `style="color:${c}"` : ''}>${v}</b></div>`;
  $('#rep').innerHTML = `<div class="card" style="margin-bottom:14px">${rb.html}
   <div class="row wrap" style="margin-top:12px"><div><div class="b" style="font-size:16px">${esc(tenant().name)} — <span>Sales report</span></div><div class="small mute">${rangeLabel(a, b)} · ${esc(shopsLabel(ids))}</div></div><span class="sp"></span>
    <button class="btn" id="dlpdf">${ic('receipt')} PDF</button><button class="btn" id="dlxls">${ic('grid')} Excel</button><button class="btn" id="dlprn">Print</button><button class="btn wa" id="dlwa">${ic('wa')} WhatsApp to owner</button></div></div>
  <div class="grid g4">
   <div class="card kpi"><div class="l">Sales</div><div class="v">${inr(T.net)}</div><div class="s">${T.bills} bills · ${T.bottles} bottles</div></div>
   <div class="card kpi"><div class="l">Cash · UPI · Udhar</div><div class="v" style="font-size:18px">${inrK(T.cash)} · ${inrK(T.upi)} · ${inrK(T.credit)}</div><div class="s">Discounts ${inr(T.discount)}</div></div>
   <div class="card kpi"><div class="l">Gross margin − expenses</div><div class="v" style="color:${T.profit >= 0 ? 'var(--ok)' : 'var(--bad)'}">${inr(T.profit)}</div><div class="s">Margin ${inr(T.margin)} · expenses ${inr(T.expenses)}</div></div>
   <div class="card kpi"><div class="l">Stock movement</div><div class="v" style="font-size:18px">+${T.inward} · ⇄ ${T.tin}/${T.tout}</div><div class="s">Received · transfer in/out (bottles)</div></div></div>
  <div class="grid g2" style="margin-top:14px">
   <div class="card"><h3>Summary</h3>${kv('Bills', T.bills)}${kv('Bottles sold', T.bottles)}${kv('MRP value', inr(T.gross))}${kv('Discounts', '− ' + inr(T.discount))}${kv('Net sales', inr(T.net))}${kv('Cash', inr(T.cash))}${kv('UPI', inr(T.upi))}${kv('Udhar given', inr(T.credit), 'var(--warn)')}${kv('Udhar collected', inr(T.collCash + T.collUpi))}${kv('Cost of goods sold', inr(T.cost))}${kv('Gross margin', inr(T.margin))}${kv('Expenses', '− ' + inr(T.expenses))}${kv('Net after expenses', inr(T.profit), T.profit >= 0 ? 'var(--ok)' : 'var(--bad)')}${kv('Voided bills', T.voids)}</div>
   <div class="card"><h3>Day by day</h3><div class="tbl" style="max-height:430px"><table><tr><th>Date</th><th class="r">Bills</th><th class="r">Cash</th><th class="r">UPI</th><th class="r">Udhar</th><th class="r">Sales</th><th class="r">Expenses</th></tr>${R.days.map(d => `<tr><td class="small">${dday(d.d)}</td><td class="r">${d.bills}</td><td class="r">${inrK(d.cash)}</td><td class="r">${inrK(d.upi)}</td><td class="r">${inrK(d.credit)}</td><td class="r b">${inrK(d.net)}</td><td class="r">${inrK(d.exp)}</td></tr>`).join('')}</table></div></div></div>
  <div class="grid g2" style="margin-top:14px">
   <div class="card"><h3>Products<span class="sp"></span><span class="small mute">${R.products.length}</span></h3><div class="tbl" style="max-height:360px"><table><tr><th>Product</th><th class="r">Qty</th><th class="r">Sales</th><th class="r">Margin</th></tr>${R.products.map(x => `<tr><td class="small"><b>${esc(pname(x.p))}</b> · ${x.p.pack}</td><td class="r">${x.q}</td><td class="r b">${inr(x.r)}</td><td class="r">${inr(x.r - x.c)}</td></tr>`).join('') || '<tr><td colspan="4" class="empty">No sales yet</td></tr>'}</table></div></div>
   <div class="card"><h3>Salesmen</h3><table><tr><th>Salesman</th><th class="r">Bills</th><th class="r">Cash</th><th class="r">UPI</th><th class="r">Sales</th></tr>${R.staff.map(x => `<tr><td class="small b">${esc(x.u?.name || '')}</td><td class="r">${x.bills}</td><td class="r">${inrK(x.cash)}</td><td class="r">${inrK(x.upi)}</td><td class="r b">${inr(x.net)}</td></tr>`).join('') || '<tr><td colspan="5" class="empty">—</td></tr>'}</table>
    ${multi ? `<h3 style="margin-top:16px">Shops</h3><table><tr><th>Shop</th><th class="r">Bills</th><th class="r">Sales</th><th class="r">Expenses</th></tr>${R.shops.map(x => `<tr><td class="small b">${esc(x.s.name)}</td><td class="r">${x.bills}</td><td class="r b">${inr(x.net)}</td><td class="r">${inr(x.exp)}</td></tr>`).join('')}</table>` : ''}
    <h3 style="margin-top:16px">Expenses</h3><table>${R.expCats.map(([k, v]) => `<tr><td class="small">${esc(k)}</td><td class="r b">${inr(v)}</td></tr>`).join('') || '<tr><td class="empty">No expenses yet</td></tr>'}</table></div></div>`;
  rb.wire();
  const name = `MuneemX-${tenant().slug}-${dk(a)}${b - a > DAY ? '_to_' + dk(b - DAY) : ''}`;
  $('#dlpdf').onclick = () => { try { downloadBlob(reportPDF(R), name + '.pdf'); API.audit('Report downloaded', 'PDF ' + rangeLabel(a, b)).catch(() => { }); } catch (e) { toast(errText(e), 'bad'); } };
  $('#dlxls').onclick = () => { try { downloadBlob(reportXLSX(R), name + '.xlsx'); API.audit('Report downloaded', 'Excel ' + rangeLabel(a, b)).catch(() => { }); } catch (e) { toast(errText(e), 'bad'); } };
  $('#dlprn').onclick = () => printHTML(reportHTML(R));
  $('#dlwa').onclick = () => shareReport(R, name);
};

/* ---------------- Stock movements screen ---------------- */
REP.moves = function () {
  const rb = rangeBar(() => REP.moves()); const [a, b] = rangeOf(SUB.rk, SUB.rf, SUB.rt);
  if (S.loadedFrom && a < S.loadedFrom) { $('#rep').innerHTML = `<div class="card empty"><span class="spin dk"></span> Loading…</div>`; API.ensureRange(a).then(() => REP.moves(), e => toast(errText(e), 'bad')); return; }
  const ids = reportShops(), R = buildReport(ids, a, b);
  SUB.mt = SUB.mt || 'all';
  const list = R.moveList.filter(g => SUB.mt === 'all' || (SUB.mt === 'inward' ? g.type === 'inward' : SUB.mt === 'transfer' ? g.type === 'transfer' : g.type === 'adjust'));
  $('#rep').innerHTML = `<div class="card" style="margin-bottom:14px">${rb.html}
   <div class="row wrap" style="margin-top:12px"><div class="seg">${[['all', 'All'], ['inward', 'Received'], ['transfer', 'Transfers'], ['adjust', 'Adjust']].map(([k, l]) => `<button data-mt="${k}" class="${SUB.mt === k ? 'on' : ''}">${l}</button>`).join('')}</div><span class="sp"></span><span class="small mute">${rangeLabel(a, b)} · ${esc(shopsLabel(ids))}</span></div></div>
  <div class="card"><h3>${ic('box', 16)} Stock movements<span class="sp"></span><span class="small mute">${list.length}</span></h3>
   <div class="tbl"><table><tr><th>When</th><th>Type</th><th>Shop</th><th>Ref</th><th>From / to</th><th class="r">Products</th><th class="r">Bottles</th><th class="r">Value (cost)</th><th></th></tr>
   ${list.map((g, i) => `<tr><td class="small">${dtm(g.ts)}</td><td><span class="badge ${g.type === 'inward' ? 'ok' : g.type === 'transfer' ? 'br' : 'warn'}">${moveType(g)}</span></td><td class="small">${esc(shopById(g.shop)?.name || '')}</td><td class="mono small">${esc(g.ref)}</td><td class="small">${esc(g.party || '')}</td><td class="r">${g.items}</td><td class="r b">${g.qty > 0 ? '+' : ''}${g.qty}</td><td class="r">${inr(Math.abs(g.value))}</td><td><button class="btn sm" data-mv="${i}">View</button></td></tr>`).join('') || '<tr><td colspan="9" class="empty">None yet</td></tr>'}</table></div></div>`;
  rb.wire();
  $$('[data-mt]').forEach(x => x.onclick = () => { SUB.mt = x.dataset.mt; REP.moves(); });
  $$('[data-mv]').forEach(x => x.onclick = () => {
    const g = list[+x.dataset.mv], lines = S.moves.filter(m => m.shopId === g.shop && m.ref === g.ref && m.type === g.type);
    modal(`<h2>${moveType(g)} · <span class="mono">${esc(g.ref)}</span></h2><p class="mute" style="margin-top:0">${dtm(g.ts)} · ${esc(shopById(g.shop)?.name || '')}${g.party ? ' · ' + esc(g.party) : ''}${lines[0] && lines[0].by ? ' · ' + esc(userById(lines[0].by)?.name || '') : ''}</p>
     <table><tr><th>Product</th><th>Pack</th><th class="r">Bottles</th><th class="r">Cartons</th></tr>${lines.map(m => { const p = prodById(m.pid); return `<tr><td class="small b">${esc(pname(p))}</td><td class="small">${p?.pack || ''}</td><td class="r b">${m.qty > 0 ? '+' : ''}${m.qty}</td><td class="r small">${cq(Math.abs(m.qty), caseSize(p))}</td></tr>`; }).join('')}</table>
     <div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn p" id="mvx">Close</button></div>`);
    $('#mvx').onclick = closeModal;
  });
};

/* ---------------- outputs ---------------- */
function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 4000);
}
function reportText(R) {
  const T = R.tot, top = R.products.slice(0, 5).map(x => `• ${pname(x.p)} ${x.p.pack} × ${x.q}`).join('\n');
  return `*${tenant().name} — Sales report*\n${rangeLabel(R.a, R.b)} · ${shopsLabel(R.ids)}\n\nBills: ${T.bills} · Bottles: ${T.bottles}\n*Sales: ${inr(T.net)}*\nCash ${inr(T.cash)} · UPI ${inr(T.upi)} · Udhar ${inr(T.credit)}\nDiscounts: ${inr(T.discount)}\nUdhar collected: ${inr(T.collCash + T.collUpi)}\nExpenses: ${inr(T.expenses)}\nGross margin: ${inr(T.margin)}\n*Net after expenses: ${inr(T.profit)}*\nStock received: ${T.inward} · Transfer in/out: ${T.tin}/${T.tout}${top ? '\n\nTop products:\n' + top : ''}\n\n— MuneemX`;
}
async function shareReport(R, name) {
  const text = reportText(R), file = new File([reportPDF(R)], name + '.pdf', { type: 'application/pdf' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], text, title: name }); API.audit('Report shared', rangeLabel(R.a, R.b)).catch(() => { }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
  }
  const owner = (pol().ownerPhone || '');
  modal(`<h2>${ic('wa', 18)} Send report on WhatsApp</h2>
   <p class="mute" style="margin-top:0">This device cannot attach files to WhatsApp directly. Download the PDF, then send the summary — attach the PDF in the chat if needed.</p>
   <label class="f">Owner WhatsApp number</label><input id="wanum" inputmode="tel" value="${esc(owner)}" placeholder="98XXXXXXXX">
   <div class="small mute" style="margin-top:4px">Save it in Settings → Owner WhatsApp number to skip this step.</div>
   <div class="row wrap" style="justify-content:flex-end;margin-top:14px"><button class="btn" id="wadl">${ic('receipt')} Download PDF</button><a class="btn wa" id="wago" target="_blank" rel="noopener">${ic('wa')} Open WhatsApp</a></div>`);
  const upd = () => { const ph = normPhone($('#wanum').value); const a = $('#wago'); if (ph.length === 10) { a.href = waLink(ph, text); a.classList.remove('off'); } else { a.removeAttribute('href'); a.classList.add('off'); } };
  $('#wanum').oninput = upd; upd();
  $('#wadl').onclick = () => downloadBlob(file, file.name);
  $('#wago').onclick = e => { if (!$('#wago').href) { e.preventDefault(); toast('Enter a 10-digit mobile number', 'bad'); } else API.audit('Report sent on WhatsApp', rangeLabel(R.a, R.b)).catch(() => { }); };
}
function printHTML(html) {
  let el = $('#printarea'); if (!el) { el = document.createElement('div'); el.id = 'printarea'; document.body.appendChild(el); }
  el.innerHTML = html; document.body.classList.add('printing');
  const done = () => { document.body.classList.remove('printing'); el.innerHTML = ''; window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  setTimeout(() => { try { window.print(); } catch (e) { toast('Printing is not available here', 'bad'); done(); } }, 50);
}
function reportHTML(R) {
  const T = R.tot, tbl = (head, rows) => `<table class="pt"><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr>${rows.map(r => `<tr>${r.map((c, i) => `<td class="${i && typeof c !== 'string' || /^[₹−+\d]/.test(String(c)) && i ? 'r' : ''}">${esc(c)}</td>`).join('')}</tr>`).join('')}</table>`;
  return `<div class="prep"><h1>${esc(tenant().name)} — Sales report</h1><div class="pm">${rangeLabel(R.a, R.b)} · ${esc(shopsLabel(R.ids))} · Printed ${dtm(Date.now())}</div>
  <h2>Summary</h2>${tbl(['', ''], [['Bills', T.bills], ['Bottles sold', T.bottles], ['MRP value', inr(T.gross)], ['Discounts', '− ' + inr(T.discount)], ['Net sales', inr(T.net)], ['Cash', inr(T.cash)], ['UPI', inr(T.upi)], ['Udhar given', inr(T.credit)], ['Udhar collected', inr(T.collCash + T.collUpi)], ['Cost of goods sold', inr(T.cost)], ['Gross margin', inr(T.margin)], ['Expenses', inr(T.expenses)], ['Net after expenses', inr(T.profit)], ['Stock received (bottles)', T.inward], ['Transfer in / out (bottles)', `${T.tin} / ${T.tout}`]])}
  <h2>Day by day</h2>${tbl(['Date', 'Bills', 'Cash', 'UPI', 'Udhar', 'Discount', 'Sales', 'Expenses'], R.days.map(d => [dday(d.d), d.bills, inr(d.cash), inr(d.upi), inr(d.credit), inr(d.discount), inr(d.net), inr(d.exp)]))}
  ${R.ids.length > 1 ? `<h2>Shops</h2>${tbl(['Shop', 'Bills', 'Cash', 'UPI', 'Udhar', 'Sales', 'Expenses'], R.shops.map(x => [x.s.name, x.bills, inr(x.cash), inr(x.upi), inr(x.credit), inr(x.net), inr(x.exp)]))}` : ''}
  <h2>Products</h2>${tbl(['Product', 'Pack', 'Qty', 'Sales', 'Margin'], R.products.map(x => [pname(x.p), x.p.pack, x.q, inr(x.r), inr(x.r - x.c)]))}
  <h2>Salesmen</h2>${tbl(['Salesman', 'Bills', 'Bottles', 'Cash', 'UPI', 'Udhar', 'Sales'], R.staff.map(x => [x.u?.name || '', x.bills, x.bottles, inr(x.cash), inr(x.upi), inr(x.credit), inr(x.net)]))}
  <h2>Expenses</h2>${tbl(['Category', 'Amount'], R.expCats.map(([k, v]) => [k, inr(v)]))}
  <h2>Stock movements</h2>${tbl(['When', 'Type', 'Shop', 'Ref', 'From / to', 'Bottles'], R.moveList.map(g => [dtm(g.ts), moveType(g), shopById(g.shop)?.name || '', g.ref, g.party || '', g.qty]))}
  <div class="pm" style="margin-top:14px">Generated by MuneemX</div></div>`;
}

/* ---- PDF (built-in writer, Helvetica, A4) ---- */
const HN = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584];
const HB = [278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584];
const pdfText = s => String(s ?? '').replace(/₹\s?/g, 'Rs ').replace(/[·•]/g, '-').replace(/[–—−]/g, '-').replace(/×/g, 'x').replace(/→/g, '->').replace(/⇄/g, '<->').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/…/g, '...').replace(/[^\x20-\x7e]/g, '?');
class MiniPDF {
  constructor() { this.W = 595; this.H = 842; this.M = 36; this.pages = []; this.newPage(); }
  newPage() { this.cur = []; this.pages.push(this.cur); this.y = this.H - this.M; }
  width(s, size, bold) { const w = bold ? HB : HN; let n = 0; for (const ch of pdfText(s)) n += w[ch.charCodeAt(0) - 32] || 556; return n * size / 1000; }
  text(x, y, s, size = 9, bold = false, gray = 0) { const e = pdfText(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)'); this.cur.push(`${gray} g BT /${bold ? 'F2' : 'F1'} ${size} Tf ${x.toFixed(2)} ${y.toFixed(2)} Td (${e}) Tj ET 0 g`); }
  rect(x, y, w, h, gray) { this.cur.push(`${gray} g ${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f 0 g`); }
  line(x1, y1, x2, y2) { this.cur.push(`0.85 G 0.5 w ${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S 0 G`); }
  space(h) { if (this.y - h < this.M + 16) this.newPage(); }
  heading(s) { this.space(40); this.y -= 16; this.text(this.M, this.y, s, 12, true); this.y -= 8; }
  cell(x, y, w, s, size, bold, a) { s = pdfText(s); while (s.length > 1 && this.width(s, size, bold) > w - 6) s = s.slice(0, -1); this.text(a === 'r' ? x + w - 3 - this.width(s, size, bold) : x + 3, y, s, size, bold); }
  table(cols, rows) {
    const W = this.W - 2 * this.M, ws = cols.map(c => c.w * W);
    const head = () => { this.space(34); this.rect(this.M, this.y - 15, W, 16, 0.92); let x = this.M; cols.forEach((c, i) => { this.cell(x, this.y - 11, ws[i], c.h, 8, true, c.a); x += ws[i]; }); this.y -= 16; };
    head();
    rows.forEach(r => { if (this.y - 14 < this.M + 16) { this.newPage(); head(); } let x = this.M; cols.forEach((c, i) => { this.cell(x, this.y - 10, ws[i], r[i], 8, !!r.bold, c.a); x += ws[i]; }); this.line(this.M, this.y - 14, this.M + W, this.y - 14); this.y -= 14; });
    if (!rows.length) { this.text(this.M + 3, this.y - 11, '-', 8); this.y -= 14; }
    this.y -= 4;
  }
  blob() {
    const n = this.pages.length, objs = [];
    objs[1] = '<< /Type /Catalog /Pages 2 0 R >>';
    objs[2] = `<< /Type /Pages /Kids [${this.pages.map((_, i) => `${5 + i * 2} 0 R`).join(' ')}] /Count ${n} >>`;
    objs[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
    objs[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
    this.pages.forEach((p, i) => {
      const foot = `0.4 g BT /F1 7 Tf ${this.M} 20 Td (${pdfText('MuneemX')}) Tj ET BT /F1 7 Tf ${this.W - this.M - 40} 20 Td (Page ${i + 1} / ${n}) Tj ET 0 g`;
      const c = p.join('\n') + '\n' + foot;
      objs[5 + i * 2] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${this.W} ${this.H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${6 + i * 2} 0 R >>`;
      objs[6 + i * 2] = `<< /Length ${c.length} >>\nstream\n${c}\nendstream`;
    });
    let out = '%PDF-1.4\n', offs = [];
    for (let i = 1; i < objs.length; i++) { offs[i] = out.length; out += `${i} 0 obj\n${objs[i]}\nendobj\n`; }
    const x = out.length;
    out += `xref\n0 ${objs.length}\n0000000000 65535 f \n` + offs.slice(1).map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('');
    out += `trailer\n<< /Size ${objs.length} /Root 1 0 R >>\nstartxref\n${x}\n%%EOF`;
    return new Blob([out], { type: 'application/pdf' });
  }
}
function reportPDF(R) {
  const T = R.tot, d = new MiniPDF(), M = d.M;
  d.text(M, d.y - 4, `${tenant().name} - Sales report`, 16, true); d.y -= 22;
  d.text(M, d.y, `${rangeLabel(R.a, R.b)}  |  ${shopsLabel(R.ids)}  |  Generated ${dtm(Date.now())}`, 9, false, 0.35); d.y -= 10;
  const kv = (l, v, b) => { const r = [l, v]; r.bold = b; return r; };
  d.heading('Summary');
  d.table([{ h: 'Item', w: .6 }, { h: 'Value', w: .4, a: 'r' }], [kv('Bills', T.bills), kv('Bottles sold', T.bottles), kv('MRP value', inr(T.gross)), kv('Discounts', '-' + inr(T.discount)), kv('Net sales', inr(T.net), true), kv('Cash', inr(T.cash)), kv('UPI', inr(T.upi)), kv('Udhar given (credit)', inr(T.credit)), kv('Udhar collected', inr(T.collCash + T.collUpi)), kv('Cost of goods sold', inr(T.cost)), kv('Gross margin', inr(T.margin)), kv('Expenses', inr(T.expenses)), kv('Net after expenses', inr(T.profit), true), kv('Voided bills', T.voids), kv('Stock received (bottles)', T.inward), kv('Transfer in / out (bottles)', `${T.tin} / ${T.tout}`)]);
  d.heading('Day by day');
  const dr = R.days.map(x => [dday(x.d), x.bills, inr(x.cash), inr(x.upi), inr(x.credit), inr(x.discount), inr(x.net), inr(x.exp)]); const tr = ['Total', T.bills, inr(T.cash), inr(T.upi), inr(T.credit), inr(T.discount), inr(T.net), inr(T.expenses)]; tr.bold = true; dr.push(tr);
  d.table([{ h: 'Date', w: .18 }, { h: 'Bills', w: .08, a: 'r' }, { h: 'Cash', w: .12, a: 'r' }, { h: 'UPI', w: .12, a: 'r' }, { h: 'Udhar', w: .12, a: 'r' }, { h: 'Discount', w: .12, a: 'r' }, { h: 'Sales', w: .14, a: 'r' }, { h: 'Expenses', w: .12, a: 'r' }], dr);
  if (R.ids.length > 1) { d.heading('Shops'); d.table([{ h: 'Shop', w: .28 }, { h: 'Bills', w: .1, a: 'r' }, { h: 'Cash', w: .13, a: 'r' }, { h: 'UPI', w: .13, a: 'r' }, { h: 'Udhar', w: .12, a: 'r' }, { h: 'Sales', w: .12, a: 'r' }, { h: 'Expenses', w: .12, a: 'r' }], R.shops.map(x => [x.s.name, x.bills, inr(x.cash), inr(x.upi), inr(x.credit), inr(x.net), inr(x.exp)])); }
  d.heading('Products'); d.table([{ h: 'Product', w: .46 }, { h: 'Pack', w: .14 }, { h: 'Qty', w: .1, a: 'r' }, { h: 'Sales', w: .15, a: 'r' }, { h: 'Margin', w: .15, a: 'r' }], R.products.map(x => [pname(x.p), x.p.pack, x.q, inr(x.r), inr(x.r - x.c)]));
  d.heading('Salesmen'); d.table([{ h: 'Salesman', w: .28 }, { h: 'Bills', w: .1, a: 'r' }, { h: 'Bottles', w: .1, a: 'r' }, { h: 'Cash', w: .13, a: 'r' }, { h: 'UPI', w: .13, a: 'r' }, { h: 'Udhar', w: .12, a: 'r' }, { h: 'Sales', w: .14, a: 'r' }], R.staff.map(x => [x.u?.name || '', x.bills, x.bottles, inr(x.cash), inr(x.upi), inr(x.credit), inr(x.net)]));
  d.heading('Expenses'); d.table([{ h: 'Category', w: .7 }, { h: 'Amount', w: .3, a: 'r' }], R.expCats.map(([k, v]) => [k, inr(v)]));
  d.heading('Stock movements'); d.table([{ h: 'When', w: .16 }, { h: 'Type', w: .14 }, { h: 'Shop', w: .16 }, { h: 'Ref', w: .2 }, { h: 'From / to', w: .22 }, { h: 'Bottles', w: .12, a: 'r' }], R.moveList.map(g => [dtm(g.ts), moveType(g), shopById(g.shop)?.name || '', g.ref, g.party || '', g.qty]));
  return d.blob();
}

/* ---- Excel .xlsx (built-in writer) ---- */
const CRC_T = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(b) { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC_T[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function zipStore(files) {
  const enc = new TextEncoder(), parts = [], cd = []; let off = 0;
  const u16 = n => [n & 255, (n >>> 8) & 255], u32 = n => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
  files.forEach(([name, text]) => {
    const nb = enc.encode(name), db = enc.encode(text), crc = crc32(db);
    const lh = new Uint8Array([...u32(0x04034b50), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(33), ...u32(crc), ...u32(db.length), ...u32(db.length), ...u16(nb.length), ...u16(0)]);
    parts.push(lh, nb, db);
    cd.push(new Uint8Array([...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(33), ...u32(crc), ...u32(db.length), ...u32(db.length), ...u16(nb.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(off)]), nb);
    off += lh.length + nb.length + db.length;
  });
  const cdLen = cd.reduce((a, b) => a + b.length, 0);
  const end = new Uint8Array([...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length), ...u32(cdLen), ...u32(off), ...u16(0)]);
  return new Blob([...parts, ...cd, end], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
function xlsxBlob(sheets) {
  const x = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
  const col = i => { let s = ''; i++; while (i) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
  const sheetXml = sh => {
    const widths = []; sh.rows.forEach(r => r.forEach((v, i) => widths[i] = Math.min(60, Math.max(widths[i] || 8, String(v ?? '').length + 2))));
    const rows = sh.rows.map((r, ri) => `<row r="${ri + 1}">${r.map((v, ci) => { const ref = col(ci) + (ri + 1), st = ri === 0 || r.bold ? ' s="1"' : ''; return typeof v === 'number' && isFinite(v) ? `<c r="${ref}"${st}><v>${v}</v></c>` : `<c r="${ref}" t="inlineStr"${st}><is><t xml:space="preserve">${x(v)}</t></is></c>`; }).join('')}</row>`).join('');
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols><sheetData>${rows}</sheetData></worksheet>`;
  };
  const names = sheets.map(s => s.name.replace(/[\[\]:*?/\\]/g, ' ').slice(0, 31));
  return zipStore([
    ['[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`],
    ['_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
    ['xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${names.map((n, i) => `<sheet name="${x(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`],
    ['xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
    ['xl/styles.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`],
    ...sheets.map((s, i) => [`xl/worksheets/sheet${i + 1}.xml`, sheetXml(s)])
  ]);
}
function reportXLSX(R) {
  const T = R.tot, r0 = n => Math.round(n * 100) / 100;
  const tot = (r) => { r.bold = true; return r; };
  return xlsxBlob([
    { name: 'Summary', rows: [['Item', 'Value'], ['Business', tenant().name], ['Period', rangeLabel(R.a, R.b)], ['Shops', shopsLabel(R.ids)], ['Bills', T.bills], ['Bottles sold', T.bottles], ['MRP value (Rs)', r0(T.gross)], ['Discounts (Rs)', r0(T.discount)], ['Net sales (Rs)', r0(T.net)], ['Cash (Rs)', r0(T.cash)], ['UPI (Rs)', r0(T.upi)], ['Udhar given (Rs)', r0(T.credit)], ['Udhar collected (Rs)', r0(T.collCash + T.collUpi)], ['Cost of goods sold (Rs)', r0(T.cost)], ['Gross margin (Rs)', r0(T.margin)], ['Expenses (Rs)', r0(T.expenses)], ['Net after expenses (Rs)', r0(T.profit)], ['Voided bills', T.voids], ['Stock received (bottles)', T.inward], ['Transfer in (bottles)', T.tin], ['Transfer out (bottles)', T.tout]] },
    { name: 'Daily', rows: [['Date', 'Bills', 'Bottles', 'Cash', 'UPI', 'Udhar', 'Discount', 'Sales', 'Gross margin', 'Expenses'], ...R.days.map(d => [dk(d.d), d.bills, d.bottles, r0(d.cash), r0(d.upi), r0(d.credit), r0(d.discount), r0(d.net), r0(d.margin), r0(d.exp)]), tot(['Total', T.bills, T.bottles, r0(T.cash), r0(T.upi), r0(T.credit), r0(T.discount), r0(T.net), r0(T.margin), r0(T.expenses)])] },
    { name: 'Shops', rows: [['Shop', 'Bills', 'Cash', 'UPI', 'Udhar', 'Sales', 'Expenses'], ...R.shops.map(x => [x.s.name, x.bills, r0(x.cash), r0(x.upi), r0(x.credit), r0(x.net), r0(x.exp)])] },
    { name: 'Products', rows: [['Product', 'Category', 'Pack', 'Size ml', 'Qty', 'Sales', 'Cost', 'Margin'], ...R.products.map(x => [pname(x.p), x.p.category, x.p.pack, x.p.sizeMl, x.q, r0(x.r), r0(x.c), r0(x.r - x.c)])] },
    { name: 'Salesmen', rows: [['Salesman', 'Shop', 'Bills', 'Bottles', 'Cash', 'UPI', 'Udhar', 'Sales'], ...R.staff.map(x => [x.u?.name || '', shopById(x.u?.shopId)?.name || '', x.bills, x.bottles, r0(x.cash), r0(x.upi), r0(x.credit), r0(x.net)])] },
    { name: 'Bills', rows: [['Bill', 'Date', 'Time', 'Shop', 'Salesman', 'Mode', 'MRP value', 'Discount', 'Total', 'Cash', 'UPI', 'Udhar', 'Customer', 'Mobile', 'Items', 'Status'], ...R.bills.map(s => { const c = custOf(s); return [s.no, dk(s.ts), tm(s.ts), shopById(s.shopId)?.name || '', userById(s.userId)?.name || '', s.mode === 'Credit' ? 'Udhar' : s.mode, r0(s.gross || s.total), r0(s.discount || 0), r0(s.total), r0(s.cash), r0(s.upi), r0(s.credit || 0), c ? c.name : '', c ? c.phone : '', s.items.map(i => `${pname(prodById(i.pid))} ${prodById(i.pid)?.pack || ''} x${i.qty}`).join('; '), s.status === 'void' ? 'VOID' : 'OK']; })] },
    { name: 'Expenses', rows: [['Date', 'Shop', 'Category', 'Note', 'Mode', 'Amount'], ...R.exp.map(e => [dk(e.ts), shopById(e.shopId)?.name || '', e.cat, e.note || '', e.mode, r0(e.amount)])] },
    { name: 'Stock moves', rows: [['Date', 'Type', 'Shop', 'Ref', 'From / to', 'Product', 'Pack', 'Bottles'], ...S.moves.filter(m => R.ids.includes(m.shopId) && m.ts >= R.a && m.ts < R.b && m.type !== 'opening').sort((a, b) => a.ts - b.ts).map(m => [dtm(m.ts), m.type === 'inward' ? 'Received' : m.type === 'transfer' ? (m.qty < 0 ? 'Transfer out' : 'Transfer in') : 'Adjust', shopById(m.shopId)?.name || '', m.ref || '', m.party || '', pname(prodById(m.pid)), prodById(m.pid)?.pack || '', m.qty])] }
  ]);
}
