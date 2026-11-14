// Tiny QR code encoder for the "QR" button. Written for this site, no dependencies.
// Byte mode (UTF-8), error correction level M, versions 1–6 (up to 106 bytes), automatic mask.
// QR.svg(text) returns an <svg> string (dark modules on white, with the standard quiet zone).
(function (root) {
  // Per version (index 1..6): total data codewords, EC codewords per block, data codewords per block.
  var VERSIONS = [null,
    { ec: 10, blocks: [16] },
    { ec: 16, blocks: [28] },
    { ec: 26, blocks: [44] },
    { ec: 18, blocks: [32, 32] },
    { ec: 24, blocks: [43, 43] },
    { ec: 16, blocks: [27, 27, 27, 27] }];
  var ALIGN = [null, [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34]];

  // ---- Reed–Solomon over GF(256), polynomial 0x11D ----
  var EXP = new Array(512), LOG = new Array(256);
  (function () { var x = 1; for (var i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= 0x11D; } for (i = 255; i < 512; i++) EXP[i] = EXP[i - 255]; })();
  function mul(a, b) { return a && b ? EXP[LOG[a] + LOG[b]] : 0; }
  function rsGenerator(n) {
    var g = [1];
    for (var i = 0; i < n; i++) {
      var next = new Array(g.length + 1).fill(0);
      for (var j = 0; j < g.length; j++) { next[j] ^= g[j]; next[j + 1] ^= mul(g[j], EXP[i]); }
      g = next;
    }
    return g; // g[0] = 1 (highest degree first)
  }
  function rsRemainder(data, n) {
    var g = rsGenerator(n), rem = new Array(n).fill(0);
    for (var i = 0; i < data.length; i++) {
      var factor = data[i] ^ rem[0];
      rem.shift(); rem.push(0);
      for (var j = 0; j < n; j++) rem[j] ^= mul(g[j + 1], factor);
    }
    return rem;
  }

  function utf8(text) {
    if (typeof TextEncoder !== "undefined") return Array.from(new TextEncoder().encode(text));
    return Array.from(Buffer.from(text, "utf8"));
  }

  function encode(text) {
    var bytes = utf8(text), version = 0;
    for (var v = 1; v <= 6; v++) {
      var cap = VERSIONS[v].blocks.reduce(function (a, b) { return a + b; }, 0);
      if (4 + 8 + bytes.length * 8 <= cap * 8) { version = v; break; }
    }
    if (!version) throw new Error("text too long for QR versions 1-6");
    var info = VERSIONS[version], capBytes = info.blocks.reduce(function (a, b) { return a + b; }, 0);

    // Data bits: mode 0100, 8-bit count, bytes, terminator, pad to byte, pad codewords.
    var bits = [];
    function put(val, len) { for (var i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); }
    put(4, 4); put(bytes.length, 8); bytes.forEach(function (b) { put(b, 8); });
    put(0, Math.min(4, capBytes * 8 - bits.length));
    while (bits.length % 8) bits.push(0);
    var data = [];
    for (var i = 0; i < bits.length; i += 8) { var b = 0; for (var k = 0; k < 8; k++) b = (b << 1) | bits[i + k]; data.push(b); }
    for (var p = 0; data.length < capBytes; p++) data.push(p % 2 ? 0x11 : 0xEC);

    // Split into blocks, add EC, interleave.
    var blocks = [], ecs = [], off = 0;
    info.blocks.forEach(function (n) { var blk = data.slice(off, off + n); off += n; blocks.push(blk); ecs.push(rsRemainder(blk, info.ec)); });
    var out = [], maxLen = Math.max.apply(null, info.blocks);
    for (i = 0; i < maxLen; i++) blocks.forEach(function (blk) { if (i < blk.length) out.push(blk[i]); });
    for (i = 0; i < info.ec; i++) ecs.forEach(function (ec) { out.push(ec[i]); });
    return { version: version, codewords: out };
  }

  function build(text) {
    var enc = encode(text), version = enc.version, size = 17 + 4 * version;
    var m = [], fn = [];
    for (var y = 0; y < size; y++) { m.push(new Array(size).fill(false)); fn.push(new Array(size).fill(false)); }
    function setF(x, y, dark) { m[y][x] = dark; fn[y][x] = true; }

    // Timing patterns
    for (var i = 0; i < size; i++) { setF(6, i, i % 2 === 0); setF(i, 6, i % 2 === 0); }
    // Finder patterns with separators
    [[3, 3], [size - 4, 3], [3, size - 4]].forEach(function (c) {
      for (var dy = -4; dy <= 4; dy++) for (var dx = -4; dx <= 4; dx++) {
        var x = c[0] + dx, yy = c[1] + dy;
        if (x < 0 || yy < 0 || x >= size || yy >= size) continue;
        var d = Math.max(Math.abs(dx), Math.abs(dy));
        setF(x, yy, d !== 2 && d !== 4);
      }
    });
    // Alignment patterns
    var al = ALIGN[version];
    al.forEach(function (ay) { al.forEach(function (ax) {
      if ((ax === 6 && ay === 6) || (ax === 6 && ay === al[al.length - 1]) || (ay === 6 && ax === al[al.length - 1])) return;
      for (var dy = -2; dy <= 2; dy++) for (var dx = -2; dx <= 2; dx++) setF(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }); });
    // Reserve format areas (filled per mask below) and the dark module
    function drawFormat(mask) {
      var data = (0 << 3) | mask, rem = data; // level M = 00
      for (var i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
      var bits = ((data << 10) | rem) ^ 0x5412;
      function bit(i) { return ((bits >>> i) & 1) !== 0; }
      for (i = 0; i <= 5; i++) setF(8, i, bit(i));
      setF(8, 7, bit(6)); setF(8, 8, bit(7)); setF(7, 8, bit(8));
      for (i = 9; i < 15; i++) setF(14 - i, 8, bit(i));
      for (i = 0; i < 8; i++) setF(size - 1 - i, 8, bit(i));
      for (i = 8; i < 15; i++) setF(8, size - 15 + i, bit(i));
      setF(8, size - 8, true);
    }
    drawFormat(0);

    // Data placement (zigzag, two columns at a time, skipping the vertical timing column)
    var cw = enc.codewords, bitIdx = 0;
    for (var right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (var vert = 0; vert < size; vert++) for (var j = 0; j < 2; j++) {
        var x = right - j, upward = ((right + 1) & 2) === 0, yy = upward ? size - 1 - vert : vert;
        if (!fn[yy][x] && bitIdx < cw.length * 8) { m[yy][x] = ((cw[bitIdx >>> 3] >>> (7 - (bitIdx & 7))) & 1) === 1; bitIdx++; }
      }
    }

    var MASKS = [
      function (x, y) { return (x + y) % 2 === 0; }, function (x, y) { return y % 2 === 0; },
      function (x, y) { return x % 3 === 0; }, function (x, y) { return (x + y) % 3 === 0; },
      function (x, y) { return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; },
      function (x, y) { return x * y % 2 + x * y % 3 === 0; },
      function (x, y) { return (x * y % 2 + x * y % 3) % 2 === 0; },
      function (x, y) { return ((x + y) % 2 + x * y % 3) % 2 === 0; }];
    function applyMask(k) { for (var y = 0; y < size; y++) for (var x = 0; x < size; x++) if (!fn[y][x] && MASKS[k](x, y)) m[y][x] = !m[y][x]; }
    function penalty() {
      var score = 0, y, x, run, dark = 0;
      for (y = 0; y < size; y++) for (var dir = 0; dir < 2; dir++) {
        run = 1;
        for (x = 1; x < size; x++) {
          var a = dir ? m[x][y] : m[y][x], b = dir ? m[x - 1][y] : m[y][x - 1];
          if (a === b) { run++; if (run === 5) score += 3; else if (run > 5) score++; } else run = 1;
        }
      }
      for (y = 0; y < size - 1; y++) for (x = 0; x < size - 1; x++) { var c = m[y][x]; if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) score += 3; }
      for (y = 0; y < size; y++) for (x = 0; x < size; x++) if (m[y][x]) dark++;
      score += Math.floor(Math.abs(dark * 20 - size * size * 10) / (size * size)) * 10;
      return score;
    }
    var best = 0, bestScore = Infinity;
    for (var k = 0; k < 8; k++) { applyMask(k); drawFormat(k); var s = penalty(); if (s < bestScore) { bestScore = s; best = k; } applyMask(k); }
    applyMask(best); drawFormat(best);
    return { size: size, modules: m, version: version, mask: best };
  }

  function svg(text) {
    var q = build(text), quiet = 4, n = q.size + quiet * 2, d = "";
    for (var y = 0; y < q.size; y++) for (var x = 0; x < q.size; x++) if (q.modules[y][x]) d += "M" + (x + quiet) + " " + (y + quiet) + "h1v1h-1z";
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + n + " " + n + '" shape-rendering="crispEdges" role="img" aria-label="QR code: ' +
      text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;") + '"><rect width="' + n + '" height="' + n + '" fill="#fff"/><path d="' + d + '" fill="#0b1f33"/></svg>';
  }

  var api = { svg: svg, build: build };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.QR = api;
})(this);
