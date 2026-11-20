(function () {
'use strict';
var GUT = 74, DAY = 86400000;
var S = { tab: 'tl', tier: 1, emp: true, ev: true, hid: {}, cf: '', sel: null, P: 1, pc: null, pp: 'ppl', pq: '', cq: '', docs: new Map(), edit: null, add: null, rv: null, rvset: { scope: 'read', types: { evt: true, ppl: true, plc: true }, detail: false }, lkOpen: false, lkq: '' };
var linkSet = new Set();
var $ = function (s, r) { return (r || document).querySelector(s); };
var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
var fy = function (y) { return y < 0 ? (-y) + ' BCE' : (y < 1000 ? y + ' CE' : String(y)); };
var era = function (y) { return y < 500 ? 'Ancient' : y < 1500 ? 'Medieval' : y < 1900 ? 'Early modern' : 'Modern'; };
var TYPE = { evt: 'Event', emp: 'Span', ppl: 'Person', plc: 'Place', todo: 'To read' };
var RD = ['To read', 'Reading', 'Read'], RDI = ['○', '◐', '●'];
function toast(m) { document.querySelectorAll('.toast').forEach(function (x) { x.remove(); }); var t = document.createElement('div'); t.className = 'toast'; t.textContent = m; document.body.appendChild(t); setTimeout(function () { t.remove(); }, 1800); }
function setStatus(m) { $('#st').textContent = m; }

/* ---------- persistence: this device always, your account when available ---------- */
var LS = 'atlas.v1', col = null, synced = false, queues = new Map();
function loadLocal() { try { var o = JSON.parse(localStorage.getItem(LS) || '{}'); Object.keys(o).forEach(function (k) { S.docs.set(k, o[k]); }); } catch (e) {} }
function saveLocal() { try { var o = {}; S.docs.forEach(function (v, k) { o[k] = v; }); localStorage.setItem(LS, JSON.stringify(o)); } catch (e) {} }
function queueRemote(id, data) {
  if (!col) return;
  var prev = queues.get(id) || Promise.resolve();
  queues.set(id, prev.then(function () { return data ? col.doc(id).set(data) : col.doc(id).delete(); }).catch(function () { setStatus('Could not sync. Saved on this device.'); }));
}
function put(id, d) { S.docs.set(id, d); saveLocal(); queueRemote(id, d); }
function drop(id) { S.docs.delete(id); saveLocal(); queueRemote(id, null); }
function upd(id, fn) {
  var d = Object.assign({ n: '', l: [], r: 0 }, S.docs.get(id) || {});
  fn(d);
  var empty = !d.n && !(d.l && d.l.length) && !d.r && !d.c && !(d.s && Object.keys(d.s).length);
  if (empty) drop(id); else put(id, d);
}
function initSync() {
  if (!window.claude || !window.claude.use) { setStatus('Saved on this device only'); return; }
  Promise.all([window.claude.use('db'), window.claude.use('user')]).then(function (r) {
    var db = r[0], user = r[1];
    if (!db || !user) { setStatus('Saved on this device only'); return; }
    return user.id().then(function (uid) {
      if (!uid) { setStatus('Saved on this device only'); return; }
      col = db.doc('data/users/' + uid + '/main').collection('items');
      setStatus('Syncing…');
      var t = setTimeout(function () { setStatus('Offline: showing the copy on this device'); }, 10000);
      col.onSnapshot(function (snap) {
        if (snap.metadata.fromCache && !synced) return;
        clearTimeout(t);
        var remote = new Map(); snap.docs.forEach(function (d) { remote.set(d.id, d.data()); });
        if (!synced) { synced = true; S.docs.forEach(function (v, k) { if (!remote.has(k)) { remote.set(k, v); queueRemote(k, v); } }); }
        S.docs = remote; saveLocal(); setStatus('Synced to your account'); refresh();
      }, function () { clearTimeout(t); col = null; setStatus('Saved on this device only'); });
    });
  }).catch(function () { setStatus('Saved on this device only'); });
}

/* ---------- items and links ---------- */
function customItems() {
  var out = [];
  S.docs.forEach(function (d, id) { if (d && d.c) { var c = d.c; out.push({ id: id, type: c.type, region: c.region, country: c.country || '', countries: c.countries || (c.country ? [c.country] : []), start: c.start, end: c.end == null ? null : c.end, title: c.title, why: c.why || '', tier: c.tier || 1, who: c.who || '', custom: true }); } });
  return out;
}
function allItems() { return SEED.concat(customItems()); }
function getItem(id) { return SEEDMAP[id] || customItems().find(function (i) { return i.id === id; }); }
function doc(id) { return S.docs.get(id) || {}; }
function linksOf(id) {
  var s = new Set(SLINK[id] || []); var d = doc(id); (d.l || []).forEach(function (x) { s.add(x); });
  S.docs.forEach(function (dd, k) { if (dd && dd.l && dd.l.indexOf(id) > -1) s.add(k); });
  return Array.from(s).filter(function (x) { return x !== id && getItem(x); });
}
function yearLine(it) {
  if (it.type === 'evt') return fy(it.start) + ' · ' + era(it.start);
  if (it.type === 'emp') return fy(it.start) + ' – ' + (it.end >= 2026 ? 'present' : fy(it.end));
  if (it.type === 'ppl') return it.end == null ? 'b. ' + fy(it.start) : fy(it.start) + ' – ' + fy(it.end);
  if (it.type === 'todo') return whereOf(it);
  return it.country;
}
function regName(id) { return (REG.find(function (r) { return r.id === id; }) || {}).name || ''; }
function whereOf(it) { var cs = it.countries || []; return cs.length ? cs.join(', ') : regName(it.region); }
function hasCountry(it, c) { return it.country === c || (it.countries || []).indexOf(c) > -1; }
function readCls(it) { return doc(it.id).r === 2 ? ' read-2' : ''; }
function countryOptions(sel, blank) {
  var h = blank ? '<option value="">' + esc(blank) + '</option>' : '';
  REG.forEach(function (r) { h += '<optgroup label="' + esc(r.name) + '">' + CO[r.id].map(function (c) { return '<option' + (c === sel ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') + '</optgroup>'; });
  return h;
}

/* ---------- timeline ---------- */
function visible(it) {
  if (it.type === 'emp') return S.emp || it.id === S.sel;
  if (it.type !== 'evt') return false;
  if (!S.ev && it.id !== S.sel) return false;
  if (it.id === S.sel) return true;
  if (S.tier === 1 && it.tier !== 1) return false;
  if (S.cf && it.country !== S.cf) return false;
  return true;
}
function cls(it) { return readCls(it) + (it.id === S.sel ? ' sel' : '') + (S.sel && linkSet.has(it.id) ? ' lnk' : ''); }
function evHtml(e, x, y, label, wpx) {
  return '<button class="ev' + (label ? '' : ' dot') + cls(e) + '" data-id="' + e.id + '" style="left:' + x + 'px;top:' + y + 'px" title="' + esc(fy(e.start) + ' ' + e.title) + '"><i></i><b>' + esc(e.title) + '</b></button>';
}
/* One lane per region: an optional strip of event dots on top, then the region's spans packed into rows.
   A span too short for its name gets the name printed just after the bar, and the row keeps room for it. */
function packLane(list, xOf) {
  var bars = list.filter(function (i) { return i.type === 'emp'; }).sort(function (a, b) { return a.start - b.start || b.end - a.end; });
  var rows = [], out = [];
  bars.forEach(function (b) {
    var x0 = xOf(b.start), w = Math.max(xOf(Math.min(b.end, MAX)) - x0, 6), lw = b.title.length * 6.4 + 16, outside = w < lw;
    var r = rows.findIndex(function (e) { return e <= x0; });
    if (r < 0) { r = rows.length; rows.push(0); }
    rows[r] = x0 + w + (outside ? lw + 4 : 2);
    out.push({ b: b, x0: x0, w: w, r: r, outside: outside });
  });
  return { bars: out, nrows: rows.length, evs: list.filter(function (i) { return i.type === 'evt'; }) };
}
function layoutLane(pk, xOf, BH) {
  var html = '', pos = {}, labels = [], top = S.ev ? 26 : 6;
  pk.bars.forEach(function (o) {
    var b = o.b, y = top + o.r * BH;
    html += '<button class="bar' + (o.outside ? ' out' : '') + cls(b) + '" data-id="' + b.id + '" style="left:' + o.x0 + 'px;width:' + o.w + 'px;top:' + y + 'px" title="' + esc(b.title + ' (' + yearLine(b) + ')') + '"><span>' + esc(b.title) + '</span></button>';
    pos[b.id] = { x: o.x0 + Math.min(o.w / 2, 14), y: y + (BH - 4) / 2 };
  });
  if (S.ev) {
    var evs = pk.evs.slice().sort(function (a, b) { return (a.tier - b.tier) || (a.start - b.start); });
    var showLabels = S.P >= 3.5, dots = evs.map(function (e) { return { e: e, x: xOf(e.start), cy: 13, lab: false }; });
    dots.forEach(function (d) {
      var e = d.e, w = e.title.length * 6 + 14;
      if ((showLabels && e.tier === 1) || e.id === S.sel) {
        var clash = dots.some(function (o) { return o !== d && o.cy === d.cy && o.x > d.x - 8 && o.x < d.x + 10 + w; }) ||
          labels.some(function (l) { return l.y === d.cy && d.x - 8 < l.x1 && d.x + 10 + w > l.x0; });
        if (!clash || e.id === S.sel) { d.lab = true; labels.push({ y: d.cy, x0: d.x - 8, x1: d.x + 10 + w }); }
      }
    });
    dots.forEach(function (d) { html += evHtml(d.e, d.x - 6, d.cy - 9, d.lab); pos[d.e.id] = { x: d.x, y: d.cy }; });
  }
  return { html: html, pos: pos, h: Math.max(top + pk.nrows * BH + 4, 40) };
}
function stepFor(P) { return [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000].find(function (s) { return s * P >= 70; }) || 2000; }
function renderAxis() {
  var sc = $('#sc'), P = S.P, Wd = sc.clientWidth, step = stepFor(P), h = '';
  var y0 = (sc.scrollLeft - GUT - Wd) / P + MIN, y1 = (sc.scrollLeft + 2 * Wd - GUT) / P + MIN;
  for (var y = Math.ceil(Math.max(MIN, y0) / step) * step; y <= Math.min(MAX, y1); y += step) h += '<span style="left:' + (GUT + (y - MIN) * P) + 'px">' + fy(y) + '</span>';
  $('#axis').innerHTML = h;
}
function linkPaths(pos) {
  if (!S.sel || !pos[S.sel]) return '';
  var a = pos[S.sel], s = '';
  linksOf(S.sel).forEach(function (id) { var b = pos[id]; if (!b) return; var mx = (a.x + b.x) / 2; s += '<path d="M' + a.x + ',' + a.y + ' C' + mx + ',' + (a.y - 34) + ' ' + mx + ',' + (b.y - 34) + ' ' + b.x + ',' + b.y + '"/>'; });
  return s;
}
function shownRegions() { return REG.filter(function (r) { return !S.hid[r.id]; }); }
/* Lanes are laid out for the years on screen plus one screen either side, so rows aren't spent on empires far away.
   Scrolling past that margin lays them out again. */
var WIN = [MIN, MAX];
function sizeCanvas() { $('#canvas').style.width = (GUT + (MAX - MIN) * S.P + 30) + 'px'; }
function viewYears() { var sc = $('#sc'), Wd = sc.clientWidth; return [(sc.scrollLeft - GUT) / S.P + MIN, (sc.scrollLeft + Wd - GUT) / S.P + MIN]; }
function renderTL() {
  var P = S.P, xOf = function (y) { return GUT + (y - MIN) * P; }, sc = $('#sc');
  sizeCanvas();
  var v = viewYears(), wd = v[1] - v[0]; WIN = [v[0] - wd, v[1] + wd];
  linkSet = new Set(S.sel ? linksOf(S.sel) : []);
  var inWin = function (i) { return i.id === S.sel || linkSet.has(i.id) || (i.type === 'emp' ? i.end >= WIN[0] && i.start <= WIN[1] : i.start >= WIN[0] && i.start <= WIN[1]); };
  var items = allItems().filter(function (i) { return visible(i) && inWin(i); }), top = 0, html = '', pos = {}, regs = shownRegions();
  var packs = regs.map(function (r) { return packLane(items.filter(function (i) { return i.region === r.id; }), xOf); });
  /* Row height fits the screen: one region gets tall, readable bars; the whole world gets slimmer ones. */
  var rowsTotal = packs.reduce(function (n, pk) { return n + pk.nrows; }, 0) || 1;
  var fixed = regs.length * ((S.ev ? 26 : 6) + 5), avail = (sc.clientHeight || 500) - 26 - 84 - fixed;
  var BH = Math.round(Math.min(46, Math.max(19, avail / rowsTotal)));
  var lanes = $('#lanes');
  lanes.style.setProperty('--bh', (BH - 4) + 'px');
  lanes.style.setProperty('--bf', (BH < 22 ? 10 : BH < 30 ? 11.5 : BH < 38 ? 13 : 14.5) + 'px');
  regs.forEach(function (r, k) {
    var L = layoutLane(packs[k], xOf, BH);
    html += '<div class="lane" style="height:' + L.h + 'px;--rc:var(--r-' + r.id + ')"><div class="lname">' + esc(r.short) + '</div>' + L.html + '</div>';
    Object.keys(L.pos).forEach(function (id) { pos[id] = { x: L.pos[id].x, y: top + L.pos[id].y }; });
    top += L.h + 1;
  });
  if (!regs.length) html = '<p class="hint" style="padding:16px">No regions selected. Tap World to show them all.</p>';
  var W = GUT + (MAX - MIN) * P + 30, step = stepFor(P), t0 = Math.ceil(MIN / step) * step;
  $('#canvas').style.width = W + 'px';
  lanes.style.backgroundImage = 'linear-gradient(90deg,var(--grid) 1px,transparent 1px)';
  lanes.style.backgroundSize = (step * P) + 'px 100%';
  lanes.style.backgroundPosition = (GUT + (t0 - MIN) * P) + 'px 0';
  lanes.innerHTML = html + '<div class="today" style="left:' + xOf(2026) + 'px"></div><svg id="lk" width="' + W + '" height="' + top + '">' + linkPaths(pos) + '</svg>';
  renderAxis();
}
function clampP(p) { var mn = ($('#sc').clientWidth - GUT) / (MAX - MIN); return Math.min(80, Math.max(mn, p)); }
function setRange(a, b) { var sc = $('#sc'); S.P = clampP((sc.clientWidth - GUT) / (b - a)); sizeCanvas(); sc.scrollLeft = (a - MIN) * S.P; renderTL(); }
function zoom(f) {
  var sc = $('#sc'), Wd = sc.clientWidth, half = (Wd - GUT) / 2;
  var c = (sc.scrollLeft + half) / S.P + MIN;
  S.P = clampP(S.P * f); sizeCanvas(); sc.scrollLeft = (c - MIN) * S.P - half; renderTL();
}
/* Two-finger pinch on the timeline zooms time around the point between your fingers.
   While fingers move the drawing is only stretched (re-drawing would drop the touch); it is laid out properly when they lift. */
function initPinch() {
  var sc = $('#sc'), cv = $('#canvas'), g = null, raf = 0;
  function span(ts) { return Math.max(Math.abs(ts[0].clientX - ts[1].clientX), 30); }
  function mid(ts) { return (ts[0].clientX + ts[1].clientX) / 2 - sc.getBoundingClientRect().left; }
  function finish() {
    if (!g) return; var G = g; g = null; cancelAnimationFrame(raf); raf = 0;
    cv.style.transform = ''; cv.style.transformOrigin = '';
    if (G.f === 1) return;
    S.P = clampP(G.P * G.f); sizeCanvas();
    sc.scrollLeft = GUT + (G.y - MIN) * S.P - G.m; renderTL();
  }
  sc.addEventListener('touchstart', function (e) {
    if (e.touches.length !== 2) return;
    var m = mid(e.touches); hidePop();
    g = { d: span(e.touches), P: S.P, y: (m + sc.scrollLeft - GUT) / S.P + MIN, ox: sc.scrollLeft + m, m0: m, m: m, f: 1 };
  }, { passive: true });
  sc.addEventListener('touchmove', function (e) {
    if (!g || e.touches.length !== 2) return;
    e.preventDefault();
    g.f = clampP(g.P * span(e.touches) / g.d) / g.P; g.m = mid(e.touches);
    if (!raf) raf = requestAnimationFrame(function () {
      raf = 0; if (!g) return;
      cv.style.transformOrigin = g.ox + 'px 0';
      cv.style.transform = 'translateX(' + (g.m - g.m0) + 'px) scaleX(' + g.f + ')';
    });
  }, { passive: false });
  sc.addEventListener('touchend', function (e) { if (e.touches.length < 2) finish(); });
  sc.addEventListener('touchcancel', finish);
  document.addEventListener('gesturestart', function (e) { if (e.target.closest && e.target.closest('#sc')) e.preventDefault(); });
}
function gotoYear(y) { var sc = $('#sc'); sc.scrollLeft = Math.max(0, (y - MIN) * S.P - (sc.clientWidth - GUT) / 2); renderTL(); }
function renderTB() {
  var pre = [['all', 'All'], ['ancient', 'Ancient'], ['med', 'Medieval'], ['early', '1500–1900'], ['mod', 'Modern']];
  var all = !REG.some(function (r) { return S.hid[r.id]; });
  $('#tb').innerHTML = pre.map(function (p) { return '<button class="chip" data-pre="' + p[0] + '">' + p[1] + '</button>'; }).join('') +
    '<button class="chip" data-act="ev" aria-pressed="' + S.ev + '">Events</button>' +
    (S.ev ? '<button class="chip" data-act="tier" aria-pressed="' + (S.tier === 1) + '">Key events only</button>' : '') +
    '<button class="chip" data-act="emp" aria-pressed="' + S.emp + '">Empires and eras</button>' +
    '<select id="cf" aria-label="Filter by country">' + countryOptions(S.cf, 'All countries') + '</select>';
  $('#tb2').innerHTML = '<button class="chip" data-reg="all" aria-pressed="' + all + '">World</button>' +
    REG.map(function (r) { return '<button class="chip rg" data-reg="' + r.id + '" style="--rc:var(--r-' + r.id + ')" aria-pressed="' + (!all && !S.hid[r.id]) + '">' + esc(r.short) + '</button>'; }).join('');
}
/* Tapping a region while the whole world is shown focuses on it; after that, taps add or remove regions. */
function tapRegion(id) {
  var all = !REG.some(function (r) { return S.hid[r.id]; });
  if (id === 'all') S.hid = {};
  else if (all) { S.hid = {}; REG.forEach(function (r) { if (r.id !== id) S.hid[r.id] = true; }); }
  else { S.hid[id] = !S.hid[id]; if (!S.hid[id]) delete S.hid[id]; if (REG.every(function (r) { return S.hid[r.id]; })) S.hid = {}; }
  saveUI(); renderTB(); renderTL();
}
var UIK = 'atlas.ui';
function saveUI() { try { localStorage.setItem(UIK, JSON.stringify({ hid: S.hid, ev: S.ev, emp: S.emp, tier: S.tier })); } catch (e) {} }
function loadUI() { try { var o = JSON.parse(localStorage.getItem(UIK) || '{}'); if (o.hid) S.hid = o.hid; if (typeof o.ev === 'boolean') S.ev = o.ev; if (typeof o.emp === 'boolean') S.emp = o.emp; if (o.tier) S.tier = o.tier; } catch (e) {} }
function showForItem(it) { if (!it) return; var ch = false; if (it.region && S.hid[it.region]) { delete S.hid[it.region]; ch = true; } if (it.type === 'evt' && !S.ev) { S.ev = true; ch = true; } if (it.type === 'emp' && !S.emp) { S.emp = true; ch = true; } if (ch) { saveUI(); renderTB(); } }
var PRE = { all: [MIN, MAX], ancient: [-3500, 500], med: [500, 1500], early: [1500, 1900], mod: [1900, 2030] };

/* ---------- detail sheet ---------- */
function openSheet(id) { S.sel = id; S.lkOpen = false; S.lkq = ''; renderSheet(); if (S.tab === 'tl') renderTL(); }
function closeSheet() { S.sel = null; $('#sheet').classList.remove('on'); if (S.tab === 'tl') renderTL(); }
function fillRes() {
  var box = $('#lres'); if (!box || !S.sel) return;
  var q = S.lkq.trim().toLowerCase(), linked = new Set(linksOf(S.sel)); if (!q) { box.innerHTML = ''; return; }
  var m = allItems().filter(function (i) { return i.id !== S.sel && !linked.has(i.id) && (i.title + ' ' + i.country).toLowerCase().indexOf(q) > -1; }).slice(0, 8);
  box.innerHTML = m.length ? m.map(function (i) { return '<button data-lk="' + i.id + '">' + esc(i.title) + ' <span class="muted">· ' + TYPE[i.type] + (i.type === 'evt' ? ', ' + fy(i.start) : '') + (i.country ? ', ' + esc(i.country) : '') + '</span></button>'; }).join('') : '<span class="muted" style="font-size:13px;padding:6px 2px">No match. Add it from the Add tab first.</span>';
}
function renderSheet() {
  var it = getItem(S.sel), sh = $('#sheet');
  if (!it) { sh.classList.remove('on'); return; }
  var d = doc(it.id), links = linksOf(it.id), mine = new Set(d.l || []);
  var rc = 'var(--r-' + (it.region || 'eu') + ')';
  var chips = links.map(function (id) {
    var o = getItem(id), user = mine.has(id) || (doc(id).l || []).indexOf(it.id) > -1;
    return '<span class="lk-chip"><button class="x" style="font-size:13px;font-weight:600;color:var(--ink);text-align:left" data-open="' + id + '">' + esc(o.title) + ' <small>' + TYPE[o.type] + (o.type === 'evt' ? ' ' + fy(o.start) : '') + '</small></button>' + (user ? '<button class="x" aria-label="Remove link" data-un="' + id + '">×</button>' : '') + '</span>';
  }).join('') || '<span class="muted" style="font-size:13px">No links yet.</span>';
  var flag = it.type === 'todo' ? esc(whereOf(it) || 'Anywhere') : it.country ? flagOf(it.country) + ' ' + esc(it.country) : esc(regName(it.region));
  sh.innerHTML =
    '<div class="sh-h"><span class="tag" style="--rc:' + rc + '">' + TYPE[it.type] + ' · ' + flag + '</span><button class="btn sm" data-act="close">Close</button></div>' +
    '<h2>' + esc(it.title) + '</h2><div class="yr">' + esc(yearLine(it)) + '</div>' +
    (it.why ? '<p class="why">' + esc(it.why) + '</p>' : '') +
    (it.who ? '<p class="who"><b>Involved:</b> ' + esc(it.who) + '</p>' : '') +
    '<div class="row" style="margin:8px 0"><button class="btn sm" data-rd="' + it.id + '">' + RDI[d.r || 0] + ' ' + RD[d.r || 0] + '</button>' +
    (it.type === 'evt' || it.type === 'emp' ? '<button class="btn sm" data-act="ontl">Show on timeline</button>' : '') +
    (it.type === 'todo' ? (it.countries || []).map(function (c) { return '<button class="btn sm" data-country="' + esc(c) + '">' + flagOf(c) + ' ' + esc(c) + '</button>'; }).join('') : it.country ? '<button class="btn sm" data-country="' + esc(it.country) + '">Country page</button>' : '') + '</div>' +
    (it.type === 'todo' ? '<p class="muted" style="font-size:12.5px;margin:4px 0 0">Once you know when it happened, tap Edit and change the type to Event or Span to put it on the timeline. Your notes and links come with it.</p>' : '') +
    '<label for="nt">Your notes</label><textarea id="nt" placeholder="What you read, what stuck, what to look up next">' + esc(d.n || '') + '</textarea>' +
    '<h3>Linked</h3><div class="lk-chips">' + chips + '</div>' +
    '<div style="margin-top:10px">' + (S.lkOpen ? '<input id="lq" type="search" placeholder="Search events, people, places" value="' + esc(S.lkq) + '" aria-label="Search to link"><div id="lres" class="res"></div>' : '<button class="btn sm" data-act="linkopen">+ Link an event, person or place</button>') + '</div>' +
    (it.custom ? '<div class="row" style="margin-top:16px"><button class="btn sm" data-act="edit">Edit</button><button class="btn sm del" data-act="del">Delete</button></div>' : '');
  sh.classList.add('on');
  if (S.lkOpen) fillRes();
}

/* ---------- countries ---------- */
function progress(c) {
  var t = allItems().filter(function (i) { return i.type === 'evt' && i.country === c && i.tier === 1; });
  return { n: t.length, done: t.filter(function (i) { return doc(i.id).r === 2; }).length };
}
function renderCO() {
  var v = $('#v-co');
  if (S.pc) return renderCountry(v);
  var q = S.cq.trim().toLowerCase();
  var h = '<div class="pad"><h2>Countries</h2><p class="muted" style="margin:0 0 8px;font-size:13px">Pick a country for its profile, reading list and notes.</p><input id="cq" type="search" placeholder="Search countries" value="' + esc(S.cq) + '" aria-label="Search countries">';
  REG.forEach(function (r) {
    var cs = CO[r.id].filter(function (c) { return !q || c.toLowerCase().indexOf(q) > -1; });
    if (!cs.length) return;
    h += '<div class="rgn" style="--rc:var(--r-' + r.id + ')">' + esc(r.name) + '</div><div class="cgrid">' + cs.map(function (c) {
      var p = progress(c);
      return '<button class="cc" data-country="' + esc(c) + '"><span class="fl">' + flagOf(c) + '</span><span><b>' + esc(c) + '</b><small>' + (p.n ? p.done + ' of ' + p.n + ' read' : 'no starter events') + '</small></span></button>';
    }).join('') + '</div>';
  });
  v.innerHTML = h + '</div>';
}
function eraGroups(evs) {
  var g = [['Ancient', []], ['Medieval', []], ['Early modern', []], ['Modern', []]];
  evs.forEach(function (e) { g[{ Ancient: 0, Medieval: 1, 'Early modern': 2, Modern: 3 }[era(e.start)]][1].push(e); });
  return g.filter(function (x) { return x[1].length; });
}
function rowHtml(it, withRead) {
  var d = doc(it.id), y = it.type === 'evt' ? fy(it.start) : '';
  return '<div class="li" role="button" tabindex="0" data-open="' + it.id + '">' +
    (withRead ? '<button class="rs" data-rd="' + it.id + '" aria-label="Reading status: ' + RD[d.r || 0] + '">' + RDI[d.r || 0] + '</button>' : '') +
    (y ? '<span class="y">' + esc(y) + '</span>' : '') +
    '<span><span class="t"' + (it.tier === 2 ? ' style="font-weight:500"' : '') + '>' + esc(it.title) + '</span><br><span class="s">' + esc(it.type === 'evt' ? it.why : yearLine(it) + (it.why ? ' · ' + it.why : '')) + (d.n ? ' · has notes' : '') + '</span></span></div>';
}
function renderCountry(v) {
  var c = S.pc, p = PROF[c] || {}, r = REGOF[c], reg = REG.find(function (x) { return x.id === r; }) || REG[0];
  var items = allItems(), evs = items.filter(function (i) { return i.type === 'evt' && i.country === c; }).sort(function (a, b) { return a.start - b.start; });
  var pr = progress(c), evIds = new Set(evs.map(function (e) { return e.id; }));
  var rel = function (i) { return i.country === c || linksOf(i.id).some(function (x) { return evIds.has(x); }); };
  var ppl = items.filter(function (i) { return i.type === 'ppl' && rel(i); }).sort(function (a, b) { return a.start - b.start; });
  var plc = items.filter(function (i) { return i.type === 'plc' && rel(i); });
  var tds = items.filter(function (i) { return i.type === 'todo' && hasCountry(i, c); });
  var cn = doc('cn-' + slug(c)).n || '';
  v.innerHTML = '<div class="pad"><button class="btn sm" data-act="coback">← All countries</button>' +
    '<div class="row" style="margin-top:12px;gap:14px;align-items:center"><span class="bigflag">' + flagOf(c) + '</span><div><h2 style="margin:0">' + esc(c) + '</h2><span class="tag" style="--rc:var(--r-' + reg.id + ')">' + esc(reg.name) + '</span></div></div>' +
    (p.cap ? '<dl class="prof"><dt>Capital</dt><dd>' + esc(p.cap) + '</dd><dt>Languages</dt><dd>' + esc(p.lang) + '</dd><dt>Religions</dt><dd>' + esc(p.rel) + '</dd></dl><div class="muted" style="font-size:11.5px">Figures are approximate; check a current source before relying on them.</div>' : '') +
    (p.lat != null && p.iso3 ? '<div class="map" id="map" style="margin-top:12px"></div><a class="muted" style="font-size:12px" target="_blank" rel="noopener" href="https://www.openstreetmap.org/?mlat=' + p.lat + '&mlon=' + p.lon + '#map=5/' + p.lat + '/' + p.lon + '">Open a detailed map of the capital area</a>' : '') +
    '<h3>Reading list</h3>' + (pr.n ? '<div><b>' + pr.done + ' of ' + pr.n + '</b> key events read</div><div class="bar-prog"><i style="width:' + Math.round(pr.done / pr.n * 100) + '%"></i></div>' : '<p class="muted">No starter events for this country yet. Add the ones you read about.</p>') +
    '<div class="row" style="margin:8px 0"><button class="btn sm pri" data-act="addhere">Add event here</button><button class="btn sm" data-act="todohere">+ To read</button><button class="btn sm" data-act="rvhere">Revise this country</button><button class="btn sm" data-act="cftl">Show on timeline</button></div>' +
    (tds.length ? '<h3>To read about</h3><div class="list">' + tds.map(function (e) { return rowHtml(e, true); }).join('') + '</div>' : '') +
    '<label for="cnote">Notes on ' + esc(c) + '</label><textarea id="cnote" placeholder="Overview, themes, what to read next">' + esc(cn) + '</textarea>' +
    eraGroups(evs).map(function (g) { return '<h3>' + g[0] + '</h3><div class="list">' + g[1].map(function (e) { return rowHtml(e, true); }).join('') + '</div>'; }).join('') +
    (ppl.length ? '<h3>People</h3><div class="list">' + ppl.map(function (e) { return rowHtml(e, true); }).join('') + '</div>' : '') +
    (plc.length ? '<h3>Places</h3><div class="list">' + plc.map(function (e) { return rowHtml(e, true); }).join('') + '</div>' : '') + '</div>';
  mountMap(c);
}
var ZF = { Russia: 2.2, China: 3.2, 'United States': 3, Canada: 2.6, Brazil: 3.2, Australia: 3.4, India: 4.5, Argentina: 3.4, Kazakhstan: 4, 'DR Congo': 4.5, Algeria: 4.5, 'Saudi Arabia': 4.8, Mexico: 4.5, Indonesia: 3.6, Iran: 5.5 };
function fallbackSvg(lat, lon) {
  var g = '';
  for (var x = 0; x <= 360; x += 30) g += '<line x1="' + x + '" y1="0" x2="' + x + '" y2="180" stroke="var(--line)" stroke-width=".6"/>';
  for (var y = 0; y <= 180; y += 30) g += '<line x1="0" y1="' + y + '" x2="360" y2="' + y + '" stroke="var(--line)" stroke-width=".6"/>';
  var cx = lon + 180, cy = 90 - lat;
  return '<svg viewBox="0 0 360 180" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Capital at ' + lat + ', ' + lon + '">' + g + '<circle cx="' + cx + '" cy="' + cy + '" r="5" fill="var(--accent)"/><circle cx="' + cx + '" cy="' + cy + '" r="10" fill="none" stroke="var(--accent)" stroke-width="1.5"/><text x="6" y="172" font-size="9" fill="var(--muted)">' + lat + '°, ' + lon + '° (world map loads when online)</text></svg>';
}
var mapP = null;
function loadMapLibs() {
  if (mapP) return mapP;
  var urls = ['https://cdnjs.cloudflare.com/ajax/libs/d3/3.5.17/d3.min.js', 'https://cdnjs.cloudflare.com/ajax/libs/topojson/1.6.9/topojson.min.js', 'https://cdnjs.cloudflare.com/ajax/libs/datamaps/0.5.9/datamaps.world.min.js'];
  mapP = urls.reduce(function (p, u) { return p.then(function () { return new Promise(function (res, rej) { var s = document.createElement('script'); s.src = u; s.onload = res; s.onerror = function () { rej(new Error('load')); }; document.head.appendChild(s); }); }); }, Promise.resolve());
  mapP.catch(function () { mapP = null; });
  return mapP;
}
function cssv(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }
function mountMap(c) {
  var el = $('#map'), p = PROF[c]; if (!el || !p) return;
  el.innerHTML = fallbackSvg(p.lat, p.lon);
  loadMapLibs().then(function () {
    if (S.pc !== c || !document.body.contains(el) || !window.Datamap || !window.d3) return;
    var data = {}; data[p.iso3] = { fillKey: 'hl' };
    el.innerHTML = '';
    var z = ZF[c] || 6;
    var dm = new window.Datamap({
      element: el, projection: 'mercator', responsive: false,
      fills: { defaultFill: cssv('--mapland') || '#ccd', hl: cssv('--accent') || '#0a7' }, data: data,
      geographyConfig: { popupOnHover: false, highlightOnHover: false, borderWidth: 0.4, borderColor: cssv('--soft') || '#fff' },
      setProjection: function (element) {
        var w = element.offsetWidth || 340, h = element.offsetHeight || 190;
        var proj = window.d3.geo.mercator().center([p.lon, p.lat]).scale(w / (2 * Math.PI) * z).translate([w / 2, h / 2]);
        return { path: window.d3.geo.path().projection(proj), projection: proj };
      }
    });
    dm.bubbles([{ name: c, latitude: p.lat, longitude: p.lon, radius: 5, fillKey: 'hl' }], { popupOnHover: false, borderWidth: 2, borderColor: '#ffffff' });
  }).catch(function () {});
}

/* ---------- people and places ---------- */
function renderPP() {
  var v = $('#v-pp'), q = S.pq.trim().toLowerCase(), td = S.pp === 'todo';
  var list = allItems().filter(function (i) { return i.type === S.pp && (!q || (i.title + ' ' + whereOf(i) + ' ' + i.country + ' ' + i.why).toLowerCase().indexOf(q) > -1); });
  /* To read: unfinished first, newest first within each group. */
  list.sort(function (a, b) { return S.pp === 'ppl' ? a.start - b.start : td ? ((doc(a.id).r === 2) - (doc(b.id).r === 2)) || (a.id < b.id ? 1 : -1) : a.title.localeCompare(b.title); });
  var seg = '<div class="seg"><button data-pp="ppl" aria-pressed="' + (S.pp === 'ppl') + '">People</button><button data-pp="plc" aria-pressed="' + (S.pp === 'plc') + '">Places</button><button data-pp="todo" aria-pressed="' + td + '">To read</button></div>';
  v.innerHTML = '<div class="pad"><h2>Lists</h2><div class="row" style="margin-bottom:8px">' + seg + (td ? '' : '<button class="btn sm pri" data-act="addpp">Add</button>') + '</div>' +
    (td ? '<p class="muted" style="margin:4px 0 8px;font-size:13px">Topics you want to look into. No date or country needed.</p><div class="row" style="flex-wrap:nowrap;margin-bottom:10px"><input id="tdq" type="text" placeholder="e.g. The Yazidis" aria-label="New topic to read about" autocomplete="off"><button class="btn pri" data-act="tdadd">Add</button></div>' : '') +
    '<input id="pq" type="search" placeholder="Search" value="' + esc(S.pq) + '" aria-label="Search"><div class="list">' + list.map(function (i) {
      if (td) { var d = doc(i.id); return '<div class="li" role="button" tabindex="0" data-open="' + i.id + '"><button class="rs" data-rd="' + i.id + '" aria-label="Status: ' + RD[d.r || 0] + '">' + RDI[d.r || 0] + '</button><span><span class="t"' + (d.r === 2 ? ' style="text-decoration:line-through;color:var(--muted)"' : '') + '>' + esc(i.title) + '</span>' + (whereOf(i) ? ' <span class="s">' + esc(whereOf(i)) + '</span>' : '') + (i.why ? '<br><span class="s">' + esc(i.why) + '</span>' : '') + '</span></div>'; }
      return '<div class="li" role="button" tabindex="0" data-open="' + i.id + '"><span class="fl">' + flagOf(i.country) + '</span><span><span class="t">' + esc(i.title) + '</span> <span class="s">' + esc(i.type === 'ppl' ? yearLine(i) : i.country) + '</span><br><span class="s">' + esc(i.why) + '</span></span></div>';
    }).join('') + (td && !list.length && !q ? '<p class="muted">Nothing yet. Type a topic above and tap Add; you can add notes, countries and links afterwards.</p>' : '') + '</div></div>';
}
function quickTodo() {
  var el = $('#tdq'), t = el && el.value.trim(); if (!t) { if (el) el.focus(); return; }
  var id = 'u-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  upd(id, function (d) { d.c = { type: 'todo', title: t, country: '', countries: [], region: '', why: '', tier: 1, who: '', start: null, end: null }; });
  toast('Added to your list'); renderPP(); openSheet(id);
}

/* ---------- revise ---------- */
var INT = [0, 1, 3, 7, 21, 60];
function cardsFor(it) {
  var out = [], fl = it.country ? flagOf(it.country) + ' ' + it.country : '', d = doc(it.id);
  if (it.type === 'evt') {
    out.push({ id: it.id, k: 'w', q: 'When did this happen?', big: it.title, sub: fl, a: '<b>' + esc(fy(it.start)) + '</b> · ' + era(it.start), a2: it.why + (it.who ? ' Involved: ' + it.who : '') });
    if (it.who) out.push({ id: it.id, k: 'h', q: 'Who or what was involved?', big: it.title, sub: fl + ' · ' + fy(it.start), a: esc(it.who), a2: it.why });
    if (it.tier === 1) out.push({ id: it.id, k: 'y', q: 'What happened in ' + (it.country || (REG.find(function (r) { return r.id === it.region; }) || {}).name) + ' in ' + fy(it.start) + '?', big: '', sub: '', a: '<b>' + esc(it.title) + '</b>', a2: it.why });
  } else if (it.type === 'emp') out.push({ id: it.id, k: 'w', q: 'When was this?', big: it.title, sub: '', a: '<b>' + esc(yearLine(it)) + '</b>', a2: it.why });
  else if (it.type === 'ppl') out.push({ id: it.id, k: 'p', q: 'Who was this person?', big: it.title, sub: fl, a: '<b>' + esc(yearLine(it)) + '</b>', a2: it.why });
  else if (it.type === 'plc') out.push({ id: it.id, k: 'l', q: 'What is this place known for?', big: it.title, sub: fl, a: esc(it.why), a2: '' });
  return out;
}
function dueCards(cards) { var now = Date.now(); return cards.filter(function (c) { var s = (doc(c.id).s || {})[c.k]; return !s || s.due <= now; }); }
function universe() {
  var st = S.rvset, sc = st.scope;
  var items = allItems().filter(function (i) {
    var kind = i.type === 'emp' ? 'evt' : i.type; if (!st.types[kind]) return false;
    if (i.type === 'evt' && i.tier !== 1 && !st.detail) return false;
    if (sc === 'read') return doc(i.id).r >= 1 || doc(i.id).n;
    if (sc.indexOf('c:') === 0) return i.country === sc.slice(2);
    return true;
  });
  var cards = []; items.forEach(function (i) { cards = cards.concat(cardsFor(i)); });
  return cards;
}
function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
function startSession(force) {
  var all = universe(), due = dueCards(all);
  var pool = due.length ? due : (force ? all : []);
  if (!pool.length) { toast('Nothing to revise with these settings'); return; }
  S.rv = { run: true, cards: shuffle(pool.slice()).slice(0, 12), i: 0, show: false, got: 0, missed: [], extra: false };
  renderRV();
}
function renderRV() {
  var v = $('#v-rv'), R = S.rv;
  if (!R) {
    var st = S.rvset, all = universe(), due = dueCards(all);
    v.innerHTML = '<div class="pad"><h2>Revise</h2><p class="muted" style="margin:0 0 6px">Recall first, then check. Cards you miss come back sooner.</p>' +
      '<label for="rv-scope">What to revise</label><select id="rv-scope"><option value="read"' + (st.scope === 'read' ? ' selected' : '') + '>Things I’ve marked as read or noted</option><option value="all"' + (st.scope === 'all' ? ' selected' : '') + '>Everything in the atlas</option>' +
      REG.map(function (r) { return '<optgroup label="' + esc(r.name) + '">' + CO[r.id].map(function (c) { var val = 'c:' + c; return '<option value="' + esc(val) + '"' + (st.scope === val ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') + '</optgroup>'; }).join('') + '</select>' +
      '<div class="row" style="margin-top:12px"><button class="chip" data-rvt="evt" aria-pressed="' + st.types.evt + '">Events and eras</button><button class="chip" data-rvt="ppl" aria-pressed="' + st.types.ppl + '">People</button><button class="chip" data-rvt="plc" aria-pressed="' + st.types.plc + '">Places</button><button class="chip" data-rvt="detail" aria-pressed="' + st.detail + '">Include detail events</button></div>' +
      '<p style="margin:16px 0 8px"><b>' + due.length + '</b> of ' + all.length + ' cards due now</p>' +
      '<div class="row"><button class="btn pri" data-act="rvstart">Start (up to 12 cards)</button>' + (!due.length && all.length ? '<button class="btn" data-act="rvforce">Practise anyway</button>' : '') + '</div>' +
      (!all.length ? '<p class="muted">Nothing here yet. Mark events as read on a country page, add notes, or choose Everything.</p>' : '') + '</div>';
    return;
  }
  if (R.i >= R.cards.length) {
    if (R.missed.length && !R.extra) { R.cards = R.cards.concat(R.missed); R.missed = []; R.extra = true; }
    else {
      v.innerHTML = '<div class="pad"><h2>Done</h2><p>You got <b>' + R.got + '</b> of ' + R.cards.length + ' right.</p><div class="row"><button class="btn pri" data-act="rvagain">Another round</button><button class="btn" data-act="rvexit">Back to setup</button></div></div>';
      return;
    }
  }
  var c = R.cards[R.i], it = getItem(c.id), d = doc(c.id);
  if (!it) { R.i++; return renderRV(); }
  v.innerHTML = '<div class="pad"><div class="row" style="justify-content:space-between"><span class="muted">' + (R.i + 1) + ' of ' + R.cards.length + '</span><button class="btn sm" data-act="rvexit">End</button></div>' +
    '<div class="card"><div class="q">' + esc(c.q) + '</div>' + (c.big ? '<div class="big">' + esc(c.big) + '</div>' : '') + (c.sub ? '<div class="muted">' + esc(c.sub) + '</div>' : '') +
    (R.show ? '<div class="ans">' + c.a + (c.a2 ? '<p style="margin:8px 0 0">' + esc(c.a2) + '</p>' : '') + (d.n ? '<div class="mynote">' + esc(d.n) + '</div>' : '') + '</div>' : '') + '</div>' +
    (R.show ? '<div class="row"><button class="btn" data-act="rvmiss">Missed it</button><button class="btn pri" data-act="rvgot">Got it</button></div>' : '<button class="btn pri" data-act="rvshow">Show answer</button>') + '</div>';
}
function grade(ok) {
  var R = S.rv, c = R.cards[R.i], now = Date.now();
  upd(c.id, function (d) { d.s = d.s || {}; var b = (d.s[c.k] || { b: 0 }).b; b = ok ? Math.min(b + 1, 5) : 0; d.s[c.k] = { b: b, due: now + INT[b] * DAY }; });
  if (ok) R.got++; else if (!R.extra) R.missed.push(c);
  R.i++; R.show = false; renderRV();
}

/* ---------- add and edit ---------- */
function yearField(id, label, v, opt) {
  var neg = v != null && v < 0;
  return '<label for="' + id + '">' + label + '</label><div class="row" style="flex-wrap:nowrap"><input id="' + id + '" type="number" inputmode="numeric" min="1" placeholder="e.g. 1953" value="' + (v == null ? '' : Math.abs(v)) + '"><select id="' + id + '-e" style="width:96px" aria-label="' + label + ' era"><option' + (neg ? '' : ' selected') + '>CE</option><option' + (neg ? ' selected' : '') + '>BCE</option></select></div>';
}
function readYear(id, opt) {
  var n = parseInt($('#' + id).value, 10); if (isNaN(n)) return opt ? null : NaN;
  return $('#' + id + '-e').value === 'BCE' ? -Math.abs(n) : Math.abs(n);
}
function renderAD() {
  var v = $('#v-ad'), a = S.add || { type: 'evt', country: '', region: 'eu', tier: 1 }; S.add = a;
  var t = a.type;
  v.innerHTML = '<div class="pad"><h2>' + (S.edit ? 'Edit entry' : 'Add to the atlas') + '</h2>' +
    '<label for="f-type">What are you adding?</label><select id="f-type"><option value="evt"' + (t === 'evt' ? ' selected' : '') + '>Event (a moment)</option><option value="emp"' + (t === 'emp' ? ' selected' : '') + '>Empire, era or war (a span)</option><option value="ppl"' + (t === 'ppl' ? ' selected' : '') + '>Person</option><option value="plc"' + (t === 'plc' ? ' selected' : '') + '>Place</option><option value="todo"' + (t === 'todo' ? ' selected' : '') + '>Topic to read about (no date needed)</option></select>' +
    '<label for="f-title">' + (t === 'ppl' ? 'Name' : t === 'todo' ? 'Topic' : 'Title') + '</label><input id="f-title" type="text" value="' + esc(a.title || '') + '" autocomplete="off">' +
    (t === 'todo' ? '<label for="f-countries">Countries (optional, choose as many as you like)</label><select id="f-countries" multiple size="6">' + countryOptions(null).replace(/<option>([^<]*)<\/option>/g, function (m, c) { return (a.countries || []).indexOf(c.replace(/&amp;/g, '&')) > -1 ? '<option selected>' + c + '</option>' : m; }) + '</select>' :
    '<label for="f-country">Country (optional)</label><select id="f-country">' + countryOptions(a.country, 'No country (e.g. Assyria, the Silk Road)') + '</select>') +
    '<div id="f-regwrap"' + (a.country && t !== 'todo' ? ' hidden' : '') + '><label for="f-region">' + (t === 'todo' ? 'Region (used when no country is chosen)' : 'Region (which timeline row it goes on)') + '</label><select id="f-region">' + REG.map(function (r) { return '<option value="' + r.id + '"' + (a.region === r.id ? ' selected' : '') + '>' + esc(r.name) + '</option>'; }).join('') + '</select></div>' +
    (t === 'evt' ? yearField('f-y1', 'Year', a.start) : '') + (t === 'emp' ? yearField('f-y1', 'Start year', a.start) + yearField('f-y2', 'End year', a.end) : '') + (t === 'ppl' ? yearField('f-y1', 'Born', a.start) + yearField('f-y2', 'Died (leave blank if unknown or alive)', a.end) : '') +
    '<label for="f-why">' + (t === 'plc' ? 'What it is known for' : t === 'ppl' ? 'Who they were' : t === 'todo' ? 'Notes (where you came across it, what to look into)' : 'Why it matters') + '</label><textarea id="f-why" style="min-height:70px">' + esc(a.why || '') + '</textarea>' +
    (t === 'evt' ? '<label for="f-who">Who or what was involved</label><input id="f-who" type="text" value="' + esc(a.who || '') + '">' + '<label for="f-tier">How important</label><select id="f-tier"><option value="1"' + (a.tier === 1 ? ' selected' : '') + '>Key event</option><option value="2"' + (a.tier === 2 ? ' selected' : '') + '>Detail</option></select>' : '') +
    '<div id="f-err" class="err" role="alert"></div><div class="row" style="margin-top:16px"><button class="btn pri" data-act="save">Save</button>' + (S.edit ? '<button class="btn" data-act="cancel">Cancel</button>' : '') + '</div>' +
    '<p class="muted" style="font-size:12.5px;margin-top:16px">After saving you can add notes and link it to other events, people and places.</p>' +
    '<h3>Backup</h3><p class="muted" style="font-size:12.5px;margin:0 0 8px">Your notes, links and added items live on this device. Export a file now and then, and import it to restore or move to a new phone.</p>' +
    '<div class="row"><button class="btn sm" data-act="export">Export backup</button><button class="btn sm" data-act="import">Import backup</button></div><input id="imp" type="file" accept="application/json,.json" hidden></div>';
}
function exportBackup() {
  var o = {}; S.docs.forEach(function (v, k) { o[k] = v; });
  var blob = new Blob([JSON.stringify({ app: 'timeline-atlas', v: 1, saved: new Date().toISOString(), docs: o }, null, 1)], { type: 'application/json' });
  var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'timeline-atlas-backup-' + new Date().toISOString().slice(0, 10) + '.json';
  document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500); toast('Backup downloaded');
}
function importBackup(file) {
  var rd = new FileReader();
  rd.onload = function () {
    try { var j = JSON.parse(rd.result), d = j.docs || j, n = 0; Object.keys(d).forEach(function (k) { if (d[k] && typeof d[k] === 'object') { put(k, d[k]); n++; } }); toast('Imported ' + n + ' entries'); renderCurrent(); }
    catch (e) { toast('That file is not a valid backup'); }
  };
  rd.readAsText(file);
}
function saveEntry() {
  var t = $('#f-type').value, title = $('#f-title').value.trim(), err = $('#f-err');
  var countries = t === 'todo' ? Array.from($('#f-countries').selectedOptions).map(function (o) { return o.value; }) : [];
  var country = t === 'todo' ? (countries[0] || '') : $('#f-country').value;
  var c = { type: t, title: title, country: country, why: $('#f-why').value.trim(), tier: 1, who: '', start: null, end: null, region: '' };
  if (!title) { err.textContent = 'Add a title.'; return; }
  c.region = country ? REGOF[country] : $('#f-region').value;
  if (t === 'todo') c.countries = countries;
  if (t === 'evt') { c.start = readYear('f-y1'); c.who = $('#f-who').value.trim(); c.tier = parseInt($('#f-tier').value, 10); }
  if (t === 'emp' || t === 'ppl') { c.start = readYear('f-y1'); c.end = readYear('f-y2', true); }
  var dated = t !== 'plc' && t !== 'todo';
  if (dated && (c.start == null || isNaN(c.start))) { err.textContent = 'Enter a valid year.'; return; }
  if (dated && (c.start < MIN || c.start > MAX)) { err.textContent = 'The timeline runs from 3500 BCE to 2030.'; return; }
  if (t === 'emp' && (c.end == null || isNaN(c.end) || c.end < c.start)) { err.textContent = 'Enter an end year after the start.'; return; }
  if (t === 'ppl' && c.end != null && (isNaN(c.end) || c.end < c.start)) { err.textContent = 'The year they died must be after they were born.'; return; }
  var id = S.edit || ('u-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5));
  upd(id, function (d) { d.c = c; });
  S.edit = null; S.add = null; toast('Saved');
  if (t === 'evt' || t === 'emp') { go('tl'); showForItem(c); if (S.P < 3 && t === 'evt') setRange(c.start - 70, c.start + 70); openSheet(id); gotoYear(c.start); }
  else { S.pp = t; go('pp'); openSheet(id); }
}

/* ---------- navigation and events ---------- */
function renderCurrent() {
  if (S.tab === 'tl') renderTL(); else if (S.tab === 'co') renderCO(); else if (S.tab === 'pp') renderPP(); else if (S.tab === 'rv') renderRV(); else renderAD();
  if (S.sel && $('#sheet').classList.contains('on') && !(document.activeElement && /^(TEXTAREA|INPUT)$/.test(document.activeElement.tagName))) renderSheet();
}
function refresh() { var a = document.activeElement; if (a && /^(TEXTAREA|INPUT|SELECT)$/.test(a.tagName) && a.closest('main')) return; renderCurrent(); }
function go(tab) { hidePop();
  S.sel = null; $('#sheet').classList.remove('on'); S.tab = tab;
  ['tl', 'co', 'pp', 'rv', 'ad'].forEach(function (t) { $('#v-' + t).classList.toggle('on', t === tab); });
  document.querySelectorAll('#nav button').forEach(function (b) { b.setAttribute('aria-current', b.dataset.tab === tab ? 'true' : 'false'); });
  if (tab !== 'ad' && S.edit) { S.edit = null; S.add = null; }
  renderCurrent();
}
function cycleRead(id) { upd(id, function (d) { d.r = ((d.r || 0) + 1) % 3; }); renderCurrent(); if ($('#sheet').classList.contains('on')) renderSheet(); }
var noteTimer = null;
function hidePop() { var p = $('#pop'); if (p) p.hidden = true; }
function showPop(id) {
  var it = getItem(id); if (!it) return;
  $('#sheet').classList.remove('on'); S.sel = id; renderTL();
  var el = $('#lanes [data-id="' + id + '"]'), host = $('#v-tl'), p = $('#pop'); if (!el) return;
  var rc = 'var(--r-' + (it.region || 'eu') + ')', w = (it.why || '');
  if (w.length > 150) w = w.slice(0, 147).replace(/\s+\S*$/, '') + '…';
  p.innerHTML = '<span class="tag" style="--rc:' + rc + '">' + TYPE[it.type] + (it.country ? ' · ' + flagOf(it.country) + ' ' + esc(it.country) : '') + '</span>' +
    '<b class="pt">' + esc(it.title) + '</b><div class="yr">' + esc(yearLine(it)) + '</div>' + (w ? '<p>' + esc(w) + '</p>' : '') +
    '<div class="row"><button class="btn sm pri" data-act="popopen">Details and notes</button><button class="btn sm" data-act="popclose">Close</button></div>';
  p.hidden = false;
  var r = el.getBoundingClientRect(), h = host.getBoundingClientRect(), pw = Math.min(290, h.width - 16);
  p.style.width = pw + 'px';
  var left = Math.min(Math.max(8, r.left - h.left + r.width / 2 - pw / 2), h.width - pw - 8);
  p.style.left = left + 'px';
  var ph = p.offsetHeight, below = r.bottom - h.top + 8;
  p.style.top = (below + ph > h.height - 8 ? Math.max(8, r.top - h.top - ph - 8) : below) + 'px';
}
function onClick(e) {
  var t = e.target, el;
  if ((el = t.closest('[data-rd]'))) { e.stopPropagation(); cycleRead(el.dataset.rd); return; }
  if ((el = t.closest('[data-tab]'))) { go(el.dataset.tab); return; }
  if ((el = t.closest('[data-reg]'))) { tapRegion(el.dataset.reg); return; }
  if ((el = t.closest('[data-pre]'))) { var r = PRE[el.dataset.pre]; setRange(r[0], r[1]); return; }
  if ((el = t.closest('[data-act="export"]'))) { exportBackup(); return; }
  if ((el = t.closest('[data-act="import"]'))) { $('#imp').click(); return; }
  if (t.closest('#pop')) { if ((el = t.closest('[data-act]'))) { if (el.dataset.act === 'popopen') { var pid = S.sel; hidePop(); openSheet(pid); } else if (el.dataset.act === 'popclose') { hidePop(); S.sel = null; renderTL(); } } return; }
  if ((el = t.closest('[data-id]'))) { if (el.closest('#lanes')) { showPop(el.dataset.id); } else { openSheet(el.dataset.id); } return; }
  if (!$('#pop').hidden && t.closest('#sc')) { hidePop(); S.sel = null; renderTL(); return; }
  if ((el = t.closest('[data-un]'))) {
    var o = el.dataset.un, me = S.sel;
    upd(me, function (d) { d.l = (d.l || []).filter(function (x) { return x !== o; }); });
    if (doc(o).l && doc(o).l.indexOf(me) > -1) upd(o, function (d) { d.l = d.l.filter(function (x) { return x !== me; }); });
    renderSheet(); if (S.tab === 'tl') renderTL(); return;
  }
  if ((el = t.closest('[data-lk]'))) { var to = el.dataset.lk; upd(S.sel, function (d) { d.l = (d.l || []).concat([to]); }); S.lkOpen = false; S.lkq = ''; renderSheet(); renderCurrent(); return; }
  if ((el = t.closest('[data-open]'))) { openSheet(el.dataset.open); if (S.tab === 'tl') { var it = getItem(el.dataset.open); if (it && it.start != null && (it.type === 'evt' || it.type === 'emp')) gotoYear(it.start); } return; }
  if ((el = t.closest('[data-country]'))) { S.pc = el.dataset.country; closeSheet(); go('co'); $('#v-co').scrollTop = 0; return; }
  if ((el = t.closest('[data-pp]'))) { S.pp = el.dataset.pp; renderPP(); return; }
  if ((el = t.closest('[data-rvt]'))) { var k = el.dataset.rvt; if (k === 'detail') S.rvset.detail = !S.rvset.detail; else S.rvset.types[k] = !S.rvset.types[k]; renderRV(); return; }
  if ((el = t.closest('[data-act]'))) {
    var a = el.dataset.act;
    if (a === 'close') closeSheet();
    else if (a === 'zi') zoom(1.6); else if (a === 'zo') zoom(1 / 1.6);
    else if (a === 'tier') { S.tier = S.tier === 1 ? 2 : 1; saveUI(); renderTB(); renderTL(); }
    else if (a === 'emp') { S.emp = !S.emp; saveUI(); renderTB(); renderTL(); }
    else if (a === 'ev') { S.ev = !S.ev; saveUI(); renderTB(); renderTL(); }
    else if (a === 'linkopen') { S.lkOpen = true; renderSheet(); var q = $('#lq'); if (q) q.focus(); }
    else if (a === 'ontl') { var it2 = getItem(S.sel); go('tl'); showForItem(it2); if (it2) { if (S.P < 3 && it2.type === 'evt') setRange(it2.start - 70, it2.start + 70); renderTL(); gotoYear(it2.start); } }
    else if (a === 'coback') { S.pc = null; renderCO(); }
    else if (a === 'addhere') { S.edit = null; S.add = { type: 'evt', country: S.pc, region: REGOF[S.pc], tier: 1 }; go('ad'); }
    else if (a === 'tdadd') quickTodo();
    else if (a === 'todohere') { S.edit = null; S.add = { type: 'todo', country: S.pc, countries: [S.pc], region: REGOF[S.pc], tier: 1 }; go('ad'); }
    else if (a === 'addpp') { S.edit = null; S.add = { type: S.pp, country: '', region: 'eu', tier: 1 }; go('ad'); }
    else if (a === 'rvhere') { S.rvset.scope = 'c:' + S.pc; S.rv = null; go('rv'); }
    else if (a === 'cftl') { S.cf = S.pc; renderTB(); go('tl'); setRange(1500, 2030); }
    else if (a === 'edit') {
      var it3 = getItem(S.sel); if (!it3) return;
      S.edit = it3.id; S.add = { type: it3.type, country: it3.country, countries: it3.countries, region: it3.region, title: it3.title, why: it3.why, who: it3.who, tier: it3.tier, start: it3.start, end: it3.end };
      closeSheet(); go('ad');
    }
    else if (a === 'del') { var id = S.sel; if (el.dataset.sure) { drop(id); closeSheet(); renderCurrent(); toast('Deleted'); } else { el.dataset.sure = '1'; el.textContent = 'Tap again to delete'; } }
    else if (a === 'save') saveEntry();
    else if (a === 'cancel') { S.edit = null; S.add = null; go('tl'); }
    else if (a === 'rvstart') startSession(false);
    else if (a === 'rvforce') startSession(true);
    else if (a === 'rvshow') { S.rv.show = true; renderRV(); }
    else if (a === 'rvgot') grade(true); else if (a === 'rvmiss') grade(false);
    else if (a === 'rvexit') { S.rv = null; renderRV(); }
    else if (a === 'rvagain') { S.rv = null; startSession(false); }
  }
}
function onInput(e) {
  var t = e.target;
  if (t.id === 'nt') { var id = S.sel, val = t.value; clearTimeout(noteTimer); noteTimer = setTimeout(function () { upd(id, function (d) { d.n = val; }); }, 600); }
  else if (t.id === 'cnote') { var cid = 'cn-' + slug(S.pc), cv = t.value; clearTimeout(noteTimer); noteTimer = setTimeout(function () { upd(cid, function (d) { d.n = cv; }); }, 600); }
  else if (t.id === 'lq') { S.lkq = t.value; fillRes(); }
  else if (t.id === 'cq') { S.cq = t.value; var pos = t.selectionStart; renderCO(); var n = $('#cq'); n.focus(); n.setSelectionRange(pos, pos); }
  else if (t.id === 'pq') { S.pq = t.value; var pos2 = t.selectionStart; renderPP(); var n2 = $('#pq'); n2.focus(); n2.setSelectionRange(pos2, pos2); }
}
function onChange(e) {
  var t = e.target;
  if (t.id === 'imp') { if (t.files && t.files[0]) importBackup(t.files[0]); t.value = ''; }
  else if (t.id === 'cf') { S.cf = t.value; renderTL(); }
  else if (t.id === 'rv-scope') { S.rvset.scope = t.value; renderRV(); }
  else if (t.id === 'f-type') {
    var a = S.add || {}; a.type = t.value;
    a.title = $('#f-title').value; a.why = $('#f-why').value; a.region = $('#f-region').value;
    if ($('#f-countries')) { a.countries = Array.from($('#f-countries').selectedOptions).map(function (o) { return o.value; }); a.country = a.countries[0] || ''; }
    else { a.country = $('#f-country').value; a.countries = a.country ? [a.country] : []; }
    if ($('#f-y1')) a.start = readYear('f-y1', true); if ($('#f-y2')) a.end = readYear('f-y2', true);
    if ($('#f-who')) a.who = $('#f-who').value; if ($('#f-tier')) a.tier = parseInt($('#f-tier').value, 10);
    S.add = a; renderAD();
  }
  else if (t.id === 'f-country') { var w = $('#f-regwrap'); if (w) w.hidden = !!t.value; if (t.value) $('#f-region').value = REGOF[t.value]; }
}
function init() {
  loadLocal(); loadUI(); renderTB();
  document.addEventListener('click', onClick); document.addEventListener('input', onInput); document.addEventListener('change', onChange);
  document.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.id === 'tdq') { e.preventDefault(); quickTodo(); } });
  document.addEventListener('keydown', function (e) { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('.li[role=button]')) { e.preventDefault(); e.target.click(); } });
  var raf = 0; $('#sc').addEventListener('scroll', function () { if (!raf) raf = requestAnimationFrame(function () { raf = 0; var v = viewYears(); if (v[0] < WIN[0] || v[1] > WIN[1]) renderTL(); else renderAxis(); }); });
  window.addEventListener('resize', function () { if (S.tab === 'tl') { S.P = clampP(S.P); renderTL(); } });
  initPinch();
  setRange(1500, 1900);
  initSync();
  window.__atlas = { S: S, go: go, openSheet: openSheet };
}
init();
})();
