/* =========================================================
   MuneemX — scanning
   1. USB / Bluetooth "keyboard" scanners: captured anywhere on the page,
      even when the scan box has lost focus.
   2. Live camera scanning (phones, tablets, laptop webcams).
   3. Linking a real bottle's barcode to a catalog product.
   ========================================================= */
'use strict';

// Current receiver of scans. Screens set it (POS → posScan, inventory pickers → their handler).
let SCAN_HANDLER = null;
const normCode = s => String(s || '').replace(/[\u0000-\u001f\u007f]/g, '').trim();

// Find a product by barcode: catalog barcode, or a barcode linked by this workspace.
// Also tolerates UPC-A (12 digits) vs EAN-13 (leading 0) differences between scanners.
// Cartons: a linked barcode may stand for a carton of N bottles.
const DEFAULT_CASE = { Full: 12, Half: 24, Quarter: 48, Pint: 12, Can: 24, Bottle: 24, Nip: 96 };
// Look a scanned code up. Returns { p, units } (units = bottles in one scan: 1, or the carton size) or null.
function lookupCode(raw) {
  const code = normCode(raw); if (!code) return null;
  const tries = [code]; if (/^\d{12}$/.test(code)) tries.push('0' + code); if (/^0\d{12}$/.test(code)) tries.push(code.slice(1));
  const vis = visibleProducts();
  for (const c of tries) {
    const p = vis.find(p => p.barcode === c); if (p) return { p, units: 1 };
    const pid = (S.barcodes || {})[c]; if (pid) { const q = prodById(pid); if (q && vis.includes(q)) return { p: q, units: (S.bcUnits || {})[c] || 1 }; }
  }
  return null;
}
function findByBarcode(raw) { const r = lookupCode(raw); return r ? r.p : null; }
const linkedCodes = pid => Object.entries(S.barcodes || {}).filter(([, v]) => v === pid).map(([k]) => k);
// bottles per carton for a product: its linked carton barcode, else the usual size for the pack
function caseSize(p) {
  if (!p) return 12;
  const u = linkedCodes(p.id).map(c => (S.bcUnits || {})[c] || 1).filter(n => n > 1);
  return u.length ? Math.max(...u) : (DEFAULT_CASE[p.pack] || 12);
}
// "3 ctn + 5" style label
function cq(q, cs) { if (!cs || cs <= 1 || Math.abs(q) < cs) return String(q); const c = Math.trunc(q / cs), r = q - c * cs; return `${c} ${t('ctn')}${r ? ' + ' + r : ''}`; }

/* ---------- 1. keyboard-wedge scanners anywhere on the page ---------- */
(function () {
  let buf = '', last = 0, idle = null;
  const fire = () => { const c = buf; buf = ''; if (c.length >= 4 && SCAN_HANDLER) SCAN_HANDLER(c); };
  document.addEventListener('keydown', e => {
    if (!SCAN_HANDLER || e.ctrlKey || e.altKey || e.metaKey) return;
    const el = document.activeElement, typing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
    if (typing || $('#modal').innerHTML) { buf = ''; return; }   // a focused box handles its own Enter
    const now = Date.now();
    if (now - last > 80) buf = '';                               // scanners type a burst within ~30 ms per key
    last = now; clearTimeout(idle);
    if (e.key === 'Enter' || e.key === 'Tab' || e.key === 'NumpadEnter') {
      if (buf.length >= 4) { e.preventDefault(); fire(); }
      buf = ''; return;
    }
    if (e.key.length === 1) {
      buf += e.key;
      // scanner set to "no suffix": a fast burst of 8+ characters followed by silence counts as a scan
      idle = setTimeout(() => { if (buf.length >= 8) fire(); else buf = ''; }, 160);
    }
  }, true);
})();

// For a focused scan box: submit automatically when a scanner without an Enter suffix
// fills it with a known barcode in one fast burst.
function autoSubmitBox(input, submit) {
  let first = 0, timer = null;
  input.addEventListener('input', () => {
    const v = input.value; if (v.length <= 1) first = Date.now();
    clearTimeout(timer);
    timer = setTimeout(() => {
      const val = normCode(input.value), fast = Date.now() - first < 160 + val.length * 60;
      if (val.length >= 8 && fast && /^[0-9A-Za-z-]+$/.test(val)) { input.value = ''; submit(val); }
    }, 180);
  });
}

// Scanner self-test (Settings): shows exactly what the scanner sends.
function scannerTest(input, out) {
  let keys = [], timer = null;
  const report = endedWithEnter => {
    if (!keys.length) return;
    const code = keys.map(k => k.k).join(''), gaps = keys.slice(1).map((k, i) => k.t - keys[i].t);
    const avg = gaps.length ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length) : 0;
    const p = findByBarcode(code), isScanner = avg < 50;
    out.innerHTML = `<div class="flash ${isScanner && endedWithEnter ? 'ok' : 'info'}" style="margin-top:10px">
      <div>${t('Received')}: <b class="mono">${esc(code)}</b> (${code.length} ${t('characters')})</div>
      <div>${isScanner ? '✓ ' + t('Scanner detected') : '⚠ ' + t('Typed slowly — looks like a keyboard, not a scanner')} · ${avg} ms</div>
      <div>${endedWithEnter ? '✓ ' + t('Ends with Enter — perfect') : '⚠ ' + t('No Enter at the end — still works, but set the scanner suffix to Enter (CR) for speed')}</div>
      <div>${p ? '✓ ' + esc(pname(p)) + ' · ' + ppack(p) : t('Not in your database yet — link it in Inventory → Link barcodes')}</div></div>`;
    keys = []; input.value = '';
  };
  input.onkeydown = e => {
    clearTimeout(timer);
    if (e.key === 'Enter' || e.key === 'NumpadEnter' || e.key === 'Tab') { e.preventDefault(); report(true); return; }
    if (e.key.length === 1) { keys.push({ k: e.key, t: Date.now() }); timer = setTimeout(() => report(false), 400); }
  };
}

/* ---------- 2. live camera scanner ---------- */
let CAM = null;
async function openCamera(onCode, opts = {}) {
  closeCamera();
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { toast(t('Camera is not available in this browser. Use Photo instead.'), 'bad'); return; }
  modal(`<h2>${ic('cam', 18)} ${t('Camera scanner')}</h2>
   <div class="camwrap"><video id="camv" playsinline muted></video><div class="camframe"></div></div>
   <div id="camst" class="small mute" style="margin-top:8px">${t('Point the camera at the barcode. Hold steady, 10–20 cm away.')}</div>
   <div id="camlast"></div>
   <div class="row" style="margin-top:12px"><label class="row small" style="font-weight:600"><input type="checkbox" id="camcont" style="width:auto" ${opts.continuous !== false ? 'checked' : ''}> ${t('Keep scanning')}</label><span class="sp"></span><button class="btn" id="camflip">${t('Switch camera')}</button><button class="btn p" id="camx">${t('Done')}</button></div>`);
  $('#camx').onclick = () => { closeCamera(); closeModal(); };
  $('#mbg').onclick = e => { if (e.target.id === 'mbg') { closeCamera(); closeModal(); } };
  CAM = { facing: 'environment', stream: null, timer: null, lastCode: '', lastAt: 0, reader: null, stopped: false };
  const st = m => { const x = $('#camst'); if (x) x.textContent = m; };
  const hit = code => {
    code = normCode(code); if (!code || !CAM) return;
    const now = Date.now(); if (code === CAM.lastCode && now - CAM.lastAt < 2500) return; // ignore the same bottle held in view
    CAM.lastCode = code; CAM.lastAt = now;
    if (navigator.vibrate) navigator.vibrate(60);
    const keep = $('#camcont') && $('#camcont').checked;
    if (!keep) { closeCamera(); closeModal(); }
    else { const l = $('#camlast'); if (l) l.innerHTML = `<div class="flash info">${t('Scanned')}: <span class="mono">${esc(code)}</span></div>`; }
    onCode(code);
  };
  async function start() {
    stopStreams();
    try {
      CAM.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: CAM.facing }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
    } catch (e) { st(t('Camera permission was refused. Allow camera access in the browser settings, or use Photo.')); return; }
    const v = $('#camv'); if (!v) return stopStreams();
    v.srcObject = CAM.stream; await v.play().catch(() => { });
    let detector = null;
    if ('BarcodeDetector' in window) {
      try { const f = await BarcodeDetector.getSupportedFormats(); detector = new BarcodeDetector({ formats: f.filter(x => ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf', 'qr_code', 'data_matrix'].includes(x)) }); } catch (e) { detector = null; }
    }
    if (detector) {
      st(t('Point the camera at the barcode. Hold steady, 10–20 cm away.'));
      const loop = async () => {
        if (!CAM || CAM.stopped) return;
        try { if (v.readyState >= 2) { const r = await detector.detect(v); if (r.length) hit(r[0].rawValue); } } catch (e) { }
        if (CAM && !CAM.stopped) CAM.timer = setTimeout(loop, 180);
      };
      loop();
    } else {
      st(t('Loading scanner…'));
      try {
        await loadScript('https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js');
        const hints = new Map(); hints.set(ZXing.DecodeHintType.TRY_HARDER, true);
        CAM.reader = new ZXing.BrowserMultiFormatReader(hints, 200);
        st(t('Point the camera at the barcode. Hold steady, 10–20 cm away.'));
        CAM.reader.decodeFromVideoElementContinuously(v, (res) => { if (res) hit(res.getText()); });
      } catch (e) { st(t('Scanner could not start. Use Photo instead.')); }
    }
  }
  $('#camflip').onclick = () => { CAM.facing = CAM.facing === 'environment' ? 'user' : 'environment'; start(); };
  start();
}
function stopStreams() {
  if (!CAM) return;
  clearTimeout(CAM.timer);
  try { CAM.reader && CAM.reader.reset(); } catch (e) { } CAM.reader = null;
  if (CAM.stream) CAM.stream.getTracks().forEach(tr => tr.stop()); CAM.stream = null;
}
function closeCamera() { if (CAM) { CAM.stopped = true; stopStreams(); CAM = null; } }

/* ---------- 3. link an unknown barcode to a product ---------- */
function linkBarcodeModal(code, done, opts = {}) {
  code = normCode(code);
  modal(`<h2>${ic('scan', 18)} ${t('Link this barcode')}</h2>
   <p class="mute" style="margin-top:0">${t('Barcode')} <b class="mono">${esc(code)}</b> ${t('is not in your database yet. Pick the product this bottle is — every future scan of this barcode will bill it.')}</p>
   <input id="lbq" placeholder="${t('Search brand, e.g. Royal Stag quarter')}" autocomplete="off"><div id="lbres" style="max-height:300px;overflow:auto"></div>
   <div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn" id="lbx">${t('Cancel')}</button></div>`);
  $('#lbx').onclick = closeModal;
  const q = $('#lbq'); setTimeout(() => q.focus(), 30);
  q.oninput = () => {
    const w = q.value.toLowerCase().trim().split(/\s+/).filter(Boolean); if (!w.length) { $('#lbres').innerHTML = ''; return; }
    const r = visibleProducts().filter(p => w.every(x => (pname(p) + ' ' + p.pack + ' ' + p.sizeMl + ' ' + p.category).toLowerCase().includes(x))).slice(0, 10);
    $('#lbres').innerHTML = r.map(p => `<button class="urow" style="margin-top:6px" data-lp="${p.id}">${pimg(p, 34)}<div class="sp"><div class="b small">${esc(pname(p))}</div><div class="small mute">${ppack(p)} · MRP ${inr(p.mrp)}</div></div></button>`).join('') || `<div class="small mute" style="padding:8px">${t('No match')}</div>`;
    $$('[data-lp]').forEach(b => b.onclick = () => step2(prodById(b.dataset.lp)));
  };
  function step2(p) {
    let kind = opts.carton ? 'carton' : 'bottle';
    const draw = () => {
      modal(`<h2>${ic('scan', 18)} ${t('Link this barcode')}</h2>
      <div class="row" style="margin-bottom:12px">${pimg(p, 44)}<div><div class="b">${esc(pname(p))}</div><div class="small mute">${ppack(p)} · <span class="mono">${esc(code)}</span></div></div></div>
      <label class="f">${t('This barcode is on')}</label>
      <div class="seg" style="width:100%"><button style="flex:1" data-k="bottle" class="${kind === 'bottle' ? 'on' : ''}">${t('One bottle')}</button><button style="flex:1" data-k="carton" class="${kind === 'carton' ? 'on' : ''}">${t('A carton / case')}</button></div>
      ${kind === 'carton' ? `<div class="row" style="margin-top:10px"><label class="f" style="margin:0">${t('Bottles in one carton')}</label><input id="lbu" type="number" min="2" max="500" value="${caseSize(p)}" style="width:100px"></div><p class="small mute">${t('Each scan of this carton adds that many bottles.')}</p>` : ''}
      <div class="row" style="justify-content:flex-end;margin-top:14px"><button class="btn" id="lbx2">${t('Cancel')}</button><button class="btn p" id="lbok">${t('Link barcode')}</button></div>`);
      $$('[data-k]').forEach(b => b.onclick = () => { kind = b.dataset.k; draw(); });
      $('#lbx2').onclick = closeModal;
      $('#lbok').onclick = async () => {
        const units = kind === 'carton' ? Math.max(2, Math.min(500, Math.round(+$('#lbu').value || 0))) : 1;
        let ap = null;
        if (role() === 'salesman') { ap = await askPin(`${t('Link barcode')} ${code} → ${pname(p)} ${p.pack}`, S.me.shopId); if (!ap) return; }
        const ok = await run(async () => { await API.linkBarcode(p.id, code, ap ? ap.user.id : null, ap ? ap.pin : null, units); return true; });
        if (ok) { closeModal(); toast(`${t('Linked')}: ${code} → ${pname(p)} ${p.pack}${units > 1 ? ' × ' + units : ''}`, 'ok'); done && done(p, units); }
      };
    };
    draw();
  }
}
