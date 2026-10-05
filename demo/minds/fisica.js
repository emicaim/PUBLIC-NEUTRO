// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 FOKO SOFT (Emilio Martinez) — Neutro, https://github.com/emicaim/PUBLIC-NEUTRO
// LA FÍSICA DEL MUNDO, a la escala de sus vidas: el sol calienta según la latitud y la estación; la temperatura sigue al
// sol con inercia (la altura enfría, el agua suaviza); el agua se evapora según el calor, el viento del oeste lleva el
// vapor, las nubes se forman donde el aire se satura (antes en los montes) y llueve; la lluvia empapa el suelo y llena
// o seca los lagos de su zona; con frío, el agua se hiela. Un océano que oscila (unos 7 años, como El Niño) cambia cuánto
// se evapora: de ahí salen las sequías y los años de lluvias, con señales antes (menos nubes, ríos más bajos).
//
// Todo en una rejilla gruesa (celdas de 8×8 casillas): barato, y suficiente para lo que una persona nota.

const CELDA = 8;
const ACTUALIZAR_CADA = 20;                 // ticks entre pasos de la física (12 por año)

export class Fisica {
  constructor(mundo, ticksPorAnio) {
    this.m = mundo;
    this.ticksPorAnio = ticksPorAnio;
    this.dt = ACTUALIZAR_CADA / ticksPorAnio; // (en años)
    const W = mundo.ancho, H = mundo.alto;
    this.cw = Math.ceil(W / CELDA); this.ch = Math.ceil(H / CELDA);
    const n = this.cw * this.ch;
    // lo fijo de cada celda: cuánta agua tiene, su altura media, su latitud
    this.fraccionAgua = new Float32Array(n); this.altura = new Float32Array(n); this.latitud = new Float32Array(n);
    this.recalcularSuelo();
    for (let c = 0; c < n; c++) this.latitud[c] = (Math.floor(c / this.cw) * CELDA + CELDA / 2) / H;   // 0 norte, 1 sur
    // lo que cambia
    this.temp = new Float32Array(n);        // °C
    this.vapor = new Float32Array(n);       // agua en el aire
    this.nube = new Float32Array(n);        // lo que sobra de vapor: nubes (0 a ~1)
    this.lluviaAhora = new Float32Array(n); // lo que llovió en el último paso
    this.suelo = new Float32Array(n).fill(0.5);   // humedad del suelo (0 a 1)
    this.lluviaAnio = new Float32Array(n);  // lo que lleva llovido en los últimos 12 pasos (ventana móvil)
    this.normal = new Float32Array(n);      // la lluvia normal de cada celda (media lenta)
    this.historia = Array.from({ length: 12 }, () => new Float32Array(n));
    this.k = 0;
    // EL OCÉANO: un oscilador con ruido (periodo ~7 años); su valor sube o baja la evaporación
    this.oceano = 0; this.oceanoV = 0;
    this.ciclo = mundo.azar() * Math.PI * 2;   // fase del ciclo solar
    this.ceniza = 0;                            // la ceniza de los volcanes: tapa el sol
    this.invernadero = 0;                       // los gases de los volcanes: calientan (se van despacio)
    this.hielo = new Uint8Array(W * H); this.hieloCambiado = false; this.nHielo = 0;
    for (let c = 0; c < n; c++) this.temp[c] = this.equilibrio(c, 0);
    // (unos años de arranque, sin el mundo, para que el clima se asiente y la lluvia normal salga de la física)
    const suma = new Float32Array(n);
    for (let i = 0; i < 12 * 14; i++) { this.paso(i * ACTUALIZAR_CADA, true); if (i >= 24 && i % 12 === 11) for (let c = 0; c < n; c++) suma[c] += this.lluviaAnio[c] / 12; }
    this.normal.set(suma);
  }

  /** La fracción de agua y la altura media de cada celda (otra vez si el terreno cambia mucho). */
  recalcularSuelo() {
    const m = this.m, W = m.ancho, H = m.alto;
    this.fraccionAgua.fill(0); this.altura.fill(0);
    const cuenta = new Float32Array(this.cw * this.ch);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const c = Math.floor(y / CELDA) * this.cw + Math.floor(x / CELDA), i = y * W + x;
      cuenta[c]++;
      if (m.terreno[i] === 0) this.fraccionAgua[c]++;
      this.altura[c] += m.elevacion[i];
    }
    for (let c = 0; c < cuenta.length; c++) { this.fraccionAgua[c] /= cuenta[c]; this.altura[c] /= cuenta[c]; }
  }

  celda(x, y) { return Math.min(this.ch - 1, Math.max(0, Math.floor(y / CELDA))) * this.cw + Math.min(this.cw - 1, Math.max(0, Math.floor(x / CELDA))); }

  /** 1º EL SOL: la energía que llega (1 de media). Más al sur y en verano; un ciclo solar de 11 años (±2 %); la ceniza la tapa. */
  sol(c, tick) {
    const dia = (tick % this.ticksPorAnio) / this.ticksPorAnio;               // 0 = empieza la primavera
    const estacion = Math.sin(2 * Math.PI * (dia - 0.125));                    // máximo en pleno verano
    const anio = tick / this.ticksPorAnio;
    const S = (1 + 0.02 * Math.sin(2 * Math.PI * anio / 11 + this.ciclo)) * (1 - 0.35 * this.ceniza);
    return S * (0.55 + 0.6 * this.latitud[c]) * (1 + 0.32 * estacion);
  }

  /** 3º LA TEMPERATURA DE EQUILIBRIO: el sol la sube; la altura la baja; el agua la acerca a la media (suaviza). */
  equilibrio(c, tick) {
    const gases = 6 * this.invernadero;
    const t = -26 + 42 * this.sol(c, tick) - 22 * Math.max(0, this.altura[c] - 0.5) + gases;
    const media = -26 + 42 * (0.55 + 0.6 * this.latitud[c]) * (1 - 0.35 * this.ceniza) - 22 * Math.max(0, this.altura[c] - 0.5) + gases;
    const suaviza = 0.55 * this.fraccionAgua[c];
    return t * (1 - suaviza) + media * suaviza;
  }

  /** La presión de saturación (Clausius-Clapeyron): cuánto vapor cabe en el aire; un 7 % más por grado. */
  saturacion(t, altura) { return 0.55 * Math.exp(0.068 * t) * (1 - 0.45 * Math.max(0, altura - 0.45)); }

  /** Un paso de la física (cada 20 ticks). */
  paso(tick, arranque = false) {
    const n = this.temp.length, cw = this.cw;
    // EL OCÉANO: oscila con ruido
    const w = 2 * Math.PI / 7;
    this.oceanoV += (-w * w * this.oceano - 0.25 * this.oceanoV) * this.dt + (this.m.azar() - 0.5) * 0.9 * Math.sqrt(this.dt);
    this.oceano += this.oceanoV * this.dt;
    this.oceano = Math.max(-1.6, Math.min(1.6, this.oceano));
    if (this.ceniza > 0) this.ceniza = Math.max(0, this.ceniza - 0.5 * this.dt);   // (la ceniza cae en un par de años)
    if (this.invernadero > 0) this.invernadero *= 1 - 0.03 * this.dt;               // (los gases, en décadas)
    const evaporaOceano = Math.max(0.2, 1 + 0.8 * this.oceano);
    // 3º temperatura, con inercia
    for (let c = 0; c < n; c++) this.temp[c] += (this.equilibrio(c, tick) - this.temp[c]) * 0.45;
    // 4º el agua: evaporación (del agua y, menos, del suelo húmedo), según el calor
    for (let c = 0; c < n; c++) {
      const calor = Math.max(0, 0.3 + 0.025 * this.temp[c]);
      this.vapor[c] += (this.fraccionAgua[c] * evaporaOceano + 0.25 * this.suelo[c]) * calor * 0.35;
    }
    // el viento del oeste lleva el vapor (por el borde oeste entra aire del océano)
    const nuevo = new Float32Array(n);
    for (let c = 0; c < n; c++) {
      const x = c % cw;
      const oeste = x > 0 ? this.vapor[c - 1] : 0.35 * evaporaOceano;
      nuevo[c] = 0.55 * this.vapor[c] + 0.45 * oeste;
    }
    this.vapor = nuevo;
    // las nubes y la lluvia: lo que no cabe en el aire
    const k = this.k % 12, viejo = this.historia[k];
    for (let c = 0; c < n; c++) {
      const sat = this.saturacion(this.temp[c], this.altura[c]);
      const sobra = Math.max(0, this.vapor[c] - sat);
      const llueve = 0.55 * sobra;
      this.vapor[c] -= llueve;
      this.nube[c] = Math.min(1.2, sobra * 1.6 + Math.max(0, this.vapor[c] / sat - 0.75));
      this.lluviaAhora[c] = llueve;
      // el suelo se empapa y se seca (más con calor)
      this.suelo[c] = Math.max(0, Math.min(1, this.suelo[c] + llueve * 1.5 - this.suelo[c] * Math.max(0.02, 0.012 * this.temp[c]) ));
      this.lluviaAnio[c] += llueve - viejo[c];
      viejo[c] = llueve;
    }
    this.k++;
    if (arranque) return;
    // la lluvia normal: una media lenta (unos 30 años)
    for (let c = 0; c < n; c++) this.normal[c] += (this.lluviaAnio[c] - this.normal[c]) * this.dt / 30;
    this.helar();
  }

  /** EL HIELO: el agua (no el mar abierto, salvo con mucho frío) se hiela bajo -2 °C y se deshiela sobre 0,5 °C. */
  helar() {
    const m = this.m, W = m.ancho, H = m.alto, T = m.terreno;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (T[i] !== 0) { if (this.hielo[i]) { this.hielo[i] = 0; this.nHielo--; this.hieloCambiado = true; } continue; }
      const t = this.temp[this.celda(x, y)] - 18 * Math.max(0, m.elevacion[i] - 0.7);
      const umbral = m.mar[i] ? -9 : -2;
      if (!this.hielo[i] && t < umbral) { this.hielo[i] = 1; this.nHielo++; this.hieloCambiado = true; }
      else if (this.hielo[i] && t > 0.5) { this.hielo[i] = 0; this.nHielo--; this.hieloCambiado = true; if (this.deshielos) this.deshielos.push(i); }
    }
  }

  /** La temperatura de una casilla (la altura de la casilla, además de la de su celda, enfría). */
  temperatura(x, y) {
    const i = Math.max(0, Math.min(this.m.alto - 1, y)) * this.m.ancho + Math.max(0, Math.min(this.m.ancho - 1, x));
    return this.temp[this.celda(x, y)] - 18 * Math.max(0, this.m.elevacion[i] - 0.7);
  }

  /** Lo que ha llovido este último año en su zona, frente a lo normal (1 = lo de siempre). */
  humedadLocal(x, y) { const c = this.celda(x, y); return this.normal[c] > 0.01 ? this.lluviaAnio[c] / this.normal[c] : 1; }

  /** Lo mismo para todo el mundo con gente (la media de las celdas de tierra). */
  humedadMundo() {
    let a = 0, b = 0;
    for (let c = 0; c < this.temp.length; c++) if (this.fraccionAgua[c] < 0.9) { a += this.lluviaAnio[c]; b += this.normal[c]; }
    return b > 0 ? a / b : 1;
  }

  /** Para las medidas y la vista: la temperatura media de la tierra, cuánto llueve y el océano. */
  resumen() {
    let t = 0, nubes = 0, nt = 0;
    for (let c = 0; c < this.temp.length; c++) if (this.fraccionAgua[c] < 0.9) { t += this.temp[c]; nubes += this.nube[c]; nt++; }
    return { ceniza: +this.ceniza.toFixed(2), invernadero: +this.invernadero.toFixed(2), temperatura: +(t / nt).toFixed(1), nubes: +(nubes / nt).toFixed(2), lluvia: +this.humedadMundo().toFixed(2), oceano: +this.oceano.toFixed(2), hielo: this.nHielo };
  }
}

export const FISICA_CELDA = CELDA;
export const FISICA_CADA = ACTUALIZAR_CADA;
