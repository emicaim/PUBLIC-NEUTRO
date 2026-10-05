// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 FOKO SOFT (Emilio Martinez) — Neutro, https://github.com/emicaim/PUBLIC-NEUTRO
// LA GEOLOGÍA DEL MUNDO: volcanes en los montes más altos y una falla que cruza el mapa.
//
// VOLCANES: la presión sube cada año; cuando ya es alta, la tierra tiembla y sale humo (unas señales que se pueden
// aprender: los temblores son un suceso en la memoria de quien los siente). Al reventar: quema y mata alrededor, la lava
// se hace roca (también sobre el agua: tierra nueva), destruye hogueras, despensas y empalizadas; la ceniza sube al
// cielo y tapa el sol (uno o dos años más fríos: la física lo nota) y los gases calientan un poco durante décadas. Con
// los años, la ceniza deja la tierra más fértil que antes.
//
// TERREMOTOS: a lo largo de la falla, sin aviso (como en la realidad: no hay señal fiable). Hieren, tiran empalizadas y
// despensas, y a veces abren un manantial.

export class Geologia {
  constructor(m) {
    this.m = m;
    const W = m.ancho, H = m.alto;
    this.fertil = new Float32Array(W * H);   // lo que la ceniza abona (0 a 1; se pierde despacio)
    // los volcanes: las rocas más altas, separadas
    const rocas = [];
    for (let i = 0; i < W * H; i++) if (m.terreno[i] === 3 && m.elevacion[i] > 0.74) rocas.push(i);
    rocas.sort((a, b) => m.elevacion[b] - m.elevacion[a] || a - b);
    this.volcanes = [];
    for (const i of rocas) {
      const x = i % W, y = (i / W) | 0;
      if (x < 6 || y < 6 || x >= W - 6 || y >= H - 6) continue;   // (no en el borde del mapa)
      if (this.volcanes.some((v) => Math.hypot(v.x - x, v.y - y) < 45)) continue;
      // (la presión de arranque, al azar: así no revientan todos a la vez ni nada más empezar)
      this.volcanes.push({ x, y, presion: m.azar() * 0.6, ritmo: 0.008 + m.azar() * 0.014, erupciones: 0, ultima: null, humo: false });
      if (this.volcanes.length >= 3) break;
    }
    // la falla: una recta entre dos bordes
    const a = [m.azar() * W, 0], b = [m.azar() * W, H - 1];
    if (m.azar() < 0.5) { a[0] = 0; a[1] = m.azar() * H; b[0] = W - 1; b[1] = m.azar() * H; }
    this.falla = [a, b];
    this.terremotos = 0; this.erupciones = 0; this.temblores = 0;
  }

  /** Cada año: la presión sube; la tierra fértil pierde un poco; quizá un terremoto en la falla. */
  anual() {
    const m = this.m;
    for (let i = 0; i < this.fertil.length; i++) {
      if (!this.fertil[i]) continue;
      this.fertil[i] = this.fertil[i] < 0.02 ? 0 : this.fertil[i] * 0.96;
      // (en la tierra abonada por la ceniza brotan arbustos nuevos)
      if (m.terreno[i] === 1 && !m.baya[i] && !m.quemado.has(i) && m.azar() < 0.03 * this.fertil[i]) { m.apuntarArbusto(i); m.baya[i] = 1; m.fruta[i] = 2; }
    }
    for (const v of this.volcanes) {
      v.presion += v.ritmo * (0.5 + m.azar());
      v.humo = v.presion > 0.8;
      if (v.presion >= 1) this.erupcion(v);
    }
    if (m.azar() < 0.12) {
      const t = m.azar(), [[x1, y1], [x2, y2]] = this.falla;
      this.terremoto(Math.round(x1 + (x2 - x1) * t), Math.round(y1 + (y2 - y1) * t), 0.3 + m.azar() * 0.7);
    }
  }

  /** Cada paso de la física: si un volcán está a punto, la tierra tiembla a su alrededor (lo nota quien está cerca). */
  paso() {
    const m = this.m;
    for (const v of this.volcanes) {
      if (!v.humo || m.azar() > 0.35) continue;
      this.temblores++;
      m.efecto('temblor', v.x, v.y);
      m.nombrarSuceso('e:temblor', v.x, v.y, 20);
      for (const q of m.cercanos(v.x, v.y, 20)) if (q.vivo && !q.dormido) { q.asoc.suceso('temblor', m.tick); q.temblorDe = { x: v.x, y: v.y, tick: m.tick }; }
      m.primeraVez(`humo-${v.x},${v.y}`, `La montaña ${m.describirSitio(v.x, v.y)} echa humo y la tierra tiembla a su alrededor.`, 'clima');
    }
  }

  erupcion(v) {
    const m = this.m, W = m.ancho, T = m.terreno;
    const fuerza = 0.5 + m.azar() * 0.8, r = Math.round(3 + 3 * fuerza);
    let muertos = 0, heridos = 0, roca = 0, quemadas = 0;
    for (let y = v.y - r; y <= v.y + r; y++) for (let x = v.x - r; x <= v.x + r; x++) {
      if (x < 0 || y < 0 || x >= W || y >= m.alto) continue;
      const d = Math.hypot(x - v.x, y - v.y); if (d > r) continue;
      const i = y * W + x;
      if (d <= r * 0.45) {
        // (la lava se hace roca: también sobre el agua, que se convierte en tierra nueva)
        if (T[i] !== 3) { T[i] = 3; m.elevacion[i] = Math.max(m.elevacion[i], 0.72); m.baya[i] = 0; m.fruta[i] = 0; if (m.mar[i]) m.mar[i] = 0; roca++; }
      } else if (T[i] === 2 || T[i] === 1) {
        if (T[i] === 2) quemadas++;
        T[i] = 1; m.quemado.set(i, m.anio + 6 + m.azar.entero(6)); m.fruta[i] = 0;
      }
      const k = `${x},${y}`;
      m.despensas.delete(k); m.fuertes.delete(k); m.hogueras.delete(k);
    }
    if (m.destruirRefugios) m.destruirRefugios(v.x, v.y, r, 1, true);
    for (const q of m.cercanos(v.x, v.y, r)) {
      const d = Math.max(Math.abs(q.x - v.x), Math.abs(q.y - v.y));
      m.herir(q, d <= r * 0.5 ? 999 : 45 * fuerza, 'fuego'); heridos++; if (!q.vivo) muertos++;
    }
    // la ceniza: fértil alrededor (más cerca, más), y al cielo
    for (let y = v.y - r * 3; y <= v.y + r * 3; y++) for (let x = v.x - r * 3; x <= v.x + r * 3; x++) {
      if (x < 0 || y < 0 || x >= W || y >= m.alto) continue;
      const d = Math.hypot(x - v.x, y - v.y); if (d > r * 3 || d <= r * 0.45) continue;
      const i = y * W + x; this.fertil[i] = Math.max(this.fertil[i], fuerza * (1 - d / (r * 3)));
    }
    if (m.fisica) { m.fisica.ceniza = Math.min(1, m.fisica.ceniza + 0.6 * fuerza); m.fisica.invernadero = (m.fisica.invernadero || 0) + 0.12 * fuerza; }
    for (const q of m.cercanos(v.x, v.y, 30)) { if (!q.vivo) continue; q.asoc.suceso('erupción', m.tick); m.temer(q); }
    for (const q of m.personas) if (q.huyoDe === `${v.x},${v.y}`) q.huyoDe = null;
    v.presion = 0; v.humo = false; v.erupciones++; v.ultima = m.anio; this.erupciones++;
    m.terrenoCambiado = true; m.cercaniaSucia = true; m.calorSucio = true;
    if (m.fisica) m.fisica.recalcularSuelo();
    m.efecto('volcan', v.x, v.y);
    m.nombrarSuceso('e:volcan', v.x, v.y, 30);
    m.ultimoDesastre = { tipo: 'volcan', x: v.x, y: v.y, anio: m.anio };
    m.anotar(`Revienta el volcán ${m.describirSitio(v.x, v.y)}: ${heridos ? `${heridos} personas alcanzadas${muertos ? ` (${muertos} mueren)` : ''}` : 'sin nadie cerca'}, ${quemadas} casillas de bosque ardidas${roca ? `, ${roca} de lava hecha roca` : ''}. La ceniza oscurece el cielo.`, 'clima');
  }

  terremoto(x, y, magnitud) {
    const m = this.m, R = Math.round(6 + 10 * magnitud);
    let heridos = 0, muertos = 0, caidas = 0;
    for (const q of m.cercanos(x, y, R)) {
      const d = Math.max(Math.abs(q.x - x), Math.abs(q.y - y));
      const dano = 30 * magnitud * (1 - d / (R + 1)) * (m.fortificado && m.fortificado(q) ? 1.5 : 1);   // (dentro de una empalizada, le cae encima)
      if (dano < 3) continue;
      m.herir(q, dano, 'caida'); heridos++; if (!q.vivo) muertos++;
      q.asoc.suceso('terremoto', m.tick);
    }
    caidas += m.destruirRefugios ? m.destruirRefugios(x, y, Math.round(R * 0.6), magnitud * 0.7) : 0;
    for (const mapa of [m.fuertes, m.despensas]) for (const k of [...mapa.keys()]) {
      const [hx, hy] = k.split(',').map(Number);
      if (Math.max(Math.abs(hx - x), Math.abs(hy - y)) <= R * 0.6 && m.azar() < magnitud) { mapa.delete(k); caidas++; }
    }
    // (a veces se abre un manantial: un poco de agua nueva en la tierra)
    let manantial = false;
    if (m.azar() < 0.3) for (let k = 0; k < 30 && !manantial; k++) {
      const xx = x + m.azar.entero(9) - 4, yy = y + m.azar.entero(9) - 4;
      if (!m.pisable(xx, yy) || m.cercanos(xx, yy, 1).length) continue;
      m.terreno[yy * m.ancho + xx] = 0; m.baya[yy * m.ancho + xx] = 0; manantial = true;
      m.terrenoCambiado = true; m.cercaniaSucia = true;
    }
    this.terremotos++;
    m.efecto('terremoto', x, y);
    if (heridos || caidas || manantial || magnitud > 0.7)
      m.anotar(`Tiembla la tierra ${m.describirSitio(x, y)}${heridos ? `: ${heridos} heridos${muertos ? ` (${muertos} mueren)` : ''}` : ''}${caidas ? `, ${caidas} empalizadas o despensas caídas` : ''}${manantial ? '; se abre un manantial' : ''}.`, 'clima');
  }

  resumen() { return { erupciones: this.erupciones, terremotos: this.terremotos, temblores: this.temblores, volcanes: this.volcanes.length }; }
}
