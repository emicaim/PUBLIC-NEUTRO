// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 FOKO SOFT (Emilio Martinez) — Neutro, https://github.com/emicaim/PUBLIC-NEUTRO
// LA VISTA DEL DIOS: el mapa con todas las mentes, la crónica y la mente de quien se elija.
import { Mundo, TICKS_POR_ANIO, TICKS_POR_DIA, NOMBRE_GOBIERNO, NOMBRE_OFICIO, TEXTO_USO } from './mundo.js';
import { PAL, ESTILO, pintarTerreno, pintarArbusto, pintarLobo, pintarPersona, hojaDePersonas, clavePersona, anillo, hojaDeChozas, pintarCiervo, pintarEmpalizada, pintarPerro, estiloHijo } from './sprites.js';

const $ = (s) => document.querySelector(s);
// El mundo se dibuja entero en un lienzo oculto (a 6 px por casilla); la pantalla copia y amplía solo lo que mira la
// CÁMARA, sin suavizar: el pixel art se ve nítido a cualquier zoom y cuesta un solo drawImage
const lienzo = $('#lienzo'), pantalla = lienzo.getContext('2d');
const mundoLienzo = document.createElement('canvas'), ctx = mundoLienzo.getContext('2d');
const camara = { x: 0, y: 0, zoom: 1, min: 1, max: 8 };
const TAM = 6;   // píxeles por casilla
// LA VELOCIDAD, A ESCALA HUMANA: 1× son 4 pasos por segundo (una persona camina unas 4 casillas por segundo; un día dura
// 20 s y un año, un minuto). Lo de arriba es para ver pasar generaciones
const VELOCIDADES = [1, 2, 4, 16, 64, 256], PASOS_POR_SEGUNDO = 4;
let acumulado = 0, ultimoFotograma = 0, ultimoPaso = 0;

let semillaActual = 1, mundo, fondo, hoja, pausa = false, velocidad = 4, elegido = null, ultimoPanel = 0, cronicaVista = 0;
// la idea que se sigue: {autor, anio, concepto, accion} y sus portadores (se recalculan cada medio segundo)
let seguida = null, portadores = [], ultimoCalculo = 0, fotograma = 0;
// aldeas (chozas donde viven las familias), territorios y noche
let chozas = null, aldeas = new Map(), ultimaAldea = 0, territorio = null, capaTerritorio = null, fronterasGuerra = [];
let verNoche = true;
// lo que está elegido en el panel (una persona, un pueblo o nada: el mundo) y en qué apartado
let puebloElegido = null, apartadoPersona = 'ahora', apartadoPueblo = 'resumen', inventoElegido = null;
// LA LENTE: qué se mira en el mapa (territorio, lenguas, gobierno, comercio, ideas, clima o recursos)
let lente = 'territorio', capaClima = null;
let filtroCronica = 'todo', sinLeer = 0;
let poder = null;   // el poder de dios preparado: el siguiente clic en el mapa lo lanza
let verNiebla = true, niebla = null, ultimaNiebla = 0;
const imagenCerebro = new Image();
imagenCerebro.src = 'cerebro.png';

function crear(semilla) {
  { const t = new URLSearchParams(location.search).get('mundo') || (new URLSearchParams(location.search).has('islas') ? 'islas' : null); if (t && !crear.yaLeido) $('#tipo-mundo').value = t; if (!crear.yaLeido && new URLSearchParams(location.search).get('cultura') === 'no') $('#cultura').checked = false; crear.yaLeido = true; }
  semillaActual = semilla;
  const q = new URLSearchParams(location.search);
  mundo = new Mundo({ semilla, cultura: $('#cultura').checked, copia: q.get('copia') || 'prestigio', gobierno: q.get('gobierno') || 'banda', reparto: q.get('reparto') || 'familia',
                     lenguaje: q.get('lenguaje') !== 'no', gramatica: q.get('gramatica') || 'composicional', islas: $('#tipo-mundo').value === 'islas', archipielago: $('#tipo-mundo').value === 'archipielago' });
  mundo.verEfectos = true;
  mundoLienzo.width = mundo.ancho * TAM; mundoLienzo.height = mundo.alto * TAM;
  ctx.imageSmoothingEnabled = false;
  ajustarPantalla(true);
  fondo = pintarTerreno(mundo, TAM);
  if (ESTILO.length > 8) { ESTILO.length = 8; hoja = chozas = null; }   // (los pueblos nacidos eran de otro mundo)
  hoja = hoja || hojaDePersonas(TAM);
  chozas = chozas || hojaDeChozas(TAM);
  aldeas = new Map(); ultimaAldea = 0; territorio = null; fronterasGuerra = [];
  capaTerritorio = document.createElement('canvas'); capaTerritorio.width = mundoLienzo.width; capaTerritorio.height = mundoLienzo.height;
  capaClima = null; ultimaFamilia = -1;
  elegido = null; cronicaVista = 0; seguida = null; portadores = [];
  $('#siguiendo').hidden = true;
  prepararCronica();
  if ($('#leyenda-lente')) leyendaLente();
  $('#mente').innerHTML = '';
  puebloElegido = null; inventoElegido = null; mostrar('inicio');
  historialPanel = []; if ($('#migas')) actualizarNav();
  if ($('#avisos')) $('#avisos').innerHTML = '';
  history.replaceState(null, '', `?semilla=${semilla}`);
}

// ---- dibujar ----
const COLOR_EFECTO = { compartir: PAL.fx.compartir, regalo: PAL.fx.regalo, pelea: PAL.fx.pelea, nacer: PAL.fx.nacer, morir: PAL.fx.morir };

/** Si ha nacido un pueblo, le da estilo (hijo del de su origen) y rehace las hojas de personas y chozas. */
function estilosNuevos() {
  if (mundo.tribus.length <= ESTILO.length) return;
  while (ESTILO.length < mundo.tribus.length) {
    const t = mundo.tribus[ESTILO.length];
    ESTILO.push(estiloHijo(ESTILO[t.madre ?? 0], ESTILO.length));
  }
  hoja = hojaDePersonas(TAM); chozas = hojaDeChozas(TAM); territorio = null;
}

// ---- las lentes ----
const LENTES = [
  ['territorio', 'Territorio', '<path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15M15 6v15"/>'],
  ['lenguas', 'Lenguas', '<path d="M4 5h16v11H9l-5 4z"/>'],
  ['gobierno', 'Gobierno', '<path d="M4 10l8-5 8 5M6 10v8M10 10v8M14 10v8M18 10v8M3 20h18"/>'],
  ['comercio', 'Comercio', '<path d="M7 7h11l-3-3M17 17H6l3 3"/>'],
  ['ideas', 'Ideas', '<circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>'],
  ['clima', 'Clima', '<path d="M12 2v20M4 6l16 12M20 6L4 18"/>'],
  ['recursos', 'Recursos', '<circle cx="8" cy="9" r="3"/><circle cx="16" cy="9" r="3"/><circle cx="12" cy="16" r="3"/>'],
];
const COLOR_GOBIERNO = { banda: '#7ddf64', jefatura: '#ff7a45', democracia: '#4fb3e8', teocracia: '#c08bf0' };
function prepararLentes() {
  $('#lentes').innerHTML = '<div class="rotulo-lentes">LENTES</div>' + LENTES.map(([id, nombre, d]) =>
    `<button data-lente="${id}" class="${id === lente ? 'activo' : ''}" title="Lente: ${nombre.toLowerCase()}"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${d}</svg>${nombre}</button>`).join('');
  $('#lentes').addEventListener('click', (ev) => { const b = ev.target.closest('button'); if (b) ponerLente(b.dataset.lente); });
}
function ponerLente(id) {
  lente = id;
  document.querySelectorAll('#lentes button').forEach((b) => b.classList.toggle('activo', b.dataset.lente === id));
  if (territorio) pintarTerritorio();
  // (la lente de ideas sigue sola la idea más extendida, si no se está siguiendo ninguna)
  // (la lente de ideas abre el panel de ideas: si no se sigue ninguna, la lista de las más extendidas para elegir)
  if (id === 'ideas') { recordar(); elegido = null; mostrar('idea'); panelIdea(); actualizarNav(); }
  leyendaLente();
}
/** Las familias de lenguas: pueblos cuyas lenguas se parecen (30 % o más) van juntos; el color es el del primero. */
function familiasDeLenguas() {
  const raiz = new Map(mundo.tribus.map((t) => [t.id, t.id]));
  const buscar = (x) => (raiz.get(x) === x ? x : buscar(raiz.get(x)));
  if (mundo.parecido) for (const [k, s] of mundo.parecido) if (s >= 0.3) { const [a, b] = k.split('-').map(Number); const ra = buscar(a), rb = buscar(b); raiz.set(Math.max(ra, rb), Math.min(ra, rb)); }
  return new Map(mundo.tribus.map((t) => [t.id, buscar(t.id)]));
}
let familias = new Map(), ultimaFamilia = -1;
function colorLente(t) {
  if (lente === 'gobierno') return COLOR_GOBIERNO[mundo.tribus[t].gobierno] || ESTILO[t % ESTILO.length].color;
  if (lente === 'lenguas') {
    if (ultimaFamilia !== mundo.anio) { familias = familiasDeLenguas(); ultimaFamilia = mundo.anio; }
    return ESTILO[(familias.get(t) ?? t) % ESTILO.length].color;
  }
  return ESTILO[t % ESTILO.length].color;
}
function leyendaLente() {
  const caja = $('#leyenda-lente');
  const fila = (col, texto, estilo = '', largo = '') => `<div class="fila" title="${String(largo || texto).replace(/<[^>]+>|"/g, '')}"><span class="muestra" style="background:${col};${estilo}"></span>${texto}</div>`;
  let html = '', nota = '';
  if (lente === 'territorio') html = fila('transparent', 'frontera en paz', 'border-top:2px dashed #a89b86;height:0') + fila('#ff4d3d', 'frontera en guerra') + fila('#2e86de', 'alianza (trenzada)');
  else if (lente === 'gobierno') { html = Object.entries(COLOR_GOBIERNO).map(([g, c]) => fila(c, `${g} (${mundo.tribus.filter((t) => t.vivos > 0 && t.gobierno === g).length})`, '', `${g}: ${mundo.tribus.filter((t) => t.vivos > 0 && t.gobierno === g).map((t) => t.nombre).join(', ') || 'ninguno'}`)).join('');
    nota = 'Cámbialos en la ficha de cada pueblo o en el informe «Sociedad».'; }
  else if (lente === 'lenguas') {
    if (ultimaFamilia !== mundo.anio) { familias = familiasDeLenguas(); ultimaFamilia = mundo.anio; }
    const grupos = new Map();
    for (const t of mundo.tribus) if (t.vivos > 0) { const r = familias.get(t.id); if (!grupos.has(r)) grupos.set(r, []); grupos.get(r).push(t.nombre); }
    html = [...grupos].map(([r, ns]) => fila(ESTILO[r % ESTILO.length].color, ns.length > 1 ? `${ns[0]} y ${ns.length - 1} más` : ns[0], '', ns.length > 1 ? `familia de lenguas: ${ns.join(', ')}` : '')).join('');
    nota = 'Mismo color = lenguas emparentadas (se parecen un 30 % o más).';
  } else if (lente === 'comercio') { html = fila('#ffd166', 'ruta de comercio') + fila('transparent', `${mundo.trueques || 0} trueques · ${mundo.regalos || 0} regalos`); nota = 'Las rutas, más gruesas cuantos más trueques.'; }
  else if (lente === 'ideas') { html = seguida ? fila('#ffd166', `«${esc(seguida.concepto)} → ${esc(ACCION[seguida.accion] || seguida.accion)}»`) + fila('transparent', 'puntos: quién la lleva · líneas: de quién la aprendió') : fila('transparent', 'elige una idea en el panel', '', 'Elige una idea en el panel de la derecha, o desde la mente de cualquier persona'); nota = 'Los puntos dorados son quienes llevan la idea y las líneas, de quién la aprendieron.'; }
  else if (lente === 'clima' && mundo.fisica) {
    const r = mundo.fisica.resumen();
    html = fila('linear-gradient(90deg,#3d6fd1,#7fc8a9,#f2d16b,#e0573a)', 'temperatura', '', 'de -15 °C (azul) a 35 °C (rojo); sale del sol, la altura y el agua') + fila('rgba(120,170,255,.9)', 'llueve ahora') + fila('#3a302b', 'volcán', '', 'con humo y temblores: está a punto de reventar') + fila('rgba(255,140,90,.8)', 'falla', '', 'donde tiembla la tierra') + fila('transparent', `ahora: ${r.temperatura} °C de media · lluvia del año ${Math.round(r.lluvia * 100)} % de lo normal${r.ceniza > 0.05 ? ' · ceniza en el cielo' : ''}`);
  }
  else if (lente === 'clima') html = fila('rgba(120,170,255,.6)', 'frío', '', 'frío del invierno: más azul, más frío') + fila('#3b3530', 'bosque quemado') + fila('#9c8358', 'lecho seco') + fila('transparent', `ahora: ${{ sequia: 'sequía', lluvias: 'lluvias', normal: 'clima normal' }[mundo.estadoClima]}`);
  else if (lente === 'recursos') html = fila('#e63946', 'bayas rojas', '', 'bayas rojas con fruto') + fila('#8e44c9', 'moradas', '', 'bayas moradas: veneno') + fila('#c9a26b', 'ciervos') + fila('#9a9a9a', 'lobos') + fila('rgba(140,210,255,.8)', 'peces', '', 'peces: más claro, más peces');
  const nombre = LENTES.find((l) => l[0] === lente)[1];
  // (en una caja de alto fijo: dos columnas; lo largo, al pasar el ratón; y los efectos en una línea al final)
  const efectos = '<div class="efectos"><span><i style="background:var(--mm-fx-share)"></i>compartir</span><span><i style="background:var(--mm-fx-fight)"></i>pelea</span><span><i style="background:var(--mm-fx-birth)"></i>nacer</span><span><i style="background:#fff"></i>morir</span></div>';
  caja.title = nota.replace(/<[^>]+>/g, '');
  caja.innerHTML = `<div class="titulo-lente">Lente · ${nombre}</div><div class="filas-lente">${html}</div>${efectos}`;
}
/** LENTE DE CLIMA: el frío de cada sitio en azul (se calcula una vez; el terreno no cambia el frío). */
let capaTemp = null, ultimaTemp = -1;
function dibujarClima() {
  if (mundo.fisica) {
    // (con la física: la temperatura de cada zona, y dónde llueve ahora)
    const f = mundo.fisica;
    if (!capaTemp) { capaTemp = document.createElement('canvas'); capaTemp.width = f.cw; capaTemp.height = f.ch; }
    if (mundo.tick - ultimaTemp >= 20 || ultimaTemp < 0) {
      ultimaTemp = mundo.tick;
      const im = new ImageData(f.cw, f.ch), pal = [[61, 111, 209], [127, 200, 169], [242, 209, 107], [224, 87, 58]];
      for (let c = 0; c < f.cw * f.ch; c++) {
        const t = Math.max(0, Math.min(0.999, (f.temp[c] + 15) / 50)) * 3, k = Math.floor(t), u = t - k, a = pal[k], b = pal[k + 1];
        im.data.set([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u, 140], c * 4);
      }
      capaTemp.getContext('2d').putImageData(im, 0, 0);
    }
    ctx.imageSmoothingEnabled = true; ctx.drawImage(capaTemp, 0, 0, f.cw * 8 * TAM, f.ch * 8 * TAM); ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = 'rgba(120,170,255,0.9)';
    for (let c = 0; c < f.cw * f.ch; c++) if (f.lluviaAhora[c] > 0.02) {
      const x0 = (c % f.cw) * 8 * TAM, y0 = Math.floor(c / f.cw) * 8 * TAM;
      for (let k = 0; k < 6; k++) ctx.fillRect(x0 + ((k * 37 + mundo.tick * 3) % (8 * TAM)), y0 + ((k * 53 + mundo.tick * 7) % (8 * TAM)), 1, 5);
    }
    return;
  }
  if (!capaClima) {
    capaClima = document.createElement('canvas'); capaClima.width = mundoLienzo.width; capaClima.height = mundoLienzo.height;
    const g = capaClima.getContext('2d');
    for (let y = 0; y < mundo.alto; y += 2) for (let x = 0; x < mundo.ancho; x += 2) {
      const f = mundo.frio(x, y);
      g.fillStyle = `rgba(120,170,255,${Math.min(0.55, (f - 0.3) / 4.4).toFixed(3)})`;
      g.fillRect(x * TAM, y * TAM, TAM * 2, TAM * 2);
    }
  }
  ctx.drawImage(capaClima, 0, 0);
}
/** LENTE DE RECURSOS: todo se oscurece salvo la comida y los animales; los peces de cada zona, en claro. */
function dibujarRecursos() {
  ctx.fillStyle = 'rgba(8,8,10,0.55)'; ctx.fillRect(0, 0, mundoLienzo.width, mundoLienzo.height);
  const W = mundo.ancho, cw = Math.ceil(W / 8);
  for (let c = 0; c < mundo.peces.length; c++) {
    const zx = (c % cw) * 8, zy = Math.floor(c / cw) * 8;
    let agua = false;
    for (let k = 0; k < 8 && !agua; k++) if (mundo.terreno[(Math.min(mundo.alto - 1, zy + k)) * W + Math.min(W - 1, zx + k)] === 0) agua = true;
    if (!agua) continue;
    ctx.fillStyle = `rgba(140,210,255,${(0.15 + 0.5 * mundo.peces[c]).toFixed(2)})`;
    ctx.fillRect(zx * TAM + 10, zy * TAM + 10, 8 * TAM - 20, 8 * TAM - 20);
  }
  for (let i = 0; i < mundo.baya.length; i++) {
    if (!mundo.baya[i] || !mundo.fruta[i]) continue;
    ctx.fillStyle = colorEspecie(mundo.baya[i]);
    ctx.fillRect((i % W) * TAM + 1, Math.floor(i / W) * TAM + 1, TAM - 2, TAM - 2);
  }
  for (const c of mundo.ciervos) if (c.vivo) { ctx.fillStyle = '#c9a26b'; ctx.fillRect(c.x * TAM - 1, c.y * TAM, TAM + 2, TAM); }
  for (const l of mundo.lobos) if (l.vivo) { ctx.fillStyle = '#9a9a9a'; ctx.fillRect(l.x * TAM - 1, l.y * TAM, TAM + 2, TAM); }
}

/** RUTAS DE COMERCIO: una línea de puntos entre los centros de dos pueblos que comercian; más gruesa cuanto más. */
function dibujarRutas() {
  if (!mundo.rutas || !mundo.rutas.size) return;
  if (!dibujarRutas.centros || mundo.tick - dibujarRutas.tick > 60) {
    const s = new Map();
    for (const p of mundo.personas) if (p.vivo) { const c = s.get(p.tribu) || [0, 0, 0]; c[0] += p.hogar[0]; c[1] += p.hogar[1]; c[2]++; s.set(p.tribu, c); }
    dibujarRutas.centros = new Map([...s].map(([t, c]) => [t, [c[0] / c[2], c[1] / c[2]]]));
    dibujarRutas.tick = mundo.tick;
  }
  const C = dibujarRutas.centros;
  ctx.save();
  ctx.setLineDash([4, 4]);
  for (const [k, n] of mundo.rutas) {
    const [a, b] = k.split('-').map(Number);
    if (!C.has(a) || !C.has(b) || n < 3) continue;
    ctx.strokeStyle = 'rgba(255, 209, 102, 0.55)';
    ctx.lineWidth = Math.min(4, 1 + Math.log2(n) / 2);
    ctx.beginPath(); ctx.moveTo(C.get(a)[0] * TAM, C.get(a)[1] * TAM); ctx.lineTo(C.get(b)[0] * TAM, C.get(b)[1] * TAM); ctx.stroke();
  }
  ctx.restore();
}

function dibujar() {
  estilosNuevos();
  if (mundo.terrenoCambiado) { mundo.terrenoCambiado = false; fondo = pintarTerreno(mundo, TAM); territorio = null; }
  ctx.drawImage(fondo, 0, 0);
  if (performance.now() - ultimaAldea > 1000) { ultimaAldea = performance.now(); calcularAldeas(); }
  const conTerritorio = lente === 'territorio' || lente === 'lenguas' || lente === 'gobierno' || lente === 'comercio';
  if (conTerritorio && territorio) {
    if (lente === 'comercio') ctx.globalAlpha = 0.45;
    ctx.drawImage(capaTerritorio, 0, 0); ctx.globalAlpha = 1;
    if (lente === 'territorio') dibujarFronterasGuerra();
  }
  if (lente === 'clima') dibujarClima();
  if (lente === 'comercio') dibujarRutas();
  const { ancho } = mundo;
  for (const i of mundo.huertos) {
    const x = (i % ancho) * TAM, y = Math.floor(i / ancho) * TAM;
    ctx.fillStyle = '#6e5232'; ctx.fillRect(x, y, TAM, TAM);
    ctx.fillStyle = '#54391f'; ctx.fillRect(x, y + 1, TAM, 1); ctx.fillRect(x, y + 4, TAM, 1);
  }
  for (let i = 0; i < mundo.baya.length; i++) {
    if (!mundo.baya[i]) continue;
    pintarArbusto(ctx, (i % ancho) * TAM, Math.floor(i / ancho) * TAM, TAM, mundo.baya[i], mundo.fruta[i] > 0, colorEspecie(mundo.baya[i]));
  }
  if (mundo.refugios) dibujarRefugios();
  else for (const a of aldeas.values()) {
    ctx.drawImage(chozas[a.ruina ? ESTILO.length : a.tribu % ESTILO.length], a.x * TAM - 3, a.y * TAM - 9);
    const nivel = mundo.fuertes.get(`${a.x},${a.y}`);
    if (nivel) pintarEmpalizada(ctx, a.x * TAM + 3, a.y * TAM - 1, TAM, nivel);
  }
  mundo.ciervos.forEach((c, i) => { if (c.vivo) pintarCiervo(ctx, c.x * TAM, c.y * TAM + 1, TAM, ((mundo.tick >> 3) + i) & 1); });
  const paso = mundo.tick >> 3;
  mundo.lobos.forEach((l, i) => { if (l.vivo) pintarLobo(ctx, l.x * TAM - 1, l.y * TAM, TAM, (paso + i) & 1); });
  // LAS TUMBAS (un montículo con un palo) y LOS MUERTOS sin enterrar (tumbados, grises)
  for (const t of mundo.tumbas.values()) { ctx.fillStyle = '#6e5232'; ctx.fillRect(t.x * TAM, t.y * TAM + 3, TAM, 3); ctx.fillStyle = colorTribu(t.tribu); ctx.fillRect(t.x * TAM + 2, t.y * TAM - 2, 1, 5); ctx.fillRect(t.x * TAM + 1, t.y * TAM - 1, 3, 1); }
  for (const c of mundo.cadaveres.values()) { ctx.fillStyle = '#8a8478'; ctx.fillRect(c.x * TAM, c.y * TAM + 3, 5, 2); ctx.fillStyle = '#b9b0a0'; ctx.fillRect(c.x * TAM + 5, c.y * TAM + 3, 2, 2); }
  // LO QUE CAYÓ DEL CIELO: montones de colores que brillan
  const COLOR_CIELO = { obsidiana: '#2b2238', hierro: '#8b6b5a', conchas: '#f1e3c6', oro: '#ffcf3f' };
  for (const y of mundo.yacimientos.values()) {
    ctx.fillStyle = COLOR_CIELO[y.material] || '#fff'; ctx.fillRect(y.x * TAM + 1, y.y * TAM + 2, TAM - 2, TAM - 3);
    if (((fotograma >> 4) + y.x) % 4 === 0) { ctx.fillStyle = '#ffffff'; ctx.fillRect(y.x * TAM + 2, y.y * TAM + 2, 1, 1); }
  }
  // EL FUEGO: llamas que parpadean donde hay una hoguera de verdad
  for (const h of mundo.hogueras.values()) {
    const x = h.x * TAM, y = h.y * TAM, k = (fotograma + h.x * 3 + h.y) >> 3 & 1;
    ctx.fillStyle = '#5a3a1e'; ctx.fillRect(x, y + TAM - 2, TAM, 2);
    ctx.fillStyle = k ? '#ff7a1a' : '#ffb347'; ctx.fillRect(x + 1, y + 1 - k, TAM - 2, TAM - 2 + k);
    ctx.fillStyle = '#ffe08a'; ctx.fillRect(x + 2, y + 2, TAM - 4, TAM - 3);
  }
  for (const d of mundo.perros) if (d.vivo) { const q = mundo.porId.get(d.dueno); pintarPerro(ctx, d.x * TAM + 1, d.y * TAM + 2, TAM - 1, (paso + d.nacio) & 1, q ? colorTribu(q.tribu) : null); }
  // LUGARES DE CADA PUEBLO: un poste con una calavera (prohibido) o un manojo de bayas (abundancia), del color del pueblo
  if (mundo.lugaresPueblo) for (const l of mundo.lugaresPueblo.values()) {
    const x = ((l.zona % 64) * 4 + 2) * TAM, y = (Math.floor(l.zona / 64) * 4 + 2) * TAM;
    ctx.fillStyle = '#5a4630'; ctx.fillRect(x + 2, y - 6, 2, 10);
    ctx.fillStyle = colorTribu(l.tribu); ctx.fillRect(x - 1, y - 9, 8, 1);
    if (l.tipo === 'prohibido') { ctx.fillStyle = '#efe6d2'; ctx.fillRect(x, y - 8, 6, 4); ctx.fillStyle = '#110f0c'; ctx.fillRect(x + 1, y - 7, 1, 1); ctx.fillRect(x + 4, y - 7, 1, 1); }
    else { ctx.fillStyle = PAL.baya; ctx.fillRect(x, y - 8, 2, 2); ctx.fillRect(x + 4, y - 8, 2, 2); ctx.fillRect(x + 2, y - 6, 2, 2); }
  }
  for (const e of mundo.efectos) {
    const edad = mundo.tick - e.t;
    if (e.tipo === 'idea') { if (edad <= 24) chispa(e, edad / 24); continue; }
    if (e.tipo === 'rayo' || e.tipo === 'plaga' || e.tipo === 'comida' || e.tipo === 'lobos' || e.tipo === 'meteorito' || e.tipo === 'lluvia' || e.tipo === 'sequia') { if (edad <= 60) efectoPoder(e, edad); continue; }
    if (e.tipo === 'volcan' || e.tipo === 'terremoto' || e.tipo === 'temblor') {
      const dur = e.tipo === 'temblor' ? 20 : 60; if (edad > dur) continue;
      const x = e.x * TAM + 3, y = e.y * TAM + 3, f = edad / dur;
      ctx.globalAlpha = 1 - f;
      if (e.tipo === 'volcan') {
        if (edad < 8) { ctx.fillStyle = 'rgba(255,90,30,0.25)'; ctx.fillRect(0, 0, mundoLienzo.width, mundoLienzo.height); }
        for (let k = 0; k < 3; k++) anillo(ctx, x, y, 6 + edad * 1.2 + k * 10, k ? '#ffb347' : '#ff4d1f', 3);
      } else for (let k = 0; k < (e.tipo === 'terremoto' ? 3 : 1); k++) anillo(ctx, x, y, 4 + edad * (e.tipo === 'terremoto' ? 1.4 : 0.8) + k * 12, '#b08a5a', 2);
      ctx.globalAlpha = 1;
      continue;
    }
    if (e.tipo === 'fuego') {
      // llamas que parpadean sobre lo quemado
      if (edad > 39) continue;
      const x = e.x * TAM, y = e.y * TAM, k = (mundo.tick + e.x * 7 + e.y * 3) & 3;
      ctx.globalAlpha = 1 - edad / 40;
      ctx.fillStyle = k < 2 ? '#ff7a1a' : '#ffd166'; ctx.fillRect(x + 1, y - k, TAM - 2, TAM - 1 + k);
      ctx.fillStyle = '#ff4d3d'; ctx.fillRect(x + 2, y + 2, 2, 3);
      ctx.globalAlpha = 1;
      continue;
    }
    if (e.tipo === 'robo') {
      if (edad > 30) continue;
      ctx.globalAlpha = 1 - edad / 30;
      anillo(ctx, e.x * TAM + 3, e.y * TAM + 3, 2 + edad * 0.25, '#b04cff', 2);
      ctx.globalAlpha = 1;
      continue;
    }
    if (e.tipo === 'riada') {
      if (edad > 39) continue;
      ctx.globalAlpha = 1 - edad / 40;
      for (let k = 0; k < 3; k++) anillo(ctx, e.x * TAM + 3, e.y * TAM + 3, 6 + edad * 0.8 + k * 6, '#6fb3c9', 2);
      ctx.globalAlpha = 1;
      continue;
    }
    if (e.tipo === 'grito') {
      if (edad > 36 || !e.palabra) continue;
      const texto = `¡${e.palabra}!`, x = e.x * TAM + 3, y = e.y * TAM - 8 - Math.min(6, edad / 3);
      ctx.globalAlpha = edad < 28 ? 1 : 1 - (edad - 28) / 8;
      ctx.font = 'bold 8px "JetBrains Mono", monospace';
      const w = ctx.measureText(texto).width + 6;
      ctx.fillStyle = 'rgba(17,15,12,0.85)'; ctx.fillRect(Math.round(x - w / 2), Math.round(y - 8), Math.round(w), 11);
      ctx.fillStyle = '#ffd166'; ctx.textAlign = 'center'; ctx.fillText(texto, x, y);
      ctx.textAlign = 'start'; ctx.globalAlpha = 1;
      continue;
    }
    if (e.tipo === 'pesca' || e.tipo === 'caza' || e.tipo === 'objeto') {
      if (edad > 30) continue;
      ctx.globalAlpha = 1 - edad / 30;
      anillo(ctx, e.x * TAM + 3, e.y * TAM + 3, 2 + edad * 0.2, { pesca: '#6fb3c9', caza: '#c9a26b', objeto: '#ffd166' }[e.tipo], 2);
      ctx.globalAlpha = 1;
      continue;
    }
    if (edad > 40) continue;
    ctx.globalAlpha = 1 - edad / 40;
    anillo(ctx, e.x * TAM + 3, e.y * TAM + 3, 2 + edad * 0.22, COLOR_EFECTO[e.tipo] || '#fff', 2);
  }
  ctx.globalAlpha = 1;
  const andar = velocidad <= 16 ? fotograma >> 3 : mundo.tick >> 2;
  // (MOVIMIENTO SUAVE: entre paso y paso, cada uno se dibuja a medio camino de su casilla anterior a la nueva)
  const f = velocidad <= 16 ? Math.min(1, (performance.now() - ultimoPaso) / (1000 / (velocidad * PASOS_POR_SEGUNDO))) : 1;
  for (const p of mundo.personas) {
    if (!p.vivo) continue;
    const suave = f < 1 && p.ax != null && Math.abs(p.ax - p.x) <= 1 && Math.abs(p.ay - p.y) <= 1;
    p.rx = suave ? p.ax + (p.x - p.ax) * f : p.x; p.ry = suave ? p.ay + (p.y - p.ay) * f : p.y;
    const RX = p.rx * TAM, RY = p.ry * TAM;
    const nino = p.edad < 14 * TICKS_POR_ANIO ? 1 : 0;
    const anda = p.objetivo && (p.objetivo[0] !== p.x || p.objetivo[1] !== p.y) ? (andar + p.id) & 1 : 0;
    if (p.dormido) {
      // tumbado: el cuerpo en horizontal, la cabeza a un lado y una zeta encima
      const col = ESTILO[p.tribu % ESTILO.length];
      ctx.fillStyle = col.color; ctx.fillRect(RX, RY + 3, nino ? 3 : 5, 2);
      ctx.fillStyle = PAL.piel; ctx.fillRect(RX + (nino ? 3 : 5), RY + 3, 2, 2);
      if (!nino && ((mundo.tick >> 4) + p.id) % 3 === 0) { ctx.fillStyle = '#c9d6ff'; ctx.fillRect(RX + 5, RY - 2, 2, 1); ctx.fillRect(RX + 6, RY - 1, 1, 1); ctx.fillRect(RX + 5, RY, 2, 1); }
      continue;
    }
    ctx.drawImage(hoja.get(clavePersona(p.tribu % ESTILO.length, nino, p.carga > 0 ? 1 : 0, anda)), RX - 1, RY - 3);
    if (mundo.terreno[p.y * mundo.ancho + p.x] === 0) { ctx.fillStyle = '#7a5230'; ctx.fillRect(RX - 2, RY + 4, 9, 2); }
    if (p.cosas.length) {
      const prot = mundo.uso(p, 'proteccion'), abr = mundo.uso(p, 'abrigo');
      if (prot >= 0.2) { ctx.fillStyle = '#9aa3ad'; ctx.fillRect(RX, RY + 1, 4, 2); ctx.fillStyle = '#5c6670'; ctx.fillRect(RX + 1, RY + 1, 2, 1); }
      else if (abr >= 0.25) { ctx.fillStyle = abr >= 0.5 ? '#8a5a2b' : '#b8a27a'; ctx.fillRect(RX - 1, RY + 1, 6, 1); }
    }
  }
  // LOS LÍDERES: la persona más respetada de cada pueblo lleva una corona dorada
  if (mundo.lideres) for (const id of mundo.lideres.values()) {
    const q = mundo.porId.get(id);
    if (!q || !q.vivo || q.dormido) continue;
    const x = (q.rx ?? q.x) * TAM - 1, y = (q.ry ?? q.y) * TAM - 7;
    ctx.fillStyle = '#ffd166'; ctx.fillRect(x + 1, y + 1, 6, 2); ctx.fillRect(x + 1, y, 1, 1); ctx.fillRect(x + 3, y - 1, 2, 2); ctx.fillRect(x + 6, y, 1, 1);
  }
  if (mundo.fisica) dibujarFrioYHielo();
  else if (mundo.estacion === 'invierno') {
    // (más blanco al norte, donde el invierno es duro)
    const g = ctx.createLinearGradient(0, 0, 0, mundoLienzo.height);
    g.addColorStop(0, 'rgba(235,242,255,0.45)'); g.addColorStop(0.5, 'rgba(225,235,255,0.18)'); g.addColorStop(1, 'rgba(225,235,255,0.05)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, mundoLienzo.width, mundoLienzo.height);
  }
  else if (mundo.estacion === 'otoño') { ctx.fillStyle = 'rgba(200,120,40,0.10)'; ctx.fillRect(0, 0, mundoLienzo.width, mundoLienzo.height); }
  if (lente === 'recursos') dibujarRecursos();
  if (mundo.aguaSucia) dibujarAguaTurbia();
  if (mundo.geologia) dibujarVolcanes();
  if (mundo.pinturas && mundo.pinturas.size) dibujarPinturas();
  if (mundo.fisica && mundo.fisica.ceniza > 0.02) { ctx.fillStyle = `rgba(70,60,55,${(0.35 * mundo.fisica.ceniza).toFixed(3)})`; ctx.fillRect(0, 0, mundoLienzo.width, mundoLienzo.height); }
  if (mundo.fisica && verNubes && lente !== 'recursos') dibujarNubes();
  if (verNiebla) dibujarNiebla();
  if (verNoche && lente !== 'clima' && lente !== 'recursos') dibujarNoche();
  if (mundo.refugios) dibujarNombresDeLugares();
  if (seguida) dibujarRio();
  if (puebloElegido != null && !elegido) dibujarPuebloElegido();
  if (elegido && elegido.vivo) anillo(ctx, (elegido.rx ?? elegido.x) * TAM + 3, (elegido.ry ?? elegido.y) * TAM + 1, 8, '#ffffff', 2);
}

// ---- los poderes del dios ----
const PODERES = [
  { id: 'rayo', nombre: 'Rayo', tecla: '1', color: '#ffd166', ayuda: 'clic en el mapa · mata a quien toca; los que lo ven se asustan y aprenden de ese susto',
    icono: ['....####....', '...####.....', '..####......', '.#######....', '....####....', '...####.....', '..####......', '.####.......', '.###........', '.##.........', '.#..........', '............'] },
  { id: 'plaga', nombre: 'Plaga', tecla: '2', color: '#8e44c9', ayuda: 'clic en el mapa · enferma a la zona y se contagia; quien se cura queda inmune',
    icono: ['............', '..#......#..', '...#....#...', '....####....', '...##..##...', '..###..###..', '..########..', '...######...', '....####....', '...#....#...', '..#......#..', '............'] },
  { id: 'comida', nombre: 'Comida', tecla: '3', color: '#e0453a', ayuda: 'clic en el mapa · brotan bayas rojas alrededor',
    icono: ['............', '.....##.....', '....#..#....', '....####....', '..########..', '.##########.', '.##########.', '..########..', '...######...', '....####....', '............', '............'] },
  { id: 'meteorito', nombre: 'Del cielo', tecla: '5', color: '#7fd3e8', ayuda: 'clic en el mapa · cae un material que nunca habían visto (obsidiana, hierro, conchas, oro): ¿le encontrarán uso?',
    icono: ['.........#..', '........#...', '.......#....', '......#.....', '....###.....', '...#####....', '..#######...', '..#######...', '...#####....', '....###.....', '............', '............'] },
  { id: 'volcan', nombre: 'Volcán', tecla: '6', color: '#ff6a2a', mas: true, ayuda: 'clic en el mapa · revienta el volcán más cercano; si no hay, nace uno: lava, ceniza que enfría el cielo y, con los años, tierra fértil',
    icono: ['.....##.....', '....#..#....', '.....##.....', '....####....', '...#....#...', '...######...', '..########..', '..###..###..', '.##########.', '.####..####.', '############', '............'] },
  { id: 'terremoto', nombre: 'Terremoto', tecla: '7', color: '#c99a5b', mas: true, ayuda: 'clic en el mapa · tiembla la tierra: hiere, tira empalizadas y despensas y a veces abre un manantial',
    icono: ['............', '#...........', '.#....#.....', '..#..#.#....', '...##...#...', '.........#..', '..........#.', '...........#', '............', '############', '#.#.#.#.#.#.', '............'] },
  { id: 'lluvia', nombre: 'Lluvia', tecla: '8', color: '#7fb6ff', mas: true, ayuda: 'clic en el mapa · llueve a mares en la comarca: el suelo se empapa y los lagos crecerán',
    icono: ['....####....', '..########..', '.##########.', '############', '.##########.', '............', '.#...#...#..', '#...#...#...', '...#...#...#', '..#...#...#.', '.#...#...#..', '............'] },
  { id: 'sequia', nombre: 'Sequía', tecla: '9', color: '#f2a541', mas: true, ayuda: 'clic en el mapa · la comarca se seca: menos fruta, y los lagos menguarán',
    icono: ['.....#......', '..#..#..#...', '...#.#.#....', '....###.....', '.##########.', '....###.....', '...#.#.#....', '..#..#..#...', '.....#......', '............', '#.##.#.##.#.', '############'] },
  { id: 'langostas', nombre: 'Langostas', tecla: '0', color: '#9bbf3b', mas: true, ayuda: 'clic en el mapa · una nube de langostas se come toda la fruta de la comarca durante una estación',
    icono: ['............', '.#.....#....', '..#...#.....', '...###......', '..#####..#..', '.#######.#..', '..#####..#..', '...#.#...#..', '..#...#..#..', '.#.....#.#..', '............', '............'] },
  { id: 'planta', nombre: 'Planta nueva', tecla: 'p', color: '#d0a8ff', mas: true, ayuda: 'clic en el mapa · brota una especie que nadie ha visto: ¿la probarán, o se fiarán de lo que se parece?',
    icono: ['.....##.....', '....#..#....', '.....##.....', '..##..#.##..', '.#..#.#.#..#', '..##..#..##.', '......#.....', '...##.#.....', '..#..##.....', '...##.#.....', '......#.....', '....####....'] },
  { id: 'lobos', nombre: 'Lobos', tecla: '4', color: '#8a8a8a', ayuda: 'clic en el mapa · una manada que caza también fuera del bosque durante un tiempo',
    icono: ['............', '..#.....#...', '..##...##...', '..#######...', '..#.###.#...', '..#######...', '...#####....', '....###.....', '.....#......', '............', '............', '............'] },
];
function prepararPoderes() {
  // (los de siempre, a la vista; los de la tierra y el cielo, en «Más poderes»)
  const pintar = (cont, lista, largo) => {
    cont.innerHTML = lista.map((p) => `<button class="boton ${largo ? 'poder-largo' : 'cuadrado'} poder" data-poder="${p.id}" title="${p.nombre} (${p.tecla}): ${p.ayuda}"><canvas width="24" height="24"></canvas>${largo ? `<span>${p.nombre}</span>` : ''}<span class="tecla">${p.tecla}</span></button>`).join('');
    cont.querySelectorAll('canvas').forEach((c, i) => {
      const g = c.getContext('2d');
      g.fillStyle = lista[i].color;
      lista[i].icono.forEach((fila, y) => { for (let x = 0; x < 12; x++) if (fila[x] === '#') g.fillRect(x * 2, y * 2, 2, 2); });
    });
  };
  pintar($('#poderes'), PODERES.filter((p) => !p.mas), false);
  pintar($('#lista-mas-poderes'), PODERES.filter((p) => p.mas), true);
}
function prepararPoder(id) {
  poder = poder === id ? null : id;
  document.querySelectorAll('.poder').forEach((b) => b.classList.toggle('activo', b.dataset.poder === poder));
  const p = PODERES.find((x) => x.id === poder);
  $('#ayuda-poder').hidden = !p;
  if (p) $('#ayuda-poder').innerHTML = `<b style="color:${p.color}">${p.nombre}</b> ${p.ayuda} · <span class="tenue">Esc para cancelar</span>`;
  lienzo.style.cursor = poder ? 'cell' : '';
}
function lanzarPoder(x, y) {
  const cx = Math.floor(x), cy = Math.floor(y);
  if (poder === 'rayo') mundo.rayo(cx, cy);
  else if (poder === 'plaga') mundo.plaga(cx, cy);
  else if (poder === 'comida') mundo.comida(cx, cy);
  else if (poder === 'lobos') mundo.soltarLobos(cx, cy);
  else if (poder === 'meteorito') mundo.meteorito(cx, cy);
  else if (poder === 'volcan') mundo.volcanAqui(cx, cy);
  else if (poder === 'terremoto') mundo.terremotoAqui(cx, cy);
  else if (poder === 'lluvia') mundo.lluviaAqui(cx, cy);
  else if (poder === 'sequia') mundo.sequiaAqui(cx, cy);
  else if (poder === 'langostas') mundo.plagaDeLangostas(cx, cy);
  else if (poder === 'planta') mundo.llegaPlanta(cx, cy);
}
/** Lo que se ve al usar un poder. */
function efectoPoder(e, edad) {
  const x = e.x * TAM + 3, y = e.y * TAM + 3, f = edad / 60;
  ctx.globalAlpha = 1 - f;
  if (e.tipo === 'rayo') {
    if (edad < 10) { ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(0, 0, mundoLienzo.width, mundoLienzo.height); }
    ctx.fillStyle = PAL.fx.ideaNucleo;
    let bx = x;
    for (let yy = y - 120; yy < y; yy += 8) { const nx = bx + ((yy * 7) % 9) - 4; ctx.fillRect(Math.min(bx, nx), yy, Math.abs(nx - bx) + 3, 9); bx = nx; }
    anillo(ctx, x, y, 4 + edad * 0.4, '#fff3c4', 3);
  } else if (e.tipo === 'meteorito') {
    // (una estela que cae y un destello al llegar)
    if (edad < 12) { const t = edad / 12; ctx.fillStyle = '#fff3c4'; ctx.fillRect(x - 60 + 60 * t - 2, y - 140 + 140 * t - 2, 5, 5); ctx.fillStyle = 'rgba(127,211,232,0.6)'; ctx.fillRect(x - 60 + 60 * t - 14, y - 140 + 140 * t - 14, 8, 8); }
    else anillo(ctx, x, y, 4 + (edad - 12) * 0.6, '#7fd3e8', 3);
  } else if (e.tipo === 'lluvia') {
    ctx.fillStyle = '#9cc7ff';
    for (let k = 0; k < 40; k++) ctx.fillRect(x - 90 + ((k * 47) % 180), y - 90 + ((k * 31 + edad * 6) % 180), 1, 6);
    anillo(ctx, x, y, 10 + edad * 1.2, '#7fb6ff', 2);
  } else if (e.tipo === 'sequia') {
    anillo(ctx, x, y, 10 + edad * 1.2, '#f2a541', 3); anillo(ctx, x, y, 4 + edad * 0.7, '#ffd166', 2);
  } else if (e.tipo === 'plaga') {
    for (let k = 0; k < 3; k++) anillo(ctx, x, y, 6 + edad * 0.6 + k * 8, '#8e44c9', 2);
  } else if (e.tipo === 'comida') {
    anillo(ctx, x, y, 4 + edad * 0.45, PAL.baya, 2); anillo(ctx, x, y, 2 + edad * 0.3, '#7ddf64', 2);
  } else {
    anillo(ctx, x, y, 4 + edad * 0.5, '#d9d9d9', 2);
  }
  ctx.globalAlpha = 1;
}

// ---- el minimapa ----
const minimapa = $('#minimapa'), mini = minimapa.getContext('2d');
function dibujarMinimapa() {
  const W = minimapa.width, H = minimapa.height;
  mini.imageSmoothingEnabled = true;
  mini.drawImage(fondo, 0, 0, W, H);
  if (capaTerritorio && lente !== 'clima' && lente !== 'recursos') mini.drawImage(capaTerritorio, 0, 0, W, H);
  const ex = W / mundo.ancho, ey = H / mundo.alto;
  for (const p of mundo.personas) { if (!p.vivo) continue; mini.fillStyle = colorTribu(p.tribu); mini.fillRect(p.x * ex, p.y * ey, 1.5, 1.5); }
  // lo que se ve ahora
  const z = camara.zoom, sw = lienzo.width / z, sh = lienzo.height / z;
  mini.strokeStyle = '#f3eadb'; mini.lineWidth = 1;
  mini.strokeRect(((camara.x - sw / 2) / mundoLienzo.width) * W + 0.5, ((camara.y - sh / 2) / mundoLienzo.height) * H + 0.5, (sw / mundoLienzo.width) * W, (sh / mundoLienzo.height) * H);
}
minimapa.addEventListener('click', (ev) => {
  const r = minimapa.getBoundingClientRect();
  camara.x = ((ev.clientX - r.left) / r.width) * mundoLienzo.width;
  camara.y = ((ev.clientY - r.top) / r.height) * mundoLienzo.height;
  if (camara.zoom <= camara.min * 1.01) camara.zoom = camara.min * 3;
  limitarCamara();
});

// ---- la niebla: lo que nadie ha visto aún ----
function dibujarNiebla() {
  if (!niebla || niebla.width !== mundoLienzo.width) { niebla = document.createElement('canvas'); niebla.width = mundoLienzo.width; niebla.height = mundoLienzo.height; ultimaNiebla = 0; }
  if (performance.now() - ultimaNiebla > 700) {
    ultimaNiebla = performance.now();
    const g = niebla.getContext('2d'), W = mundo.ancho, H = mundo.alto;
    g.clearRect(0, 0, niebla.width, niebla.height);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (mundo.explorado[y * W + x]) continue;
      // (en el borde de lo explorado, más clara: la niebla se levanta poco a poco)
      let borde = false;
      for (let dy = -1; dy <= 1 && !borde; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < W && yy < H && mundo.explorado[yy * W + xx]) { borde = true; break; } }
      g.fillStyle = borde ? 'rgba(17,15,12,0.55)' : ((x + y) & 1 ? 'rgba(17,15,12,0.88)' : 'rgba(26,22,18,0.88)');
      g.fillRect(x * TAM, y * TAM, TAM, TAM);
    }
  }
  ctx.drawImage(niebla, 0, 0);
}

// ---- aldeas, territorios y noche ----
/**
 * LAS ALDEAS: donde viven las familias (su hogar) se levanta una choza con el tejado de su cultura. Si nadie vive ya
 * allí, queda en ruinas unos años. Los territorios salen de la influencia de las chozas habitadas.
 */
function calcularAldeas() {
  const habitadas = new Map();
  for (const p of mundo.personas) {
    if (!p.vivo || p.edad < 14 * TICKS_POR_ANIO) continue;
    const k = `${p.hogar[0] >> 1},${p.hogar[1] >> 1}`;   // (hogares a menos de 2 casillas: la misma choza)
    let h = habitadas.get(k);
    if (!h) habitadas.set(k, h = { x: p.hogar[0], y: p.hogar[1], votos: new Map(), gente: 0 });
    h.gente++; h.votos.set(p.tribu, (h.votos.get(p.tribu) || 0) + 1);
  }
  let cambio = false;
  for (const [k, h] of habitadas) {
    const tribu = [...h.votos].sort((a, b) => b[1] - a[1])[0][0];
    const a = aldeas.get(k);
    if (!a || a.ruina || a.tribu !== tribu) cambio = true;
    aldeas.set(k, { x: h.x, y: h.y, tribu, gente: h.gente, visto: mundo.anio, ruina: false });
  }
  for (const [k, a] of aldeas) {
    if (habitadas.has(k)) continue;
    if (!a.ruina) { a.ruina = true; cambio = true; }
    if (mundo.anio - a.visto > 25) aldeas.delete(k);   // (las ruinas acaban desapareciendo)
  }
  if (cambio || !territorio || mundo.anio !== calcularAldeas.anio) { calcularAldeas.anio = mundo.anio; calcularTerritorio(); }
}

/** El territorio: cada choza habitada suma exp(-d²/r²) para su cultura; gana la de más influencia (si pasa de 0,08). */
function calcularTerritorio() {
  const W = mundo.ancho, H = mundo.alto, R = 14, inf = new Float32Array(W * H * 16), dueno = new Int8Array(W * H).fill(-1);
  for (const a of aldeas.values()) {
    if (a.ruina) continue;
    const c = a.tribu % 16;
    for (let y = Math.max(0, a.y - R * 2); y < Math.min(H, a.y + R * 2); y++) for (let x = Math.max(0, a.x - R * 2); x < Math.min(W, a.x + R * 2); x++) {
      inf[(y * W + x) * 16 + c] += Math.exp(-((a.x - x) ** 2 + (a.y - y) ** 2) / (R * R)) * Math.min(3, 1 + a.gente / 6);
    }
  }
  for (let i = 0; i < W * H; i++) {
    if (mundo.terreno[i] === 0) continue;
    let mejor = -1, v = 0.08;
    for (let c = 0; c < 16; c++) if (inf[i * 16 + c] > v) { v = inf[i * 16 + c]; mejor = c; }
    dueno[i] = mejor;
  }
  territorio = dueno;
  pintarTerritorio();
}

const claveRel = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`);
function pintarTerritorio() {
  const g = capaTerritorio.getContext('2d'), W = mundo.ancho, H = mundo.alto, s = 2;
  g.clearRect(0, 0, capaTerritorio.width, capaTerritorio.height);
  fronterasGuerra = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const o = territorio[y * W + x];
    if (o < 0) continue;
    const px = x * TAM, py = y * TAM, col = colorLente(o);
    // tinte en tablero (una casilla de cada dos) al 20 %: se lee sobre hierba y bosque sin tapar a la gente
    if (((x + y) & 1) === 0) { g.fillStyle = col + (lente === 'territorio' ? '33' : '55'); g.fillRect(px, py, TAM, TAM); }
    for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
      const q = territorio[yy * W + xx];
      if (q === o || q < 0) continue;
      // (en las otras lentes, la frontera solo se marca donde cambia el color: entre lenguas o gobiernos distintos)
      if (lente !== 'territorio') {
        if (colorLente(q) === col) continue;
        const seg2 = dx === 1 ? [px + TAM - s, py, s, TAM] : dx === -1 ? [px, py, s, TAM] : dy === 1 ? [px, py + TAM - s, TAM, s] : [px, py, TAM, s];
        g.fillStyle = col; g.fillRect(...seg2); continue;
      }
      const rel = mundo.relaciones.get(claveRel(o, q));
      const seg = dx === 1 ? [px + TAM - s, py, s, TAM] : dx === -1 ? [px, py, s, TAM] : dy === 1 ? [px, py + TAM - s, TAM, s] : [px, py, TAM, s];
      if (rel === 'guerra') { fronterasGuerra.push([...seg, x + y]); continue; }
      if (rel === 'alianza') g.fillStyle = ((x + y) & 1) ? col : colorLente(q);   // trenzada con los dos colores
      else { if (((x * 3 + y) & 3) !== 0) continue; g.fillStyle = col; }             // punteada: en paz
      g.fillRect(...seg);
    }
  }
}
/** La frontera en guerra: rojo y negro que avanzan (un alambre que vibra). */
function dibujarFronterasGuerra() {
  const fase = (fotograma >> 2) & 1;
  for (const [x, y, w, h, par] of fronterasGuerra) { ctx.fillStyle = ((par + fase) & 1) ? PAL.fx.pelea : '#2a0a08'; ctx.fillRect(x, y, w, h); }
}

/** LA NOCHE (solo visual: la simulación no duerme): un velo azul y la luz de las hogueras de cada choza habitada. */
/**
 * LA FÍSICA, a la vista: la nieve donde hace frío de verdad (no por la estación), el hielo sobre el agua y las nubes
 * (con su sombra), que el viento del oeste lleva. Capas pequeñas (una celda, un píxel) que se estiran suavizadas.
 */
let capaNieve = null, capaNubes = null, capaSombra = null, capaHielo = null, ultimaFisica = -1, verNubes = true;
function capasFisica() {
  const f = mundo.fisica;
  if (!capaNieve) {
    capaNieve = document.createElement('canvas'); capaNieve.width = f.cw; capaNieve.height = f.ch;
    capaNubes = document.createElement('canvas'); capaNubes.width = f.cw; capaNubes.height = f.ch;
    capaSombra = document.createElement('canvas'); capaSombra.width = f.cw; capaSombra.height = f.ch;
  }
  if (mundo.tick - ultimaFisica < 20 && ultimaFisica >= 0) return;
  ultimaFisica = mundo.tick;
  const n = f.cw * f.ch, nieve = new ImageData(f.cw, f.ch), nubes = new ImageData(f.cw, f.ch), sombra = new ImageData(f.cw, f.ch);
  for (let c = 0; c < n; c++) {
    const frio = Math.max(0, Math.min(1, (1.5 - f.temp[c]) / 8));
    nieve.data.set([236, 243, 255, Math.round(frio * 150)], c * 4);
    const a = Math.round(Math.min(1, f.nube[c]) * 170 + (f.lluviaAhora[c] > 0.02 ? 30 : 0));
    nubes.data.set([250, 250, 252, a], c * 4);
    sombra.data.set([0, 0, 0, Math.round(a * 0.35)], c * 4);
  }
  capaNieve.getContext('2d').putImageData(nieve, 0, 0);
  capaNubes.getContext('2d').putImageData(nubes, 0, 0);
  capaSombra.getContext('2d').putImageData(sombra, 0, 0);
}
function dibujarFrioYHielo() {
  capasFisica();
  const f = mundo.fisica, W = mundo.ancho;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(capaNieve, 0, 0, f.cw * 8 * TAM, f.ch * 8 * TAM);
  ctx.imageSmoothingEnabled = false;
  if (mundo.hieloSucio || !capaHielo) {
    mundo.hieloSucio = false;
    if (!capaHielo) { capaHielo = document.createElement('canvas'); capaHielo.width = mundoLienzo.width; capaHielo.height = mundoLienzo.height; }
    const g = capaHielo.getContext('2d'); g.clearRect(0, 0, capaHielo.width, capaHielo.height);
    for (let i = 0; i < f.hielo.length; i++) {
      if (!f.hielo[i]) continue;
      const x = (i % W) * TAM, y = Math.floor(i / W) * TAM;
      g.fillStyle = '#d8e9f5'; g.fillRect(x, y, TAM, TAM);
      g.fillStyle = '#b9d3e6'; if ((i * 7) % 5 === 0) g.fillRect(x + 1, y + 2, TAM - 3, 1);
    }
  }
  ctx.drawImage(capaHielo, 0, 0);
}
/** LOS VOLCANES: un cono oscuro; con humo si está a punto (o acaba de reventar). En la lente de clima, la falla. */
function dibujarVolcanes() {
  const g = mundo.geologia;
  for (const v of g.volcanes) {
    const x = v.x * TAM, y = v.y * TAM;
    ctx.fillStyle = '#3a302b'; ctx.beginPath(); ctx.moveTo(x - 9, y + 7); ctx.lineTo(x - 2, y - 6); ctx.lineTo(x + 8, y - 6); ctx.lineTo(x + 15, y + 7); ctx.closePath(); ctx.fill();
    ctx.fillStyle = v.humo || (v.ultima != null && mundo.anio - v.ultima < 2) ? '#ff5a1f' : '#5a4a40'; ctx.fillRect(x - 1, y - 6, 8, 2);
    if (v.humo || (v.ultima != null && mundo.anio - v.ultima < 2)) {
      for (let k = 0; k < 4; k++) {
        const t = ((mundo.tick * 0.6 + k * 9) % 36) / 36;
        ctx.fillStyle = `rgba(120,115,110,${(0.55 * (1 - t)).toFixed(2)})`;
        ctx.fillRect(x + 2 + t * 18 - 4 * t * t, y - 8 - t * 34, 6 + t * 10, 6 + t * 8);
      }
    }
  }
  if (lente === 'clima') {
    const [[x1, y1], [x2, y2]] = g.falla;
    ctx.strokeStyle = 'rgba(255,140,90,0.7)'; ctx.setLineDash([8, 6]); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x1 * TAM, y1 * TAM); ctx.lineTo(x2 * TAM, y2 * TAM); ctx.stroke(); ctx.setLineDash([]);
  }
}

/** LAS PINTURAS: un dibujo ocre en la roca (una mano y una figura); lo escrito, unos trazos oscuros en fila. */
function dibujarPinturas() {
  for (const pin of mundo.pinturas.values()) {
    const x = pin.x * TAM, y = pin.y * TAM;
    if (pin.escrita) {
      ctx.fillStyle = '#2a1d14'; for (let k = 0; k < 3; k++) ctx.fillRect(x + 1 + k * 2, y + 1 + (k % 2), 1, 4);
      ctx.fillStyle = colorTribu(pin.tribu); ctx.fillRect(x, y + TAM - 1, TAM, 1);
    } else {
      ctx.fillStyle = '#c0582c'; ctx.fillRect(x + 1, y + 1, 2, 3); ctx.fillRect(x + 4, y + 2, 1, 3); ctx.fillRect(x + 3, y + 1, 3, 1);
      ctx.fillStyle = colorTribu(pin.tribu); ctx.fillRect(x, y + TAM - 1, TAM, 1);
    }
  }
}

/**
 * LOS REFUGIOS DE VERDAD: la boca de una cueva en la roca (con un fuego dentro si vive alguien), las chozas de cada
 * cultura, las casas de barro y las ruinas; las empalizadas; y el nombre de los pueblos y ciudades.
 */
function dibujarRefugios() {
  for (const r of mundo.refugios.values()) {
    const x = r.x * TAM, y = r.y * TAM;
    if (r.tipo === 'cueva') {
      const [rx, ry] = r.roca, X = rx * TAM, Y = ry * TAM;
      ctx.fillStyle = '#1b1510'; ctx.fillRect(X + 1, Y + 2, TAM - 2, TAM - 2); ctx.fillRect(X + 2, Y + 1, TAM - 4, 1);
      if (mundo.ocupacion(r) > 0) { ctx.fillStyle = (fotograma >> 3) & 1 ? '#ff9a3a' : '#ffd166'; ctx.fillRect(X + 3, Y + TAM - 3, 2, 2); }
    } else if (r.tipo === 'cobijo') {
      // (un paraviento de ramas)
      ctx.fillStyle = '#6b4a2a'; for (let k = 0; k < 5; k++) ctx.fillRect(x - 2 + k * 2, y + 3 - k, 2, 3 + k);
      ctx.fillStyle = '#3f6b2e'; ctx.fillRect(x + 4, y - 3, 4, 2);
    } else if (r.tipo === 'choza') ctx.drawImage(chozas[r.tribu % ESTILO.length], x - 3, y - 9);
    else if (r.tipo === 'casa') {
      const e = ESTILO[r.tribu % ESTILO.length];
      ctx.fillStyle = '#c9a873'; ctx.fillRect(x - 3, y - 4, 13, 9); ctx.fillStyle = '#a5875a'; ctx.fillRect(x - 3, y + 4, 13, 1);
      ctx.fillStyle = e.color; ctx.fillRect(x - 4, y - 7, 15, 3); ctx.fillStyle = e.oscuro; ctx.fillRect(x - 4, y - 5, 15, 1);
      ctx.fillStyle = '#2a1c10'; ctx.fillRect(x + 2, y, 3, 5); ctx.fillStyle = '#ffd98a'; ctx.fillRect(x - 1, y - 2, 2, 2); ctx.fillRect(x + 7, y - 2, 2, 2);
    } else if (r.tipo === 'ruina') ctx.drawImage(chozas[ESTILO.length], x - 3, y - 9);
    const nivel = mundo.fuertes.get(`${r.x},${r.y}`);
    if (nivel) pintarEmpalizada(ctx, x + 3, y - 1, TAM, nivel);
  }
}

/** Los nombres de los pueblos y ciudades, encima de todo (una etiqueta oscura con el color de su gente). */
function dibujarNombresDeLugares() {
  if (!mundo.asentamientos || !mundo.asentamientos.length) return;
  const escala = Math.min(3, Math.max(0.8, 2.8 * camara.min / camara.zoom));   // (el mismo tamaño en pantalla, de cerca o de lejos)
  ctx.font = `600 ${Math.round(12 * escala)}px "Instrument Sans", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const a of mundo.asentamientos) {
    if (!a.nombre) continue;
    const texto = a.nombre + (a.tipo === 'ciudad' ? ' ★' : ''), w = ctx.measureText(texto).width + 12 * escala, h = 18 * escala;
    const x = a.x * TAM + 3, y = a.y * TAM - 30 * escala;
    ctx.fillStyle = 'rgba(20,16,12,0.82)'; ctx.fillRect(x - w / 2, y - h / 2, w, h);
    ctx.fillStyle = colorTribu(a.tribu); ctx.fillRect(x - w / 2, y + h / 2 - 2 * escala, w, 2 * escala);
    ctx.fillStyle = '#fff3d6'; ctx.fillText(texto, x, y);
  }
  ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
}

function dibujarNubes() {
  capasFisica();
  const f = mundo.fisica, w = f.cw * 8 * TAM, h = f.ch * 8 * TAM;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(capaSombra, 6 * TAM, 4 * TAM, w, h);   // (la sombra, un poco al este y al sur)
  ctx.drawImage(capaNubes, 0, 0, w, h);
  ctx.imageSmoothingEnabled = false;
}

/** El color de las bayas de cada especie (las de siempre y las que llegan). */
const COLOR_BAYA = { r: '#e63946', a: '#f2c94c', n: '#f2994a', m: '#8e44c9', z: '#4a7bd8', b: '#ece8e0' };
function colorEspecie(id) { const e = mundo.especies && mundo.especies[id]; return e ? COLOR_BAYA[e.rasgos[0]] : id === 2 ? '#8e44c9' : '#e63946'; }

/** EL AGUA TURBIA: de color pardo donde el agua está sucia. */
function dibujarAguaTurbia() {
  const S = mundo.suciedad, cw = Math.ceil(mundo.ancho / 8), W = mundo.ancho;
  for (let c = 0; c < S.length; c++) {
    if (S[c] <= 0.5) continue;
    const x0 = (c % cw) * 8, y0 = Math.floor(c / cw) * 8;
    ctx.fillStyle = `rgba(120,90,45,${Math.min(0.6, (S[c] - 0.3) * 0.6).toFixed(2)})`;
    for (let y = y0; y < y0 + 8; y++) for (let x = x0; x < x0 + 8; x++) if (mundo.terreno[y * W + x] === 0 && !mundo.mar[y * W + x]) ctx.fillRect(x * TAM, y * TAM, TAM, TAM);
  }
}

function dibujarNoche() {
  // LA NOCHE DE LA SIMULACIÓN (la que viven): oscurece al anochecer y aclara al amanecer. A 16× o más se oculta: parpadearía
  esNoche = mundo.esNoche;
  if (velocidad >= 16) return;
  const t = (mundo.tick % TICKS_POR_DIA) / TICKS_POR_DIA;
  const fuerza = t < 0.6 ? Math.max(0, (t - 0.5) * 5) * 0.5 : t < 0.9 ? 0.5 : (1 - t) * 10 * 0.5;
  if (fuerza < 0.02) return;
  ctx.fillStyle = `rgba(12,18,48,${fuerza})`; ctx.fillRect(0, 0, mundoLienzo.width, mundoLienzo.height);
  const parpadeo = (fotograma >> 3) & 1;
  for (const a of mundo.hogueras.values()) {
    const px = a.x * TAM + 3, py = a.y * TAM + 4;
    ctx.globalAlpha = fuerza * 2;
    ctx.fillStyle = 'rgba(255,179,71,0.10)'; ctx.fillRect(px - TAM * 3, py - TAM * 2, TAM * 6, TAM * 4);
    ctx.fillStyle = 'rgba(255,179,71,0.18)'; ctx.fillRect(px - TAM * 1.5, py - TAM, TAM * 3, TAM * 2);
    ctx.fillStyle = '#ffb347'; ctx.fillRect(px - 1, py + 2 + parpadeo, 2, 2);
    ctx.globalAlpha = 1;
  }
}
let esNoche = false;

// ---- el viaje de las ideas ----
const centro = (q) => [q.x * TAM + 3, q.y * TAM + 1];
function curva(x1, y1, x2, y2, t) {
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2 - 10;
  return [(1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * mx + t * t * x2, (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * my + t * t * y2];
}
/** CAPA 1, LA CHISPA: una idea viaja de una mente a otra (un punto de luz con su estela). */
function chispa(e, t) {
  const x1 = e.x * TAM + 3, y1 = e.y * TAM + 1, x2 = e.x2 * TAM + 3, y2 = e.y2 * TAM + 1;
  for (let k = 3; k >= 0; k--) {
    const tk = t - k * 0.06;
    if (tk < 0) continue;
    const [cx, cy] = curva(x1, y1, x2, y2, Math.min(1, tk));
    ctx.globalAlpha = k ? 0.6 - k * 0.15 : 1;
    ctx.fillStyle = k ? PAL.fx.idea : PAL.fx.ideaNucleo;
    ctx.fillRect(Math.round(cx) - (k ? 0 : 1), Math.round(cy) - (k ? 0 : 1), k ? 2 : 3, k ? 2 : 3);
  }
  ctx.globalAlpha = 1;
}

/** Quiénes llevan la idea seguida, y de quién la recibió cada uno. */
function calcularPortadores() {
  portadores = [];
  for (const p of mundo.personas) {
    if (!p.vivo) continue;
    let mejor = null;
    for (const [sit, n] of p.nucleo.neuronas) {
      if (n.concepto !== seguida.concepto || n.accion !== seguida.accion) continue;
      const o = p.origen.get(sit);
      if (o && o.autor === seguida.autor && (!mejor || o.manos < mejor.manos)) mejor = o;
    }
    if (mejor) portadores.push({ p, o: mejor });
  }
}

/** CAPAS 2 Y 3: el mundo se oscurece, los portadores brillan y la genealogía se dibuja como un río de mano en mano. */
function dibujarRio() {
  if (performance.now() - ultimoCalculo > 500) { ultimoCalculo = performance.now(); calcularPortadores(); actualizarChip(); }
  ctx.fillStyle = 'rgba(10,8,6,0.45)'; ctx.fillRect(0, 0, mundoLienzo.width, mundoLienzo.height);
  ctx.lineCap = 'round';
  const pulso = (fotograma % 90) / 90;
  for (const { p, o } of portadores) {
    const maestro = o.de != null ? mundo.porId.get(o.de) : null;
    if (!maestro || !maestro.vivo) continue;
    const [x1, y1] = centro(maestro), [x2, y2] = centro(p);
    ctx.strokeStyle = `rgba(255,209,102,${Math.max(0.25, 0.95 - o.manos * 0.1)})`;
    ctx.lineWidth = Math.max(1, 4 - (o.manos - 1) * 0.6);
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.quadraticCurveTo((x1 + x2) / 2, (y1 + y2) / 2 - 10, x2, y2); ctx.stroke();
    const [cx, cy] = curva(x1, y1, x2, y2, (pulso + o.manos * 0.23) % 1);
    ctx.fillStyle = PAL.fx.ideaNucleo; ctx.fillRect(Math.round(cx) - 1, Math.round(cy) - 1, 3, 3);
  }
  for (const { p } of portadores) {
    ctx.drawImage(hoja.get(clavePersona(p.tribu % ESTILO.length, p.edad < 14 * TICKS_POR_ANIO ? 1 : 0, p.carga > 0 ? 1 : 0, 0)), p.x * TAM - 1, p.y * TAM - 3);
    const [x, y] = centro(p);
    anillo(ctx, x, y, 5 + ((fotograma >> 4) & 1), PAL.fx.idea, 1);
  }
  const autor = mundo.porId.get(seguida.autor);
  if (autor && autor.vivo) { const [x, y] = centro(autor); anillo(ctx, x, y, 10, PAL.fx.ideaNucleo, 2); anillo(ctx, x, y, 7, PAL.fx.idea, 1); }
}

function seguir(idea) {
  recordar();
  seguida = idea;
  calcularPortadores(); ultimoCalculo = performance.now();
  encuadrar(portadores.map(({ p }) => [p.x, p.y]));
  actualizarChip();
  $('#siguiendo').hidden = false;
  mostrar('idea'); panelIdea(); actualizarNav();
}
function dejarDeSeguir() { if (seguida) recordar(); seguida = null; portadores = []; $('#siguiendo').hidden = true; panelIdea(); if (typeof actualizarNav === 'function' && mundo) actualizarNav(); }

function actualizarChip() {
  if (!seguida) return;
  const manos = portadores.reduce((m, x) => Math.max(m, x.o.manos), 0);
  $('#siguiendo-texto').textContent = `Siguiendo idea: «${seguida.concepto} → ${ACCION[seguida.accion] || seguida.accion}»`;
  $('#siguiendo-datos').textContent = `${portadores.length} portadores · hasta ${manos} ${manos === 1 ? 'mano' : 'manos'}`;
}

/** La pestaña Idea: la genealogía de la idea seguida, mano a mano. */
function panelIdea() {
  const cont = $('#idea');
  if (!seguida) {
    // ELEGIR UNA IDEA: las más extendidas del mundo (o se elige una desde la mente de alguien)
    const ideas = mundo.estadisticas().ideas.slice(0, 10);
    const filas = ideas.map((i) => `<div class="idea-fila" data-autor="${i.autor}" data-anio="${i.anio}" data-concepto="${esc(i.concepto)}" data-accion="${i.accion}" title="Seguir esta idea por el mapa">${cuadrito(colorIdea(i.concepto))}
      <div><div class="nombre-idea">${esc(i.concepto)} → ${esc(ACCION[i.accion] || i.accion)}</div><div class="origen">de ${esc(i.nombre)} (${mundo.tribus[i.tribu].nombre}), año ${i.anio} · la llevan ${i.portadores} en ${i.tribus.size} ${i.tribus.size === 1 ? 'pueblo' : 'pueblos'}</div></div>
      <span class="manos">${i.manosMax} manos</span></div>`).join('');
    pintar(cont, `<div class="cab-pueblo"><div class="rotulo" style="margin:0">Ideas</div><div class="tenue">Elige una para seguirla por el mapa: verás quién la lleva, de quién la aprendió cada uno y cómo ha viajado. También puedes elegirla desde la mente de cualquier persona.</div></div>
      <div><div class="rotulo">Las más extendidas</div>${filas || '<p class="vacio">Aún nadie ha aprendido nada que enseñar.</p>'}</div>`);
    return;
  }
  const culturas = new Set(portadores.map((x) => x.p.tribu));
  const porMano = new Map();
  for (const x of portadores) { if (!porMano.has(x.o.manos)) porMano.set(x.o.manos, []); porMano.get(x.o.manos).push(x); }
  const r = mundo.registro.get(seguida.autor);
  const manosMax = Math.max(0, ...porMano.keys());
  let html = `<button class="volver" data-otra-idea>← elegir otra idea</button><div><div class="rotulo">Genealogía de la idea</div>
    <div class="titulo-idea">${esc(seguida.concepto)} → ${esc(ACCION[seguida.accion] || seguida.accion)}</div>
    <div class="cifras">
      <div><b>${portadores.length}</b><span>portadores vivos</span></div>
      <div><b>${manosMax}</b><span>manos máx.</span></div>
      <div><b>${culturas.size}</b><span>${culturas.size === 1 ? 'cultura' : 'culturas'}</span></div>
    </div></div>
    <div class="rio"><div class="mano"><div class="eti-mano"><span>ORIGEN · mano 0</span><span>año ${seguida.anio}</span></div>
      <div class="familia">${chipPersona(seguida.autor, r && r.murio != null ? 'la aprendió · murió' : 'la aprendió')}</div></div>`;
  for (const m of [...porMano.keys()].sort((a, b) => a - b)) {
    if (m === 0) continue;
    const todos = porMano.get(m), gente = todos.slice(0, 24);
    html += `<div class="mano"><div class="eti-mano"><span>MANO ${m}</span><span>${todos.length} ${todos.length === 1 ? 'persona' : 'personas'}</span></div><div class="familia">`;
    for (const { p, o } of gente) {
      const maestro = mundo.registro.get(o.de);
      const cruzo = maestro && maestro.tribu !== p.tribu;
      html += `<a class="chip" data-id="${p.id}" style="${cruzo ? `border-color:${colorTribu(maestro.tribu)}` : ''}" title="de ${maestro ? esc(maestro.nombre) : '?'}${cruzo ? ' (cruzó de pueblo)' : ''}">${cuadrito(colorTribu(p.tribu))}${esc(p.nombre)}<small>de ${maestro ? esc(maestro.nombre) : '?'}</small></a>`;
    }
    html += `${todos.length > gente.length ? `<span class="tenue">y ${todos.length - gente.length} más</span>` : ''}</div></div>`;
  }
  html += `</div><p class="nota">Borde de color: la idea cruzó de pueblo. Pincha en cualquiera para leer su mente. <a href="#" id="dejar">Dejar de seguir</a></p>`;
  pintar(cont, html);
}

// ---- el bucle ----
function bucle() {
  if (!pausa) {
    // (por tiempo: con mucha gente, la velocidad alta no puede congelar la página)
    const inicio = performance.now();
    const dt = ultimoFotograma ? Math.min(100, inicio - ultimoFotograma) : 16;
    acumulado += (dt / 1000) * velocidad * PASOS_POR_SEGUNDO;
    const n = Math.floor(acumulado);
    acumulado -= n;
    for (let i = 0; i < n && performance.now() - inicio < 28; i++) {
      // (a poca velocidad se guarda dónde estaba cada uno, para dibujarlo deslizándose hasta la casilla nueva)
      if (velocidad <= 16 && i === n - 1) for (const q of mundo.personas) if (q.vivo) { q.ax = q.x; q.ay = q.y; }
      mundo.paso();
      ultimoPaso = performance.now();
    }
    if (acumulado > 8) acumulado = 0;   // (si el ordenador no da para más, no se acumula deuda)
  }
  ultimoFotograma = performance.now();
  fotograma++;
  dibujar();
  presentar();
  const ahora = performance.now();
  if (fotograma % 6 === 0) dibujarMinimapa();
  if (ahora - ultimoPanel > 400) { ultimoPanel = ahora; paneles(); }
  requestAnimationFrame(bucle);
}

// ---- paneles ----
/**
 * PINTAR un panel sin perder el sitio: si el contenido no ha cambiado no se toca (ni parpadea); si cambia, se guarda
 * dónde estaba desplazada cada caja con barra (el panel y las de dentro) y se devuelve ahí al redibujar.
 */
function pintar(el, html) {
  if (el._html === html) return;
  const todos = [el, ...el.querySelectorAll('*')], sitios = [];
  todos.forEach((n, i) => { if (n.scrollTop || n.scrollLeft) sitios.push([i, n.scrollTop, n.scrollLeft]); });
  el.innerHTML = html; el._html = html;
  const nuevos = [el, ...el.querySelectorAll('*')];
  for (const [i, t, l] of sitios) if (nuevos[i]) { nuevos[i].scrollTop = t; nuevos[i].scrollLeft = l; }
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ACCION = { mudarse: 'mudarse con los suyos', muerto: 'ocuparse del muerto', combinar: 'probar a combinar cosas', curar: 'curar a alguien', vigilar: 'vigilar de noche', robar: 'robar comida', instinto: 'seguir su instinto', buscar_roja: 'buscar solo bayas rojas', evitar: 'apartarse', volver: 'volver a casa',
                 esperar: 'quedarse quieto', acercarse: 'acercarse', compartir: 'compartir', atacar: 'atacar',
                 pescar: 'pescar', cazar: 'cazar', fabricar: 'fabricar', construir: 'construir', dormir: 'dormir aquí',
                 guardar: 'guardar comida', sembrar: 'sembrar' };
const colorTribu = (t) => ESTILO[t % ESTILO.length].color;
const COLOR_SENA = ['#e4572e', '#2e86de', '#28a745', '#f2b705', '#a05cc9', '#e8e8e8', '#ff8fab', '#2ec4b6'];
const cuadrito = (col) => `<span class="cuadrito" style="background:${col}"></span>`;

function paneles() {
  const vivos = mundo.personas.filter((p) => p.vivo);
  const ninos = vivos.filter((p) => p.edad < 14 * TICKS_POR_ANIO).length;
  const clima = { sequia: ' · sequía', lluvias: ' · lluvias', normal: '' }[mundo.estadoClima];
  $('#anio').textContent = `Año ${mundo.anio} · ${mundo.estacion}${clima}${mundo.esNoche ? ' · de noche' : ''}`;
  avisoGuerra();
  $('#c-vivos').textContent = vivos.length.toLocaleString('es');
  $('#c-vivos').parentElement.title = `Personas vivas: cada una con su propio cerebro de Neutro (${ninos} son niños)`;
  $('#c-pueblos').textContent = mundo.tribus.filter((t) => t.vivos > 0).length;
  const guerras = [...mundo.relaciones.values()].filter((r) => r === 'guerra').length;
  $('#c-guerras').textContent = guerras; $('#c-guerras-caja').hidden = !guerras;
  $('#c-inventos').textContent = [...mundo.primeras].filter((k) => k.startsWith('mundo-')).length;
  if (lente === 'lenguas' || lente === 'gobierno') leyendaLente();
  const abierto = !$('#informe').hidden;
  if (abierto && $('#pueblos').classList.contains('activo')) panelPueblos(vivos);
  if (abierto && $('#lab').classList.contains('activo')) panelLab();
  if (abierto && $('#lenguas').classList.contains('activo')) panelLenguas();
  if (abierto && $('#inventos').classList.contains('activo')) panelInventos();
  panelCronica();
  if (elegido) panelMente();
  else if (puebloElegido != null) panelPueblo();
  else panelInicio();
  if (seguida && $('#idea').classList.contains('activo')) panelIdea();
}

/**
 * EL LABORATORIO: elige el gobierno y el reparto de cada pueblo, y mira cómo responden sus mentes (vida, salud,
 * desigualdad, huidas). No se redibuja mientras se está eligiendo en un desplegable.
 */
function panelLab() {
  const caja = $('#lab');
  if (caja.contains(document.activeElement) && document.activeElement.tagName === 'SELECT') return;
  const md = mundo.medidas();
  const opc = (valores, actual) => valores.map(([v, t]) => `<option value="${v}"${v === actual ? ' selected' : ''}>${t}</option>`).join('');
  const GOB = [['banda', 'Banda'], ['jefatura', 'Jefatura'], ['democracia', 'Democracia'], ['teocracia', 'Teocracia']];
  const REP = [['familia', 'Cada familia'], ['comun', 'Granero común']];
  let filas = '', medidas = '';
  md.pueblos.forEach((m, i) => {
    if (!m.vivos) return;
    filas += `<div class="lab-fila">${cuadrito(colorTribu(i))}<span>${mundo.tribus[i].nombre}</span>
      <select data-t="${i}" data-q="gobierno">${opc(GOB, m.gobierno)}</select><select data-t="${i}" data-q="reparto">${opc(REP, m.reparto)}</select></div>`;
    medidas += `${cuadrito(colorTribu(i))}<span>${mundo.tribus[i].nombre}</span><span>${m.vivos}</span><span>${m.esperanzaVida ?? '—'}</span><span>${m.salud}</span><span>${m.desigualdad}</span><span>${m.huidas}${m.revueltas ? ` · ${m.revueltas}⚑` : ''}</span>`;
  });
  const c = md.conflictos;
  pintar(caja, `<div><div class="rotulo">Cómo se gobierna cada pueblo</div>${filas}
      <p class="lab-nota">Banda: cada uno decide lo suyo. Jefatura: manda uno, hereda su hijo y cobra tributo. Democracia: votan los adultos (líder cada 10 años). Teocracia: manda el más piadoso y se castiga hacer lo que el pueblo teme. Las mentes no saben nada de esto: aprenden de lo que les pasa; la guerra no se declara, es el nombre de las muertes entre dos pueblos.</p></div>
    <div><div class="rotulo">Cómo les va</div><div class="lab-medidas"><span></span><span class="cab">pueblo</span><span class="cab">vivos</span><span class="cab">vida media</span><span class="cab">salud</span><span class="cab">desigualdad</span><span class="cab">huidas</span>${medidas}</div></div>
    <div><div class="rotulo">El mundo</div><div class="indicadores">${indicadoresMundo(md)}</div></div>
    <p class="lab-nota">Siendo sinceros: lo que pase depende de cómo están programadas estas reglas. Es un juguete para pensar, no una prueba sobre sociedades reales.</p>`);
}
$('#lab').addEventListener('change', (ev) => {
  const s = ev.target.closest('select'); if (!s) return;
  const t = +s.dataset.t;
  if (s.dataset.q === 'gobierno') mundo.cambiarGobierno(t, s.value, null); else mundo.cambiarGobierno(t, null, s.value);
  s.blur(); panelLab();
});

/**
 * LAS LENGUAS: la palabra de cada pueblo para algunas cosas, cuánto se parecen, y el ÁRBOL DE LENGUAS (agrupando por
 * parecido, como hace la lingüística histórica) junto a la genealogía real de los pueblos, para ver si coinciden.
 */
function panelLenguas() {
  const caja = $('#lenguas');
  if (!mundo.lenguas || !mundo.lenguas.size) { caja.innerHTML = '<p class="vacio">Aún no hay lenguas que comparar: dales unos años para hablar.</p>'; return; }
  const COSAS = [['lobo', 'lobo'], ['ciervo', 'ciervo'], ['bayas', 'bayas'], ['agua', 'agua'], ['a:pescar', 'pescar']];
  const ids = [...mundo.lenguas.keys()];
  let tabla = `<div class="vocab-tabla" style="grid-template-columns:10px 64px repeat(${COSAS.length}, 1fr)"><span></span><span></span>${COSAS.map(([, n]) => `<span class="cab">${n}</span>`).join('')}`;
  for (const t of ids) {
    const l = mundo.lenguas.get(t);
    tabla += `${cuadrito(colorTribu(t))}<span${mundo.tribus[t].vivos > 0 ? '' : ' class="tenue" title="Lengua muerta"'}>${mundo.tribus[t].vivos > 0 ? '' : '† '}${mundo.tribus[t].nombre}</span>${COSAS.map(([k]) => `<b class="palabra">${l.get(k) ? esc(l.get(k)) : '<span class="tenue">—</span>'}</b>`).join('')}`;
  }
  tabla += '</div>';
  // el árbol: agrupar por parecido (UPGMA), de más a menos parecidos
  const par = (a, b) => mundo.parecido.get(`${Math.min(a, b)}-${Math.max(a, b)}`) ?? 0;
  let grupos = ids.map((t) => ({ hojas: [t], alto: 0, x: null }));
  const uniones = [];
  while (grupos.length > 1) {
    let mejor = null;
    for (let i = 0; i < grupos.length; i++) for (let j = i + 1; j < grupos.length; j++) {
      let s = 0; for (const a of grupos[i].hojas) for (const b of grupos[j].hojas) s += par(a, b);
      s /= grupos[i].hojas.length * grupos[j].hojas.length;
      if (!mejor || s > mejor.s) mejor = { i, j, s };
    }
    const g = { hojas: [...grupos[mejor.i].hojas, ...grupos[mejor.j].hojas], hijos: [grupos[mejor.i], grupos[mejor.j]], s: mejor.s };
    uniones.push(g);
    grupos = grupos.filter((_, k) => k !== mejor.i && k !== mejor.j).concat([g]);
  }
  // (las ramas empiezan después de la etiqueta más larga: así nunca tapan un nombre)
  const etiqueta = (t) => { const m = mundo.tribus[t].madre; return mundo.tribus[t].nombre.length + (m != null ? mundo.tribus[m].nombre.length + 6 : 0); };
  const X0 = 26 + Math.max(...ids.map(etiqueta)) * 6.3, W = Math.round(X0 + 220);
  const raiz = grupos[0], filaH = 18, H = ids.length * filaH + 10, Xmax = W - 10;
  const xDe = (s) => X0 + (Xmax - X0) * (1 - s);   // (parecido 1 a la izquierda, 0 a la derecha)
  let svg = '', fila = 0;
  const pos = (g) => {
    if (!g.hijos) { const y = 10 + fila++ * filaH; const t = g.hojas[0], m = mundo.tribus[t].madre;
      svg += `<rect x="4" y="${y - 5}" width="9" height="9" fill="${colorTribu(t)}"/><text x="18" y="${y + 4}">${mundo.tribus[t].nombre}${m != null ? ` <tspan fill="#9a9a9a">(de ${mundo.tribus[m].nombre})</tspan>` : ''}</text>`;
      return { x: X0, y }; }
    const a = pos(g.hijos[0]), b = pos(g.hijos[1]), x = xDe(g.s);
    svg += `<path d="M${a.x} ${a.y}H${x}V${b.y}H${b.x}" fill="none" stroke="#ffd166" stroke-width="1.5"/>`;
    return { x, y: (a.y + b.y) / 2 };
  };
  const emparentadas = [...mundo.parecido.values()].some((x) => x > 0);
  if (raiz.hijos && emparentadas) pos(raiz);
  else svg = `<text x="4" y="14">Aún no hay lenguas emparentadas: todas son distintas.</text><text x="4" y="30" fill="#9a9a9a">Cuando una aldea se separe y nazca un pueblo nuevo, aquí se verá.</text>`;
  const md = mundo.medidas().lenguaje;
  pintar(caja, `<div><div class="rotulo">Cómo dicen cada cosa</div>${tabla}</div>
    ${diccionario(ids)}
    <div><div class="rotulo">El árbol de lenguas</div>${raiz.hijos && emparentadas ? `<svg class="arbol" viewBox="0 0 ${W} ${H}" style="width:100%;max-width:${Math.round(W * 1.6)}px">${svg}</svg>` : '<p class="vacio">Aún no hay lenguas emparentadas: todas son distintas. Cuando una aldea se separe y nazca un pueblo nuevo, aquí se verá.</p>'}
      <p class="lab-nota">Las lenguas que más se parecen se unen antes (a la izquierda). Entre paréntesis, de qué pueblo nació cada uno de verdad: si el árbol los junta, la lengua guarda su historia.</p></div>
    ${loQueDejaron()}
    <div><div class="rotulo">Hablar</div><div class="lab-nota">${md.palabrasMedia} palabras por persona · ${md.dichos} veces que alguien avisó a los suyos de comida o agua · ${md.ensenadasHablando} ideas enseñadas hablando y ${md.noEntendidas} que no pasaron porque no se entendían · ${md.cambiosDeSonido} cambios de sonido de madres a hijos · ${md.cazasEnGrupo} cazas en grupo · ${md.defensas} veces que los suyos acudieron a un «¡ayuda!»${mundo.lenguaje ? '' : ' · (lenguaje apagado: las ideas pasan sin palabras)'}${md.composicionalidad ? ` · gramática holística: estructura ${md.composicionalidad.map((x) => Math.round(x * 100) + ' %').join(', ')} (por azar, un 12 %)` : ''}</div></div>`);
}

/**
 * EL DICCIONARIO de un pueblo: todas las palabras que usa (las que dicen al menos una cuarta parte de sus adultos),
 * por temas, con quién la dijo primero y cuándo, y si algún otro pueblo dice lo mismo.
 */
let lenguaElegida = null;
const NOMBRE_AVISO = { lobo: 'lobo (aviso)', enemigo: 'enemigo (aviso)', ayuda: '¡ayuda!', ciervo: 'ciervo', bayas: 'bayas', agua: 'agua' };
const NOMBRE_SUCESO = { mojado: 'la tierra encharcada', langosta: 'las langostas', turbia: 'el agua turbia', seco: 'la tierra seca', temblor: 'el temblor', volcan: 'el volcán', rayo: 'el rayo', plaga: 'la plaga', incendio: 'el incendio', riada: 'la riada', cielo: 'lo que cae del cielo', perro: 'el perro',
  muerte: 'la muerte', enterrar: 'enterrar a un muerto', quemar: 'quemar a un muerto', apartar: 'llevar lejos a un muerto' };
const TECNICA_TXT = { golpear: 'golpeado', atar: 'atado', trenzar: 'trenzado', coser: 'cosido', moldear: 'moldeado' };
/** Una receta en palabras, también las que llevan dentro otra hecha antes: «fibra y madera, atado; con piel, cosido». */
function receta(r) {
  const m = /^(\w+)\((.*)\)$/.exec(r);
  if (!m) return r.replace(/^m:/, '').replace('mano', 'algo hecho antes');
  // (las dos piezas: se separan por el «+» que no está dentro de un paréntesis)
  let nivel = 0, corte = -1;
  for (let i = 0; i < m[2].length; i++) { const c = m[2][i]; if (c === '(') nivel++; else if (c === ')') nivel--; else if (c === '+' && !nivel) { corte = i; break; } }
  const piezas = corte < 0 ? [m[2]] : [m[2].slice(0, corte), m[2].slice(corte + 1)];
  const tec = TECNICA_TXT[m[1]] || m[1];
  if (piezas.some((x) => x.includes('('))) { const [hecha, otra] = piezas[0].includes('(') ? piezas : [piezas[1], piezas[0]]; return `${receta(hecha)}; con ${receta(otra)}, ${tec}`; }
  return `${piezas.map((x) => receta(x)).join(' y ')}, ${tec}`;
}
function significado(k) {
  if (NOMBRE_AVISO[k]) return ['Avisos', NOMBRE_AVISO[k]];
  const [tipo, ...r] = k.split(':'), resto = r.join(':');
  if (tipo === 'e') return ['Lo que les pasa', NOMBRE_SUCESO[resto] || resto];
  if (tipo === 'm') return ['Materiales', resto];
  if (tipo === 'c') return ['Lo que perciben', resto.toLowerCase()];
  if (tipo === 'a') return ['Lo que hacen', ACCION[resto] || resto];
  if (tipo === 'f') { const [c, a] = resto.split('|'); return ['Frases', `${c.toLowerCase()} → ${ACCION[a] || a}`]; }
  if (tipo === 'o') {
    if (resto === 'fuego') return ['Cosas que hacen', 'el fuego'];
    return ['Cosas que hacen', receta(resto)];
  }
  return ['Otras', k];
}
function diccionario(ids) {
  const viva = (t) => mundo.tribus[t].vivos > 0, vivas = ids.filter(viva);
  if (lenguaElegida == null || !ids.includes(lenguaElegida)) lenguaElegida = (vivas.length ? vivas : ids).reduce((a, b) => (mundo.lenguas.get(b).size > mundo.lenguas.get(a).size ? b : a));
  const l = mundo.lenguas.get(lenguaElegida), temas = new Map();
  for (const [k, w] of l) {
    const [tema, que] = significado(k);
    if (!temas.has(tema)) temas.set(tema, []);
    const o = mundo.origenPalabras && mundo.origenPalabras.get(`${lenguaElegida}|${k}`);
    const otros = ids.filter((t) => t !== lenguaElegida && mundo.lenguas.get(t).get(k) === w).map((t) => mundo.tribus[t].nombre);
    temas.get(tema).push({ w, que, o: o && o.palabra === w ? o : null, otros });
  }
  const ORDEN = ['Lo que les pasa', 'Materiales', 'Cosas que hacen', 'Avisos', 'Lo que perciben', 'Lo que hacen', 'Frases', 'Otras'];
  const botones = ids.map((t) => `<button class="boton-lengua${t === lenguaElegida ? ' activo' : ''}" data-lengua="${t}" ${viva(t) ? '' : 'title="Lengua muerta: su pueblo se extinguió"'}>${cuadrito(colorTribu(t))}${viva(t) ? '' : '† '}${mundo.tribus[t].nombre} <span class="tenue">${mundo.lenguas.get(t).size}</span></button>`).join('');
  const cuerpo = ORDEN.filter((t) => temas.has(t)).map((tema) => `<div class="dic-tema"><div class="dic-cab">${tema} <span class="tenue">${temas.get(tema).length}</span></div>${temas.get(tema).sort((a, b) => a.que.localeCompare(b.que)).map((e) =>
    `<div class="dic-fila"><b class="palabra">${esc(e.w)}</b><span>${esc(e.que)}</span><span class="tenue">${e.o ? `año ${e.o.anio} · ${esc(e.o.quien)}` : ''}${e.otros.length ? `${e.o ? ' · ' : ''}también ${e.otros.slice(0, 2).join(', ')}${e.otros.length > 2 ? '…' : ''}` : ''}</span></div>`).join('')}</div>`).join('');
  return `<div><div class="rotulo">El diccionario de cada pueblo</div><div class="botones-lengua">${botones}</div>
    <div class="diccionario">${cuerpo || '<p class="vacio">Aún no tienen palabras compartidas.</p>'}</div>
    <p class="lab-nota">Cuentan las palabras que dice al menos una cuarta parte de sus adultos. «Año · nombre»: quién la dijo primero en el pueblo (si la heredaron de otro pueblo, no se sabe). †: lengua muerta, su pueblo se extinguió. Nadie les da las palabras: se inventan cuando enseñan algo, avisan de algo o ven juntos algo que llama la atención.</p></div>`;
}

/** LO QUE DEJARON: las pinturas y lo escrito, de lo más leído a lo menos; la elegida en el mapa, primero. */
let pinturaElegida = null;
function loQueDejaron() {
  if (!mundo.pinturas) return '';
  const md = mundo.medidas().dibujos;
  const lista = [...mundo.pinturas.values()].sort((a, b) => (`${b.x},${b.y}` === pinturaElegida) - (`${a.x},${a.y}` === pinturaElegida) || b.lecturas - a.lecturas).slice(0, 14);
  const filas = lista.map((pin) => {
    const autor = mundo.porId.get(pin.autor), muerto = !autor || !autor.vivo, extinto = mundo.tribus[pin.tribu].vivos <= 0;
    return `<div class="dic-fila${`${pin.x},${pin.y}` === pinturaElegida ? ' elegida' : ''}"><b class="palabra">${pin.escrita ? `«${esc(pin.palabra)}»` : 'dibujo'}</b><span>${esc(mundo.textoPintura(pin))}</span><span class="tenue">${cuadrito(colorTribu(pin.tribu))} ${esc(pin.nombreAutor)}${muerto ? ' †' : ''} (${mundo.tribus[pin.tribu].nombre}${extinto ? ', extinto' : ''}) · año ${pin.anio} · ${pin.lecturas} lo han ${pin.escrita ? 'leído' : 'mirado'}${pin.deOtros ? `, ${pin.deOtros} de otros pueblos` : ''}</span></div>`;
  }).join('');
  return `<div><div class="rotulo">Lo que dejaron pintado y escrito</div>
    ${lista.length ? `<div class="dejaron">${filas}</div>` : '<p class="vacio">Aún nadie ha pintado nada: hace falta saber algo importante y tener una roca cerca.</p>'}
    <p class="lab-nota">${md.enPie} pinturas en pie (${md.escritas} escritas) · ${md.lecturas} veces que alguien aprendió de una · ${md.deMuertos} de alguien que ya había muerto · ${md.deOtroPueblo} de otro pueblo${md.deExtintos ? ` (${md.deExtintos} de un pueblo extinto)` : ''} · ${md.sinEntender} escritos que no entendió quien los vio · ${md.pueblosQueEscriben} pueblos escriben. Un dibujo lo entiende cualquiera, a medias; lo escrito, entero, solo quien tiene esas palabras.</p></div>`;
}

/** La tabla de pueblos comparados (calidad de vida primero; la población, un dato más). */
function tablaPueblos() {
  const md = mundo.medidas();
  const rel = (t) => { const r = []; for (const [k, v] of mundo.relaciones) { const [a, b] = k.split('-').map(Number); if ((a === t || b === t) && v !== 'paz') r.push(`${v} con ${mundo.tribus[a === t ? b : a].nombre}`); } return r.join(', ') || 'paz'; };
  let h = '<div class="tabla-pueblos"><div class="cab"><span></span><span>pueblo</span><span>gobierno</span><span>personas</span><span>vida media</span><span>salud</span><span>desigualdad</span><span>inventos</span><span>huidas</span><span>relaciones</span></div>';
  md.pueblos.forEach((m, i) => {
    if (!m.vivos) return;
    const inv = mundo.inventos ? [...mundo.inventos.values()].filter((v) => v.adopciones.some((a) => a.tribu === i)).length : 0;
    const r = rel(i);
    h += `<div data-pueblo="${i}" title="Ir a este pueblo">${cuadrito(colorTribu(i))}<b>${mundo.tribus[i].nombre}</b><span class="tenue">${m.gobierno}</span><span class="num">${m.vivos}</span><span class="num">${m.esperanzaVida ?? '—'}</span><span class="num">${m.salud}</span><span class="num" style="${m.desigualdad >= 0.4 ? 'color:#f2a541' : ''}">${m.desigualdad}</span><span class="num">${inv}</span><span class="num">${m.huidas}</span><span style="color:${r.includes('guerra') ? '#ff8a7a' : r.includes('alianza') ? '#9cc7f0' : 'var(--mm-ink-2)'}">${r}</span></div>`;
  });
  return h + '</div><div class="tenue" style="margin-top:8px">Pincha en un pueblo para verlo en el mapa. Desigualdad: 0 = todos igual, 1 = uno lo tiene todo.</div>';
}

/** EL MUNDO (nada elegido): cómo va todo, los pueblos para elegir y lo último que ha pasado. */
function panelInicio() {
  const vivos = mundo.personas.filter((p) => p.vivo);
  const filas = mundo.tribus.filter((t) => t.vivos > 0).map((t) => {
    const lider = mundo.lideres && mundo.porId.get(mundo.lideres.get(t.id));
    return `<div class="fila-pueblo" data-pueblo="${t.id}" title="Ver este pueblo">${cuadrito(colorTribu(t.id))}<span class="nombre">${t.nombre}</span><span class="pob">${vivos.filter((p) => p.tribu === t.id).length}</span><span class="idea">${t.gobierno}${lider && lider.vivo ? ` · manda ${esc(lider.nombre)}` : ''}</span></div>`;
  }).join('');
  const ultimos = mundo.cronica.slice(-6).reverse().map((c) => `<div class="evento"><span class="anio">${c.anio}</span><span class="punto" style="background:${COLOR_CRONICA[c.tipo] || '#a89b86'}"></span><span class="texto">${esc(c.texto)}</span></div>`).join('');
  pintar($('#inicio'), `<div class="cab-pueblo"><div class="rotulo" style="margin:0">El mundo</div><div class="tenue">Pincha en una persona para leer su mente, o en un territorio para ver su pueblo.</div></div>
    ${graficaPoblacion()}
    <div class="lista-pueblos"><div class="rotulo">Pueblos</div>${filas}</div>
    <div><div class="rotulo" style="display:flex;justify-content:space-between"><span>Lo último</span><button class="volver" data-informe="cronica">toda la historia →</button></div>${ultimos}</div>`);
}

/** UN PUEBLO: su ficha en cuatro apartados (resumen, sociedad, cultura, lengua). */
function panelPueblo() {
  const id = puebloElegido, t = mundo.tribus[id];
  if (!t) { alMundo(); return; }
  const caja = $('#pueblo');
  if (caja.contains(document.activeElement) && document.activeElement.tagName === 'SELECT') return;
  const md = mundo.medidas(), m = md.pueblos[id];
  const vivos = mundo.personas.filter((p) => p.vivo && p.tribu === id);
  const lider = mundo.lideres && mundo.porId.get(mundo.lideres.get(id));
  const madre = t.madre != null ? ` · nacido de los ${mundo.tribus[t.madre].nombre} en el año ${t.desde}` : '';
  let cuerpo = '';
  if (apartadoPueblo === 'resumen') {
    const ideas = new Map();
    for (const p of vivos) { const s = new Set(); for (const n of p.nucleo.neuronas.values()) if (n.accion !== 'instinto') s.add(`${n.concepto} → ${ACCION[n.accion] || n.accion}`); for (const k of s) ideas.set(k, (ideas.get(k) || 0) + 1); }
    const top = [...ideas].sort((a, b) => b[1] - a[1]).slice(0, 3);
    const rels = []; for (const [k, v] of mundo.relaciones) { const [a, b] = k.split('-').map(Number); if ((a === id || b === id) && v !== 'paz') rels.push(`<span class="etiq ${v === 'guerra' ? 'roja' : 'azul'}">${v} con los ${mundo.tribus[a === id ? b : a].nombre}</span>`); }
    const sucesos = mundo.cronica.filter((c) => c.texto.includes(t.nombre)).slice(-4).reverse().map((c) => `<div class="evento"><span class="anio">${c.anio}</span><span class="punto" style="background:${COLOR_CRONICA[c.tipo] || '#a89b86'}"></span><span class="texto">${esc(c.texto)}</span></div>`).join('');
    cuerpo = `<div class="datos-pueblo">
        <div class="dato"><div class="eti">Personas</div><div class="val">${vivos.length}</div></div>
        <div class="dato"><div class="eti">Vida media al morir</div><div class="val">${m.esperanzaVida ?? '—'} <small>años</small></div></div>
        <div class="dato"><div class="eti">Salud media</div><div class="val">${m.salud}</div></div>
        <div class="dato"><div class="eti">Desigualdad</div><div class="val" style="${m.desigualdad >= 0.4 ? 'color:#f2a541' : ''}">${m.desigualdad}</div></div></div>
      ${top.length ? `<div><div class="rotulo">Sus ideas más extendidas</div>${top.map(([k, n]) => `<div class="etiq" style="margin-bottom:4px">${esc(k)} <span class="tenue">· ${n}</span></div>`).join('')}</div>` : ''}
      <div><div class="rotulo">Con los demás</div><div class="etiquetas">${rels.join('') || '<span class="tenue">en paz con todos</span>'}</div></div>
      ${sucesos ? `<div><div class="rotulo">Lo último de este pueblo</div>${sucesos}</div>` : ''}`;
  } else if (apartadoPueblo === 'sociedad') {
    const opc = (vals, act) => vals.map(([v, n]) => `<option value="${v}"${v === act ? ' selected' : ''}>${n}</option>`).join('');
    const genio = vivos.length ? vivos.reduce((s, p) => s + p.genio, 0) / vivos.length : 0;
    const oficios = {}; for (const p of vivos) { const r = mundo.oficioPrincipal(p); if (r) oficios[r.oficio] = (oficios[r.oficio] || 0) + 1; }
    const creen = [...(mundo.creencias || new Map()).values()].filter((c) => c.tribu === id).map((c) => `<span class="etiq lila">temen ${esc(ACCION[c.accion] || c.accion)} (${c.n})</span>`);
    cuerpo = `<div><div class="rotulo">Cómo se gobierna</div><div class="lab-fila" style="grid-template-columns:1fr 1fr"><select data-q="gobierno">${opc([['banda', 'Banda'], ['jefatura', 'Jefatura'], ['democracia', 'Democracia'], ['teocracia', 'Teocracia']], t.gobierno)}</select><select data-q="reparto">${opc([['familia', 'Cada familia'], ['comun', 'Granero común']], t.reparto)}</select></div>
      <div class="tenue" style="margin-top:6px">${lider && lider.vivo ? `Manda <a href="#" data-persona="${lider.id}">${esc(lider.nombre)}</a> (${Math.floor(lider.edad / TICKS_POR_ANIO)} años). ` : ''}${t.tributo ? `Tributo cobrado: ${t.tributo}. ` : ''}${m.huidas ? `${m.huidas} huidos. ` : ''}${m.revueltas ? `${m.revueltas} revueltas.` : ''}</div></div>
      <div class="datos-pueblo"><div class="dato"><div class="eti">Robos</div><div class="val">${t.robos || 0}</div></div><div class="dato"><div class="eti">Castigados</div><div class="val">${t.castigos || 0}</div></div></div>
      <div><div class="rotulo">Carácter medio</div><div class="tenue">temperamento ${genio.toFixed(2)} (de −1 generoso a 1 agresivo)</div></div>
      <div><div class="rotulo">Oficios</div><div class="etiquetas">${Object.entries(oficios).sort((a, b) => b[1] - a[1]).map(([o, n]) => `<span class="etiq">${NOMBRE_OFICIO[o]} · ${n}</span>`).join('') || '<span class="tenue">aún sin oficios</span>'}</div></div>
      <div><div class="rotulo">Creencias</div><div class="etiquetas">${creen.join('') || '<span class="tenue">ninguna extendida</span>'}</div></div>
      <button class="volver" data-informe="lab">comparar los gobiernos de todos →</button>`;
  } else if (apartadoPueblo === 'cultura') {
    const trad = [...(mundo.tradiciones || new Map()).values()].filter((x) => x.tribu === id).map((x) => { const [c, a] = x.idea.split('→'); return `<span class="etiq oro">«${esc(c)}» → ${esc(ACCION[a] || a)}</span>`; });
    const lug = [...(mundo.lugaresPueblo || new Map()).values()].filter((l) => l.tribu === id).map((l) => `<span class="etiq ${l.tipo === 'prohibido' ? 'roja' : ''}">lugar ${l.tipo === 'prohibido' ? 'prohibido' : 'de abundancia'} (año ${l.desde})</span>`);
    const invs = mundo.inventos ? [...mundo.inventos].filter(([, v]) => v.adopciones.some((a) => a.tribu === id)).map(([k, v]) => { const a = v.adopciones.find((x) => x.tribu === id); return `<span class="etiq">${NOMBRE_INVENTO[k] || k} · año ${a.anio}${v.tribu === id ? ' · lo inventaron ellos' : ''}</span>`; }) : [];
    cuerpo = `<div><div class="rotulo">Tradiciones</div><div class="etiquetas">${trad.join('') || '<span class="tenue">ninguna aún</span>'}</div></div>
      <div><div class="rotulo">Lugares que recuerdan</div><div class="etiquetas">${lug.join('') || '<span class="tenue">ninguno aún</span>'}</div></div>
      <div><div class="rotulo">Sus inventos · ${invs.length}</div><div class="etiquetas">${invs.join('') || '<span class="tenue">ninguno aún</span>'}</div></div>
      <button class="volver" data-informe="inventos">ver el árbol de inventos →</button>`;
  } else {
    const l = mundo.lenguas && mundo.lenguas.get(id);
    const parecidos = mundo.parecido ? [...mundo.parecido].filter(([k]) => k.split('-').map(Number).includes(id)).map(([k, s]) => { const [a, b] = k.split('-').map(Number); return [a === id ? b : a, s]; }).sort((x, y) => y[1] - x[1]) : [];
    const COSAS = [['lobo', 'lobo'], ['enemigo', 'enemigo'], ['ciervo', 'ciervo'], ['bayas', 'bayas'], ['agua', 'agua'], ['ayuda', '¡ayuda!'], ['a:pescar', 'pescar'], ['a:cazar', 'cazar'], ['c:Hambre', 'hambre']];
    cuerpo = l ? `<div><div class="rotulo">Cómo dicen · ${l.size} palabras</div><div class="vocab-tabla" style="grid-template-columns:repeat(3,minmax(0,1fr))">${COSAS.map(([k, n]) => `<div><div class="tenue" style="font-size:11px">${n}</div><b class="palabra">${l.get(k) ? esc(l.get(k)) : '—'}</b></div>`).join('')}</div></div>
      <div><div class="rotulo">Se parece a</div>${parecidos.filter(([, s]) => s > 0).map(([o, s]) => `<div class="conocido">${cuadrito(colorTribu(o))}${mundo.tribus[o].nombre} <span class="tenue">· ${Math.round(s * 100)} % de palabras iguales</span></div>`).join('') || '<span class="tenue">a ninguna: su lengua es solo suya</span>'}</div>
      <button class="volver" data-informe="lenguas">ver el árbol de lenguas →</button>` : '<p class="vacio">Aún no tienen lengua que medir (necesitan unos cuantos adultos y unos años).</p>';
  }
  const APARTADOS = [['resumen', 'Resumen'], ['sociedad', 'Sociedad'], ['cultura', 'Cultura'], ['lengua', 'Lengua']];
  pintar(caja, `
    <div class="cab-pueblo"><div class="rotulo" style="margin:0">Pueblo</div><div class="fila-nombre">${cuadrito(colorTribu(id))}<span class="nombre">${t.nombre}</span><span class="etiqueta">${t.gobierno}</span></div>
    <div class="tenue">${vivos.length} personas${lider && lider.vivo ? ` · manda <a href="#" data-persona="${lider.id}">${esc(lider.nombre)}</a>` : ''}${madre}</div></div>
    <nav class="subpestanas">${APARTADOS.map(([k, n]) => `<button data-sec="${k}" class="${k === apartadoPueblo ? 'activo' : ''}">${n}</button>`).join('')}</nav>
    ${cuerpo}`);
}

/** EL ÁRBOL DE INVENTOS: lo descubierto (quién, cuándo, en cuántos pueblos), lo que lleva a qué, y lo que falta. */
const NOMBRE_INVENTO = { fuego: 'Hacer fuego', cesta: 'Cesta', carreta: 'Carreta', despensa: 'Despensa', siembra: 'Siembra', lanza: 'Lanza', 'caza-ciervo': 'Caza del ciervo', manta: 'Manta de fibras', abrigo: 'Abrigo de pieles', armadura: 'Armadura', pesca: 'Pesca', red: 'Red', balsa: 'Balsa', empalizada: 'Empalizada', curar: 'Curar con plantas', perro: 'Perro' };
const OTROS_DESCUBRIMIENTOS = ['fuego', 'despensa', 'siembra', 'pesca', 'caza-ciervo', 'empalizada', 'curar', 'perro', 'carreta'];
const USOS_ARBOL = [['caza', 'Para cazar'], ['pesca', 'Para pescar'], ['carga', 'Para llevar cosas'], ['abrigo', 'Para el frío'], ['proteccion', 'Para protegerse'], ['flota', 'Para el agua']];
/**
 * LOS INVENTOS: lo que han hecho combinando materiales, agrupado por PARA QUÉ SIRVE (eso lo deciden las propiedades,
 * no una receta), con cómo lo llama cada pueblo; y los descubrimientos que no son objetos (sembrar, guardar, curar...).
 */
function panelInventos() {
  const inv = mundo.inventos || new Map();
  const pueblosVivos = mundo.tribus.filter((t) => t.vivos > 0);
  const vivos = mundo.personas.filter((p) => p.vivo);
  const enPueblos = (v) => pueblosVivos.filter((t) => v.adopciones.some((a) => a.tribu === t.id)).length;
  const nodo = (k, v, titulo, sub) => `<button class="nodo-inv ${k === inventoElegido ? 'elegido' : ''}" data-inv="${esc(k)}"><span class="n">${titulo}</span><span class="a">año ${v.anio} · ${mundo.tribus[v.tribu].nombre}</span><span class="ext"><i style="width:${pueblosVivos.length ? Math.round((100 * enPueblos(v)) / pueblosVivos.length) : 0}%"></i></span><span class="e">${sub}</span></button>`;
  let filas = '';
  for (const [u, nombre] of USOS_ARBOL) {
    const suyos = [...inv].filter(([, v]) => v.usos && v.usos[u] >= 0.3).sort((a, b) => b[1].usos[u] - a[1].usos[u]).slice(0, 4);
    filas += `<div class="rama-inv"><span class="nombre-rama">${nombre}</span>${suyos.length ? suyos.map(([k, v]) => nodo(k, v, `«${esc(v.objeto)}»`, `${Math.round(v.usos[u] * 100)} % · en ${enPueblos(v)} pueblos`)).join('<span class="flecha-inv" style="border-top-style:dotted"></span>') : '<div class="nodo-inv no"><span class="n">Nada todavía</span><span class="a">nadie ha dado con ello</span></div>'}</div>`;
  }
  const otros = OTROS_DESCUBRIMIENTOS.filter((k) => inv.has(k)).map((k) => nodo(k, inv.get(k), NOMBRE_INVENTO[k] || k, `en ${enPueblos(inv.get(k))} de ${pueblosVivos.length} pueblos`)).join('');
  let detalle = '<p class="vacio">Pincha en un invento para ver quién lo hizo, cómo, cómo lo llama cada pueblo y cómo se extendió.</p>';
  const v = inventoElegido && inv.get(inventoElegido);
  if (v) {
    const llevan = vivos.filter((p) => p.objetos.has(inventoElegido) || p.cosas.some((c) => c.clave === inventoElegido)).length;
    // (CÓMO LO LLAMA CADA PUEBLO: pueblos que lo inventaron por su cuenta le dan nombres distintos)
    const nombres = [];
    if (mundo.lenguas) for (const [t, l] of mundo.lenguas) { const w = l.get(`o:${inventoElegido}`); if (w) nombres.push(`${cuadrito(colorTribu(t))}${mundo.tribus[t].nombre} lo llaman <b class="palabra">«${esc(w)}»</b>`); }
    const usos = v.usos ? Object.entries(v.usos).filter(([k, x]) => k !== 'punzar' && x >= 0.1).map(([k, x]) => `${TEXTO_USO[k]} (${Math.round(x * 100)} %)`).join(' · ') : '';
    detalle = `<div class="rotulo" style="margin:0">Invento</div><div style="font:800 22px/1.1 var(--font-display)">${v.objeto ? `«${esc(v.objeto)}»` : NOMBRE_INVENTO[inventoElegido] || inventoElegido}</div>
      <div style="font-size:13px;line-height:1.5">Lo hizo por primera vez <b>${esc(v.nombre)}</b> (${mundo.tribus[v.tribu].nombre}) en el año ${v.anio}${v.como ? `, ${v.como}` : ''}.${llevan ? ` Ahora lo llevan ${llevan} personas.` : ''}</div>
      ${usos ? `<div class="tenue">${usos}</div>` : ''}
      ${nombres.length ? `<div><div class="rotulo">Cómo lo llaman</div>${nombres.map((n) => `<div class="conocido">${n}</div>`).join('')}</div>` : ''}
      <div><div class="rotulo">Cómo se extendió</div>${v.adopciones.map((a) => `<div class="conocido"><span class="mono" style="color:var(--mm-idea);width:56px">año ${a.anio}</span>${cuadrito(colorTribu(a.tribu))}${mundo.tribus[a.tribu].nombre} <span class="tenue">· ${esc(a.nombre)}</span></div>`).join('')}</div>`;
  }
  const md = { ...mundo.medidas().materiales, delCielo: mundo.medidas().delCielo };
  pintar($('#inventos'), `<div style="display:flex;gap:24px;flex:1;min-height:0"><div class="arbol-inventos">
      <div class="tenue">Nadie programa estos inventos: combinan materiales (madera, piedra, fibra, pieles, hueso, arcilla, resina) con una técnica (golpear, atar, trenzar, coser, moldear), y para qué sirve lo que sale lo deciden sus propiedades. ${md.combinaciones} combinaciones probadas, ${md.distintas} cosas distintas en uso, ${md.recetasEnsenadas} veces que alguien enseñó a hacer algo.</div>
      ${filas}
      ${Object.keys(md.delCielo).length ? `<div><div class="rotulo">Lo que cayó del cielo</div>${Object.entries(mundo.medidas().delCielo).map(([k, d]) => `<div class="conocido"><b>${k}</b> <span class="tenue">· cayó el año ${d.cayo} · recogido ${d.recogido} veces · usado en ${d.usado} combinaciones · ${d.para ? `lo mejor: «${esc(d.objeto)}» de ${esc(d.quien)}, que ${TEXTO_USO[d.para]} (${Math.round(d.mejor * 100)} %)` : 'aún sin uso encontrado'}</span></div>`).join('')}</div>` : ''}
      ${otros ? `<div class="rama-inv"><span class="nombre-rama">Otros descubrimientos</span><div style="display:flex;gap:8px;flex-wrap:wrap">${otros}</div></div>` : ''}
    </div><div class="detalle-inv">${detalle}</div></div>`);
}

/** Los indicadores del mundo, en rejilla (para leerlos de un vistazo). */
function indicadoresMundo(md) {
  const c = md.conflictos, ind = [
    ['Vida media al morir', `${md.esperanzaVida ?? '—'} años`], ['Muertes evitables', `${Math.round(md.evitables * 100)} %`], ['Desigualdad (0–1)', md.desigualdad], ['Salud media', md.salud],
    ['Les falta carne', `${Math.round(md.carencias.proteina * 100)} %`], ['Les falta fruta', `${Math.round(md.carencias.vitaminas * 100)} %`],
    ['Robos', c.robos], ['Venganzas', c.venganzas], ['Guerras', c.guerras], ['Revueltas', c.revueltas], ['Huidos', c.huidas],
    ['Inventos', md.inventos], ['Ideas distintas', md.ideasDistintas], ['Curas', md.curas], ['Saben hacer fuego', md.fuego.sabenHacerlo], ['Comidas cocinadas', md.fuego.cocinadas],
    ['Lobos espantados por el fuego', md.fuego.lobosEspantados], ['Balsas', md.transporte.balsas], ['Cruces de isla', md.transporte.cruces], ['Muertos de frío', md.ropa.muertosDeFrio],
    ['Entierros', md.muertos.funerales.enterrar], ['Cuerpos quemados', md.muertos.funerales.quemar], ['Cuerpos abandonados', md.muertos.funerales.abandonado], ['Huérfanos adoptados', md.muertos.adopciones.familia + md.muertos.adopciones.pueblo],
    ['Adultos con oficio', `${Math.round(md.oficios.conOficio * 100)} %`], ['Recuperación tras sequía', md.recuperaciones.length ? `${Math.round(md.recuperaciones.reduce((a, r) => a + r.anios, 0) / md.recuperaciones.length)} años` : '—'],
  ];
  return ind.map(([e, v]) => `<div class="indicador"><div class="eti">${e}</div><div class="val">${v}</div></div>`).join('');
}

/** LA FICHA DEL EXPERIMENTO: la semilla y las condiciones de este mundo (para repetirlo igual). */
function fichaExperimento() {
  const q = new URLSearchParams(location.search);
  const cond = [['semilla', semillaActual], ['mundo', $('#tipo-mundo').value], ['cultura', mundo.cultura ? 'sí' : 'no'], ['lenguaje', mundo.lenguaje ? 'sí' : 'no'],
    ['cerebro', mundo.mente], ['copia', mundo.copia], ['gobierno', mundo.gobiernoInicial], ['reparto', mundo.repartoInicial], ['natalidad', mundo.natalidad], ['año', mundo.anio]];
  return cond.map(([k, v]) => `${k} <b>${v}</b>`).join(' · ');
}
function enlaceExperimento() {
  const u = new URL(location.href.split('?')[0]);
  u.searchParams.set('semilla', semillaActual); u.searchParams.set('mundo', $('#tipo-mundo').value);
  if (!mundo.cultura) u.searchParams.set('cultura', 'no');
  for (const k of ['copia', 'gobierno', 'reparto', 'lenguaje', 'gramatica']) { const v = new URLSearchParams(location.search).get(k); if (v) u.searchParams.set(k, v); }
  return u.toString();
}
function descargar(nombre, tipo, texto) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([texto], { type: tipo })); a.download = nombre; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
$('#menu-mundo').addEventListener('toggle', () => { if ($('#menu-mundo').open) $('#ficha-exp').innerHTML = fichaExperimento(); });
$('#copiar-enlace').addEventListener('click', async () => {
  const t = enlaceExperimento();
  try { await navigator.clipboard.writeText(t); $('#copiar-enlace').textContent = '¡Copiado!'; } catch { prompt('Copia este enlace:', t); }
  setTimeout(() => { $('#copiar-enlace').textContent = 'Copiar enlace'; }, 1500);
});
$('#exportar-json').addEventListener('click', () => {
  const datos = { condiciones: Object.fromEntries(fichaExperimento().replace(/<\/?b>/g, '').split(' · ').map((x) => { const i = x.indexOf(' '); return [x.slice(0, i), x.slice(i + 1)]; })),
    enlace: enlaceExperimento(), medidas: mundo.medidas(), poblacionPorAnio: mundo.historia, pueblos: mundo.tribus.map((t) => t.nombre), cronica: mundo.cronica };
  descargar(`neutro-minds-semilla${semillaActual}-anio${mundo.anio}.json`, 'application/json', JSON.stringify(datos, null, 1));
});
$('#exportar-csv').addEventListener('click', () => {
  const cab = ['anio', ...mundo.tribus.map((t) => t.nombre)].join(',');
  const filas = mundo.historia.map((fila, i) => [i + 1, ...mundo.tribus.map((_, t) => fila[t] || 0)].join(','));
  descargar(`neutro-minds-semilla${semillaActual}-poblacion.csv`, 'text/csv', [cab, ...filas].join('\n'));
});
// LA BIENVENIDA: la primera vez (no en las pruebas automáticas, que llevan ?avanzar)
{
  let visto = false;
  try { visto = localStorage.getItem('neutro-minds-visto') === '1'; } catch {}
  if (!visto && !new URLSearchParams(location.search).has('avanzar')) $('#bienvenida').hidden = false;
  const cerrar = () => { $('#bienvenida').hidden = true; try { localStorage.setItem('neutro-minds-visto', '1'); } catch {} };
  $('#empezar').addEventListener('click', cerrar);
  $('#bienvenida-enciclopedia').addEventListener('click', () => { cerrar(); mostrar('enciclopedia'); });
}

/** El aviso de guerra en la cabecera: la guerra en curso con más caídos. */
function avisoGuerra() {
  let peor = null;
  for (const [k, r] of mundo.relaciones) {
    if (r !== 'guerra') continue;
    const g = mundo.guerras.get(k);
    if (g && (!peor || g.caidos > peor.g.caidos)) peor = { k, g };
  }
  const caja = $('#guerra');
  if (!peor) { caja.hidden = true; return; }
  const [a, b] = peor.k.split('-').map(Number);
  caja.hidden = false;
  caja.innerHTML = `<span class="faro-guerra"></span><b>Guerra</b>${cuadrito(colorTribu(a))}${mundo.tribus[a].nombre}<span class="mono tenue">vs</span>${cuadrito(colorTribu(b))}${mundo.tribus[b].nombre}
    <span class="mono tenue">· ${mundo.anio - peor.g.desde} años · ${peor.g.caidos} caídos</span>`;
}

function panelPueblos(vivos) {
  let filas = '';
  for (const t of mundo.tribus) {
    const suyos = vivos.filter((p) => p.tribu === t.id);
    const ideas = new Map();
    // (cuántas PERSONAS tienen la idea: una persona tiene varias situaciones con la misma idea)
    for (const p of suyos) {
      const suyas = new Set();
      for (const [, n] of p.nucleo.neuronas) if (n.accion !== 'instinto') suyas.add(`${n.concepto} → ${ACCION[n.accion] || n.accion}`);
      for (const k of suyas) ideas.set(k, (ideas.get(k) || 0) + 1);
    }
    const top = [...ideas].sort((a, b) => b[1] - a[1])[0];
    filas += `<div class="fila-pueblo ${suyos.length ? '' : 'extinto'}">${cuadrito(colorTribu(t.id))}
      <span class="nombre">${t.nombre}</span><span class="pob">${suyos.length || '—'}</span>
      <span class="idea" title="${top ? esc(top[0]) : ''}">${suyos.length ? (top ? esc(top[0]) : 'sin ideas propias aún') : 'extinguidos'}</span></div>`;
  }
  // relaciones: lo que opinan, de media, los de cada pueblo de cada otro
  const vivas = mundo.tribus.filter((t) => vivos.some((p) => p.tribu === t.id));
  let m = `<div class="matriz" style="grid-template-columns:14px repeat(${vivas.length},1fr)"><span></span>`;
  for (const t of vivas) m += `<div class="cab">${cuadrito(colorTribu(t.id))}</div>`;
  for (const a of vivas) {
    m += `<div class="cab">${cuadrito(colorTribu(a.id))}</div>`;
    const suyos = vivos.filter((p) => p.tribu === a.id);
    for (const b of vivas) {
      if (a === b) { m += '<div class="celda"></div>'; continue; }
      const k = a.id < b.id ? `${a.id}-${b.id}` : `${b.id}-${a.id}`;
      if (!mundo.contactos.has(k)) { m += '<div class="celda" style="background:#231e18" title="no se conocen"></div>'; continue; }
      const v = suyos.reduce((s, p) => s + p.afinidad[b.id], 0) / Math.max(1, suyos.length);
      const rel = mundo.relaciones.get(k);
      const [bg, tinta, txt] = rel === 'guerra' ? ['#ff4d3d', '#110f0c', '⚔'] : rel === 'alianza' ? ['#2e86de', '#ffffff', 'A']
        : v <= -1 ? ['#6a2420', '#f3eadb', '−'] : v >= 2 ? ['#3f7a2b', '#f3eadb', '+'] : ['#2a3a24', '#a89b86', '·'];
      m += `<div class="celda" style="background:${bg};color:${tinta}" title="${a.nombre} opina de ${b.nombre}: ${v.toFixed(1)}">${txt}</div>`;
    }
  }
  m += '</div>';
  const muertes = Object.entries(mundo.muertos).filter(([, v]) => v).map(([k, v]) => `${k} ${v}`).join(' · ');
  // EL VOCABULARIO: la palabra más usada en cada pueblo para cada aviso (y cuántos la comparten)
  let vocab = '';
  for (const t of mundo.tribus) {
    const suyos = vivos.filter((p) => p.tribu === t.id);
    if (!suyos.length) continue;
    const celdas = ['lobo', 'enemigo'].map((que) => {
      const cuenta = new Map();
      for (const p of suyos) { const w = p.palabras.get(que); if (w) cuenta.set(w, (cuenta.get(w) || 0) + 1); }
      const top = [...cuenta].sort((a, b) => b[1] - a[1])[0];
      return top ? `<b class="palabra">«${esc(top[0])}»</b> <span class="tenue">${Math.round((100 * top[1]) / suyos.length)} %</span>` : '<span class="tenue">—</span>';
    });
    vocab += `<div class="fila-vocab">${cuadrito(colorTribu(t.id))}<span>${t.nombre}</span><span>${celdas[0]}</span><span>${celdas[1]}</span></div>`;
  }
  // LOS FAMOSOS: a quién conoce más gente (neuronas de persona), cuántos solo de oídas
  let famosos = '';
  if (mundo.fama) {
    const lista = [...mundo.fama].sort((a, b) => b[1].n - a[1].n).slice(0, 6);
    for (const [id, f] of lista) {
      const r = mundo.registro.get(id);
      if (!r || f.n < 5) continue;
      const tono = f.afecto / f.n >= 1 ? 'querido' : f.afecto / f.n <= -1 ? 'temido' : 'conocido';
      famosos += `<div class="conocido">${cuadrito(colorTribu(r.tribu))}<b>${esc(r.nombre)}</b>${r.murio != null ? ' <span class="tenue">(†)</span>' : ''} <span class="tenue">· ${tono} por ${f.n} · ${f.oidas} solo de oídas</span></div>`;
    }
  }
  // LÍDERES Y TRADICIONES
  let lideres = '';
  if (mundo.lideres) for (const t of mundo.tribus) {
    const q = mundo.porId.get(mundo.lideres.get(t.id));
    if (!q || !q.vivo) continue;
    const trad = [...mundo.tradiciones.values()].filter((x) => x.tribu === t.id).map((x) => { const [c, a] = x.idea.split('→'); return `«${esc(c)}» → ${esc(ACCION[a] || a)}`; });
    lideres += `<div class="conocido">${cuadrito(colorTribu(t.id))}<span>${t.nombre}</span> <b>👑 ${esc(q.nombre)}</b> <span class="tenue">· ${Math.floor(q.edad / TICKS_POR_ANIO)} años · ${q.hijos.length} hijos${q.perro ? ' · 🐕' : ''}</span>${trad.length ? `<div class="tenue" style="width:100%;padding-left:16px">tradición: ${trad.join(' · ')}</div>` : ''}</div>`;
  }
  let sociedad = '';
  for (const t of mundo.tribus) {
    const suyos = vivos.filter((p) => p.tribu === t.id);
    if (!suyos.length) continue;
    const creen = [...(mundo.creencias || new Map()).values()].filter((c) => c.tribu === t.id).map((c) => `temen ${esc(ACCION[c.accion] || c.accion)} (${c.n})`);
    const genio = suyos.reduce((s, p) => s + p.genio, 0) / suyos.length;
    const oficios = (() => { const n = suyos.filter((p) => p.hechas >= 6).length; return n ? [`${n}`] : []; })();
    sociedad += `<div class="conocido">${cuadrito(colorTribu(t.id))}<span>${t.nombre}</span> <span class="tenue">· genio ${genio.toFixed(2)} · ${t.robos || 0} robos, ${t.castigos || 0} castigados${oficios.length ? ` · artesanos: ${oficios.join(', ')}` : ''}${creen.length ? ` · ${creen.join(', ')}` : ''}</span></div>`;
  }
  const rf = mundo.regalosFuera || { misma: 0, otra: 0 };
  const humanos = `${mundo.mentiras || 0} mentiras (${mundo.descubiertas || 0} pilladas, ${mundo.ignorados || 0} avisos ignorados por desconfianza) · ${mundo.devueltos || 0} favores devueltos · ${mundo.venganzas || 0} venganzas · ${mundo.duelos || 0} duelos · ${mundo.parejas ? Math.round((100 * (mundo.parejasMixtas || 0)) / mundo.parejas) : 0} % de parejas mixtas · a otros pueblos, ${rf.misma + rf.otra ? Math.round((100 * rf.misma) / (rf.misma + rf.otra)) : 0} % de lo regalado fue a gente con su misma seña · se copia por ${{ prestigio: 'prestigio', exito: 'éxito', mayoria: 'mayoría' }[mundo.copia]}`;
  const hechos = `${humanos}<br>${mundo.perros.length} perros · ${mundo.trueques || 0} trueques (${mundo.rutas ? [...mundo.rutas.values()].filter((n) => n >= 3).length : 0} rutas) · ${mundo.regalos || 0} herramientas regaladas · ${mundo.porMiedo || 0} veces que el miedo cambió una decisión · ${mundo.incendios || 0} incendios · ${mundo.riadas || 0} riadas · ${mundo.lugaresPueblo ? mundo.lugaresPueblo.size : 0} lugares prohibidos o de abundancia`;
  const extra = `${lideres ? `<div><div class="rotulo">Quién manda (el más respetado) y sus tradiciones</div>${lideres}<div class="tenue" style="margin-top:6px">${hechos}</div></div>` : ''}${sociedad ? `<div><div class="rotulo">Carácter, robos, oficios y creencias</div>${sociedad}</div>` : ''}${vocab ? `<div><div class="rotulo">Sus palabras · lobo / enemigo</div>${vocab}</div>` : ''}${famosos ? `<div><div class="rotulo">Los más conocidos del mundo</div>${famosos}</div>` : ''}`;
  pintar($('#pueblos'), `${tablaPueblos()}<div style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:24px"><div>${graficaPoblacion()}<div style="margin-top:18px"><div class="rotulo">Su idea más extendida</div>${filas}</div></div><div>${extra}</div></div>
    <div><div class="rotulo">Relaciones entre pueblos</div>${m}
      <div class="leyenda-matriz"><span>${cuadrito('#2e86de')} alianza</span><span>${cuadrito('#3f7a2b')} amistad</span><span>${cuadrito('#ff4d3d')} guerra</span><span>${cuadrito('#231e18')} sin contacto</span></div></div>
    <div><div class="rotulo">Muertes</div><div class="muertes">${muertes || 'ninguna aún'}</div></div>`);
}

/** La población de cada pueblo, año a año, con los grandes sucesos marcados (guerras, alianzas, extinciones, mestizaje). */
function graficaPoblacion() {
  const h = mundo.historia;
  if (h.length < 2) return '';
  const W = 300, H = 110, max = Math.max(10, ...h.map((a) => Math.max(...a.map((v) => v || 0))));
  const x = (i) => (i / (h.length - 1)) * W, y = (v) => H - (v / max) * (H - 10);
  let lineas = '';
  for (let t = 0; t < mundo.tribus.length; t++) {
    const pts = h.map((a, i) => `${x(i).toFixed(1)},${y(a[t] || 0).toFixed(1)}`).join(' ');
    lineas += `<polyline points="${pts}" fill="none" stroke="${colorTribu(t)}" stroke-width="1.6" stroke-linejoin="round"/>`;
  }
  // los sucesos que cambian la historia
  const marcas = [];
  let mestizaje = false;
  for (const c of mundo.cronica) {
    let col = null;
    if (c.tipo === 'guerra') col = '#ff4d3d';
    else if (c.tipo === 'extincion') col = '#ffffff';
    else if (c.tipo === 'paz' && /alianza/.test(c.texto) && !/renuevan/.test(c.texto)) col = '#2e86de';
    else if (c.tipo === 'familia' && /se mezclan/.test(c.texto) && !mestizaje) { mestizaje = true; col = '#ffe066'; }
    if (col && c.anio > 0) marcas.push({ x: x(Math.min(h.length - 1, c.anio - 1)), col, texto: c.texto });
  }
  const svgMarcas = marcas.map((m) => `<g><title>${esc(m.texto)}</title><line x1="${m.x}" y1="12" x2="${m.x}" y2="${H}" stroke="${m.col}" stroke-width="1" stroke-dasharray="1 3"/><polygon points="${m.x - 4},10 ${m.x + 4},10 ${m.x},3" fill="${m.col}"/></g>`).join('');
  return `<div class="grafica"><div class="rotulo" style="display:flex;justify-content:space-between"><span>Población · ${h.length} años</span><span style="letter-spacing:0;text-transform:none;color:var(--mm-ink-3)">▲ suceso</span></div>
    <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;overflow:visible">
      <line x1="0" y1="${H}" x2="${W}" y2="${H}" stroke="#332b22"/><line x1="0" y1="${H / 2}" x2="${W}" y2="${H / 2}" stroke="#332b22" stroke-dasharray="2 3"/>
      ${lineas}${svgMarcas}</svg>
    <div class="ejes"><span>año 0</span><span>máx. ${max}</span><span>año ${h.length}</span></div>
    <div class="leyenda-sucesos"><span><i style="border-bottom-color:#ff4d3d"></i>guerra</span><span><i style="border-bottom-color:#2e86de"></i>alianza</span><span><i style="border-bottom-color:#ffffff"></i>extinción</span><span><i style="border-bottom-color:#ffe066"></i>primera familia mixta</span></div></div>`;
}

const COLOR_CRONICA = { guerra: '#ff4d3d', paz: '#7ddf64', contacto: '#7ddf64', idea: '#ffd166', familia: '#ffe066', extincion: '#ffffff',
                        muerte: '#a89b86', migracion: '#4fb3e8', tribu: '#f3eadb', dios: '#fff3c4', clima: '#c9b27a', invento: '#ffb347', vida: '#9b8cff' };
const CATEGORIA = { contacto: 'contactos', paz: 'guerras', guerra: 'guerras', familia: 'familias', idea: 'ideas', extincion: 'extinciones',
                    migracion: 'migraciones', muerte: 'otros', tribu: 'otros', dios: 'dios', clima: 'clima', invento: 'inventos', vida: 'otros' };
const FILTROS = [['todo', 'Todo'], ['contactos', 'Contactos'], ['guerras', 'Guerras y paces'], ['familias', 'Familias'], ['ideas', 'Ideas'],
                 ['extinciones', 'Extinciones'], ['migraciones', 'Migraciones'], ['inventos', 'Inventos'], ['clima', 'Clima'], ['dios', 'Tus actos']];
function panelCronica() {
  const cont = $('#lista-cronica');
  if (mundo.cronica.length === cronicaVista) return;
  const nuevos = mundo.cronica.slice(cronicaVista);
  cronicaVista = mundo.cronica.length;
  if (!$('#cronica').classList.contains('activo')) sinLeer += nuevos.filter((c) => c.tipo === 'guerra' || c.tipo === 'extincion').length;
  marcarSinLeer();
  for (const c of nuevos) avisar(c);
  for (const c of nuevos) {
    const d = document.createElement('div');
    d.className = 'evento';
    d.dataset.cat = CATEGORIA[c.tipo] || 'otros';
    if (filtroCronica !== 'todo' && d.dataset.cat !== filtroCronica) d.hidden = true;
    const destacado = c.tipo === 'idea' || c.tipo === 'guerra' || c.tipo === 'extincion' || (c.tipo === 'invento' && /primera vez en el mundo/.test(c.texto));
    d.innerHTML = `<span class="anio">${c.anio}</span><span class="punto" style="background:${COLOR_CRONICA[c.tipo] || '#a89b86'};border-radius:${c.tipo === 'familia' || c.tipo === 'contacto' ? '50%' : '0'}"></span>
      <div class="texto" style="color:${destacado ? 'var(--mm-idea-core)' : 'var(--mm-ink)'}">${esc(c.texto)}</div>`;
    cont.prepend(d);
  }
  while (cont.children.length > 400) cont.lastChild.remove();
}
/**
 * LOS AVISOS: los grandes sucesos (guerras, paces y alianzas, pueblos que nacen o se extinguen, primeros contactos,
 * inventos nuevos en el mundo, revueltas) salen en una columna sobre el mapa; "Ir" lleva la cámara al pueblo.
 */
const QUE_AVISO = { guerra: ['Guerra', '#ff4d3d'], extincion: ['Extinción', '#ffffff'], tribu: ['Nace un pueblo', '#ffd166'], contacto: ['Encuentro', '#7ddf64'], invento: ['Invento', '#7ddf64'], paz: ['Paz', '#7ddf64'], idea: ['Idea', '#ffd166'] };
function esAviso(c) {
  if (c.tipo === 'guerra' || c.tipo === 'extincion') return true;
  if (c.tipo === 'tribu') return mundo.anio > 0;
  if (c.tipo === 'contacto') return /por primera vez/.test(c.texto);
  if (c.tipo === 'invento') return /^Por primera vez en el mundo|sabe hacer fuego: es la primera vez en el mundo|ya tienen fuego/.test(c.texto);
  if (c.tipo === 'paz') return /Vuelve la paz|alianza/.test(c.texto);
  if (c.tipo === 'idea') return /creen que|ya no hablan como/.test(c.texto);
  return false;
}
let avisoId = 0;
function avisar(c) {
  if (!esAviso(c)) return;
  const [que, color] = QUE_AVISO[c.tipo] || ['Suceso', '#a89b86'];
  const t = mundo.tribus.find((tr) => c.texto.includes(tr.nombre));
  const d = document.createElement('div');
  d.className = 'aviso'; d.dataset.id = ++avisoId;
  d.innerHTML = `<span class="raya" style="background:${color}"></span><div style="flex:1"><div class="que" style="color:${color}">Año ${c.anio} · ${que}</div><div class="texto" title="${esc(c.texto)}">${esc(c.texto.length > 120 ? c.texto.slice(0, 117) + '…' : c.texto)}</div></div>
    <div class="acciones"><button class="quitar" aria-label="Quitar este aviso">×</button>${t ? `<button data-ir="${t.id}">Ir</button>` : ''}</div>`;
  $('#avisos').prepend(d);
  while ($('#avisos').children.length > 2) $('#avisos').lastChild.remove();
  setTimeout(() => d.remove(), 12000);
}
function irAPueblo(id) {
  const suyos = mundo.personas.filter((p) => p.vivo && p.tribu === id).map((p) => [p.x, p.y]);
  if (suyos.length) encuadrar(suyos);
  elegirPueblo(id);
}
$('#avisos').addEventListener('click', (ev) => {
  const ir = ev.target.closest('[data-ir]'); if (ir) { irAPueblo(+ir.dataset.ir); ir.closest('.aviso').remove(); return; }
  const q = ev.target.closest('.quitar'); if (q) q.closest('.aviso').remove();
});

/** LA ENCICLOPEDIA: cómo funciona cada cosa, y lo que está programado frente a lo que sale solo. */
const ENCICLOPEDIA = [{"id": "mentes", "titulo": "Las mentes", "texto": "<p>Cada persona tiene su propio cerebro de <b>Neutro</b>. No es una red neuronal ni un guion: son <b>neuronas de concepto</b>, inspiradas en el trabajo de Rodrigo Quian Quiroga. Cada neurona asocia una situación con nombre («Lobo cerca», «Falta carne», «Frío») a una acción, y aprende de lo que siente su cuerpo después.</p>\n<p><b>Lo bueno y lo malo lo decide su cuerpo</b>, no una lista escrita: si tras hacer algo se alivia el hambre, la sed, el frío, el dolor o el cansancio, eso estuvo bien; si empeora, mal. Y como sienten el malestar de quien tienen al lado (más si es de su familia), ayudar alivia y herir duele.</p>\n<p>Solo traen de serie lo que un humano trae al nacer: comer, beber y dormir, el apego a la pareja y a casa, el temperamento, la curiosidad, el grito de alarma, la prudencia ante el lobo tras un susto y la empatía. Todo lo demás —construir, compartir, pelear, robar, mudarse, inventar— lo eligen y lo aprenden ellos.</p>\n<p>Al dormir repasan lo que más les afectó del día. Tienen una <b>memoria de sucesos</b> (qué suele venir después de qué, y cuánto daño o alivio trae) y <b>neuronas de persona</b> (a quién conocen y qué sienten por él). Exploran más lo que han visto poco: es su curiosidad.</p>", "sincero": "Su cerebro se puede leer: haz clic en alguien y verás qué piensa y de quién aprendió cada idea. <b>Límite:</b> el núcleo no sabe unir lo que hace hoy con lo que pasa meses después: guardar comida para el invierno o huir de un volcán que tiembla no les sale solos (todavía)."}, {"id": "cultura", "titulo": "La cultura", "texto": "<p>Nadie nace sabiendo lo que sabían sus padres. Las ideas pasan de unos a otros como entre humanos: <b>viendo</b> cómo le va a otro lo que hace (si a tu vecino le sienta mal una planta, aprendes a no comerla), <b>hablando</b> (enseñar solo funciona si los dos tienen las mismas palabras), y por lo que dejan <b>pintado y escrito</b>. Cada idea guarda su genealogía: quién la tuvo primero y por cuántas manos ha pasado. Con la lente «Ideas» puedes seguir una por el mapa.</p>\n<p>Una <b>tradición</b> es una idea que tiene medio pueblo, que casi todos recibieron de otros y cuyo inventor murió hace mucho.</p>", "sincero": "<b>Lo medido:</b> con la tierra limitada, la cultura no da más población (gana en 2 de 10 mundos), pero con ella hay más salud, menos muertes evitables y menos desigualdad."}, {"id": "lenguas", "titulo": "Las lenguas", "texto": "<p>Cada concepto y cada acción pueden tener una palabra, que se inventa con las sílabas de cada pueblo y se acuerda jugando a nombrar. <b>Oír es como ver</b>: si te dicen «ciervo» y no lo ves, se enciende el mismo concepto que si lo vieras (las neuronas de concepto responden igual a la cosa y a su nombre).</p>\n<p>Enseñar es hablar: una idea solo pasa si los dos usan las mismas palabras. Entre pueblos, la barrera del idioma frena las ideas. Los sonidos cambian de madres a hijos y los pueblos que se separan acaban hablando distinto; el árbol de lenguas (informe «Lenguas») suele coincidir con quién nació de quién.</p>", "sincero": "<b>Límite:</b> salen vocabularios, frases cortas, dialectos y préstamos, no una gramática como la nuestra. En la gramática «holística», la reutilización de trozos está en la propia regla de inventar."}, {"id": "sociedad", "titulo": "Gobiernos y sociedad", "texto": "<p>El gobierno de cada pueblo lo pones tú (en su ficha, en «Sociedad»): <b>banda</b>, <b>jefatura</b> (manda uno, hereda su hijo, cobra tributo), <b>democracia</b> (votan los adultos) o <b>teocracia</b> (manda el más piadoso y las creencias son ley). Es una condición del experimento.</p>\n<p>Lo demás no lo decide ninguna regla: las peleas, los robos, compartir o mudarse los elige cada persona. Una <b>guerra</b> no se declara: es el nombre de lo que pasa cuando entre dos pueblos ha habido muertes en peleas en los últimos años. Un pueblo nuevo nace cuando una familia se va lejos y su asentamiento dura y crece.</p>\n<p>Hay también temperamento (heredado, de generoso a agresivo), reputación, gratitud, duelo, señas de identidad y oficios.</p>", "sincero": "<b>Siendo sinceros:</b> lo que pase depende de cómo están programadas estas reglas. Es un juguete para pensar, no una prueba sobre sociedades reales."}, {"id": "creencias", "titulo": "Supersticiones y creencias", "texto": "<p>Si a alguien le cae una desgracia (un rayo, una plaga, un incendio, una riada) mientras hacía algo poco habitual, empieza a temerlo. El miedo se cuenta al conversar; si un tercio del pueblo teme lo mismo, es una creencia. Como dios, tus rayos y plagas también las crean.</p>", "sincero": "<b>Ojo:</b> no todas son falsas. Temer acercarse a otros puede tener sentido si hay enfermedades que se contagian."}, {"id": "inventos", "titulo": "Inventos y oficios", "texto": "<p>Nadie programa los inventos: alguien los encuentra probando (cesta, lanza, red, siembra, despensa, empalizada, manta, abrigo, armadura, carreta, balsa, curar, domesticar un perro…), y se transmiten como ideas o se cambian por comida. Algunos piden otros antes: la carreta necesita la cesta; la armadura, el abrigo.</p>\n<p>Con la práctica cada uno gana pericia en lo que hace (pescar, cazar, recoger, sembrar, fabricar, curar, enseñar…) y aparecen los oficios y los artesanos, que hacen de sobra para regalar y comerciar.</p>", "sincero": "El árbol de inventos (informe «Inventos») muestra quién descubrió cada uno, cuándo y en cuántos pueblos está."}, {"id": "cuerpo", "titulo": "Cuerpo, nutrición y familia", "texto": "<p>Además de hambre y sed, el cuerpo necesita <b>proteína</b> (pescado, caza, algo de larvas en el bosque) y <b>vitaminas</b> (fruta). Lo que falta se siente como una necesidad, cura peor y da menos hijos. El frío del invierno muerde más al norte y en lo alto; la ropa (manta, abrigo) protege.</p>\n<p>Tener otro hijo es una decisión que depende de lo que cada madre ha vivido: si tener hijos le trajo hambre o perderlos, tiene menos.</p>", "sincero": "<b>Lo medido:</b> decidiendo tienen un hijo menos de media y viven casi 4 años más que por instinto. No aparece la transición demográfica."}, {"id": "mundo", "titulo": "El mundo y el dios", "texto": "<p>El mundo tiene física: el sol y las estaciones dan la temperatura; el océano oscila y trae años de sequía y de lluvias; las nubes, el hielo y los lagos salen de ahí. Hay volcanes (que tiemblan antes de reventar) y terremotos. Las plantas y los animales crecen según el agua y el calor, y la tierra se agota si se explota.</p>\n<p>Tú eres el dios: rayo, plaga, comida, lobos y lo que cae del cielo (teclas 1 a 5), y con «+» volcán, terremoto, lluvia, sequía, langostas y plantas nuevas. Todo lo que haces lo viven y lo aprenden: el dolor les enseña igual que cualquier otra cosa.</p>", "sincero": "Con <b>?islas</b> en la dirección el mundo son cuatro islas separadas por el mar: veremos si inventan la balsa y se encuentran."}, {"id": "medidas", "titulo": "Cómo se mide", "texto": "<p>Con la tierra limitada, contar personas no dice si una sociedad vive mejor. Por eso se mide la <b>calidad de vida</b>: vida media al morir, salud, muertes evitables (hambre, veneno, lobos, peleas…), desigualdad (0 = todos igual, 1 = uno lo tiene todo), recuperación tras las sequías, inventos e ideas distintas.</p>\n<p>Las comparaciones (con y sin cultura, cada gobierno, cada forma de copiar) se hacen en 10 mundos distintos, y se cuentan todas, salgan bien o mal.</p>", "sincero": "Un solo mundo nunca demuestra nada: lo que ves en pantalla es un caso, no una conclusión."}];
let entradaEnciclopedia = 'mentes';
function panelEnciclopedia() {
  const e = ENCICLOPEDIA.find((x) => x.id === entradaEnciclopedia) || ENCICLOPEDIA[0];
  pintar($('#enciclopedia'), `<div class="enciclopedia"><nav>${ENCICLOPEDIA.map((x) => `<button data-entrada="${x.id}" class="${x.id === e.id ? 'activo' : ''}">${x.titulo}</button>`).join('')}</nav>
    <article><h3>${e.titulo}</h3>${e.texto}<div class="sincero">${e.sincero}</div></article></div>`);
}
$('#enciclopedia').addEventListener('click', (ev) => { const b = ev.target.closest('[data-entrada]'); if (b) { entradaEnciclopedia = b.dataset.entrada; panelEnciclopedia(); } });

function marcarSinLeer() {
  const b = document.querySelector('.informes button[data-informe="cronica"]');
  b.innerHTML = `Historia${sinLeer ? ` <span class="insignia">${sinLeer}</span>` : ''}`;
}
function prepararCronica() {
  $('#cronica').innerHTML = `<div class="filtros">${FILTROS.map(([k, n]) => `<button data-f="${k}" class="${k === filtroCronica ? 'activo' : ''}">${n}</button>`).join('')}</div><div id="lista-cronica"></div>`;
  cronicaVista = 0; sinLeer = 0; marcarSinLeer();
}

/** La situación en palabras: lo que la persona ve ahora. */
function leerSituacion(s) {
  if (!s) return '';
  const [nec, r, m, a, l, , x, c, k] = s.split(' ');
  const dist = (c) => ({ 1: 'al lado', 2: 'cerca', 3: 'lejos' }[c]);
  const partes = [{ h: 'tiene hambre', s: 'tiene sed', b: 'está bien' }[nec]];
  if (r[1] !== '0') partes.push(`bayas rojas ${dist(r[1])}`);
  if (m[1] !== '0') partes.push(`moradas ${dist(m[1])}`);
  if (a[1] !== '0') partes.push(`agua ${dist(a[1])}`);
  if (l[1] !== '0') partes.push(`un lobo ${dist(l[1])}`);
  if (x[1] !== '0') partes.push(`un extraño ${dist(x[1])}${{ a: ' (amigo)', e: ' (enemigo)', n: '' }[x[2]] || ''}`);
  if (c && c[1] !== '0') partes.push(`un ciervo ${dist(c[1])}`);
  if (k && k[1] !== 'n') partes.push(k[1] === 's' ? 'en plena sequía' : 'en años de lluvias');
  const v = s.split(' ')[10];
  if (v && v[1] === 'l') partes.push('le han avisado de un lobo');
  if (v && v[1] === 'e') partes.push('le han avisado de un enemigo');
  const z = s.split(' ')[9];
  if (z) { if (z[1] === '1') partes.push('cansado'); if (z[2] === '1') partes.push('de noche'); partes.push(z[3] === '1' ? 'en casa' : 'lejos de casa'); }
  return partes.join(', ');
}

function chipPersona(id, rel) {
  const q = mundo.porId.get(id), r = mundo.registro.get(id);
  if (q && q.vivo) return `<a class="chip" data-id="${q.id}">${cuadrito(colorTribu(q.tribu))}${esc(q.nombre)}<small>${rel}</small></a>`;
  if (r) return `<span class="chip muerto">${cuadrito(colorTribu(r.tribu))}${esc(r.nombre)}<small>${rel} · †${r.murio ?? ''}</small></span>`;
  return '';
}

/** El color de una idea según de qué trata (para leer la lista de un vistazo). */
function colorIdea(concepto) {
  if (concepto.startsWith('Aviso')) return '#ffd166';
  if (concepto === 'Invierno') return '#c9d6ff';
  if (concepto.startsWith('Cansado')) return '#9b8cff';
  if (concepto === 'Ciervo cerca') return '#c9a26b';
  if (concepto.includes('morada')) return PAL.veneno;
  if (concepto === 'Bayas' || concepto === 'Hambre') return PAL.baya;
  if (concepto.includes('Lobo')) return PAL.lobo;
  if (concepto === 'Sed') return '#4fb3e8';
  if (concepto.includes('Extraño') || concepto.includes('Enemigo')) return '#ff8fab';
  return '#a89b86';
}

// EL CEREBRO QUE SE ENCIENDE: sobre el dibujo del cerebro, cada concepto en una zona (inspiración, no anatomía exacta)
// y un punto por cada neurona real de ese concepto; la del concepto que dispara ahora brilla
const ZONAS = {
  'Calma': [0.20, 0.36], 'Bayas': [0.33, 0.22], 'Baya morada al lado': [0.40, 0.44], 'Hambre': [0.52, 0.64],
  'Sed': [0.40, 0.64], 'Lobo cerca': [0.50, 0.50], 'Extraño': [0.68, 0.38], 'Enemigo a la vista': [0.62, 0.56], 'Ciervo cerca': [0.78, 0.50], 'Cansado': [0.30, 0.55], 'Cansado de noche': [0.24, 0.64], 'Aviso de lobo': [0.58, 0.28], 'Aviso de enemigo': [0.70, 0.62], 'Muerto cerca': [0.56, 0.58], 'Falta carne': [0.44, 0.40], 'Falta fruta': [0.48, 0.46], 'Frío': [0.36, 0.46],
};
function dibujarCerebro(p) {
  const lienzoC = $('#cerebro');
  if (!lienzoC) return;
  const g = lienzoC.getContext('2d'), W = lienzoC.width, H = lienzoC.height;
  g.clearRect(0, 0, W, H);
  if (imagenCerebro.complete) { g.globalAlpha = 0.85; g.drawImage(imagenCerebro, 0, 0, W, H); g.globalAlpha = 1; }
  else imagenCerebro.onload = () => dibujarCerebro(p);
  const porConcepto = new Map();
  for (const n of p.nucleo.neuronas.values()) porConcepto.set(n.concepto, (porConcepto.get(n.concepto) || 0) + 1);
  for (const [concepto, [zx, zy]] of Object.entries(ZONAS)) {
    const cuantas = porConcepto.get(concepto) || 0, activa = concepto === p.concepto;
    const cx = zx * W, cy = zy * H, col = colorIdea(concepto);
    // un punto por neurona (hasta 40), en espiral alrededor de su zona
    for (let i = 0; i < Math.min(40, cuantas); i++) {
      const r = 4 + Math.sqrt(i) * 6, a = i * 2.39996;
      const px = Math.round(cx + Math.cos(a) * r), py = Math.round(cy + Math.sin(a) * r);
      // (con contorno oscuro: los rojos se perdían sobre el rosa del cerebro)
      g.fillStyle = '#1a1410'; g.fillRect(px - 4, py - 4, 8, 8);
      g.fillStyle = activa ? PAL.fx.ideaNucleo : col; g.fillRect(px - 3, py - 3, 6, 6);
    }
    g.globalAlpha = 1;
    if (activa) {
      const pulso = 14 + ((fotograma >> 3) & 1) * 3;
      anillo(g, cx, cy, pulso, PAL.fx.idea, 3);
      anillo(g, cx, cy, pulso + 6, 'rgba(255,209,102,0.45)', 2);
    }
  }
}

const experiencia = (n) => Object.values(n.fallos).reduce((s, v) => s + v, 0) + Object.values(n.aciertos || {}).reduce((s, v) => s + v, 0);
const suma = (o) => Object.values(o || {}).reduce((s, v) => s + v, 0);

function panelMente() {
  const p = elegido, t = mundo.tribus[p.tribu];
  const anios = Math.floor(p.edad / TICKS_POR_ANIO);
  // LA FAMILIA COMO ÁRBOL: padres arriba, la persona y su pareja, los hijos abajo (los muertos, tachados)
  const padres = [p.madre && chipPersona(p.madre, 'madre'), p.padre && chipPersona(p.padre, 'padre')].filter(Boolean).join('');
  const reg = p.pareja != null && mundo.registro.get(p.pareja);
  const pareja = p.pareja != null ? chipPersona(p.pareja, reg && reg.tribu !== p.tribu ? `pareja · ${mundo.tribus[reg.tribu].nombre}` : 'pareja') : '';
  const hijos = p.hijos.slice(-8).map((h) => { const r = mundo.registro.get(h); return chipPersona(h, r && r.murio == null ? `${mundo.anio - r.nacio} años` : 'hijo/a'); }).join('');
  const familia = padres || pareja || hijos ? `<div class="arbol">${padres ? `<div class="familia">${padres}</div><div class="rama"></div>` : ''}
    <div class="familia"><span class="chip yo">${cuadrito(colorTribu(p.tribu))}${esc(p.nombre)}</span>${pareja ? `<span class="tenue mono">+</span>${pareja.replace('class="chip"', `class="chip" style="border-color:${reg && reg.tribu !== p.tribu ? colorTribu(reg.tribu) : 'var(--mm-line)'}"`)}` : ''}</div>
    ${hijos ? `<div class="rama"></div><div class="familia">${hijos}</div>` : ''}${p.hijos.length > 8 ? `<span class="tenue">y ${p.hijos.length - 8} hijos más</span>` : ''}</div>` : '';
  let html = `<div class="ficha-cabeza"><canvas class="retrato" id="retrato" width="48" height="64"></canvas><div>
      <div class="nombre">${esc(p.nombre)} <small>· ${anios} años${anios >= 55 ? ` · ${p.sexo === 'f' ? 'anciana' : 'anciano'}` : anios < 14 ? ' · niño/a' : ''}${p.vivo ? '' : ` · murió por ${p.causa}`}</small></div>
      <div class="pueblo">${cuadrito(colorTribu(p.tribu))}${t.nombre} <span class="tenue">· ${p.sexo === 'f' ? 'mujer' : 'hombre'} · ${p.hijos.length} hijos${p.carga ? ` · lleva ${p.carga} ${p.carga === 1 ? 'baya' : 'bayas'}` : ''}</span></div>
    </div></div><!--sec:ahora-->
    <div class="vitales">
      <div class="vital"><div class="eti"><span>Salud</span><b>${Math.max(0, p.salud | 0)}</b></div><div class="barra"><i style="width:${Math.max(0, p.salud)}%;background:var(--mm-health)"></i></div></div>
      <div class="vital"><div class="eti"><span>Hambre</span><b>${p.hambre | 0}</b></div><div class="barra"><i style="width:${p.hambre}%;background:var(--mm-hunger)"></i></div></div>
      <div class="vital"><div class="eti"><span>Sed</span><b>${p.sed | 0}</b></div><div class="barra"><i style="width:${p.sed}%;background:var(--mm-thirst)"></i></div></div>
      <div class="vital"><div class="eti"><span>Cansancio</span><b>${p.cansancio | 0}</b></div><div class="barra"><i style="width:${p.cansancio}%;background:#9b8cff"></i></div></div>
    </div>`;
  if (p.vivo && p.dormido) html += `<div class="pensando"><div class="rotulo" style="margin:0">Durmiendo</div><div class="porque">${mundo.enCasa(p) ? 'En casa' : 'Al raso, lejos de casa'}${mundo.esNoche ? ', de noche' : ''}. Mientras duerme no decide nada; despertará descansado o con el día.</div></div>`;
  if (p.vivo && !p.dormido) {
    // (lo que hay de verdad: la neurona de esa situación y su experiencia; Neutro no tiene "niveles de activación")
    const n = p.nucleo.neuronas.get(p.situacion);
    const exp = n ? `Su neurona de esta situación: ${suma(n.aciertos)} aciertos y ${+suma(n.fallos).toFixed(1)} fallos.` : 'Sin neurona propia para esto: actúa por instinto o por lo que su concepto suele hacer.';
    html += `<div class="pensando con-cerebro"><canvas id="cerebro" width="324" height="282" title="Sus neuronas de concepto: un punto por neurona, agrupadas por concepto; brilla la que dispara ahora"></canvas><div>
      <div class="rotulo" style="margin:0">Pensando ahora</div>
      <div class="que">${esc(p.concepto)} → ${esc(ACCION[p.accion] || p.accion)}</div>
      <div class="porque">Ahora ${esc(leerSituacion(p.situacion))}. ${exp}</div></div></div>`;
  }
  // UNA IDEA ES UN CONCEPTO Y SU RESPUESTA (Quian Quiroga: la neurona de concepto responde igual ante variantes de lo
  // mismo). Las situaciones concretas son sus variantes: se cuentan, y del origen se enseña el más antiguo
  const grupos = new Map();
  for (const [sit, n] of p.nucleo.neuronas) {
    if (n.accion === 'instinto') continue;
    const k = `${n.concepto}|${n.accion}`;
    let g = grupos.get(k);
    if (!g) grupos.set(k, g = { concepto: n.concepto, accion: n.accion, variantes: 0, exp: 0, origen: null, activa: false });
    g.variantes++; g.exp += experiencia(n);
    if (sit === p.situacion) g.activa = true;
    const o = p.origen.get(sit);
    if (o && (!g.origen || o.anio < g.origen.anio)) g.origen = o;
  }
  const ideas = [...grupos.values()].sort((a, b) => b.activa - a.activa || b.exp - a.exp);
  html += `<!--sec:ideas--><div><div class="rotulo" style="display:flex;justify-content:space-between"><span>Ideas · ${ideas.length}</span><span style="letter-spacing:0;text-transform:none;color:var(--mm-ink-3)">origen → manos</span></div>`;
  for (const g of ideas.slice(0, 20)) {
    const o = g.origen;
    let origen = 'de su propia experiencia', manos = 'suya';
    if (o && o.autor !== p.id) {
      origen = `de ${o.nombre} (${mundo.tribus[o.tribu].nombre}), año ${o.anio}`; manos = `${o.manos} ${o.manos === 1 ? 'mano' : 'manos'}`;
      if (o.imitada && o.de != null) { const m = mundo.registro.get(o.de); if (m) origen += ` · la copió de niño viendo a ${m.nombre}`; }
    }
    else if (o) origen = `la aprendió en el año ${o.anio}`;
    const datos = o ? `data-autor="${o.autor}" data-anio="${o.anio}"` : `data-autor="${p.id}" data-anio="${mundo.anio}"`;
    html += `<div class="idea-fila ${g.activa ? 'activa' : ''}" ${datos} data-concepto="${esc(g.concepto)}" data-accion="${g.accion}" title="Seguir esta idea por el mapa">${cuadrito(colorIdea(g.concepto))}
      <div><div class="nombre-idea">${esc(g.concepto)} → ${esc(ACCION[g.accion] || g.accion)}</div><div class="origen">${esc(origen)} · en ${g.variantes} ${g.variantes === 1 ? 'situación' : 'situaciones'}</div></div>
      <span class="manos">${manos}</span></div>`;
  }
  if (!ideas.length) html += '<p class="vacio">Aún no tiene ideas propias: todo lo hace por instinto.</p>';
  // lo que lleva encima y lo que ha fabricado
  // (sus cosas: el nombre que les da su pueblo y para qué sirven, según sus propiedades)
  const objetos = p.cosas.map((c) => { const [u, v] = Object.entries(c.usos).filter(([k]) => k !== 'punzar').sort((a, b) => b[1] - a[1])[0]; return `<b class="palabra">«${esc(c.nombre)}»</b> <span class="mono" style="font-size:11px">${v >= 0.15 ? `${TEXTO_USO[u]} ${Math.round(v * 100)} %` : 'no le ha encontrado uso'}</span>`; });
  for (const o of p.objetos) objetos.push(o === 'carreta' ? 'una carreta' : o);
  const mats = [['madera', p.madera], ['piedra', p.piedra], ['fibra', p.fibra], ['pieles', p.pieles], ['hueso', p.hueso], ['arcilla', p.arcilla], ['resina', p.resina]].filter(([, n]) => n).map(([k, n]) => `${n} de ${k}`);
  const nivel = mundo.fuertes.get(`${p.hogar[0]},${p.hogar[1]}`);
  const despensa = mundo.despensas.get(`${p.hogar[0]},${p.hogar[1]}`) || 0;
  if (p.perro) objetos.push('🐕 un perro');
  const esLider = mundo.lideres && mundo.lideres.get(p.tribu) === p.id;
  const malos = [...p.lugares.values()].filter((v) => v <= -3).length, buenos = [...p.lugares.values()].filter((v) => v >= 3).length;
  const genio = p.genio <= -0.4 ? 'generoso y pacífico' : p.genio < 0.1 ? 'tranquilo' : p.genio < 0.5 ? 'de genio vivo' : 'egoísta y agresivo';
  const miedos = [...p.tabues].filter(([, f]) => f >= 1).sort((a, b) => b[1] - a[1]).map(([a, f]) => `${esc(ACCION[a] || a)} <span class="mono">(${f.toFixed(1)})</span>`);
  const oficio = p.hechas >= 6 ? [`${p.hechas} cosas hechas${p.excedentes.length ? `, ${p.excedentes.length} de sobra` : ''}; sabe hacer ${p.recetas.size}`] : [];
  html += `</div><!--sec:ahora--><div><div class="rotulo">Su carácter</div><div class="tenue">temperamento ${genio} <span class="mono">(${p.genio.toFixed(2)})</span> · curiosidad <span class="mono">${p.curiosidad.toFixed(2)}</span> · inquietud <span class="mono">${p.inquietud.toFixed(2)}</span>${p.inquietud > 0.5 ? ' <i>(explorador: prueba lo nuevo y se va a tierras lejanas)</i>' : ''} · seña ${cuadrito(COLOR_SENA[p.marca])}${p.duelo > mundo.tick ? ' · <b>de duelo</b>' : ''}${oficio.length ? ` · artesano de ${oficio.join(', ')}` : ''}${miedos.length ? `<br>teme ${miedos.join(' · ')} <i>(superstición: le pasó algo malo mientras lo hacía)</i>` : ''}</div></div>`;
  const of = mundo.oficioPrincipal(p);
  html += `<!--sec:cuerpo--><div><div class="rotulo">Su cuerpo y su oficio</div><div class="tenue">proteína <span class="mono">${p.proteina.toFixed(0)}</span>${p.proteina < 25 ? ' <b>(le falta carne)</b>' : ''} · vitaminas <span class="mono">${p.vitaminas.toFixed(0)}</span>${p.vitaminas < 25 ? ' <b>(le falta fruta)</b>' : ''} · ${of ? `su oficio: <b>${NOMBRE_OFICIO[of.oficio]}</b> (pericia ${p.pericia[of.oficio].toFixed(0)}, ${Math.round(of.especializacion * 100)} % de lo que sabe hacer)` : 'aún sin oficio'}</div></div>`;
  html += `<div><div class="rotulo">Su lugar en el pueblo</div><div class="tenue">${esLider ? '<b class="palabra">👑 la persona más respetada de su pueblo</b> · ' : ''}prestigio ${mundo.prestigio(p).toFixed(1)} (edad, hijos, herramientas, fama) · recuerda ${p.lugares.size} lugares: ${malos} que evita y ${buenos} a los que vuelve</div></div>`;
  html += `<div><div class="rotulo">Lo que tiene</div><div class="tenue">${objetos.length ? objetos.join('<br>') : 'ninguna cosa hecha'}<br>${mats.length ? mats.join(' · ') : 'sin materiales'}${nivel ? ` · su hogar tiene empalizada de nivel ${nivel}` : ''}${despensa ? ` · ${despensa} bayas en la despensa de su hogar` : ''}${p.enfermo > 0 ? ' · está enfermo/a' : p.inmune ? ' · inmune (pasó una enfermedad)' : ''}</div></div>`;
  // lo que ha aprendido de los sucesos (memoria de sucesos: qué suele venir después de qué)
  const vinculos = p.asoc.masFuertes(4).filter((v) => v.veces >= 2);
  if (vinculos.length) html += `<!--sec:ideas--><div><div class="rotulo">Lo que ha aprendido de los sucesos</div>${vinculos.map((v) => `<div class="vinculo"><b>${esc(v.a)}</b> → <b>${esc(v.b)}</b> <span class="tenue mono">fuerza ${v.fuerza.toFixed(2)} · ${v.veces} veces</span></div>`).join('')}</div>`;
  // NEURONAS DE PERSONA: a quién conoce (en persona u oído de otros)
  const conocidos = [...p.conocidos].sort((a, b) => Math.abs(b[1].afecto) - Math.abs(a[1].afecto)).slice(0, 8);
  if (conocidos.length) {
    html += `<!--sec:relaciones--><div><div class="rotulo">A quién conoce · ${p.conocidos.size}</div>`;
    for (const [id, e] of conocidos) {
      const r = mundo.registro.get(id);
      if (!r) continue;
      const contador = e.de != null && mundo.registro.get(e.de);
      const como = e.enPersona ? 'en persona' : `solo de oídas${contador ? `, se lo contó ${contador.nombre}` : ''}`;
      const sentimiento = e.afecto >= 3 ? 'le aprecia' : e.afecto <= -3 ? 'le odia' : e.afecto > 0 ? 'le cae bien' : e.afecto < 0 ? 'desconfía' : 'le es indiferente';
      html += `<div class="conocido">${cuadrito(colorTribu(r.tribu))}<b>${esc(r.nombre)}</b>${r.murio != null ? ' <span class="tenue">(†)</span>' : ''} <span class="tenue">· ${sentimiento} (${e.afecto.toFixed(0)}) · ${como}</span></div>`;
    }
    html += '</div>';
  }
  if (p.palabras.size) html += `<!--sec:palabras--><div><div class="rotulo">Sus palabras</div><div class="tenue">${[...p.palabras].map(([k, w]) => `${k} = <b class="palabra">«${esc(w)}»</b>`).join(' · ')}</div></div>`;
  if (p.ultimoSueno) html += `<!--sec:ideas--><div class="tenue">Su último sueño (año ${p.ultimoSueno.anio}): consolidó ${p.ultimoSueno.reforzadas} ideas que usó y le funcionaron, y olvidó ${p.ultimoSueno.olvidadas}.</div>`;
  html += '<!--sec:relaciones--><div><div class="rotulo">Qué opina de cada pueblo</div><div class="opiniones">';
  for (const o of mundo.tribus) {
    const v = Math.max(-10, Math.min(10, p.afinidad[o.id])) / 10;
    const alto = Math.max(2, Math.abs(v) * 16);
    html += `<div class="opinion"><div class="tubo"><i style="background:${v > 0.05 ? '#7ddf64' : v < -0.05 ? '#ff4d3d' : '#6f6354'};top:${v > 0 ? 50 - Math.abs(v) * 48 : 50}%;height:${alto}px"></i></div>${cuadrito(colorTribu(o.id))}</div>`;
  }
  html += '</div><div class="pie-opinion"><span>↑ amigo</span><span>↓ enemigo</span></div></div>';
  if (familia) html += `<!--sec:relaciones--><div><div class="rotulo">Familia</div>${familia}</div>`;
  // (los apartados: se juntan los trozos de cada uno y se enseña solo el elegido)
  const partes = html.split(/<!--sec:(\w+)-->/), secs = {};
  for (let i = 1; i < partes.length; i += 2) secs[partes[i]] = (secs[partes[i]] || '') + partes[i + 1];
  const APARTADOS = [['ahora', 'Ahora'], ['ideas', 'Ideas'], ['cuerpo', 'Cuerpo y oficio'], ['relaciones', 'Relaciones'], ['palabras', 'Palabras']];
  pintar($('#mente'), `${partes[0]}
    <nav class="subpestanas">${APARTADOS.map(([k, n]) => `<button data-sec="${k}" class="${k === apartadoPersona ? 'activo' : ''}">${n}</button>`).join('')}</nav>
    ${secs[apartadoPersona] || '<p class="vacio">Nada aquí todavía.</p>'}`);
  if (p.vivo && !p.dormido && apartadoPersona === 'ahora' && $('#cerebro')) dibujarCerebro(p);
  // el retrato: su sprite a 8 aumentos
  const r = $('#retrato').getContext('2d'), tmp = document.createElement('canvas');
  tmp.width = 6; tmp.height = 8;
  pintarPersona(tmp.getContext('2d'), 0, 0, 6, ESTILO[p.tribu % ESTILO.length], p.edad < 14 * TICKS_POR_ANIO, p.carga > 0, 0);
  r.imageSmoothingEnabled = false;
  r.drawImage(tmp, 0, 0, 48, 64);
}

// ---- la cámara ----
function ajustarPantalla(encuadrarTodo) {
  const r = lienzo.parentElement.getBoundingClientRect();
  lienzo.width = Math.max(1, Math.floor(r.width)); lienzo.height = Math.max(1, Math.floor(r.height));
  pantalla.imageSmoothingEnabled = false;
  // zoom 1 = el mundo entero cabe en pantalla
  // (con el zoom al mínimo el mundo LLENA la pantalla, de borde a borde: nunca se ve nada fuera de él)
  camara.min = Math.max(lienzo.width / mundoLienzo.width, lienzo.height / mundoLienzo.height);
  camara.max = camara.min * 8;
  if (encuadrarTodo || camara.zoom < camara.min) { camara.zoom = camara.min; camara.x = mundoLienzo.width / 2; camara.y = mundoLienzo.height / 2; }
}
function limitarCamara() {
  camara.zoom = Math.max(camara.min, Math.min(camara.max, camara.zoom));
  const mw = lienzo.width / camara.zoom / 2, mh = lienzo.height / camara.zoom / 2;
  camara.x = mw * 2 >= mundoLienzo.width ? mundoLienzo.width / 2 : Math.max(mw, Math.min(mundoLienzo.width - mw, camara.x));
  camara.y = mh * 2 >= mundoLienzo.height ? mundoLienzo.height / 2 : Math.max(mh, Math.min(mundoLienzo.height - mh, camara.y));
}
function presentar() {
  limitarCamara();
  const z = camara.zoom, sw = lienzo.width / z, sh = lienzo.height / z;
  pantalla.fillStyle = '#1b3550'; pantalla.fillRect(0, 0, lienzo.width, lienzo.height);
  pantalla.drawImage(mundoLienzo, camara.x - sw / 2, camara.y - sh / 2, sw, sh, 0, 0, lienzo.width, lienzo.height);
  $('#zoom').textContent = `zoom ${(z / camara.min).toFixed(1).replace('.0', '')}×`;
}
/** De un punto de la pantalla a una casilla del mundo. */
function aCasilla(ev) {
  const r = lienzo.getBoundingClientRect(), z = camara.zoom;
  const px = camara.x + (ev.clientX - r.left - lienzo.width / 2) / z, py = camara.y + (ev.clientY - r.top - lienzo.height / 2) / z;
  return [px / TAM, py / TAM, px, py];
}
function acercar(factor, ev) {
  const antes = ev ? aCasilla(ev) : null;
  camara.zoom *= factor; limitarCamara();
  if (ev) {   // que el punto bajo el ratón siga bajo el ratón
    const despues = aCasilla(ev);
    camara.x += antes[2] - despues[2]; camara.y += antes[3] - despues[3];
  }
}
/** Encuadra un conjunto de casillas (los portadores de una idea, por ejemplo). */
function encuadrar(puntos) {
  if (!puntos.length) return;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of puntos) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  const w = (x1 - x0 + 12) * TAM, h = (y1 - y0 + 12) * TAM;
  camara.x = (x0 + x1) / 2 * TAM; camara.y = (y0 + y1) / 2 * TAM;
  camara.zoom = Math.min(lienzo.width / w, lienzo.height / h, camara.max);
  limitarCamara();
}
lienzo.addEventListener('wheel', (ev) => { ev.preventDefault(); acercar(ev.deltaY < 0 ? 1.25 : 0.8, ev); }, { passive: false });
let arrastre = null;
lienzo.addEventListener('pointerdown', (ev) => { arrastre = { x: ev.clientX, y: ev.clientY, cx: camara.x, cy: camara.y, movio: false }; });
window.addEventListener('pointermove', (ev) => {
  if (!arrastre) return;
  const dx = ev.clientX - arrastre.x, dy = ev.clientY - arrastre.y;
  if (Math.abs(dx) + Math.abs(dy) > 4) arrastre.movio = true;
  if (arrastre.movio) { camara.x = arrastre.cx - dx / camara.zoom; camara.y = arrastre.cy - dy / camara.zoom; lienzo.style.cursor = 'grabbing'; }
});
window.addEventListener('pointerup', () => { setTimeout(() => { arrastre = null; }, 0); lienzo.style.cursor = ''; });
lienzo.addEventListener('dblclick', (ev) => acercar(2, ev));
window.addEventListener('resize', () => ajustarPantalla(false));
$('#encuadre').addEventListener('click', () => { camara.zoom = camara.min; limitarCamara(); });
document.querySelectorAll('.informes button').forEach((b) => b.addEventListener('click', () => { mostrar(b.dataset.informe); if (b.dataset.informe === 'cronica') { sinLeer = 0; marcarSinLeer(); } }));
$('#ver-noche').addEventListener('change', (e) => { verNoche = e.target.checked; });
$('#ver-niebla').addEventListener('change', (e) => { verNiebla = e.target.checked; });
$('#ver-nubes').addEventListener('change', (e) => { verNubes = e.target.checked; });

// ---- interacción ----
lienzo.addEventListener('click', (ev) => {
  if (arrastre && arrastre.movio) return;
  const [x, y] = aCasilla(ev);
  if (poder) { lanzarPoder(x, y); return; }
  let mejor = null, dmin = 3 / Math.max(1, camara.zoom / camara.min / 2);
  for (const p of mundo.personas) if (p.vivo) { const d = Math.hypot(p.x + 0.5 - x, p.y + 0.5 - y); if (d < dmin) { dmin = d; mejor = p; } }
  if (mejor) { elegir(mejor); return; }
  if (mundo.pinturas) for (const pin of mundo.pinturas.values()) if (Math.abs(pin.x + 0.5 - x) <= 1 && Math.abs(pin.y + 0.5 - y) <= 1) { pinturaElegida = `${pin.x},${pin.y}`; mostrar('lenguas'); return; }
  const o = territorio && x >= 0 && y >= 0 && x < mundo.ancho && y < mundo.alto ? territorio[Math.floor(y) * mundo.ancho + Math.floor(x)] : -1;
  if (o >= 0) elegirPueblo(o); else alMundo();
});
$('#mente').addEventListener('click', (ev) => {
  const s = ev.target.closest('[data-sec]');
  if (s) { recordar(); apartadoPersona = s.dataset.sec; panelMente(); return; }
  if (ev.target.closest('[data-volver]')) { elegido = null; if (puebloElegido != null) elegirPueblo(puebloElegido); else alMundo(); return; }
  const a = ev.target.closest('a.chip');
  if (a) { const q = mundo.porId.get(+a.dataset.id); if (q && q.vivo) elegir(q); return; }
  const f = ev.target.closest('.idea-fila');
  if (f) seguir({ autor: +f.dataset.autor, anio: +f.dataset.anio, concepto: f.dataset.concepto, accion: f.dataset.accion });
});
$('#idea').addEventListener('click', (ev) => {
  if (ev.target.closest('[data-otra-idea]')) { dejarDeSeguir(); return; }
  const f = ev.target.closest('.idea-fila');
  if (f && !seguida) { seguir({ autor: +f.dataset.autor, anio: +f.dataset.anio, concepto: f.dataset.concepto, accion: f.dataset.accion }); return; }
  const a = ev.target.closest('a.chip');
  if (a) { const q = mundo.porId.get(+a.dataset.id); if (q && q.vivo) elegir(q); return; }
  if (ev.target.id === 'dejar') { ev.preventDefault(); dejarDeSeguir(); }
});
$('#siguiendo-cerrar').addEventListener('click', dejarDeSeguir);
function elegir(p) {
  recordar();
  elegido = p; mostrar('mente'); panelMente(); actualizarNav();
  if (!$('#informe').hidden) cerrarInforme();
  // (si está fuera de lo que se ve, la cámara va hacia él)
  const mw = lienzo.width / camara.zoom / 2, mh = lienzo.height / camara.zoom / 2;
  if (Math.abs(p.x * TAM - camara.x) > mw * 0.9 || Math.abs(p.y * TAM - camara.y) > mh * 0.9) { camara.x = p.x * TAM; camara.y = p.y * TAM; }
}
/**
 * LA NAVEGACIÓN DEL PANEL, como en un navegador: antes de cada cambio (el mundo, un pueblo, una persona, una idea) se
 * guarda dónde se estaba, con su apartado; "Atrás" vuelve. Las migas dicen dónde se está y dejan saltar.
 */
let historialPanel = [], navegando = false;
const vistaPanel = () => document.querySelector('aside .panel.activo')?.id || 'inicio';
function estadoPanel() {
  return { vista: vistaPanel(), pueblo: puebloElegido, persona: elegido ? elegido.id : null, idea: seguida ? { ...seguida } : null, apPersona: apartadoPersona, apPueblo: apartadoPueblo };
}
function recordar() {
  if (navegando || !mundo) return;
  const e = estadoPanel(), u = historialPanel[historialPanel.length - 1];
  if (u && JSON.stringify(u) === JSON.stringify(e)) return;
  historialPanel.push(e);
  if (historialPanel.length > 40) historialPanel.shift();
}
function irAEstado(e) {
  navegando = true;
  apartadoPersona = e.apPersona; apartadoPueblo = e.apPueblo;
  const p = e.persona != null && mundo.porId.get(e.persona);
  if (e.vista === 'mente' && p && p.vivo) { puebloElegido = e.pueblo; elegir(p); }
  else if (e.vista === 'idea') { elegido = null; if (e.idea) seguir(e.idea); else { dejarDeSeguir(); mostrar('idea'); panelIdea(); } }
  else if (e.vista === 'pueblo' && e.pueblo != null && mundo.tribus[e.pueblo] && mundo.tribus[e.pueblo].vivos > 0) elegirPueblo(e.pueblo);
  else alMundo();
  navegando = false;
  actualizarNav();
}
function atras() {
  if (!historialPanel.length) return;
  irAEstado(historialPanel.pop());
}
function actualizarNav() {
  $('#atras').disabled = !historialPanel.length;
  const v = vistaPanel(), migas = [['mundo', 'El mundo']];
  if (puebloElegido != null && mundo.tribus[puebloElegido] && (v === 'pueblo' || v === 'mente')) migas.push(['pueblo', mundo.tribus[puebloElegido].nombre]);
  if (v === 'mente' && elegido) migas.push(['', elegido.nombre]);
  if (v === 'idea') migas.push(['', seguida ? `Idea: ${seguida.concepto} → ${ACCION[seguida.accion] || seguida.accion}` : 'Ideas']);
  $('#migas').innerHTML = migas.map(([k, n], i) => (i === migas.length - 1 ? `<span class="actual">${esc(n)}</span>` : `<button data-miga="${k}">${esc(n)}</button><span class="sep-migas">›</span>`)).join('');
}
$('#atras').addEventListener('click', atras);
$('#migas').addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-miga]'); if (!b) return;
  if (b.dataset.miga === 'mundo') alMundo(); else if (b.dataset.miga === 'pueblo' && puebloElegido != null) elegirPueblo(puebloElegido);
});
// (atajos: retroceso y Alt+← fuera de un campo de texto; el botón "atrás" del ratón)
window.addEventListener('keydown', (ev) => {
  const t = ev.target.tagName;
  if (t === 'INPUT' || t === 'SELECT' || t === 'TEXTAREA') return;
  if (ev.key === 'Backspace' || (ev.altKey && ev.key === 'ArrowLeft')) { ev.preventDefault(); if (!$('#informe').hidden) cerrarInforme(); else atras(); }
});
window.addEventListener('mouseup', (ev) => { if (ev.button === 3) { ev.preventDefault(); atras(); } });

/** Enseñar algo: un informe se abre en la ventana sobre el mapa; lo demás, en el panel de la derecha. */
const INFORMES = { pueblos: 'Pueblos', cronica: 'Historia', lab: 'Sociedad', lenguas: 'Lenguas', inventos: 'Inventos', enciclopedia: 'Enciclopedia' };
function mostrar(nombre) {
  if (INFORMES[nombre]) {
    $('#informe').hidden = false; $('#informe-titulo').textContent = INFORMES[nombre];
    document.querySelectorAll('.cuerpo-informe .panel').forEach((d) => d.classList.toggle('activo', d.id === nombre));
    document.querySelectorAll('.informes button').forEach((b) => b.classList.toggle('activo', b.dataset.informe === nombre));
    if (nombre === 'cronica') { sinLeer = 0; marcarSinLeer(); }
    if (nombre === 'enciclopedia') panelEnciclopedia();
    paneles();
    return;
  }
  document.querySelectorAll('aside .panel').forEach((d) => d.classList.toggle('activo', d.id === nombre));
}
function cerrarInforme() { $('#informe').hidden = true; document.querySelectorAll('.informes button').forEach((b) => b.classList.remove('activo')); }
$('#informe-cerrar').addEventListener('click', cerrarInforme);
$('#informe').addEventListener('click', (ev) => { if (ev.target.id === 'informe') cerrarInforme(); });
window.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && !$('#informe').hidden) cerrarInforme(); });
function alMundo() { recordar(); elegido = null; puebloElegido = null; mostrar('inicio'); panelInicio(); actualizarNav(); }
function elegirPueblo(t, irAllí = false) {
  recordar();
  elegido = null; puebloElegido = t; mostrar('pueblo'); panelPueblo(); actualizarNav();
  if (irAllí) { const suyos = mundo.personas.filter((p) => p.vivo && p.tribu === t).map((p) => [p.x, p.y]); if (suyos.length) encuadrar(suyos); }
}
/**
 * EL PUEBLO ELEGIDO EN EL MAPA: su territorio contorneado en blanco, un anillo de su color (que late) en cada uno de
 * los suyos, y su nombre encima, en el centro de donde vive su gente.
 */
let contornoPueblo = null, contornoDe = -1, contornoTerritorio = null;
function dibujarPuebloElegido() {
  const id = puebloElegido, W = mundo.ancho, H = mundo.alto;
  if (territorio && (contornoDe !== id || contornoTerritorio !== territorio)) {
    contornoDe = id; contornoTerritorio = territorio;
    contornoPueblo = document.createElement('canvas'); contornoPueblo.width = mundoLienzo.width; contornoPueblo.height = mundoLienzo.height;
    const g = contornoPueblo.getContext('2d');
    g.fillStyle = 'rgba(255,255,255,0.9)';
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (territorio[y * W + x] !== id) continue;
      const px = x * TAM, py = y * TAM;
      if (x + 1 >= W || territorio[y * W + x + 1] !== id) g.fillRect(px + TAM - 2, py, 2, TAM);
      if (x === 0 || territorio[y * W + x - 1] !== id) g.fillRect(px, py, 2, TAM);
      if (y + 1 >= H || territorio[(y + 1) * W + x] !== id) g.fillRect(px, py + TAM - 2, TAM, 2);
      if (y === 0 || territorio[(y - 1) * W + x] !== id) g.fillRect(px, py, TAM, 2);
    }
  }
  if (contornoPueblo) ctx.drawImage(contornoPueblo, 0, 0);
  const col = colorTribu(id), latido = 5 + Math.sin(fotograma / 8) * 1.5;
  let sx = 0, sy = 0, n = 0;
  for (const p of mundo.personas) {
    if (!p.vivo || p.tribu !== id) continue;
    const x = (p.rx ?? p.x) * TAM + 3, y = (p.ry ?? p.y) * TAM + 1;
    anillo(ctx, x, y, latido, col, 2);
    sx += p.x; sy += p.y; n++;
  }
  if (!n) return;
  // (el nombre, de un tamaño parecido en pantalla aunque se acerque la cámara)
  const k = Math.max(0.3, 1 / Math.max(1, camara.zoom / camara.min / 1.2)), fs = Math.round(26 * k);
  const t = mundo.tribus[id].nombre, cx = (sx / n) * TAM, cy = (sy / n) * TAM - 20 * k;
  ctx.font = `800 ${fs}px "Bricolage Grotesque", sans-serif`; ctx.textAlign = 'center';
  const w = ctx.measureText(t).width + 18 * k;
  ctx.fillStyle = 'rgba(17,15,12,0.85)'; ctx.fillRect(cx - w / 2, cy - fs, w, fs * 1.4);
  ctx.fillStyle = col; ctx.fillRect(cx - w / 2, cy + fs * 0.4 - 2 * k, w, Math.max(1, 2 * k));
  ctx.fillStyle = '#f3eadb'; ctx.fillText(t, cx, cy + fs * 0.1); ctx.textAlign = 'start';
}
$('#inicio').addEventListener('click', (ev) => {
  const f = ev.target.closest('[data-pueblo]'); if (f) { elegirPueblo(+f.dataset.pueblo, true); return; }
  const h = ev.target.closest('[data-informe]'); if (h) mostrar(h.dataset.informe);
});
$('#pueblo').addEventListener('click', (ev) => {
  const s = ev.target.closest('[data-sec]'); if (s) { recordar(); apartadoPueblo = s.dataset.sec; panelPueblo(); return; }
  if (ev.target.closest('[data-volver]')) { alMundo(); return; }
  const h = ev.target.closest('[data-informe]'); if (h) { mostrar(h.dataset.informe); return; }
  const q = ev.target.closest('[data-persona]'); if (q) { const p = mundo.porId.get(+q.dataset.persona); if (p && p.vivo) elegir(p); }
});
$('#pueblo').addEventListener('change', (ev) => {
  const s = ev.target.closest('select'); if (!s) return;
  if (s.dataset.q === 'gobierno') mundo.cambiarGobierno(puebloElegido, s.value, null); else mundo.cambiarGobierno(puebloElegido, null, s.value);
  s.blur(); panelPueblo(); if (lente === 'gobierno' && territorio) pintarTerritorio();
});
$('#inventos').addEventListener('click', (ev) => { const n = ev.target.closest('[data-inv]'); if (n) { inventoElegido = n.dataset.inv; panelInventos(); } });
$('#pueblos').addEventListener('click', (ev) => { const f = ev.target.closest('[data-pueblo]'); if (f) { cerrarInforme(); elegirPueblo(+f.dataset.pueblo, true); } });
$('#cronica').addEventListener('click', (ev) => {
  const b = ev.target.closest('.filtros button'); if (!b) return;
  filtroCronica = b.dataset.f;
  document.querySelectorAll('.filtros button').forEach((c) => c.classList.toggle('activo', c === b));
  document.querySelectorAll('#lista-cronica .evento').forEach((d) => { d.hidden = filtroCronica !== 'todo' && d.dataset.cat !== filtroCronica; });
});
$('#velocidades').innerHTML = VELOCIDADES.map((v) => `<button data-v="${v}" class="${v === velocidad ? 'activo' : ''}">${v}×</button>`).join('');
$('#velocidades').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  velocidad = +b.dataset.v;
  document.querySelectorAll('#velocidades button').forEach((c) => c.classList.toggle('activo', c === b));
});
$('#pausa').addEventListener('click', () => { pausa = !pausa; $('#pausa').textContent = pausa ? '▶' : '▮▮'; });
document.addEventListener('keydown', (e) => {
  if (e.target !== document.body) return;
  if (e.code === 'Space') { e.preventDefault(); $('#pausa').click(); }
  const p = PODERES.find((x) => x.tecla === e.key);
  if (p) prepararPoder(p.id);
  if (e.key === 'Escape' && poder) prepararPoder(poder);
});
prepararPoderes();
prepararLentes();
$('#poderes').addEventListener('click', (e) => { const b = e.target.closest('.poder'); if (b) prepararPoder(b.dataset.poder); });
$('#lista-mas-poderes').addEventListener('click', (e) => { const b = e.target.closest('.poder'); if (b) { prepararPoder(b.dataset.poder); $('#mas-poderes').open = false; } });
$('#nuevo').addEventListener('click', () => crear(1 + Math.floor(Math.random() * 99999)));
$('#cultura').addEventListener('change', () => crear(semillaActual));

const params = new URLSearchParams(location.search);
crear(+(params.get('semilla') || 1));
// ?avanzar=N: el mundo empieza ya con N años vividos (para enseñarlo); ?elegir: abre la mente de quien más ideas tiene
if (params.get('avanzar')) {
  mundo.verEfectos = false;
  for (let i = 0; i < +params.get('avanzar') * TICKS_POR_ANIO; i++) mundo.paso();
  mundo.verEfectos = true;
  history.replaceState(null, '', `?semilla=${semillaActual}`);
}
if (params.has('elegir')) {
  const nIdeas = (p) => [...p.nucleo.neuronas.values()].filter((n) => n.accion !== 'instinto').length;
  const candidatos = mundo.personas.filter((p) => p.vivo && p.edad > 20 * TICKS_POR_ANIO);
  // (?elegir=lider: la persona más respetada de un pueblo, mejor si tiene perro)
  const lideres = params.get('elegir') === 'lider' && mundo.lideres ? [...mundo.lideres.values()].map((id) => mundo.porId.get(id)).filter((q) => q && q.vivo) : [];
  if (lideres.length) elegir(lideres.find((q) => q.perro) || lideres[0]);
  else if (candidatos.length) elegir(candidatos.reduce((a, b) => (nIdeas(b) > nIdeas(a) ? b : a)));
}
if (params.has('seguir') && elegido) {
  // ?seguir: sigue la idea de la persona elegida que más lejos ha viajado (para enseñarlo)
  let mejor = null;
  for (const [sit, n] of elegido.nucleo.neuronas) {
    const o = elegido.origen.get(sit);
    if (n.accion !== 'instinto' && o && o.manos > 0 && (!mejor || o.manos > mejor.o.manos)) mejor = { n, o };
  }
  if (mejor) seguir({ autor: mejor.o.autor, anio: mejor.o.anio, concepto: mejor.n.concepto, accion: mejor.n.accion });
}
if (params.has('pueblo')) elegirPueblo(+params.get('pueblo'), true);
if (params.get('pestana')) mostrar(params.get('pestana'));
if (params.get('lente')) ponerLente(params.get('lente'));
if (params.has('menu')) { $('#menu-mundo').open = true; }
if (params.has('poderes')) { $('#mas-poderes').open = true; }
if (params.has('ciudad-prueba') && mundo.refugios) {   // (para las pruebas: levanta una ciudad de muestra junto al primer pueblo, y la enfoca)
  const t = mundo.tribus[0], [cx, cy] = t.campo; let n = 0;
  for (let r = 0; r < 9 && n < 46; r++) for (let dy = -r; dy <= r && n < 46; dy += 2) for (let dx = -r; dx <= r && n < 46; dx += 2) {
    const x = cx + dx, y = cy + dy, k = `${x},${y}`;
    if (!mundo.pisable(x, y) || mundo.refugios.has(k)) continue;
    const tipo = n % 7 === 6 ? 'ruina' : n % 3 === 2 ? 'choza' : 'casa';
    mundo.refugios.set(k, { x, y, tipo, capacidad: 6, habitantes: new Set(), estado: 1, tribu: t.id, anio: n, cayo: 0 });
    n++;
  }
  mundo.verAsentamientos();
  camara.zoom = camara.min * 4; camara.x = cx * TAM; camara.y = cy * TAM; limitarCamara();
}   // (para las pruebas: «Más poderes» abierto)
if (params.has('erupcion') && mundo.geologia && mundo.geologia.volcanes.length) {   // (para las pruebas: revienta un volcán y se mira)
  const v = mundo.geologia.volcanes[0]; v.humo = true; mundo.geologia.erupcion(v); mundo.tick += 2;
  camara.zoom = camara.min * 3; camara.x = v.x * TAM; camara.y = v.y * TAM; limitarCamara();
}   // (para las pruebas: el menú Mundo abierto)
// ?zoom=N: la cámara se acerca N veces sobre la persona elegida
if (params.get('zoom') && elegido) { camara.zoom = camara.min * +params.get('zoom'); camara.x = elegido.x * TAM; camara.y = elegido.y * TAM; limitarCamara(); }
// ?probar-poderes: lanza los cuatro poderes junto a la persona elegida (para comprobarlos)
if (params.has('probar-poderes') && elegido) { const { x, y } = elegido; mundo.plaga(x, y); mundo.comida(x + 6, y); mundo.soltarLobos(x - 6, y); mundo.rayo(x + 2, y + 2); }
if (params.has('pausa')) $('#pausa').click();
paneles();
requestAnimationFrame(bucle);

document.addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-lengua]'); if (!b) return;
  lenguaElegida = +b.dataset.lengua; panelLenguas();
});
