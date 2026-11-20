(function () {
'use strict';
/* Timeline Atlas: a personal companion to reading world history.
   Saved data lives in localStorage 'atlas.v1' as { id: { n: note, l: [linked ids], r: status 0-2, s: flashcard schedule, c: item you added } }.
   Item types you can add: evt, emp, ppl, plc, todo (a topic; with c.parent it is a subtopic), book, area (a region across borders). */
var GUT = 74, DAY = 86400000;
var S = {
  tab: 'tl', prevTab: 'tl', sel: null, hist: [], docs: new Map(),
  /* timeline */ tier: 1, emp: true, ev: true, hid: {}, cf: '', P: 1, tfOpen: false,
  /* countries */ pc: null, pa: null, cq: '', creg: '', ctab: 'ov', aAll: false,
  /* library */ lib: 'todo', lq: '', qt: { t: '', w: '' }, qb: { t: '', a: '' },
  /* add */ edit: null, add: null, wp: { area: '', countries: [] },
  /* link picker */ lkOpen: false, lkq: '', lkType: '',
  /* review */ rv: null, rvset: { scope: 'read', types: { evt: true, ppl: true, plc: true }, detail: false, q: { dates: true, what: true, who: true, where: true, why: true, order: true, elsewhere: true, links: true } },
  recent: [], theme: ''
};
var linkSet = new Set();
var $ = function (s, r) { return (r || document).querySelector(s); };
var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
var fy = function (y) { return y < 0 ? (-y) + ' BCE' : (y < 1000 ? y + ' CE' : String(y)); };
var era = function (y) { return y < 500 ? 'Ancient' : y < 1500 ? 'Medieval' : y < 1900 ? 'Early modern' : 'Modern'; };
var TYPE = { evt: 'Event', emp: 'Empire or era', ppl: 'Person', plc: 'Place', todo: 'Topic', book: 'Book' };
var RDI = ['○', '◐', '●'];
function stLabels(it) { return it && it.type === 'book' ? ['Want to read', 'Reading', 'Read'] : ['To read', 'Reading', 'Read']; }
function typeLabel(it) { return it.type === 'todo' && it.parent ? 'Question' : it.type === 'emp' ? KIND[spanKind(it)] : TYPE[it.type]; }
function newId() { return 'u-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }
function idTime(id) { var m = /^u-([0-9a-z]+)[0-9a-z]{3}$/.exec(id || ''); var t = m ? parseInt(m[1], 36) : 0; return t > 1.5e12 && t < 4e12 ? t : 0; }
function toast(m) { document.querySelectorAll('.toast').forEach(function (x) { x.remove(); }); var t = document.createElement('div'); t.className = 'toast'; t.textContent = m; document.body.appendChild(t); setTimeout(function () { t.remove(); }, 1800); }
function setStatus(m) { var e = $('#st'); if (e) e.textContent = m; }

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
  if (!window.claude || !window.claude.use) { setStatus(''); return; }
  Promise.all([window.claude.use('db'), window.claude.use('user')]).then(function (r) {
    var db = r[0], user = r[1];
    if (!db || !user) return;
    return user.id().then(function (uid) {
      if (!uid) return;
      col = db.doc('data/users/' + uid + '/main').collection('items');
      setStatus('Syncing…');
      var t = setTimeout(function () { setStatus('Offline'); }, 10000);
      col.onSnapshot(function (snap) {
        if (snap.metadata.fromCache && !synced) return;
        clearTimeout(t);
        var remote = new Map(); snap.docs.forEach(function (d) { remote.set(d.id, d.data()); });
        if (!synced) { synced = true; S.docs.forEach(function (v, k) { if (!remote.has(k)) { remote.set(k, v); queueRemote(k, v); } }); }
        S.docs = remote; saveLocal(); setStatus('Synced'); refresh();
      }, function () { clearTimeout(t); col = null; setStatus(''); });
    });
  }).catch(function () {});
}
/* View settings and recently viewed things: per device, separate from your notes. */
var UIK = 'atlas.ui';
function saveUI() { try { localStorage.setItem(UIK, JSON.stringify({ hid: S.hid, ev: S.ev, emp: S.emp, tier: S.tier, recent: S.recent, theme: S.theme, q: S.rvset.q })); } catch (e) {} }
function loadUI() {
  try {
    var o = JSON.parse(localStorage.getItem(UIK) || '{}');
    if (o.hid) S.hid = o.hid; if (typeof o.ev === 'boolean') S.ev = o.ev; if (typeof o.emp === 'boolean') S.emp = o.emp; if (o.tier) S.tier = o.tier;
    if (Array.isArray(o.recent)) S.recent = o.recent; if (o.theme) S.theme = o.theme; if (o.q) Object.assign(S.rvset.q, o.q);
  } catch (e) {}
  applyTheme();
}
function applyTheme() { if (S.theme) document.documentElement.setAttribute('data-theme', S.theme); else document.documentElement.removeAttribute('data-theme'); }
function remember(k, id) {
  S.recent = S.recent.filter(function (r) { return !(r.k === k && r.id === id); });
  S.recent.unshift({ k: k, id: id, t: Date.now() }); S.recent = S.recent.slice(0, 24); saveUI();
}

/* ---------- items ---------- */
function customItems() {
  var out = [];
  S.docs.forEach(function (d, id) {
    if (!d || !d.c || d.c.type === 'area') return; var c = d.c;
    out.push({ id: id, type: c.type, region: c.region, country: c.country || '', countries: c.countries || (c.country ? [c.country] : []), area: c.area || '', start: c.start, end: c.end == null ? null : c.end, title: c.title, why: c.why || '', tier: c.tier || 1, who: c.who || '', parent: c.parent || '', author: c.author || '', url: c.url || '', custom: true });
  });
  return out;
}
function allItems() { return SEED.concat(customItems()); }
function customAreas() { var out = []; S.docs.forEach(function (d, id) { if (d && d.c && d.c.type === 'area') out.push({ id: id, name: d.c.title, region: d.c.region, countries: d.c.countries || [], why: d.c.why || '', custom: true }); }); return out; }
function areaList() { return AREAS.map(function (a) { return AREAMAP[a[0]]; }).concat(customAreas()).sort(function (a, b) { return a.name.localeCompare(b.name); }); }
function areaGet(n) { return AREAMAP[n] || customAreas().find(function (a) { return a.name === n; }); }
function areasOf(c) { return areaList().filter(function (a) { return a.countries.indexOf(c) > -1; }); }
function getItem(id) { return SEEDMAP[id] || customItems().find(function (i) { return i.id === id; }); }
function doc(id) { return S.docs.get(id) || {}; }
function linksOf(id) {
  var s = new Set(SLINK[id] || []); var d = doc(id); (d.l || []).forEach(function (x) { s.add(x); });
  S.docs.forEach(function (dd, k) { if (dd && dd.l && dd.l.indexOf(id) > -1) s.add(k); });
  return Array.from(s).filter(function (x) { return x !== id && getItem(x); });
}
function link(a, b) { if (a === b || linksOf(a).indexOf(b) > -1) return; upd(a, function (d) { d.l = (d.l || []).concat([b]); }); }
function subtopics(id) { return customItems().filter(function (i) { return i.type === 'todo' && i.parent === id; }).sort(function (a, b) { return idTime(a.id) - idTime(b.id); }); }
function regName(id) { return (REG.find(function (r) { return r.id === id; }) || {}).name || ''; }
function whereOf(it) {
  var cs = it.countries || [], A = it.area && areaGet(it.area);
  if (it.area) { var same = A && cs.length === A.countries.length && A.countries.every(function (c) { return cs.indexOf(c) > -1; }); return it.area + (cs.length && !same ? ' (' + cs.join(', ') + ')' : ''); }
  return cs.length ? cs.join(', ') : (it.type === 'todo' || it.type === 'book') ? '' : regName(it.region);
}
function hasCountry(it, c) { return it.country === c || (it.countries || []).indexOf(c) > -1; }
function yearLine(it) {
  if (it.type === 'evt') return fy(it.start) + ' · ' + era(it.start);
  if (it.type === 'emp') return fy(it.start) + ' – ' + (it.end >= 2026 ? 'present' : fy(it.end));
  if (it.type === 'ppl') return it.end == null ? 'b. ' + fy(it.start) : fy(it.start) + ' – ' + fy(it.end);
  if (it.type === 'book') return it.author || '';
  if (it.type === 'todo') return whereOf(it);
  return it.country;
}
/* Spans are drawn differently by kind; the data has no kind field, so it is read from the name. */
var KIND = { state: 'Empire or state', dyn: 'Dynasty', era: 'Era or culture', war: 'War or conflict' };
function spanKind(it) {
  var t = it.title;
  if (/\b(war|wars|revolt|uprising|conquest|crusades?|scramble|genocide|invasion)\b/i.test(t)) return 'war';
  if (/(dynasty|shogunate|caliphate|sultanate|monarchy|khanate)/i.test(t)) return 'dyn';
  if (/(empire|kingdom|republic|state|states|khaganate|commonwealth|union|confederation|rule|raj|horde|egypt|persia|carthage|elam|mitanni|assyria|kush|rus|venice|iran|china|united states|japan|korea|colonial|philippines|indies|burma|indochina|brazil|americas|aksum|mali|songhai|kongo|zimbabwe|srivijaya|majapahit|ayutthaya|khmer|pagan|funan|champa|wari|tiwanaku|teotihuacan|xiongnu|scythians)/i.test(t)) return 'state';
  return 'era';
}
function readCls(it) { return doc(it.id).r === 2 ? ' read-2' : ''; }
function countryOptions(sel, blank) {
  var h = blank ? '<option value="">' + esc(blank) + '</option>' : '';
  REG.forEach(function (r) { h += '<optgroup label="' + esc(r.name) + '">' + CO[r.id].map(function (c) { return '<option' + (c === sel ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') + '</optgroup>'; });
  return h;
}
function noteBox(id, ph, label) {
  return '<div class="note"><div class="note-h"><span>✎ ' + esc(label || 'My notes') + '</span><span class="note-st" id="ntst">Saves as you type</span></div><textarea class="nt" data-nid="' + esc(id) + '" placeholder="' + esc(ph || 'What you read, what stuck, questions, connections…') + '">' + esc(doc(id).n || '') + '</textarea></div>';
}
function statusSeg(it) {
  var r = doc(it.id).r || 0, L = stLabels(it);
  return '<div class="seg st3" role="group" aria-label="Reading status">' + L.map(function (l, i) { return '<button data-setr="' + i + '" data-sid="' + it.id + '" aria-pressed="' + (r === i) + '">' + RDI[i] + ' ' + l + '</button>'; }).join('') + '</div>';
}
function rowHtml(it, withRead, extra) {
  var d = doc(it.id), y = it.type === 'evt' ? fy(it.start) : '', L = stLabels(it), sub;
  if (it.type === 'evt') sub = it.why;
  else if (it.type === 'todo') { var n = subtopics(it.id).length; sub = [it.parent ? '' : whereOf(it), n ? n + (n === 1 ? ' question' : ' questions') : '', it.why].filter(Boolean).join(' · '); }
  else if (it.type === 'book') sub = [it.author, it.why].filter(Boolean).join(' · ');
  else sub = yearLine(it) + (it.why ? ' · ' + it.why : '');
  return '<div class="li" role="button" tabindex="0" data-open="' + it.id + '">' +
    (withRead ? '<button class="rs" data-rd="' + it.id + '" aria-label="Status: ' + L[d.r || 0] + '. Tap to change">' + RDI[d.r || 0] + '</button>' : '') +
    (y ? '<span class="y">' + esc(y) + '</span>' : '') +
    '<span class="lit"><span class="t' + (d.r === 2 && (it.type === 'todo' || it.type === 'book') ? ' done' : '') + '"' + (it.tier === 2 ? ' style="font-weight:500"' : '') + '>' + esc(it.title) + '</span>' + (d.r === 1 ? ' <span class="pill">' + L[1] + '</span>' : '') + (extra || '') +
    (sub || d.n ? '<br><span class="s">' + esc(sub || '') + (d.n ? '<span class="hasnote"> · ✎ notes</span>' : '') + '</span>' : '') + '</span></div>';
}

/* ---------- timeline ---------- */
function visible(it) {
  if (it.type === 'emp') return S.emp || it.id === S.sel;
  if (it.type !== 'evt') return false;
  if (it.id === S.sel) return true;
  if (!S.ev) return false;
  if (S.tier === 1 && it.tier !== 1) return false;
  if (S.cf && it.country !== S.cf) return false;
  return true;
}
function cls(it) { return readCls(it) + (it.id === S.sel ? ' sel' : '') + (S.sel && linkSet.has(it.id) ? ' lnk' : ''); }
function evHtml(e, x, y, label) {
  return '<button class="ev' + (label ? '' : ' dot') + (e.tier === 2 ? ' t2' : '') + cls(e) + '" data-id="' + e.id + '" style="left:' + x + 'px;top:' + y + 'px" title="' + esc(fy(e.start) + ' ' + e.title) + '"><i></i><b>' + esc(e.title) + '</b></button>';
}
/* One lane per region: a strip of event dots on top, then the region's spans packed into rows.
   A span too short for its name gets the name printed just after the bar, and the row keeps room for it. */
function packLane(list, xOf) {
  var bars = list.filter(function (i) { return i.type === 'emp'; }).sort(function (a, b) { return a.start - b.start || b.end - a.end; });
  var rows = [], out = [];
  bars.forEach(function (b) {
    var k = spanKind(b), x0 = xOf(b.start), w = Math.max(xOf(Math.min(b.end, MAX)) - x0, 6), lw = (b.title.length + (k === 'war' ? 2 : 0)) * 6.4 + 18, outside = w < lw;
    var r = rows.findIndex(function (e) { return e <= x0; });
    if (r < 0) { r = rows.length; rows.push(0); }
    rows[r] = x0 + w + (outside ? lw + 6 : 3);
    out.push({ b: b, k: k, x0: x0, w: w, r: r, outside: outside });
  });
  return { bars: out, nrows: rows.length, evs: list.filter(function (i) { return i.type === 'evt'; }) };
}
function layoutLane(pk, xOf, BH) {
  var html = '', pos = {}, labels = [], top = S.ev ? 26 : 6;
  pk.bars.forEach(function (o) {
    var b = o.b, y = top + o.r * BH;
    html += '<button class="bar k-' + o.k + (o.outside ? ' out' : '') + cls(b) + '" data-id="' + b.id + '" style="left:' + o.x0 + 'px;width:' + o.w + 'px;top:' + y + 'px" title="' + esc(b.title + ' (' + yearLine(b) + ')') + '"><span>' + (o.k === 'war' ? '⚔ ' : '') + esc(b.title) + '</span></button>';
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
  return { html: html, pos: pos, h: !pk.nrows && !(S.ev && pk.evs.length) ? 30 : Math.max(top + pk.nrows * BH + 8, 44) };
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
/* Lanes are laid out for the years on screen plus one screen either side, so rows aren't spent on empires far away. */
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
  var fixed = regs.length * ((S.ev ? 26 : 6) + 9), avail = (sc.clientHeight || 500) - 26 - 84 - fixed;
  var BH = Math.round(Math.min(38, Math.max(24, avail / rowsTotal)));
  var lanes = $('#lanes');
  lanes.style.setProperty('--bh', (BH - 7) + 'px');
  lanes.style.setProperty('--bf', (BH < 23 ? 10.5 : BH < 30 ? 11.5 : BH < 38 ? 13 : 14.5) + 'px');
  regs.forEach(function (r, k) {
    var L = layoutLane(packs[k], xOf, BH);
    html += '<div class="lane" style="height:' + L.h + 'px;--rc:var(--r-' + r.id + ')"><div class="lname">' + esc(r.short) + '</div>' + L.html + '</div>';
    Object.keys(L.pos).forEach(function (id) { pos[id] = { x: L.pos[id].x, y: top + L.pos[id].y }; });
    top += L.h + 1;
  });
  if (!regs.length) html = '<p class="hint" style="padding:16px">No regions selected. Tap World to show them all.</p>';
  var W = GUT + (MAX - MIN) * P + 30, step = stepFor(P), t0 = Math.ceil(MIN / step) * step;
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
/* Two-finger pinch zooms time around the point between your fingers. While fingers move the drawing is only
   stretched (re-drawing would drop the touch); it is laid out properly when they lift. */
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
var PRE = { all: [MIN, MAX], ancient: [-3500, 500], med: [500, 1500], early: [1500, 1900], mod: [1900, 2030] };
function curPre() { var v = viewYears(); for (var k in PRE) if (Math.abs(PRE[k][0] - v[0]) < (v[1] - v[0]) * 0.04 && Math.abs(PRE[k][1] - v[1]) < (v[1] - v[0]) * 0.06) return k; return ''; }
function filterCount() { return (S.ev ? 0 : 1) + (S.ev && S.tier !== 1 ? 1 : 0) + (S.emp ? 0 : 1) + (S.cf ? 1 : 0); }
/* Two compact rows: periods (with a Filters button) and regions. Filters open a small panel. */
function renderTB() {
  var pre = [['all', 'All'], ['ancient', 'Ancient'], ['med', 'Medieval'], ['early', '1500–1900'], ['mod', 'Modern']], cp = curPre(), fc = filterCount();
  var all = !REG.some(function (r) { return S.hid[r.id]; });
  $('#tb').innerHTML = '<div class="tbs">' + pre.map(function (p) { return '<button class="chip" data-pre="' + p[0] + '" aria-pressed="' + (cp === p[0]) + '">' + p[1] + '</button>'; }).join('') + '</div>' +
    '<div class="tbfix"><button class="zb" data-act="zo" aria-label="Zoom out">−</button><button class="zb" data-act="zi" aria-label="Zoom in">+</button>' +
    '<button class="chip fbtn' + (fc ? ' on' : '') + '" data-act="tf" aria-expanded="' + S.tfOpen + '" aria-label="Filters">Filters' + (fc ? ' · ' + fc : '') + '</button></div>';
  $('#tb2').innerHTML = '<button class="chip" data-reg="all" aria-pressed="' + all + '">World</button>' +
    REG.map(function (r) { return '<button class="chip rg" data-reg="' + r.id + '" style="--rc:var(--r-' + r.id + ')" aria-pressed="' + (!all && !S.hid[r.id]) + '">' + esc(r.short) + '</button>'; }).join('');
  var tf = $('#tf'); tf.hidden = !S.tfOpen;
  if (S.tfOpen) tf.innerHTML = '<div class="row"><button class="chip" data-act="ev" aria-pressed="' + S.ev + '">Events</button>' +
    (S.ev ? '<button class="chip" data-act="tier" aria-pressed="' + (S.tier === 1) + '">Key events only</button>' : '') +
    '<button class="chip" data-act="emp" aria-pressed="' + S.emp + '">Empires and eras</button>' +
    '<select id="cf" aria-label="Show events from one country">' + countryOptions(S.cf, 'Events from all countries') + '</select></div>' +
    '<div class="legend"><span><i class="lg k-state"></i>Empire or state</span><span><i class="lg k-dyn"></i>Dynasty</span><span><i class="lg k-era"></i>Era or culture</span><span><i class="lg k-war"></i>⚔ War</span><span><i class="lg ev1"></i>Key event</span><span><i class="lg ev2"></i>Detail event</span></div>';
}
/* Tapping a region while the whole world is shown focuses on it; after that, taps add or remove regions. */
function tapRegion(id) {
  var all = !REG.some(function (r) { return S.hid[r.id]; });
  if (id === 'all') S.hid = {};
  else if (all) { S.hid = {}; REG.forEach(function (r) { if (r.id !== id) S.hid[r.id] = true; }); }
  else { S.hid[id] = !S.hid[id]; if (!S.hid[id]) delete S.hid[id]; if (REG.every(function (r) { return S.hid[r.id]; })) S.hid = {}; }
  saveUI(); renderTB(); renderTL();
}
function showForItem(it) { if (!it) return; var ch = false; if (it.region && S.hid[it.region]) { delete S.hid[it.region]; ch = true; } if (it.type === 'evt' && !S.ev) { S.ev = true; ch = true; } if (it.type === 'emp' && !S.emp) { S.emp = true; ch = true; } if (ch) { saveUI(); renderTB(); } }
function showOnTimeline(it) {
  go('tl'); showForItem(it);
  if (S.P < 3 && it.type === 'evt') setRange(it.start - 70, it.start + 70);
  else if (it.type === 'emp' && S.P * (it.end - it.start) > $('#sc').clientWidth * 3) setRange(it.start - 20, Math.min(MAX, it.start + 300));
  S.sel = it.id; gotoYear(it.type === 'emp' ? it.start + Math.min(150, (it.end - it.start) / 2) : it.start); renderTB(); showPop(it.id);
}
/* Peek card: a compact summary docked above the tab bar when you tap a bar or dot. */
function hidePop() { var p = $('#pop'); if (p) p.hidden = true; }
function showPop(id) {
  var it = getItem(id); if (!it) return;
  closeSheet(true); S.sel = id; renderTL();
  var p = $('#pop'), w = it.why || '', rc = 'var(--r-' + (it.region || 'eu') + ')';
  if (w.length > 160) w = w.slice(0, 157).replace(/\s+\S*$/, '') + '…';
  var ew = elsewhere(it).slice(0, 3);
  p.style.setProperty('--rc', rc);
  p.innerHTML = '<div class="pk-h"><span class="tag" style="--rc:' + rc + '">' + esc(typeLabel(it)) + (it.country ? ' · ' + flagOf(it.country) + ' ' + esc(it.country) : ' · ' + esc(regName(it.region))) + '</span><button class="x" data-act="popclose" aria-label="Close">✕</button></div>' +
    '<b class="pt">' + esc(it.title) + '</b><div class="yr">' + esc(yearLine(it)) + '</div>' + (w ? '<p>' + esc(w) + '</p>' : '') +
    (ew.length ? '<div class="pk-ew"><b>Meanwhile</b> ' + ew.map(function (g) { return '<span style="--rc:var(--r-' + g.r.id + ')">' + esc(g.items[0].title) + '</span>'; }).join('') + '</div>' : '') +
    '<div class="row"><button class="btn sm pri" data-act="popopen">Details and notes</button>' + (doc(id).n ? '<span class="pill">✎ has notes</span>' : '') + '</div>';
  p.hidden = false;
}
/* What else was going on: for each other region, spans active at the time and a key event nearby. */
function refYear(it) { return it.type === 'emp' ? it.start : it.type === 'ppl' ? (it.end != null ? Math.round((it.start + it.end) / 2) : it.start + 30) : it.start; }
function elsewhere(it) {
  if (!it || it.start == null || it.type === 'plc' || it.type === 'todo' || it.type === 'book') return [];
  var y = refYear(it), all = SEED, out = [];
  REG.forEach(function (r) {
    if (r.id === it.region) return;
    var sp = all.filter(function (i) { return i.type === 'emp' && i.region === r.id && i.start <= y && i.end >= y; }).sort(function (a, b) { return (a.end - a.start) - (b.end - b.start); }).slice(0, 2);
    var ev = all.filter(function (i) { return i.type === 'evt' && i.tier === 1 && i.region === r.id && Math.abs(i.start - y) <= 15; }).sort(function (a, b) { return Math.abs(a.start - y) - Math.abs(b.start - y); }).slice(0, 1);
    var items = sp.concat(ev); if (items.length) out.push({ r: r, items: items });
  });
  return out;
}

/* ---------- detail sheet: a layout per kind of item ---------- */
function openSheet(id, push) {
  if (push && S.sel && S.sel !== id && $('#sheet').classList.contains('on')) S.hist.push(S.sel); else if (!push) S.hist = [];
  S.sel = id; S.lkOpen = false; S.lkq = ''; S.lkType = ''; hidePop(); remember('i', id);
  renderSheet(); $('#sheet').scrollTop = 0; if (S.tab === 'tl') renderTL();
}
function closeSheet(keepSel) { if (!keepSel) S.sel = null; S.hist = []; $('#sheet').classList.remove('on'); $('#scrim').classList.remove('on'); if (S.tab === 'tl' && !keepSel) renderTL(); }
function chip(id, mine, me) {
  var o = getItem(id); if (!o) return '';
  var sub = o.type === 'evt' ? fy(o.start) : o.type === 'book' ? (o.author || 'Book') : o.type === 'todo' ? (o.parent ? 'Question' : 'Topic') : o.type === 'emp' ? fy(o.start) + '–' + (o.end >= 2026 ? 'now' : fy(o.end)) : TYPE[o.type];
  return '<span class="lk-chip" style="--rc:var(--r-' + (o.region || 'eu') + ')"><button class="x lk-o" data-open="' + id + '">' + (o.type === 'book' ? '📖 ' : o.type === 'todo' ? '🔎 ' : '') + esc(o.title) + ' <small>' + esc(sub) + '</small></button>' + (mine ? '<button class="x" aria-label="Remove link" data-un="' + id + '">×</button>' : '') + '</span>';
}
function linkGroups(it) {
  var d = doc(it.id), mine = new Set(d.l || []), g = { todo: [], book: [], hist: [], ppl: [], plc: [] };
  linksOf(it.id).forEach(function (id) {
    var o = getItem(id), user = mine.has(id) || (doc(id).l || []).indexOf(it.id) > -1;
    var k = o.type === 'todo' ? 'todo' : o.type === 'book' ? 'book' : o.type === 'ppl' ? 'ppl' : o.type === 'plc' ? 'plc' : 'hist';
    g[k].push(chip(id, user));
  });
  return g;
}
function chipsOr(list, empty) { return list.length ? '<div class="lk-chips">' + list.join('') + '</div>' : '<p class="muted small">' + empty + '</p>'; }
function linkPicker(kinds, label) {
  if (!S.lkOpen) return '<button class="btn sm" data-act="linkopen" data-lt="' + (kinds || '') + '">' + label + '</button>';
  return '<div class="lkbox"><input id="lq" type="search" placeholder="' + (S.lkType === 'book' ? 'Search your books, or type a new title' : 'Search events, people, places, books, topics') + '" value="' + esc(S.lkq) + '" aria-label="Search to link" autocomplete="off"><div id="lres" class="res"></div><button class="btn sm" data-act="linkclose" style="margin-top:6px">Done</button></div>';
}
function fillRes() {
  var box = $('#lres'); if (!box || !S.sel) return;
  var q = S.lkq.trim().toLowerCase(), linked = new Set(linksOf(S.sel)); if (!q) { box.innerHTML = '<span class="muted small">Start typing…</span>'; return; }
  var m = allItems().filter(function (i) { return i.id !== S.sel && !linked.has(i.id) && (!S.lkType || i.type === S.lkType) && (i.title + ' ' + i.country + ' ' + (i.author || '')).toLowerCase().indexOf(q) > -1; })
    .sort(function (a, b) { return (b.custom ? 1 : 0) - (a.custom ? 1 : 0); }).slice(0, 8);
  var raw = S.lkq.trim();
  box.innerHTML = m.map(function (i) { return '<button data-lk="' + i.id + '">' + (i.type === 'book' ? '📖 ' : i.type === 'todo' ? '🔎 ' : '') + esc(i.title) + ' <span class="muted">· ' + esc(typeLabel(i)) + (i.type === 'evt' ? ', ' + fy(i.start) : '') + (i.country ? ', ' + esc(i.country) : '') + (i.author ? ', ' + esc(i.author) : '') + '</span></button>'; }).join('') +
    '<button data-mk="book" data-v="' + esc(raw) + '">＋ New book: “' + esc(raw) + '”</button>' + (S.lkType === 'book' ? '' : '<button data-mk="todo" data-v="' + esc(raw) + '">＋ New topic: “' + esc(raw) + '”</button>');
}
/* Create a book or topic straight from the link box, already tagged like the item you're on, and link it. */
function quickMake(type, title) {
  if (!title) return;
  var from = getItem(S.sel), id = newId(), cs = from ? (from.countries && from.countries.length ? from.countries.slice() : from.country ? [from.country] : []) : [];
  upd(id, function (d) { d.c = { type: type, title: title, author: '', why: '', url: '', country: cs[0] || '', countries: cs, area: from && from.area || '', region: from && from.region || '', tier: 1, who: '', start: null, end: null }; });
  link(S.sel, id); S.lkOpen = false; S.lkq = ''; toast(type === 'book' ? 'Book saved and linked' : 'Topic saved and linked'); renderSheet();
}
function whereChips(it) {
  var h = (it.area && areaGet(it.area) ? '<button class="btn sm" data-area="' + esc(it.area) + '">📍 ' + esc(it.area) + '</button>' : '') +
    (it.countries || []).map(function (c) { return '<button class="btn sm" data-country="' + esc(c) + '">' + flagOf(c) + ' ' + esc(c) + '</button>'; }).join('');
  return h ? '<div class="row">' + h + '</div>' : '<p class="muted small">No countries or regions tagged. Tap Edit to add some.</p>';
}
function editRow(it) {
  if (!it.custom) return '';
  var n = it.type === 'todo' ? subtopics(it.id).length : 0;
  return '<div class="row sh-edit"><button class="btn sm" data-act="edit">Edit</button><button class="btn sm del" data-act="del" data-n="' + n + '">Delete' + (n ? ' with ' + n + (n === 1 ? ' question' : ' questions') : '') + '</button></div>';
}
function elsewhereHtml(it) {
  var ew = elsewhere(it); if (!ew.length) return '';
  return '<h3>Elsewhere in the world, around ' + esc(fy(refYear(it))) + '</h3><div class="ew">' + ew.map(function (g) {
    return '<div class="ew-r" style="--rc:var(--r-' + g.r.id + ')"><span class="ew-n">' + esc(g.r.short) + '</span><span>' + g.items.map(function (i) { return '<button class="lnkbtn" data-open="' + i.id + '">' + esc(i.title) + '</button>'; }).join(' · ') + '</span></div>';
  }).join('') + '</div>';
}
function renderSheet() {
  var it = getItem(S.sel), sh = $('#sheet');
  if (!it) { closeSheet(); return; }
  var rc = 'var(--r-' + (it.region || 'eu') + ')', g = linkGroups(it), h;
  var top = '<div class="sh-grab" aria-hidden="true"></div><div class="sh-h">' + (S.hist.length ? '<button class="btn sm" data-act="back">‹ Back</button>' : '<span></span>') + '<button class="btn sm" data-act="close">Close</button></div>';
  if (it.type === 'todo') {
    var par = it.parent && getItem(it.parent), subs = subtopics(it.id);
    h = top + (par ? '<button class="crumb" data-open="' + par.id + '">↑ Part of 🔎 ' + esc(par.title) + '</button>' : '') +
      '<span class="tag" style="--rc:var(--accent)">' + (par ? 'Question' : 'Topic to explore') + '</span><h2>' + esc(it.title) + '</h2>' + statusSeg(it) +
      (it.why ? '<div class="why-mine"><span class="lbl">Why I’m interested</span>' + esc(it.why) + '</div>' : '') +
      (par ? '' : '<h3>Questions to explore</h3><div class="list">' + subs.map(function (s) { return rowHtml(s, true); }).join('') + '</div>' +
        '<div class="row qadd"><input id="subq" type="text" placeholder="Add a question, e.g. What happened in 2014?" autocomplete="off"><button class="btn pri sm" data-act="subadd">Add</button></div>') +
      noteBox(it.id) +
      '<h3>Books</h3>' + chipsOr(g.book, 'No books yet.') + '<div class="mt6">' + (S.lkOpen && S.lkType === 'book' ? linkPicker() : '<button class="btn sm" data-act="linkopen" data-lt="book">＋ Add a book</button>') + '</div>' +
      '<h3>Where</h3>' + whereChips(it) +
      '<h3>Related history</h3>' + chipsOr(g.hist.concat(g.ppl, g.plc, g.todo), 'Link events, people and places as you find them.') +
      '<div class="mt6">' + (S.lkOpen && S.lkType !== 'book' ? linkPicker() : '<button class="btn sm" data-act="linkopen" data-lt="">＋ Link an event, person or place</button>') + '</div>' + editRow(it);
  } else if (it.type === 'book') {
    h = top + '<span class="tag" style="--rc:var(--accent)">📖 Book</span><h2>' + esc(it.title) + '</h2>' + (it.author ? '<div class="yr">by ' + esc(it.author) + '</div>' : '') +
      statusSeg(it) +
      (it.why ? '<div class="why-mine"><span class="lbl">Why I saved it</span>' + esc(it.why) + '</div>' : '') +
      (it.url ? '<p><a href="' + esc(/^https?:\/\//i.test(it.url) ? it.url : 'https://' + it.url) + '" target="_blank" rel="noopener">Open link ↗</a></p>' : '') +
      noteBox(it.id, 'Thoughts while reading, favourite bits, who to recommend it to…') +
      '<h3>Topics</h3>' + chipsOr(g.todo, 'Not linked to a topic yet.') +
      '<h3>Where</h3>' + whereChips(it) +
      '<h3>History it covers</h3>' + chipsOr(g.hist.concat(g.ppl, g.plc, g.book), 'Link the events, people and places it covers.') +
      '<div class="mt6">' + linkPicker('', '＋ Link a topic, event, person or place') + '</div>' + editRow(it);
  } else {
    var flag = it.country ? flagOf(it.country) + ' ' + esc(it.country) : esc(regName(it.region));
    h = top + '<span class="tag" style="--rc:' + rc + '">' + esc(typeLabel(it)) + ' · ' + flag + '</span><h2>' + esc(it.title) + '</h2><div class="yr">' + esc(yearLine(it)) + '</div>' +
      (it.why || it.who ? '<div class="about"><span class="lbl">' + (it.custom ? 'Your entry' : 'From the atlas') + '</span>' + (it.why ? '<p>' + esc(it.why) + '</p>' : '') + (it.who ? '<p class="who"><b>Involved:</b> ' + esc(it.who) + '</p>' : '') + '</div>' : '') +
      statusSeg(it) +
      '<div class="row mt6">' + (it.type === 'evt' || it.type === 'emp' ? '<button class="btn sm" data-act="ontl">Show on timeline</button>' : '') + (it.country ? '<button class="btn sm" data-country="' + esc(it.country) + '">' + flagOf(it.country) + ' ' + esc(it.country) + '</button>' : '') + '</div>' +
      noteBox(it.id) +
      '<h3>Connected</h3>' + chipsOr(g.hist.concat(g.ppl, g.plc), 'Nothing linked yet.') +
      (g.todo.length ? '<h3>In your topics</h3>' + chipsOr(g.todo, '') : '') +
      (g.book.length ? '<h3>Books</h3>' + chipsOr(g.book, '') : '') +
      '<div class="mt6">' + linkPicker('', '＋ Link something') + '</div>' +
      elsewhereHtml(it) + editRow(it);
  }
  sh.innerHTML = h;
  sh.classList.add('on'); $('#scrim').classList.add('on');
  if (S.lkOpen) fillRes();
}
function addSubtopic() {
  var el = $('#subq'), t = el && el.value.trim(); if (!t) { if (el) el.focus(); return; }
  var p = getItem(S.sel), id = newId();
  upd(id, function (d) { d.c = { type: 'todo', parent: p.id, title: t, why: '', country: p.country || '', countries: (p.countries || []).slice(), area: p.area || '', region: p.region || '', tier: 1, who: '', start: null, end: null }; });
  renderSheet(); var n = $('#subq'); if (n) n.focus(); toast('Question added');
}

/* ---------- countries and regions ---------- */
function progress(c) {
  var t = SEED.filter(function (i) { return i.type === 'evt' && i.country === c && i.tier === 1; }).concat(customItems().filter(function (i) { return i.type === 'evt' && i.country === c && i.tier === 1; }));
  return { n: t.length, done: t.filter(function (i) { return doc(i.id).r === 2; }).length };
}
function miniProg(p) { return p.n ? '<span class="mprog"><i style="width:' + Math.round(p.done / p.n * 100) + '%"></i></span><small>' + p.done + '/' + p.n + ' read</small>' : ''; }
function countryCard(c) { return '<button class="cc" data-country="' + esc(c) + '"><span class="fl">' + flagOf(c) + '</span><span class="ccb"><b>' + esc(c) + '</b>' + miniProg(progress(c)) + '</span></button>'; }
function countryRow(c) {
  var p = progress(c);
  return '<button class="crow" data-country="' + esc(c) + '"><span class="fl">' + flagOf(c) + '</span><span class="crn">' + esc(c) + '</span>' + (p.n ? '<span class="crp"><span class="mprog"><i style="width:' + Math.round(p.done / p.n * 100) + '%"></i></span><small>' + p.done + '/' + p.n + '</small></span>' : '') + '</button>';
}
function areaChips(list) { return '<div class="lk-chips">' + list.map(function (a) { return '<button class="lk-chip" data-area="' + esc(a.name) + '">📍 ' + esc(a.name) + (a.custom ? ' <small>yours</small>' : '') + '</button>'; }).join('') + '</div>'; }
/* Countries opens on eight region tiles; picking one (tile or dropdown) shows just that region. */
function renderCO() {
  var v = $('#v-co');
  if (S.pc) return renderCountry(v);
  if (S.pa) return renderArea(v);
  var q = S.cq.trim().toLowerCase(), fr = S.creg, h = '<div class="pad">';
  var recentC = S.recent.filter(function (r) { return r.k === 'c' && PROF[r.id]; }).slice(0, 4);
  h += '<div class="cohead"><h2>Countries</h2><select id="creg" aria-label="Choose a part of the world"><option value="">All regions</option>' + REG.map(function (r) { return '<option value="' + r.id + '"' + (fr === r.id ? ' selected' : '') + '>' + esc(r.name) + '</option>'; }).join('') + '</select></div>' +
    '<input id="cq" type="search" placeholder="Search any country or region" value="' + esc(S.cq) + '" aria-label="Search countries and regions">';
  if (q) {
    var ar = areaList().filter(function (a) { return a.name.toLowerCase().indexOf(q) > -1; }), cs = Object.keys(REGOF).filter(function (c) { return c.toLowerCase().indexOf(q) > -1; }).sort();
    h += (ar.length ? '<h3>Regions across borders</h3>' + areaChips(ar) : '') + (cs.length ? '<h3>Countries</h3><div class="clist">' + cs.map(countryRow).join('') + '</div>' : '') + (!ar.length && !cs.length ? '<p class="muted">Nothing called “' + esc(S.cq) + '”.</p>' : '');
  } else if (!fr) {
    if (recentC.length) h += '<h3>Recently viewed</h3><div class="clist">' + recentC.map(function (r) { return countryRow(r.id); }).join('') + '</div>';
    h += '<h3>Parts of the world</h3><div class="tiles">' + REG.map(function (r) {
      var tot = { n: 0, d: 0 }; CO[r.id].forEach(function (c) { var p = progress(c); tot.n += p.n; tot.d += p.done; });
      var na = areaList().filter(function (a) { return a.region === r.id; }).length;
      return '<button class="tile" data-creg="' + r.id + '" style="--rc:var(--r-' + r.id + ')"><b>' + esc(r.name) + '</b><small>' + CO[r.id].length + ' countries' + (na ? ' · ' + na + ' regions' : '') + '</small>' + (tot.d ? '<small>' + tot.d + ' of ' + tot.n + ' key events read</small>' : '') + '</button>';
    }).join('') + '</div><div class="row mt6"><button class="btn sm" data-act="addarea">＋ Add your own region</button></div>';
  } else {
    var reg = REG.find(function (r) { return r.id === fr; }), ars = areaList().filter(function (a) { return a.region === fr; });
    h += '<div class="rhead" style="--rc:var(--r-' + fr + ')"><button class="btn sm" data-creg="">← All</button><b>' + esc(reg.name) + '</b></div>' +
      (ars.length ? '<h3>Regions across borders</h3>' + areaChips(ars) : '') +
      '<h3>Countries · ' + CO[fr].length + '</h3><div class="clist">' + CO[fr].map(countryRow).join('') + '</div>';
  }
  v.innerHTML = h + '</div>';
}
function eraGroups(evs) {
  var g = [['Ancient', []], ['Medieval', []], ['Early modern', []], ['Modern', []]];
  evs.forEach(function (e) { g[{ Ancient: 0, Medieval: 1, 'Early modern': 2, Modern: 3 }[era(e.start)]][1].push(e); });
  return g.filter(function (x) { return x[1].length; });
}
function researchFor(test) { var ci = customItems(); return { tds: ci.filter(function (i) { return i.type === 'todo' && !i.parent && test(i); }), bks: ci.filter(function (i) { return i.type === 'book' && test(i); }) }; }
function renderCountry(v) {
  var c = S.pc, p = PROF[c] || {}, r = REGOF[c], reg = REG.find(function (x) { return x.id === r; }) || REG[0];
  var items = allItems(), evs = items.filter(function (i) { return i.type === 'evt' && i.country === c; }).sort(function (a, b) { return a.start - b.start; });
  var pr = progress(c), evIds = new Set(evs.map(function (e) { return e.id; }));
  var rel = function (i) { return i.country === c || linksOf(i.id).some(function (x) { return evIds.has(x); }); };
  var ppl = items.filter(function (i) { return i.type === 'ppl' && rel(i); }).sort(function (a, b) { return a.start - b.start; });
  var plc = items.filter(function (i) { return i.type === 'plc' && rel(i); });
  var rs = researchFor(function (i) { return hasCountry(i, c); }), noted = evs.concat(ppl, plc).filter(function (i) { return doc(i.id).n; });
  var ars = areasOf(c), t = S.ctab;
  var tabs = [['ov', 'Overview'], ['tl', 'Timeline · ' + evs.length], ['pp', 'People & places'], ['me', 'My research' + (rs.tds.length + rs.bks.length ? ' · ' + (rs.tds.length + rs.bks.length) : '')]];
  var h = '<div class="pad"><button class="btn sm" data-act="coback">← Countries</button>' +
    '<div class="row" style="margin-top:12px;gap:14px;align-items:center"><span class="bigflag">' + flagOf(c) + '</span><div><h2 style="margin:0">' + esc(c) + '</h2><span class="tag" style="--rc:var(--r-' + reg.id + ')">' + esc(reg.name) + '</span></div></div>' +
    '<div class="tb flush">' + tabs.map(function (x) { return '<button class="chip" data-ctab="' + x[0] + '" aria-pressed="' + (t === x[0]) + '">' + x[1] + '</button>'; }).join('') + '</div>';
  if (t === 'ov') {
    h += (p.cap ? '<dl class="prof"><dt>Capital</dt><dd>' + esc(p.cap) + '</dd><dt>Languages</dt><dd>' + esc(p.lang) + '</dd><dt>Religions</dt><dd>' + esc(p.rel) + '</dd></dl><div class="muted tiny">Figures are approximate; check a current source before relying on them.</div>' : '') +
      (pr.n ? '<div class="mt6"><b>' + pr.done + ' of ' + pr.n + '</b> key events read</div><div class="bar-prog"><i style="width:' + Math.round(pr.done / pr.n * 100) + '%"></i></div>' : '') +
      '<div class="row mt6"><button class="btn sm pri" data-act="addhere" data-t="todo">＋ Topic</button><button class="btn sm" data-act="addhere" data-t="book">＋ Book</button><button class="btn sm" data-act="addhere" data-t="evt">＋ Event</button><button class="btn sm" data-act="rvhere">Review</button><button class="btn sm" data-act="cftl">On the timeline</button></div>' +
      (ars.length ? '<h3>Part of these regions</h3><div class="lk-chips">' + ars.map(function (a) { return '<button class="lk-chip" data-area="' + esc(a.name) + '">📍 ' + esc(a.name) + '</button>'; }).join('') + '</div>' : '') +
      (p.lat != null && p.iso3 ? '<div class="map" id="map" style="margin-top:14px"></div><a class="muted tiny" target="_blank" rel="noopener" href="https://www.openstreetmap.org/?mlat=' + p.lat + '&mlon=' + p.lon + '#map=5/' + p.lat + '/' + p.lon + '">Open a detailed map ↗</a>' : '') +
      noteBox('cn-' + slug(c), 'Overview, themes, what to read next', 'My notes on ' + c);
  } else if (t === 'tl') {
    h += eraGroups(evs).map(function (g) { return '<h3>' + g[0] + '</h3><div class="list">' + g[1].map(function (e) { return rowHtml(e, true); }).join('') + '</div>'; }).join('') || '<p class="muted">No events yet.</p>';
    h += '<div class="row mt6"><button class="btn sm" data-act="addhere" data-t="evt">＋ Add an event</button></div>';
  } else if (t === 'pp') {
    h += '<h3>People</h3>' + (ppl.length ? '<div class="list">' + ppl.map(function (e) { return rowHtml(e, true); }).join('') + '</div>' : '<p class="muted small">None yet.</p>') +
      '<h3>Places</h3>' + (plc.length ? '<div class="list">' + plc.map(function (e) { return rowHtml(e, true); }).join('') + '</div>' : '<p class="muted small">None yet.</p>') +
      '<div class="row mt6"><button class="btn sm" data-act="addhere" data-t="ppl">＋ Person</button><button class="btn sm" data-act="addhere" data-t="plc">＋ Place</button></div>';
  } else {
    h += '<h3>Topics</h3>' + (rs.tds.length ? '<div class="list">' + rs.tds.map(function (e) { return rowHtml(e, true); }).join('') + '</div>' : '<p class="muted small">No topics tagged with ' + esc(c) + ' yet.</p>') +
      '<h3>Books</h3>' + (rs.bks.length ? '<div class="list">' + rs.bks.map(function (e) { return rowHtml(e, true); }).join('') + '</div>' : '<p class="muted small">No books tagged yet.</p>') +
      '<div class="row mt6"><button class="btn sm pri" data-act="addhere" data-t="todo">＋ Topic</button><button class="btn sm" data-act="addhere" data-t="book">＋ Book</button></div>' +
      noteBox('cn-' + slug(c), 'Overview, themes, what to read next', 'My notes on ' + c) +
      (noted.length ? '<h3>Your notes on its history</h3><div class="list">' + noted.map(function (e) { return rowHtml(e, true); }).join('') + '</div>' : '');
  }
  v.innerHTML = h + '</div>';
  if (t === 'ov') mountMap(c);
}
function renderArea(v) {
  var A = areaGet(S.pa); if (!A) { S.pa = null; return renderCO(); }
  var cs = A.countries, inA = function (i) { return cs.indexOf(i.country) > -1; };
  var rs = researchFor(function (i) { return i.area === A.name; });
  var evs = allItems().filter(function (i) { return i.type === 'evt' && i.tier === 1 && inA(i); }).sort(function (a, b) { return a.start - b.start; });
  var pp = allItems().filter(function (i) { return (i.type === 'ppl' || i.type === 'plc') && inA(i); });
  var shown = S.aAll ? evs : evs.slice(0, 12);
  v.innerHTML = '<div class="pad"><button class="btn sm" data-act="coback">← Countries</button>' +
    '<h2 style="margin-top:12px">📍 ' + esc(A.name) + '</h2><span class="tag" style="--rc:var(--r-' + A.region + ')">' + (A.custom ? 'Your region' : 'Region across borders') + ' · ' + esc(regName(A.region)) + '</span>' +
    (A.why ? '<div class="about"><span class="lbl">' + (A.custom ? 'Your description' : 'From the atlas') + '</span><p>' + esc(A.why) + '</p></div>' : '') +
    '<h3>Spans ' + cs.length + (cs.length === 1 ? ' country' : ' countries') + '</h3><div class="cgrid">' + cs.map(countryCard).join('') + '</div>' +
    (A.custom ? '' : '<p class="muted tiny">Borders of historical and cultural regions are fuzzy; these are the countries most of it lies in today.</p>') +
    '<div class="row mt6"><button class="btn sm pri" data-act="todoarea" data-t="todo">＋ Topic about ' + esc(A.name) + '</button><button class="btn sm" data-act="todoarea" data-t="book">＋ Book</button>' +
    (A.custom ? '<button class="btn sm" data-act="editarea">Edit</button><button class="btn sm del" data-act="delarea">Delete region</button>' : '') + '</div>' +
    noteBox('an-' + slug(A.name), 'What ties this region together, questions, reading', 'My notes on ' + A.name) +
    '<h3>My research</h3>' + (rs.tds.length + rs.bks.length ? '<div class="list">' + rs.tds.concat(rs.bks).map(function (e) { return rowHtml(e, true); }).join('') + '</div>' : '<p class="muted small">No topics or books tagged with ' + esc(A.name) + ' yet.</p>') +
    '<h3>Key events in these countries</h3>' + (evs.length ? '<div class="list">' + shown.map(function (e) { return rowHtml(e, true, ' <span class="s">' + flagOf(e.country) + '</span>'); }).join('') + '</div>' + (evs.length > 12 ? '<button class="btn sm mt6" data-act="aall">' + (S.aAll ? 'Show fewer' : 'Show all ' + evs.length) + '</button>' : '') : '<p class="muted small">None yet.</p>') +
    (pp.length ? '<h3>People and places</h3><div class="list">' + pp.map(function (e) { return rowHtml(e, true); }).join('') + '</div>' : '') + '</div>';
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

/* ---------- "Where?" picker: tag countries, or a region across borders that fills in its countries ---------- */
/* The Library quick-add and the Add form each have a picker; only the one on the visible screen is used. */
function wp$(sel) { return $(sel, $('#v-' + S.tab)); }
function wpHtml(ph) {
  return '<div id="wp"><div id="wpchips">' + wpChips() + '</div><input id="wpq" type="search" placeholder="' + (ph || 'Where? A country or region, e.g. Kurdistan') + '" aria-label="Tag a country or region" autocomplete="off"><div id="wpres" class="res"></div></div>';
}
function wpChips() {
  var W = S.wp, A = W.area && areaGet(W.area), h = '';
  if (A) h += '<p class="wpinfo"><b>' + esc(A.name) + '</b>: ' + esc(A.why) + ' Tagged with the countries it spans today; remove any that don\'t apply.</p>';
  h += '<div class="lk-chips">' + (W.area ? '<span class="lk-chip">📍 ' + esc(W.area) + '<button class="x" data-wpx="a" aria-label="Remove ' + esc(W.area) + '">×</button></span>' : '') +
    W.countries.map(function (c) { return '<span class="lk-chip">' + flagOf(c) + ' ' + esc(c) + '<button class="x" data-wpx="c" data-v="' + esc(c) + '" aria-label="Remove ' + esc(c) + '">×</button></span>'; }).join('') + '</div>';
  return h;
}
function wpSync() { if (S.tab === 'ad' && S.add) { S.add.area = S.wp.area; S.add.countries = S.wp.countries.slice(); S.add.country = S.wp.countries[0] || ''; } var c = wp$('#wpchips'); if (c) c.innerHTML = wpChips(); }
function wpFill() {
  var box = wp$('#wpres'), q = (wp$('#wpq') || {}).value; if (!box) return;
  q = (q || '').trim().toLowerCase(); if (!q) { box.innerHTML = ''; return; }
  var ar = S.tab === 'ad' && S.add && S.add.type === 'area' ? [] : areaList().filter(function (a) { return a.name.toLowerCase().indexOf(q) > -1; }).slice(0, 4);
  var cs = Object.keys(REGOF).filter(function (c) { return c.toLowerCase().indexOf(q) > -1 && S.wp.countries.indexOf(c) < 0; }).slice(0, 6);
  box.innerHTML = ar.map(function (a) { return '<button data-wpa="' + esc(a.name) + '">📍 ' + esc(a.name) + ' <span class="muted">· region: ' + esc(a.countries.join(', ')) + '</span></button>'; }).join('') +
    cs.map(function (c) { return '<button data-wpc="' + esc(c) + '">' + flagOf(c) + ' ' + esc(c) + '</button>'; }).join('') ||
    '<span class="muted small" style="padding:6px 2px">No match. You can add your own region with the ＋ button.</span>';
}
function wpPick(el) {
  var W = S.wp;
  if (el.dataset.wpa) { var A = areaGet(el.dataset.wpa); W.area = A.name; A.countries.forEach(function (c) { if (W.countries.indexOf(c) < 0) W.countries.push(c); }); }
  else if (el.dataset.wpc) { if (W.countries.indexOf(el.dataset.wpc) < 0) W.countries.push(el.dataset.wpc); }
  else if (el.dataset.wpx === 'a') { var B = areaGet(W.area); if (B) W.countries = W.countries.filter(function (c) { return B.countries.indexOf(c) < 0; }); W.area = ''; }
  else if (el.dataset.wpx === 'c') W.countries = W.countries.filter(function (c) { return c !== el.dataset.v; });
  var q = wp$('#wpq'); if (q && !el.dataset.wpx) { q.value = ''; q.focus(); }
  wpFill(); wpSync();
}
function wpRegion() { var W = S.wp, A = W.area && areaGet(W.area); return A ? A.region : W.countries.length ? REGOF[W.countries[0]] : ''; }

/* ---------- library ---------- */
function dueCount() { return dueCards(universe()).length; }
function renderLib() {
  var v = $('#v-pp'), q = S.lq.trim();
  var h = '<div class="pad"><h2>Library</h2><input id="libq" type="search" placeholder="Search topics, books, notes, history, countries…" value="' + esc(S.lq) + '" aria-label="Search your library">';
  if (q) { v.innerHTML = h + searchHtml(q.toLowerCase()) + '</div>'; return; }
  var ci = customItems();
  var cont = ci.filter(function (i) { return (i.type === 'todo' || i.type === 'book') && doc(i.id).r === 1; }).sort(function (a, b) { return idTime(b.id) - idTime(a.id); }).slice(0, 4);
  var recent = S.recent.filter(function (r) { return r.k === 'i' && getItem(r.id); }).slice(0, 6);
  var due = dueCount();
  h += '<div class="dash">' +
    (cont.length ? '<div class="dash-c"><span class="lbl">Exploring now</span>' + cont.map(function (i) { return '<button class="dcard" data-open="' + i.id + '"><span>' + (i.type === 'book' ? '📖' : '🔎') + '</span><b>' + esc(i.title) + '</b>' + (i.type === 'todo' && subtopics(i.id).length ? '<small>' + subtopics(i.id).filter(function (s) { return doc(s.id).r === 2; }).length + ' of ' + subtopics(i.id).length + ' questions done</small>' : i.author ? '<small>' + esc(i.author) + '</small>' : '') + '</button>'; }).join('') + '</div>' : '') +
    (recent.length ? '<div class="dash-c"><span class="lbl">Recently viewed</span><div class="lk-chips">' + recent.map(function (r) { return chip(r.id, false); }).join('') + '</div></div>' : '') +
    (due ? '<button class="duebtn" data-tab="rv">🗂 ' + due + ' review card' + (due === 1 ? '' : 's') + ' due →</button>' : '') + '</div>';
  var L = S.lib;
  h += '<div class="seg lseg">' + [['todo', 'Topics'], ['book', 'Books'], ['ppl', 'People'], ['plc', 'Places']].map(function (x) { return '<button data-lib="' + x[0] + '" aria-pressed="' + (L === x[0]) + '">' + x[1] + '</button>'; }).join('') + '</div>';
  if (L === 'todo') {
    var tops = ci.filter(function (i) { return i.type === 'todo' && !i.parent; });
    h += '<div class="qcard"><input id="qt" type="text" placeholder="A topic to explore, e.g. The Yazidis" value="' + esc(S.qt.t) + '" autocomplete="off" aria-label="New topic">' +
      '<input id="qtw" type="text" placeholder="Why it interests you (optional)" value="' + esc(S.qt.w) + '" autocomplete="off" aria-label="Why it interests you">' +
      wpHtml('Where? (optional) A country or region') + '<div class="row"><button class="btn pri" data-act="qtadd">Save topic</button><span class="muted tiny">Add questions, books and notes after.</span></div></div>';
    h += groupList(tops, ['Exploring now', 'To explore', 'Explored'], [1, 0, 2], 'No topics yet. Save the first thing you want to understand better.');
  } else if (L === 'book') {
    var bks = ci.filter(function (i) { return i.type === 'book'; });
    h += '<div class="qcard"><input id="qb" type="text" placeholder="Book title" value="' + esc(S.qb.t) + '" autocomplete="off" aria-label="Book title"><input id="qba" type="text" placeholder="Author (optional)" value="' + esc(S.qb.a) + '" autocomplete="off" aria-label="Author">' +
      '<div class="row"><button class="btn pri" data-act="qbadd">Save book</button><span class="muted tiny">Link it to topics and history after.</span></div></div>';
    h += groupList(bks, ['Reading', 'Want to read', 'Read'], [1, 0, 2], 'No books yet. Save one you come across.');
  } else {
    var list = allItems().filter(function (i) { return i.type === L; });
    list.sort(function (a, b) { return L === 'ppl' ? a.start - b.start : a.title.localeCompare(b.title); });
    h += '<div class="row mt6"><button class="btn sm pri" data-act="addt" data-t="' + L + '">＋ Add a ' + (L === 'ppl' ? 'person' : 'place') + '</button></div><div class="list">' + list.map(function (i) { return rowHtml(i, true, i.country ? ' <span class="s">' + flagOf(i.country) + '</span>' : ''); }).join('') + '</div>';
  }
  v.innerHTML = h + '</div>';
}
function groupList(items, names, order, empty) {
  if (!items.length) return '<p class="muted">' + empty + '</p>';
  items.sort(function (a, b) { return idTime(b.id) - idTime(a.id); });
  return order.map(function (r, k) {
    var g = items.filter(function (i) { return (doc(i.id).r || 0) === r; }); if (!g.length) return '';
    return '<h3>' + names[k] + ' · ' + g.length + '</h3><div class="list">' + g.map(function (i) { return rowHtml(i, true); }).join('') + '</div>';
  }).join('');
}
/* Library search: your topics, books and notes first, then the atlas's history, countries and regions. */
function searchHtml(q) {
  var hit = function (s) { return String(s || '').toLowerCase().indexOf(q) > -1; };
  var snip = function (s) { s = String(s || ''); var i = s.toLowerCase().indexOf(q); if (i < 0) return ''; var a = Math.max(0, i - 40); return (a ? '…' : '') + s.slice(a, i + q.length + 60) + (i + q.length + 60 < s.length ? '…' : ''); };
  var groups = [['Topics and questions', []], ['Books', []], ['In your notes', []], ['Events and eras', []], ['People', []], ['Places', []]];
  var G = { todo: 0, book: 1, evt: 3, emp: 3, ppl: 4, plc: 5 };
  allItems().forEach(function (i) {
    var base = hit(i.title) || hit(i.why) || hit(i.who) || hit(i.author) || hit(i.country) || hit(i.area);
    var inNote = hit(doc(i.id).n);
    if (base) groups[G[i.type]][1].push(rowHtml(i, true));
    else if (inNote) groups[2][1].push(rowHtml(i, true, '<br><span class="s snip">✎ ' + esc(snip(doc(i.id).n)) + '</span>'));
  });
  S.docs.forEach(function (d, k) {
    if (!d || !d.n || !hit(d.n)) return;
    if (k.indexOf('cn-') === 0) { var c = Object.keys(REGOF).find(function (x) { return 'cn-' + slug(x) === k; }); if (c) groups[2][1].push('<div class="li" role="button" tabindex="0" data-country="' + esc(c) + '"><span class="fl">' + flagOf(c) + '</span><span class="lit"><span class="t">Notes on ' + esc(c) + '</span><br><span class="s snip">✎ ' + esc(snip(d.n)) + '</span></span></div>'); }
    if (k.indexOf('an-') === 0) { var A = areaList().find(function (a) { return 'an-' + slug(a.name) === k; }); if (A) groups[2][1].push('<div class="li" role="button" tabindex="0" data-area="' + esc(A.name) + '"><span class="fl">📍</span><span class="lit"><span class="t">Notes on ' + esc(A.name) + '</span><br><span class="s snip">✎ ' + esc(snip(d.n)) + '</span></span></div>'); }
  });
  var cs = Object.keys(REGOF).filter(function (c) { return hit(c); }).slice(0, 12), ar = areaList().filter(function (a) { return hit(a.name) || hit(a.why); });
  var h = groups.map(function (g) {
    if (!g[1].length) return ''; var more = g[1].length - 10;
    return '<h3>' + g[0] + ' · ' + g[1].length + '</h3><div class="list">' + g[1].slice(0, 10).join('') + '</div>' + (more > 0 ? '<p class="muted tiny">and ' + more + ' more; try a longer search</p>' : '');
  }).join('') +
    (ar.length || cs.length ? '<h3>Countries and regions</h3><div class="lk-chips">' + ar.map(function (a) { return '<button class="lk-chip" data-area="' + esc(a.name) + '">📍 ' + esc(a.name) + '</button>'; }).join('') + cs.map(function (c) { return '<button class="lk-chip" data-country="' + esc(c) + '">' + flagOf(c) + ' ' + esc(c) + '</button>'; }).join('') + '</div>' : '');
  return h || '<p class="muted mt6">Nothing found for “' + esc(q) + '”. <button class="lnkbtn" data-act="qfromsearch">Save it as a topic to explore</button></p>';
}
function quickSave(type) {
  var t = type === 'todo' ? S.qt.t.trim() : S.qb.t.trim();
  if (!t) { var el = $(type === 'todo' ? '#qt' : '#qb'); if (el) el.focus(); return; }
  var id = newId(), W = S.wp;
  if (type === 'todo') upd(id, function (d) { d.c = { type: 'todo', title: t, why: S.qt.w.trim(), country: W.countries[0] || '', countries: W.countries.slice(), area: W.area, region: wpRegion(), tier: 1, who: '', start: null, end: null }; });
  else upd(id, function (d) { d.c = { type: 'book', title: t, author: S.qb.a.trim(), why: '', url: '', country: '', countries: [], area: '', region: '', tier: 1, who: '', start: null, end: null }; });
  S.qt = { t: '', w: '' }; S.qb = { t: '', a: '' }; S.wp = { area: '', countries: [] };
  toast(type === 'todo' ? 'Topic saved' : 'Book saved'); renderLib(); openSheet(id);
}

/* ---------- review ---------- */
var INT = [0, 1, 3, 7, 21, 60];
/* Card keys w, h, y, p, l are the original ones (their schedules are kept). The rest were added later. */
var QGROUP = { w: 'dates', y: 'what', h: 'who', p: 'who', g: 'where', gc: 'where', sig: 'why', l: 'why', o: 'order', m: 'elsewhere', x: 'links' };
var QNAMES = [['dates', 'Dates'], ['what', 'What happened'], ['who', 'Who'], ['where', 'Where'], ['why', 'Why it mattered'], ['order', 'Which came first'], ['elsewhere', 'Elsewhere in the world'], ['links', 'Connections']];
var nextInCountry = null;
function buildNext() {
  nextInCountry = {}; var by = {};
  allItems().forEach(function (i) { if (i.type === 'evt' && i.tier === 1 && i.country) (by[i.country] = by[i.country] || []).push(i); });
  Object.keys(by).forEach(function (c) { var l = by[c].sort(function (a, b) { return a.start - b.start; }); for (var k = 0; k < l.length - 1; k++) { var n = l.slice(k + 1).find(function (x) { return x.start - l[k].start >= 3; }); if (n) nextInCountry[l[k].id] = n; } });
}
function cardsFor(it) {
  var out = [], fl = it.country ? flagOf(it.country) + ' ' + it.country : '', where = it.country || regName(it.region);
  if (it.type === 'evt') {
    out.push({ id: it.id, k: 'w', q: 'When did this happen?', big: it.title, sub: fl, a: '<b>' + esc(fy(it.start)) + '</b> · ' + era(it.start), a2: it.why + (it.who ? ' Involved: ' + it.who : '') });
    if (it.who) out.push({ id: it.id, k: 'h', q: 'Who or what was involved?', big: it.title, sub: fl + ' · ' + fy(it.start), a: esc(it.who), a2: it.why });
    if (it.tier === 1) out.push({ id: it.id, k: 'y', q: 'What happened in ' + where + ' in ' + fy(it.start) + '?', big: '', sub: '', a: '<b>' + esc(it.title) + '</b>', a2: it.why });
    if (it.country) out.push({ id: it.id, k: 'g', q: 'Where did this happen?', big: it.title, sub: fy(it.start), a: '<b>' + flagOf(it.country) + ' ' + esc(it.country) + '</b> · ' + esc(regName(it.region)), a2: it.why });
    if (it.why && it.why.length > 25) out.push({ id: it.id, k: 'sig', q: 'Why did this matter?', big: it.title, sub: fl + ' · ' + fy(it.start), a: '', a2: it.why });
    var nx = it.tier === 1 && nextInCountry[it.id];
    if (nx) { var flip = (it.id.length + nx.id.length) % 2; out.push({ id: it.id, k: 'o', q: 'Which came first?', big: flip ? nx.title + '  or  ' + it.title : it.title + '  or  ' + nx.title, sub: fl, a: '<b>' + esc(it.title) + '</b> (' + esc(fy(it.start)) + '), then ' + esc(nx.title) + ' (' + esc(fy(nx.start)) + ')', a2: '', rel: [nx.id] }); }
    if (it.tier === 1) {
      var ew = elsewhere(it).filter(function (g) { return g.items.some(function (i) { return i.type === 'emp'; }); });
      if (ew.length) { var G = ew[it.start % ew.length < 0 ? 0 : Math.abs(it.start) % ew.length], sp = G.items.filter(function (i) { return i.type === 'emp'; });
        out.push({ id: it.id, k: 'm', q: 'When this happened, what was flourishing in ' + G.r.name + '?', big: it.title, sub: fl + ' · ' + fy(it.start), a: sp.map(function (i) { return '<b>' + esc(i.title) + '</b> <span class="muted">(' + esc(yearLine(i)) + ')</span>'; }).join('<br>'), a2: '', rel: sp.map(function (i) { return i.id; }) }); }
    }
  } else if (it.type === 'emp') {
    out.push({ id: it.id, k: 'w', q: 'When was this?', big: it.title, sub: '', a: '<b>' + esc(yearLine(it)) + '</b>', a2: it.why });
    if (it.why && it.why.length > 25) out.push({ id: it.id, k: 'sig', q: 'What is this known for?', big: it.title, sub: yearLine(it), a: '', a2: it.why });
  } else if (it.type === 'ppl') {
    out.push({ id: it.id, k: 'p', q: 'Who was this person?', big: it.title, sub: fl, a: '<b>' + esc(yearLine(it)) + '</b>', a2: it.why });
    if (it.country) out.push({ id: it.id, k: 'g', q: 'Where is this person from?', big: it.title, sub: yearLine(it), a: '<b>' + flagOf(it.country) + ' ' + esc(it.country) + '</b>', a2: '' });
  } else if (it.type === 'plc') {
    out.push({ id: it.id, k: 'l', q: 'What is this place known for?', big: it.title, sub: fl, a: esc(it.why), a2: '' });
    if (it.country) out.push({ id: it.id, k: 'gc', q: 'Which country is this in today?', big: it.title, sub: '', a: '<b>' + flagOf(it.country) + ' ' + esc(it.country) + '</b>', a2: it.why });
  }
  var ln = (it.type === 'evt' || it.type === 'emp' || it.type === 'ppl' || it.type === 'plc') ? linksOf(it.id).filter(function (x) { var o = getItem(x); return o.type !== 'todo' && o.type !== 'book'; }) : [];
  if (ln.length) out.push({ id: it.id, k: 'x', q: 'What is this connected to?', big: it.title, sub: fl, a: ln.slice(0, 5).map(function (x) { return esc(getItem(x).title); }).join(' · '), a2: '', rel: ln.slice(0, 5) });
  return out.filter(function (c) { return S.rvset.q[QGROUP[c.k]] !== false; });
}
function cardState(c) { var s = (doc(c.id).s || {})[c.k]; return !s ? 'new' : s.due <= Date.now() ? (s.b === 0 ? 'missed' : 'due') : (s.b === 0 ? 'missed-later' : 'later'); }
function dueCards(cards) { return cards.filter(function (c) { var st = cardState(c); return st !== 'later' && st !== 'missed-later'; }); }
function scopeItems() {
  var st = S.rvset, sc = st.scope;
  return allItems().filter(function (i) {
    if (i.type === 'todo' || i.type === 'book') return false;
    var kind = i.type === 'emp' ? 'evt' : i.type; if (!st.types[kind]) return false;
    if (i.type === 'evt' && i.tier !== 1 && !st.detail) return false;
    if (sc === 'read') return doc(i.id).r >= 1 || doc(i.id).n;
    if (sc.indexOf('c:') === 0) return i.country === sc.slice(2);
    if (sc.indexOf('a:') === 0) { var A = areaGet(sc.slice(2)); return !!A && A.countries.indexOf(i.country) > -1; }
    return true;
  });
}
function universe() { if (!nextInCountry) buildNext(); var cards = []; scopeItems().forEach(function (i) { cards = cards.concat(cardsFor(i)); }); return cards; }
function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
function startSession(mode) {
  var all = universe(), pool;
  if (mode === 'missed') pool = all.filter(function (c) { var s = cardState(c); return s === 'missed' || s === 'missed-later'; });
  else if (mode === 'any') pool = all;
  else pool = dueCards(all);
  if (!pool.length) { toast('Nothing to review with these settings'); return; }
  /* Mix: cards already seen and due first, then new ones. */
  var seen = shuffle(pool.filter(function (c) { return cardState(c) !== 'new'; })), fresh = shuffle(pool.filter(function (c) { return cardState(c) === 'new'; }));
  S.rv = { cards: seen.concat(fresh).slice(0, 12), i: 0, show: false, got: 0, missed: [], extra: false };
  renderRV();
}
function renderRV() {
  var v = $('#v-rv'), R = S.rv;
  if (!R) {
    var st = S.rvset, all = universe(), c = { due: 0, 'new': 0, missed: 0, later: 0 };
    all.forEach(function (x) { var s = cardState(x); if (s === 'due') c.due++; else if (s === 'new') c['new']++; else if (s === 'missed' || s === 'missed-later') c.missed++; else c.later++; });
    var sc = st.scope;
    v.innerHTML = '<div class="pad"><h2>Review</h2><p class="muted small" style="margin:0 0 8px">Recall first, then check. Cards you miss come back sooner; ones you know drift out to 1, 3, 7, 21 and 60 days.</p>' +
      '<div class="stats"><div><b>' + c.due + '</b><span>due</span></div><div><b>' + c['new'] + '</b><span>new</span></div><div><b>' + c.missed + '</b><span>missed</span></div><div><b>' + c.later + '</b><span>learned</span></div></div>' +
      '<div class="row mt6"><button class="btn pri" data-act="rvstart">Start · up to 12 cards</button>' + (c.missed ? '<button class="btn" data-act="rvmissed">Practise missed</button>' : '') + (!c.due && !c['new'] && all.length ? '<button class="btn" data-act="rvforce">Practise anyway</button>' : '') + '</div>' +
      '<h3>Subject</h3><select id="rv-scope"><option value="read"' + (sc === 'read' ? ' selected' : '') + '>Things I’ve marked as read or noted</option><option value="all"' + (sc === 'all' ? ' selected' : '') + '>Everything in the atlas</option>' +
      '<optgroup label="Regions across borders">' + areaList().map(function (a) { var val = 'a:' + a.name; return '<option value="' + esc(val) + '"' + (sc === val ? ' selected' : '') + '>📍 ' + esc(a.name) + '</option>'; }).join('') + '</optgroup>' +
      REG.map(function (r) { return '<optgroup label="' + esc(r.name) + '">' + CO[r.id].map(function (cc) { var val = 'c:' + cc; return '<option value="' + esc(val) + '"' + (sc === val ? ' selected' : '') + '>' + esc(cc) + '</option>'; }).join('') + '</optgroup>'; }).join('') + '</select>' +
      '<div class="row mt6"><button class="chip" data-rvt="evt" aria-pressed="' + st.types.evt + '">Events and eras</button><button class="chip" data-rvt="ppl" aria-pressed="' + st.types.ppl + '">People</button><button class="chip" data-rvt="plc" aria-pressed="' + st.types.plc + '">Places</button><button class="chip" data-rvt="detail" aria-pressed="' + st.detail + '">Include detail events</button></div>' +
      '<h3>Question types</h3><div class="row">' + QNAMES.map(function (q) { return '<button class="chip" data-rvq="' + q[0] + '" aria-pressed="' + (st.q[q[0]] !== false) + '">' + q[1] + '</button>'; }).join('') + '</div>' +
      (!all.length ? '<p class="muted">Nothing here yet. Mark things as read or add notes, or choose Everything.</p>' : '<p class="muted tiny mt6">' + all.length + ' cards with these settings.</p>') + '</div>';
    return;
  }
  if (R.i >= R.cards.length) {
    if (R.missed.length && !R.extra) { R.cards = R.cards.concat(R.missed); R.missed = []; R.extra = true; }
    else { v.innerHTML = '<div class="pad"><h2>Done</h2><p>You got <b>' + R.got + '</b> of ' + R.cards.length + ' right.</p><div class="row"><button class="btn pri" data-act="rvagain">Another round</button><button class="btn" data-act="rvexit">Back to review</button></div></div>'; return; }
  }
  var c = R.cards[R.i], it = getItem(c.id), d = doc(c.id);
  if (!it) { R.i++; return renderRV(); }
  var rel = (c.rel || []).concat(linksOf(c.id).filter(function (x) { return (c.rel || []).indexOf(x) < 0; }).slice(0, 4));
  v.innerHTML = '<div class="pad"><div class="row" style="justify-content:space-between"><span class="muted">' + (R.i + 1) + ' of ' + R.cards.length + (cardState(c) === 'new' ? ' · new card' : '') + '</span><button class="btn sm" data-act="rvexit">End</button></div>' +
    '<div class="card"><div class="q">' + esc(c.q) + '</div>' + (c.big ? '<div class="big">' + esc(c.big) + '</div>' : '') + (c.sub ? '<div class="muted">' + esc(c.sub) + '</div>' : '') +
    (R.show ? '<div class="ans">' + c.a + (c.a2 ? '<p style="margin:8px 0 0">' + esc(c.a2) + '</p>' : '') + (d.n ? '<div class="mynote"><span class="lbl">✎ My notes</span>' + esc(d.n) + '</div>' : '') +
      '<div class="lk-chips mt6">' + chip(c.id, false) + rel.map(function (x) { return chip(x, false); }).join('') + '</div></div>' : '') + '</div>' +
    (R.show ? '<div class="row"><button class="btn" data-act="rvmiss">Missed it</button><button class="btn pri" data-act="rvgot">Got it</button></div>' : '<button class="btn pri" data-act="rvshow">Show answer</button>') + '</div>';
}
function grade(ok) {
  var R = S.rv, c = R.cards[R.i], now = Date.now();
  upd(c.id, function (d) { d.s = d.s || {}; var b = (d.s[c.k] || { b: 0 }).b; b = ok ? Math.min(b + 1, 5) : 0; d.s[c.k] = { b: b, due: now + INT[b] * DAY }; });
  if (ok) R.got++; else if (!R.extra) R.missed.push(c);
  R.i++; R.show = false; renderRV();
}

/* ---------- add menu and form ---------- */
var ADDS = [['todo', '🔎', 'Topic to explore', 'Something you want to understand better. No date needed.'], ['book', '📖', 'Book', 'One you want to read, are reading or have read.'], ['evt', '◆', 'Event', 'A moment in history, with a year.'], ['emp', '▬', 'Empire, era or war', 'Anything with a start and end year.'], ['ppl', '👤', 'Person', 'With birth and death years.'], ['plc', '📍', 'Place', 'A city, site or landmark.'], ['area', '🗺', 'Region across borders', 'Like Kurdistan or Melanesia.']];
function openAddMenu() {
  var m = $('#addmenu'), ctx = addCtx();
  m.innerHTML = '<div class="sh-grab" aria-hidden="true"></div><div class="sh-h"><b class="am-t">Add to your atlas</b><button class="btn sm" data-act="amclose">Close</button></div>' + (ctx.label ? '<p class="muted small" style="margin:0 0 6px">Will be tagged with ' + esc(ctx.label) + '</p>' : '') +
    '<div class="am">' + ADDS.map(function (a) { return '<button data-addt="' + a[0] + '"><span class="am-i">' + a[1] + '</span><span><b>' + a[2] + '</b><small>' + a[3] + '</small></span></button>'; }).join('') + '</div>';
  m.classList.add('on'); $('#scrim').classList.add('on');
}
function closeAddMenu() { $('#addmenu').classList.remove('on'); if (!$('#sheet').classList.contains('on')) $('#scrim').classList.remove('on'); }
/* What you're looking at decides the default tags: a country page, a region page, or an open topic. */
function addCtx() {
  if (S.tab === 'co' && S.pc) return { label: S.pc, country: S.pc, countries: [S.pc], region: REGOF[S.pc] };
  if (S.tab === 'co' && S.pa) { var A = areaGet(S.pa); if (A) return { label: A.name, area: A.name, countries: A.countries.slice(), country: A.countries[0], region: A.region }; }
  return {};
}
function startAdd(type, extra) {
  var ctx = addCtx(), sel = $('#sheet').classList.contains('on') ? getItem(S.sel) : null;
  S.add = Object.assign({ type: type, tier: 1, region: ctx.region || 'eu', country: type === 'area' ? '' : ctx.country || '', countries: type === 'area' ? [] : (ctx.countries || []), area: type === 'area' ? '' : ctx.area || '' }, extra || {});
  if (sel && (type === 'book' || type === 'todo')) S.add.linkTo = sel.id;
  S.edit = null; closeAddMenu(); closeSheet(true); go('ad');
}
function yearField(id, label, v) {
  var neg = v != null && v < 0;
  return '<label for="' + id + '">' + label + '</label><div class="row" style="flex-wrap:nowrap"><input id="' + id + '" type="number" inputmode="numeric" min="1" placeholder="e.g. 1953" value="' + (v == null ? '' : Math.abs(v)) + '"><select id="' + id + '-e" style="width:96px" aria-label="' + label + ' era"><option' + (neg ? '' : ' selected') + '>CE</option><option' + (neg ? ' selected' : '') + '>BCE</option></select></div>';
}
function readYear(id, opt) {
  var n = parseInt($('#' + id).value, 10); if (isNaN(n)) return opt ? null : NaN;
  return $('#' + id + '-e').value === 'BCE' ? -Math.abs(n) : Math.abs(n);
}
function renderAD() {
  var v = $('#v-ad'), a = S.add || { type: 'todo', country: '', region: 'eu', tier: 1 }; S.add = a;
  var t = a.type, tagged = t === 'todo' || t === 'book' || t === 'area', A = ADDS.find(function (x) { return x[0] === t; }) || ADDS[0];
  if (tagged) S.wp = { area: t === 'area' ? '' : a.area || '', countries: (a.countries || (a.country ? [a.country] : [])).slice() };
  var tops = customItems().filter(function (i) { return i.type === 'todo' && !i.parent && i.id !== S.edit; });
  var lt = a.linkTo && getItem(a.linkTo);
  v.innerHTML = '<div class="pad"><div class="row" style="justify-content:space-between"><h2>' + (S.edit ? 'Edit' : 'New') + ' ' + A[2].toLowerCase() + '</h2><button class="btn sm" data-act="cancel">Cancel</button></div>' +
    (S.edit ? '<label for="f-type">Type</label><select id="f-type">' + ADDS.filter(function (x) { return x[0] !== 'area'; }).map(function (x) { return '<option value="' + x[0] + '"' + (t === x[0] ? ' selected' : '') + '>' + x[2] + '</option>'; }).join('') + '</select>' : '<input type="hidden" id="f-type" value="' + t + '">') +
    (lt ? '<p class="wpinfo">Will be linked to ' + (lt.type === 'todo' ? '🔎 ' : '') + '<b>' + esc(lt.title) + '</b>.</p>' : '') +
    '<label for="f-title">' + (t === 'ppl' ? 'Name' : t === 'area' ? 'Region name' : t === 'todo' ? 'Topic or question' : 'Title') + '</label><input id="f-title" type="text" value="' + esc(a.title || '') + '" autocomplete="off">' +
    (t === 'book' ? '<label for="f-author">Author (optional)</label><input id="f-author" type="text" value="' + esc(a.author || '') + '" autocomplete="off">' : '') +
    (t === 'todo' && tops.length ? '<label for="f-parent">Part of a bigger topic? (optional)</label><select id="f-parent"><option value="">No, it’s a topic of its own</option>' + tops.map(function (x) { return '<option value="' + x.id + '"' + (a.parent === x.id ? ' selected' : '') + '>' + esc(x.title) + '</option>'; }).join('') + '</select>' : '') +
    '<label for="f-why">' + ({ plc: 'What it is known for', ppl: 'Who they were', todo: 'Why it interests you (optional)', book: 'Why you saved it (optional)', area: 'What it is (optional)' }[t] || 'Why it matters') + '</label><textarea id="f-why" style="min-height:70px">' + esc(a.why || '') + '</textarea>' +
    (t === 'book' ? '<label for="f-url">Link (optional)</label><input id="f-url" type="text" inputmode="url" value="' + esc(a.url || '') + '" placeholder="e.g. a review or shop page" autocomplete="off">' : '') +
    (t === 'area' ? '<label for="wpq">Countries it spans (type to add each one)</label>' + wpHtml('Type a country') :
      tagged ? '<label for="wpq">Where (optional): countries, or a region like Kurdistan that fills them in</label>' + wpHtml() :
      '<label for="f-country">Country (optional)</label><select id="f-country">' + countryOptions(a.country, 'No country (e.g. Assyria, the Silk Road)') + '</select>' +
      '<div id="f-regwrap"' + (a.country ? ' hidden' : '') + '><label for="f-region">Region (which timeline row it goes on)</label><select id="f-region">' + REG.map(function (r) { return '<option value="' + r.id + '"' + (a.region === r.id ? ' selected' : '') + '>' + esc(r.name) + '</option>'; }).join('') + '</select></div>') +
    (t === 'evt' ? yearField('f-y1', 'Year', a.start) : '') + (t === 'emp' ? yearField('f-y1', 'Start year', a.start) + yearField('f-y2', 'End year', a.end) : '') + (t === 'ppl' ? yearField('f-y1', 'Born', a.start) + yearField('f-y2', 'Died (leave blank if unknown or alive)', a.end) : '') +
    (t === 'evt' ? '<label for="f-who">Who or what was involved</label><input id="f-who" type="text" value="' + esc(a.who || '') + '"><label for="f-tier">How important</label><select id="f-tier"><option value="1"' + (a.tier === 1 ? ' selected' : '') + '>Key event</option><option value="2"' + (a.tier === 2 ? ' selected' : '') + '>Detail</option></select>' : '') +
    '<div id="f-err" class="err" role="alert"></div><div class="row" style="margin-top:16px"><button class="btn pri" data-act="save">Save</button><button class="btn" data-act="cancel">Cancel</button></div>' +
    (S.edit && t === 'todo' ? '<p class="muted tiny mt6">Found the date? Change the type to Event or Empire, era or war to put it on the timeline. Notes and links come with it.</p>' : '') + '</div>';
}
function saveArea(title, err) {
  if (!title) { err.textContent = 'Give the region a name.'; return; }
  var cs = S.wp.countries.slice(); if (!cs.length) { err.textContent = 'Add at least one country it spans.'; return; }
  var old = S.edit && customAreas().find(function (a) { return a.id === S.edit; });
  var clash = areaGet(title); if (clash && (!old || clash.id !== old.id)) { err.textContent = 'There is already a region called ' + title + '.'; return; }
  var id = S.edit || newId();
  upd(id, function (d) { d.c = { type: 'area', title: title, countries: cs, region: REGOF[cs[0]], why: $('#f-why').value.trim() }; });
  /* Renaming keeps topics tagged with the old name attached, and the region's notes. */
  if (old && old.name !== title) {
    S.docs.forEach(function (d, k) { if (d && d.c && d.c.area === old.name) upd(k, function (x) { x.c.area = title; }); });
    var on = doc('an-' + slug(old.name)).n; if (on) { upd('an-' + slug(title), function (x) { x.n = on; }); drop('an-' + slug(old.name)); }
  }
  S.edit = null; S.add = null; toast('Region saved');
  S.pc = null; S.pa = title; go('co'); $('#v-co').scrollTop = 0;
}
function saveEntry() {
  var t = $('#f-type').value, title = $('#f-title').value.trim(), err = $('#f-err');
  if (t === 'area') return saveArea(title, err);
  if (!title) { err.textContent = t === 'ppl' ? 'Add a name.' : 'Add a title.'; return; }
  var tagged = t === 'todo' || t === 'book';
  var countries = tagged ? S.wp.countries.slice() : [];
  var country = tagged ? (countries[0] || '') : $('#f-country').value;
  var c = { type: t, title: title, country: country, why: $('#f-why').value.trim(), tier: 1, who: '', start: null, end: null, region: '' };
  c.region = tagged ? (wpRegion() || '') : country ? REGOF[country] : $('#f-region').value;
  if (tagged) { c.countries = countries; c.area = S.wp.area; }
  if (t === 'todo' && $('#f-parent')) c.parent = $('#f-parent').value || '';
  else if (t === 'todo' && S.add.parent) c.parent = S.add.parent;
  if (t === 'book') { c.author = $('#f-author').value.trim(); c.url = $('#f-url').value.trim(); }
  if (t === 'evt') { c.start = readYear('f-y1'); c.who = $('#f-who').value.trim(); c.tier = parseInt($('#f-tier').value, 10); }
  if (t === 'emp' || t === 'ppl') { c.start = readYear('f-y1'); c.end = readYear('f-y2', true); }
  var dated = t === 'evt' || t === 'emp' || t === 'ppl';
  if (dated && (c.start == null || isNaN(c.start))) { err.textContent = 'Enter a valid year.'; return; }
  if (dated && (c.start < MIN || c.start > MAX)) { err.textContent = 'The timeline runs from 3500 BCE to 2030.'; return; }
  if (t === 'emp' && (c.end == null || isNaN(c.end) || c.end < c.start)) { err.textContent = 'Enter an end year after the start.'; return; }
  if (t === 'ppl' && c.end != null && (isNaN(c.end) || c.end < c.start)) { err.textContent = 'The year they died must be after they were born.'; return; }
  if (!tagged && !c.region) c.region = 'eu';
  var id = S.edit || newId(), linkTo = S.add && S.add.linkTo;
  upd(id, function (d) { d.c = c; });
  if (linkTo && !S.edit) link(linkTo, id);
  S.edit = null; S.add = null; nextInCountry = null; toast('Saved');
  if (t === 'evt' || t === 'emp') { showOnTimeline(getItem(id)); openSheet(id); }
  else { S.lib = t === 'todo' ? 'todo' : t === 'book' ? 'book' : t; S.lq = ''; go('pp'); openSheet(id); }
}

/* ---------- settings ---------- */
function renderSET() {
  var ci = customItems(), n = function (t) { return ci.filter(function (i) { return i.type === t; }).length; }, notes = 0; S.docs.forEach(function (d) { if (d && d.n) notes++; });
  $('#v-set').innerHTML = '<div class="pad"><div class="row" style="justify-content:space-between"><h2>Settings</h2><button class="btn sm" data-act="setclose">Done</button></div>' +
    '<h3>Appearance</h3><div class="seg">' + [['', 'Automatic'], ['light', 'Light'], ['dark', 'Dark']].map(function (x) { return '<button data-theme="' + x[0] + '" aria-pressed="' + (S.theme === x[0]) + '">' + x[1] + '</button>'; }).join('') + '</div>' +
    '<h3>Your atlas</h3><p class="small">' + n('todo') + ' topics and questions · ' + n('book') + ' books · ' + notes + ' notes · ' + (n('evt') + n('emp') + n('ppl') + n('plc')) + ' history entries · ' + customAreas().length + ' regions</p>' +
    '<h3>Backup and restore</h3><p class="muted small" style="margin:0 0 8px">Everything you add lives on this phone. Export a backup file now and then; import it to restore or move to a new phone. Old backup files still work.</p>' +
    '<div class="row"><button class="btn sm" data-act="export">Export backup</button><button class="btn sm" data-act="import">Import backup</button></div><input id="imp" type="file" accept="application/json,.json" hidden>' +
    '<p class="muted tiny" style="margin-top:24px">Timeline Atlas works offline once loaded. Dates before about 500 BCE are often approximate.</p></div>';
}
function exportBackup() {
  var o = {}; S.docs.forEach(function (v, k) { o[k] = v; });
  var blob = new Blob([JSON.stringify({ app: 'timeline-atlas', v: 2, saved: new Date().toISOString(), docs: o }, null, 1)], { type: 'application/json' });
  var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'timeline-atlas-backup-' + new Date().toISOString().slice(0, 10) + '.json';
  document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500); toast('Backup downloaded');
}
function importBackup(file) {
  var rd = new FileReader();
  rd.onload = function () {
    try { var j = JSON.parse(rd.result), d = j.docs || j, n = 0; Object.keys(d).forEach(function (k) { if (d[k] && typeof d[k] === 'object') { put(k, d[k]); n++; } }); nextInCountry = null; toast('Imported ' + n + ' entries'); renderCurrent(); }
    catch (e) { toast('That file is not a valid backup'); }
  };
  rd.readAsText(file);
}

/* ---------- navigation and events ---------- */
var VIEWS = ['tl', 'co', 'pp', 'rv', 'ad', 'set'];
function renderCurrent() {
  var t = S.tab;
  if (t === 'tl') renderTL(); else if (t === 'co') renderCO(); else if (t === 'pp') renderLib(); else if (t === 'rv') renderRV(); else if (t === 'ad') renderAD(); else renderSET();
  if (S.sel && $('#sheet').classList.contains('on') && !(document.activeElement && /^(TEXTAREA|INPUT)$/.test(document.activeElement.tagName))) renderSheet();
}
function refresh() { var a = document.activeElement; if (a && /^(TEXTAREA|INPUT|SELECT)$/.test(a.tagName)) return; renderCurrent(); }
function go(tab) {
  hidePop(); closeAddMenu();
  if (tab !== S.tab) { S.wp = { area: '', countries: [] }; if (S.tab !== 'ad' && S.tab !== 'set') S.prevTab = S.tab; }
  S.sel = null; S.hist = []; $('#sheet').classList.remove('on'); $('#scrim').classList.remove('on'); S.tab = tab;
  VIEWS.forEach(function (t) { $('#v-' + t).classList.toggle('on', t === tab); });
  document.querySelectorAll('#nav button').forEach(function (b) { b.setAttribute('aria-current', b.dataset.tab === tab ? 'true' : 'false'); });
  document.body.classList.toggle('in-form', tab === 'ad' || tab === 'set');
  if (tab !== 'ad' && S.edit) { S.edit = null; S.add = null; }
  if (tab === 'rv' && S.rv && S.rv.i >= S.rv.cards.length) S.rv = null;
  renderCurrent();
  $('#v-' + tab).scrollTop = 0;
}
function setRead(id, r) { upd(id, function (d) { d.r = r; }); renderCurrent(); if ($('#sheet').classList.contains('on')) renderSheet(); }
function cycleRead(id) { setRead(id, ((doc(id).r || 0) + 1) % 3); }
function openCountry(c) { S.pc = c; S.ctab = 'ov'; remember('c', c); closeSheet(true); go('co'); }
function openArea(n) { S.pa = n; S.pc = null; S.aAll = false; remember('a', n); closeSheet(true); go('co'); }
var noteTimer = null, noteSaving = null;
function onClick(e) {
  var t = e.target, el;
  if (t.id === 'scrim') { if ($('#addmenu').classList.contains('on')) closeAddMenu(); else closeSheet(); return; }
  if ((el = t.closest('[data-rd]'))) { e.stopPropagation(); cycleRead(el.dataset.rd); return; }
  if ((el = t.closest('[data-setr]'))) { setRead(el.dataset.sid, +el.dataset.setr); return; }
  if ((el = t.closest('[data-tab]'))) { go(el.dataset.tab); return; }
  if ((el = t.closest('[data-addt]'))) { startAdd(el.dataset.addt); return; }
  if ((el = t.closest('[data-wpa],[data-wpc],[data-wpx]'))) { wpPick(el); return; }
  if ((el = t.closest('[data-area]'))) { openArea(el.dataset.area); return; }
  if ((el = t.closest('[data-reg]'))) { tapRegion(el.dataset.reg); return; }
  if ((el = t.closest('[data-pre]'))) { var r = PRE[el.dataset.pre]; setRange(r[0], r[1]); renderTB(); return; }
  if ((el = t.closest('[data-theme]')) && el.closest('#v-set')) { S.theme = el.dataset.theme; applyTheme(); saveUI(); renderSET(); return; }
  if (t.closest('#pop')) { if ((el = t.closest('[data-act]'))) { if (el.dataset.act === 'popopen') { var pid = S.sel; hidePop(); openSheet(pid); } else if (el.dataset.act === 'popclose') { hidePop(); S.sel = null; renderTL(); } } return; }
  if ((el = t.closest('[data-id]'))) { if (el.closest('#lanes')) showPop(el.dataset.id); else openSheet(el.dataset.id); return; }
  if (!$('#pop').hidden && t.closest('#sc')) { hidePop(); S.sel = null; renderTL(); return; }
  if ((el = t.closest('[data-un]'))) {
    var o = el.dataset.un, me = S.sel;
    upd(me, function (d) { d.l = (d.l || []).filter(function (x) { return x !== o; }); });
    if (doc(o).l && doc(o).l.indexOf(me) > -1) upd(o, function (d) { d.l = d.l.filter(function (x) { return x !== me; }); });
    renderSheet(); if (S.tab === 'tl') renderTL(); return;
  }
  if ((el = t.closest('[data-lk]'))) { link(S.sel, el.dataset.lk); S.lkOpen = false; S.lkq = ''; renderSheet(); if (S.tab !== 'tl') renderCurrent(); return; }
  if ((el = t.closest('[data-mk]'))) { quickMake(el.dataset.mk, el.dataset.v); return; }
  if ((el = t.closest('[data-open]'))) {
    var inSheet = !!el.closest('#sheet'), oid = el.dataset.open;
    openSheet(oid, inSheet);
    if (S.tab === 'tl' && !inSheet) { var it = getItem(oid); if (it && it.start != null && (it.type === 'evt' || it.type === 'emp')) gotoYear(it.start); }
    return;
  }
  if ((el = t.closest('[data-country]'))) { openCountry(el.dataset.country); return; }
  if ((el = t.closest('[data-lib]'))) { S.lib = el.dataset.lib; S.wp = { area: '', countries: [] }; renderLib(); return; }
  if ((el = t.closest('[data-creg]'))) { S.creg = el.dataset.creg; S.cq = ''; renderCO(); $('#v-co').scrollTop = 0; return; }
  if ((el = t.closest('[data-ctab]'))) { S.ctab = el.dataset.ctab; renderCO(); return; }
  if ((el = t.closest('[data-rvt]'))) { var k = el.dataset.rvt; if (k === 'detail') S.rvset.detail = !S.rvset.detail; else S.rvset.types[k] = !S.rvset.types[k]; renderRV(); return; }
  if ((el = t.closest('[data-rvq]'))) { var qk = el.dataset.rvq; S.rvset.q[qk] = S.rvset.q[qk] === false; saveUI(); renderRV(); return; }
  if ((el = t.closest('[data-act]'))) {
    var a = el.dataset.act;
    if (a === 'close') closeSheet();
    else if (a === 'back') { var b = S.hist.pop(); if (b) { S.sel = b; S.lkOpen = false; renderSheet(); $('#sheet').scrollTop = 0; if (S.tab === 'tl') renderTL(); } }
    else if (a === 'fab') openAddMenu();
    else if (a === 'amclose') closeAddMenu();
    else if (a === 'settings') go('set');
    else if (a === 'setclose') go(S.prevTab || 'tl');
    else if (a === 'export') exportBackup();
    else if (a === 'import') $('#imp').click();
    else if (a === 'zi') zoom(1.6); else if (a === 'zo') zoom(1 / 1.6);
    else if (a === 'tf') { S.tfOpen = !S.tfOpen; renderTB(); renderTL(); }
    else if (a === 'tier') { S.tier = S.tier === 1 ? 2 : 1; saveUI(); renderTB(); renderTL(); }
    else if (a === 'emp') { S.emp = !S.emp; saveUI(); renderTB(); renderTL(); }
    else if (a === 'ev') { S.ev = !S.ev; saveUI(); renderTB(); renderTL(); }
    else if (a === 'linkopen') { S.lkOpen = true; S.lkType = el.dataset.lt || ''; renderSheet(); var q = $('#lq'); if (q) q.focus(); }
    else if (a === 'linkclose') { S.lkOpen = false; S.lkq = ''; renderSheet(); }
    else if (a === 'subadd') addSubtopic();
    else if (a === 'ontl') { var it2 = getItem(S.sel); if (it2) { closeSheet(true); showOnTimeline(it2); } }
    else if (a === 'coback') { if (S.pc) { if (!S.cq) S.creg = REGOF[S.pc] || S.creg; S.pc = null; } else { var A0 = areaGet(S.pa); if (A0 && !S.cq) S.creg = A0.region; S.pa = null; } renderCO(); $('#v-co').scrollTop = 0; }
    else if (a === 'addarea') startAdd('area');
    else if (a === 'editarea') { var E = areaGet(S.pa); S.edit = E.id; S.add = { type: 'area', title: E.name, countries: E.countries.slice(), why: E.why }; go('ad'); }
    else if (a === 'delarea') { if (el.dataset.sure) { var D = areaGet(S.pa); drop(D.id); S.pa = null; renderCO(); toast('Region deleted'); } else { el.dataset.sure = '1'; el.textContent = 'Tap again to delete'; } }
    else if (a === 'todoarea' || a === 'addhere' || a === 'addt') startAdd(el.dataset.t);
    else if (a === 'aall') { S.aAll = !S.aAll; renderCO(); }
    else if (a === 'qtadd') quickSave('todo');
    else if (a === 'qbadd') quickSave('book');
    else if (a === 'qfromsearch') { S.qt = { t: S.lq.trim(), w: '' }; S.lq = ''; S.lib = 'todo'; renderLib(); var qt = $('#qt'); if (qt) qt.focus(); }
    else if (a === 'rvhere') { S.rvset.scope = 'c:' + S.pc; S.rv = null; go('rv'); }
    else if (a === 'cftl') { S.cf = S.pc; go('tl'); showForItem({ region: REGOF[S.pc], type: 'evt' }); S.tfOpen = true; renderTB(); setRange(1500, 2030); }
    else if (a === 'edit') {
      var it3 = getItem(S.sel); if (!it3) return;
      S.edit = it3.id; S.add = { type: it3.type, country: it3.country, countries: it3.countries, area: it3.area, region: it3.region, title: it3.title, why: it3.why, who: it3.who, tier: it3.tier, start: it3.start, end: it3.end, parent: it3.parent, author: it3.author, url: it3.url };
      closeSheet(true); go('ad');
    }
    else if (a === 'del') {
      var id = S.sel; if (el.dataset.sure) { subtopics(id).forEach(function (s) { drop(s.id); }); drop(id); closeSheet(); nextInCountry = null; renderCurrent(); toast('Deleted'); }
      else { el.dataset.sure = '1'; el.textContent = 'Tap again to delete'; }
    }
    else if (a === 'save') saveEntry();
    else if (a === 'cancel') { var back = S.prevTab || 'pp'; S.edit = null; S.add = null; go(back); }
    else if (a === 'rvstart') startSession('due');
    else if (a === 'rvforce') startSession('any');
    else if (a === 'rvmissed') startSession('missed');
    else if (a === 'rvshow') { S.rv.show = true; renderRV(); }
    else if (a === 'rvgot') grade(true); else if (a === 'rvmiss') grade(false);
    else if (a === 'rvexit') { S.rv = null; renderRV(); }
    else if (a === 'rvagain') { S.rv = null; startSession('due'); }
  }
}
function keepFocus(sel, fn) { var el = $(sel), pos = el ? el.selectionStart : 0; fn(); var n = $(sel); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (x) {} } }
function onInput(e) {
  var t = e.target;
  if (t.classList.contains('nt')) {
    var id = t.dataset.nid, val = t.value, st = $('#ntst', t.closest('.note'));
    if (st) st.textContent = 'Saving…';
    clearTimeout(noteTimer); noteTimer = setTimeout(function () { upd(id, function (d) { d.n = val; }); if (st) st.textContent = 'Saved ✓'; }, 500);
    return;
  }
  if (t.closest && t.closest('#v-ad') && $('#f-err')) $('#f-err').textContent = '';
  if (t.id === 'lq') { S.lkq = t.value; fillRes(); }
  else if (t.id === 'wpq') wpFill();
  else if (t.id === 'qt') S.qt.t = t.value; else if (t.id === 'qtw') S.qt.w = t.value;
  else if (t.id === 'qb') S.qb.t = t.value; else if (t.id === 'qba') S.qb.a = t.value;
  else if (t.id === 'cq') { S.cq = t.value; keepFocus('#cq', renderCO); }
  else if (t.id === 'libq') { S.lq = t.value; keepFocus('#libq', renderLib); }
}
function onChange(e) {
  var t = e.target;
  if (t.id === 'imp') { if (t.files && t.files[0]) importBackup(t.files[0]); t.value = ''; }
  else if (t.id === 'cf') { S.cf = t.value; renderTB(); renderTL(); }
  else if (t.id === 'rv-scope') { S.rvset.scope = t.value; renderRV(); }
  else if (t.id === 'creg') { S.creg = t.value; renderCO(); $('#v-co').scrollTop = 0; }
  else if (t.id === 'f-type') {
    var a = S.add || {}; a.type = t.value;
    a.title = $('#f-title').value; a.why = $('#f-why').value;
    if ($('#f-region')) a.region = $('#f-region').value;
    if (wp$('#wp')) { a.countries = S.wp.countries.slice(); a.area = S.wp.area; a.country = a.countries[0] || ''; }
    else if ($('#f-country')) { a.country = $('#f-country').value; a.countries = a.country ? [a.country] : []; }
    if ($('#f-y1')) a.start = readYear('f-y1', true); if ($('#f-y2')) a.end = readYear('f-y2', true);
    if ($('#f-who')) a.who = $('#f-who').value; if ($('#f-tier')) a.tier = parseInt($('#f-tier').value, 10);
    if ($('#f-author')) a.author = $('#f-author').value; if ($('#f-url')) a.url = $('#f-url').value; if ($('#f-parent')) a.parent = $('#f-parent').value;
    S.add = a; renderAD();
  }
  else if (t.id === 'f-country') { var w = $('#f-regwrap'); if (w) w.hidden = !!t.value; if (t.value) $('#f-region').value = REGOF[t.value]; }
}
function init() {
  loadLocal(); loadUI(); renderTB();
  document.addEventListener('click', onClick); document.addEventListener('input', onInput); document.addEventListener('change', onChange);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { if ($('#addmenu').classList.contains('on')) closeAddMenu(); else if ($('#sheet').classList.contains('on')) closeSheet(); return; }
    if (e.key !== 'Enter') return;
    var id = e.target.id;
    if (id === 'qt' || id === 'qtw') { e.preventDefault(); quickSave('todo'); }
    else if (id === 'qb' || id === 'qba') { e.preventDefault(); quickSave('book'); }
    else if (id === 'subq') { e.preventDefault(); addSubtopic(); }
    else if (id === 'lq') { e.preventDefault(); var f = $('#lres button'); if (f) f.click(); }
    else if (id === 'wpq') { e.preventDefault(); var g = wp$('#wpres [data-wpa], #wpres [data-wpc]'); if (g) wpPick(g); }
    else if (e.target.matches && e.target.matches('.li[role=button]')) { e.preventDefault(); e.target.click(); }
  });
  var raf = 0; $('#sc').addEventListener('scroll', function () { if (!raf) raf = requestAnimationFrame(function () { raf = 0; var v = viewYears(); if (v[0] < WIN[0] || v[1] > WIN[1]) renderTL(); else renderAxis(); }); });
  window.addEventListener('resize', function () { if (S.tab === 'tl') { S.P = clampP(S.P); renderTL(); } });
  initPinch();
  setRange(1500, 1900); renderTB();
  initSync();
  window.__atlas = { S: S, go: go, openSheet: openSheet };
}
init();
})();
