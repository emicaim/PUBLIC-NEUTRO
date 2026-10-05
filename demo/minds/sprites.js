// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 FOKO SOFT (Emilio Martinez) — Neutro, https://github.com/emicaim/PUBLIC-NEUTRO
// LOS DIBUJOS DE MIL MENTES: pixel art cálido (diseño de Claude Design, adaptado al mundo real de la simulación).
// Todo en Canvas 2D y sin filtros por persona: el terreno se pinta una vez; cada persona es un solo drawImage de una
// hoja de sprites que se genera al cargar (8 culturas × niño/adulto × lleva comida × 2 fotogramas de paso).

export const PAL = {
  agua: { honda: '#1b3550', media: '#245273', orilla: '#2f6d8f', espuma: '#6fb3c9' },
  arena: { seca: '#c9b27a', mojada: '#a68f5e' },
  hierba: ['#6a9a3f', '#5f8d38', '#73a446', '#588432'],
  bosque: { suelo: '#3d6a2d', copa: '#2f5724', luz: '#4a7f33' },
  roca: ['#6e6b62', '#7d7a70', '#5c5951', '#8c897d'],
  baya: '#e0453a', veneno: '#8e44c9', hoja: '#3f7a2b', hojaSeca: '#4d5a33',
  piel: '#e9c39a', contorno: '#1a1410', lobo: '#8a8a8a', loboOscuro: '#5c5c5c',
  fx: { compartir: '#7ddf64', regalo: '#a8f08f', pelea: '#ff4d3d', nacer: '#ffe066', morir: '#ffffff', idea: '#ffd166', ideaNucleo: '#fff3c4' },
};

// Cada cultura: su color, el oscuro de su tocado y la silueta del tocado (se distingue por forma, no solo por color)
export const ESTILO = [
  { color: '#e4572e', oscuro: '#9a3416', marca: 'pluma', tejado: 'cono' },       // Kaori
  { color: '#2e86de', oscuro: '#1a5494', marca: 'cinta', tejado: 'plano' },      // Ulmen
  { color: '#28a745', oscuro: '#176a2b', marca: 'cuernos', tejado: 'cupula' },   // Tzaluk
  { color: '#f2b705', oscuro: '#a37a00', marca: 'punta', tejado: 'aguas' },      // Berrin
  { color: '#a05cc9', oscuro: '#653a84', marca: 'capucha', tejado: 'cupula' },   // Oshum
  { color: '#e8e8e8', oscuro: '#9a9a9a', marca: 'pelliza', tejado: 'aguas' },    // Varsk
  { color: '#ff8fab', oscuro: '#b85a74', marca: 'trenza', tejado: 'cono' },      // Quilla
  { color: '#2ec4b6', oscuro: '#1a7f76', marca: 'turbante', tejado: 'plano' },   // Azhar
];
const MARCAS = {
  pluma: ['.#..', '.##.'], cinta: ['....', '####'], cuernos: ['#..#', '.##.'], punta: ['..#.', '.##.'],
  capucha: ['.##.', '####'], pelliza: ['####', '####'], trenza: ['....', '.#.#'], turbante: ['.##.', '#..#'],
};

const hash = (x, y) => { let h = (x * 374761393 + y * 668265263) ^ 0x5bd1e995; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

/** El terreno entero, una vez, en una imagen (agua con tres profundidades y espuma, orilla de arena, hierba, bosque, roca). */
export function pintarTerreno(mundo, tam) {
  const W = mundo.ancho, H = mundo.alto, t = (x, y) => mundo.t(x, y);
  const c = document.createElement('canvas');
  c.width = W * tam; c.height = H * tam;
  const g = c.getContext('2d');
  const sub = Math.max(1, Math.round(tam / 3));
  const esAgua = (x, y) => x >= 0 && y >= 0 && x < W && y < H && t(x, y) === 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const k = t(x, y), px = x * tam, py = y * tam, h = hash(x, y);
    if (k === 0) {
      let cerca = 0;
      for (let dy = -2; dy <= 2 && cerca < 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx >= 0 && yy >= 0 && xx < W && yy < H && t(xx, yy) !== 0) { cerca = Math.max(cerca, Math.max(Math.abs(dx), Math.abs(dy)) === 1 ? 2 : 1); }
      }
      g.fillStyle = cerca === 2 ? PAL.agua.orilla : cerca === 1 ? PAL.agua.media : PAL.agua.honda;
      g.fillRect(px, py, tam, tam);
      if (cerca === 2 && h > 0.5) { g.fillStyle = PAL.agua.espuma; g.fillRect(px + sub * (((h * 3) | 0) % 3), py + sub, sub, Math.max(1, sub >> 1)); }
      else if (h > 0.93) { g.fillStyle = PAL.agua.orilla; g.fillRect(px + sub, py + sub * 2, sub * 2, Math.max(1, sub >> 1)); }
      continue;
    }
    let orilla = false;
    for (let dy = -1; dy <= 1 && !orilla; dy++) for (let dx = -1; dx <= 1; dx++) if (esAgua(x + dx, y + dy)) { orilla = true; break; }
    if (orilla) {
      g.fillStyle = h > 0.6 ? PAL.arena.seca : PAL.arena.mojada; g.fillRect(px, py, tam, tam);
      if (tam >= 6) { g.fillStyle = PAL.hierba[1]; g.fillRect(px + sub, py, sub, sub); }
      continue;
    }
    if (k === 1 && mundo.quemado && mundo.quemado.has(y * W + x)) {
      // bosque quemado: ceniza y tocones (volverá a crecer)
      g.fillStyle = h > 0.5 ? '#3b3530' : '#4a423a'; g.fillRect(px, py, tam, tam);
      if (tam >= 6) { g.fillStyle = '#1f1a16'; g.fillRect(px + sub, py + sub, sub, sub * 2); if (h > 0.7) { g.fillStyle = '#6a5d4c'; g.fillRect(px + sub * 2, py, sub, sub); } }
    } else if (k === 1 && mundo.lecho && mundo.lecho[y * W + x]) {
      // un lecho seco: tierra agrietada donde antes había agua
      g.fillStyle = h > 0.5 ? '#9c8358' : '#8a7350'; g.fillRect(px, py, tam, tam);
      if (tam >= 6) { g.fillStyle = '#6e5a3c'; g.fillRect(px + sub, py + sub, sub * 2, 1); g.fillRect(px + sub * 2, py, 1, sub * 2); }
    } else if (k === 1) {
      g.fillStyle = PAL.hierba[(h * 4) | 0]; g.fillRect(px, py, tam, tam);
      if (tam >= 6 && h > 0.8) { g.fillStyle = PAL.hierba[2]; g.fillRect(px + (sub * ((h * 10) | 0)) % (sub * 3), py + sub, sub, sub); }
    } else if (k === 2) {
      g.fillStyle = PAL.bosque.suelo; g.fillRect(px, py, tam, tam);
      const o = (((h * 3) | 0) * sub) % (tam - sub);
      g.fillStyle = PAL.bosque.copa; g.fillRect(px + o, py, sub * 2, sub * 2);
      g.fillStyle = PAL.bosque.luz; g.fillRect(px + o, py, sub, sub);
    } else if (mundo.elevacion && mundo.elevacion[y * W + x] > 0.86) {
      // las cumbres, nevadas
      g.fillStyle = h > 0.5 ? '#e8e4da' : '#d2cdc2'; g.fillRect(px, py, tam, tam);
      g.fillStyle = PAL.roca[1]; g.fillRect(px + (sub * ((h * 7) | 0)) % (sub * 3), py + (sub * ((h * 13) | 0)) % (sub * 3), sub, sub);
    } else {
      g.fillStyle = PAL.roca[(h * 4) | 0]; g.fillRect(px, py, tam, tam);
      if (tam >= 6) { g.fillStyle = h > 0.5 ? PAL.roca[3] : PAL.roca[2]; g.fillRect(px + (sub * ((h * 7) | 0)) % (sub * 3), py + (sub * ((h * 13) | 0)) % (sub * 3), sub, sub); }
    }
  }
  return c;
}

/** Un arbusto: verde con tres bayas (rojas, comida; moradas, veneno); sin fruta, solo hojas secas. */
export function pintarArbusto(g, px, py, tam, tipo, conFruta, color = null) {
  const s = Math.max(1, Math.round(tam / 3));
  g.fillStyle = conFruta ? PAL.hoja : PAL.hojaSeca; g.fillRect(px, py + s, tam, tam - s);
  if (!conFruta) return;
  g.fillStyle = color || (tipo === 2 ? PAL.veneno : PAL.baya);
  g.fillRect(px + s, py, s, s); g.fillRect(px, py + s * 2, s, s); g.fillRect(px + s * 2, py + s * 2, s, s);
}

export function pintarLobo(g, px, py, tam, paso) {
  const s = Math.max(1, Math.round(tam / 3));
  g.fillStyle = PAL.lobo; g.fillRect(px, py + s, tam + s, s * 2);
  g.fillStyle = PAL.loboOscuro; g.fillRect(px + tam, py, s, s);
  g.fillRect(px + (paso ? 0 : s), py + s * 3, s, s); g.fillRect(px + tam - (paso ? 0 : s), py + s * 3, s, s);
  g.fillStyle = PAL.fx.pelea; g.fillRect(px + tam, py + s, 1, 1);
}

/** Una persona de 6×8 (a 6 px por casilla): tocado de su cultura, cabeza, cuerpo de su color, piernas que andan. */
export function pintarPersona(g, px, py, tam, estilo, nino, lleva, paso) {
  const s = Math.max(1, tam / 6);
  const w = nino ? 3 : 4, hb = nino ? 1 : 2;
  const x = px + (tam - w * s) / 2;
  g.fillStyle = PAL.piel; g.fillRect(x + (nino ? 0.5 : 1) * s, py + 2 * s, 2 * s, hb * s);
  g.fillStyle = estilo.oscuro;
  const m = MARCAS[estilo.marca];
  for (let r = 0; r < 2; r++) for (let q = 0; q < 4; q++) if (m[r][q] === '#') g.fillRect(x + (q - (nino ? 0.5 : 0)) * s, py + r * s, s, s);
  g.fillStyle = estilo.color; g.fillRect(x, py + (2 + hb) * s, w * s, (nino ? 2 : 3) * s);
  g.fillStyle = PAL.contorno;
  const ly = py + (nino ? 5 : 7) * s;
  if (paso) { g.fillRect(x, ly, s, s); g.fillRect(x + (w - 1) * s, ly, s, s); }
  else { g.fillRect(x + s, ly, s, s); g.fillRect(x + (w - 2) * s, ly, s, s); }
  if (lleva) { g.fillStyle = PAL.baya; g.fillRect(x + w * s, py + (2 + hb) * s, s, s); }
}

/**
 * LA HOJA DE SPRITES: cada combinación (cultura, niño, lleva comida, paso) dibujada una vez en su lienzo de 8×8 a la
 * escala de la casilla. Dibujar a una persona es un drawImage.
 */
export function hojaDePersonas(tam) {
  const hoja = new Map();
  for (let c = 0; c < ESTILO.length; c++) for (const nino of [0, 1]) for (const lleva of [0, 1]) for (const paso of [0, 1]) {
    const lienzo = document.createElement('canvas');
    lienzo.width = Math.ceil(tam * 8 / 6); lienzo.height = Math.ceil(tam * 8 / 6);
    const g = lienzo.getContext('2d');
    pintarPersona(g, Math.round(tam / 6), 0, tam, ESTILO[c], !!nino, !!lleva, paso);
    hoja.set(clavePersona(c, nino, lleva, paso), lienzo);
  }
  return hoja;
}
export const clavePersona = (c, nino, lleva, paso) => ((c * 2 + nino) * 2 + lleva) * 2 + paso;

/** Anillo pixelado (sin arcos con antialias): los destellos y los halos. */
export function anillo(g, cx, cy, radio, color, grosor) {
  g.fillStyle = color;
  const n = Math.max(12, Math.round(radio * 2.5));
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    g.fillRect(Math.round(cx + Math.cos(a) * radio), Math.round(cy + Math.sin(a) * radio), grosor, grosor);
  }
}

/** Una choza de 12×12 (2×2 casillas): pared de tierra y el tejado de su cultura. En ruinas, gris y sin tejado entero. */
export function pintarChoza(g, px, py, tam, estilo, ruina) {
  const s = tam / 6, W = 12 * s;
  const pared = ruina ? '#5a5248' : '#8a6a44', paredOscura = ruina ? '#3e3830' : '#5e4529', puerta = '#2a1c10';
  g.fillStyle = pared; g.fillRect(px + s, py + 6 * s, W - 2 * s, 6 * s);
  g.fillStyle = paredOscura; g.fillRect(px + s, py + 11 * s, W - 2 * s, s);
  g.fillStyle = puerta; g.fillRect(px + 5 * s, py + 8 * s, 2 * s, 4 * s);
  if (ruina) { g.fillStyle = '#6e6b62'; g.fillRect(px + 2 * s, py + 5 * s, 3 * s, s); g.fillRect(px + 8 * s, py + 4 * s, 2 * s, 2 * s); return; }
  g.fillStyle = estilo.color;
  if (estilo.tejado === 'cono') {
    for (let r = 0; r < 6; r++) g.fillRect(px + (5.5 - r) * s, py + r * s, (2 * r + 1) * s, s);
    g.fillStyle = estilo.oscuro; g.fillRect(px + 5 * s, py, 2 * s, s);
  } else if (estilo.tejado === 'cupula') {
    g.fillRect(px + 2 * s, py + 2 * s, 8 * s, 5 * s); g.fillRect(px + 4 * s, py + s, 4 * s, s); g.fillRect(px + s, py + 4 * s, 10 * s, 3 * s);
    g.fillStyle = estilo.oscuro; g.fillRect(px + 2 * s, py + 6 * s, 8 * s, s);
  } else if (estilo.tejado === 'plano') {
    g.fillRect(px, py + 4 * s, W, 3 * s);
    g.fillStyle = estilo.oscuro; g.fillRect(px, py + 6 * s, W, s); g.fillRect(px + 2 * s, py + 2 * s, 2 * s, 2 * s); g.fillRect(px + 8 * s, py + 2 * s, 2 * s, 2 * s);
  } else {
    for (let r = 0; r < 5; r++) g.fillRect(px + (5.5 - r * 1.1) * s, py + (r + 1) * s, (2 * r * 1.1 + 1) * s, s);
    g.fillStyle = estilo.oscuro; g.fillRect(px + 5 * s, py, 2 * s, s); g.fillRect(px, py + 6 * s, W, s);
  }
}

/** Las chozas de cada cultura (y la ruina), dibujadas una vez. */
export function hojaDeChozas(tam) {
  const hoja = [];
  for (let c = 0; c <= ESTILO.length; c++) {
    const l = document.createElement('canvas');
    l.width = l.height = Math.ceil(tam * 2);
    pintarChoza(l.getContext('2d'), 0, 0, tam, ESTILO[c % ESTILO.length], c === ESTILO.length);
    hoja.push(l);
  }
  return hoja;   // la última es la ruina
}

/** Un ciervo de 6×4: pardo, con su cuerna. */
export function pintarCiervo(g, px, py, tam, paso) {
  const s = Math.max(1, Math.round(tam / 6));
  g.fillStyle = '#9a6b3c'; g.fillRect(px, py + 2 * s, 5 * s, 2 * s);
  g.fillStyle = '#7a5230'; g.fillRect(px + 4 * s, py + s, 2 * s, 2 * s);
  g.fillStyle = '#d9c39a'; g.fillRect(px + 5 * s, py, s, s); g.fillRect(px + 3 * s, py, s, s);
  g.fillStyle = '#4a3220'; g.fillRect(px + (paso ? 0 : s), py + 4 * s, s, s); g.fillRect(px + (paso ? 4 : 3) * s, py + 4 * s, s, s);
}

/** Una empalizada alrededor de una choza: postes de madera; más niveles, más postes y más altos. */
export function pintarEmpalizada(g, cx, cy, tam, nivel) {
  const r = tam * 2.2, n = 10 + nivel * 4, alto = 2 + nivel;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    if (Math.abs(a - Math.PI / 2) < 0.35) continue;   // la entrada, abajo
    const x = Math.round(cx + Math.cos(a) * r), y = Math.round(cy + Math.sin(a) * r * 0.8);
    g.fillStyle = '#5e4529'; g.fillRect(x, y - alto, 2, alto + 1);
    g.fillStyle = '#8a6a44'; g.fillRect(x, y - alto, 1, alto);
  }
}

/** Un perro: más pequeño y más claro que un lobo, con la cola alta. */
export function pintarPerro(g, px, py, tam, paso, collar) {
  const s = Math.max(1, Math.round(tam / 3));
  g.fillStyle = '#c9a26b'; g.fillRect(px, py + s, tam, s * 2 - 1);
  g.fillStyle = '#8a6a3e'; g.fillRect(px + tam - s, py, s, s + 1); g.fillRect(px - 1, py, 1, s);
  g.fillRect(px + (paso ? 0 : s), py + s * 3 - 1, s, s); g.fillRect(px + tam - s - (paso ? 0 : s), py + s * 3 - 1, s, s);
  if (collar) { g.fillStyle = collar; g.fillRect(px + tam - s - 1, py + s, 1, s); }
}

/**
 * Un estilo para un pueblo nacido de otro: el color de su origen girado en el círculo de colores, la misma marca (la
 * herencia se ve) y otro tejado.
 */
export function estiloHijo(madre, k) {
  const giro = (hex, g, luz) => {
    let r = parseInt(hex.slice(1, 3), 16) / 255, gg = parseInt(hex.slice(3, 5), 16) / 255, b = parseInt(hex.slice(5, 7), 16) / 255;
    const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), l = (mx + mn) / 2, d = mx - mn;
    let h = 0, s = 0;
    if (d) { s = d / (1 - Math.abs(2 * l - 1)); h = mx === r ? ((gg - b) / d) % 6 : mx === gg ? (b - r) / d + 2 : (r - gg) / d + 4; h *= 60; }
    h = (h + g + 360) % 360; s = Math.max(s, 0.45);
    const L = Math.min(0.75, Math.max(0.3, l * luz)), C = (1 - Math.abs(2 * L - 1)) * s, X = C * (1 - Math.abs(((h / 60) % 2) - 1)), m = L - C / 2;
    const [a, bb, c] = h < 60 ? [C, X, 0] : h < 120 ? [X, C, 0] : h < 180 ? [0, C, X] : h < 240 ? [0, X, C] : h < 300 ? [X, 0, C] : [C, 0, X];
    return '#' + [a, bb, c].map((v) => Math.round((v + m) * 255).toString(16).padStart(2, '0')).join('');
  };
  const g = (k % 2 ? 1 : -1) * (35 + 12 * (k >> 1));
  const tejados = ['cono', 'plano', 'cupula', 'aguas'];
  return { color: giro(madre.color, g, 1), oscuro: giro(madre.color, g, 0.6), marca: madre.marca, tejado: tejados[(tejados.indexOf(madre.tejado) + 1 + k) % 4] };
}
