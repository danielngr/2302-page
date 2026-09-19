/* ═══════════════════════════════════════════════════════════════════════
   VRM · LA BAHÍA EN RELIEVE, DENTRO DE LA FICHA        19 sep 2026

   Esto no es una foto inclinada ni un mapa de proveedor: es el terreno real
   levantado punto por punto. 373 248 alturas medidas de teselas Terrarium,
   una cada 107 metros, con la fotografía de Sentinel-2 encima. El mar es
   agua calculada —marejada de Gerstner, Fresnel, rompiente procedural—, no
   un azul pintado. WebGL escrito a mano, sin una sola librería.

   Lo que añade respecto a la maqueta suelta:
     · la cámara va al lugar que elige el huésped, encuadrando la casa y el
       destino a la vez, que es la pregunta de verdad ("¿qué tan lejos?");
     · las carreteras reales se dibujan SOBRE el relieve, siguiendo el suelo;
     · los avistamientos de ballena se hornean en el agua, no se pintan encima;
     · si el aparato no puede con esto, mapa.js se queda con el mapa plano.

   La proyección es la misma del mapa plano: el lienzo de 1200×760 y este
   encuadre de 82 × 52 km son la misma bahía, así que cualquier punto pasa de
   uno a otro con una regla de tres. Por eso los mismos datos sirven para los
   dos sin una tabla paralela que se desincronice.
   ═══════════════════════════════════════════════════════════════════════ */
window.VRM_MAPA_3D = (function () {
  'use strict';

  var W = 768, H = 607;                 // rejilla de alturas (una cada 107 m)
  var KM_X = 82.0, KM_Y = 64.973;       // tamaño real del encuadre, en km
  /* El encuadre se alargó 13 km al norte para que entren Sayulita y San
     Pancho. El lienzo de 1200×760 del mapa plano sigue siendo el mismo trozo
     de bahía: ocupa de z = −19.513 a z = 32.487 dentro del nuevo terreno, y
     estos dos números son los que lo colocan. Así ni una ruta, ni un lugar,
     ni una celda de ballena tuvo que recalcularse. */
  var Z0 = -19.513, Z1 = 32.487;
  var EXAG = 3.0;                       // exageración vertical, declarada
  var REALCE = 2.6, H0 = 150.0;         // refuerzo del relieve bajo, declarado
  var ISLOTE = 2.4;                     // y el de los islotes, también declarado

  /* ── la misma matemática mínima de siempre ─────────────────────────── */
  function perspectiva(fov, asp, near, far) {
    var f = 1 / Math.tan(fov / 2), nf = 1 / (near - far);
    return [f / asp, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0];
  }
  function mirar(ojo, cen, arr) {
    var z = nor(res(ojo, cen)), x = nor(cruz(arr, z)), y = cruz(z, x);
    return [x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0,
            -pun(x, ojo), -pun(y, ojo), -pun(z, ojo), 1];
  }
  function res(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function cruz(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function pun(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function nor(a) { var l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
  function mul(a, b) {
    var o = new Array(16);
    for (var i = 0; i < 4; i++) for (var j = 0; j < 4; j++) {
      var s = 0;
      for (var k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k];
      o[i * 4 + j] = s;
    }
    return o;
  }

  /* ── shaders ───────────────────────────────────────────────────────── */
  var VS = [
    'precision highp float;',
    'attribute vec3 pos; attribute vec2 uv; attribute vec3 nor; attribute float costa;',
    'uniform mat4 mvp; uniform float exag; uniform float tiempo; uniform float olaAlta;',
    'varying vec2 vUv; varying vec3 vNor; varying float vAlt; varying float vDist;',
    'varying float vCosta; varying vec3 vMundo; varying float vCresta;',
    /* Ola de Gerstner: la partícula no sube y baja, describe un círculo, y por
       eso la cresta se afila y el valle se ensancha. La frecuencia sale de la
       relación de dispersión en aguas profundas, ω = sqrt(g·k). */
    'vec3 gerstner(vec2 X, vec2 dir, float L, float A, float Q, float t){',
    '  float k = 6.28318530718 / L;',
    '  float w = sqrt(9.81 * k / 1000.0);',
    '  float f = k * dot(dir, X) - w * t;',
    '  return vec3(Q*A*dir.x*cos(f), A*sin(f), Q*A*dir.y*cos(f));',
    '}',
    'void main(){',
    '  vec3 p = vec3(pos.x, pos.y * exag * 0.001, pos.z);',
    '  float cresta = 0.0;',
    '  if(nor.y > -4.0 && pos.y < 6.0){',
    '    float ap = smoothstep(0.03, 0.9, costa) * olaAlta;',
    '    vec2 X = vec2(pos.x, pos.z);',
    /* La malla tiene un vértice cada 107 m: una ola de 250 m no cabe y sale
       moiré. La marejada geométrica va larga —de 900 m a 2 km, las bandas que
       se ven desde un avión— y el rizo corto vive en las normales. */
    '    vec3 o = gerstner(X, normalize(vec2(0.95,0.31)), 2.10, 1.00*ap, 0.50, tiempo)',
    '           + gerstner(X, normalize(vec2(0.91,0.42)), 1.33, 0.42*ap, 0.42, tiempo)',
    '           + gerstner(X, normalize(vec2(0.97,0.12)), 0.87, 0.20*ap, 0.34, tiempo);',
    '    p += o;',
    '    cresta = clamp(o.y / max(ap*1.4, 1e-6), -1.0, 1.0);',
    '  }',
    '  vCresta = cresta; vUv = uv;',
    '  vNor = (nor.y < -4.0) ? nor : normalize(vec3(nor.x, nor.y / max(exag,0.001), nor.z));',
    '  vAlt = pos.y; vCosta = costa; vMundo = p;',
    '  vec4 c = mvp * vec4(p, 1.0);',
    '  vDist = c.w; gl_Position = c;',
    '}'
  ].join('\n');

  var FS = [
    'precision highp float;',
    'uniform sampler2D piel; uniform sampler2D olas; uniform sampler2D mapaCosta;',
    'uniform sampler2D ballenas; uniform float verB;',
    'uniform vec3 sol; uniform vec3 ojo; uniform float tiempo;',
    'varying vec2 vUv; varying vec3 vNor; varying float vAlt; varying float vDist;',
    'varying float vCosta; varying vec3 vMundo; varying float vCresta;',
    'void main(){',
    '  vec3 c = texture2D(piel, vUv).rgb;',
    '  if(vNor.y < -4.0){',            // faldón: el canto de la pieza, sin textura
    '    float f = clamp((vAlt + 700.0) / 1100.0, 0.0, 1.0);',
    '    vec3 roca = mix(vec3(0.028,0.046,0.075), vec3(0.085,0.100,0.118), pow(f,0.7));',
    '    float b0 = 1.0 - exp(-vDist * 0.0085);',
    '    gl_FragColor = vec4(mix(roca, vec3(0.055,0.105,0.175), clamp(b0,0.0,0.82)), 1.0);',
    '    return;',
    '  }',
    '  vec3 n = normalize(vNor); vec3 L = normalize(sol);',
    '  float dif = max(dot(n, L), 0.0);',
    '  float cieloN = 0.55 + 0.45 * max(n.y, 0.0);',
    '  vec3 tierra = c * (0.42 * cieloN + 0.78 * dif);',
    /* El mar es agua, no la foto del agua. La distancia al litoral se lee por
       fragmento: con vértices cada 107 m la rompiente salía a bloques. */
    '  float costaF = texture2D(mapaCosta, vUv).r * 3.0;',
    '  vec3 V = normalize(ojo - vMundo);',
    '  float lejos = clamp((vDist - 22.0) / 135.0, 0.0, 1.0);',
    '  float fuerza = mix(1.0, 0.16, lejos);',
    '  float gg = tiempo * 0.012;',
    '  mat2 rot = mat2(cos(gg),-sin(gg),sin(gg),cos(gg));',
    '  vec3 t1 = texture2D(olas, vMundo.xz*0.95 + vec2(tiempo*0.0062, tiempo*0.0040)).rgb*2.0-1.0;',
    '  vec3 t2 = texture2D(olas, (rot*vMundo.xz)*0.28 - vec2(tiempo*0.0029, tiempo*0.0051)).rgb*2.0-1.0;',
    '  vec3 t3 = texture2D(olas, vMundo.xz*2.40 + vec2(-tiempo*0.0094, tiempo*0.0071)).rgb*2.0-1.0;',
    '  vec2 dn = (t1.xy*0.85 + t2.xy*1.10 + t3.xy*0.22*(1.0-lejos)) * fuerza;',
    '  vec3 nw = normalize(vec3(dn.x, 1.0, dn.y));',
    '  float fres = pow(1.0 - max(dot(V, nw), 0.0), 4.0);',
    '  float prof = smoothstep(0.0, 2.6, costaF);',
    '  vec3 hondo = vec3(0.010,0.046,0.102);',
    '  vec3 bajo  = vec3(0.060,0.195,0.258);',
    '  vec3 cieloAg = vec3(0.118,0.178,0.295);',
    '  float banda = 0.5 + 0.5 * vCresta;',
    '  vec3 agua = mix(mix(bajo, hondo, prof), cieloAg, clamp(0.05 + 0.82*fres + 0.06*(banda-0.5), 0.0, 0.93));',
    '  agua *= 0.96 + 0.08 * banda;',
    '  vec3 hv = normalize(L + V);',
    '  float esp = max(dot(nw, hv), 0.0);',
    '  float ancho = mix(34.0, 14.0, lejos);',
    '  agua += vec3(1.0,0.97,0.90) * pow(esp, ancho) * mix(0.42, 0.14, lejos);',
    '  agua += vec3(0.82,0.88,1.00) * pow(esp, 9.0) * 0.10;',
    '  float bajio = 1.0 - smoothstep(0.0, 0.55, costaF);',
    '  agua = mix(agua, mix(agua, vec3(0.16,0.42,0.50), 0.55), bajio * 0.75);',
    '  float r1 = texture2D(olas, vMundo.xz*2.6 + vec2(tiempo*0.009, -tiempo*0.006)).b;',
    '  float r2 = texture2D(olas, vMundo.xz*7.1 - vec2(tiempo*0.019, tiempo*0.012)).b;',
    '  float pulso = 0.40 + 0.60 * smoothstep(0.30, 0.86, r1*0.62 + r2*0.48);',
    '  float franja = 1.0 - smoothstep(0.0, 0.115, costaF);',
    '  float rompe = pow(franja, 1.5) * pulso;',
    '  agua = mix(agua, vec3(0.88,0.93,0.96), clamp(rompe*0.80, 0.0, 0.92));',
    '  float mar = 1.0 - smoothstep(1.5, 18.0, vAlt);',
    '  vec3 col = mix(tierra, agua, mar);',
    /* Los avistamientos van EN el agua, no encima de la pantalla: así se
       hunden con la perspectiva y la bruma, como cualquier otra cosa que
       esté ahí de verdad. */
    '  if(verB > 0.001) col += texture2D(ballenas, vUv).rgb * verB * mar;',
    '  float b = 1.0 - exp(-vDist * 0.0085);',
    '  col = mix(col, vec3(0.055,0.105,0.175), clamp(b, 0.0, 0.82));',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  /* ── ¿puede este aparato? ──────────────────────────────────────────── */
  function hayWebGL() {
    try {
      var c = document.createElement('canvas');
      return !!(c.getContext('webgl2') || c.getContext('webgl'));
    } catch (e) { return false; }
  }

  /* ═══════════════════════════════════════════════════════════════════ */
  function crear(opciones) {
    var cont = opciones.lienzo;              // el .mp-lienzo de la ficha
    var BASE = opciones.base;
    var alListo = opciones.listo || function () { };
    var alFallo = opciones.fallo || function () { };

    var cv = document.createElement('canvas');
    cv.className = 'mp-gl';
    cont.insertBefore(cv, cont.firstChild);

    var gl = cv.getContext('webgl2', { antialias: true, alpha: false }) ||
             cv.getContext('webgl', { antialias: true, alpha: false });
    if (!gl) { alFallo('sin webgl'); return null; }
    var esVer2 = !!cv.getContext('webgl2');

    var prog, nIdx = 0, ALT = null, listo = false;
    var texBallenas = null, verB = 0;

    function compilar(t, s) {
      var o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o);
      if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o));
      return o;
    }
    try {
      prog = gl.createProgram();
      gl.attachShader(prog, compilar(gl.VERTEX_SHADER, VS));
      gl.attachShader(prog, compilar(gl.FRAGMENT_SHADER, FS));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
      gl.useProgram(prog);
    } catch (e) { alFallo('shaders: ' + e.message); return null; }

    var U = {};
    function u(n) { if (!(n in U)) U[n] = gl.getUniformLocation(prog, n); return U[n]; }

    /* ── del lienzo del mapa plano a este mundo ──────────────────────
       Las dos vistas son la misma bahía en el mismo encuadre, así que un
       punto pasa de una a otra con una regla de tres. */
    function aMundo(cx, cy) {
      var ux = cx / 1200;
      var z = Z0 + (cy / 760) * (Z1 - Z0);
      var uy = (z + KM_Y / 2) / KM_Y;                  // y dentro de la rejilla
      return [(ux - 0.5) * KM_X, alturaEn(ux, uy) * EXAG * 0.001, z];
    }
    function alturaEn(ux, uy) {
      if (!ALT) return 0;
      var x = Math.max(0, Math.min(W - 1.001, ux * (W - 1)));
      var y = Math.max(0, Math.min(H - 1.001, uy * (H - 1)));
      var i = x | 0, j = y | 0, fx = x - i, fy = y - j;
      var a = ALT[j * W + i], b = ALT[j * W + i + 1];
      var c = ALT[(j + 1) * W + i], d = ALT[(j + 1) * W + i + 1];
      return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
    }

    /* ── cámara ────────────────────────────────────────────────────────
       Mira a un punto que se mueve: al elegir un lugar, el encuadre se va
       al punto medio entre la casa y ese lugar y se acerca lo justo para
       que quepan los dos. Esa es la pregunta de verdad del huésped: no
       "dónde está Vallarta" sino "qué tan lejos me queda". */
    var giro = -2.55, inclina = 0.47, dist = 82;
    var giroD = giro, inclinaD = inclina, distD = dist;
    var centro = [0, 0.6, 0], centroD = [0, 0.6, 0];

    function mirarA(mundo, d, inc) {
      centro = [mundo[0], mundo[1] + 0.6, mundo[2]];
      dist = Math.max(22, Math.min(180, d));
      if (inc != null) inclina = inc;
    }

    /* ── el terreno ────────────────────────────────────────────────── */
    function imagen(src) {
      return new Promise(function (ok, no) {
        var i = new Image(); i.crossOrigin = 'anonymous';
        i.onload = function () { ok(i); }; i.onerror = no; i.src = src;
      });
    }
    var R = opciones.ruta || function (f) { return BASE + f; };

    /* En teléfono la malla va a la mitad de resolución: 93 000 vértices en
       vez de 373 000. La bahía se ve igual desde la distancia a la que se
       mira en una pantalla de seis pulgadas, y el aparato no se ahoga. */
    var PASO = (innerWidth < 720 || (navigator.hardwareConcurrency || 8) <= 4) ? 2 : 1;

    Promise.all([
      imagen(R('altura.png')), imagen(R('piel.webp')),
      imagen(R('olas.webp')), imagen(R('costa.webp')), imagen(R('islotes.png'))
    ]).then(function (im) {
      var ia = im[0], it = im[1], io = im[2], ic = im[3], ii = im[4];
      try { construir(ia, it, io, ic, ii); }
      catch (e) { alFallo('malla: ' + e.message); }
    }).catch(function () { alFallo('no cargaron las texturas'); });

    function construir(ia, it, io, ic, ii) {
      var c = document.createElement('canvas'); c.width = W; c.height = H;
      var g = c.getContext('2d', { willReadFrequently: true });
      g.drawImage(ia, 0, 0);
      var d = g.getImageData(0, 0, W, H).data;
      /* La marca de islotes viene en su propio archivo, en gris. No puede ir
         en el alfa del mapa de alturas: un PNG con alfa, al leerlo de un
         lienzo, vuelve con el color machacado donde el alfa es bajo, y el
         color es justo donde están los metros. */
      var isla = null;
      if (ii) {
        g.clearRect(0, 0, W, H); g.drawImage(ii, 0, 0);
        isla = g.getImageData(0, 0, W, H).data;
      }

      /* Realce de relieve bajo, declarado. Los datos públicos dan 49 m a las
         Marietas —lo comprobé hasta 9 m por píxel: el modelo las alisa—, y
         49 m sobre una placa de 82 km son invisibles. Esta curva levanta lo
         bajo y deja lo alto intacto: a 49 m multiplica por 2.9, a 500 m
         añade un 9 %, a 2 000 m no hace nada. El pico sigue siendo el que
         mide el satélite. */
      function realzar(h) { return h + REALCE * h * Math.exp(-h / H0); }
      /* Los islotes aparte. El dato los tiene —las Marietas miden 49 m y Los
         Arcos 28, y eso es correcto—, pero 49 metros sobre un escenario de
         82 km no se ven, y además el agua empieza a los 18 m, así que salían
         planos Y azules: el mapa los daba por mar. Este factor los saca del
         agua y los deja del tamaño de una roca. Va declarado en el pie. */
      ALT = new Float32Array(W * H);
      var COS = new Float32Array(W * H);
      for (var k = 0; k < W * H; k++) {
        var hh = realzar(d[k * 4] * 256 + d[k * 4 + 1]);
        if (isla && isla[k * 4]) hh *= 1 + (ISLOTE - 1) * (isla[k * 4] / 255);
        ALT[k] = hh;
        COS[k] = d[k * 4 + 2] / 255 * 4.0;                 // canal azul: km al litoral
      }

      var MW = Math.floor((W - 1) / PASO) + 1, MH = Math.floor((H - 1) / PASO) + 1;
      var pos = new Float32Array(MW * MH * 3), uvA = new Float32Array(MW * MH * 2),
          nrm = new Float32Array(MW * MH * 3), cst = new Float32Array(MW * MH);
      var dx = KM_X / (W - 1) * PASO, dz = KM_Y / (H - 1) * PASO;
      for (var j = 0; j < MH; j++) for (var i = 0; i < MW; i++) {
        var si = Math.min(W - 1, i * PASO), sj = Math.min(H - 1, j * PASO);
        var m = j * MW + i, s = sj * W + si;
        pos[m * 3] = (si / (W - 1) - 0.5) * KM_X;
        pos[m * 3 + 1] = ALT[s];
        pos[m * 3 + 2] = (sj / (H - 1) - 0.5) * KM_Y;
        uvA[m * 2] = si / (W - 1); uvA[m * 2 + 1] = sj / (H - 1);
        cst[m] = COS[s];
        var hl = ALT[sj * W + Math.max(0, si - PASO)], hr = ALT[sj * W + Math.min(W - 1, si + PASO)];
        var hu = ALT[Math.max(0, sj - PASO) * W + si], hd = ALT[Math.min(H - 1, sj + PASO) * W + si];
        var nn = nor([-(hr - hl) * 0.001, 2 * dx, -(hd - hu) * 0.001 * dx / dz]);
        nrm[m * 3] = nn[0]; nrm[m * 3 + 1] = nn[1]; nrm[m * 3 + 2] = nn[2];
      }

      /* Faldón: el borde baja en vertical hasta una base. Sin esto el terreno
         es una hoja de papel y se le ve el canto; con esto es una pieza. */
      var borde = [], ii, jj;
      for (ii = 0; ii < MW; ii++) borde.push(ii);
      for (jj = 1; jj < MH; jj++) borde.push(jj * MW + (MW - 1));
      for (ii = MW - 2; ii >= 0; ii--) borde.push((MH - 1) * MW + ii);
      for (jj = MH - 2; jj >= 1; jj--) borde.push(jj * MW);
      var NB = borde.length, BASEY = -700, NV = MW * MH;
      var pos2 = new Float32Array((NV + NB * 2) * 3), uv2 = new Float32Array((NV + NB * 2) * 2),
          nrm2 = new Float32Array((NV + NB * 2) * 3), cos2 = new Float32Array(NV + NB * 2);
      pos2.set(pos); uv2.set(uvA); nrm2.set(nrm); cos2.set(cst);
      for (var q = 0; q < NB; q++) {
        var v = borde[q];
        var pares = [[NV + q, null], [NV + NB + q, BASEY]];
        for (var z = 0; z < 2; z++) {
          var off = pares[z][0], alt = pares[z][1];
          pos2[off * 3] = pos[v * 3]; pos2[off * 3 + 2] = pos[v * 3 + 2];
          pos2[off * 3 + 1] = alt === null ? pos[v * 3 + 1] : BASEY;
          uv2[off * 2] = uvA[v * 2]; uv2[off * 2 + 1] = uvA[v * 2 + 1];
          nrm2[off * 3] = 0; nrm2[off * 3 + 1] = -9; nrm2[off * 3 + 2] = 0;  // marca de faldón
          cos2[off] = cst[v];
        }
      }

      var extU32 = esVer2 || gl.getExtension('OES_element_index_uint');
      var Arr = extU32 ? Uint32Array : Uint16Array;
      if (!extU32 && NV + NB * 2 > 65535) throw new Error('la malla no cabe');
      var idx = new Arr((MW - 1) * (MH - 1) * 6 + NB * 6), p = 0;
      for (j = 0; j < MH - 1; j++) for (i = 0; i < MW - 1; i++) {
        var a = j * MW + i, b = a + 1, c2 = a + MW, d2 = c2 + 1;
        idx[p++] = a; idx[p++] = c2; idx[p++] = b; idx[p++] = b; idx[p++] = c2; idx[p++] = d2;
      }
      for (q = 0; q < NB; q++) {
        var a2 = NV + q, b2 = NV + (q + 1) % NB, c3 = NV + NB + q, d3 = NV + NB + (q + 1) % NB;
        idx[p++] = a2; idx[p++] = c3; idx[p++] = b2; idx[p++] = b2; idx[p++] = c3; idx[p++] = d3;
      }
      nIdx = p;

      function buf(datos, loc, n) {
        var bb = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, bb); gl.bufferData(gl.ARRAY_BUFFER, datos, gl.STATIC_DRAW);
        var l = gl.getAttribLocation(prog, loc);
        gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, n, gl.FLOAT, false, 0, 0);
      }
      buf(pos2, 'pos', 3); buf(uv2, 'uv', 2); buf(nrm2, 'nor', 3); buf(cos2, 'costa', 1);
      var ib = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
      var TIPO = extU32 ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;

      function textura(unidad, img, repite, mipmap) {
        var t = gl.createTexture();
        gl.activeTexture(gl.TEXTURE0 + unidad);
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
        var modo = repite ? gl.REPEAT : gl.CLAMP_TO_EDGE;
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, modo);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, modo);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER,
          mipmap ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        if (mipmap) gl.generateMipmap(gl.TEXTURE_2D);
        gl.activeTexture(gl.TEXTURE0);
        return t;
      }
      var tPiel = textura(0, it, false, true);
      var anis = gl.getExtension('EXT_texture_filter_anisotropic');
      if (anis) {
        gl.bindTexture(gl.TEXTURE_2D, tPiel);
        gl.texParameterf(gl.TEXTURE_2D, anis.TEXTURE_MAX_ANISOTROPY_EXT,
          Math.min(8, gl.getParameter(anis.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
      }
      textura(1, io, true, true);
      textura(3, ic, false, true);
      gl.uniform1i(u('piel'), 0);
      gl.uniform1i(u('olas'), 1);
      gl.uniform1i(u('mapaCosta'), 3);
      gl.uniform1i(u('ballenas'), 4);
      gl.uniform1f(u('verB'), 0);

      gl.enable(gl.DEPTH_TEST);
      gl.clearColor(0.020, 0.039, 0.078, 1);
      listo = true;
      medir();
      alListo({ piel: tPiel, tipo: TIPO });
      requestAnimationFrame(cuadro);

      /* La piel de 4096 px se pide sola cuando alguien se acerca de verdad:
         hasta entonces la de 2048 sobra y pesa la mitad. */
      var altaPedida = false;
      api.quizaAlta = function () {
        if (altaPedida || distD > 46) return;
        altaPedida = true;
        imagen(R('piel@2x.webp')).then(function (i2) {
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, tPiel);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, i2);
          gl.generateMipmap(gl.TEXTURE_2D);
        }).catch(function () { });
      };
      api.dibuja = function () { gl.drawElements(gl.TRIANGLES, nIdx, TIPO, 0); };
    }

    /* ── los avistamientos, horneados en el agua ────────────────────── */
    function ponerBallenas(txt) {
      if (!txt || texBallenas) return;
      var c = document.createElement('canvas'); c.width = 1024; c.height = 648;
      var x = c.getContext('2d');
      x.fillStyle = '#000'; x.fillRect(0, 0, c.width, c.height);
      x.globalCompositeOperation = 'lighter';
      var ex = c.width / 1200, ey = c.height / 760;
      var celdas = txt.split(' ');
      for (var i = 0; i < celdas.length; i++) {
        var q = celdas[i].split(','), px = (+q[0]) * 3 * ex, py = (+q[1]) * 3 * ey, n = +q[2];
        var f = Math.pow(Math.min(n, 99) / 99, 0.42);
        var r = (5.5 + 17 * f) * ex, a = 0.10 + 0.30 * f;
        var gd = x.createRadialGradient(px, py, 0, px, py, r);
        gd.addColorStop(0, 'rgba(255,226,168,' + a.toFixed(3) + ')');
        gd.addColorStop(0.45, 'rgba(240,196,126,' + (a * 0.42).toFixed(3) + ')');
        gd.addColorStop(1, 'rgba(217,119,87,0)');
        x.fillStyle = gd; x.beginPath(); x.arc(px, py, r, 0, 6.2832); x.fill();
      }
      texBallenas = gl.createTexture();
      gl.activeTexture(gl.TEXTURE4);
      gl.bindTexture(gl.TEXTURE_2D, texBallenas);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, c);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.activeTexture(gl.TEXTURE0);
    }

    /* ── medir y pintar ────────────────────────────────────────────── */
    var asp = 16 / 9, t0 = performance.now(), mvp = null, anchoCss = 1, altoCss = 1;
    function medir() {
      var r = cont.getBoundingClientRect();
      if (!r.width || !r.height) return;
      var dpr = Math.min(devicePixelRatio || 1, PASO > 1 ? 1.5 : 2);
      anchoCss = r.width; altoCss = r.height;
      cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
      gl.viewport(0, 0, cv.width, cv.height);
      asp = r.width / r.height;
    }
    addEventListener('resize', medir);

    var enPantalla = true;
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        enPantalla = es[0].isIntersecting;
        if (enPantalla && listo) requestAnimationFrame(cuadro);
      }, { rootMargin: '120px' }).observe(cont);
    }

    function cuadro() {
      if (!listo) return;
      giroD += (giro - giroD) * 0.075;
      inclinaD += (inclina - inclinaD) * 0.075;
      distD += (dist - distD) * 0.075;
      for (var i = 0; i < 3; i++) centroD[i] += (centro[i] - centroD[i]) * 0.075;

      var oy = Math.sin(inclinaD) * distD, rr = Math.cos(inclinaD) * distD;
      var ojo = [centroD[0] + Math.sin(giroD) * rr,
                 Math.max(centroD[1] + oy, 3),
                 centroD[2] + Math.cos(giroD) * rr];
      mvp = mul(perspectiva(0.62, asp, 1.2, 420), mirar(ojo, centroD, [0, 1, 0]));

      gl.uniformMatrix4fv(u('mvp'), false, new Float32Array(mvp));
      gl.uniform1f(u('exag'), EXAG);
      gl.uniform3f(u('sol'), -0.52, 0.66, 0.54);
      gl.uniform3f(u('ojo'), ojo[0], ojo[1], ojo[2]);
      gl.uniform1f(u('tiempo'), (performance.now() - t0) / 1000);
      gl.uniform1f(u('verB'), verB);
      // la ola crece cuando te acercas: a 80 km no se ve, de cerca sí
      gl.uniform1f(u('olaAlta'), 0.0022 + 0.0060 * Math.max(0, 1 - (distD - 26) / 80));
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      if (api.dibuja) api.dibuja();
      if (api.quizaAlta) api.quizaAlta();
      if (opciones.cuadro) opciones.cuadro(proyectar, anchoCss, altoCss);
      if (enPantalla) requestAnimationFrame(cuadro);
    }

    /* Un punto del lienzo del mapa plano, puesto donde le toca en pantalla.
       Devuelve null si cae detrás de la cámara. */
    function proyectar(cx, cy, sobre) {
      if (!mvp) return null;
      var m = aMundo(cx, cy);
      var y = m[1] + (sobre || 0);
      var X = mvp[0] * m[0] + mvp[4] * y + mvp[8] * m[2] + mvp[12];
      var Y = mvp[1] * m[0] + mvp[5] * y + mvp[9] * m[2] + mvp[13];
      var Wc = mvp[3] * m[0] + mvp[7] * y + mvp[11] * m[2] + mvp[15];
      if (Wc <= 0.05) return null;
      return [(X / Wc * 0.5 + 0.5) * anchoCss, (1 - (Y / Wc * 0.5 + 0.5)) * altoCss, Wc];
    }

    /* ── girar, inclinar, acercar ───────────────────────────────────── */
    var dedos = new Map(), ini = null, movido = 0;
    cont.addEventListener('pointerdown', function (e) {
      /* Un alfiler o un botón no arrastran nada. Pero hay que poner a cero el
         contador de arrastre igual: si no, el arrastre ANTERIOR seguía contando
         y el primer clic sobre un lugar se descartaba como si fuera un tirón.
         Girabas el mapa, tocabas Vallarta y no pasaba nada. */
      if (e.target.closest && (e.target.closest('button') || e.target.closest('.mp-p3'))) {
        movido = 0;
        return;
      }
      dedos.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (dedos.size === 1) { ini = { x: e.clientX, y: e.clientY, g: giro, i: inclina }; movido = 0; }
      if (dedos.size === 2) {
        var v = [].slice.call(dedos.values());
        ini = { d: Math.hypot(v[0].x - v[1].x, v[0].y - v[1].y), z: dist };
      }
      cont.setPointerCapture(e.pointerId);
      cont.classList.add('mp-arrastrando');
    });
    cont.addEventListener('pointermove', function (e) {
      if (!dedos.has(e.pointerId)) return;
      dedos.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (dedos.size === 1 && ini && ini.g !== undefined) {
        movido = Math.max(movido, Math.hypot(e.clientX - ini.x, e.clientY - ini.y));
        giro = ini.g + (e.clientX - ini.x) * 0.005;
        inclina = Math.max(0.14, Math.min(1.35, ini.i + (e.clientY - ini.y) * 0.004));
      } else if (dedos.size === 2 && ini && ini.d) {
        var v = [].slice.call(dedos.values());
        dist = Math.max(22, Math.min(180, ini.z * ini.d / Math.hypot(v[0].x - v[1].x, v[0].y - v[1].y)));
      }
    });
    function soltar(e) {
      dedos.delete(e.pointerId);
      if (!dedos.size) { ini = null; cont.classList.remove('mp-arrastrando'); }
    }
    cont.addEventListener('pointerup', soltar);
    cont.addEventListener('pointercancel', soltar);
    /* La rueda sin más sigue bajando la página: el mapa no secuestra el
       scroll. Se acerca con ctrl/⌘, con los botones o pellizcando. */
    cont.addEventListener('wheel', function (e) {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      dist = Math.max(22, Math.min(180, dist * Math.pow(1.0016, e.deltaY)));
    }, { passive: false });

    var api = {
      gl: gl,
      esta: function () { return listo; },
      medir: medir,
      proyectar: proyectar,
      aMundo: aMundo,
      mirarA: mirarA,
      arrastrado: function () { return movido; },
      acercar: function (f) { dist = Math.max(22, Math.min(180, dist * f)); },
      distancia: function () { return distD; },
      ballenas: function (on, txt) { if (on) ponerBallenas(txt); verB = on ? 1 : 0; },
      rumbo: function (g, inc) { if (g != null) giro = g; if (inc != null) inclina = inc; }
    };
    return api;
  }

  return { hay: hayWebGL, crear: crear, KM_X: KM_X, KM_Y: KM_Y };
})();
