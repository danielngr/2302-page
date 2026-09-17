#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════
   VRM · GENERADOR DE FICHAS INDEXABLES
   17 sep 2026

   QUÉ RESUELVE
   vrm_property.html es UN archivo. GitHub Pages sirve archivos, no
   programas: lo que va después del `?` no cambia el HTML que recibe Google.
   Por eso las 7 casas eran, para un buscador, la misma página repetida 7
   veces — con el mismo <title>, el mismo H1 ("Vallarta Gardens 2302") y la
   misma descripción. Google elige una y descarta el resto.

   Este script toma vrm_property.html y escribe 7 copias en /p/, cada una
   con su título, su descripción, su H1, su canonical y su JSON-LD reales.
   vrm_property.html?id=X sigue funcionando igual que siempre — ningún
   enlace que hayas compartido deja de servir.

   CÓMO SE CORRE
     node generar_fichas.js
   Lee  : vrm_property.html, vrm_property.src.html (de ahí saca los datos)
   Deja : p/2005.html … p/3004.html, sitemap.xml, robots.txt

   Cuando publiques una casa nueva, agrégala en vrm_property.src.html como
   siempre y vuelve a correr esto. No hay lista que mantener aquí.
   ═══════════════════════════════════════════════════════════════════════ */

const fs = require('fs');
const path = require('path');

const SITIO = 'https://vrmstays.com';
const SRC   = 'vrm_property.src.html';
const MIN   = 'vrm_property.html';
const SALIDA = 'p';

// ── 1. Sacar los datos de las casas del archivo fuente ──────────────────
function bloque(h, nombre) {
  const i = h.indexOf('const ' + nombre + ' =');
  if (i < 0) throw new Error('no encontré ' + nombre);
  const eq = h.indexOf('=', i);
  let j = eq + 1;
  while (h[j] !== '{' && h[j] !== '[') j++;
  const abre = h[j], cierra = abre === '[' ? ']' : '}';
  let d = 0, k = j;
  for (; k < h.length; k++) {
    if (h[k] === abre) d++;
    else if (h[k] === cierra) { d--; if (d === 0) break; }
  }
  return h.slice(j, k + 1);
}

const fuente = fs.readFileSync(SRC, 'utf8');
const QUIYA_UNITS    = eval('(' + bloque(fuente, 'QUIYA_UNITS')    + ')');
const MARITIMA_UNITS = eval('(' + bloque(fuente, 'MARITIMA_UNITS') + ')');
const BOLONGO_UNITS  = eval('(' + bloque(fuente, 'BOLONGO_UNITS')  + ')');
const UNITS = new Function('QUIYA_UNITS', 'MARITIMA_UNITS', 'BOLONGO_UNITS',
  'return ' + bloque(fuente, 'UNITS'))(QUIYA_UNITS, MARITIMA_UNITS, BOLONGO_UNITS);

const ids = Object.keys(UNITS);
console.log('Casas encontradas: ' + ids.length + ' → ' + ids.join(', '));

// ── 2. Textos por casa ──────────────────────────────────────────────────
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
                          .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// La zona en palabras que la gente teclea en Google.
function zona(u) {
  const l = u.location || '';
  if (/La Cruz/i.test(l))        return 'La Cruz de Huanacaxtle';
  if (/Nuevo Vallarta/i.test(l)) return 'Nuevo Vallarta';
  if (/Punta de Mita/i.test(l))  return 'Punta de Mita';
  return l.split(',')[0].trim();
}

function titulo(u) {
  // "Vallarta Gardens 3004 — 6 huéspedes, vista panorámica · La Cruz | VRM"
  const partes = [u.name];
  const detalle = [];
  if (u.guests) detalle.push(u.guests + (u.guests === 1 ? ' huésped' : ' huéspedes'));
  if (u.view)   detalle.push(String(u.view).toLowerCase());
  if (detalle.length) partes.push(detalle.join(', '));
  return partes.join(' — ') + ' · ' + zona(u) + ' | VRM';
}

function descripcion(u) {
  const rec = Array.isArray(u.bedrooms) ? u.bedrooms.length : (u.bedrooms || 0);
  const t = [];
  t.push('Renta ' + u.name + ' en ' + zona(u) + '.');
  const specs = [];
  if (rec)         specs.push(rec + (rec === 1 ? ' recámara' : ' recámaras'));
  if (u.bathrooms) specs.push(u.bathrooms + (u.bathrooms === 1 ? ' baño' : ' baños'));
  if (u.guests)    specs.push('hasta ' + u.guests + ' huéspedes');
  if (u.sqm)       specs.push(u.sqm + ' m²');
  if (specs.length) t.push(specs.join(', ') + '.');
  if (u.highlight) t.push(u.highlight + '.');
  t.push('Reserva directo con el equipo local, sin comisión de plataforma.');
  return t.join(' ').replace(/\s+/g, ' ').slice(0, 300);
}

const foto = u => SITIO + '/img/' + (u.coverImage || '') + '-1200.webp';

function jsonld(u) {
  const rec = Array.isArray(u.bedrooms) ? u.bedrooms.length : (u.bedrooms || 0);
  const o = {
    '@context': 'https://schema.org',
    '@type': 'VacationRental',
    name: u.name,
    description: descripcion(u),
    url: SITIO + '/p/' + u.id + '.html',
    image: [foto(u)],
    address: {
      '@type': 'PostalAddress',
      addressLocality: zona(u),
      addressRegion: /Nayarit/i.test(u.location || '') ? 'Nayarit' : 'Jalisco',
      addressCountry: 'MX'
    },
    containsPlace: {
      '@type': 'Accommodation',
      occupancy: { '@type': 'QuantitativeValue', value: u.guests || undefined },
      numberOfBedrooms: rec || undefined,
      numberOfBathroomsTotal: u.bathrooms || undefined,
      floorSize: u.sqm ? { '@type': 'QuantitativeValue', value: u.sqm, unitCode: 'MTK' } : undefined
    },
    brand: { '@type': 'Brand', name: 'VRM · Vacation Rental México' }
  };
  if (u.coordinates && u.coordinates.lat) {
    o.geo = { '@type': 'GeoCoordinates', latitude: u.coordinates.lat, longitude: u.coordinates.lng };
  }
  if (u.priceUSD) {
    o.offers = {
      '@type': 'Offer', priceCurrency: 'USD',
      price: u.priceUSD, availability: 'https://schema.org/InStock',
      url: SITIO + '/p/' + u.id + '.html'
    };
  }
  // limpiar los undefined para no ensuciar el marcado
  return JSON.stringify(JSON.parse(JSON.stringify(o)), null, 2);
}

// ── 3. Construir cada ficha ─────────────────────────────────────────────
let plantilla = fs.readFileSync(MIN, 'utf8');

// La ficha lee el id del `?id=`. En /p/ no hay `?id=`, así que dejamos que
// una constante puesta al generar tenga prioridad. `?id=` sigue mandando en
// vrm_property.html, donde esa constante no existe.
const LECTOR_VIEJO = 'function _getUnitIdFromUrl(){const params=new URLSearchParams(window.location.search);return params.get("id")}';
const LECTOR_NUEVO = 'function _getUnitIdFromUrl(){const params=new URLSearchParams(window.location.search);return window.VRM_FIXED_UNIT||params.get("id")}';
if (plantilla.split(LECTOR_VIEJO).length - 1 !== 1) {
  throw new Error('no encontré _getUnitIdFromUrl tal cual — ¿cambió el minificado?');
}
plantilla = plantilla.replace(LECTOR_VIEJO, LECTOR_NUEVO);

// Las rutas del sitio son relativas (img/…, ballena_opt.glb, index.html).
// Desde /p/ se romperían. Una etiqueta <base> las resuelve todas de golpe,
// incluidas las que arma el JavaScript.
function cabeza(u) {
  const t = titulo(u), d = descripcion(u), img = foto(u);
  const url = SITIO + '/p/' + u.id + '.html';
  return [
    '<base href="' + SITIO + '/">',
    '<title>' + esc(t) + '</title>',
    '<meta name="description" content="' + esc(d) + '">',
    '<link rel="canonical" href="' + url + '">',
    '<link rel="alternate" hreflang="es" href="' + url + '">',
    '<link rel="alternate" hreflang="en" href="' + url + '?lang=en">',
    '<link rel="alternate" hreflang="x-default" href="' + url + '">',
    '<meta property="og:type" content="website">',
    '<meta property="og:site_name" content="VRM · Vacation Rental México">',
    '<meta property="og:title" content="' + esc(u.name + ' · ' + zona(u)) + '">',
    '<meta property="og:description" content="' + esc(d) + '">',
    '<meta property="og:image" content="' + img + '">',
    '<meta property="og:image:width" content="1200">',
    '<meta property="og:image:height" content="800">',
    '<meta property="og:image:alt" content="' + esc(u.name) + '">',
    '<meta property="og:url" content="' + url + '">',
    '<meta name="twitter:card" content="summary_large_image">',
    '<meta name="twitter:title" content="' + esc(u.name + ' · ' + zona(u)) + '">',
    '<meta name="twitter:description" content="' + esc(d) + '">',
    '<meta name="twitter:image" content="' + img + '">',
    '<script>window.VRM_FIXED_UNIT=' + JSON.stringify(u.id) + ';<\/script>',
    // id="vrmLd": el JS de la ficha busca justo ese id y REEMPLAZA su
    // contenido en vez de añadir un segundo bloque. Sin esto quedaban dos
    // VacationRental describiendo la misma casa.
    '<script type="application/ld+json" id="vrmLd">' + jsonld(u) + '<\/script>'
  ].join('\n');
}

// Etiquetas viejas del head que cada ficha reemplaza por las suyas
const FUERA = [
  /<title>[\s\S]*?<\/title>/,
  /<meta name="description"[^>]*>/,
  /<link rel="canonical"[^>]*>/,
  /<meta property="og:(type|site_name|title|description|image|image:width|image:height|image:alt|url|locale)"[^>]*>/g,
  /<meta name="twitter:(card|title|description|image)"[^>]*>/g
];

fs.mkdirSync(SALIDA, { recursive: true });
const hechas = [];

for (const id of ids) {
  const u = UNITS[id];
  let h = plantilla;
  for (const re of FUERA) h = h.replace(re, '');
  // el <base> y todo lo demás van justo después del charset
  h = h.replace(/<meta charset="[^"]*">/i, m => m + '\n' + cabeza(u));
  // el H1 estático dice "2302" en las 7 copias; que diga el suyo
  h = h.replace(/(<h1 class="hero-title">)[\s\S]*?(<\/h1>)/,
    (m, a, b) => a + esc(u.name.replace(/\s*(\S+)$/, '<br><em>$1</em>')) .replace(/&lt;br&gt;/g,'<br>').replace(/&lt;em&gt;/g,'<em>').replace(/&lt;\/em&gt;/g,'</em>') + b);
  const destino = path.join(SALIDA, id + '.html');
  fs.writeFileSync(destino, h);
  hechas.push({ id, destino, titulo: titulo(u), kb: Math.round(h.length / 1024) });
}

// ── 4. sitemap.xml ──────────────────────────────────────────────────────
const hoy = new Date().toISOString().slice(0, 10);
const urls = [
  { loc: SITIO + '/',                        pri: '1.0', freq: 'weekly'  },
  ...ids.map(id => ({ loc: SITIO + '/p/' + id + '.html', pri: '0.9', freq: 'weekly' })),
  { loc: SITIO + '/terminos.html',           pri: '0.2', freq: 'yearly'  },
  { loc: SITIO + '/aviso-de-privacidad.html', pri: '0.2', freq: 'yearly' }
];
fs.writeFileSync('sitemap.xml',
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  urls.map(u =>
    '  <url>\n    <loc>' + u.loc + '</loc>\n    <lastmod>' + hoy +
    '</lastmod>\n    <changefreq>' + u.freq + '</changefreq>\n    <priority>' +
    u.pri + '</priority>\n  </url>').join('\n') +
  '\n</urlset>\n');

// ── 5. robots.txt ───────────────────────────────────────────────────────
fs.writeFileSync('robots.txt',
  'User-agent: *\n' +
  'Allow: /\n\n' +
  '# Páginas internas: que no salgan en buscadores\n' +
  'Disallow: /vrm_portal_v2.html\n' +
  'Disallow: /vrm_dashboard.html\n' +
  'Disallow: /registros_dashboard.html\n' +
  'Disallow: /registro.html\n' +
  'Disallow: /oficina.html\n' +
  'Disallow: /vrm_trafico.html\n' +
  'Disallow: /Portal_Propietarios_VRM_shell_JULIO.html\n\n' +
  'Sitemap: ' + SITIO + '/sitemap.xml\n');

// ── 6. Resumen ──────────────────────────────────────────────────────────
console.log('\nFichas generadas:');
for (const f of hechas) console.log('  ' + f.destino.padEnd(16) + f.kb + 'KB  ' + f.titulo);
console.log('\nsitemap.xml  → ' + urls.length + ' direcciones');
console.log('robots.txt   → listo');
console.log('\nSube al repo: la carpeta p/, sitemap.xml y robots.txt.');
