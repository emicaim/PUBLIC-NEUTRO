// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 FOKO SOFT (Emilio Martinez) — Neutro, https://github.com/emicaim/PUBLIC-NEUTRO
// EL MUNDO SIN PANTALLA: para medir. Corre N años y cuenta lo que pasó.
//
//     node web/mundo/simular.mjs --anios 200 --semilla 1            con cultura (heredar y enseñar)
//     node web/mundo/simular.mjs --anios 200 --semilla 1 --sin-cultura
import { Mundo, TICKS_POR_ANIO } from './mundo.js';

const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };
const anios = +arg('--anios', 100), semilla = +arg('--semilla', 1), cultura = !process.argv.includes('--sin-cultura');
const copia = arg('--copia', 'prestigio');   // prestigio | exito | mayoria
const gobierno = arg('--gobierno', 'banda'), reparto = arg('--reparto', 'familia');
const apego = !process.argv.includes('--sin-apego'), exploradores = !process.argv.includes('--sin-exploradores'), prudencia = !process.argv.includes('--sin-prudencia'), porConcepto = !process.argv.includes('--sin-concepto'), fisica = !process.argv.includes('--sin-fisica'), senales = !process.argv.includes('--sin-senales'), geologia = !process.argv.includes('--sin-geologia'), biologia = !process.argv.includes('--sin-vida'), contar = !process.argv.includes('--sin-contar'), aguaSucia = !process.argv.includes('--sin-agua-sucia'), plantas = !process.argv.includes('--sin-plantas'), manadas = !process.argv.includes('--sin-manadas'), pudrir = !process.argv.includes('--sin-pudrir'), mareas = !process.argv.includes('--sin-mareas'), langostas = !process.argv.includes('--sin-langostas'), inferencia = !process.argv.includes('--sin-inferencia'), decepcion = !process.argv.includes('--sin-decepcion'), repaso = !process.argv.includes('--sin-repaso'), dibujos = !process.argv.includes('--sin-dibujos'), contrafactual = !process.argv.includes('--sin-contrafactual'), refugios = !process.argv.includes('--sin-refugios'), homeostasis = !process.argv.includes('--sin-homeostasis'), conductasAMano = process.argv.includes('--a-mano'), prediccion = !process.argv.includes('--sin-prediccion'), mudanzas = !process.argv.includes('--sin-mudanzas'), alivio = !process.argv.includes('--sin-alivio'), vicario = !process.argv.includes('--sin-vicario'), copias = process.argv.includes('--con-copias'), repasoPriorizado = !process.argv.includes('--sin-repaso-priorizado'), diario = process.argv.includes('--con-diario'), curiosidadNovedad = !process.argv.includes('--sin-curiosidad'), curiosidadPorVisita = !process.argv.includes('--curiosidad-por-instante'), valorEncadenado = process.argv.includes('--valor-encadenado'), empatia = !process.argv.includes('--sin-empatia'), inducidas = process.argv.includes('--con-inducidas'), indignacion = arg('--indignacion', 'humana'), prospeccion = !process.argv.includes('--sin-prospeccion'), pesoProspeccion = +arg('--peso-prospeccion', '2'), inviernoDuro = !process.argv.includes('--invierno-suave'), metas = !process.argv.includes('--sin-metas'), valorMeta = +arg('--valor-meta', '1'), agencia = !process.argv.includes('--sin-agencia'), umbralAlivio = +arg('--umbral-alivio', '0.04'), escalaEmpatia = +arg('--escala-empatia', '1'), escalaNecesidades = +arg('--escala-necesidades', '1'), escalaIndignacion = +arg('--escala-indignacion', '1');
const archipielago = process.argv.includes('--archipielago');
const islas = process.argv.includes('--islas'), natalidad = arg('--natalidad', 'decidida'), mente = arg('--mente', 'neutro');   // neutro | q | instinto | azar
const lenguaje = !process.argv.includes('--sin-lenguaje'), gramatica = arg('--gramatica', 'composicional');   // composicional | holistica   // banda|jefatura|democracia|teocracia|mezcla · familia|comun
const verCronica = !process.argv.includes('--sin-cronica');

const mundo = new Mundo({ semilla, cultura, copia, gobierno, reparto, lenguaje, gramatica, islas, archipielago, natalidad, mente, apego, exploradores, prudencia, porConcepto, fisica, senales, geologia, biologia, contar, aguaSucia, plantas, manadas, pudrir, mareas, langostas, inferencia, decepcion, repaso, dibujos, contrafactual, refugios, homeostasis, conductasAMano, prediccion, mudanzas, alivio, vicario, copias, repasoPriorizado, diario, curiosidadNovedad, curiosidadPorVisita, valorEncadenado, empatia, inducidas, indignacion, prospeccion, pesoProspeccion, inviernoDuro, metas, valorMeta, agencia, umbralAlivio, escalaEmpatia, escalaNecesidades, escalaIndignacion });
const t0 = Date.now();
const serie = [];
for (let a = 1; a <= anios; a++) {
  for (let i = 0; i < TICKS_POR_ANIO; i++) mundo.paso();
  if (a % 10 === 0) {
    const e = mundo.estadisticas();
    serie.push(e.vivos);
    console.log(`año ${a}: ${e.vivos} vivos (${e.porTribu.map((t) => `${t.nombre} ${t.vivos}`).join(', ')}) · ` +
                `${e.neuronasMedia.toFixed(0)} neuronas por persona · ${((Date.now() - t0) / 1000).toFixed(0)} s`);
    if (!e.vivos) break;
  }
}
const e = mundo.estadisticas();
console.log(`\nmuertes: ${Object.entries(e.muertos).map(([k, v]) => `${k} ${v}`).join(', ')}`);
console.log(`nacidos: ${e.porTribu.map((t) => `${t.nombre} ${t.nacidos}`).join(', ')}`);
console.log('ideas más extendidas:');
for (const i of e.ideas.slice(0, 8))
  console.log(`  ${i.nombre} (${mundo.tribus[i.tribu].nombre}, año ${i.anio}): [${i.concepto}] → ${i.accion} · en ${i.portadores} personas de ${i.tribus.size} pueblos · hasta ${i.manosMax} manos`);
if (verCronica) {
  console.log('\nCRÓNICA:');
  for (const c of mundo.cronica.slice(0, 60)) console.log(`  año ${c.anio}: ${c.texto}`);
}
// (la referencia del favoritismo: con qué frecuencia dos personas de pueblos distintos llevan la misma seña por azar)
function marcaAlAzar() {
  const n = new Map(); let total = 0; const porPueblo = new Map();
  for (const p of mundo.personas) if (p.vivo) { const k = `${p.tribu}|${p.marca}`; n.set(k, (n.get(k) || 0) + 1); porPueblo.set(p.tribu, (porPueblo.get(p.tribu) || 0) + 1); total++; }
  let iguales = 0, pares = 0;
  for (const [a, na] of porPueblo) for (const [b, nb] of porPueblo) if (a !== b) { pares += na * nb; for (let m = 0; m < 8; m++) iguales += (n.get(`${a}|${m}`) || 0) * (n.get(`${b}|${m}`) || 0); }
  return pares ? +(iguales / pares).toFixed(3) : null;
}
const humanos = { mentiras: mundo.mentiras || 0, descubiertas: mundo.descubiertas || 0, ignorados: mundo.ignorados || 0, avisosVerdad: mundo.avisosVerdad || 0,
  devueltos: mundo.devueltos || 0, venganzas: mundo.venganzas || 0, duelos: mundo.duelos || 0, parejas: mundo.parejas || 0, parejasMixtas: mundo.parejasMixtas || 0,
  regalosFuera: mundo.regalosFuera || null, marcaAlAzar: marcaAlAzar(), robos: mundo.robos || 0, castigos: mundo.castigos || 0, pueblos: mundo.tribus.length };
console.log(JSON.stringify({ resumen: { semilla, cultura, copia, gobierno, reparto, lenguaje, gramatica, islas, archipielago, natalidad, mente, apego, exploradores, prudencia, porConcepto, fisica, senales, geologia, biologia, contar, aguaSucia, plantas, manadas, pudrir, mareas, langostas, inferencia, decepcion, repaso, dibujos, contrafactual, refugios, homeostasis, conductasAMano, prediccion, mudanzas, alivio, vicario, copias, repasoPriorizado, diario, curiosidadNovedad, curiosidadPorVisita, valorEncadenado, empatia, inducidas, indignacion, prospeccion, pesoProspeccion, inviernoDuro, metas, valorMeta, agencia, umbralAlivio, escalaEmpatia, escalaNecesidades, escalaIndignacion, segundos: Math.round((Date.now() - t0) / 1000), anios: mundo.anio, vivos: e.vivos, serie, muertos: e.muertos, humanos, medidas: mundo.medidas() } }));
