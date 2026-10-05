// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 FOKO SOFT (Emilio Martinez) — Neutro, https://github.com/emicaim/PUBLIC-NEUTRO
// PRUEBA CRUZADA de «aprender por concepto» (la gemela de pruebas/cruzado.py): misma secuencia, misma salida.
import { Nucleo } from '../js/src/nucleo.js';

const percepcion = { nombrar: (s) => s.split(' ')[0], tranquila: (s) => s.startsWith('calma') };
let estado = 12345;
const azar = (n) => { estado = Number((BigInt(estado) * 1103515245n + 12345n) % 2147483648n); return estado % n; };
const acciones = ['instinto', 'evitar', 'atacar', 'comer', 'esperar'];
const r9 = (v) => Math.round(v * 1e5) / 1e5;
for (const opciones of [{ porConcepto: true }, { porConcepto: true, generalizar: true, prudencia: { lobo: ['evitar', 'atacar'] } }]) {
  const n = new Nucleo(percepcion, { acciones, ...opciones });
  const conceptos = ['lobo', 'hambre', 'calma', 'bayas'];
  const salida = [];
  for (let paso = 0; paso < 6000; paso++) {
    const s = `${conceptos[azar(4)]} x${azar(6)} y${azar(3)}`;
    const [accion] = n.decidirSituacion(s, azar(10) > 0, () => azar(5));
    salida.push(accion);
    salida.push('S' + n.sentir(azar(100) / 100));
    const r2 = azar(50);
    if (r2 === 0) n.fijarMeta(['reserva', 'otra'][azar(2)]);
    else if (r2 === 1) n.soltarMeta();
    else salida.push('M' + n.avanzarMeta(azar(101) / 100));
    const r = azar(100);
    if (r < 4) {
      const res = n.aprenderDeFracaso(null);
      salida.push('F' + (res === null ? 'null' : res.join('|')));
      n.reiniciarEstadisticas();
    } else if (r < 10) {
      n.consolidar(azar(3));
      n.reiniciarEstadisticas();
    } else if (r < 14 && opciones.generalizar) {
      salida.push('D' + (n.decepcionar() ?? 'None'));
      n.reiniciarEstadisticas();
    } else if (r < 16 && opciones.generalizar) {
      const entradas = [];
      for (let k = 0; k < 3; k++) { const c = conceptos[azar(4)], x = azar(6), y = azar(3); entradas.push([`${c} x${x} y${y}`, acciones[azar(5)]]); }
      const exito = azar(2) === 1;
      salida.push('R' + n.repasar(entradas, exito, 0.5));
      n.reiniciarEstadisticas();
    }
  }
  console.log(salida.join(' '));
  const ord = (o) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  const m = {}; for (const [c, v] of [...n.miedos].sort(([a], [b]) => (a < b ? -1 : 1))) m[c] = Object.fromEntries(Object.entries(ord(v)).map(([a, x]) => [a, r9(x)]));
  console.log(JSON.stringify(m).replace(/,/g, ', ').replace(/:/g, ': '));
  const k = {}; for (const [s, v] of [...n.neuronas].sort(([a], [b]) => (a < b ? -1 : 1))) k[s] = v.accion;
  console.log(JSON.stringify(k).replace(/,/g, ', ').replace(/:/g, ': '));
}

{
  const { Asociaciones } = await import('../js/src/asociaciones.js');
  const a = new Asociaciones(10, 40);
  let estado = 777;
  const sucesos = ['lluvia', 'langosta', 'hambre', 'calma', 'frio', 'fuego'];
  const salida = [];
  for (let t = 0; t < 3000; t++) {
    estado = Number((BigInt(estado) * 1103515245n + 12345n) % 2147483648n);
    const c = a.suceso(sucesos[estado % 6], t);
    if (c.length) salida.push('C' + c.map(([x, y]) => `${x}>${y}`).join('/'));
    a.sentir((estado % 97) / 97, t);
    if (t % 7 === 0) a.observar([sucesos[Math.floor(estado / 7) % 6], sucesos[Math.floor(estado / 11) % 6]], sucesos[Math.floor(estado / 13) % 6], 0.5);
    if (t % 50 === 0) { a.vigilar(t); salida.push(`${((a.vinculos.get('lluvia→hambre') || {}).retardo || 0).toFixed(6)}|${(a.valencia.get('langosta') || 0).toFixed(6)}|${a.inferida('lluvia', 'hambre').toFixed(6)}|${a.inferida('frio', 'fuego').toFixed(6)}|${a.inferida('calma', 'langosta').toFixed(6)}`); }
  }
  console.log(salida.join(' '));
}
