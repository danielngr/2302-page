/* ═══════════════════════════════════════════════════════════════════════
   VRM · EL MAPA DE LA BAHÍA EN LA FICHA           19 sep 2026

   El mapa ya viene dibujado en el HTML: relieve, rótulos, lugares y la
   casa. Sin este archivo sigue siendo un mapa que se lee. Lo que añade
   aquí es lo que no se puede escribir en HTML: el mar moviéndose, las
   nubes cruzando, la carretera trazándose, el acercamiento, y el
   conmutador entre las dos lecturas.

   Nada de esto se descarga hasta que la sección se acerca a la pantalla.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var mp = document.getElementById('mp');
  if (!mp) return;
  var BASE = mp.getAttribute('data-mapa') || '/mapa/';
  var AQUI = mp.getAttribute('data-complejo') || 'gardens';
  var CASA = mp.getAttribute('data-casa') || '20.753272,-105.371372';

  var lienzo = document.getElementById('mpLienzo');
  var capa = document.getElementById('mpCapa');
  var relieve = document.getElementById('mpRelieve');
  var camino = document.getElementById('mpCamino');
  var panga = document.getElementById('mpPanga');
  var que = document.getElementById('mpQue');
  var cuanto = document.getElementById('mpCuanto');
  var ir = document.getElementById('mpIr');

  /* ── la barra de lectura, por partes ─────────────────────────────────
     Sigue alimentándose con la misma cadena de siempre
     —"16.1 km por carretera · 20 min · 10.8 km en línea recta"— así que
     ningún sitio que la escribe tuvo que cambiar. Aquí se parte: lo que
     es una medida se pinta con el valor arriba y qué se midió abajo; lo
     que no lo es se queda como nota y no se disfraza de dato.
     El orden de las unidades importa: "min" tiene que probarse ANTES
     que "m" o "20 min" se leería como "20 m" seguido de "in". */
  var MEDIDA = /^((?:\d+\s*h\s+)?[\d.,]+\s*(?:km|min|m|h|%))(?![a-záéíóúñ])\s*(.*)$/i;
  function ponDatos(txt) {
    if (!cuanto) return;
    cuanto.textContent = '';
    if (!txt) return;
    var partes = String(txt).split(' · ');
    for (var i = 0; i < partes.length; i++) {
      var t = partes[i].trim();
      if (!t) continue;
      var m = t.match(MEDIDA), d = document.createElement('span');
      if (m) {
        d.className = 'mp-dato';
        var v = document.createElement('b'); v.textContent = m[1];
        var e = document.createElement('i'); e.textContent = m[2] || 'en coche';
        d.appendChild(v); d.appendChild(e);
      } else {
        d.className = 'mp-dato mp-dato--nota';
        d.textContent = t;
      }
      cuanto.appendChild(d);
    }
  }
  var quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;

  var D = null, R = null, CMP = null;
  var marcado = false;                 // ¿ha elegido algo el huésped?
  var MODO = 'plano';                  // 'relieve' cuando el aparato puede
  var tres = null;                     // el motor 3D, si arranca

  /* Dónde mira el mapa. Los botones de acercar tiran de aquí: acercarse al
     centro geométrico del lienzo es acercarse a mar abierto, que es
     exactamente donde no hay nada que ver. */
  var foco = [717.7, 134.3];                      // la casa, por defecto

  /* Dónde vive cada archivo del mapa. En el sitio son archivos en /mapa/.
     En una copia suelta —un ejemplo para enseñar, un correo, un USB— pueden
     venir incrustados en la propia página, y entonces esto los encuentra
     ahí sin cambiar una línea del resto. */
  function ruta(f) {
    var inc = window.VRM_MAPA_ARCHIVOS;
    return (inc && inc[f]) || BASE + f;
  }

  /* A Yelapa no llega carretera: la ruta por tierra da la vuelta entera y
     acaba a 4 km del pueblo. Lo honesto es lo que haría un huésped —
     manejar a Boca de Tomatlán y tomar la panga. */
  var PANGA = { yelapa: { desde: 'boca', d: 'M837.1,543.5L719.9,558.4' } };

  function reloj(m) {
    if (m < 90) return m + ' min';
    return Math.floor(m / 60) + ' h ' + String(m % 60).padStart(2, '0') + ' min';
  }

  /* ─────────────────────────────── las dos lecturas ─────────────────── */
  var vista = 'cerca';
  /* el rótulo que quedó ya no es botón: solo cuentan los que llevan vista */
  var tabs = [].slice.call(mp.querySelectorAll('.mp-tab[data-vista]'));
  var paneles = [].slice.call(mp.querySelectorAll('.mp-panel'));

  function verPanel() {
    paneles.forEach(function (p) {
      p.hidden = p.getAttribute('data-vista') !== vista;
    });
  }
  function cambiar(v) {
    vista = v;
    tabs.forEach(function (t) {
      var on = t.getAttribute('data-vista') === v;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
    });
    mp.classList.toggle('mp-vista-casas', v === 'casas');
    verPanel();
    if (v === 'casas') {
      borrarRutas();
      elegirComplejo(AQUI);
      if (MODO === 'relieve') {
        /* los tres complejos caen en la costa norte: la cámara se va ahí */
        tres.mirarA(tres.aMundo(695, 150), 52, 0.50);
      } else if (!quieto) {
        /* en teléfono el encuadre ya está recortado a la costa norte: si
           además se acerca, Bolongo se sale por la izquierda */
        volar(innerWidth < 620 ? 1.12 : 1.85, 690, 160, 900);
      } else { Z = 1; PX = PY = 0; aplicarZoom(); }
    } else {
      if (MODO === 'relieve') {
        var antes = capa.querySelector('.mp-lug.mp-sel');
        if (antes && marcado) elegir(antes); else presentar();
      } else {
        if (!quieto) volar(1, 600, 380, 700); else { Z = 1; PX = PY = 0; aplicarZoom(); }
        elegir(capa.querySelector('.mp-lug.mp-sel') || capa.querySelector('[data-k="marina"]'));
      }
    }
  }
  tabs.forEach(function (t, i) {
    t.addEventListener('click', function () { cambiar(t.getAttribute('data-vista')); });
    t.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      e.preventDefault();
      var n = tabs[(i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
      n.focus(); cambiar(n.getAttribute('data-vista'));
    });
  });
  verPanel();

  /* ─────────────────────────────── rutas ────────────────────────────── */
  function trazar(el, d) {
    el.setAttribute('d', d);
    var L = el.getTotalLength();
    el.style.transition = 'none';
    el.style.strokeDasharray = L + ' ' + L;
    el.style.strokeDashoffset = L;
    el.getBoundingClientRect();                    // fuerza el reflujo
    el.style.transition = 'stroke-dashoffset 1.15s var(--mp-curva), opacity .45s var(--mp-curva)';
    el.style.strokeDashoffset = '0';
  }
  function borrarRutas() {
    camino.classList.remove('mp-camino--puesto');
    panga.classList.remove('mp-panga--puesta');
    capa.classList.remove('mp-con-camino');
  }

  function elegir(g) {
    if (!g || vista !== 'cerca') return;
    var k = g.getAttribute('data-k');
    var p = D && D.lugares[k];
    capa.querySelectorAll('.mp-sel').forEach(function (o) { o.classList.remove('mp-sel'); });
    g.classList.add('mp-sel');
    capa.classList.add('mp-eligiendo');

    var pin = g.querySelector('.mp-pin');
    if (pin) foco = [+pin.getAttribute('cx'), +pin.getAttribute('cy')];
    var eti = g.querySelector('.mp-nombre');
    que.textContent = p ? p.t : (eti ? eti.textContent : '');
    borrarRutas();

    var pg = PANGA[k];
    var r = R && R[pg ? pg.desde : k];
    if (MODO === 'relieve') {
      marcado = true;
      marcar3(k);
      encuadrar(foco[0], foco[1]);
      trazar3(r ? r.d : null, pg ? pg.d : null);
    } else if (r) {
      trazar(camino, r.d);
      camino.classList.add('mp-camino--puesto');
      capa.classList.add('mp-con-camino');
      if (pg) {
        panga.setAttribute('d', pg.d);
        panga.classList.add('mp-panga--puesta');
      }
    }
    if (!p) return;
    var txt;
    if (pg) {
      txt = 'Sin carretera · en panga desde Boca de Tomatlán · ' + p.d + ' en línea recta';
    } else if (r && k !== 'marina') {
      txt = r.km + ' km por carretera · ' + reloj(r.min) + ' · ' + p.d + ' en línea recta';
      if (r.salto > 1.5) txt += ' · la carretera queda a ' + r.salto.toFixed(1) + ' km';
    } else {
      txt = p.d + ' en línea recta' + (p.n ? ' · ' + p.n : '');
    }
    ponDatos(txt);
    ir.textContent = 'Cómo llegar';
    ir.target = '_blank';
    ir.href = 'https://www.google.com/maps/dir/?api=1&origin=' + CASA + '&destination=' + p.ll;
    ir.hidden = false;
  }

  capa.querySelectorAll('.mp-lug').forEach(function (g) {
    g.addEventListener('click', function () { elegir(g); });
    g.addEventListener('focus', function () { elegir(g); });
    g.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); elegir(g); return; }
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        var h = [].slice.call(capa.querySelectorAll('.mp-lug'));
        h[(h.indexOf(g) + (e.key === 'ArrowRight' ? 1 : -1) + h.length) % h.length].focus();
      }
    });
  });

  /* ─────────────────────────────── los complejos ─────────────────────
     El mapa no puede distinguir siete casas del mismo edificio, y fingir
     que sí sería mentir con un dibujo. Lo que sí distingue son las zonas,
     que es justo lo que se decide antes de elegir unidad. */
  var SVGNS = 'http://www.w3.org/2000/svg';
  function nodo(t, at) {
    var e = document.createElementNS(SVGNS, t);
    for (var k in at) e.setAttribute(k, at[k]);
    return e;
  }
  function montarComplejos() {
    var casas = document.getElementById('mpCasas');
    if (!casas || !CMP) return;
    Object.keys(CMP).forEach(function (k) {
      var c = CMP[k], x = c.xy[0], y = c.xy[1];
      /* de qué lado cae el rótulo: se decide en los datos, no por la
         posición, porque tres nombres en la costa norte se pisan solos */
      var izq = c.lado ? c.lado === 'izq' : x > 700;
      var g = nodo('g', {
        'class': 'mp-cmp' + (k === AQUI ? ' mp-cmp--aqui' : ''),
        'data-c': k, tabindex: '0', role: 'button',
        'aria-label': c.n + ', ' + c.z + ' · ' + c.casas + (c.casas === 1 ? ' casa' : ' casas')
      });
      g.appendChild(nodo('circle', { 'class': 'mp-tocar', cx: x, cy: y, r: 30 }));
      g.appendChild(nodo('circle', { 'class': 'mp-cmp-aro', cx: x, cy: y, r: 13 }));
      g.appendChild(nodo('circle', { 'class': 'mp-cmp-punto', cx: x, cy: y, r: 4.5 }));
      var t = nodo('text', {
        'class': 'mp-cmp-t', x: x + (izq ? -20 : 20), y: y + 4,
        'text-anchor': izq ? 'end' : 'start'
      });
      t.textContent = c.n;
      g.appendChild(t);
      var z = nodo('text', {
        'class': 'mp-cmp-z', x: x + (izq ? -20 : 20), y: y + 19,
        'text-anchor': izq ? 'end' : 'start'
      });
      z.textContent = c.z;
      g.appendChild(z);
      casas.appendChild(g);

      g.addEventListener('click', function () { elegirComplejo(k); });
      g.addEventListener('focus', function () { elegirComplejo(k); });
      g.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); elegirComplejo(k); }
      });
    });
  }
  function elegirComplejo(k) {
    if (!CMP || !CMP[k]) return;
    var c = CMP[k];
    capa.querySelectorAll('.mp-cmp.mp-sel').forEach(function (o) { o.classList.remove('mp-sel'); });
    var g = capa.querySelector('.mp-cmp[data-c="' + k + '"]');
    if (g) g.classList.add('mp-sel');
    foco = c.xy.slice();
    if (MODO === 'relieve') { marcar3('c:' + k); tres.mirarA(tres.aMundo(c.xy[0], c.xy[1]), 40, 0.52); }
    que.textContent = c.n;
    var partes = [c.casas + (c.casas === 1 ? ' casa' : ' casas')];
    if (c.desde) partes.push('desde ' + c.desde + ' USD');
    partes.push(c.pvr + ' min del aeropuerto');
    if (k === AQUI) partes.push('estás aquí');
    ponDatos(partes.join(' · '));
    /* aquí el botón ya no lleva a Google Maps: lleva a las casas de esa
       zona, que es lo que se está preguntando */
    ir.hidden = k === AQUI;
    ir.textContent = 'Ver las casas';
    ir.removeAttribute('target');
    ir.href = c.url;
    mp.querySelectorAll('.mp-zona').forEach(function (z) {
      z.classList.toggle('mp-zona--elegida', z.getAttribute('data-c') === k);
    });
  }

  /* ─────────────────────────────── carga diferida ────────────────────
     Ni un byte hasta que la sección se acerca. Quien no baja hasta aquí
     no paga el mapa. */
  function montar() {
    var traer = window.VRM_MAPA_DATOS
      ? Promise.resolve(window.VRM_MAPA_DATOS)
      : fetch(BASE + 'datos.json').then(function (r) { return r.json(); });
    traer.then(function (d) {
      D = d; R = d.rutas; CMP = d.complejos;
      arrancarMotor();
      var btn = document.getElementById('mpBallenasBtn');
      if (btn) btn.hidden = false;
      if (vista !== 'cerca') elegirComplejo(AQUI);
      else if (MODO === 'relieve') presentar();
      else elegir(capa.querySelector('[data-k="marina"]'));
    }).catch(function () { montarPlano(); });   // sin datos, al menos el dibujo
  }

  /* El relieve es lo que se quiere enseñar; el mapa plano es la red debajo.
     Si el aparato no trae WebGL, si los shaders no compilan o si la malla no
     le cabe, se cae al plano y el huésped no ve una pantalla rota. */
  function arrancarMotor() {
    if (mp.hasAttribute('data-plano') || !window.VRM_MAPA_3D || !VRM_MAPA_3D.hay()) {
      montarPlano(); return;
    }
    mp.classList.add('mp-3d');
    tres = VRM_MAPA_3D.crear({
      lienzo: lienzo, base: BASE, ruta: ruta,
      listo: function () { mp.classList.add('mp-3d-listo'); },
      fallo: function (por) {
        if (window.console) console.warn('[VRM mapa] relieve no disponible:', por);
        mp.classList.remove('mp-3d', 'mp-3d-listo');
        tres = null; MODO = 'plano';
        montarPlano();
        if (vista === 'cerca') elegir(capa.querySelector('.mp-lug.mp-sel') || capa.querySelector('[data-k="marina"]'));
        else elegirComplejo(AQUI);
      },
      cuadro: pintarCapa3
    });
    if (!tres) { mp.classList.remove('mp-3d'); montarPlano(); return; }
    MODO = 'relieve';
    montarCapa3();
  }

  function montarPlano() {
    if (MODO === 'relieve') return;
    if (relieve && !relieve.getAttribute('src')) relieve.src = ruta(relieve.getAttribute('data-src') || 'bahia.webp');

    /* Absolutas a propósito: una url() dentro de una variable de CSS la
       resuelve Chrome contra la HOJA que la usa —mapa.css, que vive en
       /mapa/— y no contra la página. Con una ruta relativa acababa
       pidiendo /mapa/mapa/mar.webp y el mar se quedaba quieto. */
    var abs = function (f) {
      var u = ruta(f);
      return 'url("' + (u.slice(0, 5) === 'data:' ? u : new URL(u, location.href).href) + '")';
    };
    mp.style.setProperty('--mp-mar', abs('mar.webp'));
    mp.style.setProperty('--mp-brillo1', abs('brillo1.webp'));
    mp.style.setProperty('--mp-brillo2', abs('brillo2.webp'));
    mp.classList.add('mp-vivo');

    montarNubes();
    montarComplejos();
    if (D) pintarBallenas(D.ballenas);
  }

  /* ─────────────────────────────── nubes ─────────────────────────────
     Recortes de una foto de esta bahía. Llevan rumbo, no vaivén: cruzan
     el encuadre hacia el este-sureste —el viento de aquí— y cuando salen
     del todo vuelven a entrar por el otro lado. */
  var PLAN = [
    /* textura, x%, y%, ancho%, peso, scroll, rumbo */
    [1, -3, 19, 38, 1.00, -150],
    [2, 15, 61, 34, 0.92, 262],
    [3, 8, -9, 36, 0.86, -96],
    [4, 70, 81, 38, 0.80, 320]
  ];
  var nubes = [];
  function montarNubes() {
    var bajo = document.getElementById('mpNubes'),
        alto = document.getElementById('mpNubesAlto'),
        suelo = document.getElementById('mpSombras');
    if (!bajo || !alto || !suelo) return;
    PLAN.forEach(function (p, i) {
      var im = new Image();
      im.src = ruta('nube' + p[0] + '.webp');
      im.className = 'mp-nube'; im.alt = '';
      im.style.left = p[1] + '%'; im.style.top = p[2] + '%'; im.style.width = p[3] + '%';
      (i % 2 ? alto : bajo).appendChild(im);

      var sm = new Image();
      sm.src = ruta('sombra' + p[0] + '.webp');
      sm.className = 'mp-sombra'; sm.alt = '';
      sm.style.left = (p[1] + p[3] * 0.040) + '%';
      sm.style.top = (p[2] + p[3] * 0.052) + '%';
      sm.style.width = (p[3] * 1.12) + '%';
      suelo.appendChild(sm);

      var ang = (12 + i * 5.5) * Math.PI / 180, vel = 7.5 + i * 2.2;
      var n = {
        el: im, som: sm, peso: p[4], v: p[5],
        vx: Math.cos(ang) * vel, vy: Math.sin(ang) * vel, dx: 0, dy: 0,
        p1: 31 + i * 7.3, p2: 53 + i * 11.7
      };
      nubes.push(n);
      im.addEventListener('load', function () { medirNubes(); pintarNubes(); });
    });
    addEventListener('resize', medirNubes);
  }
  function pintarNubes() {
    /* al acercarse se apagan: estás bajando por debajo de ellas */
    var f = Math.max(0, Math.min(1, 1 - (Z - 1) / 1.1));
    nubes.forEach(function (n) {
      n.el.style.opacity = (1 * n.peso * f).toFixed(3);
      n.som.style.opacity = (0.70 * n.peso * f).toFixed(3);
    });
  }
  function medirNubes() {
    nubes.forEach(function (n) {
      var c = n.el.parentNode;
      n.W = c.clientWidth; n.H = c.clientHeight;
      n.bx = n.el.offsetLeft; n.by = n.el.offsetTop;
      n.w = n.el.offsetWidth || n.W * 0.5; n.h = n.el.offsetHeight || n.w;
    });
  }

  /* ─────────────────────────────── avistamientos ─────────────────────
     Cada celda es "x,y,n": dónde cayó y cuántos registros. Se pintan
     sumando luz, como una exposición larga. Son datos verificados de
     jorobada dentro del polígono exacto de este mapa. */
  function pintarBallenas(txt) {
    var cv = document.getElementById('mpBallenas');
    if (!cv || !txt) return;
    var cx = cv.getContext('2d'), E = 2;
    var celdas = txt.split(' ');
    cx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < celdas.length; i++) {
      var c = celdas[i].split(','),
          x = (+c[0]) * 3 * E, y = (+c[1]) * 3 * E, n = +c[2];
      var f = Math.pow(Math.min(n, 99) / 99, 0.42);
      var r = (5.5 + 17 * f) * E, a = 0.10 + 0.30 * f;
      var g = cx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(255,226,168,' + a.toFixed(3) + ')');
      g.addColorStop(0.45, 'rgba(240,196,126,' + (a * 0.42).toFixed(3) + ')');
      g.addColorStop(1, 'rgba(217,119,87,0)');
      cx.fillStyle = g; cx.beginPath(); cx.arc(x, y, r, 0, 6.2832); cx.fill();
    }
  }
  var btnB = document.getElementById('mpBallenasBtn');
  if (btnB) btnB.addEventListener('click', function () {
    var on = btnB.getAttribute('aria-pressed') === 'true';
    btnB.setAttribute('aria-pressed', on ? 'false' : 'true');
    lienzo.classList.toggle('mp-con-ballenas', !on);
    if (MODO === 'relieve') tres.ballenas(!on, D && D.ballenas);
    if (!on) {
      borrarRutas();
      var b = D && D.ballena;
      que.textContent = b ? (b.total.toLocaleString('es-MX').replace(/,/g, ' ') +
        ' avistamientos de jorobada') : 'Avistamientos de jorobada';
      ponDatos(b ? (b.desde + ' — 2026 · 98 % entre diciembre y marzo') : '');
      ir.hidden = true;
    } else if (MODO === 'relieve' && !marcado) {
      presentar();
    } else {
      elegir(capa.querySelector('.mp-lug.mp-sel') || capa.querySelector('[data-k="marina"]'));
    }
  });

  /* ─────────────────────────────── acercarse ─────────────────────────
     Al acercarse se cambia la imagen por la de 2400 px: lo que aparece es
     detalle real del satélite, no el mismo pixel estirado. */
  var Z = 1, PX = 0, PY = 0, ZMAX = 3.2, hiPedida = false;
  var btnMas = document.getElementById('mpMas'), btnMenos = document.getElementById('mpMenos');

  function tope() { var r = lienzo.getBoundingClientRect(); return { w: r.width, h: r.height }; }
  function limitar() {
    var t = tope();
    var mx = Math.max(0, (Z - 1) * t.w / 2), my = Math.max(0, (Z - 1) * t.h / 2);
    PX = Math.max(-mx, Math.min(mx, PX));
    PY = Math.max(-my, Math.min(my, PY));
  }
  function pedirAlta() {
    if (hiPedida || !relieve) return;
    hiPedida = true;
    var im = new Image();
    var alta = ruta('bahia@2x.webp');
    im.onload = function () { relieve.src = alta; };
    im.src = alta;
  }
  function aplicarZoom() {
    limitar();
    capa.style.setProperty('--z', Z);
    lienzo.classList.toggle('mp-cerca', Z > 1.005);
    pintarNubes();
    /* En relieve los botones NO dependen de este zoom: el mapa plano está
       escondido debajo y su Z se queda en 1, así que el botón − quedaba
       apagado para siempre y no había forma de volver a alejarse. */
    if (MODO !== 'relieve') {
      if (btnMas) btnMas.disabled = Z >= ZMAX - 0.001;
      if (btnMenos) btnMenos.disabled = Z <= 1.001;
    }
    if (Z > 1.25) pedirAlta();
  }
  /* Volar a un punto del lienzo. Se usa al cambiar de lectura: los tres
     complejos viven en la costa norte, así que el mapa se acerca ahí en
     vez de dejar media bahía vacía. El recorrido va con la misma curva
     que el resto del sitio, no en línea recta. */
  function volar(nz, lx, ly, ms) {
    var t = tope();
    var z0 = Z, x0 = PX, y0 = PY;
    var z1 = Math.max(1, Math.min(ZMAX, nz));
    var x1 = z1 === 1 ? 0 : (600 - lx) * z1 * (t.w / 1200);
    var y1 = z1 === 1 ? 0 : (380 - ly) * z1 * (t.h / 760);
    var t0 = performance.now();
    (function paso(ahora) {
      var u = Math.min(1, (ahora - t0) / ms);
      var e = 1 - Math.pow(1 - u, 3);            // salida rápida, frenada larga
      Z = z0 + (z1 - z0) * e;
      PX = x0 + (x1 - x0) * e;
      PY = y0 + (y1 - y0) * e;
      aplicarZoom();
      if (u < 1) requestAnimationFrame(paso);
    })(t0);
  }

  function zoomEn(nz, cx, cy) {
    var t = tope(), z0 = Z;
    nz = Math.max(1, Math.min(ZMAX, nz));
    if (nz === z0) return;
    var dx = cx - t.w / 2, dy = cy - t.h / 2;     // el punto bajo el dedo se queda quieto
    PX = dx - (dx - PX) * (nz / z0);
    PY = dy - (dy - PY) * (nz / z0);
    Z = nz;
    if (Z === 1) { PX = 0; PY = 0; }
    aplicarZoom();
  }
  lienzo.addEventListener('wheel', function (e) {
    /* Con un dedo o la rueda sin más, la página sigue bajando: el mapa no
       secuestra el scroll. Se acerca con ctrl/⌘ o con los botones. */
    if (!e.ctrlKey && !e.metaKey) return;
    if (MODO === 'relieve') return;          // eso lo lleva el motor 3D
    e.preventDefault();
    var r = lienzo.getBoundingClientRect();
    zoomEn(Z * Math.pow(1.0018, -e.deltaY), e.clientX - r.left, e.clientY - r.top);
  }, { passive: false });
  lienzo.addEventListener('dblclick', function (e) {
    if (MODO === 'relieve') return;
    var r = lienzo.getBoundingClientRect();
    zoomEn(Z > 1.5 ? 1 : 2.2, e.clientX - r.left, e.clientY - r.top);
  });
  /* Los botones en relieve: + se apaga al llegar lo más cerca que deja la
     cámara, − al llegar lo más lejos. Se revisa en cada cuadro porque el
     zoom también cambia pellizcando, con ⌘/Ctrl + rueda o al tocar un
     lugar, no solo con los botones. */
  var btn3 = null;   /* null: el primer cuadro siempre repone los dos botones */
  function botones3() {
    if (MODO !== 'relieve' || !tres || !tres.objetivo) return;
    var d = tres.objetivo(), clave = (d <= 22.5 ? 'a' : '') + (d >= 179.5 ? 'b' : '');
    if (clave === btn3) return;
    btn3 = clave;
    if (btnMas) btnMas.disabled = d <= 22.5;
    if (btnMenos) btnMenos.disabled = d >= 179.5;
  }
  /* Acercar y alejar sobre lo elegido, no sobre el centro del lienzo. */
  function acercarA(f) {
    if (MODO === 'relieve') { tres.acercar(1 / f); botones3(); return; }
    var nz = Math.max(1, Math.min(ZMAX, Z * f));
    if (nz === 1) volar(1, 600, 380, 520);
    else volar(nz, foco[0], foco[1], 520);
  }
  if (btnMas) btnMas.addEventListener('click', function () { acercarA(1.6); });
  if (btnMenos) btnMenos.addEventListener('click', function () { acercarA(1 / 1.6); });

  var dedos = new Map(), ini = null, movido = 0;
  lienzo.addEventListener('pointerdown', function (e) {
    /* en relieve estos dedos son del motor 3D: si el plano también los
       cuenta, su zoom escondido se mueve y descoloca los botones */
    if (MODO === 'relieve') return;
    if (e.target.closest && e.target.closest('button')) return;
    dedos.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (dedos.size === 1) { ini = { x: e.clientX, y: e.clientY, px: PX, py: PY }; movido = 0; }
    if (dedos.size === 2) {
      var v = [].slice.call(dedos.values());
      ini = { d: Math.hypot(v[0].x - v[1].x, v[0].y - v[1].y), z: Z };
    }
    lienzo.setPointerCapture(e.pointerId);
  });
  lienzo.addEventListener('pointermove', function (e) {
    if (MODO === 'relieve' || !dedos.has(e.pointerId)) return;
    dedos.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (dedos.size === 1 && ini && ini.px !== undefined) {
      var dx = e.clientX - ini.x, dy = e.clientY - ini.y;
      movido = Math.max(movido, Math.hypot(dx, dy));
      if (Z > 1.005) {
        lienzo.classList.add('mp-arrastrando');
        PX = ini.px + dx; PY = ini.py + dy; aplicarZoom();
      }
    } else if (dedos.size === 2 && ini && ini.d) {
      var v = [].slice.call(dedos.values());
      var d = Math.hypot(v[0].x - v[1].x, v[0].y - v[1].y);
      var r = lienzo.getBoundingClientRect();
      zoomEn(ini.z * (d / ini.d), (v[0].x + v[1].x) / 2 - r.left, (v[0].y + v[1].y) / 2 - r.top);
    }
  });
  function soltar(e) {
    dedos.delete(e.pointerId);
    lienzo.classList.remove('mp-arrastrando');
    if (dedos.size === 0) ini = null;
  }
  lienzo.addEventListener('pointerup', soltar);
  lienzo.addEventListener('pointercancel', soltar);
  /* un arrastre no debe contar como clic en un lugar */
  capa.addEventListener('click', function (e) {
    if (movido > 4) { e.stopPropagation(); e.preventDefault(); }
  }, true);
  addEventListener('resize', aplicarZoom);
  aplicarZoom();

  /* ─────────────────────────────── movimiento ────────────────────────
     El scroll pasa por un suavizado: ese retardo es lo que hace que flote
     en vez de ir pegado. El relieve es bitmap y se mueve con transform;
     los rótulos son vectores y se redibujan con el viewBox, que los deja
     nítidos en vez de ampliar el pixel. */
  var corriendo = false;
  function animar() {
    if (corriendo || quieto || MODO === 'relieve') return;
    corriendo = true;
    var planos = [document.getElementById('mpBase'), document.getElementById('mpRot')];
    var objetivo = 0, suaveV = 0, t0 = performance.now(), tprev = t0;
    function medir() {
      var r = lienzo.getBoundingClientRect();
      objetivo = (r.top + r.height / 2 - innerHeight / 2) / innerHeight;
    }
    function cuadro(ahora) {
      var t = (ahora - t0) / 1000;
      suaveV += (objetivo - suaveV) * 0.085;
      var dy = suaveV * (innerWidth < 620 ? -14 : -26);
      planos[0].style.transform =
        'translate3d(' + PX.toFixed(1) + 'px,' + (PY + dy).toFixed(1) + 'px,0) scale(' + Z.toFixed(4) + ')';
      planos[1].style.transform = 'translate3d(0,' + dy.toFixed(1) + 'px,0)';
      var Wp = planos[1].clientWidth || 1, es = 1200 / Wp;
      capa.setAttribute('viewBox',
        (600 - (600 + PX * es) / Z).toFixed(2) + ' ' + (380 - (380 + PY * es) / Z).toFixed(2) + ' ' +
        (1200 / Z).toFixed(2) + ' ' + (760 / Z).toFixed(2));
      var dt = Math.min(0.05, (ahora - tprev) / 1000); tprev = ahora;
      for (var i = 0; i < nubes.length; i++) {
        var n = nubes[i];
        if (!n.W) continue;
        n.dx += n.vx * dt; n.dy += n.vy * dt;
        var ax = n.W + n.w, ay = n.H + n.h;
        if (n.bx + n.dx > n.W) n.dx -= ax; else if (n.bx + n.dx + n.w < 0) n.dx += ax;
        if (n.by + n.dy > n.H) n.dy -= ay; else if (n.by + n.dy + n.h < 0) n.dy += ay;
        /* dos periodos inconmensurables: el camino no se repite nunca igual */
        var wx = Math.sin(t / n.p1 * 6.2832) * 9 + Math.sin(t / n.p2 * 6.2832) * 6;
        var wy = Math.cos(t / (n.p1 * 1.37) * 6.2832) * 5 + Math.sin(t / (n.p2 * 0.83) * 6.2832) * 3.5;
        var x = n.dx + wx + suaveV * n.v * 2.5, y = n.dy + wy + suaveV * n.v * 0.30;
        n.el.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0)';
        n.som.style.transform = 'translate3d(' + (n.dx + wx + suaveV * n.v * 2.5 * 0.32).toFixed(1) +
          'px,' + (n.dy + wy + suaveV * n.v * 0.30 * 0.32).toFixed(1) + 'px,0)';
      }
      requestAnimationFrame(cuadro);
    }
    medir();
    addEventListener('scroll', medir, { passive: true });
    addEventListener('resize', medir, { passive: true });
    requestAnimationFrame(cuadro);
  }

  /* ─────────────────────────────── la unidad de esta ficha ───────────
     La tira de unidades es la misma en las siete fichas; aquí se marca
     cuál eres para que no te ofrezcan la casa en la que ya estás. */
  var id = window.VRM_UNIT_ID;
  if (id) {
    var u = mp.querySelector('.mp-unidad[data-id="' + id + '"]');
    if (u) {
      u.classList.add('mp-unidad--aqui');
      u.removeAttribute('href');
      var m = document.createElement('span');
      m.className = 'mp-unidad-aqui';
      m.textContent = 'Esta casa';
      u.appendChild(m);
    }
  }


  /* ═══════════════════════════════════════════════════════════════════
     LA CAPA DE ENCIMA, EN RELIEVE

     Los mismos lugares, los mismos nombres y las mismas carreteras que en
     el mapa plano —salen de este mismo HTML, no de una lista paralela—,
     pero puestos cuadro a cuadro donde les toca en pantalla según hacia
     dónde mire la cámara. El estilo es el de siempre: son las mismas
     clases de CSS, así que un cambio de color se hace en un sitio.
     ═══════════════════════════════════════════════════════════════════ */
  var NS = 'http://www.w3.org/2000/svg';
  var capa3 = null, pins3 = {}, casa3 = null, camino3 = null, panga3 = null, medidor = null;
  var funda3 = null, flujo3 = null;
  var CASA3 = [717.7, 134.3];                 // la casa, en el lienzo del plano
  var via = { pts: null, panga: null, rev: 1, t0: 0 };

  function sv(t, at) {
    var e = document.createElementNS(NS, t);
    for (var k in at) e.setAttribute(k, at[k]);
    return e;
  }

  function crearPin3(id, cx, cy, nombre, clase, sub) {
    var g = sv('g', { 'class': clase, 'data-p': id, tabindex: '0', role: 'button',
                      'aria-label': nombre + (sub ? ', ' + sub : '') });
    g.appendChild(sv('circle', { 'class': 'mp-tocar', r: 20 }));
    if (clase.indexOf('mp-cmp3') >= 0) g.appendChild(sv('circle', { 'class': 'mp-cmp-halo', r: 9 }));
    g.appendChild(sv('circle', { 'class': 'mp-pin', r: 3.2 }));
    var t = sv('text', { 'class': 'mp-nombre', x: 11, y: 4 });
    t.textContent = nombre;
    g.appendChild(t);
    if (sub) {
      var z = sv('text', { 'class': 'mp-cmp-z', x: 11, y: 17 });
      z.textContent = sub;
      g.appendChild(z);
    }
    capa3.appendChild(g);
    pins3[id] = { g: g, xy: [cx, cy], txt: t, sub: g.querySelector('.mp-cmp-z') };
    function toca() {
      if (tres && tres.arrastrado() > 4) return;
      if (id.slice(0, 2) === 'c:') elegirComplejo(id.slice(2));
      else if (id.slice(0, 2) === 'i:') elegirIsla(id.slice(2));
      else if (id.slice(0, 2) === 'f:') elegirFuera(id.slice(2));
      else elegir(capa.querySelector('.mp-lug[data-k="' + id + '"]'));
    }
    g.addEventListener('click', toca);
    g.addEventListener('focus', toca);
    g.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toca(); }
    });
    return g;
  }

  function montarCapa3() {
    capa3 = sv('svg', { 'class': 'mp-capa3' });
    lienzo.appendChild(capa3);
    /* el suelo primero: las carreteras van debajo de los rótulos.
       Tres trazos encima del mismo camino: una funda oscura que lo despega
       del terreno claro, el oro, y un guion que corre hacia el destino.
       Con uno solo se perdía sobre la mancha urbana de Vallarta. */
    funda3 = sv('path', { 'class': 'mp-funda' });
    camino3 = sv('path', { 'class': 'mp-camino' });
    flujo3 = sv('path', { 'class': 'mp-flujo' });
    panga3 = sv('path', { 'class': 'mp-panga' });
    capa3.appendChild(funda3); capa3.appendChild(camino3);
    capa3.appendChild(flujo3); capa3.appendChild(panga3);

    capa.querySelectorAll('.mp-lug').forEach(function (g) {
      var pin = g.querySelector('.mp-pin'), nom = g.querySelector('.mp-nombre');
      if (!pin || !nom) return;
      crearPin3(g.getAttribute('data-k'), +pin.getAttribute('cx'), +pin.getAttribute('cy'),
                nom.textContent, 'mp-p3 mp-lug');
    });
    /* Sayulita y San Pancho caen fuera del lienzo del mapa plano —sus
       coordenadas son negativas— pero dentro del terreno, que se alargó 13 km
       al norte para que entraran. Aquí son lugares de pleno derecho: llevan su
       carretera real, como los demás. */
    if (D && D.norte) Object.keys(D.norte).forEach(function (k) {
      var f = D.norte[k];
      crearPin3('f:' + k, f.xy[0], f.xy[1], f.n, 'mp-p3 mp-lug');
    });
    if (D && D.islas) Object.keys(D.islas).forEach(function (k) {
      var h = D.islas[k];
      crearPin3('i:' + k, h.xy[0], h.xy[1], h.n, 'mp-p3 mp-hito');
    });
    /* los otros complejos ya no salen: se fueron con la lectura de
       "las otras casas". El código queda por si vuelve. */
    if (false && CMP) Object.keys(CMP).forEach(function (k) {
      crearPin3('c:' + k, CMP[k].xy[0], CMP[k].xy[1], CMP[k].n, 'mp-p3 mp-cmp3', CMP[k].z);
      if (k === AQUI) pins3['c:' + k].g.classList.add('mp-cmp--aqui');
    });

    /* la casa: un punto de oro con su nombre, siempre visible en la
       lectura de alrededor */
    casa3 = sv('g', { 'class': 'mp-casa3', 'aria-hidden': 'true' });
    casa3.appendChild(sv('circle', { 'class': 'mp-casa-anillo', r: 9 }));
    casa3.appendChild(sv('circle', { r: 4.6, fill: '#E8C88A' }));
    casa3.appendChild(sv('line', { x1: 0, y1: -12, x2: 0, y2: -26,
                                   stroke: 'rgba(232,200,138,.75)', 'stroke-width': 1 }));
    var ct = sv('text', { 'class': 'mp-casa-t', y: -34, 'text-anchor': 'middle' });
    ct.textContent = 'La Cruz de Huanacaxtle';
    casa3.appendChild(ct);
    capa3.appendChild(casa3);

    /* un medidor invisible para recorrer las rutas: las carreteras vienen
       como trazo SVG en coordenadas del lienzo plano, y hay que muestrearlas
       para poder posarlas sobre el terreno */
    medidor = sv('svg', { width: 0, height: 0, 'aria-hidden': 'true',
                          style: 'position:absolute;width:0;height:0;overflow:hidden' });
    medidor.appendChild(sv('path', {}));
    lienzo.appendChild(medidor);
  }

  /* Una isla no es un destino: no hay carretera que trazar ni ruta que
     abrir en Google Maps. Lo que sí hay es lo que se ve desde la terraza y
     lo lejos que queda, medido. */
  function elegirIsla(k) {
    var h = D && D.islas && D.islas[k];
    if (!h) return;
    marcado = true;
    marcar3('i:' + k);
    trazar3(null, null);
    encuadrar(h.xy[0], h.xy[1]);
    que.textContent = h.n;
    ponDatos(h.km + ' km en línea recta desde la casa · ' + h.que);
    ir.hidden = true;
  }

  /* Un pueblo del norte: mismo trato que cualquier lugar —carretera trazada,
     kilómetros y minutos medidos— solo que su alfiler no existe en el mapa
     plano, así que no hay grupo SVG del que colgarse. */
  function elegirFuera(k) {
    var f = D && D.norte && D.norte[k];
    if (!f) return;
    marcado = true;
    marcar3('f:' + k);
    encuadrar(f.xy[0], f.xy[1]);
    trazar3(f.d, null);
    que.textContent = f.n;
    var t = f.km + ' km por carretera · ' + reloj(f.min);
    if (f.salto > 1.5) t += ' · el dato de carretera se corta ' + f.salto.toFixed(1) + ' km antes';
    ponDatos(t + ' · ' + f.que);
    ir.textContent = 'Cómo llegar';
    ir.target = '_blank';
    ir.href = 'https://www.google.com/maps/dir/?api=1&origin=' + CASA + '&destination=' + f.ll;
    ir.hidden = false;
  }

  function marcar3(id) {
    for (var o in pins3) pins3[o].g.classList.toggle('mp-sel', o === id);
    if (capa3) capa3.classList.add('mp-eligiendo');
  }

  /* Muestrear una carretera: de trazo plano a lista de puntos. */
  function muestrear(d, n) {
    var path = medidor.firstChild;
    path.setAttribute('d', d);
    var L = path.getTotalLength();
    if (!L) return null;
    var N = Math.max(24, Math.min(110, n || Math.round(L / 7)));
    var pts = [];
    for (var i = 0; i <= N; i++) {
      var q = path.getPointAtLength(L * i / N);
      pts.push([q.x, q.y]);
    }
    return pts;
  }

  function trazar3(d, dPanga) {
    via.pts = d ? muestrear(d) : null;
    via.panga = dPanga ? muestrear(dPanga, 30) : null;
    via.rev = 0; via.t0 = performance.now();
    camino3.classList.toggle('mp-camino--puesto', !!d);
    funda3.classList.toggle('mp-camino--puesto', !!d);
    flujo3.classList.toggle('mp-camino--puesto', !!d);
    panga3.classList.toggle('mp-panga--puesta', !!dPanga);
  }

  /* ── el cuadro: poner cada cosa donde le toca ────────────────────── */
  function pintarCapa3(proyectar, ancho, alto) {
    botones3();
    if (!capa3) return;
    capa3.setAttribute('viewBox', '0 0 ' + ancho + ' ' + alto);

    var enCasas = vista === 'casas';
    var puestos = [], visibles = [];

    /* Un rótulo tapado por otro no es un rótulo: es ruido. Se colocan por
       orden de importancia —la casa primero, luego lo elegido, luego lo más
       cercano— y el que choca con uno ya puesto se queda sin nombre, solo con
       su punto. Es lo que hace cualquier mapa serio, y es lo que permite que
       esto se lea igual en un teléfono que en una pantalla grande. */
    function cabe(x, y, an, al) {
      for (var i = 0; i < puestos.length; i++) {
        var o = puestos[i];
        if (x < o[0] + o[2] && x + an > o[0] && y < o[1] + o[3] && y + al > o[1]) return false;
      }
      puestos.push([x, y, an, al]);
      return true;
    }

    if (casa3) {
      var qc = enCasas ? null : proyectar(CASA3[0], CASA3[1], 0.12);
      casa3.style.display = qc ? '' : 'none';
      if (qc) {
        casa3.setAttribute('transform', 'translate(' + qc[0].toFixed(1) + ',' + qc[1].toFixed(1) + ')');
        cabe(qc[0] - 110, qc[1] - 48, 220, 34);         // su nombre va arriba
      }
    }

    for (var id in pins3) {
      var p = pins3[id], esCmp = id.slice(0, 2) === 'c:';
      if (esCmp !== enCasas) { p.g.style.display = 'none'; continue; }
      if (enCasas && esCmp === false) { p.g.style.display = 'none'; continue; }
      var q = proyectar(p.xy[0], p.xy[1], 0.12);
      if (!q || q[0] < -60 || q[0] > ancho + 60 || q[1] < -40 || q[1] > alto + 40) {
        p.g.style.display = 'none'; continue;
      }
      p.g.style.display = '';
      p.g.setAttribute('transform', 'translate(' + q[0].toFixed(1) + ',' + q[1].toFixed(1) + ')');
      /* lo lejano se apaga: es lo que hace que el relieve tenga fondo */
      p.g.style.opacity = Math.max(0.42, Math.min(1, 1.35 - q[2] / 150)).toFixed(2);
      /* el punto puede asomar por el borde; el nombre no: un rótulo cortado
         a la mitad se lee peor que no ponerlo */
      if (q[0] >= 8 && q[0] <= ancho - 8 && q[1] >= 10 && q[1] <= alto - 10)
        visibles.push([p, q, p.g.classList.contains('mp-sel') ? -1e6 : q[2]]);
      else { p.txt.style.display = 'none'; if (p.sub) p.sub.style.display = 'none'; }
    }

    visibles.sort(function (a, b) { return a[2] - b[2]; });
    for (var v = 0; v < visibles.length; v++) {
      var pp = visibles[v][0], qq = visibles[v][1];
      var an = pp.txt.textContent.length * 6.6 + 14;
      var al = pp.sub ? 26 : 15;
      /* de qué lado va el rótulo: del que se sale menos. No un margen
         inventado, sino cuánto asomaría por cada borde. */
      var sobraDer = Math.max(0, qq[0] + 11 + an - (ancho - 6));
      var sobraIzq = Math.max(0, 6 - (qq[0] - 11 - an));
      var izq = sobraIzq < sobraDer;
      var x0 = izq ? qq[0] - 11 - an : qq[0] + 5;
      var libre = cabe(x0, qq[1] - 9, an, al);
      pp.txt.style.display = libre ? '' : 'none';
      if (pp.sub) pp.sub.style.display = libre ? '' : 'none';
      if (!libre) continue;
      pp.txt.setAttribute('x', izq ? -11 : 11);
      pp.txt.setAttribute('text-anchor', izq ? 'end' : 'start');
      if (pp.sub) { pp.sub.setAttribute('x', izq ? -11 : 11); pp.sub.setAttribute('text-anchor', izq ? 'end' : 'start'); }
    }

    /* la carretera se posa en el suelo y se dibuja sola, de la casa hacia
       allá: no aparece de golpe, se recorre */
    via.rev = Math.min(1, (performance.now() - via.t0) / 1150);
    var dCam = enCasas ? '' : hilo(via.pts, via.rev, proyectar);
    camino3.setAttribute('d', dCam);
    funda3.setAttribute('d', dCam);
    flujo3.setAttribute('d', dCam);
    panga3.setAttribute('d', enCasas ? '' : hilo(via.panga, via.rev, proyectar));
  }

  function hilo(pts, rev, proyectar) {
    if (!pts) return '';
    var n = Math.max(2, Math.round(pts.length * rev)), d = '', puesto = false;
    for (var i = 0; i < n; i++) {
      var q = proyectar(pts[i][0], pts[i][1], 0.045);
      if (!q) { puesto = false; continue; }
      d += (puesto ? 'L' : 'M') + q[0].toFixed(1) + ',' + q[1].toFixed(1);
      puesto = true;
    }
    return d;
  }

  /* La apertura: la bahía entera y la casa marcada, sin haber elegido nada.
     Volar a un sitio antes de que lo pidan es contestar una pregunta que
     nadie hizo; y la primera pregunta es "¿dónde está esto?". */
  function presentar() {
    if (!tres) return;
    for (var o in pins3) pins3[o].g.classList.remove('mp-sel');
    if (capa3) capa3.classList.remove('mp-eligiendo');
    trazar3(null, null);
    tres.mirarA(tres.aMundo(650, 250), 82, 0.47);
    que.textContent = 'La Cruz de Huanacaxtle';
    ponDatos('Vallarta Gardens · 5 min a pie a la marina · 35 min del aeropuerto');
    ir.textContent = 'Cómo llegar';
    ir.target = '_blank';
    ir.href = 'https://www.google.com/maps/dir/?api=1&destination=' + CASA;
    ir.hidden = false;
  }

  /* ── a dónde mira la cámara ──────────────────────────────────────────
     No al lugar elegido: al punto medio entre la casa y ese lugar, con la
     distancia justa para que quepan los dos. La pregunta del huésped no es
     "dónde está Vallarta", es "qué tan lejos me queda". */
  function encuadrar(cx, cy) {
    if (!tres) return;
    var mx = (CASA3[0] + cx) / 2, my = (CASA3[1] + cy) / 2;
    var sep = Math.hypot((cx - CASA3[0]) / 1200 * VRM_MAPA_3D.KM_X,
                         (cy - CASA3[1]) / 760 * VRM_MAPA_3D.KM_Y);
    var d = Math.max(26, Math.min(120, 21 + sep * 1.6));
    tres.mirarA(tres.aMundo(mx, my), d, sep > 30 ? 0.46 : 0.58);
  }

  /* Un asa mínima para inspeccionar el mapa desde la consola: qué motor
     salió, y la cámara si es el de relieve. No cambia nada por sí sola. */
  window.VRM_MAPA = {
    modo: function () { return MODO; },
    motor: function () { return tres; }
  };

  /* ─────────────────────────────── arranque ──────────────────────────── */
  var montado = false;
  function arrancar() {
    if (montado) return;
    montado = true;
    montar();
    animar();
  }
  if ('IntersectionObserver' in window) {
    var ob = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { ob.disconnect(); arrancar(); } });
    }, { rootMargin: '600px 0px' });
    ob.observe(mp);
  } else {
    arrancar();
  }
})();
