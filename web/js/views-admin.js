/* =========================================================
   MuneemX — Platform admin: clients, plans, growth roadmap
   ========================================================= */
'use strict';
function mrr(t) { const n = t.shops; return t.plan === 'Starter' ? 799 * n : t.plan === 'Pro' ? 1499 * n : t.plan === 'Contractor' ? 3999 + Math.max(0, n - 5) * 599 : 0; }

VIEWS.platform = function () {
  $('#view').innerHTML = '<div class="card empty"><span class="spin dk"></span> Loading clients…</div>';
  API.adminOverview().then(rows => {
    if (VIEW !== 'platform') return;
    $('#view').innerHTML = `<div class="grid g4"><div class="card kpi"><div class="l">Clients</div><div class="v">${rows.length}</div></div><div class="card kpi"><div class="l">Shops on platform</div><div class="v">${sum(rows, r => r.shops)}</div></div><div class="card kpi"><div class="l">GMV today</div><div class="v">${inrK(sum(rows, r => r.today))}</div><div class="s">${sum(rows, r => r.bills)} bills</div></div><div class="card kpi"><div class="l">MRR</div><div class="v">${inr(sum(rows, mrr))}</div></div></div>
    <div class="card" style="margin-top:14px"><h3>Client workspaces<span class="sp"></span><button class="btn p sm" id="newt">${ic('plus')} New client</button></h3><div class="tbl"><table><tr><th>Client</th><th>Type</th><th>Plan</th><th class="r">Shops</th><th class="r">Users</th><th class="r">Today</th><th class="r">7 days</th><th class="r">MRR</th><th></th></tr>
    ${rows.map(r => `<tr><td><div class="row"><div class="mark" style="width:30px;height:30px;font-size:11px;background:${esc(r.color)}">${esc(r.logo)}</div><div><div class="b">${esc(r.name)}</div><div class="small mute mono">${esc(r.slug)}</div></div></div></td><td class="small">${esc(r.type)} · ${esc(r.city)}</td><td><span class="badge br">${esc(r.plan)}</span></td><td class="r">${r.shops}</td><td class="r">${r.users}</td><td class="r b">${inrK(r.today)}</td><td class="r">${inrK(r.week)}</td><td class="r">${inr(mrr(r))}</td><td><button class="btn sm" data-open="${r.id}">Open workspace</button></td></tr>`).join('') || '<tr><td colspan="9" class="empty">No clients yet</td></tr>'}</table></div></div>
    <h3 style="margin:22px 0 10px">Plans</h3><div class="grid g4">${PLANS.map(p => `<div class="plan"><div class="b">${p.k}</div><div class="pr">${p.p ? inr(p.p) : 'Talk to us'}</div><div class="small mute">${p.u}</div><ul>${p.f.map(x => `<li>${x}</li>`).join('')}</ul></div>`).join('')}</div>`;
    $$('[data-open]').forEach(b => b.onclick = async () => { const ok = await run(async () => { await API.openWorkspace(b.dataset.open); return true; }, b); if (ok) go('dashboard'); });
    $('#newt').onclick = newClientModal;
  }, e => { $('#view').innerHTML = `<div class="card flash bad">${esc(errText(e))}</div>`; });
};
function newClientModal() {
  const cloud = API.mode === 'cloud';
  modal(`<h2>New client workspace</h2><div class="grid g2"><div><label class="f">Business name</label><input id="tn" placeholder="Maa Durga Wines"></div><div><label class="f">Workspace code</label><input id="tsl" class="mono" placeholder="maa-durga-wines"></div>
   <div><label class="f">City</label><input id="tc" placeholder="Jaipur"></div><div><label class="f">Type</label><select id="tty"><option>Individual shop</option><option>Contractor</option><option>Bar / wholesale</option></select></div>
   <div><label class="f">Plan</label><select id="tp">${PLANS.slice(0, 3).map(p => `<option>${p.k}</option>`).join('')}</select></div><div><label class="f">Brand colour</label><input id="tco" type="color" value="#0f766e" style="height:42px;padding:4px"></div>
   <div><label class="f">First shop name</label><input id="tsh" placeholder="Main Road"></div><div><label class="f">Owner name</label><input id="to"></div>
   ${cloud ? `<div><label class="f">Owner e-mail (login)</label><input id="tem" type="email"></div><div><label class="f">Owner temporary password</label><input id="tpw" placeholder="min 6 characters"></div>` : ''}
   <div><label class="f">Owner approval PIN</label><input id="tpin" value="${cloud ? '' : '1234'}" class="mono" inputmode="numeric"></div></div>
   <p class="small mute">Creates the workspace, first shop, owner login and a copy of the MuneemX master catalog. Stock starts at zero.</p><div id="terr" class="flash bad" style="display:none"></div><div class="row" style="justify-content:flex-end"><button class="btn" id="tcancel">Cancel</button><button class="btn p" id="tsave">Create workspace</button></div>`);
  $('#tn').oninput = e => { if (!$('#tsl').dataset.t) $('#tsl').value = slugify(e.target.value); }; $('#tsl').oninput = e => e.target.dataset.t = 1;
  $('#tcancel').onclick = closeModal;
  $('#tsave').onclick = async () => {
    const f = { name: $('#tn').value.trim(), slug: slugify($('#tsl').value), city: $('#tc').value.trim(), type: $('#tty').value, plan: $('#tp').value, color: $('#tco').value, shop: $('#tsh').value.trim(), owner: $('#to').value.trim() || 'Owner', pin: $('#tpin').value, email: cloud ? $('#tem').value.trim() : '', password: cloud ? $('#tpw').value : '' };
    const err = m => { $('#terr').style.display = 'block'; $('#terr').textContent = m; };
    if (!f.name || !f.slug) return err('Business name and workspace code are required.');
    if (!/^\d{4,6}$/.test(f.pin)) return err('Approval PIN must be 4–6 digits.');
    if (cloud && (!f.email || f.password.length < 6)) return err('Owner e-mail and a password of at least 6 characters are required.');
    const ok = await run(async () => { await API.adminCreateClient(f); return true; }, $('#tsave'));
    if (ok) { closeModal(); toast('Workspace created — share the login with the owner', 'ok'); VIEWS.platform(); }
  };
}
VIEWS.ideas = function () {
  const G = [['Compliance moat (hard to copy)', [
    ['Excise registers on autopilot', 'Daily FL/CL stock registers in each state\'s format, generated from scan-locked bills.'],
    ['Dry-day & licensed-hours lock', 'POS refuses to bill on notified dry days or outside licensed hours, with a central state calendar.'],
    ['Excise label verification', 'Where a state prints a QR or hologram on bottles, scan it at inward and sale to catch spurious stock.'],
    ['Central MRP sync', 'When a state revises MRPs, push the new price list to every client in that state overnight.']]],
  ['Make owners more money', [
    ['Reorder engine', 'Suggest depot orders from per-SKU sales velocity, festival and IPL calendars and weekend spikes.'],
    ['Shrinkage score', 'Per-salesman score from overrides, voids, cash variance and count variance.'],
    ['Bar & wholesale khata', 'Credit ledger for bars and restaurants that buy on account, with WhatsApp due reminders.'],
    ['CCTV bookmarks', 'Each bill timestamp links to the camera clip, so a disputed bill can be checked in seconds.']]],
  ['Revenue lines for MuneemX', [
    ['Hardware bundle', 'Rent an Android POS + 2D scanner + thermal printer kit with the subscription.'],
    ['Working-capital credit', 'Partner with an NBFC to offer stock loans underwritten by locked sales history.'],
    ['Reseller programme', 'POS dealers and CA firms resell MuneemX under their own brand.'],
    ['Aggregated insights', 'Anonymised, consent-based sell-through trends by region and pack for distributors.']]],
  ['Product polish', [
    ['Offline-first billing', 'Keep billing when the internet drops; sync and re-verify the chain when back online.'],
    ['Regional languages', 'Hindi, Marathi, Gujarati, Tamil, Telugu and Kannada UI for salesmen.'],
    ['11:30 pm WhatsApp report', 'Owner gets the day close, cash variance and exceptions on WhatsApp.'],
    ['Native apps', 'Android & iOS builds (Capacitor) with camera barcode scanning and Bluetooth printers.']]]];
  $('#view').innerHTML = G.map(([h, items]) => `<h3 style="margin:6px 0 10px">${h}</h3><div class="grid g4" style="margin-bottom:18px">${items.map(([t, p]) => `<div class="idea"><h4>${t}</h4><p>${p}</p></div>`).join('')}</div>`).join('');
};
