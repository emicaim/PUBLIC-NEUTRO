// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 FOKO SOFT (Emilio Martinez) — Neutro, https://github.com/emicaim/PUBLIC-NEUTRO
//
// EJEMPLO MÍNIMO: una criatura con hambre y un lobo. Nadie le dice que comer es bueno ni que hay que huir del lobo:
// lo aprende por cómo queda su cuerpo después de cada cosa (recompensa homeostática).
//
//     node ejemplos/minimo.mjs
import { Nucleo } from '../js/index.js';

// 1. LA PERCEPCIÓN: qué concepto es cada situación y cuáles no merecen neurona propia
const percepcion = {
  nombrar: (situacion) => situacion,            // aquí la situación ya es el concepto
  tranquila: (situacion) => situacion === 'calma',
};

// 2. EL CEREBRO: las acciones posibles (la primera es la de reposo)
const cerebro = new Nucleo(percepcion, { acciones: ['esperar', 'comer', 'huir'], porConcepto: true });

// 3. EL MUNDO: una semilla fija para que el resultado se repita
let semilla = 7;
const azar = () => { semilla = Number((BigInt(semilla) * 1103515245n + 12345n) % 2147483648n); return semilla / 2147483648; };   // (enteros exactos: igual que en Python)
let hambre = 0, dolor = 0, mordiscos = 0, comidas = 0;
const impulso = () => Math.sqrt(hambre * hambre + dolor * dolor);   // lo lejos que está el cuerpo de estar bien

for (let paso = 1; paso <= 3000; paso++) {
  const situacion = azar() < 0.25 ? 'lobo cerca' : hambre > 0.3 ? 'hambre' : 'calma';
  let [accion] = cerebro.decidirSituacion(situacion, true, () => '');
  // CURIOSIDAD: a veces prueba otra cosa (el núcleo no explora por sí solo; eso lo pone quien lo usa).
  // Se anota en el historial lo que de verdad hizo, para que aprenda de eso.
  if (azar() < 0.05) {
    accion = cerebro.acciones[Math.floor(azar() * cerebro.acciones.length)];
    cerebro.historial[cerebro.historial.length - 1][2] = accion;
  }

  // lo que pasa en el mundo (el cerebro no ve estas reglas)
  hambre = Math.min(1, hambre + 0.04);
  dolor = Math.max(0, dolor - 0.1);
  if (situacion === 'lobo cerca' && accion !== 'huir') { dolor = Math.min(1, dolor + 0.5); mordiscos++; }
  if (situacion === 'hambre' && accion === 'comer') { hambre = Math.max(0, hambre - 0.5); comidas++; }

  // lo que siente el cuerpo, y la lección
  // (cada lección cubre lo vivido desde la anterior: después se vacía el historial)
  const r = cerebro.sentir(impulso());
  if (r > 0) { cerebro.consolidar(0); cerebro.reiniciarEstadisticas(); }          // alivio: lo que hizo estuvo bien
  else if (r < 0) { cerebro.aprenderDeFracaso(); cerebro.reiniciarEstadisticas(); } // malestar: lo que hizo estuvo mal

  if (paso % 500 === 0) {
    console.log(`pasos ${paso - 499}-${paso}: ${mordiscos} mordiscos, ${comidas} comidas`);
    mordiscos = comidas = 0;
  }
}

console.log('\nLo que ha aprendido:');
for (const [situacion, neurona] of cerebro.neuronas) console.log(`  ${situacion} -> ${neurona.accion}`);
