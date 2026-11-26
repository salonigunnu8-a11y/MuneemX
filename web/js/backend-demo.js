/* =========================================================
   MuneemX — DEMO backend
   Everything lives in this browser (localStorage) with 7 days of
   generated sales. Used when Supabase is not configured, or with ?demo=1.
   Same API as backend-cloud.js.
   ========================================================= */
'use strict';
const DEMO_KEY = 'muneemx_demo_v3';

const SPIRITS = [
  ["Officer's Choice", "Blue Whisky", "Whisky", 600, 1.4], ["McDowell's No.1", "Reserve Whisky", "Whisky", 760, 1.5],
  ["Royal Stag", "Deluxe Whisky", "Whisky", 880, 1.6], ["Imperial Blue", "Superior Grain Whisky", "Whisky", 840, 1.4],
  ["8PM", "Premium Black Whisky", "Whisky", 820, 1], ["Blenders Pride", "Rare Premium Whisky", "Whisky", 1350, 1],
  ["Antiquity", "Blue Ultra Premium Whisky", "Whisky", 1450, .5], ["Signature", "Rare Aged Whisky", "Whisky", 1500, .6],
  ["Teacher's", "Highland Cream Scotch", "Scotch", 2400, .4], ["100 Pipers", "Deluxe Blended Scotch", "Scotch", 1900, .4],
  ["Black Dog", "Triple Gold Reserve", "Scotch", 2900, .25], ["Old Monk", "XXX Vatted Rum", "Rum", 620, 1.2],
  ["McDowell's", "Celebration Rum", "Rum", 600, .8], ["Bacardi", "Carta Blanca White Rum", "Rum", 1250, .5],
  ["Magic Moments", "Grain Vodka", "Vodka", 900, .8], ["Smirnoff", "Triple Distilled Vodka", "Vodka", 1150, .5],
  ["Mansion House", "French Brandy", "Brandy", 700, .7], ["Honey Bee", "Brandy", "Brandy", 640, .6], ["Blue Riband", "London Dry Gin", "Gin", 900, .25]];
const OTHERS = [
  ["Kingfisher", "Premium Lager", "Beer", "Pint", 650, 180, 3], ["Kingfisher", "Premium Lager", "Beer", "Can", 500, 150, 1.5],
  ["Kingfisher", "Ultra Lager", "Beer", "Pint", 650, 230, 1], ["Tuborg", "Strong", "Beer", "Pint", 650, 190, 1.6],
  ["Budweiser", "Premium Lager", "Beer", "Pint", 650, 240, 1.2], ["Budweiser", "Magnum Strong", "Beer", "Can", 500, 190, .8],
  ["Bira 91", "White Wheat", "Beer", "Pint", 650, 220, .7], ["Haywards 5000", "Super Strong", "Beer", "Pint", 650, 170, 1.4],
  ["Carlsberg", "Elephant Strong", "Beer", "Pint", 650, 230, .8], ["Sula", "Shiraz Cabernet", "Wine", "Full", 750, 950, .15],
  ["Bacardi Breezer", "Cranberry", "RTD", "Bottle", 275, 120, .5]];

function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

function demoSeed() {
  const R = mulberry(20261123), ri = (a, b) => Math.floor(R() * (b - a + 1)) + a, pick = a => a[Math.floor(R() * a.length)];
  const now = Date.now(), today = sod(now);
  const st = { v: 3, seededAt: now, barcodes: {}, products: [], tenants: [], shops: [], users: [], stock: {}, sales: [], moves: [], expenses: [], attendance: {}, advances: [], payroll: [], closings: [], audit: [], sim: true };
  let n = 1;
  for (const [brand, name, cat, mrp, pop] of SPIRITS) {
    [['Full', 750, mrp, .6], ['Half', 375, Math.round(mrp / 20) * 10 + 10, 1.2], ['Quarter', 180, Math.round(mrp / 40) * 10 + 10, 3]].forEach(([pack, ml, p, w]) => {
      st.products.push({ id: 'p' + n, tenantId: null, brand, name, category: cat, pack, sizeMl: ml, mrp: p, cost: Math.round(p * .84), barcode: ean('890' + String(100000000 + n * 7919).slice(-9)), w: w * pop, src: 'master' }); n++;
    });
  }
  for (const [brand, name, cat, pack, ml, mrp, pop] of OTHERS) { st.products.push({ id: 'p' + n, tenantId: null, brand, name, category: cat, pack, sizeMl: ml, mrp, cost: Math.round(mrp * .86), barcode: ean('890' + String(100000000 + n * 7919).slice(-9)), w: pop * 1.6, src: 'master' }); n++; }

  st.tenants = [
    { id: 't1', slug: 'royal-spirits', name: 'Royal Spirits', tagline: 'Licensed liquor contractors · Indore', color: '#6d28d9', logo: 'RS', type: 'Contractor', plan: 'Contractor', city: 'Indore', status: 'active', footer: 'Drink responsibly. Sale to persons below the legal age is prohibited.', pol: { ...DEF_POL } },
    { id: 't2', slug: 'shree-balaji', name: 'Shree Balaji Wines', tagline: 'Family wine shop since 1998 · Nagpur', color: '#c2410c', logo: 'SB', type: 'Individual shop', plan: 'Pro', city: 'Nagpur', status: 'active', footer: 'Thank you! Please drink responsibly.', pol: { ...DEF_POL, ageLimit: 25 } }];
  st.shops = [
    { id: 's1', tenantId: 't1', name: 'Vijay Nagar', code: 'RSV', address: 'Scheme 54, Vijay Nagar, Indore', license: 'FL-1/2026/IND/0412', upi: 'royalspirits.vn@okaxis', seq: 0, lastHash: '00000000' },
    { id: 's2', tenantId: 't1', name: 'Palasia', code: 'RSP', address: 'New Palasia, Indore', license: 'FL-1/2026/IND/0413', upi: 'royalspirits.pl@okaxis', seq: 0, lastHash: '00000000' },
    { id: 's3', tenantId: 't1', name: 'Rau Highway', code: 'RSR', address: 'AB Road, Rau, Indore', license: 'FL-1/2026/IND/0458', upi: 'royalspirits.rau@okaxis', seq: 0, lastHash: '00000000' },
    { id: 's4', tenantId: 't2', name: 'Sitabuldi', code: 'SBW', address: 'Main Road, Sitabuldi, Nagpur', license: 'FL-II/2026/NGP/1187', upi: 'shreebalaji@okhdfc', seq: 0, lastHash: '00000000' }];
  const U = (id, t, name, role, shop, sal, com, ph) => ({ id, tenantId: t, name, username: name.split(' ')[0].toLowerCase(), role, shopId: shop, pin: '1234', salary: sal, commission: com, phone: ph, joined: now - ri(60, 900) * DAY, active: true });
  st.users = [
    U('u0', null, 'Platform Admin', 'superadmin', null, 0, 0, '—'),
    U('u1', 't1', 'Rajesh Malviya', 'owner', null, 0, 0, '98260 11223'),
    U('u2', 't1', 'Amit Choudhary', 'manager', 's1', 22000, 0, '98270 45122'), U('u3', 't1', 'Ravi Yadav', 'salesman', 's1', 13500, .5, '97520 66110'), U('u4', 't1', 'Sonu Patel', 'salesman', 's1', 12500, .5, '99070 21345'),
    U('u5', 't1', 'Deepak Rathore', 'manager', 's2', 21000, 0, '98935 88021'), U('u6', 't1', 'Imran Khan', 'salesman', 's2', 13000, .5, '97131 55409'), U('u7', 't1', 'Pawan Verma', 'salesman', 's2', 12000, .5, '93003 44871'),
    U('u8', 't1', 'Mahesh Solanki', 'manager', 's3', 22500, 0, '94250 30017'), U('u9', 't1', 'Kishore Joshi', 'salesman', 's3', 13000, .5, '98262 11908'), U('u10', 't1', 'Bablu Gurjar', 'salesman', 's3', 12500, .5, '70000 81234'),
    U('u11', 't2', 'Sunil Agrawal', 'owner', null, 0, 0, '98220 77810'), U('u12', 't2', 'Prakash Meshram', 'manager', 's4', 19000, 0, '98908 23310'), U('u13', 't2', 'Vikas Bhoyar', 'salesman', 's4', 12000, .5, '95520 11873')];
  const HW = [[10, 1], [11, 2], [12, 3], [13, 3], [14, 3], [15, 3], [16, 4], [17, 6], [18, 9], [19, 11], [20, 12], [21, 10], [22, 6]];
  const hwT = HW.reduce((a, x) => a + x[1], 0), prods = st.products, pwT = prods.reduce((a, p) => a + p.w, 0);
  const pickP = () => { let r = R() * pwT; for (const p of prods) { r -= p.w; if (r <= 0) return p; } return prods[0]; };
  const sold = {}, vol = { s1: [110, 150], s2: [90, 130], s3: [130, 180], s4: [70, 105] }, raw = [];
  for (let d = 6; d >= 0; d--) {
    const day = today - d * DAY;
    for (const sh of st.shops) {
      sold[sh.id] = sold[sh.id] || {};
      const sm = st.users.filter(u => u.shopId === sh.id && u.role === 'salesman');
      const nb = ri(...vol[sh.id]) * (new Date(day).getDay() >= 5 ? 1.25 : 1);
      for (let b = 0; b < nb; b++) {
        let r = R() * hwT, h = 10; for (const [hh, w] of HW) { r -= w; if (r <= 0) { h = hh; break; } }
        const ts = day + (h - 5) * 36e5 + ri(0, 59) * 6e4 + ri(0, 59) * 1e3; if (ts > now) continue;
        const k = R() < .6 ? 1 : R() < .85 ? 2 : 3, items = [];
        for (let i = 0; i < k; i++) {
          const p = pickP(); if (items.find(x => x.pid === p.id)) continue; const q = p.category === 'Beer' && R() < .4 ? ri(2, 4) : 1;
          const m = R() < .97 ? 'scan' : R() < .7 ? 'ai' : 'ovr'; items.push({ pid: p.id, qty: q, price: p.mrp, cost: p.cost, m }); sold[sh.id][p.id] = (sold[sh.id][p.id] || 0) + q;
        }
        const total = sum(items, i => i.price * i.qty), cost = sum(items, i => i.cost * i.qty);
        const pr = R(), mode = pr < .55 ? 'UPI' : pr < .95 ? 'Cash' : 'Split'; const cashPart = mode === 'Split' ? Math.round(total * .4 / 10) * 10 : 0;
        raw.push({ shopId: sh.id, tenantId: sh.tenantId, userId: (R() < .12 ? st.users.find(u => u.shopId === sh.id && u.role === 'manager') : pick(sm)).id, ts, items, total, cost, mode,
          cash: mode === 'Cash' ? total : mode === 'Split' ? cashPart : 0, upi: mode === 'UPI' ? total : mode === 'Split' ? total - cashPart : 0, upiRef: mode !== 'Cash' ? String(ri(100000, 999999)) + String(ri(100000, 999999)) : '', status: 'locked' });
      }
    }
  }
  raw.sort((a, b) => a.ts - b.ts);
  for (const s of raw) { const sh = st.shops.find(x => x.id === s.shopId); sh.seq++; s.no = sh.code + '-' + String(sh.seq).padStart(5, '0'); s.id = s.no; s.prev = sh.lastHash; s.hash = hashSale(s); sh.lastHash = s.hash; st.sales.push(s); }
  for (let i = 0; i < 5; i++) {
    const s = pick(st.sales); if (s.status === 'void') continue; s.status = 'void'; s.voidBy = st.users.find(u => u.shopId === s.shopId && u.role === 'manager').id; s.voidReason = pick(['Customer returned sealed bottle', 'Wrong item scanned', 'Duplicate bill']); s.voidTs = s.ts + ri(1, 20) * 6e4;
    s.items.forEach(it => sold[s.shopId][it.pid] -= it.qty);
  }
  for (const sh of st.shops) {
    st.stock[sh.id] = {};
    const t0 = today - 7 * DAY + 4 * 36e5, t1 = today - 3 * DAY + 5 * 36e5, inv = 'INV/' + sh.code + '/' + ri(2000, 2999);
    for (const p of prods) {
      const s = sold[sh.id][p.id] || 0;
      const remain = R() < .07 ? ri(0, 5) : p.pack === 'Quarter' ? ri(40, 180) : p.category === 'Beer' ? ri(36, 200) : p.pack === 'Half' ? ri(18, 70) : ri(8, 40);
      const inw = R() < .55 ? Math.round((s + remain) * .4) : 0;
      st.stock[sh.id][p.id] = remain;
      st.moves.push({ id: uid('m'), shopId: sh.id, ts: t0, pid: p.id, qty: s + remain - inw, type: 'opening', ref: 'Opening stock', by: null });
      if (inw) st.moves.push({ id: uid('m'), shopId: sh.id, ts: t1, pid: p.id, qty: inw, type: 'inward', ref: inv, party: sh.tenantId === 't1' ? 'MP State Beverages Depot' : 'MSBC Depot, Nagpur', by: null });
    }
  }
  for (let d = 6; d >= 0; d--) {
    const day = today - d * DAY;
    for (const sh of st.shops) {
      const E = (c, a, n, h, mode) => st.expenses.push({ id: uid('e'), tenantId: sh.tenantId, shopId: sh.id, ts: day + (h - 5) * 36e5, cat: c, amount: a, note: n, mode: mode || 'Cash', by: null });
      E('Tea & snacks', ri(80, 220), 'Staff chai', 16);
      if (R() < .5) E('Transport', ri(300, 900), 'Depot pickup tempo', 11);
      if (R() < .25) E('Maintenance', ri(250, 1500), pick(['Fridge repair', 'Shutter grease', 'Light tube']), 13);
      if (d === 6) E('Rent', ri(28, 45) * 1000, 'Monthly shop rent', 12, 'Bank');
      if (d === 5) E('Electricity', ri(42, 75) * 100, 'Electricity bill', 12, 'UPI');
      if (d === 3) E('Security', ri(6, 9) * 1000, 'Night guard', 12, 'Bank');
    }
  }
  const dnow = new Date(now - BIZ), mk = monthKey();
  for (const u of st.users) { if (!u.shopId) continue; st.attendance[u.id] = {}; for (let d = 1; d <= dnow.getDate(); d++) { const r = R(); st.attendance[u.id][mk + '-' + pad(d)] = r < .9 ? 'P' : r < .95 ? 'H' : 'A'; } }
  st.advances.push({ id: uid('a'), userId: 'u3', ts: today - 4 * DAY, amount: 2000, note: 'Medical' }, { id: uid('a'), userId: 'u7', ts: today - 2 * DAY, amount: 1500, note: 'Festival' }, { id: uid('a'), userId: 'u13', ts: today - 5 * DAY, amount: 1000, note: 'Personal' });
  st.audit.push({ ts: now - DAY, by: 'u0', t: 't1', a: 'Workspace provisioned', d: 'Contractor plan · 3 shops' });
  return st;
}

const DemoAPI = (() => {
  let DB = null;
  const save = () => lsSet(DEMO_KEY, DB);
  const log = (a, d) => DB.audit.push({ ts: Date.now(), by: SES && (SES.imp ? 'u0' : SES.userId), t: SES && SES.tenantId, a, d });
  const pinOk = (approverId, pin, shopId) => { const u = DB.users.find(x => x.id === approverId); return !!u && u.pin === pin && (u.role === 'owner' || (u.role === 'manager' && (!shopId || u.shopId === shopId))); };

  function demoCustomer(name, phone) {
    phone = normPhone(phone); name = String(name || '').trim(); if (!name && !phone) return null;
    DB.customers = DB.customers || [];
    let c = phone && DB.customers.find(x => x.tenantId === SES.tenantId && x.phone === phone);
    if (c) { if (name) c.name = name; return c.id; }
    c = { id: uid('c'), tenantId: SES.tenantId, name, phone }; DB.customers.push(c); return c.id;
  }
  function commit(shopId, userId, lines, pay) {
    const sh = DB.shops.find(s => s.id === shopId);
    lines = lines.filter(l => l.qty > 0);
    const sale = { tenantId: sh.tenantId, shopId, userId, ts: Date.now(), items: lines.map(l => { const p = prodById(l.pid); return { pid: l.pid, qty: l.qty, price: p.mrp, cost: p.cost, m: l.m }; }), mode: pay.mode, upiRef: pay.upiRef || '', status: 'locked' };
    sale.gross = sum(sale.items, i => i.price * i.qty); sale.discount = Math.round(pay.discount || 0); sale.total = sale.gross - sale.discount; sale.cost = sum(sale.items, i => i.cost * i.qty);
    sale.credit = pay.mode === 'Credit' ? sale.total : 0;
    sale.cash = pay.mode === 'Cash' ? sale.total : pay.mode === 'Split' ? Math.min(pay.cash, sale.total) : 0; sale.upi = sale.total - sale.cash - sale.credit;
    sale.customerId = (pay.custName || pay.custPhone) ? demoCustomer(pay.custName, pay.custPhone) : null;
    sh.seq++; sale.no = sh.code + '-' + String(sh.seq).padStart(5, '0'); sale.id = sale.no; sale.prev = sh.lastHash; sale.hash = hashSale(sale); sh.lastHash = sale.hash;
    sale.items.forEach(i => DB.stock[shopId][i.pid] = (DB.stock[shopId][i.pid] || 0) - i.qty);
    DB.sales.push(sale); return sale;
  }

  return {
    mode: 'demo', label: 'Demo mode — data stays in this browser',
    async init() {
      DB = lsGet(DEMO_KEY, null);
      if (!DB || DB.v !== 3 || Date.now() - DB.seededAt > 3 * DAY) { DB = demoSeed(); save(); }
      DB.barcodes = DB.barcodes || {}; DB.customers = DB.customers || []; DB.creditPayments = DB.creditPayments || []; S = DB; S.me = null;
      const ses = loadSes();
      if (ses && DB.users.find(u => u.id === ses.userId)) { SES = ses; S.me = DB.users.find(u => u.id === ses.userId); return true; }
      return false;
    },
    reset() { DB = demoSeed(); S = DB; save(); },
    demoWorkspaces: () => DB.tenants,
    demoUsers: tid => tid ? DB.users.filter(u => u.tenantId === tid) : DB.users.filter(u => u.role === 'superadmin'),
    async signInDemo(userId, pin) {
      const u = DB.users.find(x => x.id === userId); if (!u || u.pin !== pin) throw new Error('Wrong PIN. Demo PIN is 1234.');
      S.me = u; SES = { userId: u.id, tenantId: u.tenantId, shop: 'all', admin: u.role === 'superadmin' }; saveSes();
    },
    async signOut() { SES = null; S.me = null; try { sessionStorage.removeItem('mx_ses_demo'); } catch (e) { } },
    async load() { },
    async ensureRange() { },
    async verifyApproval(shopId, approverId, pin) { return pinOk(approverId, pin, shopId); },
    async lockSale(shopId, lines, pay, approval) {
      const P = pol();
      for (const l of lines) {
        if (P.stockLock && stockOf(shopId, l.pid) < l.qty) throw new Error('Stock lock: not enough ' + pname(prodById(l.pid)));
        if (l.m === 'ovr' && !(approval && pinOk(approval.approverId, approval.pin, shopId))) throw new Error('Override needs manager approval');
      }
      const gross = sum(lines, l => prodById(l.pid).mrp * l.qty), net = gross - (pay.discount || 0);
      if ((pay.discount || 0) < 0 || (pay.discount || 0) >= gross) throw new Error('Discount must be less than the bill total');
      if (pay.mode === 'Split' && !(pay.cash > 0 && pay.cash < net)) throw new Error('Split: cash part must be between ₹1 and the bill total');
      if (pay.mode === 'Credit' && (!String(pay.custName || '').trim() || normPhone(pay.custPhone).length !== 10)) throw new Error('Udhar needs the customer name and a 10-digit mobile number');
      const sale = commit(shopId, SES.userId, lines, pay);
      if (lines.some(l => l.m === 'ovr')) log('Bill with manual override', sale.no);
      if (sale.discount) log('Discount given', `${sale.no} · ₹${sale.discount} off ₹${sale.gross}`);
      if (sale.credit) log('Udhar bill', `${sale.no} · ₹${sale.credit} · ${pay.custName}`);
      save(); return sale;
    },
    simulateSale() {
      const shops = tShops(); if (!shops.length) return;
      const sh = shops[Math.floor(Math.random() * shops.length)];
      const sm = DB.users.filter(u => u.shopId === sh.id && u.role === 'salesman'); if (!sm.length) return;
      const ps = visibleProducts().filter(p => stockOf(sh.id, p.id) > 0); if (!ps.length) return;
      const tw = sum(ps, p => p.w || 1); let r = Math.random() * tw, p = ps[0]; for (const x of ps) { r -= (x.w || 1); if (r <= 0) { p = x; break; } }
      const q = Math.min(p.category === 'Beer' && Math.random() < .4 ? 2 : 1, stockOf(sh.id, p.id)), mode = Math.random() < .55 ? 'UPI' : 'Cash';
      commit(sh.id, sm[Math.floor(Math.random() * sm.length)].id, [{ pid: p.id, qty: q, m: Math.random() < .93 ? 'scan' : 'ai' }], { mode, upiRef: mode === 'UPI' ? String(Date.now()).slice(-12) : '' });
      save();
    },
    async voidSale(s, reason, approverId, pin) {
      if (!pinOk(approverId, pin, s.shopId)) throw new Error('Wrong approval PIN');
      s.status = 'void'; s.voidBy = approverId; s.voidReason = reason; s.voidTs = Date.now();
      s.items.forEach(i => DB.stock[s.shopId][i.pid] = (DB.stock[s.shopId][i.pid] || 0) + i.qty);
      log('Bill voided', `${s.no} · ${inr(s.total)} · ${reason} · approved by ${userById(approverId).name}`); save();
    },
    async verifyLedger(ids) {
      return ids.map(id => { const arr = DB.sales.filter(s => s.shopId === id).sort((a, b) => a.ts - b.ts); let prev = '00000000', bad = 0; for (const s of arr) { if (s.prev !== prev || hashSale(s) !== s.hash) bad++; prev = s.hash; } return { id, n: arr.length, bad }; });
    },
    async receiveStock(shopId, ref, party, lines) {
      lines.forEach(l => { DB.stock[shopId][l.pid] = (DB.stock[shopId][l.pid] || 0) + l.q; DB.moves.push({ id: uid('m'), shopId, ts: Date.now(), pid: l.pid, qty: l.q, type: 'inward', ref, party, by: SES.userId }); });
      log('Stock received', `${shopById(shopId).name} · ${ref} · ${sum(lines, l => l.q)} units`); save();
    },
    async transferStock(f, t, lines) {
      for (const l of lines) if (stockOf(f, l.pid) < l.q) throw new Error(`Not enough ${pname(prodById(l.pid))} at ${shopById(f).name}`);
      const ref = 'TRF-' + Date.now().toString().slice(-6);
      lines.forEach(l => { DB.stock[f][l.pid] -= l.q; DB.stock[t][l.pid] = (DB.stock[t][l.pid] || 0) + l.q; DB.moves.push({ id: uid('m'), shopId: f, ts: Date.now(), pid: l.pid, qty: -l.q, type: 'transfer', ref, by: SES.userId }, { id: uid('m'), shopId: t, ts: Date.now(), pid: l.pid, qty: l.q, type: 'transfer', ref, by: SES.userId }); });
      log('Stock transfer', `${ref} · ${shopById(f).name} → ${shopById(t).name}`); save(); return ref;
    },
    async adjustStock(shopId, counts) {
      let n = 0; Object.entries(counts).forEach(([pid, c]) => { const v = c - stockOf(shopId, pid); if (v) { DB.stock[shopId][pid] = c; DB.moves.push({ id: uid('m'), shopId, ts: Date.now(), pid, qty: v, type: 'adjust', ref: 'Physical count', by: SES.userId }); n++; } });
      log('Stock count posted', `${shopById(shopId).name} · ${n} variances`); save(); return n;
    },
    async addProduct(f, img) {
      if (visibleProducts().some(p => p.barcode === f.barcode)) throw new Error('That barcode already exists in your database.');
      const p = { id: uid('p'), tenantId: SES.tenantId, ...f, img: img ? img.url : null, w: .5 }; DB.products.push(p);
      tShops().forEach(s => DB.stock[s.id][p.id] = DB.stock[s.id][p.id] || 0);
      log('Product enrolled', `${pname(p)} ${p.pack} · ${p.barcode}${p.src === 'ai' ? ' (AI)' : ''}`); save(); return p;
    },
    async updateProduct(p, f, img) {
      if (role() === 'salesman') throw new Error('Only an owner or manager can edit the catalog');
      if (p.tenantId && f.barcode !== p.barcode && visibleProducts().some(x => x.barcode === f.barcode && x.id !== p.id)) throw new Error('That barcode already exists in your database.');
      const im = img === undefined ? p.img : img === null ? null : img.url;
      if (p.tenantId) Object.assign(p, f, { img: im }); else Object.assign(p, { mrp: f.mrp, cost: f.cost, img: im, custom: true });
      log('Product edited', `${pname(p)} ${p.pack} · MRP ₹${p.mrp}`); save(); return p;
    },
    async addExpense(e) { DB.expenses.push({ id: uid('e'), tenantId: SES.tenantId, ts: Date.now(), by: SES.userId, ...e }); log('Expense added', `${e.cat} ${inr(e.amount)}`); save(); },
    async setAttendance(memberId, day, st) { DB.attendance[memberId] = DB.attendance[memberId] || {}; DB.attendance[memberId][day] = st; save(); },
    async addAdvance(memberId, amount, note) { DB.advances.push({ id: uid('a'), userId: memberId, ts: Date.now(), amount, note }); log('Advance given', `${userById(memberId).name} ${inr(amount)}`); save(); },
    async paySalary(memberId, month, net, approverId, pin) {
      const u = userById(memberId); if (!pinOk(approverId, pin, u.shopId)) throw new Error('Wrong approval PIN');
      DB.payroll.push({ id: uid('pay'), userId: memberId, month, net, ts: Date.now(), by: approverId });
      DB.expenses.push({ id: uid('e'), tenantId: SES.tenantId, shopId: u.shopId, ts: Date.now(), cat: 'Salary', amount: net, note: `${u.name} · ${month}`, mode: 'Bank', by: approverId });
      log('Salary paid', `${u.name} ${inr(net)}`); save();
    },
    async closeDay(shopId, date, expected, counted) { DB.closings.push({ shopId, date, expected, counted, variance: counted - expected, ts: Date.now(), by: SES.userId }); log('Day closed', `${shopById(shopId).name} ${date} · variance ${inr(counted - expected)}`); save(); },
    async saveTenant(patch) { Object.assign(tenant(), patch); log('Settings updated', Object.keys(patch).join(', ')); save(); },
    async saveShop(id, patch) { Object.assign(shopById(id), patch); save(); },
    async addShop() {
      const t = tenant(), n = tShops().length + 1;
      const s = { id: uid('s'), tenantId: t.id, name: 'New shop ' + n, code: t.logo.slice(0, 2) + String.fromCharCode(64 + n), address: t.city, license: '', upi: t.slug + n + '@upi', seq: 0, lastHash: '00000000' };
      DB.shops.push(s); DB.stock[s.id] = {}; visibleProducts().forEach(p => DB.stock[s.id][p.id] = 0); log('Shop added', s.name); save();
    },
    async addStaff(f) {
      if (tUsers().some(u => u.username === f.username)) throw new Error('Username already used');
      const u = { id: uid('u'), tenantId: SES.tenantId, name: f.name, username: f.username, role: f.role, shopId: f.shopId, pin: f.pin, salary: f.salary, commission: f.commission, phone: f.phone, joined: Date.now(), active: true };
      DB.users.push(u); DB.attendance[u.id] = {}; log('Staff added', `${u.name} (${u.role})`); save();
    },
    async audit(a, d) { log(a, d); save(); },
    async linkBarcode(pid, code, approverId, pin) {
      if (role() === 'salesman' && !pinOk(approverId, pin, S.me.shopId)) throw new Error('Manager approval needed');
      const owner = visibleProducts().find(p => p.barcode === code && p.id !== pid); if (owner) throw new Error('This barcode already belongs to another product');
      (DB.barcodes = DB.barcodes || {})[code] = pid; const p = prodById(pid); log('Barcode linked', `${code} → ${pname(p)} ${p.pack}`); save();
    },
    async creditSummary() {
      const m = {};
      DB.sales.filter(x => x.tenantId === SES.tenantId && x.status !== 'void' && x.credit > 0).forEach(x => { const r = m[x.customerId] = m[x.customerId] || { cr: 0, pd: 0, n: 0, last: 0 }; r.cr += x.credit; r.n++; r.last = Math.max(r.last, x.ts); });
      DB.creditPayments.filter(x => x.tenantId === SES.tenantId).forEach(x => { const r = m[x.customerId] = m[x.customerId] || { cr: 0, pd: 0, n: 0, last: 0 }; r.pd += x.amount; });
      return Object.entries(m).map(([id, r]) => { const c = DB.customers.find(x => x.id === id) || {}; return { id, name: c.name || '?', phone: c.phone || '', credit: r.cr, paid: r.pd, due: r.cr - r.pd, bills: r.n, last: r.last }; }).sort((a, b) => b.due - a.due);
    },
    async customerBills(cid) { return DB.sales.filter(x => x.customerId === cid).sort((a, b) => b.ts - a.ts); },
    async receiveCredit(cid, amount, mode, shopId, note) {
      const r = (await this.creditSummary()).find(x => x.id === cid); if (!r || amount <= 0 || amount > r.due) throw new Error(`Amount must be between ₹1 and the due amount (₹${r ? r.due : 0})`);
      DB.creditPayments.push({ id: uid('cp'), tenantId: SES.tenantId, shopId, customerId: cid, amount, mode, note: note || '', ts: Date.now(), by: SES.userId });
      log('Udhar received', `${r.name} · ₹${amount} · ${mode}`); save();
    },
    async unlinkBarcode(code) { delete DB.barcodes[code]; log('Barcode unlinked', code); save(); },
    async adminOverview() {
      const t0 = sod(Date.now());
      return DB.tenants.map(t => { const ids = DB.shops.filter(s => s.tenantId === t.id).map(s => s.id); return { ...t, shops: ids.length, users: DB.users.filter(u => u.tenantId === t.id).length, today: sum(liveSales(ids, t0), s => s.total), bills: liveSales(ids, t0).length, week: sum(liveSales(ids, t0 - 6 * DAY), s => s.total) }; });
    },
    async adminCreateClient(f) {
      const id = uid('t'), slug = slugify(f.slug || f.name);
      if (DB.tenants.some(t => t.slug === slug)) throw new Error('Workspace code already taken');
      const t = { id, slug, name: f.name, tagline: f.type + ' · ' + (f.city || ''), color: f.color, logo: ini(f.name), type: f.type, plan: f.plan, city: f.city, status: 'active', footer: 'Please drink responsibly.', pol: { ...DEF_POL } };
      const s = { id: uid('s'), tenantId: id, name: f.shop || 'Main shop', code: ini(f.name) + 'A', address: f.city, license: '', upi: slug + '@upi', seq: 0, lastHash: '00000000' };
      DB.tenants.push(t); DB.shops.push(s); DB.stock[s.id] = {}; DB.products.filter(p => !p.tenantId).forEach(p => DB.stock[s.id][p.id] = 0);
      DB.users.push({ id: uid('u'), tenantId: id, name: f.owner || 'Owner', username: 'owner', role: 'owner', shopId: null, pin: f.pin || '1234', salary: 0, commission: 0, phone: '', joined: Date.now(), active: true });
      DB.audit.push({ ts: Date.now(), by: 'u0', t: id, a: 'Workspace provisioned', d: t.plan }); save();
    },
    async openWorkspace(tid) { SES = { ...SES, tenantId: tid, imp: true, shop: 'all' }; log('Admin opened workspace', 'Support access'); save(); saveSes(); },
    async exitWorkspace() { SES = { userId: 'u0', tenantId: null, shop: 'all', admin: true }; saveSes(); },
    subscribe() { },
    async aiScan(kind, file, cat) {
      // Inside Claude (artifact preview) the page can borrow Claude's vision; otherwise AI needs cloud mode.
      const sample = (window.claude && window.claude.use) ? await window.claude.use('sample').catch(() => null) : null;
      if (!sample) throw new Error('AI scan runs in cloud mode (Supabase edge function "ai-scan"). Connect Supabase to enable it.');
      const lim = await sample.limits().catch(() => ({})); if (!lim.images) throw new Error('Image AI is not available in this view.');
      const r = await sample(AI_PROMPTS[kind](cat), { images: [await shrink(file)], modelTier: 'default' });
      return parseJSON(r.text);
    },
    save
  };
})();
