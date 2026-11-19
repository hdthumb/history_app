/* Builds the item registry from the seed arrays. Shared by the app and the test script. */
var slug = function (s) { return s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); };
var yid = function (y) { return y < 0 ? 'b' + (-y) : String(y); };
var SEED = [], SEEDMAP = {}, SLINK = {}, SEEDERR = [];
(function () {
  function add(it) {
    if (SEEDMAP[it.id]) { SEEDERR.push('dup id ' + it.id); return; }
    SEEDMAP[it.id] = it; SEED.push(it);
  }
  EMP.forEach(function (e) {
    add({ id: 'e-' + e[0] + '-' + slug(e[1]) + '-' + yid(e[2]), type: 'emp', region: e[0], country: '', start: e[2], end: e[3], title: e[1], why: e[4], tier: 1, who: '' });
  });
  var seen = {};
  EVT.forEach(function (e) {
    if (!REGOF[e[0]]) SEEDERR.push('unknown country ' + e[0]);
    var base = slug(e[0]) + '-' + yid(e[1]);
    seen[base] = (seen[base] || 0) + 1;
    add({ id: seen[base] > 1 ? base + '-' + seen[base] : base, type: 'evt', region: REGOF[e[0]], country: e[0], start: e[1], end: null, title: e[2], why: e[3], tier: e[4], who: e[5] || '' });
  });
  PEOPLE.forEach(function (p) {
    if (!REGOF[p[3]]) SEEDERR.push('unknown country (person) ' + p[3]);
    add({ id: 'p-' + slug(p[0]), type: 'ppl', region: REGOF[p[3]], country: p[3], start: p[1], end: p[2], title: p[0], why: p[4], tier: 1, who: '' });
  });
  PLACES.forEach(function (p) {
    if (!REGOF[p[1]]) SEEDERR.push('unknown country (place) ' + p[1]);
    add({ id: 'pl-' + slug(p[0]), type: 'plc', region: REGOF[p[1]], country: p[1], start: null, end: null, title: p[0], why: p[2], tier: 1, who: '', lat: p[3], lon: p[4] });
  });
  LK.forEach(function (pair) {
    var ab = pair.split('|');
    if (!SEEDMAP[ab[0]] || !SEEDMAP[ab[1]]) { SEEDERR.push('bad link ' + pair); return; }
    (SLINK[ab[0]] = SLINK[ab[0]] || []).push(ab[1]);
    (SLINK[ab[1]] = SLINK[ab[1]] || []).push(ab[0]);
  });
})();
