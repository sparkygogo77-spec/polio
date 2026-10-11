/**
 * THE ORB IS A PLANET (J, 2026-10-10: "the orb in media should rotate every
 * degree and be draggable like a sphere to see all sides, like a planet").
 *
 * A sphere drawn on a plain 2D canvas, a pixel at a time: each pixel of the
 * disc is a point on the ball, turned back through the ball's orientation
 * to a longitude and latitude, and coloured from a flat picture wrapped
 * round it (a picture he put on the orb, or bands and marks in its colour).
 * The light stays where it is and the ball turns under it, so every side
 * can be seen and every side is lit the same way. No library, no GPU.
 *
 *   · it turns slowly on its own axis, leaning as a planet does;
 *   · a drag turns it whichever way the hand goes, over the poles too, and
 *     a throw keeps it turning until it slows back to its own spin;
 *   · held still (a visitor asking for less motion) it does not spin, and
 *     still turns in the hand.
 *
 * A script, so the Builder's board and Preview (`parts/Orb.tsx`), the
 * published page (the "planet" feature, `behaviourScripts/effects.ts`) and
 * the kit's `vendor/builder-motion.js` all run the same lines. It defines
 * `polioPlanet(host, options)`: `host` is the box the ball fills, its
 * settings on `data-planet-*` (hue, tilt, spin, hands, speed, surface) or in
 * `options`, and a picture as `<img data-planet-picture>` inside it (so a
 * published page's picture is moved with the rest of its pictures) or
 * `options.picture`. It returns `{ stop, turn, gl }`; a host already turning
 * hands back the one it has.
 *
 * A BALL WITH A SURFACE IS THE TURNABLE ORB (glass, metal or matte). It was
 * three.js on the board and this plain ball everywhere else, so the site
 * never looked like the board (the audit, 2026-10-11). Now it is this ball
 * in that surface's light, worked out per pixel on the graphics card
 * (WebGL, no library), as sharp as its box; where the graphics card cannot
 * help, the same light is worked out here, on the 2D canvas. One script, so
 * the board, the Preview, the published page and a builder-ready site draw
 * the same orb.
 */
export const PLANET_JS = `function polioPlanet(host, o) {
  if (!host || !host.getBoundingClientRect) return null;
  if (host.__planet) return host.__planet;
  o = o || {};
  var d = host.dataset || {};
  function pick(a, b) { return a !== undefined && a !== null && a !== "" ? a : b; }
  function n(v, dflt) { var x = Number(v); return v === undefined || v === null || v === "" || !isFinite(x) ? dflt : x; }
  var hue = n(pick(d.planetHue, o.hue), 96), tilt = n(pick(d.planetTilt, o.tilt), -22), speed = n(pick(d.planetSpeed, o.speed), 1);
  var spin = String(pick(d.planetSpin, o.spin) || "yes") !== "no", hands = String(pick(d.planetHands, o.hands) || "yes") !== "no";
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) spin = false;
  var shape = String(pick(d.planetShape, o.shape) || "sphere"), ball = shape !== "cube" && shape !== "pyramid";
  /*
   * How a surface takes the light: the share of it the body keeps, how strong the coloured edges are, the
   * highlight's tightness and brightness and how much of the key's colour it takes, and a sharp second gleam
   * from above. "plain" is the planet as it has always been drawn; any other is drawn on the graphics card.
   */
  var LOOKS = {
    plain: { body: 1, rims: 1, tight: 48, shine: 0.55, tint: 0, gleam: 0 },
    glass: { body: 0.78, rims: 1.35, tight: 140, shine: 0.95, tint: 0, gleam: 0.7 },
    metal: { body: 0.62, rims: 1.2, tight: 20, shine: 0.6, tint: 0.7, gleam: 0.2 },
    matte: { body: 1.06, rims: 0.7, tight: 8, shine: 0.1, tint: 0, gleam: 0 }
  };
  var surface = String(pick(d.planetSurface, o.surface) || "plain");
  if (!ball || !LOOKS.hasOwnProperty(surface)) surface = "plain";
  var SF = LOOKS[surface];
  /* Pictures: one wraps the ball; a cube or a pyramid wears one per face, round again when there are fewer. */
  var imgs = Array.prototype.slice.call(host.querySelectorAll("img[data-planet-picture]"));
  var srcs = imgs.length ? imgs.map(function (i) { return i.currentSrc || i.getAttribute("src") || ""; }).filter(Boolean)
    : String(pick(d.planetPicture, o.picture) || "").split(/\\s+/).filter(Boolean);
  var src = srcs[0] || "";
  imgs.forEach(function (i) { i.style.display = "none"; });
  /* A page saved with the ball on it carries its old canvas, blank: this draws a new one. */
  Array.prototype.forEach.call(host.querySelectorAll("canvas[data-planet-canvas]"), function (c) { c.remove(); });
  if (getComputedStyle(host).position === "static") host.style.position = "relative";

  /* ---- on the graphics card: the light worked out below for the 2D drawing, per pixel there ---- */
  var VS = "attribute vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }";
  var FS = [
    "#ifdef GL_FRAGMENT_PRECISION_HIGH", "precision highp float;", "#else", "precision mediump float;", "#endif",
    "uniform float S; uniform mat3 M; uniform sampler2D T; uniform vec3 K, C, L, L2, H, HU; uniform vec4 A; uniform vec2 B;",
    "void main() {",
    "  float r0 = S * 0.5; vec2 q = (gl_FragCoord.xy - r0) / r0; float rr = length(q);",
    "  float e = clamp((1.0 - rr) * r0 + 0.5, 0.0, 1.0); if (e <= 0.0) discard;",
    "  if (rr > 1.0) q /= rr;",
    "  vec3 v = vec3(q, sqrt(max(0.0, 1.0 - dot(q, q)))); vec3 b = M * v;",
    "  vec3 t = texture2D(T, vec2(atan(b.x, b.z) / 6.2831853 + 0.5, 0.5 - asin(clamp(b.y, -1.0, 1.0)) / 3.1415927)).rgb;",
    "  float dk = dot(v, L), dc = dot(v, L2), rim = pow(max(0.0, 1.0 - v.z), 2.2);",
    "  float sh = (0.14 + 0.92 * max(0.0, dk)) * A.x;",
    "  float k = rim * max(0.0, dk + 0.25) * 0.9 * A.y;",
    "  float c = (rim * max(0.0, dc + 0.2) * 0.85 + pow(max(0.0, dc), 2.0) * 0.18) * A.y;",
    "  float s = pow(max(0.0, dot(v, H)), A.z) * A.w;",
    "  float w = pow(max(0.0, dot(v, HU)), 300.0) * B.y;",
    "  gl_FragColor = vec4(min(t * sh + K * k + C * c + mix(vec3(1.0), K, B.x) * s + vec3(w), 1.0) * e, e);",
    "}"
  ].join("\\n");
  /* The program, a triangle over the whole canvas and the skin's texture; null where the graphics card will not draw it. */
  function onCard(c) {
    var x = null;
    try { x = c.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: false }) || c.getContext("experimental-webgl"); } catch (e) { x = null; }
    if (!x) return null;
    function compiled(type, text) { var s = x.createShader(type); x.shaderSource(s, text); x.compileShader(s); return x.getShaderParameter(s, x.COMPILE_STATUS) ? s : null; }
    var vs = compiled(x.VERTEX_SHADER, VS), fs = compiled(x.FRAGMENT_SHADER, FS);
    if (!vs || !fs) return null;
    var pr = x.createProgram();
    x.attachShader(pr, vs); x.attachShader(pr, fs); x.linkProgram(pr);
    if (!x.getProgramParameter(pr, x.LINK_STATUS)) return null;
    x.useProgram(pr);
    x.bindBuffer(x.ARRAY_BUFFER, x.createBuffer());
    x.bufferData(x.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), x.STATIC_DRAW);
    var loc = x.getAttribLocation(pr, "p");
    x.enableVertexAttribArray(loc);
    x.vertexAttribPointer(loc, 2, x.FLOAT, false, 0, 0);
    x.activeTexture(x.TEXTURE0);
    x.bindTexture(x.TEXTURE_2D, x.createTexture());
    /* Round the ball and seamless (512 wide, a power of two), clamped at the poles, no mipmaps to show the seam. */
    x.texParameteri(x.TEXTURE_2D, x.TEXTURE_WRAP_S, x.REPEAT);
    x.texParameteri(x.TEXTURE_2D, x.TEXTURE_WRAP_T, x.CLAMP_TO_EDGE);
    x.texParameteri(x.TEXTURE_2D, x.TEXTURE_MIN_FILTER, x.LINEAR);
    x.texParameteri(x.TEXTURE_2D, x.TEXTURE_MAG_FILTER, x.LINEAR);
    var u = {};
    ["S", "M", "T", "K", "C", "L", "L2", "H", "HU", "A", "B"].forEach(function (k) { u[k] = x.getUniformLocation(pr, k); });
    x.uniform1i(u.T, 0);
    return { x: x, u: u };
  }

  function canvas() {
    var c = document.createElement("canvas");
    c.setAttribute("data-planet-canvas", "");
    c.setAttribute("aria-hidden", "true");
    c.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;" + (ball ? "border-radius:50%;" : "") + (hands ? "cursor:grab;touch-action:none;" : "pointer-events:none;");
    return c;
  }
  var cv = canvas(), gl = surface === "plain" ? null : onCard(cv), g = null;
  /* No graphics card to draw it (or no WebGL at all): drawn here, in the same light, on a canvas that never asked for one. */
  if (surface !== "plain" && !gl) cv = canvas();
  host.appendChild(cv);
  if (!gl) {
    g = cv.getContext("2d");
    if (!g) { cv.remove(); return null; }
  }

  /* ---- the skin: a flat picture, twice as wide as tall, wrapped round the ball ---- */
  var TW = 512, TH = 256, tex = null;
  function hsl(h, s, l, a) { return "hsla(" + (((h % 360) + 360) % 360) + "," + s + "%," + l + "%," + (a === undefined ? 1 : a) + ")"; }
  function own() {
    var c = document.createElement("canvas"); c.width = TW; c.height = TH;
    var x = c.getContext("2d");
    x.fillStyle = hsl(hue, 50, 30); x.fillRect(0, 0, TW, TH);
    for (var y = 0; y < TH; y++) {
      var band = Math.sin((y / TH) * Math.PI * 7) * 0.5 + Math.sin((y / TH) * Math.PI * 2.3) * 0.5;
      x.fillStyle = hsl(hue, 50, 30 + band * 11, 0.6); x.fillRect(0, y, TW, 1);
    }
    var marks = [[0.18, 0.34, 0.17, 44], [0.46, 0.62, 0.22, 12], [0.71, 0.28, 0.14, 40], [0.88, 0.71, 0.19, 13], [0.33, 0.81, 0.12, 46], [0.62, 0.15, 0.16, 10], [0.05, 0.58, 0.1, 48]];
    marks.forEach(function (m) {
      [-TW, 0, TW].forEach(function (shift) {
        var cx = m[0] * TW + shift, cy = m[1] * TH, r = m[2] * 160;
        var gr = x.createRadialGradient(cx, cy, 0, cx, cy, r);
        gr.addColorStop(0, hsl(hue, 58, m[3], 0.85)); gr.addColorStop(1, hsl(hue, 58, m[3], 0));
        x.fillStyle = gr; x.beginPath(); x.arc(cx, cy, r, 0, 6.2832); x.fill();
      });
    });
    return c;
  }
  /* Lay the skin on: onto the graphics card, or read for the 2D drawing; false for another site's picture that may not be read. */
  function lay(c) {
    try {
      if (gl) gl.x.texImage2D(gl.x.TEXTURE_2D, 0, gl.x.RGBA, gl.x.RGBA, gl.x.UNSIGNED_BYTE, c);
      else tex = c.getContext("2d").getImageData(0, 0, TW, TH).data;
    } catch (e) { return false; }
    return true;
  }
  if (ball) lay(own());
  function wear(pic) {
    var c = document.createElement("canvas"); c.width = TW; c.height = TH;
    c.getContext("2d").drawImage(pic, 0, 0, TW, TH);
    if (lay(c)) draw();
  }
  /* The solids' pictures, loaded as they are: a face shows its colour until its picture is in. */
  var faceSkins = [];
  if (!ball) srcs.forEach(function (u, i) {
    var im = new Image();
    if (!/^(data|blob):/i.test(u)) im.crossOrigin = "anonymous";
    im.onload = function () { faceSkins[i] = im; if (!stopped) draw(); };
    im.onerror = function () {
      /* Not readable with leave to draw it: the face keeps its colour. */
    };
    im.src = u;
  });
  if (src && ball) {
    var pic = new Image();
    if (!/^(data|blob):/i.test(src)) pic.crossOrigin = "anonymous";
    pic.onload = function () { if (!stopped) wear(pic); };
    pic.onerror = function () {
      /* A picture on another site that will not be read back: once more as a plain picture is no help, so the ball keeps its own skin. */
    };
    pic.src = src;
  }

  /* ---- the lights: fixed in front of the viewer, worked out once per pixel ---- */
  function rgb(h, s, l) {
    s /= 100; l /= 100; h = ((h % 360) + 360) % 360;
    var k = function (q) { return (q + h / 30) % 12; }, a = s * Math.min(l, 1 - l);
    var f = function (q) { return l - a * Math.max(-1, Math.min(k(q) - 3, 9 - k(q), 1)); };
    return [f(0) * 255, f(8) * 255, f(4) * 255];
  }
  var KEY = rgb(hue, 95, 58), COOL = rgb(hue + 145, 95, 55);
  function unit(x, y, z) { var l = Math.sqrt(x * x + y * y + z * z); return [x / l, y / l, z / l]; }
  var L = unit(-0.55, 0.6, 0.62), L2 = unit(0.75, -0.45, 0.3), H = unit(L[0], L[1], L[2] + 1);
  /* The surface's gleam comes from a light above; its highlight takes the key's colour as far as the surface says. */
  var UP = unit(0.12, 0.92, 0.38), HU = unit(UP[0], UP[1], UP[2] + 1);
  var GLINT = [0, 1, 2].map(function (j) { return 255 * (1 - SF.tint) + KEY[j] * SF.tint; });
  if (gl) {
    gl.x.uniform3f(gl.u.K, KEY[0] / 255, KEY[1] / 255, KEY[2] / 255);
    gl.x.uniform3f(gl.u.C, COOL[0] / 255, COOL[1] / 255, COOL[2] / 255);
    gl.x.uniform3fv(gl.u.L, L); gl.x.uniform3fv(gl.u.L2, L2); gl.x.uniform3fv(gl.u.H, H); gl.x.uniform3fv(gl.u.HU, HU);
    gl.x.uniform4f(gl.u.A, SF.body, SF.rims, SF.tight, SF.shine);
    gl.x.uniform2f(gl.u.B, SF.tint, SF.gleam);
  }
  var S = 0, out = null, at = null, nx = null, ny = null, nz = null, shade = null, rimK = null, rimC = null, spec = null, coat = null, edge = null;
  function size() {
    var r = host.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    var px0 = Math.round(Math.min(r.width || 0, r.height || r.width || 0) * dpr);
    /* A solid is drawn face by face, so it can be sharp; the ball is worked a pixel at a time, so it stays small, unless the graphics card works it. */
    var side = Math.max(48, Math.min(gl ? 1280 : ball ? 340 : 900, px0 || 240));
    if (side === S) return false;
    if (!ball || gl) { S = side; cv.width = cv.height = S; return true; }
    S = side; cv.width = cv.height = S; out = g.createImageData(S, S);
    var list = [], half = S / 2;
    for (var py = 0; py < S; py++) for (var px = 0; px < S; px++) {
      var x = (px + 0.5 - half) / half, y = (half - py - 0.5) / half, r2 = x * x + y * y;
      if (r2 <= (1 + 1.5 / half) * (1 + 1.5 / half)) list.push(py * S + px);
    }
    var m = list.length;
    at = new Int32Array(list); nx = new Float32Array(m); ny = new Float32Array(m); nz = new Float32Array(m);
    shade = new Float32Array(m); rimK = new Float32Array(m); rimC = new Float32Array(m); spec = new Float32Array(m); edge = new Float32Array(m);
    coat = SF.gleam ? new Float32Array(m) : null;
    for (var i = 0; i < m; i++) {
      var p = list[i], qx = ((p % S) + 0.5 - half) / half, qy = (half - Math.floor(p / S) - 0.5) / half, rr = Math.sqrt(qx * qx + qy * qy);
      edge[i] = Math.max(0, Math.min(1, (1 - rr) * half + 0.5));
      if (rr > 1) { qx /= rr; qy /= rr; rr = 1; }
      var qz = Math.sqrt(Math.max(0, 1 - rr * rr));
      nx[i] = qx; ny[i] = qy; nz[i] = qz;
      var dk = qx * L[0] + qy * L[1] + qz * L[2], dc = qx * L2[0] + qy * L2[1] + qz * L2[2], rim = Math.pow(1 - qz, 2.2);
      /* The fragment shader above works out these same lines; the surface scales them (plain: by one, so as ever). */
      shade[i] = (0.14 + 0.92 * Math.max(0, dk)) * SF.body;
      rimK[i] = rim * Math.max(0, dk + 0.25) * 0.9 * SF.rims;
      rimC[i] = (rim * Math.max(0, dc + 0.2) * 0.85 + Math.pow(Math.max(0, dc), 2) * 0.18) * SF.rims;
      spec[i] = Math.pow(Math.max(0, qx * H[0] + qy * H[1] + qz * H[2]), SF.tight) * SF.shine;
      if (coat) coat[i] = Math.pow(Math.max(0, qx * HU[0] + qy * HU[1] + qz * HU[2]), 300) * SF.gleam * 255;
    }
    return true;
  }

  /* ---- where the ball faces: body to view, a 3x3 turn, rows first ---- */
  function mul(a, b) {
    return [a[0] * b[0] + a[1] * b[3] + a[2] * b[6], a[0] * b[1] + a[1] * b[4] + a[2] * b[7], a[0] * b[2] + a[1] * b[5] + a[2] * b[8],
      a[3] * b[0] + a[4] * b[3] + a[5] * b[6], a[3] * b[1] + a[4] * b[4] + a[5] * b[7], a[3] * b[2] + a[4] * b[5] + a[5] * b[8],
      a[6] * b[0] + a[7] * b[3] + a[8] * b[6], a[6] * b[1] + a[7] * b[4] + a[8] * b[7], a[6] * b[2] + a[7] * b[5] + a[8] * b[8]];
  }
  function rx(t) { var c = Math.cos(t), s = Math.sin(t); return [1, 0, 0, 0, c, -s, 0, s, c]; }
  function ry(t) { var c = Math.cos(t), s = Math.sin(t); return [c, 0, s, 0, 1, 0, -s, 0, c]; }
  function rz(t) { var c = Math.cos(t), s = Math.sin(t); return [c, -s, 0, s, c, 0, 0, 0, 1]; }
  /* Leaning on its axis, and a little toward the viewer, so a pole shows as it turns. */
  var M = ball ? mul(rz((tilt * Math.PI) / 180 * 0.6), rx(0.32)) : mul(rx(0.42), ry(0.62));
  function tidy() {
    /* Many small turns drift off true: put the three axes back at right angles. */
    var a = unit(M[0], M[3], M[6]), b = [M[1], M[4], M[7]], k = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    b = unit(b[0] - k * a[0], b[1] - k * a[1], b[2] - k * a[2]);
    var c = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    M = [a[0], b[0], c[0], a[1], b[1], c[1], a[2], b[2], c[2]];
  }

  /* ---- the solids: corners, and faces as corners in order round the outside ---- */
  var V, F;
  if (shape === "cube") {
    var a = 0.56;
    V = [[-a, -a, a], [a, -a, a], [a, a, a], [-a, a, a], [-a, -a, -a], [a, -a, -a], [a, a, -a], [-a, a, -a]];
    /* front, right, back, left, top, bottom: each starts at its lower left as you face it. */
    F = [[0, 1, 2, 3], [1, 5, 6, 2], [5, 4, 7, 6], [4, 0, 3, 7], [3, 2, 6, 7], [4, 5, 1, 0]];
  } else {
    var b = 0.66, lo = -0.5, hi = 0.82;
    V = [[-b, lo, b], [b, lo, b], [b, lo, -b], [-b, lo, -b], [0, hi, 0]];
    /* four sides, each base corner to base corner up to the top, then the base. */
    F = [[0, 1, 4], [1, 2, 4], [2, 3, 4], [3, 0, 4], [3, 2, 1, 0]];
  }
  var EYE = 4.2;
  function drawSolid() {
    var half = S / 2, k = half * 0.9;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, S, S);
    var P = V.map(function (v) {
      var x = M[0] * v[0] + M[1] * v[1] + M[2] * v[2], y = M[3] * v[0] + M[4] * v[1] + M[5] * v[2], z = M[6] * v[0] + M[7] * v[1] + M[8] * v[2];
      var f = EYE / (EYE - z);
      return { x: half + x * f * k, y: half - y * f * k, z: z, v: [x, y, z] };
    });
    var seen = [];
    F.forEach(function (face, fi) {
      var A = P[face[0]].v, B = P[face[1]].v, C = P[face[2]].v;
      var n = unit((B[1] - A[1]) * (C[2] - A[2]) - (B[2] - A[2]) * (C[1] - A[1]), (B[2] - A[2]) * (C[0] - A[0]) - (B[0] - A[0]) * (C[2] - A[2]), (B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0]));
      /* Facing the eye: the face's normal against the way from the face to the eye. */
      if (n[0] * -A[0] + n[1] * -A[1] + n[2] * (EYE - A[2]) <= 0) return;
      seen.push({ face: face, fi: fi, n: n, z: face.reduce(function (s2, i) { return s2 + P[i].z; }, 0) / face.length });
    });
    seen.sort(function (p, q) { return p.z - q.z; });
    seen.forEach(function (s2) {
      var pts = s2.face.map(function (i) { return P[i]; });
      function path() { g.beginPath(); pts.forEach(function (q, i) { if (i) g.lineTo(q.x, q.y); else g.moveTo(q.x, q.y); }); g.closePath(); }
      var skin = faceSkins.length ? faceSkins[s2.fi % srcs.length] : null;
      path();
      g.fillStyle = hsl(hue + (s2.fi % 3) * 14 - 14, 52, 34 + (s2.fi % 2) * 6);
      g.fill();
      if (skin) {
        var w = skin.naturalWidth || skin.width, h = skin.naturalHeight || skin.height;
        /* The picture's corners on the face's: a quad as two triangles, a pyramid's side as one, its top at the picture's middle. */
        var src3 = pts.length === 4 ? [[[0, h], [w, h], [w, 0]], [[0, h], [w, 0], [0, 0]]] : [[[0, h], [w, h], [w / 2, 0]]];
        var dst3 = pts.length === 4 ? [[pts[0], pts[1], pts[2]], [pts[0], pts[2], pts[3]]] : [[pts[0], pts[1], pts[2]]];
        src3.forEach(function (sv, ti) {
          var dv = dst3[ti];
          var x0 = sv[0][0], y0 = sv[0][1], x1 = sv[1][0], y1 = sv[1][1], x2 = sv[2][0], y2 = sv[2][1];
          var det = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
          if (!det) return;
          var u0 = dv[0].x, v0 = dv[0].y, u1 = dv[1].x, v1 = dv[1].y, u2 = dv[2].x, v2 = dv[2].y;
          var ma = ((u1 - u0) * (y2 - y0) - (u2 - u0) * (y1 - y0)) / det, mc = ((u2 - u0) * (x1 - x0) - (u1 - u0) * (x2 - x0)) / det;
          var mb = ((v1 - v0) * (y2 - y0) - (v2 - v0) * (y1 - y0)) / det, md = ((v2 - v0) * (x1 - x0) - (v1 - v0) * (x2 - x0)) / det;
          var me = u0 - ma * x0 - mc * y0, mf = v0 - mb * x0 - md * y0;
          g.save();
          /* A hair past the triangle, so the two halves of a face meet with no seam. */
          var cx = (u0 + u1 + u2) / 3, cy = (v0 + v1 + v2) / 3;
          g.beginPath();
          [[u0, v0], [u1, v1], [u2, v2]].forEach(function (q, i) { var ex = q[0] + (q[0] - cx) * 0.012, ey = q[1] + (q[1] - cy) * 0.012; if (i) g.lineTo(ex, ey); else g.moveTo(ex, ey); });
          g.closePath();
          g.clip();
          g.setTransform(ma, mb, mc, md, me, mf);
          g.drawImage(skin, 0, 0, w, h);
          g.restore();
        });
      }
      /* The light on it: darker turned away, a sheen turned toward it. */
      var lit = s2.n[0] * L[0] + s2.n[1] * L[1] + s2.n[2] * L[2];
      path();
      if (lit < 0.55) { g.fillStyle = "rgba(0,0,0," + Math.min(0.62, (0.55 - lit) * 0.62).toFixed(3) + ")"; g.fill(); }
      else { g.fillStyle = "rgba(255,255,255," + ((lit - 0.55) * 0.22).toFixed(3) + ")"; g.fill(); }
      g.lineJoin = "round";
      g.lineWidth = Math.max(1, S / 300);
      g.strokeStyle = hsl(hue, 90, 70, 0.55);
      g.stroke();
    });
  }

  var TAU = Math.PI * 2;
  function draw() {
    if (stopped) return;
    size();
    if (gl) {
      /* M goes up as it is, rows first; the shader reads it columns first, so it holds the transpose, view to body. */
      var X = gl.x;
      X.viewport(0, 0, S, S);
      X.clearColor(0, 0, 0, 0);
      X.clear(X.COLOR_BUFFER_BIT);
      X.uniform1f(gl.u.S, S);
      X.uniformMatrix3fv(gl.u.M, false, M);
      X.drawArrays(X.TRIANGLES, 0, 3);
      return;
    }
    if (!ball) { drawSolid(); return; }
    var px = out.data, m = at.length, m0 = M[0], m1 = M[1], m2 = M[2], m3 = M[3], m4 = M[4], m5 = M[5], m6 = M[6], m7 = M[7], m8 = M[8];
    for (var i = 0; i < m; i++) {
      var vx = nx[i], vy = ny[i], vz = nz[i];
      /* The view's point, turned back onto the ball (the transpose of M). */
      var bx = m0 * vx + m3 * vy + m6 * vz, by = m1 * vx + m4 * vy + m7 * vz, bz = m2 * vx + m5 * vy + m8 * vz;
      var u = Math.atan2(bx, bz) / TAU + 0.5, v = 0.5 - Math.asin(by > 1 ? 1 : by < -1 ? -1 : by) / Math.PI;
      var tx = (u * TW) | 0, ty = (v * TH) | 0;
      if (tx >= TW) tx = TW - 1; if (ty >= TH) ty = TH - 1; if (tx < 0) tx = 0; if (ty < 0) ty = 0;
      var t = (ty * TW + tx) * 4, sh = shade[i], k = rimK[i], c = rimC[i], s = spec[i], w = coat ? coat[i] : 0, o4 = at[i] * 4;
      var r = tex[t] * sh + KEY[0] * k + COOL[0] * c + s * GLINT[0] + w, gg = tex[t + 1] * sh + KEY[1] * k + COOL[1] * c + s * GLINT[1] + w, b = tex[t + 2] * sh + KEY[2] * k + COOL[2] * c + s * GLINT[2] + w;
      px[o4] = r > 255 ? 255 : r; px[o4 + 1] = gg > 255 ? 255 : gg; px[o4 + 2] = b > 255 ? 255 : b; px[o4 + 3] = edge[i] * 255;
    }
    g.putImageData(out, 0, 0);
  }

  /* ---- the hand and the spin ---- */
  var stopped = false, frame = 0, running = false, held = false, last = null, vel = [0, 0], seen = true, moved = 0;
  var IDLE = 0.0045 * speed;
  function turnBy(dx, dy) { M = mul(rx(dy), mul(ry(dx), M)); }
  function step() {
    frame = 0;
    if (stopped) return;
    if (!held) {
      if (Math.abs(vel[0]) + Math.abs(vel[1]) > 0.00005) { turnBy(vel[0], vel[1]); vel[0] *= 0.93; vel[1] *= 0.93; }
      else vel = [0, 0];
      if (spin) M = mul(M, ry(IDLE));
    }
    tidy();
    if (seen) draw();
    var busy = spin || held || vel[0] !== 0 || vel[1] !== 0;
    if (busy && host.isConnected && seen) frame = requestAnimationFrame(step);
    else running = false;
  }
  function wake() {
    if (running || stopped) return;
    running = true;
    frame = requestAnimationFrame(step);
  }
  function down(e) {
    if (e.button !== undefined && e.button > 0) return;
    held = true; vel = [0, 0]; last = [e.clientX, e.clientY]; moved = Date.now();
    try { cv.setPointerCapture(e.pointerId); } catch (x) { /* a pointer the page cannot hold still turns it */ }
    cv.style.cursor = "grabbing";
    e.preventDefault();
    e.stopPropagation();
    wake();
  }
  function move(e) {
    if (!held || !last) return;
    var r = cv.getBoundingClientRect(), w = Math.max(1, r.width);
    /* A drag across the whole ball turns it half way round. */
    var dx = ((e.clientX - last[0]) / w) * Math.PI, dy = ((e.clientY - last[1]) / w) * Math.PI;
    last = [e.clientX, e.clientY];
    turnBy(dx, dy);
    vel = [dx, dy];
    moved = Date.now();
  }
  function up() {
    if (!held) return;
    held = false; last = null;
    /* Let go after holding it still: no throw. */
    if (Date.now() - moved > 90) vel = [0, 0];
    cv.style.cursor = "grab";
    wake();
  }
  if (hands) {
    cv.addEventListener("pointerdown", down);
    cv.addEventListener("pointermove", move);
    cv.addEventListener("pointerup", up);
    cv.addEventListener("pointercancel", up);
    cv.addEventListener("lostpointercapture", up);
  }
  var ro = typeof ResizeObserver === "function" ? new ResizeObserver(function () { if (size()) draw(); }) : null;
  if (ro) ro.observe(host);
  var io = typeof IntersectionObserver === "function" ? new IntersectionObserver(function (es) { seen = es[es.length - 1].isIntersecting; if (seen) { draw(); wake(); } }) : null;
  if (io) io.observe(host);
  draw();
  if (spin) wake();
  var me = {
    stop: function () {
      stopped = true;
      if (frame) cancelAnimationFrame(frame);
      if (ro) ro.disconnect();
      if (io) io.disconnect();
      /* The graphics card's drawing is let go of now, not when the page is collected: a colour dragged along makes a ball each step. */
      var lose = gl && gl.x.getExtension("WEBGL_lose_context");
      if (lose) lose.loseContext();
      cv.remove();
      imgs.forEach(function (i) { i.style.display = ""; });
      host.__planet = null;
    },
    /* Where the ball faces now, body to view: for a check, and for anyone who wants to know. */
    turn: function () { return M.slice(); },
    /* Drawn on the graphics card (a surface the card could draw), or here on the 2D canvas. */
    gl: !!gl,
  };
  host.__planet = me;
  return me;
}`;

/** What the ball hands back: stop it, and whether the graphics card draws it (a ball asked for a surface draws on the 2D canvas when it cannot). */
export interface Planet { stop: () => void; turn: () => number[]; gl: boolean }

/** The ball's own function, for the Builder: the same lines the published page runs. */
let made: ((host: HTMLElement, o?: Record<string, string>) => Planet | null) | null = null;
export function planet(host: HTMLElement, o?: Record<string, string>): Planet | null {
  if (!made) made = new Function(`${PLANET_JS}\nreturn polioPlanet;`)() as typeof made;
  return made!(host, o);
}
