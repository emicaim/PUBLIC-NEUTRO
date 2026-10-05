// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 FOKO SOFT (Emilio Martinez) — Neutro, https://github.com/emicaim/PUBLIC-NEUTRO
// OTRAS MENTES, para comparar con Neutro en el mismo mundo: la misma percepción (la situación en símbolos), las mismas
// acciones y las mismas recompensas (acierto y fallo, en los mismos momentos). Solo cambia cómo deciden y aprenden.
// Tienen la misma forma que el núcleo de Neutro (decidirSituacion, aprenderDeFracaso, consolidar, historial...), así
// que el mundo no sabe qué cerebro lleva cada uno.
//
//   - MenteInstinto: no aprende nada; hace lo que haría cualquiera (las reglas fijas de las simulaciones clásicas).
//   - MenteAzar: en cada decisión, una acción cualquiera; no aprende. El suelo.
//   - MenteQ: aprendizaje por refuerzo clásico, Q-learning tabular con trazas: una tabla situación × acción con lo
//     que se espera de cada acción, que se corrige con cada recompensa (y con lo que se espera después).

/** Lo común: el historial del episodio (desde la última lección), como en el núcleo de Neutro. */
class MenteBase {
  constructor(acciones) {
    this.acciones = [...acciones];
    this.neuronas = new Map();   // (no tienen neuronas de concepto: el mundo ve un mapa vacío)
    this.reiniciarEstadisticas();
  }
  reiniciarEstadisticas() { this.historial = []; }
  /** La misma recompensa interna que Neutro (homeostática): 1 si el impulso bajó de golpe, -1 si subió, 0 si no. */
  sentir(impulso, umbral = 0.04) { const previo = this._impulso ?? null; this._impulso = impulso; if (previo === null) return 0; const r = previo - impulso; return r >= umbral ? 1 : r <= -umbral ? -1 : 0; }
  aprenderDeFracaso() {}
  consolidar() {}
  /** El tamaño de su memoria, en números guardados (para comparar lo que ocupa cada mente). */
  memoria() { return 0; }
}

export class MenteInstinto extends MenteBase {
  decidirSituacion(situacion) {
    this.historial.push([situacion, true, 'instinto']);
    return ['instinto', null];
  }
}

export class MenteAzar extends MenteBase {
  constructor(acciones, azar) { super(acciones); this.azar = azar; }
  decidirSituacion(situacion) {
    const a = this.acciones[Math.floor(this.azar() * this.acciones.length)];
    this.historial.push([situacion, true, a]);
    return [a, null];
  }
}

/**
 * Q-LEARNING TABULAR CON TRAZAS. Q[situación][acción] = lo que espera ganar. Decide la acción de más valor (empate: el
 * instinto, como Neutro sin neurona). Al llegar una recompensa (+1 acierto, −1 fallo), corrige las decisiones del
 * episodio, la última la que más (traza λ); y en cada decisión, la anterior se acerca a lo que se espera de la nueva
 * (γ · max Q). Explora igual que Neutro: lo pone el mundo, no la mente.
 */
export class MenteQ extends MenteBase {
  constructor(acciones, { alfa = 0.2, gamma = 0.9, lambda = 0.8 } = {}) {
    super(acciones);
    this.q = new Map();   // situación → Float32Array(acciones)
    this.alfa = alfa; this.gamma = gamma; this.lambda = lambda;
    this.indice = new Map(this.acciones.map((a, i) => [a, i]));
  }
  fila(s) { let f = this.q.get(s); if (!f) { f = new Float32Array(this.acciones.length); this.q.set(s, f); } return f; }
  decidirSituacion(situacion) {
    const f = this.fila(situacion);
    let mejor = 0;
    for (let i = 1; i < f.length; i++) if (f[i] > f[mejor]) mejor = i;
    // (lo que espera de esta situación enseña a la decisión anterior: el aprendizaje por diferencias de Q-learning)
    const prev = this.historial[this.historial.length - 1];
    if (prev) {
      const fp = this.fila(prev[0]), ip = this.indice.get(prev[2]) ?? 0;
      fp[ip] += this.alfa * (this.gamma * f[mejor] - fp[ip]);
    }
    const a = this.acciones[mejor];
    this.historial.push([situacion, true, a]);
    return [a, null];
  }
  recompensar(r) {
    let traza = 1;
    for (let k = this.historial.length - 1; k >= 0 && traza > 0.01; k--) {
      const [s, , a] = this.historial[k];
      const f = this.fila(s), i = this.indice.get(a) ?? 0;
      f[i] += this.alfa * traza * (r - f[i]);
      traza *= this.lambda * this.gamma;
    }
  }
  aprenderDeFracaso() { this.recompensar(-1); }
  decepcionar() { this.recompensar(-0.3); }   // (la misma señal que recibe Neutro: una recompensa esperada que no llega)
  /** El mismo repaso que Neutro: cada (situación, acción) de hace tiempo se acerca a +peso o a −peso. */
  /** Las mismas metas sostenidas que Neutro: cada tramo cubierto, una recompensa (+1). */
  fijarMeta(nombre) { if (!this.meta || this.meta.nombre !== nombre) this.meta = { nombre, tramos: 0 }; }
  soltarMeta() { this.meta = null; }
  avanzarMeta(f) { if (!this.meta) return 0; const k = Math.floor(Math.min(1, Math.max(0, f)) / 0.2 + 1e-9); if (k > this.meta.tramos) { this.meta.tramos = k; return 1; } if (k < this.meta.tramos) this.meta.tramos = k; return 0; }
  repasar(entradas, exito, peso = 1) { for (const [s, a] of entradas) { const f = this.fila(s), i = this.indice.get(a) ?? 0; f[i] += this.alfa * ((exito ? 1 : -1) * peso - f[i]); } return 0; }
  consolidar() { this.recompensar(1); }
  memoria() { return this.q.size * this.acciones.length; }
}

/**
 * MenteReglas: lo que escribiría a mano un programador que conoce este mundo (el rival de verdad: las simulaciones
 * clásicas de sociedades artificiales funcionan así). Lee la misma situación en símbolos y no aprende nada:
 * huir del lobo y del enemigo, no comer moradas, beber con sed, comer con hambre (bayas, si no pescar), buscar carne
 * cuando falta (cazar o pescar), fruta cuando falta, volver a casa con frío o cansado de noche, y si todo va bien,
 * recoger bayas.
 */
export class MenteReglas extends MenteBase {
  decidirSituacion(s) {
    const [nec, r, m, a, l, , x, c, , z, v] = s.split(' ');
    const cerca = (t) => t && (t[1] === '1' || t[1] === '2');
    const hay = (t) => t && t[1] !== '0';
    let acc = 'instinto';
    if (cerca(l) || (v && v[1] === 'l') || (x && x[2] === 'e' && cerca(x))) acc = 'evitar';
    else if (m && m[1] === '1') acc = 'buscar_roja';
    else if (nec === 's') acc = 'instinto';                       // (el instinto ya va al agua)
    else if (nec === 'h') acc = hay(r) ? 'buscar_roja' : hay(a) ? 'pescar' : 'instinto';
    else if (nec === 'f') acc = z && z[3] === '1' ? 'dormir' : 'volver';
    else if (z && z[1] === '1' && z[2] === '1') acc = z[3] === '1' ? 'dormir' : 'volver';
    else if (nec === 'p') acc = cerca(c) ? 'cazar' : hay(a) ? 'pescar' : 'instinto';
    else if (nec === 'v') acc = 'buscar_roja';
    else if (hay(r)) acc = 'buscar_roja';
    this.historial.push([s, true, acc]);
    return [acc, null];
  }
}
