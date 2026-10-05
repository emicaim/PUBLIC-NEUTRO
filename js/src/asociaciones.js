// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 FOKO SOFT (Emilio Martinez) — Neutro, https://github.com/emicaim/PUBLIC-NEUTRO
// ASOCIACIONES (memoria de sucesos) en JavaScript: la misma pieza que Asociaciones en la versión de Python.
// EXPERIMENTAL, como en Python: fuera de la especificación del núcleo hasta que demuestre una mejora medida. Mismas fórmulas:
//   - fuerza de A→B = juntos / raíz(veces de A · veces de B) (cuánto más de lo esperable van juntos)
//   - predicción: tras A se espera B durante una ventana; si no llega, sorpresa (baja el peso, no la previa)
//   - requisito(A, B) = qué parte de las veces que pasó B vino tras A, menos lo que pasaría por azar
// El tiempo (ahora) lo pone quien la usa, en la unidad que quiera, igual que la ventana.

export const UMBRAL_PREDICCION = 0.3;
export const CASTIGO_SORPRESA = 0.5;
export const UMBRAL_OLVIDO = 0.3;
export const DESCUENTO_INFERENCIA = 0.8;   // (una relación deducida A→B→C vale algo menos que el eslabón más débil)

export class Asociaciones {
  constructor(ventana, capacidad = 120, ventanaValencia = 80) {
    this.ventana = ventana;
    this.capacidad = capacidad;
    this.ventanaValencia = ventanaValencia;   // (valencia) cuánto después de un suceso se mira cómo quedó el cuerpo
    this.valencia = new Map();     // suceso → lo que empeora (+) o mejora (−) el cuerpo después, de media
    this.pendientes = [];          // [suceso, cuando, impulso entonces]
    this.impulso = null;
    this.vinculos = new Map();     // "A→B" → {a, b, peso, previa, veces}
    this.frecuencias = new Map();  // suceso → veces
    this.recientes = [];           // [suceso, cuando]
    this.esperando = [];           // [causa, efecto, hasta]
    this.cumplidas = 0;
    this.sorpresas = 0;
    this.ultimaSorpresa = null;
    this.tiempo = 0;
    this.ultimo = null;
  }

  _pasar(ahora) {
    if (this.ultimo !== null && ahora > this.ultimo) this.tiempo += ahora - this.ultimo;
    this.ultimo = ahora;
  }

  suceso(que, ahora) {
    if (this.impulso !== null) this.pendientes.push([que, ahora, this.impulso]);
    this._pasar(ahora);
    const cumplidas = [];   // (las expectativas que se cumplen, [causa, efecto]: se devuelven)
    for (let i = this.esperando.length - 1; i >= 0; i--) if (this.esperando[i][1] === que) { this.cumplidas++; cumplidas.push([this.esperando[i][0], que]); this.esperando.splice(i, 1); }
    this.recientes = this.recientes.filter(([, t]) => ahora - t <= this.ventana);
    for (const [antes, t] of this.recientes) {
      if (antes === que) continue;
      const k = `${antes}→${que}`;
      let v = this.vinculos.get(k);
      if (!v) this.vinculos.set(k, v = { a: antes, b: que, peso: 0, previa: 0, veces: 0 });
      v.peso += 1; v.previa += 1; v.veces += 1;
      // (CUÁNTO TARDA: el retardo típico de B tras A, media móvil; Gallistel y Gibbon, la medida del intervalo)
      v.retardo = v.retardo === undefined ? ahora - t : v.retardo * 0.8 + (ahora - t) * 0.2;
    }
    this.recientes.push([que, ahora]);
    this.frecuencias.set(que, (this.frecuencias.get(que) || 0) + 1);
    for (const v of this.vinculos.values()) {
      if (v.a !== que || v.veces < 2 || this.fuerza(v.a, v.b) < UMBRAL_PREDICCION) continue;
      if (this.esperando.some(([, e]) => e === v.b)) continue;
      this.esperando.push([que, v.b, ahora + this.ventana]);
    }
    return cumplidas;
  }

  vigilar(ahora) {
    this._pasar(ahora);
    const sorprendidos = [];
    for (let i = this.esperando.length - 1; i >= 0; i--) {
      const [causa, efecto, hasta] = this.esperando[i];
      if (ahora <= hasta) continue;
      this.esperando.splice(i, 1);
      this.sorpresas++;
      const v = this.vinculos.get(`${causa}→${efecto}`);
      if (v) v.peso = Math.max(0, v.peso - CASTIGO_SORPRESA);
      this.ultimaSorpresa = [causa, efecto];
      sorprendidos.push([causa, efecto]);
    }
    return sorprendidos;
  }

  fuerza(a, b) {
    const v = this.vinculos.get(`${a}→${b}`);
    if (!v) return 0;
    const fa = this.frecuencias.has(a) ? this.frecuencias.get(a) : 1, fb = this.frecuencias.has(b) ? this.frecuencias.get(b) : 1;
    return v.peso / Math.sqrt(Math.max(1, fa) * Math.max(1, fb));
  }

  /**
   * INFERENCIA TRANSITIVA (el hipocampo, Eichenbaum): si A lleva a B y B lleva a C (cada vínculo visto al menos dos veces
   * y con fuerza de predicción), A lleva a C aunque nunca se hayan visto juntos. La fuerza deducida es la del eslabón más
   * débil, rebajada; 0 si no hay cadena.
   */
  /**
   * APRENDER VIENDO A OTROS (el miedo por observación, Olsson y Phelps 2007): a otro le ha pasado `que` después de
   * `contexto`; cada suceso del contexto queda enlazado con `que` como si se hubiera vivido, con `peso`.
   */
  observar(contexto, que, peso = 0.5) {
    for (const antes of contexto) {
      if (antes === que) continue;
      const k = `${antes}→${que}`;
      let v = this.vinculos.get(k);
      if (!v) this.vinculos.set(k, v = { a: antes, b: que, peso: 0, previa: 0, veces: 0 });
      v.peso += peso; v.previa += peso; v.veces += peso;
    }
    this.frecuencias.set(que, (this.frecuencias.get(que) || 0) + peso);
  }

  /**
   * VALENCIA (la amígdala aprende lo que vale cada cosa por cómo queda el cuerpo después): de cada suceso de hace al menos
   * `ventanaValencia`, lo que cambió el impulso desde entonces se suma a su valencia (media móvil, 20 %).
   */
  sentir(impulso, ahora) {
    this.impulso = impulso;
    const quedan = [];
    for (const [que, cuando, antes] of this.pendientes) {
      if (ahora - cuando < this.ventanaValencia) { quedan.push([que, cuando, antes]); continue; }
      const v = this.valencia.has(que) ? this.valencia.get(que) : 0;
      this.valencia.set(que, v + 0.2 * ((impulso - antes) - v));
    }
    this.pendientes = quedan.slice(-400);
  }

  inferida(a, c) {
    if (a === c) return 0;   // (una cadena que vuelve al mismo suceso no deduce nada)
    let mejor = 0;
    for (const v of this.vinculos.values()) {
      if (v.a !== a || v.b === c || v.veces < 2) continue;
      const f1 = this.fuerza(a, v.b);
      if (f1 < UMBRAL_PREDICCION) continue;
      const w = this.vinculos.get(`${v.b}→${c}`);
      if (!w || w.veces < 2) continue;
      const f2 = this.fuerza(v.b, c);
      if (f2 < UMBRAL_PREDICCION) continue;
      mejor = Math.max(mejor, Math.min(f1, f2) * DESCUENTO_INFERENCIA);
    }
    return mejor;
  }

  requisito(a, b, minimoVeces = 2) {
    const v = this.vinculos.get(`${a}→${b}`);
    const vecesB = this.frecuencias.get(b) || 0;
    if (!v || v.veces < minimoVeces || vecesB <= 0) return 0;
    const tiempo = Math.max(this.ventana, this.tiempo);
    const azar = Math.min(1, (this.frecuencias.get(a) || 0) * this.ventana / tiempo);
    return Math.min(1, v.previa / vecesB) - azar;
  }

  espera(efecto) { return this.esperando.some(([, e]) => e === efecto); }

  masFuertes(n = 3) {
    return [...this.vinculos.values()].filter((v) => v.veces >= 2)
      .sort((x, y) => this.fuerza(y.a, y.b) - this.fuerza(x.a, x.b)).slice(0, n)
      .map((v) => ({ a: v.a, b: v.b, fuerza: this.fuerza(v.a, v.b), veces: v.veces }));
  }

  olvidar(olvido) {
    const f = Math.sqrt(olvido);
    for (const [k, v] of this.vinculos) {
      v.peso *= f; v.previa *= f;
      if (v.peso < UMBRAL_OLVIDO && v.previa < UMBRAL_OLVIDO) this.vinculos.delete(k);
    }
    for (const [k, v] of this.frecuencias) this.frecuencias.set(k, v * f);
    this.tiempo *= f;
    if (this.vinculos.size > this.capacidad) {
      const orden = [...this.vinculos].sort((x, y) => x[1].peso - y[1].peso);
      for (const [k] of orden.slice(0, this.vinculos.size - this.capacidad)) this.vinculos.delete(k);
    }
  }

  /** Copia lo que sabe otra memoria (para heredar la memoria de sucesos, con un factor: no todo se transmite). */
  heredarDe(otra, factor = 0.7) {
    for (const [k, v] of otra.vinculos) this.vinculos.set(k, { ...v, peso: v.peso * factor, previa: v.previa * factor });
    for (const [k, v] of otra.frecuencias) this.frecuencias.set(k, v * factor);
    this.tiempo = otra.tiempo * factor;
  }
}
