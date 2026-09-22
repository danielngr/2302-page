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
    'uniform sampler2D nubes; uniform vec2 viento; uniform float sombraN;',
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
    /* la sombra: cada punto del suelo mira hacia el sol y pregunta cuánta
       nube hay en medio. Es lo que más vende que las nubes son de verdad. */
    '  if(sombraN > 0.001){',
    '    vec3 Ls = normalize(sol);',
    '    vec3 qS = vMundo + Ls * ((4.4 - vMundo.y) / Ls.y);',
    '    vec2 uS = vec2(qS.x/82.0+0.5, qS.z/64.973+0.5);',
    '    vec2 mS = texture2D(nubes, uS - viento*tiempo, 1.5).rg;',
    '    vec2 sS = texture2D(nubes, uS, 1.5).ba;',
    '    float cS = clamp((mS.r - (0.655 - 0.15*sS.x))*4.2, 0.0, 1.0)*(0.45+0.55*mS.g)*sS.y;',
    '    col *= 1.0 - 0.52 * sombraN * smoothstep(0.06, 0.55, cS);',
    '  }',
    '  float b = 1.0 - exp(-vDist * 0.0085);',
    '  col = mix(col, vec3(0.055,0.105,0.175), clamp(b, 0.0, 0.82));',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  /* ── las nubes ─────────────────────────────────────────────────────
     No son fotos de una nube: son un volumen. En cada píxel se lanza un
     rayo que atraviesa la capa (de 900 a 2 600 m, con la misma
     exageración ×3 que el relieve) y se va sumando cuánta nube hay y
     cuánta luz del sol le llega. Por eso están fijas en el cielo y no
     giran contigo: al girar el mapa les ves otro lado. */
  var VS_NUBES = "attribute vec2 pos; varying vec2 vN;\nvoid main(){ vN = pos; gl_Position = vec4(pos, 0.0, 1.0); }";
  var FS_NUBES = "precision highp float;\nuniform sampler2D nubes; uniform sampler2D alturas;\nuniform mat4 inv; uniform vec3 ojo; uniform vec3 sol;\nuniform float tiempo; uniform vec2 viento;\nvarying vec2 vN;\nconst float BASE = 2.7, TOPE = 7.8, KX = 82.0, KZ = 64.973;\n\nfloat h3(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }\nfloat n3(vec3 x){\n  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);\n  return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),\n             mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z);\n}\nvec2 uvF(vec3 p){ return vec2(p.x / KX + 0.5, p.z / KZ + 0.5); }\n/* El campo de nubes viaja con el viento; lo que no viaja es el terreno:\n   sobre la sierra la nube crece, sobre el mar se deshace. Por eso la\n   cobertura sale de DOS lecturas de la misma textura: rojo y verde se\n   mueven, azul (la sierra) y alfa (el claro de la casa) se quedan. */\nfloat cobertura(vec3 p, out float tope){\n  vec2 m = texture2D(nubes, uvF(p) - viento * tiempo).rg;\n  vec2 s = texture2D(nubes, uvF(p)).ba;\n  tope = min(1.0, 0.30 + 0.55 * m.g + 0.25 * s.x);\n  return clamp((m.r - (0.655 - 0.15 * s.x)) * 4.2, 0.0, 1.0) * (0.45 + 0.55 * m.g) * s.y;\n}\nfloat perfil(float h, float tope){ return smoothstep(0.0, 0.08, h) * (1.0 - smoothstep(tope * 0.45, tope, h)); }\nfloat grueso(vec3 p){\n  float tope; float c = cobertura(p, tope);\n  return c * perfil((p.y - BASE) / (TOPE - BASE), tope);\n}\nfloat dens(vec3 p){\n  float g = grueso(p);\n  if (g < 0.015) return 0.0;\n  /* el detalle viaja con la nube (si no, la forma \"resbalar\u00eda\" por dentro)\n     y adem\u00e1s hierve despacio */\n  vec2 wk = viento * vec2(KX, KZ) * tiempo;\n  vec3 q = (p - vec3(wk.x, 0.0, wk.y)) * vec3(1.45, 1.9, 1.45) + vec3(0.0, tiempo * 0.006, tiempo * 0.004);\n  float d = n3(q) * 0.52 + n3(q * 2.37) * 0.30 + DETALLE;\n  return clamp(g * 1.3 - (1.0 - d) * 0.64, 0.0, 1.0);\n}\nfloat suelo(vec3 p){ return texture2D(alturas, uvF(p)).r * 8.0; }\n\nvoid main(){\n  vec4 a4 = inv * vec4(vN, -1.0, 1.0), b4 = inv * vec4(vN, 1.0, 1.0);\n  vec3 ro = ojo;\n  vec3 rd = normalize(b4.xyz / b4.w - a4.xyz / a4.w);\n  vec3 bmin = vec3(-KX * 0.5, BASE, -KZ * 0.5), bmax = vec3(KX * 0.5, TOPE, KZ * 0.5);\n  vec3 iv = 1.0 / rd;\n  vec3 t0 = (bmin - ro) * iv, t1 = (bmax - ro) * iv;\n  vec3 tn = min(t0, t1), tf = max(t0, t1);\n  float a = max(max(tn.x, tn.y), max(tn.z, 0.0));\n  float b = min(min(tf.x, tf.y), tf.z);\n  if (b <= a) discard;\n  for (int k = 1; k <= 6; k++) {\n    vec3 pk = ro + rd * (a * float(k) / 6.0);\n    if (pk.y < suelo(pk)) discard;\n  }\n  b = min(b, a + 64.0);\n  const int N = PASOS;\n  float dt = (b - a) / float(N);\n  float jit = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);\n  float t = a + dt * jit;\n  vec3 L = normalize(sol);\n  float cth = dot(rd, L);\n  float g1 = 0.6, g2 = -0.2;\n  float hg1 = (1.0 - g1 * g1) / pow(1.0 + g1 * g1 - 2.0 * g1 * cth, 1.5);\n  float hg2 = (1.0 - g2 * g2) / pow(1.0 + g2 * g2 - 2.0 * g2 * cth, 1.5);\n  float fase = 0.55 + 0.45 * mix(hg2, hg1, 0.6);\n  vec3 C = vec3(0.0); float T = 1.0; float tPrim = -1.0;\n  for (int i = 0; i < N; i++) {\n    vec3 p = ro + rd * t;\n    if (p.y < suelo(p)) break;\n    float d = dens(p);\n    if (d > 0.002) {\n      if (tPrim < 0.0) tPrim = t;\n      float sig = d * 10.0;\n      float ls = grueso(p + L * 0.35) + grueso(p + L * 0.8) + grueso(p + L * 1.5);\n      float luz = exp(-ls * 1.5);\n      float polvo = 1.0 - exp(-sig * 0.7);\n      float h = clamp((p.y - BASE) / (TOPE - BASE), 0.0, 1.0);\n      vec3 solC = vec3(1.0, 0.955, 0.885) * 2.1;\n      vec3 amb = mix(vec3(0.24, 0.29, 0.38), vec3(0.66, 0.74, 0.86), h);\n      vec3 col = solC * luz * fase * (0.35 + 0.65 * polvo) + amb;\n      float e = exp(-sig * dt);\n      C += T * col * (1.0 - e);\n      T *= e;\n      if (T < 0.02) break;\n    }\n    t += dt;\n    if (t > b) break;\n  }\n  float alfa = 1.0 - T;\n  if (alfa < 0.003) discard;\n  float db = 1.0 - exp(-(tPrim > 0.0 ? tPrim : a) * 0.0085);\n  C = mix(C, vec3(0.055, 0.105, 0.175) * alfa, clamp(db, 0.0, 0.82));\n  gl_FragColor = vec4(min(C, vec3(1.0)), alfa);\n}";

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
    /* El viento sopla del oeste-noroeste, la brisa de mar de la tarde en
       la bahía: las nubes avanzan hacia el este-sureste. Va acelerado a
       propósito —como un time-lapse—: a velocidad real no se notaría. */
    var OJO = [0, 40, 0], VIENTO = [0.0018, 0.0008], nubesOn = false, sombraN = 0, progN = null;
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

      /* los atributos del terreno se guardan: el pase de nubes usa otro
         programa y hay que volver a enchufarlos en cada cuadro */
      var ATRS = [];
      function buf(datos, loc, n) {
        var bb = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, bb); gl.bufferData(gl.ARRAY_BUFFER, datos, gl.STATIC_DRAW);
        var l = gl.getAttribLocation(prog, loc);
        gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, n, gl.FLOAT, false, 0, 0);
        ATRS.push([bb, l, n]);
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

      /* ═══ NUBES ══════════════════════════════════════════════════════
         Si algo de esto falla, solo se quedan sin nubes: el mapa sigue. */
      var triB = null, locN = -1, UN = {};
      function uN(n) { if (!(n in UN)) UN[n] = gl.getUniformLocation(progN, n); return UN[n]; }
      try {
        /* En teléfono, menos pasos por rayo y una octava de detalle menos:
           se ven casi igual a ese tamaño y cuestan la mitad. */
        var ligero = PASO > 1;
        var fsN = FS_NUBES.replace('PASOS', ligero ? '30' : '56')
                          .replace('DETALLE', ligero ? '0.12' : 'n3(q * 5.3) * 0.18');
        progN = gl.createProgram();
        gl.attachShader(progN, compilar(gl.VERTEX_SHADER, VS_NUBES));
        gl.attachShader(progN, compilar(gl.FRAGMENT_SHADER, fsN));
        gl.linkProgram(progN);
        if (!gl.getProgramParameter(progN, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(progN));

        /* La textura de nubes, 512 × 512:
             rojo  — el campo grande de nubes      (viaja con el viento)
             verde — las bolas de cada cúmulo      (viaja con el viento)
             azul  — cuánta sierra hay debajo      (fija)
             alfa  — el claro encima de la casa    (fijo)
           Rojo y verde son ruido periódico: cuando el viento los saca por
           un lado entran por el otro sin costura. */
        var CN = 512, cob = new Uint8Array(CN * CN * 4);
        var hsh = function (x, y) { var s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
        var md = function (a, p) { return ((a % p) + p) % p; };
        var vnP = function (x, y, px, py) {
          var i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j;
          fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
          var i0 = md(i, px), i1 = md(i + 1, px), j0 = md(j, py), j1 = md(j + 1, py);
          var a = hsh(i0, j0), b = hsh(i1, j0), c = hsh(i0, j1), d = hsh(i1, j1);
          return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
        };
        var fbmP = function (u, v, px, py, o, sem) {
          var s = 0, a = 0.5, t = 0;
          for (var k = 0; k < o; k++) {
            s += a * vnP(u * px + sem, v * py + sem * 0.7, px, py); t += a;
            px *= 2; py *= 2; a *= 0.5;
          }
          return s / t;
        };
        var ss = function (a, b, x) { var t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
        /* la casa, en la misma rejilla (La Cruz de Huanacaxtle) */
        var casaU = 0.598, casaV = 0.341;
        if (opciones.casa) { var cm = aMundo(opciones.casa[0], opciones.casa[1]); casaU = cm[0] / KM_X + 0.5; casaV = cm[2] / KM_Y + 0.5; }
        for (var cj = 0; cj < CN; cj++) for (var ci = 0; ci < CN; ci++) {
          var uu = ci / CN, vv = cj / CN, o4 = (cj * CN + ci) * 4;
          /* los periodos enteros hacen el ruido periódico; los tamaños salen
             de ellos: 11 × 9 celdas ≈ nubarrones de 7 km, 66 × 52 ≈ cúmulos de 1.2 km */
          cob[o4] = Math.round(fbmP(uu, vv, 11, 9, 4, 3.1) * 255);
          cob[o4 + 1] = Math.round(fbmP(uu, vv, 66, 52, 3, 17.3) * 255);
          cob[o4 + 2] = Math.round(ss(60, 950, alturaEn(uu, vv)) * 255);
          var dx = (uu - casaU) * KM_X, dz = (vv - casaV) * KM_Y;
          /* ~4 km despejados encima de la casa: el mapa existe para verla */
          cob[o4 + 3] = Math.round(ss(2.2, 5.0, Math.sqrt(dx * dx + dz * dz)) * 255);
        }
        gl.activeTexture(gl.TEXTURE5);
        gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, CN, CN, 0, gl.RGBA, gl.UNSIGNED_BYTE, cob);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.generateMipmap(gl.TEXTURE_2D);

        /* las alturas, para que el rayo sepa cuándo se metió en una montaña */
        var CA = 256, alt8 = new Uint8Array(CA * CA);
        for (var aj = 0; aj < CA; aj++) for (var ai = 0; ai < CA; ai++)
          alt8[aj * CA + ai] = Math.min(255, Math.round(alturaEn(ai / (CA - 1), aj / (CA - 1)) * EXAG * 0.001 / 8 * 255));
        gl.activeTexture(gl.TEXTURE6);
        gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, CA, CA, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, alt8);
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.activeTexture(gl.TEXTURE0);

        gl.useProgram(progN);
        gl.uniform1i(uN('nubes'), 5);
        gl.uniform1i(uN('alturas'), 6);
        locN = gl.getAttribLocation(progN, 'pos');
        triB = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, triB);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
        gl.useProgram(prog);
        gl.uniform1i(u('nubes'), 5);
        nubesOn = true;
      } catch (eN) {
        progN = null; nubesOn = false;
        gl.useProgram(prog);
        if (window.console) console.warn('VRM mapa: sin nubes (' + eN.message + ')');
      }

      function invertir(m) {
        var o = new Array(16), det;
        o[0] = m[5]*m[10]*m[15]-m[5]*m[11]*m[14]-m[9]*m[6]*m[15]+m[9]*m[7]*m[14]+m[13]*m[6]*m[11]-m[13]*m[7]*m[10];
        o[4] = -m[4]*m[10]*m[15]+m[4]*m[11]*m[14]+m[8]*m[6]*m[15]-m[8]*m[7]*m[14]-m[12]*m[6]*m[11]+m[12]*m[7]*m[10];
        o[8] = m[4]*m[9]*m[15]-m[4]*m[11]*m[13]-m[8]*m[5]*m[15]+m[8]*m[7]*m[13]+m[12]*m[5]*m[11]-m[12]*m[7]*m[9];
        o[12] = -m[4]*m[9]*m[14]+m[4]*m[10]*m[13]+m[8]*m[5]*m[14]-m[8]*m[6]*m[13]-m[12]*m[5]*m[10]+m[12]*m[6]*m[9];
        o[1] = -m[1]*m[10]*m[15]+m[1]*m[11]*m[14]+m[9]*m[2]*m[15]-m[9]*m[3]*m[14]-m[13]*m[2]*m[11]+m[13]*m[3]*m[10];
        o[5] = m[0]*m[10]*m[15]-m[0]*m[11]*m[14]-m[8]*m[2]*m[15]+m[8]*m[3]*m[14]+m[12]*m[2]*m[11]-m[12]*m[3]*m[10];
        o[9] = -m[0]*m[9]*m[15]+m[0]*m[11]*m[13]+m[8]*m[1]*m[15]-m[8]*m[3]*m[13]-m[12]*m[1]*m[11]+m[12]*m[3]*m[9];
        o[13] = m[0]*m[9]*m[14]-m[0]*m[10]*m[13]-m[8]*m[1]*m[14]+m[8]*m[2]*m[13]+m[12]*m[1]*m[10]-m[12]*m[2]*m[9];
        o[2] = m[1]*m[6]*m[15]-m[1]*m[7]*m[14]-m[5]*m[2]*m[15]+m[5]*m[3]*m[14]+m[13]*m[2]*m[7]-m[13]*m[3]*m[6];
        o[6] = -m[0]*m[6]*m[15]+m[0]*m[7]*m[14]+m[4]*m[2]*m[15]-m[4]*m[3]*m[14]-m[12]*m[2]*m[7]+m[12]*m[3]*m[6];
        o[10] = m[0]*m[5]*m[15]-m[0]*m[7]*m[13]-m[4]*m[1]*m[15]+m[4]*m[3]*m[13]+m[12]*m[1]*m[7]-m[12]*m[3]*m[5];
        o[14] = -m[0]*m[5]*m[14]+m[0]*m[6]*m[13]+m[4]*m[1]*m[14]-m[4]*m[2]*m[13]-m[12]*m[1]*m[6]+m[12]*m[2]*m[5];
        o[3] = -m[1]*m[6]*m[11]+m[1]*m[7]*m[10]+m[5]*m[2]*m[11]-m[5]*m[3]*m[10]-m[9]*m[2]*m[7]+m[9]*m[3]*m[6];
        o[7] = m[0]*m[6]*m[11]-m[0]*m[7]*m[10]-m[4]*m[2]*m[11]+m[4]*m[3]*m[10]+m[8]*m[2]*m[7]-m[8]*m[3]*m[6];
        o[11] = -m[0]*m[5]*m[11]+m[0]*m[7]*m[9]+m[4]*m[1]*m[11]-m[4]*m[3]*m[9]-m[8]*m[1]*m[7]+m[8]*m[3]*m[5];
        o[15] = m[0]*m[5]*m[10]-m[0]*m[6]*m[9]-m[4]*m[1]*m[10]+m[4]*m[2]*m[9]+m[8]*m[1]*m[6]-m[8]*m[2]*m[5];
        det = m[0]*o[0]+m[1]*o[4]+m[2]*o[8]+m[3]*o[12];
        det = det ? 1 / det : 0;
        for (var k = 0; k < 16; k++) o[k] *= det;
        return o;
      }

      /* Si el aparato no aguanta, las nubes se apagan solas. Se miden los
         primeros tres segundos con nubes: si va a menos de 24 cuadros por
         segundo, fuera nubes y fuera sombras. Mejor un mapa fluido sin
         cielo que un cielo que traba el mapa. */
      var pruebaT0 = 0, pruebaN = 0, pruebaHecha = false;
      function vigilar() {
        if (pruebaHecha || !nubesOn || !enPantalla) return;
        var ahora = performance.now();
        if (!pruebaT0) { pruebaT0 = ahora; pruebaN = 0; return; }
        pruebaN++;
        if (ahora - pruebaT0 > 3000) {
          pruebaHecha = true;
          var fps = pruebaN * 1000 / (ahora - pruebaT0);
          if (fps < 24) nubesOn = false;
        }
      }

      api.dibuja = function () {
        gl.useProgram(prog);
        for (var q = 0; q < 8; q++) gl.disableVertexAttribArray(q);
        for (q = 0; q < ATRS.length; q++) {
          gl.bindBuffer(gl.ARRAY_BUFFER, ATRS[q][0]);
          gl.enableVertexAttribArray(ATRS[q][1]);
          gl.vertexAttribPointer(ATRS[q][1], ATRS[q][2], gl.FLOAT, false, 0, 0);
        }
        gl.drawElements(gl.TRIANGLES, nIdx, TIPO, 0);
        /* la sombra aparece y se va suave, no de golpe */
        sombraN += ((nubesOn ? 1 : 0) - sombraN) * 0.08;
        if (!progN || !nubesOn || !mvp) return;
        vigilar();
        gl.useProgram(progN);
        for (q = 0; q < 8; q++) gl.disableVertexAttribArray(q);
        gl.bindBuffer(gl.ARRAY_BUFFER, triB);
        gl.enableVertexAttribArray(locN);
        gl.vertexAttribPointer(locN, 2, gl.FLOAT, false, 0, 0);
        gl.uniformMatrix4fv(uN('inv'), false, new Float32Array(invertir(mvp)));
        gl.uniform3f(uN('ojo'), OJO[0], OJO[1], OJO[2]);
        gl.uniform3f(uN('sol'), -0.52, 0.66, 0.54);
        gl.uniform1f(uN('tiempo'), (performance.now() - t0) / 1000);
        gl.uniform2f(uN('viento'), VIENTO[0], VIENTO[1]);
        gl.disable(gl.DEPTH_TEST); gl.depthMask(false);
        gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.disable(gl.BLEND);
        gl.enable(gl.DEPTH_TEST); gl.depthMask(true);
        gl.useProgram(prog);
      };

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
      gl.uniform3f(u('ojo'), ojo[0], ojo[1], ojo[2]); OJO = ojo;
      gl.uniform2f(u('viento'), VIENTO[0], VIENTO[1]);
      gl.uniform1f(u('sombraN'), sombraN);
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
      dedos.set(e.pointerId, { x: e.clientX, y: e.clientY, t: e.pointerType });
      if (dedos.size === 1) { ini = { x: e.clientX, y: e.clientY, g: giro, i: inclina }; movido = 0; }
      /* Con dos punteros de ratón/lápiz se pellizca aquí. Con dos DEDOS no:
         eso lo llevan los eventos táctiles de abajo, que en iPhone son los
         únicos que llegan completos. */
      if (dedos.size === 2 && e.pointerType !== 'touch') {
        var v = [].slice.call(dedos.values());
        ini = { d: Math.hypot(v[0].x - v[1].x, v[0].y - v[1].y), z: dist };
      }
      try { cont.setPointerCapture(e.pointerId); } catch (eC) { }
      cont.classList.add('mp-arrastrando');
    });
    cont.addEventListener('pointermove', function (e) {
      if (!dedos.has(e.pointerId)) return;
      dedos.set(e.pointerId, { x: e.clientX, y: e.clientY, t: e.pointerType });
      if (pellizco) return;                       // dos dedos: manda el pellizco
      if (dedos.size === 1 && ini && ini.g !== undefined) {
        movido = Math.max(movido, Math.hypot(e.clientX - ini.x, e.clientY - ini.y));
        /* En táctil el giro va al revés que con el ratón: el dedo "empuja"
           la bahía, así que arrastrar a la izquierda la lleva a la izquierda. */
        var sentido = e.pointerType === 'touch' ? -1 : 1;
        giro = ini.g + sentido * (e.clientX - ini.x) * 0.005;
        inclina = Math.max(0.14, Math.min(1.35, ini.i + (e.clientY - ini.y) * 0.004));
      } else if (dedos.size === 2 && ini && ini.d) {
        var v = [].slice.call(dedos.values());
        dist = Math.max(22, Math.min(180, ini.z * ini.d / Math.hypot(v[0].x - v[1].x, v[0].y - v[1].y)));
      }
    });

    /* ── el pellizco con dos dedos ─────────────────────────────────────
       Con eventos táctiles de siempre, no con pointer events: en Safari de
       iPhone el pellizco a veces se lo queda la página para hacer zoom a
       todo el sitio y al mapa no le llega el segundo dedo. Aquí se pide
       el gesto explícitamente y se le dice al navegador que no lo use. */
    var pellizco = null;
    function separacion(ts) { return Math.hypot(ts[0].clientX - ts[1].clientX, ts[0].clientY - ts[1].clientY); }
    cont.addEventListener('touchstart', function (e) {
      if (e.touches.length === 2) {
        pellizco = { d: separacion(e.touches), z: dist };
        movido = 99;                              // un pellizco no es un toque
        e.preventDefault();
      }
    }, { passive: false });
    cont.addEventListener('touchmove', function (e) {
      if (pellizco && e.touches.length === 2) {
        e.preventDefault();
        var d = separacion(e.touches);
        if (d > 8) dist = Math.max(22, Math.min(180, pellizco.z * pellizco.d / d));
      }
    }, { passive: false });
    function finPellizco(e) {
      if (pellizco && e.touches.length < 2) {
        pellizco = null;
        /* el dedo que queda no debe dar un tirón de giro al soltar el otro */
        if (e.touches.length === 1) ini = { x: e.touches[0].clientX, y: e.touches[0].clientY, g: giro, i: inclina };
      }
    }
    cont.addEventListener('touchend', finPellizco);
    cont.addEventListener('touchcancel', finPellizco);
    /* Safari: que el pellizco sobre el mapa no amplíe la página entera */
    cont.addEventListener('gesturestart', function (e) { e.preventDefault(); });
    cont.addEventListener('gesturechange', function (e) { e.preventDefault(); });

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
      objetivo: function () { return dist; },
      nubes: function (on) { nubesOn = !!on && !!progN; },
      distancia: function () { return distD; },
      ballenas: function (on, txt) { if (on) ponerBallenas(txt); verB = on ? 1 : 0; },
      rumbo: function (g, inc) { if (g != null) giro = g; if (inc != null) inclina = inc; }
    };
    return api;
  }

  return { hay: hayWebGL, crear: crear, KM_X: KM_X, KM_Y: KM_Y };
})();
