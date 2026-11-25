/* =========================================================
   MuneemX — Udhar (credit): pending dues per customer,
   receive payments, WhatsApp reminders
   ========================================================= */
'use strict';
VIEWS.credit = function () {
  $('#view').innerHTML = `<div class="card empty"><span class="spin dk"></span> ${t('Loading…')}</div>`;
  API.creditSummary().then(rows => {
    if (VIEW !== 'credit') return;
    SUB.q = SUB.q || ''; SUB.show = SUB.show || 'due';
    const m0 = monthStart(), ids = scope();
    const pending = rows.filter(r => r.due > 0.5);
    const givenMonth = sum(S.sales.filter(s => s.status !== 'void' && s.credit > 0 && s.ts >= m0 && ids.includes(s.shopId)), s => s.credit);
    const gotMonth = sum((S.creditPayments || []).filter(p => p.ts >= m0), p => p.amount);
    let list = SUB.show === 'due' ? pending : rows;
    if (SUB.q) { const q = SUB.q.toLowerCase(); list = list.filter(r => (r.name + ' ' + r.phone).toLowerCase().includes(q)); }
    const recent = [...(S.creditPayments || [])].sort((a, b) => b.ts - a.ts).slice(0, 15);
    $('#view').innerHTML = `<div class="grid g4">
     <div class="card kpi"><div class="l">Udhar pending</div><div class="v" style="color:var(--warn)">${inr(sum(pending, r => r.due))}</div><div class="s">${pending.length} ${t('customers')}</div></div>
     <div class="card kpi"><div class="l">Udhar given this month</div><div class="v">${inr(givenMonth)}</div></div>
     <div class="card kpi"><div class="l">Collected this month</div><div class="v" style="color:var(--ok)">${inr(gotMonth)}</div></div>
     <div class="card kpi"><div class="l">Oldest unpaid bill</div><div class="v" style="font-size:20px">${pending.length ? Math.floor((Date.now() - Math.min(...pending.map(r => r.last || Date.now()))) / DAY) + ' ' + t('days') : '—'}</div></div></div>
    <div class="card" style="margin-top:14px"><div class="row wrap" style="margin-bottom:12px"><h3 style="margin:0">${ic('book', 16)} Customers</h3><span class="sp"></span>
     <input id="cq" placeholder="Search name or mobile" value="${esc(SUB.q)}" style="max-width:240px">
     <div class="seg"><button data-sh="due" class="${SUB.show === 'due' ? 'on' : ''}">Pending</button><button data-sh="all" class="${SUB.show === 'all' ? 'on' : ''}">All</button></div></div>
    <div class="tbl"><table><tr><th>Customer</th><th>Mobile</th><th class="r">Bills</th><th>Last bill</th><th class="r">Udhar</th><th class="r">Paid</th><th class="r">Due</th><th></th></tr>
    ${list.map(r => `<tr><td class="b">${esc(r.name)}</td><td class="mono small">${esc(r.phone)}</td><td class="r">${r.bills}</td><td class="small">${r.last ? dtm(r.last) : '—'}</td><td class="r">${inr(r.credit)}</td><td class="r">${inr(r.paid)}</td>
      <td class="r b" style="color:${r.due > 0.5 ? 'var(--warn)' : 'var(--ok)'}">${r.due > 0.5 ? inr(r.due) : t('Settled')}</td>
      <td class="r" style="white-space:nowrap"><button class="btn sm" data-bills="${r.id}">Bills</button> ${r.due > 0.5 ? `<button class="btn sm p" data-recv="${r.id}">Receive</button> <a class="btn sm wa" target="_blank" rel="noopener" href="${waLink(r.phone, reminderText(r, null))}" data-rem="${r.id}">${ic('wa')} Reminder</a>` : ''}</td></tr>`).join('') || `<tr><td colspan="8" class="empty">${t('No udhar yet')}</td></tr>`}</table></div></div>
    <div class="card" style="margin-top:14px"><h3>Recent udhar payments</h3><table><tr><th>When</th><th>Customer</th><th>Shop</th><th>Mode</th><th class="r">Amount</th></tr>
    ${recent.map(p => { const c = (S.customers || []).find(x => x.id === p.customerId) || rows.find(x => x.id === p.customerId) || {}; return `<tr><td class="small">${dtm(p.ts)}</td><td class="small b">${esc(c.name || '')}</td><td class="small">${esc(shopById(p.shopId)?.name || '')}</td><td><span class="badge">${modeLabel(p.mode)}</span></td><td class="r b">${inr(p.amount)}</td></tr>`; }).join('') || `<tr><td colspan="5" class="empty">${t('None yet')}</td></tr>`}</table></div>`;
    $('#cq').oninput = e => { SUB.q = e.target.value; VIEWS.credit(); };
    $$('[data-sh]').forEach(b => b.onclick = () => { SUB.show = b.dataset.sh; VIEWS.credit(); });
    $$('[data-rem]').forEach(a => a.onclick = () => API.audit('Udhar reminder sent', rows.find(r => r.id === a.dataset.rem).name).catch(() => { }));
    $$('[data-recv]').forEach(b => b.onclick = () => receiveModal(rows.find(r => r.id === b.dataset.recv)));
    $$('[data-bills]').forEach(b => b.onclick = () => customerBillsModal(rows.find(r => r.id === b.dataset.bills)));
  }, e => { $('#view').innerHTML = `<div class="card flash bad">${esc(errText(e))}</div>`; });
};
function receiveModal(r) {
  modal(`<h2>${ic('wallet', 18)} Receive udhar</h2><p class="mute" style="margin-top:0"><b>${esc(r.name)}</b> · <span class="mono">${esc(r.phone)}</span> · ${t('Due')} <b>${inr(r.due)}</b></p>
   <div class="grid g2"><div><label class="f">Amount ₹</label><input id="rva" type="number" inputmode="numeric" value="${Math.round(r.due)}"></div>
   <div><label class="f">Paid by</label><div class="seg" style="width:100%"><button style="flex:1" class="on" data-rm="Cash">${t('Cash')}</button><button style="flex:1" data-rm="UPI">UPI</button></div></div>
   ${invShopSel('rvs', 'Received at shop')}<div><label class="f">Note</label><input id="rvn" placeholder="optional"></div></div>
   <div class="row" style="justify-content:flex-end;margin-top:14px"><button class="btn" id="rvx">Cancel</button><button class="btn p" id="rvo">Save payment</button></div>`);
  let mode = 'Cash';
  $$('[data-rm]').forEach(b => b.onclick = () => { mode = b.dataset.rm; $$('[data-rm]').forEach(x => x.classList.toggle('on', x === b)); });
  $('#rvx').onclick = closeModal;
  $('#rvo').onclick = async () => {
    const a = Math.round(+$('#rva').value || 0); if (a <= 0 || a > Math.round(r.due)) { toast(t('Amount must be between ₹1 and the due amount'), 'bad'); return; }
    const ok = await run(async () => { await API.receiveCredit(r.id, a, mode, $('#rvs').value, $('#rvn').value); return true; }, $('#rvo'));
    if (!ok) return;
    const left = r.due - a, sh = shopById($('#rvs').value);
    const msg = LANG.cur === 'hi' ? `नमस्ते ${r.name} जी, ${tenant().name} में आपका ₹${a} भुगतान मिल गया। बाकी उधार: ₹${Math.round(left)}। धन्यवाद 🙏`
      : `Namaste ${r.name} ji, ${tenant().name} me aapka ₹${a} payment mil gaya. Baaki udhar: ₹${Math.round(left)}. Dhanyavaad 🙏`;
    modal(`<h2>${ic('lock', 18)} Payment saved</h2><p>${esc(r.name)}: ₹${a} ${t('received')} · ${t('Due')} ${inr(left)}</p>
     <div class="row" style="justify-content:flex-end"><a class="btn wa" target="_blank" rel="noopener" href="${waLink(r.phone, msg)}">${ic('wa')} Send receipt on WhatsApp</a><button class="btn p" id="rvd">Done</button></div>`);
    $('#rvd').onclick = () => { closeModal(); VIEWS.credit(); };
  };
}
function customerBillsModal(r) {
  modal(`<h2>${esc(r.name)} · <span class="mono">${esc(r.phone)}</span></h2><div id="cbl" class="empty"><span class="spin dk"></span></div><div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn p" id="cbx">Close</button></div>`, true);
  $('#cbx').onclick = closeModal;
  API.customerBills(r.id).then(list => {
    const el = $('#cbl'); if (!el) return; el.className = '';
    el.innerHTML = `<div class="tbl"><table><tr><th>Bill</th><th>When</th><th>Shop</th><th>Mode</th><th class="r">Amount</th><th></th></tr>${list.map(s => `<tr style="${s.status === 'void' ? 'opacity:.55;text-decoration:line-through' : ''}"><td class="mono small b">${s.no}</td><td class="small">${dtm(s.ts)}</td><td class="small">${esc(shopById(s.shopId)?.name || '')}</td><td><span class="badge ${s.mode === 'Credit' ? 'warn' : ''}">${modeLabel(s.mode)}</span></td><td class="r b">${inr(s.total)}</td><td><button class="btn sm" data-cb="${s.id}">View</button></td></tr>`).join('')}</table></div>`;
    $$('[data-cb]').forEach(b => b.onclick = () => { const s = list.find(x => x.id === b.dataset.cb); if (!S.sales.find(x => x.id === s.id)) S.sales.push(s); showReceipt(s); });
  }, e => { const el = $('#cbl'); if (el) el.innerHTML = `<div class="flash bad">${esc(errText(e))}</div>`; });
}
