/* =========================================================
   MuneemX — CLOUD backend (Supabase)
   Auth, Postgres with row-level security, RPC functions for bills
   and stock, Realtime for live dashboards, Edge Function for AI.
   Same API as backend-demo.js.
   ========================================================= */
'use strict';
const STAFF_DOMAIN = 'staff.muneemx.app'; // synthetic e-mail domain for PIN logins (no mail is ever sent)
const staffEmail = (slug, username) => `${slugify(username)}.${slug}@${STAFF_DOMAIN}`;

const CloudAPI = (() => {
  let sb = null, channel = null, onChangeCb = null;
  const LOAD_DAYS = 40;

  function client() {
    if (!sb) {
      if (!window.supabase) throw new Error('Supabase library failed to load (check internet).');
      sb = window.supabase.createClient(MX_CONFIG.supabaseUrl, MX_CONFIG.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true } });
    }
    return sb;
  }
  // a second client that never stores a session — used to create staff / owner logins
  // without signing the current user out
  const tempClient = () => window.supabase.createClient(MX_CONFIG.supabaseUrl, MX_CONFIG.supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false, storageKey: 'mx-temp-' + Date.now() } });
  const ok = ({ data, error }) => { if (error) throw error; return data; };
  async function all(build) { // page through results (PostgREST returns max 1000 rows per call)
    const out = []; for (let from = 0; ; from += 1000) { const rows = ok(await build().range(from, from + 999)); out.push(...rows); if (rows.length < 1000) break; } return out;
  }
  const fire = q => q.then(() => { }, () => { }); // run a request without waiting (supabase-js queries are lazy)
  const ms = t => t ? new Date(t).getTime() : null;

  // ---- row mappers (database → app shape) ----
  const mTenant = t => ({ id: t.id, slug: t.slug, name: t.name, tagline: t.tagline, color: t.color, logo: t.logo, type: t.type, plan: t.plan, city: t.city, status: t.status, footer: t.footer, pol: t.policies });
  const mShop = s => ({ id: s.id, tenantId: s.tenant_id, name: s.name, code: s.code, address: s.address, license: s.license, upi: s.upi, seq: s.seq, lastHash: s.last_hash });
  const mMember = m => ({ id: m.id, tenantId: m.tenant_id, userId: m.user_id, name: m.name, username: m.username, role: m.role, shopId: m.shop_id, phone: m.phone, salary: +m.salary, commission: +m.commission, joined: ms(m.joined_at), active: m.active });
  const mProduct = p => ({ img: p.image_url || null, id: p.id, tenantId: p.tenant_id, brand: p.brand, name: p.name, category: p.category, pack: p.pack, sizeMl: p.size_ml, mrp: +p.mrp, cost: +p.cost, barcode: p.barcode, w: +p.popularity, src: p.source, active: p.active });
  const mSale = s => ({ id: s.id, no: s.bill_no, tenantId: s.tenant_id, shopId: s.shop_id, userId: s.member_id, ts: ms(s.ts), total: +s.total, cost: +s.cost, mode: s.mode, cash: +s.cash, upi: +s.upi, gross: +(s.gross ?? s.total), discount: +(s.discount || 0), credit: +(s.credit || 0), customerId: s.customer_id, upiRef: s.upi_ref, status: s.status, prev: s.prev_hash, hash: s.hash, voidBy: s.void_by, voidReason: s.void_reason, voidTs: ms(s.void_ts),
    items: (s.sale_items || []).sort((a, b) => a.id - b.id).map(i => ({ pid: i.product_id, qty: i.qty, price: +i.price, cost: +i.cost, m: i.method })) });
  const mMove = m => ({ id: m.id, shopId: m.shop_id, ts: ms(m.ts), pid: m.product_id, qty: m.qty, type: m.type, ref: m.ref, party: m.party, by: m.member_id });
  const mCPay = x => ({ id: x.id, tenantId: x.tenant_id, shopId: x.shop_id, customerId: x.customer_id, amount: +x.amount, mode: x.mode, note: x.note, ts: ms(x.ts), by: x.member_id });
  const mExp = e => ({ id: e.id, tenantId: e.tenant_id, shopId: e.shop_id, ts: ms(e.ts), cat: e.category, amount: +e.amount, note: e.note, mode: e.mode, by: e.member_id });

  function emptyState() { return { customers: [], creditPayments: [], tenants: [], shops: [], users: [], products: [], stock: {}, sales: [], moves: [], expenses: [], attendance: {}, advances: [], payroll: [], closings: [], audit: [], me: null, loadedFrom: Date.now() }; }

  async function fetchSales(tid, from, to) {
    return (await all(() => { let q = client().from('sales').select('*, sale_items(*)').eq('tenant_id', tid).gte('ts', new Date(from).toISOString()).order('ts'); if (to) q = q.lt('ts', new Date(to).toISOString()); return q; })).map(mSale);
  }
  async function fetchStock(tid) {
    const rows = await all(() => client().from('stock').select('shop_id,product_id,qty').eq('tenant_id', tid));
    const st = {}; rows.forEach(r => { (st[r.shop_id] = st[r.shop_id] || {})[r.product_id] = r.qty; }); return st;
  }
  async function refreshStock() { S.stock = await fetchStock(SES.tenantId); }
  async function refreshShops() { S.shops = ok(await client().from('shops').select('*').eq('tenant_id', SES.tenantId).order('created_at')).map(mShop); }

  async function loadWorkspace(tid) {
    const c = client(), from = sod(Date.now()) - LOAD_DAYS * DAY, fromIso = new Date(from).toISOString(), m0 = new Date(Math.min(from, monthStart())).toISOString();
    const [tn, shops, members, products, stock, sales, moves, expenses, att, adv, pay, closes, aud, bcs, custs, cpay, ovr] = await Promise.all([
      c.from('tenants').select('*').eq('id', tid).single().then(ok),
      c.from('shops').select('*').eq('tenant_id', tid).order('created_at').then(ok),
      c.from('members').select('*').eq('tenant_id', tid).order('joined_at').then(ok),
      all(() => c.from('products').select('*').or(`tenant_id.is.null,tenant_id.eq.${tid}`).order('created_at')),
      fetchStock(tid),
      fetchSales(tid, from),
      all(() => c.from('stock_moves').select('*').eq('tenant_id', tid).gte('ts', fromIso).order('ts')).catch(() => []),
      all(() => c.from('expenses').select('*').eq('tenant_id', tid).gte('ts', m0).order('ts')).catch(() => []),
      all(() => c.from('attendance').select('*').eq('tenant_id', tid).gte('day', m0.slice(0, 10))).catch(() => []),
      c.from('advances').select('*').eq('tenant_id', tid).gte('ts', m0).then(ok).catch(() => []),
      c.from('payroll').select('*').eq('tenant_id', tid).then(ok).catch(() => []),
      c.from('day_closings').select('*').eq('tenant_id', tid).gte('day', fromIso.slice(0, 10)).then(ok).catch(() => []),
      c.from('audit_log').select('*').eq('tenant_id', tid).order('ts', { ascending: false }).limit(300).then(ok).catch(() => []),
      all(() => c.from('product_barcodes').select('barcode,product_id').eq('tenant_id', tid)).catch(() => []),
      all(() => c.from('customers').select('id,name,phone').eq('tenant_id', tid)).catch(() => []),
      all(() => c.from('credit_payments').select('*').eq('tenant_id', tid).gte('ts', fromIso).order('ts')).catch(() => []),
      all(() => c.from('product_overrides').select('*').eq('tenant_id', tid)).catch(() => [])]);
    const keepMe = S && S.me;
    S = emptyState(); S.me = keepMe; S.loadedFrom = from;
    S.tenants = [mTenant(tn)]; S.shops = shops.map(mShop); S.users = members.map(mMember); S.products = products.map(mProduct);
    ovr.forEach(o => { const p = S.products.find(x => x.id === o.product_id); if (!p) return; if (o.mrp != null) p.mrp = +o.mrp; if (o.cost != null) p.cost = +o.cost; if (o.image_url) p.img = o.image_url; p.custom = true; });
    S.stock = stock; S.sales = sales; S.moves = moves.map(mMove); S.expenses = expenses.map(mExp);
    att.forEach(a => { (S.attendance[a.member_id] = S.attendance[a.member_id] || {})[a.day] = a.status; });
    S.advances = adv.map(a => ({ id: a.id, userId: a.member_id, ts: ms(a.ts), amount: +a.amount, note: a.note }));
    S.payroll = pay.map(p => ({ id: p.id, userId: p.member_id, month: p.month, net: +p.net, ts: ms(p.ts), by: p.approved_by }));
    S.closings = closes.map(x => ({ shopId: x.shop_id, date: x.day, expected: +x.expected, counted: +x.counted, variance: +x.variance, ts: ms(x.ts), by: x.member_id }));
    S.audit = aud.map(a => ({ ts: ms(a.ts), by: a.member_id, t: a.tenant_id, a: a.action, d: a.detail }));
    S.barcodes = {}; bcs.forEach(b => S.barcodes[b.barcode] = b.product_id);
    S.customers = custs; S.creditPayments = cpay.map(mCPay);
    if (S.me && S.me.tenantId === tid) S.me = S.users.find(u => u.id === S.me.id) || S.me;
    startRealtime(tid);
  }

  function startRealtime(tid) {
    if (channel) { client().removeChannel(channel); channel = null; }
    channel = client().channel('sales-' + tid)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales', filter: `tenant_id=eq.${tid}` }, async payload => {
        try {
          const id = payload.new && payload.new.id; if (!id) return;
          const row = ok(await client().from('sales').select('*, sale_items(*)').eq('id', id).maybeSingle()); if (!row) return;
          const s = mSale(row), i = S.sales.findIndex(x => x.id === s.id);
          if (i >= 0) S.sales[i] = s; else S.sales.push(s);
          await refreshStock();
          onChangeCb && onChangeCb();
        } catch (e) { console.warn('realtime', e); }
      }).subscribe();
  }

  // after sign-in: find membership / admin flag and load data
  async function afterAuth() {
    const c = client(); const { data: { user } } = await c.auth.getUser();
    if (!user) return false;
    const mem = ok(await c.from('members').select('*').eq('user_id', user.id).eq('active', true).maybeSingle());
    const admin = !!ok(await c.from('platform_admins').select('user_id').eq('user_id', user.id).maybeSingle());
    S = emptyState();
    if (mem) {
      S.me = mMember(mem); const prev = loadSes();
      SES = { userId: S.me.id, tenantId: S.me.tenantId, shop: prev && prev.userId === S.me.id ? prev.shop : 'all', admin: false };
      await loadWorkspace(S.me.tenantId);
      lsSet('mx_ws', S.tenants[0].slug);
    } else if (admin) {
      S.me = { id: null, name: user.email, role: 'superadmin' };
      const prev = loadSes();
      SES = prev && prev.admin && prev.imp ? prev : { userId: null, tenantId: null, shop: 'all', admin: true };
      if (SES.imp && SES.tenantId) await loadWorkspace(SES.tenantId);
    } else {
      S.me = { id: null, name: user.email, role: 'none', email: user.email };
      SES = { userId: null, tenantId: null, shop: 'all', onboarding: true };
    }
    saveSes(); return true;
  }

  return {
    mode: 'cloud', label: 'Cloud mode',
    async init() {
      S = emptyState();
      const { data } = await client().auth.getSession();
      if (!data.session) return false;
      try { return await afterAuth(); } catch (e) { console.error(e); return false; }
    },
    async workspaceBrand(slug) {
      if (!slug) return null;
      const rows = ok(await client().rpc('workspace_public', { p_slug: slug })); return rows && rows[0] || null;
    },
    async signInStaff(slug, username, pin) {
      const { error } = await client().auth.signInWithPassword({ email: staffEmail(slug, username), password: pin });
      if (error) throw new Error(/invalid/i.test(error.message) ? 'Wrong workspace, username or PIN' : error.message);
      lsSet('mx_ws', slug); return afterAuth();
    },
    async signInEmail(email, password) {
      const { error } = await client().auth.signInWithPassword({ email, password });
      if (error) throw new Error(/invalid/i.test(error.message) ? 'Wrong e-mail or password' : error.message);
      return afterAuth();
    },
    async signUpOwner(email, password) {
      const { data, error } = await client().auth.signUp({ email, password });
      if (error) throw error;
      if (!data.session) throw new Error('Account created. Confirm your e-mail, then sign in. (Or turn off "Confirm email" in Supabase → Authentication.)');
      return afterAuth();
    },
    async createWorkspace(f) {
      ok(await client().rpc('create_workspace', { p_name: f.name, p_slug: f.slug, p_city: f.city, p_type: f.type, p_plan: f.plan || 'Starter', p_color: f.color, p_owner_name: f.owner, p_owner_username: f.username, p_owner_pin: f.pin, p_first_shop: f.shop }));
      return afterAuth();
    },
    async signOut() { if (channel) { client().removeChannel(channel); channel = null; } await client().auth.signOut(); SES = null; S = emptyState(); try { sessionStorage.removeItem('mx_ses_cloud'); } catch (e) { } },
    async load() { if (SES && SES.tenantId) await loadWorkspace(SES.tenantId); },
    async ensureRange(from) {
      if (!S.loadedFrom || from >= S.loadedFrom) return;
      const older = await fetchSales(SES.tenantId, from, S.loadedFrom);
      const mv = (await all(() => client().from('stock_moves').select('*').eq('tenant_id', SES.tenantId).gte('ts', new Date(from).toISOString()).lt('ts', new Date(S.loadedFrom).toISOString()).order('ts')).catch(() => [])).map(mMove);
      S.sales = [...older, ...S.sales]; S.moves = [...mv, ...S.moves]; S.loadedFrom = from;
    },
    // returns a one-time approval token (string) or null; the token is then passed instead of the PIN
    async verifyApproval(shopId, approverId, pin) { return ok(await client().rpc('verify_approval', { p_shop: shopId || null, p_approver: approverId, p_pin: pin })) || null; },
    async lockSale(shopId, lines, pay, approval) {
      const r = ok(await client().rpc('lock_sale', { p_shop: shopId, p_lines: lines.map(l => ({ product_id: l.pid, qty: l.qty, method: l.m })), p_mode: pay.mode, p_cash: pay.cash || 0, p_upi_ref: pay.upiRef || '', p_approver: approval ? approval.approverId : null, p_pin: approval ? approval.pin : null, p_discount: pay.discount || 0, p_cust_name: pay.custName || '', p_cust_phone: pay.custPhone || '' }));
      if (r.customer_id && !(S.customers || []).some(c => c.id === r.customer_id)) (S.customers = S.customers || []).push({ id: r.customer_id, name: pay.custName || '', phone: normPhone(pay.custPhone) });
      else if (r.customer_id && pay.custName) { const c = S.customers.find(c => c.id === r.customer_id); if (c) c.name = pay.custName; }
      const sale = { id: r.id, no: r.bill_no, tenantId: SES.tenantId, shopId, userId: S.me.id, ts: ms(r.ts), total: +r.total, gross: +r.gross, discount: +r.discount, credit: +r.credit, customerId: r.customer_id, cost: +r.cost, mode: r.mode, cash: +r.cash, upi: +r.upi, upiRef: pay.upiRef || '', status: 'locked', prev: r.prev_hash, hash: r.hash,
        items: lines.map(l => { const p = prodById(l.pid); return { pid: l.pid, qty: l.qty, price: p.mrp, cost: p.cost, m: l.m }; }) };
      if (!S.sales.find(x => x.id === sale.id)) S.sales.push(sale);
      lines.forEach(l => { S.stock[shopId] = S.stock[shopId] || {}; S.stock[shopId][l.pid] = (S.stock[shopId][l.pid] || 0) - l.qty; });
      return sale;
    },
    async voidSale(s, reason, approverId, pin) {
      ok(await client().rpc('void_sale', { p_sale: s.id, p_reason: reason, p_approver: approverId, p_pin: pin }));
      s.status = 'void'; s.voidBy = approverId; s.voidReason = reason; s.voidTs = Date.now(); await refreshStock();
    },
    async verifyLedger(ids) { return Promise.all(ids.map(async id => { const r = ok(await client().rpc('verify_ledger', { p_shop: id }))[0]; return { id, n: r.bills, bad: r.broken }; })); },
    async receiveStock(shopId, ref, party, lines) {
      ok(await client().rpc('receive_stock', { p_shop: shopId, p_ref: ref, p_party: party, p_lines: lines.map(l => ({ product_id: l.pid, qty: l.q })) }));
      lines.forEach(l => S.moves.push({ id: uid('m'), shopId, ts: Date.now(), pid: l.pid, qty: l.q, type: 'inward', ref, party, by: S.me.id })); await refreshStock();
    },
    async transferStock(f, t, lines) {
      const ref = ok(await client().rpc('transfer_stock', { p_from: f, p_to: t, p_lines: lines.map(l => ({ product_id: l.pid, qty: l.q })) }));
      lines.forEach(l => S.moves.push({ id: uid('m'), shopId: f, ts: Date.now(), pid: l.pid, qty: -l.q, type: 'transfer', ref }, { id: uid('m'), shopId: t, ts: Date.now(), pid: l.pid, qty: l.q, type: 'transfer', ref })); await refreshStock(); return ref;
    },
    async adjustStock(shopId, counts) {
      const n = ok(await client().rpc('adjust_stock', { p_shop: shopId, p_counts: Object.entries(counts).map(([pid, c]) => ({ product_id: pid, counted: c })) }));
      Object.entries(counts).forEach(([pid, c]) => { const v = c - stockOf(shopId, pid); if (v) S.moves.push({ id: uid('m'), shopId, ts: Date.now(), pid, qty: v, type: 'adjust', ref: 'Physical count' }); });
      await refreshStock(); return n;
    },
    async uploadImage(blob) {
      const path = `${SES.tenantId}/${uid('img')}.jpg`;
      const { error } = await client().storage.from('product-images').upload(path, blob, { contentType: 'image/jpeg', upsert: true });
      if (error) throw new Error('Photo upload failed: ' + error.message);
      return client().storage.from('product-images').getPublicUrl(path).data.publicUrl;
    },
    async addProduct(f, img) {
      const image_url = img ? await this.uploadImage(img.blob) : null;
      const row = ok(await client().from('products').insert({ tenant_id: SES.tenantId, brand: f.brand, name: f.name, category: f.category, pack: f.pack, size_ml: f.sizeMl, mrp: f.mrp, cost: f.cost, barcode: f.barcode, source: f.src || 'manual', popularity: .5, image_url }).select().single());
      const p = mProduct(row); S.products.push(p); fire(client().rpc('log_audit', { p_action: 'Product enrolled', p_detail: `${pname(p)} ${p.pack} · ${p.barcode}` })); return p;
    },
    // img: undefined = keep photo, null = remove photo, {blob,url} = new photo
    async updateProduct(p, f, img) {
      const image_url = img === undefined ? p.img : img === null ? null : await this.uploadImage(img.blob);
      if (p.tenantId) {
        const row = ok(await client().from('products').update({ brand: f.brand, name: f.name, category: f.category, pack: f.pack, size_ml: f.sizeMl, mrp: f.mrp, cost: f.cost, barcode: f.barcode, active: f.active !== false, image_url }).eq('id', p.id).select().single());
        Object.assign(p, mProduct(row));
        fire(client().rpc('log_audit', { p_action: 'Product edited', p_detail: `${pname(p)} ${p.pack} · MRP ₹${p.mrp}` }));
      } else {
        ok(await client().rpc('set_product_override', { p_product: p.id, p_mrp: f.mrp, p_cost: f.cost, p_image: image_url || '' }));
        Object.assign(p, { mrp: f.mrp, cost: f.cost, img: image_url, custom: true });
      }
      return p;
    },
    async addExpense(e) {
      const row = ok(await client().from('expenses').insert({ tenant_id: SES.tenantId, shop_id: e.shopId, category: e.cat, amount: e.amount, note: e.note, mode: e.mode, member_id: S.me.id }).select().single());
      S.expenses.push(mExp(row));
    },
    async setAttendance(memberId, day, st) {
      ok(await client().from('attendance').upsert({ member_id: memberId, tenant_id: SES.tenantId, day, status: st }));
      (S.attendance[memberId] = S.attendance[memberId] || {})[day] = st;
    },
    async addAdvance(memberId, amount, note) {
      const r = ok(await client().from('advances').insert({ tenant_id: SES.tenantId, member_id: memberId, amount, note }).select().single());
      S.advances.push({ id: r.id, userId: memberId, ts: ms(r.ts), amount: +r.amount, note: r.note });
      fire(client().rpc('log_audit', { p_action: 'Advance given', p_detail: `${userById(memberId).name} ${inr(amount)}` }));
    },
    async paySalary(memberId, month, net, approverId, pin) {
      ok(await client().rpc('pay_salary', { p_member: memberId, p_month: month, p_net: net, p_approver: approverId, p_pin: pin }));
      S.payroll.push({ id: uid('pay'), userId: memberId, month, net, ts: Date.now(), by: approverId });
      const u = userById(memberId); S.expenses.push({ id: uid('e'), tenantId: SES.tenantId, shopId: u.shopId, ts: Date.now(), cat: 'Salary', amount: net, note: `${u.name} · ${month}`, mode: 'Bank', by: approverId });
    },
    async closeDay(shopId, date, expected, counted) {
      ok(await client().from('day_closings').insert({ tenant_id: SES.tenantId, shop_id: shopId, day: date, expected, counted, variance: counted - expected, member_id: S.me.id }));
      S.closings.push({ shopId, date, expected, counted, variance: counted - expected, ts: Date.now(), by: S.me.id });
      fire(client().rpc('log_audit', { p_action: 'Day closed', p_detail: `${shopById(shopId).name} ${date} · variance ${inr(counted - expected)}` }));
    },
    async saveTenant(patch) {
      const db = {}; ['name', 'tagline', 'color', 'logo', 'slug', 'footer'].forEach(k => { if (k in patch) db[k] = patch[k]; }); if ('pol' in patch) db.policies = patch.pol;
      ok(await client().from('tenants').update(db).eq('id', SES.tenantId)); Object.assign(tenant(), patch);
      fire(client().rpc('log_audit', { p_action: 'Settings updated', p_detail: Object.keys(patch).join(', ') }));
    },
    async saveShop(id, patch) { const db = {}; ['name', 'license', 'upi', 'address'].forEach(k => { if (k in patch) db[k] = patch[k]; }); ok(await client().from('shops').update(db).eq('id', id)); Object.assign(shopById(id), patch); },
    async addShop() { const n = tShops().length + 1; ok(await client().rpc('add_shop', { p_name: 'New shop ' + n, p_address: tenant().city || '', p_license: '', p_upi: '' })); await refreshShops(); await refreshStock(); },
    async addStaff(f) {
      const slug = tenant().slug;
      const { data, error } = await tempClient().auth.signUp({ email: staffEmail(slug, f.username), password: f.pin });
      if (error) throw new Error(/registered/i.test(error.message) ? 'That username is already taken in this workspace' : error.message);
      if (!data.user) throw new Error('Could not create the login');
      const id = ok(await client().rpc('add_staff', { p_user: data.user.id, p_name: f.name, p_username: f.username, p_role: f.role, p_shop: f.shopId, p_phone: f.phone, p_salary: f.salary, p_commission: f.commission, p_pin: f.pin }));
      S.users.push({ id, tenantId: SES.tenantId, userId: data.user.id, name: f.name, username: f.username, role: f.role, shopId: f.shopId, phone: f.phone, salary: f.salary, commission: f.commission, joined: Date.now(), active: true });
    },
    async audit(a, d) { await client().rpc('log_audit', { p_action: a, p_detail: d }); },
    async linkBarcode(pid, code, approverId, token) {
      ok(await client().rpc('link_barcode', { p_product: pid, p_barcode: code, p_approver: approverId || null, p_pin: token || null }));
      (S.barcodes = S.barcodes || {})[code] = pid;
    },
    async creditSummary() {
      return ok(await client().rpc('credit_summary')).map(r => ({ id: r.customer_id, name: r.name, phone: r.phone, credit: +r.credit_total, paid: +r.paid_total, due: +r.due, bills: r.bills, last: ms(r.last_bill) }));
    },
    async customerBills(cid) { return ok(await client().from('sales').select('*, sale_items(*)').eq('customer_id', cid).order('ts', { ascending: false }).limit(200)).map(mSale); },
    async receiveCredit(cid, amount, mode, shopId, note) {
      ok(await client().rpc('receive_credit', { p_customer: cid, p_amount: amount, p_mode: mode, p_shop: shopId, p_note: note || '' }));
      (S.creditPayments = S.creditPayments || []).push({ id: uid('cp'), tenantId: SES.tenantId, shopId, customerId: cid, amount, mode, note, ts: Date.now(), by: S.me.id });
    },
    async unlinkBarcode(code) { ok(await client().rpc('unlink_barcode', { p_barcode: code })); delete S.barcodes[code]; },
    async adminOverview() {
      const rows = ok(await client().rpc('admin_overview', { p_since: new Date(sod(Date.now())).toISOString() }));
      return rows.map(r => ({ id: r.id, slug: r.slug, name: r.name, type: r.type, plan: r.plan, city: r.city, color: r.color, logo: r.logo, status: r.status, shops: r.shops, users: r.users, today: +r.sales_today, bills: r.bills_today, week: +r.sales_7d }));
    },
    async adminCreateClient(f) {
      const { data, error } = await tempClient().auth.signUp({ email: f.email, password: f.password });
      if (error) throw error; if (!data.user) throw new Error('Could not create the owner login');
      ok(await client().rpc('create_workspace', { p_name: f.name, p_slug: slugify(f.slug || f.name), p_city: f.city, p_type: f.type, p_plan: f.plan, p_color: f.color, p_owner_name: f.owner, p_owner_username: 'owner', p_owner_pin: f.pin, p_first_shop: f.shop, p_owner_user: data.user.id }));
    },
    async openWorkspace(tid) { SES = { ...SES, tenantId: tid, imp: true, shop: 'all' }; saveSes(); await loadWorkspace(tid); },
    async exitWorkspace() { if (channel) { client().removeChannel(channel); channel = null; } SES = { userId: null, tenantId: null, shop: 'all', admin: true }; saveSes(); },
    subscribe(cb) { onChangeCb = cb; },
    async aiScan(kind, file, cat) {
      const img = await shrink(file);
      const { data, error } = await client().functions.invoke('ai-scan', { body: { task: kind, image: await blobToB64(img), mediaType: 'image/jpeg', catalog: cat } });
      if (error) throw new Error('AI scan failed: ' + (error.message || error));
      if (data && data.error) throw new Error(data.error);
      return data;
    }
  };
})();
