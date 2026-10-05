// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 FOKO SOFT (Emilio Martinez) — Neutro, https://github.com/emicaim/PUBLIC-NEUTRO
// EL MUNDO DE LAS MIL MENTES: varias culturas en un mapa, cada persona con su propio cerebro de Neutro.
//
// Nadie les escribe la cultura: cada tribu empieza en una zona con peligros distintos (lobos en el bosque, bayas
// moradas que envenenan...) y lo que aprende cada persona de su experiencia (núcleo de Neutro: neuronas de concepto que
// aprenden de los fracasos y de los aciertos) se hereda a los hijos y se enseña al compartir. Así cada tribu acaba
// sabiendo cosas distintas: eso es su cultura. Y cada idea guarda su GENEALOGÍA: quién la aprendió primero y por cuántas
// manos ha pasado.
//
// El mismo código corre en Node (simular.mjs, para medir) y en el navegador (la web). Todo sale de una semilla.
import { Nucleo } from '../../js/src/nucleo.js';
import { Asociaciones } from '../../js/src/asociaciones.js';
import { MenteInstinto, MenteAzar, MenteQ, MenteReglas } from './mentes.js';
import { Fisica, FISICA_CADA } from './fisica.js';
import { Geologia } from './geologia.js';

// ---- azar con semilla (mulberry32) -------------------------------------------------------------------------------
export function azarCon(semilla) {
  let a = semilla >>> 0;
  const r = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  r.entero = (n) => Math.floor(r() * n);
  r.elegir = (lista) => lista[Math.floor(r() * lista.length)];
  return r;
}

// ---- constantes del mundo ----------------------------------------------------------------------------------------
export const TICKS_POR_ANIO = 240;
export const TERRENO = { AGUA: 0, HIERBA: 1, BOSQUE: 2, ROCA: 3 };
const EDAD_ADULTA = 14, EDAD_FERTIL_MAX = 45, RADIO = 5;
// EL DÍA: 3 días por año (el tiempo está comprimido para que se vean generaciones); la noche es el 40 % final
export const TICKS_POR_DIA = 80;
const NOCHE_DESDE = 48;
const MAX_NEURONAS = 150;
const MAX_PUEBLOS = 16;      // los 8 del principio y los que nazcan de aldeas que se separan   // lo que cabe en una mente (al heredar pasan primero las ideas con más experiencia)
// (la primera es el REPOSO: lo que hace sin ninguna neurona, su instinto)
// (las cuatro últimas, formas de vivir que nadie conoce al principio: se descubren por casualidad y se transmiten)
export const ACCIONES = ['instinto', 'buscar_roja', 'evitar', 'volver', 'esperar', 'acercarse', 'compartir', 'atacar',
                         'pescar', 'cazar', 'fabricar', 'construir', 'dormir', 'guardar', 'sembrar', 'robar', 'curar', 'vigilar', 'combinar', 'muerto', 'mudarse'];
// LAS ESTACIONES: 4 por año (el tiempo está comprimido para ver generaciones: 3 días y 4 estaciones por año)
export const ESTACIONES = ['primavera', 'verano', 'otoño', 'invierno'];
const EDAD_ANCIANA = 55;

// Sílabas de cada cultura: los nombres de cada tribu suenan distinto
const CULTURAS = [
  { nombre: 'Kaori', color: '#e4572e', silabas: ['ka', 'to', 'ri', 'ma', 'ko', 'ai', 'ne', 'shi'] },
  { nombre: 'Ulmen', color: '#2e86de', silabas: ['ul', 'ma', 'en', 'dra', 'vi', 'go', 'run', 'tha'] },
  { nombre: 'Tzaluk', color: '#28a745', silabas: ['tza', 'lu', 'ki', 'xo', 'pa', 'nek', 'ti', 'hu'] },
  { nombre: 'Berrin', color: '#f2b705', silabas: ['be', 'rin', 'so', 'lan', 'da', 'mi', 'el', 'ko'] },
  { nombre: 'Oshum', color: '#a05cc9', silabas: ['o', 'shu', 'ma', 'yi', 'ba', 'ndo', 'le', 'wa'] },
  { nombre: 'Varsk', color: '#e8e8e8', silabas: ['var', 'sk', 'ul', 'fri', 'dag', 'ny', 'tor', 'ev'] },
  { nombre: 'Quilla', color: '#ff8fab', silabas: ['qui', 'lla', 'su', 'mak', 'ti', 'ña', 'yu', 'ra'] },
  { nombre: 'Azhar', color: '#2ec4b6', silabas: ['az', 'har', 'mi', 'sa', 'lim', 'da', 'ef', 'zu'] },
];

export const NOMBRE_OFICIO = { recoger: 'recoger fruta', pescar: 'pescar', cazar: 'cazar', sembrar: 'sembrar', fabricar: 'fabricar herramientas', construir: 'construir', curar: 'curar', vigilar: 'vigilar de noche', ensenar: 'enseñar' };
export const NOMBRE_GOBIERNO = { banda: 'una banda (cada uno lo suyo)', jefatura: 'una jefatura (manda uno y hereda su hijo)', democracia: 'una democracia (votan los adultos)', teocracia: 'una teocracia (las creencias son ley)' };
const MUERTE_VIOLENTA = new Set(['lobo', 'pelea', 'veneno', 'rayo', 'fuego', 'riada']);

// LOS MATERIALES y sus propiedades (de 0 a 1): la física con la que se inventa. Nadie programa los inventos: salen de
// combinar estas piezas con una técnica, y para qué sirve cada cosa lo deciden sus propiedades
export const MATERIALES = {
  madera: { dureza: 0.5, largo: 0.8, flota: 0.9, flex: 0.2, aislante: 0.2 },
  piedra: { dureza: 0.9, fragil: 0.7, largo: 0.2 },
  fibra: { flex: 0.9, largo: 0.5, aislante: 0.35, dureza: 0.1 },
  piel: { flex: 0.7, aislante: 0.9, imp: 0.7, dureza: 0.2, largo: 0.4 },
  hueso: { dureza: 0.7, fragil: 0.5, punta: 0.6, largo: 0.4 },
  arcilla: { moldeable: 0.9, imp: 0.5, dureza: 0.3 },
  resina: { pega: 0.9, flex: 0.3 },
  // (los que solo trae el dios: caen del cielo y hay que descubrir para qué sirven)
  obsidiana: { dureza: 0.8, fragil: 0.95, largo: 0.2 },
  hierro: { dureza: 0.95, maleable: 0.9, largo: 0.3 },
  conchas: { dureza: 0.5, fragil: 0.4, hueco: 0.4 },
  oro: { brillo: 0.9, dureza: 0.3, maleable: 0.9 },
};
export const MATERIALES_DEL_CIELO = {
  obsidiana: 'un cristal negro, duro y muy quebradizo', hierro: 'una piedra pesada y dura que se dobla en vez de romperse',
  conchas: 'conchas duras y huecas', oro: 'un metal blando que brilla',
};
const CAMPO_MATERIAL = { madera: 'madera', piedra: 'piedra', fibra: 'fibra', piel: 'pieles', hueso: 'hueso', arcilla: 'arcilla', resina: 'resina',
                         obsidiana: 'obsidiana', hierro: 'hierro', conchas: 'conchas', oro: 'oro' };
const TECNICAS = ['golpear', 'atar', 'trenzar', 'coser', 'moldear'];
const TEXTO_TECNICA = { golpear: 'golpeando', atar: 'atando', trenzar: 'trenzando', coser: 'cosiendo', moldear: 'moldeando' };
export const TEXTO_USO = { caza: 'sirve para cazar', pesca: 'sirve para pescar', carga: 'sirve para llevar cosas', abrigo: 'abriga', proteccion: 'protege de los golpes', flota: 'flota y lleva por el agua', punzar: 'pincha' };

/**
 * APRENDIZAJE PREPARADO (Seligman; Öhman y Mineka, el miedo a las serpientes): de serie nadie huye del lobo, pero tras
 * un susto con uno delante se prueba antes apartarse o plantarle cara que cualquier otra cosa. Sin esto, cada situación
 * distinta (de noche, cansado, en invierno...) necesitaba dos mordiscos para dar con la huida.
 */
const PRUDENCIA = { 'Lobo cerca': ['evitar', 'atacar'], 'Aviso de lobo': ['evitar', 'volver'], 'Enemigo a la vista': ['evitar', 'atacar'], 'Aviso de enemigo': ['volver', 'evitar'] };

/** Lo que los mayores cuentan: causa (con su palabra) → lo malo que vino después. */
const LECCIONES = [['tierra seca', 'e:seco'], ['temblor', 'e:temblor'], ['beber agua turbia', 'e:turbia'], ['tierra encharcada', 'e:mojado'], ['langostas', 'e:langosta']];
const PELIGROS = ['pasar hambre', 'pasar sed', 'erupción', 'ser herido', 'perder a alguien', 'enfermar', 'langostas'];

/** La percepción de la mente de comer: los rasgos de la planta (color, forma, hoja, olor); todo es «Planta». */
const PERCEPCION_PLANTAS = { nombrar: () => 'Planta', tranquila: () => false };

/** El nombre corto de un suceso (sin tildes ni espacios, tres letras), para la percepción y las huellas. */
const abreviar = (suceso) => suceso.normalize('NFD').replace(/[^a-zA-Z]/g, '').slice(0, 3).toLowerCase();

/** Las acciones dichas en palabras (para la crónica). */
const TEXTO_ACCION = { buscar_roja: 'buscar bayas rojas', evitar: 'apartarse', volver: 'volver a casa', esperar: 'quedarse quieto', acercarse: 'acercarse',
  compartir: 'compartir', atacar: 'atacar', pescar: 'pescar', cazar: 'cazar', fabricar: 'fabricar', construir: 'construir', dormir: 'dormir',
  guardar: 'guardar comida', sembrar: 'sembrar', robar: 'robar comida', curar: 'curar a alguien', vigilar: 'vigilar de noche', combinar: 'probar a combinar cosas', muerto: 'ocuparse del muerto' };

/** Cuánto ha vivido una neurona: sus fallos y aciertos. */
function experiencia(x) {
  let s = 0;
  for (const k in x.fallos) s += x.fallos[k];
  if (x.aciertos) for (const k in x.aciertos) s += x.aciertos[k];
  return s;
}

// ---- percepción: lo que el núcleo ve ----------------------------------------------------------------------------
/**
 * La situación de una persona, en símbolos: su necesidad, y lo más cercano de cada cosa que importa, por distancia
 * (1 al lado, 2 cerca, 3 lejos, 0 nada). Lo esencial, no los detalles: dónde exactamente no importa, sino qué hay y a
 * qué distancia. Para un extraño, además, qué opina de su tribu (a amigo, n nadie, e enemigo).
 */
export const percepcion = {
  nombrar(s) {
    const [nec, r, m, a, l, p, x, c, , z] = s.split(' ');
    if (l[1] === '1' || l[1] === '2') return 'Lobo cerca';
    if (x[1] !== '0' && x[2] === 'e') return 'Enemigo a la vista';
    if (s.includes(' G1')) return 'Agravio';
    if (s.includes(' G2')) return 'Le ofendí';
    if (x[1] !== '0') return 'Extraño';
    if (m[1] === '1') return 'Baya morada al lado';
    if (c && (c[1] === '1' || c[1] === '2')) return 'Ciervo cerca';
    const v = s.split(' ')[10];
    if (v && v[1] === 'l') return 'Aviso de lobo';
    if (v && v[1] === 'e') return 'Aviso de enemigo';
    const dif = s.split(' ')[11];
    if (dif && dif[1] === '1') return 'Muerto cerca';
    if (z && z[1] === '1') return z[2] === '1' ? 'Cansado de noche' : 'Cansado';
    if (s.endsWith(' T1')) return 'Marea baja';
    if (nec === 'h') return 'Hambre';
    if (nec === 's') return 'Sed';
    if (nec === 'f') return 'Frío';
    if (nec === 'p') return 'Falta carne';
    if (nec === 'v') return 'Falta fruta';
    if (r[1] !== '0') return 'Bayas';
    return 'Calma';
  },
  tranquila(s) {
    const [nec, , m, , l, , x, , , z, , dif] = s.split(' ');
    if (dif && dif[1] === '1') return false;
    // (cansado nunca es tranquilo: dónde y cuándo dormir es una decisión)
    return nec === 'b' && m[1] === '0' && l[1] === '0' && x[1] === '0' && !(z && z[1] === '1');
  },
};

const bin = (d) => (d === Infinity ? 0 : d <= 1 ? 1 : d <= 3 ? 2 : 3);

// (rendimiento: nombrar y tranquila se memorizan; las mismas situaciones se repiten miles de veces)
{
  const nombrarSinMemoria = percepcion.nombrar, tranquilaSinMemoria = percepcion.tranquila;
  const nombres = new Map(), calmas = new Map();
  percepcion.nombrar = (s) => {
    let n = nombres.get(s);
    if (n === undefined) { if (nombres.size > 200000) nombres.clear(); n = nombrarSinMemoria(s); nombres.set(s, n); }
    return n;
  };
  percepcion.tranquila = (s) => {
    let t = calmas.get(s);
    if (t === undefined) { if (calmas.size > 200000) calmas.clear(); t = tranquilaSinMemoria(s); calmas.set(s, t); }
    return t;
  };
}

// ---- el mundo ----------------------------------------------------------------------------------------------------
export class Mundo {
  constructor({ semilla = 1, ancho = 240, alto = 150, tribus = 8, porTribu = 20, lobos = 40, cultura = true, copia = 'prestigio',
                gobierno = 'banda', reparto = 'familia', lenguaje = true, gramatica = 'composicional', islas = false, natalidad = 'decidida', mente = 'neutro', archipielago = false, apego = true, exploradores = true, prudencia = true, porConcepto = true, fisica = true, senales = true, geologia = true, biologia = true, contar = true, aguaSucia = true, plantas = true, manadas = true, pudrir = true, mareas = true, langostas = true, inferencia = true, decepcion = true, repaso = true, dibujos = true, contrafactual = true, refugios = true, homeostasis = true, conductasAMano = false, prediccion = true, mudanzas = true, alivio = true, vicario = true, copias = false, repasoPriorizado = true, diario = false, curiosidadNovedad = true, curiosidadPorVisita = true, valorEncadenado = false, empatia = true, inducidas = false, indignacion = 'humana', prospeccion = true, pesoProspeccion = 2, inviernoDuro = true, metas = true, valorMeta = 1, agencia = true, umbralAlivio = 0.04, escalaEmpatia = 1, escalaNecesidades = 1, escalaIndignacion = 1 } = {}) {
    this.azar = azarCon(semilla);
    // ISLAS: el mapa partido en cuatro por canales de mar que nunca se secan (dos pueblos en cada una)
    // (ARCHIPIÉLAGO: varias islas grandes de costa irregular, con montañas, bosques y muchos islotes; un pueblo en cada
    // isla grande. Cuenta como mundo de islas: sin balsa no se cruza)
    this.archipielago = archipielago;
    this.islas = islas || archipielago;
    // LA NATALIDAD: 'decidida' (tener otro hijo depende de lo que su memoria de sucesos le dice que trae: hambre,
    // perder a alguien, o criarlo) o 'instinto' (como antes: bien comidos y con pareja, los hijos llegan solos)
    this.natalidad = natalidad;
    // (EL APEGO, de serie como el hambre: al anochecer se vuelve a casa, y quien lleva tiempo lejos de su pareja la busca.
    // Sin él, cada uno busca comida por su cuenta lejos de casa y las parejas apenas coinciden para tener hijos)
    this.apego = apego;
    // (LOS INQUIETOS: unos pocos, por carácter, prueban mucho más lo que nadie hace y se van con su familia a tierras
    // nuevas sin que les empuje el hambre. Si les va bien, los demás los copian por su prestigio)
    this.exploradores = exploradores;
    this.prudencia = prudencia;
    this.porConcepto = porConcepto;
    // (LAS SEÑALES DEL CLIMA, con la física: cada uno nota si su zona va seca o mojada y si tiene nubes encima, antes
    // de que la sequía sea de todos; y la memoria de sucesos puede unir «tierra seca» con el hambre que viene después)
    this.senales = senales;   // (aprender por concepto: un susto enseña al concepto entero, ver el núcleo)
    // EL CEREBRO (para comparar): 'neutro' (neuronas de concepto), 'q' (Q-learning tabular), 'instinto' (reglas fijas,
    // no aprende) o 'azar'. Misma percepción, mismas acciones, mismas recompensas
    this.mente = mente; this.personaTicks = 0;
    this.demografia = [];   // por cada 50 años: nacimientos, muertes de menores de 5, y los hijos de las mujeres al acabar su vida fértil
    this.semilla = semilla;
    // A QUIÉN SE COPIA (otra condición a medir): 'prestigio' (al más respetado), 'exito' (a quien le va mejor ahora) o
    // 'mayoria' (lo que hace la mayoría de alrededor: conformismo)
    this.copia = copia;
    // GOBIERNOS (el laboratorio): cómo toma cada pueblo sus decisiones colectivas. 'banda' (cada uno lo suyo, como
    // siempre), 'jefatura' (manda uno, el cargo se hereda, cobra tributo y castiga duro), 'democracia' (votan los
    // adultos), 'teocracia' (las creencias son ley). 'mezcla' reparte los cuatro entre los pueblos. Y el reparto:
    // 'familia' (cada hogar su despensa) o 'comun' (un granero del pueblo, por igual)
    this.gobiernoInicial = gobierno; this.repartoInicial = reparto;
    // EL LENGUAJE (otra condición a medir): con él, enseñar una idea exige que los dos tengan la misma palabra para su
    // concepto y para su acción; sin él, las ideas pasan "por telepatía", como antes
    this.lenguaje = lenguaje;
    this.origenPalabras = new Map();   // (pueblo|cosa → la primera palabra, el año y quién la dijo)
    // LA GRAMÁTICA (el experimento de Kirby): 'composicional' (una palabra para el concepto y otra para la acción) u
    // 'holistica' (una palabra para la idea entera; al inventarla se reaprovechan trozos de las que ya se saben)
    this.gramatica = gramatica;
    // (medidas: edad al morir, recuperación tras las sequías)
    this.sumaEdadMuerte = 0; this.nMuertes = 0; this.recuperaciones = []; this.graneros = new Map();
    this.ancho = ancho; this.alto = alto;
    this.cultura = cultura;             // heredar y enseñar conceptos (la condición a medir)
    this.tick = 0;
    this.siguienteId = 1;
    this.personas = [];
    this.porId = new Map();
    this.registro = new Map();          // id → {nombre, tribu, sexo, nacio, murio, causa}: de todos, también los muertos
    this.muertos = { hambre: 0, sed: 0, lobo: 0, veneno: 0, pelea: 0, vejez: 0, rayo: 0, plaga: 0, agotamiento: 0, frío: 0, enfermedad: 0, fuego: 0, riada: 0, castigo: 0, carencia: 0, ahogado: 0, caida: 0, agua: 0 };
    this.cronica = [];                  // [{anio, texto, tipo}]
    this.efectos = [];                  // [{tipo, x, y, t}] para la vista: destellos al compartir, pelear, nacer, morir
    this.contactos = new Set();         // "i-j" tribus que se han visto
    // "i-j" → 'guerra' | 'alianza' | 'paz', según lo que opinan los dos pueblos el uno del otro (se mide cada año)
    this.relaciones = new Map();
    this.guerras = new Map();           // "i-j" → {desde, caidos} de la guerra en curso (o la última)
    this.caidos = new Map();            // "i-j" → muertos en peleas entre esos dos pueblos, en total
    this.alianzas = new Set();          // "i-j" que alguna vez fueron aliados
    this.historia = [];                 // población de cada pueblo, año a año (para la gráfica)
    this.primeras = new Set();          // hitos ya contados
    this.generarTerreno();
    this.generarBayas();
    // EL CLIMA: la humedad va cambiando año a año (1 = normal). Con sequía el agua mengua y hay menos bayas; con
    // lluvias los lechos secos se llenan otra vez y algún río se desborda
    this.humedad = 1;
    this.estadoClima = 'normal';
    this.lecho = new Uint8Array(ancho * alto);   // 1 = era agua (se secó y puede volver a llenarse)
    this.terrenoCambiado = false;
    // LO EXPLORADO: lo que alguien ha visto alguna vez (el resto, en la vista, es niebla)
    this.explorado = new Uint8Array(ancho * alto);
    this.lobos = [];
    for (let i = 0; i < lobos; i++) {
      const [x, y] = this.sitioLibre((t) => t === TERRENO.BOSQUE);
      this.lobos.push({ x, y, espera: 0, vivo: true });
    }
    // CIERVOS: comida abundante para quien aprenda a cazarlos (huyen de la gente)
    this.ciervos = [];
    // (con manadas que migran, más ciervos: las manadas grandes son las que viajan)
    for (let i = 0; i < (manadas ? 140 : 70); i++) { const [x, y] = this.sitioLibre((t) => t === TERRENO.HIERBA); this.ciervos.push({ x, y, vivo: true }); }
    // EMPALIZADAS: hogar "x,y" → nivel (1 a 3); los lobos no entran y los asaltos fallan más
    this.fuertes = new Map();
    this.despensas = new Map();   // hogar "x,y" → bayas guardadas para cuando falte (el invierno)
    this.brotes = new Map();      // casilla → tick en que el arbusto sembrado dará fruto (los huertos)
    this.huertos = new Set();     // casillas sembradas alguna vez (para dibujarlas)
    // EL FUEGO: hogueras "x,y" → {leña (ticks que le quedan), natural, tribu}; y dos rejillas que se recalculan: el calor
    // (a 2 casillas de una hoguera) y la luz (a 3: los lobos no se acercan)
    this.hogueras = new Map();
    // LOS MUERTOS: el cuerpo se queda donde cae ("id" → {x, y, desde, tribu, nombre}); las tumbas, para siempre; y
    // cuántas veces se ha hecho cada cosa con ellos
    this.cadaveres = new Map(); this.tumbas = new Map(); this.funerales = { enterrar: 0, quemar: 0, apartar: 0, abandonado: 0 };
    // LO QUE TRAE EL DIOS: yacimientos de materiales que no había ("x,y" → {material, queda}) y lo que se ha hecho con ellos
    this.yacimientos = new Map(); this.delCielo = new Map();
    this.calor = new Uint8Array(ancho * alto); this.luz = new Uint8Array(ancho * alto);
    // LOS PECES de cada zona de agua (celdas de 8×8, de 0 a 1): pescar mucho en un sitio lo deja sin peces
    this.peces = new Float32Array(Math.ceil(ancho / 8) * Math.ceil(alto / 8)).fill(1);
    this.colonias = [];           // aldeas que se separaron: {tribu, campo, desde, nombre} (si duran, nace un pueblo)
    // PERROS: lobos que alguien alimentó hasta quedarse con él ({x, y, dueno, nacio}); avisan y espantan a los lobos
    this.perros = [];
    this.quemado = new Map();     // casilla de bosque quemada → año en que vuelve a ser bosque
    this.tradiciones = new Map(); // "tribu|concepto→acción" → {desde, autor}
    this.tribus = [];
    // LA FÍSICA (fisica.js): el sol, la temperatura, el agua y el hielo; de ella salen el frío, las sequías y las lluvias
    this.fisica = fisica ? new Fisica(this, TICKS_POR_ANIO) : null;
    if (manadas) {
      this.pastos = [];
      for (let k = 0; k < 3; k++) {
        const x = Math.round(ancho * (0.2 + 0.3 * k + (this.azar() - 0.5) * 0.12));
        this.pastos.push({ norte: [x + this.azar.entero(21) - 10, Math.round(alto * 0.2)], sur: [x + this.azar.entero(21) - 10, Math.round(alto * 0.8)] });
      }
    }
    // LA GEOLOGÍA (geologia.js): volcanes con sus señales, terremotos en una falla, tierra que la ceniza abona
    this.geologia = geologia ? new Geologia(this) : null;
    // (LOS REFUGIOS: cada persona necesita un lecho para la noche. Primero cuevas; luego chozas, casas de barro... y de
    // casas juntas, aldeas, pueblos y ciudades. Dormir a cubierto protege del frío y de los lobos)
    this.refugios = refugios ? new Map() : null;
    this.estadRefugios = { aCubierto: 0, alRaso: 0, aCueva: 0, chozas: 0, casas: 0, destruidos: 0 };
    this.asentamientos = [];
    if (refugios) this.generarCuevas();
    // LA VIDA (con la física): las plantas crecen según el calor y la humedad del suelo; el bosque avanza donde llueve
    // y retrocede donde se seca; los ciervos crían según los pastos; los lobos, según los ciervos; el bosque se bebe
    // los gases de los volcanes y los incendios los devuelven
    this.biologia = biologia && !!this.fisica;
    // (CONTAR LO VIVIDO: los mayores cuentan a los suyos lo que aprendieron de los sucesos —tras la tierra seca vino el
    // hambre, tras los temblores el volcán—; hace falta tener la misma palabra para la causa)
    this.contar = contar;
    // (EL AGUA SUCIA: cerca de cadáveres o de mucha gente el agua se ensucia y se ve turbia; quien la bebe enferma días
    // después. La causa llega tarde: el núcleo no puede unirla, la memoria de sucesos sí)
    this.aguaSucia = aguaSucia;
    this.suciedad = new Float32Array(Math.ceil(ancho / 8) * Math.ceil(alto / 8));
    this.estadAgua = { tragos: 0, turbios: 0, infecciones: 0, evitados: 0 };
    // (LAS PLANTAS CON RASGOS: color, forma, hoja y olor; que sea venenosa depende de sus rasgos. Llegan especies nuevas)
    this.plantas = plantas;
    // (LAS MANADAS QUE MIGRAN: en otoño los ciervos bajan a los pastos del sur y en primavera suben a los del norte, cada
    // manada siempre por su mismo camino. Quien caza en un paso en la estación buena, lo recuerda (memoria de lugar con
    // estación, de Neutro) y vuelve a esperarlas allí)
    this.manadas = manadas;
    // (4: LA COMIDA SE PUDRE según el calor: lo guardado en verano se pierde, lo guardado para el invierno aguanta; junto
    // al fuego, ahumada, dura mucho más)
    this.pudrir = pudrir; this.estadPudrir = { podrido: 0, guardadoPor: { primavera: 0, verano: 0, otoño: 0, invierno: 0 } };
    // (5: LAS MAREAS: en la orilla del mar, con la marea baja, hay marisco; con la alta, nada. Un ritmo exacto, que se ve)
    this.mareas = mareas; this.estadMareas = { marisco: 0, enAlta: 0 };
    // (6: LA CADENA: tras un año de lluvias vienen las langostas, que arrasan la fruta de una comarca; y luego, el hambre.
    // Quien ha aprendido la cadena guarda comida en cuanto ve la tierra encharcada)
    this.langostas = langostas;
    // (LA INFERENCIA TRANSITIVA en la memoria de sucesos: si sabe que A trae B y que B trae C, sabe que A trae C)
    this.inferencia = inferencia; this.inferidas = 0;
    // (LA DECEPCIÓN: pescar o cazar sin nada, cuando eso solía salir bien ahí, enseña como un fallo pequeño)
    this.decepcion = decepcion; this.decepciones = 0;
    // (APRENDER DURMIENDO: lo que hizo en otoño con comida en la mano se repasa al dormir en primavera, sabiendo ya cómo
    // fue el invierno: si lo guardado le salvó, refuerza guardar; si pasó hambre sin nada guardado, castiga lo demás)
    this.repaso = repaso;
    // (LOS DIBUJOS Y LA ESCRITURA: memoria fuera del cerebro. Quien sabe algo importante lo pinta en una roca; la pintura
    // queda aunque su autor muera. El dibujo lo entiende cualquiera, a medias; la escritura —sus palabras pintadas— solo
    // quien comparte esas palabras, pero entera)
    this.dibujos = dibujos; this.pinturas = new Map();
    this.estadDibujos = { pinturas: 0, escritas: 0, lecturas: 0, deMuertos: 0, deOtroPueblo: 0, deExtintos: 0, sinEntender: 0 }; this.estadRepaso = { repasos: 0, cambios: 0, buenos: 0, malos: 0, contrafactuales: 0, aprendieronGuardar: 0, siguenCostumbre: 0, hambreInvierno: 0 };
    // (LO CONTRAFACTUAL: quien pasó hambre en invierno y vio a un vecino comer de lo guardado piensa «debí guardar»; y
    // quien lo aprende puede pintarlo o contarlo: la costumbre «en otoño, guardar»)
    this.contrafactual = contrafactual;
    // (LA RECOMPENSA INTERNA: con ella, lo bueno y lo malo lo decide el cuerpo —cuánto se acerca o se aleja de su equilibrio—
    // y no una lista de aciertos escrita a mano)
    this.homeostasis = homeostasis; this.estadHomeostasis = { buenas: 0, malas: 0 };
    // (RIGOR, paso 2: las conductas que escribí a mano —huir del volcán, irse antes de la sequía, guardar ante las
    // langostas, no beber agua turbia— quedan apagadas salvo para comparar; en su lugar, la expectativa de la memoria de
    // sucesos entra en la percepción y el núcleo aprende solo qué hacer con ella)
    this.conductasAMano = conductasAMano; this.prediccion = prediccion; this.permitirMudanzas = mudanzas;
    // (RIGOR, paso 3: EL ALIVIO ENSEÑA —aprendizaje por evitación, Mowrer—: lo que hizo mientras esperaba algo malo se
    // refuerza si lo malo no llega, y se castiga si llega; con lo bueno, al revés. Huellas por expectativa)
    this.alivio = alivio; this.estadAlivio = { alivios: 0, miedos: 0, logros: 0, desengaños: 0 };
    // (RIGOR, paso 4: APRENDER VIENDO A OTROS —refuerzo vicario, Bandura; miedo por observación, Olsson y Phelps— en vez
    // de copiar neuronas: nadie nace sabiendo lo que sabían sus padres ni copia la mente de otro. Las copias quedan
    // solo para comparar, con la costumbre forzada y lo contrafactual, que eran míos)
    this.vicario = vicario; this.copias = copias; this.estadVicario = { vistas: 0, cambios: 0, miedos: 0 };
    if (!copias) this.contrafactual = false;
    // (RIGOR, paso 5: EL REPASO DURANTE EL SUEÑO PRIORIZADO —Mattar y Daw 2018—: al dormir se repasan los episodios que
    // más movieron el cuerpo, no los que yo elijo; mi «diario del otoño» queda solo para comparar)
    this.repasoPriorizado = repasoPriorizado; this.estadRepasoP = { noches: 0, episodios: 0, cambios: 0 };
    if (!diario) this.repaso = false;
    // (RIGOR, paso 6: LA CURIOSIDAD —búsqueda de novedad e información, Gottlieb y Oudeyer 2018— en vez de explorar al
    // azar: se explora más lo poco visto y se prueba lo menos probado; los «nómadas» por regla, fuera)
    this.curiosidadNovedad = curiosidadNovedad; this.estadCuriosidad = { exploraciones: 0, enNuevas: 0 };
    // (la curiosidad cuenta las VECES QUE ENTRA en una situación, no los instantes que pasa en ella: si contara instantes,
    // quedarse quieto la apagaría y una conducta inútil seguiría para siempre; visto en el agente general de Neutro Lab)
    this.curiosidadPorVisita = curiosidadPorVisita;
    // (EL VALOR ENCADENADO —aprendizaje por diferencias temporales, condicionamiento de segundo orden—: un suceso vale lo
    // que hace al cuerpo MÁS lo que su memoria espera que traiga después; así «beber agua turbia», que calma la sed en el
    // momento, pesa también por la enfermedad que suele venir días después)
    this.valorEncadenado = valorEncadenado;
    // (EMPATÍA —Singer 2004; Hein 2010—: el malestar de quien está cerca sube el propio impulso, más con la familia y los
    // suyos y según el afecto. LAS CONDUCTAS INDUCIDAS —el instinto social escrito a mano, encender fuego, migrar con
    // hambre, buscar cueva y cobijo, ir a la arboleda, lo que se pinta y cuenta según mi lista— quedan solo para comparar)
    this.empatia = empatia; this.inducidas = inducidas;
    // (LA INDIGNACIÓN —transgresión → indignación → deseo de sanción → equilibrio—: a quien le roban, o ve robar a los
    // suyos, le queda un agravio contra esa persona que le pesa en el cuerpo; baja si el ofensor sufre delante de él
    // —castigar alivia, de Quervain 2004— o si le devuelve o comparte. 'propia': solo la víctima (como un chimpancé,
    // Riedl 2012); 'humana': también los testigos de su pueblo (castigo de terceros, Fehr y Fischbacher 2004); 'no')
    // (LA PROSPECCIÓN —Bischof-Köhler; Suddendorf y Corballis 2007—: sentir de antemano lo que la memoria de sucesos
    // predice. El malestar imaginado entra en el impulso de ahora; lo que lo calma se aprende ya, sin esperar meses)
    // (EL INVIERNO DURO, como en las zonas frías reales: la helada se lleva casi toda la fruta y pescar rinde menos;
    // pasar el invierno pide contar con lo guardado, la caza y algo de pesca)
    this.inviernoDuro = inviernoDuro;
    // (LAS METAS SOSTENIDAS: si imagina hambre por venir, se fija la meta de tener reserva; cada tramo de la despensa
    // llena es un logro que refuerza lo que hizo. Qué hacer para llenarla, lo aprende)
    // (EL SENTIDO DE AGENCIA: el logro de la meta solo cuenta si el progreso es obra suya —lo que guarda él—, y se
    // siente al hacerlo; lo que guardan otros de la familia no premia lo que él esté haciendo)
    this.agencia = agencia;
    // (PARÁMETROS para la prueba de sensibilidad: 1 = el valor de siempre; ver PARAMETROS.md)
    this.umbralAlivio = umbralAlivio; this.escalaEmpatia = escalaEmpatia; this.escalaNecesidades = escalaNecesidades; this.escalaIndignacion = escalaIndignacion;
    this.metas = metas; this.valorMeta = valorMeta; this.estadMetas = { fijadas: 0, logros: 0 };
    this.prospeccion = prospeccion; this.pesoProspeccion = pesoProspeccion; this.estadProspeccion = { conAnticipo: 0 };
    this.guardadoSerie = [];   // (por década: lo guardado en otoño y en total, para ver si guardar para el invierno crece)
    this.indignacion = indignacion; this.estadIndignacion = { agravios: 0, sanciones: 0, restituciones: 0, ataquesAlOfensor: 0 };
    // (SOLO MEDIDA: de dónde sale cada ataque entre personas y cada muerte en pelea, para entender la violencia)
    this.estadViolencia = { ataques: {}, muertesVictima: {}, muertesAtacante: {}, conHambre: {}, conceptos: {} };
    this.estadPrediccion = { mudanzas: 0, conEspera: {}, accionConEspera: {} }; this.estadLangostas = { plagas: 0, previsores: 0, guardadoPrevisor: 0 }; this.plagaLangosta = null;
    this.estadManadas = { cazas: 0, cazasEnPaso: 0, esperas: 0 };
    this.especies = [null, { rasgos: 'road', efecto: 'comida' }, { rasgos: 'mofp', efecto: 'veneno' }];
    this.estadPlantas = { primeras: { comidaComio: 0, comidaDejo: 0, venenoComio: 0, venenoDejo: 0 }, despues: { venenoComio: 0, venenoDejo: 0 }, llegadas: 0 };
    this.peleasPorZona = { seca: 0, normal: 0, mojada: 0 }; this.muertesPorZona = { seca: 0, normal: 0, mojada: 0 }; this.gentePorZona = { seca: 0, normal: 0, mojada: 0 };
    for (let i = 0; i < tribus; i++) this.fundarTribu(i, porTribu);
    // LOS FRUTOS DE TEMPORADA (con las manadas, la prueba de anticipar lo que vuelve cada estación al mismo sitio)
    this.temporadas = new Map(); this.estadTemporada = { comidas: 0, perdidas: 0, viajes: 0 };
    if (manadas && plantas) { this.plantarTemporada('noad', 'otoño'); this.plantarTemporada('aoad', 'verano'); }
  }

  /** Unas arboledas de una especie que solo da fruta en una estación (siempre en los mismos sitios). */
  plantarTemporada(rasgos, estacion) {
    const id = this.especies.length;
    this.especies.push({ rasgos, efecto: 'comida', temporada: estacion });
    this.temporadas.set(id, estacion);
    for (let k = 0; k < 3; k++) {
      const [cx, cy] = this.sitioLibre((t) => t === TERRENO.HIERBA);
      for (let j = 0; j < 30; j++) {
        const x = cx + this.azar.entero(7) - 3, y = cy + this.azar.entero(7) - 3, i = y * this.ancho + x;
        if (!this.pisable(x, y) || this.t(x, y) === TERRENO.AGUA || this.baya[i]) continue;
        this.apuntarArbusto(i); this.baya[i] = id; this.fruta[i] = 0;
      }
    }
  }

  /** La memoria de lugar con estación (Neutro): dónde comió fruta de temporada, y en qué estación. */
  recordarTemporada(p, x, y) {
    this.estadTemporada.comidas++;
    if (this.mente !== 'neutro') return;
    p.temporada = p.temporada || new Map();
    const k = `${this.estacion}|${this.zona(x, y)}`;
    p.temporada.set(k, Math.min(10, (p.temporada.get(k) || 0) + 1));
    if (p.temporada.size > 12) { let peor = null, m = Infinity; for (const [z, v] of p.temporada) if (v < m) { m = v; peor = z; } p.temporada.delete(peor); }
  }

  /** Con hambre y sin fruta a la vista: la arboleda que recuerda para esta estación, si la hay. */
  sitioDeTemporada(p) {
    if (!p.temporada) return null;
    let mejor = null, v = 1.5;
    for (const [k, w] of p.temporada) { const [e, z] = k.split('|'); if (e === this.estacion && w > v) { v = w; mejor = +z; } }
    if (mejor == null) return null;
    const x = (mejor % 64) * 4 + 2, y = Math.floor(mejor / 64) * 4 + 2;
    if (Math.max(Math.abs(x - p.x), Math.abs(y - p.y)) <= 2) return null;
    this.estadTemporada.viajes++;
    return [x, y];
  }

  get anio() { return Math.floor(this.tick / TICKS_POR_ANIO); }
  get esNoche() { return this.tick % TICKS_POR_DIA >= NOCHE_DESDE; }
  get estacion() { return ESTACIONES[Math.floor((this.tick % TICKS_POR_ANIO) / (TICKS_POR_ANIO / 4))]; }

  // ---- terreno ----
  generarTerreno() {
    const { ancho, alto, azar } = this;
    const ruido = (escala) => {
      const g = [];
      const gw = Math.ceil(ancho / escala) + 2, gh = Math.ceil(alto / escala) + 2;
      for (let i = 0; i < gw * gh; i++) g.push(azar());
      return (x, y) => {
        const fx = x / escala, fy = y / escala, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
        const v = (i, j) => g[(y0 + j) * gw + (x0 + i)];
        const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
        return (v(0, 0) * (1 - sx) + v(1, 0) * sx) * (1 - sy) + (v(0, 1) * (1 - sx) + v(1, 1) * sx) * sy;
      };
    };
    const elev = ruido(18), elev2 = ruido(7), hum = ruido(14), peligro = ruido(22);
    this.terreno = new Uint8Array(ancho * alto);
    this.peligroZona = new Float32Array(ancho * alto);
    this.elevacion = new Float32Array(ancho * alto);
    for (let y = 0; y < alto; y++) for (let x = 0; x < ancho; x++) {
      const e = elev(x, y) * 0.75 + elev2(x, y) * 0.25, h = hum(x, y);
      const i = y * ancho + x;
      this.terreno[i] = e < 0.3 ? TERRENO.AGUA : e > 0.78 ? TERRENO.ROCA : h > 0.58 ? TERRENO.BOSQUE : TERRENO.HIERBA;
      this.peligroZona[i] = peligro(x, y);
      this.elevacion[i] = e;
    }
    // (EL MAR: dos canales en cruz, con la orilla ondulada, y un borde de mar alrededor; el mar no se seca nunca)
    this.mar = new Uint8Array(ancho * alto);
    if (this.archipielago) { this.generarArchipielago(ruido); return; }
    if (this.islas) {
      const onda = ruido(9);
      for (let y = 0; y < alto; y++) for (let x = 0; x < ancho; x++) {
        const w = 5 + onda(x, y) * 4;
        if (Math.abs(x - ancho / 2) < w || Math.abs(y - alto / 2) < w || x < 3 || y < 3 || x >= ancho - 3 || y >= alto - 3) {
          const i = y * ancho + x; this.terreno[i] = TERRENO.AGUA; this.mar[i] = 1; this.elevacion[i] = 0.1;
        }
      }
    }
  }

  /** La isla de una casilla: en el archipiélago, su etiqueta (cada trozo de tierra, la suya); si no, 0 a 3. */
  isla(x, y) {
    if (this.etiquetas) return this.etiquetas[Math.max(0, Math.min(this.alto - 1, y)) * this.ancho + Math.max(0, Math.min(this.ancho - 1, x))];
    return (x < this.ancho / 2 ? 0 : 1) + (y < this.alto / 2 ? 0 : 2);
  }

  /**
   * EL ARCHIPIÉLAGO: unas islas grandes (6 o 7) repartidas, de costa irregular (el centro se deforma con ruido), con
   * montañas nevadas en el interior y bandas de bosque; alrededor, muchos islotes (algunos, un volcán de roca). Todo lo
   * demás es mar, que no se seca. Luego se etiqueta cada trozo de tierra.
   */
  generarArchipielago(ruido) {
    const { ancho: W, alto: H, azar } = this;
    const n1 = ruido(11), n2 = ruido(5), hum = ruido(13), monte = ruido(9);
    const centros = [];
    // islas grandes, separadas entre sí
    for (let k = 0; k < 400 && centros.filter((c) => c.grande).length < 7; k++) {
      const x = 22 + azar() * (W - 44), y = 18 + azar() * (H - 36);
      if (centros.some((c) => Math.hypot(c.x - x, c.y - y) < 52)) continue;
      centros.push({ x, y, r: 17 + azar() * 11, ax: 0.75 + azar() * 0.6, ang: azar() * Math.PI, grande: true });
    }
    // islotes
    for (let k = 0; k < 600 && centros.length < 48; k++) {
      const x = 4 + azar() * (W - 8), y = 4 + azar() * (H - 8);
      if (centros.some((c) => Math.hypot(c.x - x, c.y - y) < (c.grande ? c.r + 9 : 7))) continue;
      centros.push({ x, y, r: 2 + azar() * 3.5, ax: 1, ang: 0, grande: false, volcan: azar() < 0.35 });
    }
    const T = this.terreno, E = this.elevacion;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      // (la costa irregular: la distancia a cada centro se deforma con ruido)
      const wx = x + (n1(x, y) - 0.5) * 14, wy = y + (n1(x + 97, y + 31) - 0.5) * 14;
      let e = 0, volcan = false;
      for (const c of centros) {
        const dx = wx - c.x, dy = wy - c.y, co = Math.cos(c.ang), si = Math.sin(c.ang);
        const u = (dx * co + dy * si) / c.ax, v = (-dx * si + dy * co) * c.ax;
        const f = 1 - Math.hypot(u, v) / c.r;
        if (f > e) { e = f; volcan = !!c.volcan; }
      }
      e += (n2(x, y) - 0.5) * 0.25;
      if (e <= 0.08) { T[i] = TERRENO.AGUA; E[i] = 0.1; if (e < 0.02) this.mar[i] = 1; continue; }
      // (dentro: montañas donde la isla es alta y el ruido de montes lo pide; bosques en bandas de humedad)
      const alto = e + (monte(x, y) - 0.5) * 0.5;
      if ((volcan && e > 0.45) || alto > 0.82) { T[i] = TERRENO.ROCA; E[i] = volcan ? 0.8 : 0.78 + Math.min(0.2, (alto - 0.82) * 1.2); }
      else { T[i] = hum(x, y) > 0.55 ? TERRENO.BOSQUE : TERRENO.HIERBA; E[i] = 0.35 + e * 0.4; }
    }
    // el mar: el agua unida al borde del mapa (los lagos de dentro sí pueden secarse)
    const cola = [];
    for (let x = 0; x < W; x++) { cola.push(x, (H - 1) * W + x); }
    for (let y = 0; y < H; y++) { cola.push(y * W, y * W + W - 1); }
    const visto = new Uint8Array(W * H);
    while (cola.length) {
      const i = cola.pop();
      if (visto[i] || T[i] !== TERRENO.AGUA) continue;
      visto[i] = 1; this.mar[i] = 1;
      const x = i % W, y = (i / W) | 0;
      if (x > 0) cola.push(i - 1); if (x < W - 1) cola.push(i + 1); if (y > 0) cola.push(i - W); if (y < H - 1) cola.push(i + W);
    }
    // las etiquetas: cada trozo de tierra, su número (y su tamaño)
    this.etiquetas = new Int16Array(W * H).fill(-1);
    this.tamIsla = [];
    for (let i0 = 0; i0 < W * H; i0++) {
      if (T[i0] === TERRENO.AGUA || this.etiquetas[i0] >= 0) continue;
      const id = this.tamIsla.length; let n = 0; const pila = [i0];
      while (pila.length) {
        const i = pila.pop();
        if (this.etiquetas[i] >= 0 || T[i] === TERRENO.AGUA) continue;
        this.etiquetas[i] = id; n++;
        // (también en diagonal: la gente anda en diagonal, así que dos trozos que se tocan por la esquina son la misma isla)
        const x = i % W, y = (i / W) | 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && x + dx >= 0 && x + dx < W && y + dy >= 0 && y + dy < H) pila.push(i + dy * W + dx);
      }
      this.tamIsla.push(n);
    }
    // las islas grandes, de mayor a menor (un pueblo en cada una)
    this.islasGrandes = this.tamIsla.map((n, id) => [id, n]).filter(([, n]) => n >= 300).sort((a, b) => b[1] - a[1]).map(([id]) => id);
  }

  /** EL FRÍO DEL SITIO: al sur casi nada (0,3), al norte mucho (2,5); en lo alto, aún más. */
  frio(x, y) {
    // (con la física: de la temperatura de verdad; a 10 °C o más, casi nada; a -15 °C, mucho)
    if (this.fisica) return 0.3 + Math.max(0, 10 - this.fisica.temperatura(x, y)) / 7.5;
    const n = 1 - y / this.alto;
    return 0.3 + 2.2 * n * n + (this.elevacion[y * this.ancho + x] > 0.7 ? 1 : 0);
  }

  /** Lo que le deja pasar su ropa: sin nada, todo; con manta de fibras, la mitad; con abrigo de pieles, un quinto. */
  abrigo(p) { return Math.max(0.15, 1 - 1.2 * this.uso(p, 'abrigo')); }

  /** Cuánto le afecta el frío a alguien: a los niños y a los viejos, más. */
  fragilFrio(p) { const a = p.edad / TICKS_POR_ANIO; return a < 10 || a > EDAD_ANCIANA ? 1.5 : 1; }

  /** ¿Puede ir por aquí? Por tierra, siempre; por el agua, si tiene balsa o va con alguien de los suyos que la tenga. */
  pisableP(p, x, y) {
    if (this.pisable(x, y)) return true;
    if (this.t(x, y) !== TERRENO.AGUA) return false;
    if (this.uso(p, 'flota') >= 0.5) { this.servir(p, 'flota', 0.02); return true; }
    return this.cercanos(p.x, p.y, 1).some((q) => q !== p && q.tribu === p.tribu && this.uso(q, 'flota') >= 0.5);
  }

  /** (rendimiento) Apunta un arbusto en su celda de la rejilla de 8×8, para buscarlo sin mirar casilla a casilla. */
  apuntarArbusto(i) {
    const c = (((i / this.ancho) | 0) >> 3) * this.cwFija + ((i % this.ancho) >> 3);
    this.bayasCelda[c].push(i);
  }

  generarBayas() {
    const n = this.ancho * this.alto;
    this.cwFija = Math.ceil(this.ancho / 8);
    this.bayasCelda = Array.from({ length: this.cwFija * Math.ceil(this.alto / 8) }, () => []);
    this.baya = new Uint8Array(n);       // 0 nada, 1 roja, 2 morada
    this.fruta = new Uint8Array(n);      // frutas que quedan
    // LA TIERRA SE AGOTA: cada fruta que se come desgasta el arbusto, que rebrota menos; descansando se recupera
    this.desgaste = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const t = this.terreno[i];
      if ((t === TERRENO.HIERBA || t === TERRENO.BOSQUE) && this.azar() < 0.035) {
        // las moradas abundan en las zonas "peligrosas" del mapa (cada tribu se encuentra un mundo distinto)
        this.baya[i] = this.azar() < 0.15 + 0.6 * this.peligroZona[i] ** 2 ? 2 : 1;
        this.fruta[i] = 3;
        this.apuntarArbusto(i);
      }
    }
  }

  t(x, y) { return x < 0 || y < 0 || x >= this.ancho || y >= this.alto ? TERRENO.ROCA : this.terreno[y * this.ancho + x]; }
  pisable(x, y) {
    const t = this.t(x, y);
    // (el agua helada se pisa: lagos y, con mucho frío, el mar entre islas)
    return t === TERRENO.HIERBA || t === TERRENO.BOSQUE || (t === TERRENO.AGUA && this.fisica && this.fisica.hielo[y * this.ancho + x] === 1);
  }

  sitioLibre(cond = () => true) {
    for (;;) {
      const x = this.azar.entero(this.ancho), y = this.azar.entero(this.alto);
      if (this.pisable(x, y) && cond(this.t(x, y), x, y)) return [x, y];
    }
  }

  // ---- tribus y personas ----
  fundarTribu(i, cuantos) {
    const c = CULTURAS[i % CULTURAS.length];
    // un campamento cerca del agua, lejos de los demás
    let mejor = null;
    for (let k = 0; k < 400; k++) {
      const [x, y] = this.sitioLibre();
      if (this.archipielago && this.islasGrandes.length) { if (this.isla(x, y) !== this.islasGrandes[i % this.islasGrandes.length]) continue; }
      else if (this.islas && this.isla(x, y) !== i % 4) continue;
      const lejos = Math.min(...this.tribus.map((t) => Math.hypot(t.campo[0] - x, t.campo[1] - y)), 999);
      const agua = this.cerca(x, y, 6, (xx, yy) => this.t(xx, yy) === TERRENO.AGUA) ? 1 : 0;
      const nota = Math.min(lejos, 60) + agua * 30 + this.azar() * 5;
      if (!mejor || nota > mejor.nota) mejor = { x, y, nota };
    }
    const GOB = ['banda', 'jefatura', 'democracia', 'teocracia'];
    const tribu = { id: i, nombre: c.nombre, color: c.color, silabas: c.silabas, campo: [mejor.x, mejor.y], vivos: 0, nacidos: 0,
                    gobierno: this.gobiernoInicial === 'mezcla' ? GOB[(i + this.semilla) % 4] : this.gobiernoInicial, reparto: this.repartoInicial };
    this.tribus.push(tribu);
    for (let k = 0; k < cuantos; k++) {
      const p = this.nacer(tribu, null, null, mejor.x + this.azar.entero(5) - 2, mejor.y + this.azar.entero(5) - 2);
      p.edad = (EDAD_ADULTA + this.azar.entero(16)) * TICKS_POR_ANIO;
    }
    this.anotar(`Nace el pueblo ${tribu.nombre}, ${this.describirSitio(mejor.x, mejor.y)}.`, 'tribu');
  }

  describirSitio(x, y) {
    return this.cerca(x, y, 6, (xx, yy) => this.t(xx, yy) === TERRENO.AGUA) ? 'junto al agua'
         : this.t(x, y) === TERRENO.BOSQUE ? 'en el bosque' : 'en la pradera';
  }

  cerca(x, y, r, cond) {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (cond(x + dx, y + dy)) return true;
    return false;
  }

  nombrarPersona(tribu) {
    const s = tribu.silabas, n = 2 + (this.azar() < 0.3 ? 1 : 0);
    let nombre = '';
    for (let i = 0; i < n; i++) nombre += this.azar.elegir(s);
    return nombre[0].toUpperCase() + nombre.slice(1);
  }

  nacer(tribu, madre, padre, x, y) {
    if (!this.pisable(x, y)) [x, y] = [tribu.campo[0], tribu.campo[1]];
    const p = {
      id: this.siguienteId++, nombre: this.nombrarPersona(tribu), tribu: tribu.id, sexo: this.azar() < 0.5 ? 'f' : 'm',
      edad: 0, vejez: (55 + this.azar.entero(25)) * TICKS_POR_ANIO, x, y, objetivo: null,
      hogar: madre ? [...madre.hogar] : [...tribu.campo],   // dónde vive (al migrar, la familia se lleva el hogar)
      hambre: 20, sed: 20, salud: 100, carga: 0, vivo: true,
      madre: madre ? madre.id : null, padre: padre ? padre.id : null, pareja: null, hijos: [], ultimoHijo: -1e9,
      afinidad: new Float32Array(MAX_PUEBLOS),   // lo que opina de cada tribu (también de las que aún no existen)
      cansancio: 10, dormido: false, cansado: false,  // el sueño: sube despiertos (más trabajando), baja durmiendo
      // NEURONAS DE PERSONA (Quian Quiroga: la neurona de Jennifer Aniston): a quién conoce, con qué afecto, y si le ha
      // visto en persona o solo ha oído hablar de él
      conocidos: new Map(),
      palabras: new Map(),   // su palabra para cada aviso (lobo, enemigo): se inventa o se aprende oyendo
      aviso: null, ultimoGrito: -999,
      usadasHoy: new Set(), ultimoSueno: null,         // lo que ha decidido con neurona desde que despertó
      // CÉLULAS DE LUGAR: zona (4×4 casillas) → lo bueno o malo que le pasó allí (o le contaron)
      lugares: new Map(),
      // TEMPERAMENTO (innato, se hereda con variación): de -1 (generoso, pacífico) a 1 (egoísta, agresivo). El
      // instinto lo sigue; lo aprendido puede corregirlo
      genio: madre ? Math.max(-1, Math.min(1, ((madre.genio + (padre ? padre.genio : madre.genio)) / 2) + (this.azar() - 0.5) * 0.5)) : (this.azar() - 0.5) * 1.4,
      // SUPERSTICIONES: acción → miedo. Lo que estaba haciendo cuando le cayó una desgracia que no tenía nada que ver
      tabues: new Map(), usos: {}, usosTotal: 0,
      // CURIOSIDAD (innata, se hereda con variación): cuánto prueba cosas nuevas (de niño mucho más, de viejo menos)
      curiosidad: madre ? Math.max(0, Math.min(1, ((madre.curiosidad + (padre ? padre.curiosidad : madre.curiosidad)) / 2) + (this.azar() - 0.5) * 0.3)) : this.azar(),
      // INQUIETUD (innata, se hereda con variación): casi todos poca; unos pocos mucha (los visionarios y los nómadas)
      inquietud: madre ? Math.max(0, Math.min(1, ((madre.inquietud + (padre ? padre.inquietud : madre.inquietud)) / 2) + (this.azar() - 0.5) * 0.3)) : this.azar() ** 3,
      // SEÑA DE IDENTIDAD (una pintura o adorno, 0 a 7): se hereda de la madre y a veces cambia; se favorece a quien
      // lleva la misma, sea del pueblo que sea
      // (de los fundadores, la mayoría lleva la de su pueblo y un 30 %, otra cualquiera: así hay señas compartidas
      // entre pueblos, y el favoritismo por la seña se puede distinguir del favoritismo por el pueblo)
      marca: madre ? (this.azar() < 0.05 ? this.azar.entero(8) : madre.marca) : (this.azar() < 0.3 ? this.azar.entero(8) : tribu.id % 8),
      duelo: 0,   // tick hasta el que dura el duelo por alguien querido
      vistoFunebre: {},   // lo que ha visto hacer con los muertos (enterrar, quemar, apartar): lo que hará él
      // NUTRICIÓN (0 a 100): la proteína viene del pescado, la caza y algo de larvas del bosque; las vitaminas, de la fruta
      proteina: 80, vitaminas: 80,
      // PERICIA en cada trabajo: sube con la práctica y hace que salga mejor (de ahí los oficios y su reparto)
      pericia: { recoger: 0, pescar: 0, cazar: 0, sembrar: 0, fabricar: 0, construir: 0, curar: 0, vigilar: 0, ensenar: 0 },   // (y cuánto hace cada cosa: lo raro es lo que se asocia)
      // OFICIO: cuántas veces ha hecho cada herramienta (con práctica gasta menos y hace de sobra, para cambiar)
      // LO QUE TIENE: materiales, las cosas que lleva (hasta 4: lo que ha hecho, con sus propiedades y sus usos), las
      // recetas que sabe (cómo se hace cada cosa), cuánto le ha servido cada una, y copias de sobra para dar o cambiar
      madera: 0, piedra: 0, pieles: 0, fibra: 0, hueso: 0, arcilla: 0, resina: 0, obsidiana: 0, hierro: 0, conchas: 0, oro: 0,
      cosas: [], recetas: new Map(), valor: new Map(), excedentes: [], hechas: 0,
      objetos: new Set(),      // (lo que no se inventa combinando: la carreta)
      // MEMORIA DE SUCESOS (Asociaciones, nacida en HER, https://foko-games.itch.io/her): sequía, lluvias, pasar hambre, ser herido... qué va con qué
      asoc: new Asociaciones(2 * TICKS_POR_ANIO, 24, 2 * TICKS_POR_DIA), hambriento: false, sediento: false,
      nucleo: this.nuevaMente(),
      origen: new Map(),   // situación → {autor, nombre, tribu, anio, manos}: la genealogía de cada idea suya
      situacion: '', concepto: 'Calma', accion: 'instinto', causa: null,
    };
    p.afinidad[tribu.id] = 5;
    // (la memoria de sucesos avisa cuando una expectativa se cumple: para el aprendizaje por evitación)
    { const orig = p.asoc.suceso.bind(p.asoc); p.asoc.suceso = (q, t) => { const c = orig(q, t); if (c.length && this.alivio) this.seCumple(p, c); if (this.vicario) this.verSuceso(p, q); return c; }; }
    if (madre) {
      p.afinidad.set(madre.afinidad);
      // (lo que su madre sabe de los sucesos, por ejemplo que la sequía trae hambre, también se hereda)
      if (this.cultura && this.copias) p.asoc.heredarDe(madre.asoc, 0.7);
      // LA CULTURA SE HEREDA: el hijo copia lo que saben sus padres (con algo de olvido: no todo se transmite)
      if (this.cultura && this.copias) for (const progenitor of [madre, padre]) if (progenitor) this.heredar(p, progenitor, 0.8);
      madre.hijos.push(p.id); if (padre) padre.hijos.push(p.id);
      this.conocer(p, madre, 5); if (padre) this.conocer(p, padre, 5);
      // las palabras se aprenden de la madre (las de su pueblo)
      // (y a veces un sonido cambia al pasar de madre a hijo: así las lenguas se van separando)
      if (this.cultura) for (const [k, w] of madre.palabras) p.palabras.set(k, this.azar() < 0.006 ? this.cambiarSonido(w, this.tribus[p.tribu]) : w);
      // y a hacer lo que le ha servido (se aprende viéndolo)
      if (this.cultura) for (const [k, r] of madre.recetas) if ((madre.valor.get(k) || 0) >= 1 && this.azar() < 0.6) { p.recetas.set(k, r); p.valor.set(k, 0.5); }
      // y lo que se hace con los muertos (lo que ha visto la madre, a medias)
      if (this.cultura) for (const [f, n] of Object.entries(madre.vistoFunebre)) p.vistoFunebre[f] = n * 0.5;
      // y sus miedos (las supersticiones se aprenden en casa)
      if (this.cultura) for (const [a, f] of madre.tabues) if (f >= 1) p.tabues.set(a, f * 0.7);
      // y los lugares que ella recuerda (a medias)
      if (this.cultura) for (const [k, v] of madre.lugares) if (Math.abs(v) >= 2) p.lugares.set(k, v * 0.5);
    }
    tribu.vivos++; tribu.nacidos++;
    if (madre) this.efecto('nacer', x, y);
    this.personas.push(p);
    this.porId.set(p.id, p);
    this.registro.set(p.id, { nombre: p.nombre, tribu: p.tribu, sexo: p.sexo, nacio: this.anio });
    return p;
  }

  /** Copia ideas de `de` a `a` (cada una con probabilidad `prob`), con su genealogía. Devuelve cuántas aprendió. */
  heredar(a, de, prob, maximo = Infinity) {
    let n = 0;
    if (de.pericia && a.edad > 0) prob = Math.min(1, prob * (1 + Math.min(1, de.pericia.ensenar / 20)));   // (el buen maestro)
    let ideas;
    if (maximo <= 2) {
      // (enseñar una idea al compartir: de unas pocas al azar, la de más experiencia; ordenar la mente entera cada vez
      // era el 72 % del tiempo de la simulación)
      const todas = [...de.nucleo.neuronas];
      ideas = [];
      for (let k = 0; k < 8 && todas.length; k++) ideas.push(todas[this.azar.entero(todas.length)]);
      ideas.sort((u, v) => experiencia(v[1]) - experiencia(u[1]));
    } else ideas = [...de.nucleo.neuronas].sort((u, v) => experiencia(v[1]) - experiencia(u[1]));
    for (const [situacion, neurona] of ideas) {
      if (n >= maximo || a.nucleo.neuronas.size >= MAX_NEURONAS) break;
      if (neurona.accion === 'instinto' && !neurona.protegida) continue;   // (lo que hace como el instinto no es una idea)
      if (this.azar() >= prob) continue;
      const suya = a.nucleo.neuronas.get(situacion);
      if (suya && suya.accion === neurona.accion) continue;
      // (ENSEÑAR ES HABLAR: hace falta que el que aprende tenga las mismas palabras para el concepto y para la acción;
      // si no, esta vez aprende las palabras y la idea se queda sin pasar. Al nacer no: se aprende viendo)
      if (this.lenguaje && a.edad > 0 && !this.seEntienden(a, de, neurona)) continue;
      a.nucleo.neuronas.set(situacion, { concepto: neurona.concepto, fallos: { ...neurona.fallos },
                                          aciertos: neurona.aciertos ? { ...neurona.aciertos } : undefined,
                                          accion: neurona.accion });
      const o = de.origen.get(situacion) || { autor: de.id, nombre: de.nombre, tribu: de.tribu, anio: this.anio, manos: 0 };
      // (y DE QUIÉN la recibió: así se puede dibujar el río de la idea, de mano en mano)
      a.origen.set(situacion, { ...o, manos: o.manos + 1, de: de.id, cuando: this.anio });
      n++;
    }
    if (n && a.edad > 0 && de.pericia) this.practicar(de, 'ensenar', 0.3 * n);
    // la chispa: una idea viaja de una mente a otra (al nacer no: los padres están encima)
    if (n && a.edad > 0) this.efecto('idea', de.x, de.y, a.x, a.y);
    return n;
  }

  anotar(texto, tipo = 'info') {
    // (sin repetir: lo mismo, el mismo año, una vez basta)
    for (let i = this.cronica.length - 1; i >= Math.max(0, this.cronica.length - 12); i--) if (this.cronica[i].texto === texto && this.cronica[i].anio === this.anio) return;
    this.cronica.push({ anio: this.anio, texto, tipo });
  }
  primeraVez(clave, texto, tipo) { if (!this.primeras.has(clave)) { this.primeras.add(clave); this.anotar(texto, tipo); } }

  // ---- un tick ----
  efecto(tipo, x, y, x2, y2) { if (this.verEfectos) this.efectos.push({ tipo, x, y, x2, y2, t: this.tick }); }

  paso() {
    this.tick++;
    if (this.efectos.length && this.tick % 10 === 0) this.efectos = this.efectos.filter((e) => this.tick - e.t < 40);
    this.indexar();
    for (const lobo of this.lobos) this.moverLobo(lobo);
    if (this.perros.length) this.moverPerros();
    if (this.tick % 10 === 0 && (this.hogueras.size || this.calorSucio)) this.cuidarHogueras();
    if (this.tick % 10 === 0 && this.cadaveres.size) this.pudrirse();
    if (this.tick % 2 === 0) for (const c of this.ciervos) this.moverCiervo(c);
    for (const p of this.personas) if (p.vivo) { this.vivir(p); this.personaTicks++; }
    if (this.tick % 20 === 0) this.crecerBayas();
    if (this.fisica && this.tick % FISICA_CADA === 0) this.pasoFisica();
    if (this.tick % TICKS_POR_ANIO === 0) {
      this.limpiarMuertos(); this.medirRelaciones(); this.cambiarClima(); this.brotesDeEnfermedad();
      if (this.geologia) this.geologia.anual();
      if (this.biologia) this.vidaAnual();
      if (this.refugios) this.refugiosAnual();
      // (6: tras un año de lluvias, la primavera siguiente puede traer langostas)
      if (this.langostas && this.humedadAnterior > 1.2 && this.azar() < 0.6) this.plagaDeLangostas();
      this.humedadAnterior = this.humedad;
      if (this.repaso) for (const q of this.personas) if (q.vivo && q.diario && q.diario.length) q.repasoPendiente = true;
      if (this.plantas && (this.anio === 1 || this.anio === 2 || this.azar() < 1 / 12)) this.llegaPlanta();
      for (let i = 0; i < this.desgaste.length; i++) if (this.desgaste[i]) this.desgaste[i] = this.desgaste[i] < 0.05 ? 0 : this.desgaste[i] * 0.7;
      if (this.inducidas) this.dividirAldeas();
      this.nacenPueblos();
    }
    if (this.tick % 20 === 0) this.explorar();
  }

  /**
   * (rendimiento) Para cada casilla, el agua, el bosque y la roca más cercanos (a RADIO o menos). Se calcula una vez y
   * otra cada vez que el clima cambia el agua: percibir ya no mira 121 casillas en cada decisión.
   */
  prepararCercania() {
    const W = this.ancho, H = this.alto, n = W * H;
    this.cerca_ = { [TERRENO.AGUA]: new Int32Array(n).fill(-1), [TERRENO.BOSQUE]: new Int32Array(n).fill(-1), [TERRENO.ROCA]: new Int32Array(n).fill(-1) };
    const dist = { [TERRENO.AGUA]: new Int8Array(n).fill(99), [TERRENO.BOSQUE]: new Int8Array(n).fill(99), [TERRENO.ROCA]: new Int8Array(n).fill(99) };
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const t = this.terreno[y * W + x];
      if (t === TERRENO.HIERBA) continue;
      const cerca = this.cerca_[t], d0 = dist[t], j = y * W + x;
      for (let yy = Math.max(0, y - RADIO); yy <= Math.min(H - 1, y + RADIO); yy++) for (let xx = Math.max(0, x - RADIO); xx <= Math.min(W - 1, x + RADIO); xx++) {
        const i = yy * W + xx, d = Math.max(Math.abs(xx - x), Math.abs(yy - y));
        if (d < d0[i] || (d === d0[i] && j < cerca[i])) { d0[i] = d; cerca[i] = j; }
      }
    }
    this.dist_ = dist;
    this.cercaniaSucia = false;
  }

  indexar() {
    // rejilla espacial de 8x8 para encontrar a los cercanos sin mirar a todos
    const cw = Math.ceil(this.ancho / 8);
    this.celdas = new Map();
    for (const p of this.personas) if (p.vivo) {
      const k = (p.y >> 3) * cw + (p.x >> 3);
      let l = this.celdas.get(k); if (!l) this.celdas.set(k, l = []);
      l.push(p);
    }
    this.cw = cw;
    // (y los lobos y los ciervos, también por celdas)
    this.celdasLobo = new Map(); this.celdasCiervo = new Map();
    for (const l of this.lobos) if (l.vivo) { const k = (l.y >> 3) * cw + (l.x >> 3); let a = this.celdasLobo.get(k); if (!a) this.celdasLobo.set(k, a = []); a.push(l); }
    for (const c of this.ciervos) if (c.vivo) { const k = (c.y >> 3) * cw + (c.x >> 3); let a = this.celdasCiervo.get(k); if (!a) this.celdasCiervo.set(k, a = []); a.push(c); }
    if (!this.cerca_ || this.cercaniaSucia) this.prepararCercania();
  }

  cercanos(x, y, r) {
    const out = [];
    for (let cy = (y - r) >> 3; cy <= (y + r) >> 3; cy++) for (let cx = (x - r) >> 3; cx <= (x + r) >> 3; cx++) {
      const l = this.celdas.get(cy * this.cw + cx);
      if (l) for (const q of l) if (Math.abs(q.x - x) <= r && Math.abs(q.y - y) <= r) out.push(q);
    }
    return out;
  }

  crecerBayas() {
    for (const [i, cuando] of this.brotes) if (this.tick >= cuando) { this.fruta[i] = 3; this.brotes.delete(i); }
    // (LOS FRUTOS DE TEMPORADA: en su estación dan mucho; fuera de ella, nada)
    const TEMP = this.temporadas;
    if (TEMP && TEMP.size) for (let i = 0; i < this.baya.length; i++) {
      const t = TEMP.get(this.baya[i]); if (!t) continue;
      if (t !== this.estacion) { if (this.fruta[i]) { this.estadTemporada.perdidas += this.fruta[i]; this.fruta[i] = 0; } }
      else if (this.fruta[i] < 3 && this.azar() < 0.35) this.fruta[i]++;
    }
    if (this.estacion === 'invierno') {
      if (this.inviernoDuro && this.ultimaHelada !== this.anio) {
        // (LA HELADA: al entrar el invierno, casi toda la fruta de los arbustos se pierde)
        this.ultimaHelada = this.anio;
        for (let i = 0; i < this.baya.length; i++) if (this.fruta[i] && this.azar() < 0.85) this.fruta[i] = 0;
      }
      // EL INVIERNO: nada rebrota y la escarcha se come parte de lo que queda
      for (let i = 0; i < this.baya.length; i++) if (this.fruta[i] && this.azar() < 0.04) this.fruta[i]--;
      return;
    }
    const prob = 0.08 * Math.max(0.15, Math.min(1.6, this.humedad * this.humedad)) * (this.estacion === 'primavera' ? 1.4 : 1);
    const D = this.desgaste;
    if (this.biologia) { this.crecerPlantas(D); return; }
    const F = this.geologia ? this.geologia.fertil : null;   // (la ceniza de un volcán abona: más fruta)
    for (let i = 0; i < this.baya.length; i++) if (this.baya[i] && this.fruta[i] < 3 && !(TEMP && TEMP.has(this.baya[i])) && this.azar() < prob * (F && F[i] ? 1 + 2 * F[i] : 1) / (1 + D[i])) this.fruta[i]++;
    // (los peces vuelven poco a poco)
    for (let c = 0; c < this.peces.length; c++) if (this.peces[c] < 1) this.peces[c] = Math.min(1, this.peces[c] + 0.008);
  }

  /**
   * 5º LAS PLANTAS (con la física): cada arbusto rebrota según el calor (nada bajo cero; bien de 10 a 30 °C; con
   * demasiado calor, menos) y la humedad del suelo de su zona; la ceniza abona; la tierra agotada rebrota menos.
   */
  crecerPlantas(D) {
    const f = this.fisica, F = this.geologia ? this.geologia.fertil : null, W = this.ancho;
    const factor = new Float32Array(f.temp.length);
    for (let c = 0; c < factor.length; c++) {
      const t = f.temp[c];
      // (las plantas están hechas a lo que suele llover en su zona: cuenta lo llovido frente a lo normal, no el total)
      const calor = Math.max(0, Math.min(1.15, (t + 4) / 10)) * (t > 32 ? Math.max(0.3, 1 - (t - 32) / 10) : 1);
      const h = f.normal[c] > 0.01 ? f.lluviaAnio[c] / f.normal[c] : 1;
      const agua = Math.max(0.15, Math.min(1.6, h * h));
      factor[c] = 0.08 * calor * agua * (this.estacion === 'primavera' ? 1.4 : 1);
    }
    for (let i = 0; i < this.baya.length; i++) {
      if (!this.baya[i] || this.fruta[i] >= 3 || (this.temporadas && this.temporadas.has(this.baya[i]))) continue;
      const prob = factor[f.celda(i % W, (i / W) | 0)] * (F && F[i] ? 1 + 2 * F[i] : 1);
      if (this.azar() < prob / (1 + D[i])) this.fruta[i]++;
    }
    for (let c = 0; c < this.peces.length; c++) if (this.peces[c] < 1) this.peces[c] = Math.min(1, this.peces[c] + 0.008);
  }

  /** Cada año: el bosque avanza donde el suelo está húmedo y retrocede donde se seca; y respira (se bebe los gases). */
  vidaAnual() {
    const f = this.fisica, W = this.ancho, H = this.alto, T = this.terreno;
    let bosque = 0, tierra = 0, avanza = 0, retrocede = 0;
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      if (T[i] === TERRENO.AGUA || T[i] === TERRENO.ROCA) continue;
      tierra++;
      const c = f.celda(x, y), h = f.normal[c] > 0.01 ? f.lluviaAnio[c] / f.normal[c] : 1, t = f.temp[c];
      if (T[i] === TERRENO.BOSQUE) {
        bosque++;
        if (h < 0.65 && this.azar() < 0.03 * (0.65 - h) / 0.65) { T[i] = TERRENO.HIERBA; retrocede++; }
      } else if (h > 1.1 && t > -5 && !this.quemado.has(i) && !this.huertos.has(i) && !this.baya[i] && this.azar() < 0.025
        && (T[i - 1] === TERRENO.BOSQUE || T[i + 1] === TERRENO.BOSQUE || T[i - W] === TERRENO.BOSQUE || T[i + W] === TERRENO.BOSQUE)
        && !this.cercanos(x, y, 2).length) { T[i] = TERRENO.BOSQUE; avanza++; }
    }
    if (avanza || retrocede) { this.terrenoCambiado = true; this.cercaniaSucia = true; }
    this.bosqueAvanza = (this.bosqueAvanza || 0) + avanza; this.bosqueRetrocede = (this.bosqueRetrocede || 0) + retrocede;
    this.fraccionBosque = tierra ? bosque / tierra : 0;
    // (el bosque se bebe los gases; los incendios de este año los devuelven)
    f.invernadero = Math.max(0, f.invernadero - 0.04 * this.fraccionBosque + 0.01 * ((this.incendios || 0) - (this.incendiosContados || 0)));
    this.incendiosContados = this.incendios || 0;
  }

  /** Lo bueno que está el pasto para los ciervos (media del mundo, 0 a ~1.5; se calcula una vez por paso de física). */
  pastoCiervos() {
    if (this.pastoTick === this.tick - (this.tick % 20)) return this.pasto;
    const f = this.fisica; let s = 0, n = 0;
    for (let c = 0; c < f.temp.length; c++) if (f.fraccionAgua[c] < 0.7) { const h = f.normal[c] > 0.01 ? f.lluviaAnio[c] / f.normal[c] : 1; s += Math.max(0, Math.min(1.15, (f.temp[c] + 4) / 10)) * Math.max(0.15, Math.min(1.6, h * h)); n++; }
    this.pasto = n ? Math.max(0.1, s / n) : 1; this.pastoTick = this.tick - (this.tick % 20);
    return this.pasto;
  }

  /** Adónde va cada ciervo: en otoño e invierno, al pasto del sur de su manada; en primavera y verano, al del norte. */
  destinoManada(c) {
    if (!this.manadas) return null;
    const p = this.pastos[(c.manada ?? (c.manada = this.ciervos.indexOf(c))) % this.pastos.length];
    const e = this.estacion, d = e === 'otoño' || e === 'invierno' ? p.sur : p.norte;
    return Math.max(Math.abs(d[0] - c.x), Math.abs(d[1] - c.y)) > 6 ? d : null;
  }

  /** ¿Es este un sitio de paso de una manada? (cerca de la línea entre sus dos pastos) */
  enPaso(x, y) {
    if (!this.manadas) return false;
    for (const p of this.pastos) {
      const [ax, ay] = p.norte, [bx, by] = p.sur, t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2)));
      if (Math.hypot(x - (ax + t * (bx - ax)), y - (ay + t * (by - ay))) <= 6) return true;
    }
    return false;
  }

  /** La memoria de caza por estación (Neutro): dónde cazó, en qué estación. */
  recordarCaza(p, x, y) {
    this.estadManadas.cazas++;
    if (this.enPaso(x, y) && (this.estacion === 'otoño' || this.estacion === 'primavera')) this.estadManadas.cazasEnPaso++;
    if (!this.manadas || this.mente !== 'neutro') return;
    p.cazaPorEstacion = p.cazaPorEstacion || new Map();
    const k = `${this.estacion}|${this.zona(x, y)}`;
    p.cazaPorEstacion.set(k, Math.min(10, (p.cazaPorEstacion.get(k) || 0) + 2));
    if (p.cazaPorEstacion.size > 12) { let peor = null, m = Infinity; for (const [z, v] of p.cazaPorEstacion) if (v < m) { m = v; peor = z; } p.cazaPorEstacion.delete(peor); }
  }

  /** Para cazar sin ciervo a la vista: el mejor sitio que recuerda para esta estación (o nada). */
  sitioDeCaza(p) {
    if (!p.cazaPorEstacion) return null;
    let mejor = null, v = 1.9;
    for (const [k, w] of p.cazaPorEstacion) { const [e, z] = k.split('|'); if (e === this.estacion && w > v) { v = w; mejor = +z; } }
    if (mejor == null) return null;
    this.estadManadas.esperas++;
    return [(mejor % 64) * 4 + 2, Math.floor(mejor / 64) * 4 + 2];
  }

  moverCiervo(c) {
    if (!c.vivo) {
      // (LAS MANADAS CRÍAN: nace un ciervo junto a otro vivo, si por allí no hay gente; sin ningún ciervo, de tarde en
      // tarde llega alguno de fuera. Cerca de las aldeas grandes la caza se acaba; lejos, sigue habiendo)
      // (con la vida: crían más donde el suelo está húmedo y templado, y nada con el suelo helado)
      const pasto = this.biologia ? this.pastoCiervos() : 1;
      if (this.azar() < 0.006 * pasto) {
        const vivos = this.ciervos.filter((d) => d.vivo);
        const madre = vivos.length ? this.azar.elegir(vivos) : null;
        const [x, y] = madre ? [madre.x + this.azar.entero(7) - 3, madre.y + this.azar.entero(7) - 3] : (this.azar() < 0.05 ? this.sitioLibre((t) => t === TERRENO.HIERBA) : [-1, -1]);
        if (madre && this.manadas) c.manada = madre.manada;
        if (this.t(x, y) === TERRENO.HIERBA && this.cercanos(x, y, 8).length < 3) { c.x = x; c.y = y; c.vivo = true; }
      }
      return;
    }
    // huye de la gente que tiene cerca; si no, pace
    // (huyen de quien se acerca a 2 casillas, y no siempre a tiempo: así cazar es difícil, pero se puede)
    const cerca = this.cercanos(c.x, c.y, 2);
    let dx, dy;
    const destino = this.destinoManada(c);
    // (mientras migra, la manada va a lo suyo: está menos atenta)
    if (cerca.length && this.azar() < (destino ? 0.35 : 0.6)) { dx = Math.sign(c.x - cerca[0].x) || this.azar.entero(3) - 1; dy = Math.sign(c.y - cerca[0].y) || this.azar.entero(3) - 1; }
    else if (destino && this.azar() < 0.6) {
      // (LA MIGRACIÓN: hacia el pasto de la estación, por su camino; si algo lo corta, rodea)
      dx = Math.sign(destino[0] - c.x); dy = Math.sign(destino[1] - c.y);
      if (!this.pisable(c.x + dx, c.y + dy)) { if (this.pisable(c.x + dx, c.y)) dy = 0; else if (this.pisable(c.x, c.y + dy)) dx = 0; else { dx = this.azar.entero(3) - 1; dy = this.azar.entero(3) - 1; } }
      if (this.pisable(c.x + dx, c.y + dy)) { c.x += dx; c.y += dy; }
      return;
    }
    else if (this.azar() < 0.3) { dx = this.azar.entero(3) - 1; dy = this.azar.entero(3) - 1; }
    else return;
    if (this.t(c.x + dx, c.y + dy) === TERRENO.HIERBA) { c.x += dx; c.y += dy; }
  }

  /** ¿Está esta persona en su hogar fortificado? Devuelve el nivel de la empalizada (0 si no). */
  fortificado(p) {
    if (Math.max(Math.abs(p.x - p.hogar[0]), Math.abs(p.y - p.hogar[1])) > 2) return 0;
    return this.fuertes.get(`${p.hogar[0]},${p.hogar[1]}`) || 0;
  }

  capacidad(p) { return p.objetos.has('carreta') ? 10 : 3 + Math.round(3 * this.uso(p, 'carga')); }

  /** Si su memoria de sucesos dice que tras A viene B: un vínculo fuerte (0,3) y visto al menos dos veces (no una casualidad). */
  sabe(p, a, b) {
    if (this.mente !== 'neutro') return false;   // (la memoria de sucesos es parte de Neutro: las otras mentes no la tienen)
    const v = p.asoc.vinculos.get(`${a}→${b}`);
    if (v && v.veces >= 2 && p.asoc.fuerza(a, b) >= 0.3) return true;
    // (o lo deduce: A trae algo que trae B)
    if (this.inferencia && p.asoc.inferida(a, b) > 0) {
      p.deducido = p.deducido || new Set();
      if (!p.deducido.has(`${a}→${b}`)) { p.deducido.add(`${a}→${b}`); this.inferidas++; this.primeraVez(`deduce-${p.tribu}`, `${p.nombre} (${this.tribus[p.tribu].nombre}) une dos cosas que sabía: si ${a} trae algo que trae ${b}, entonces ${a} trae ${b}. Nunca lo había visto así, lo deduce.`, 'idea'); }
      return true;
    }
    return false;
  }

  /**
   * Lo fácil que es para un lobo atacar a alguien: despierto, siempre puede; dormido en casa y con los suyos cerca, poco
   * (alguien vela, hay fuego); dormido al raso, del todo. Tras una empalizada, nada (eso lo mira fortificado).
   */
  vulnerable(q) {
    if (!q.dormido) return 1;
    if (q.refugioNoche) return { casa: 0.03, choza: 0.07, cueva: 0.07, cobijo: 0.15 }[q.refugioNoche.tipo] ?? 0.1;   // (a cubierto, el lobo casi no llega)
    if (this.refugios) return this.cercanos(q.x, q.y, 2).some((r) => r !== q && r.tribu === q.tribu && r.edad >= EDAD_ADULTA * TICKS_POR_ANIO && !r.dormido) ? 0.3 : 0.6;
    if (!this.enCasa(q)) return 1;
    // (EL VIGÍA: alguien de los suyos despierto, vigilando cerca: casi a salvo)
    const vigia = this.cercanos(q.x, q.y, 3).find((r) => r !== q && r.tribu === q.tribu && r.vigila > this.tick && !r.dormido);
    if (vigia) { q.guardadoPor = vigia; return 0.05; }
    const acompanado = this.cercanos(q.x, q.y, 2).some((r) => r !== q && r.tribu === q.tribu && r.edad >= EDAD_ADULTA * TICKS_POR_ANIO);
    return acompanado ? 0.15 : 0.5;
  }
  enCasa(q) { return Math.max(Math.abs(q.x - q.hogar[0]), Math.abs(q.y - q.hogar[1])) <= 2; }

  moverLobo(l) {
    if (!l.vivo) {
      // (con la vida: vuelven más cuanto más ciervos hay que cazar)
      const presas = this.biologia ? Math.min(1.6, 2 * this.ciervos.filter((d) => d.vivo).length / Math.max(1, this.ciervos.length)) : 1;
      if (this.azar() < 0.002 * presas) { [l.x, l.y] = this.sitioLibre((t) => t === TERRENO.BOSQUE); l.vivo = true; }
      return;
    }
    if (l.espera > 0) { l.espera--; return; }
    // caza: si hay alguien cerca, va a por él; si no, pasea por el bosque
    // (un muerto cerca atrae al lobo: se queda comiendo)
    if (this.cadaveres.size && this.tick % 3 === 0) {
      const c = this.cadaverCerca(l.x, l.y, 5);
      if (c) { if (Math.max(Math.abs(c.x - l.x), Math.abs(c.y - l.y)) <= 1) { l.espera = 40; if (this.azar() < 0.2) { this.cadaveres.delete(c.id); this.funerales.abandonado++; } return; } l.x += Math.sign(c.x - l.x); l.y += Math.sign(c.y - l.y); return; }
    }
    const presas = this.cercanos(l.x, l.y, 4);
    let presa = null, dmin = 99;
    for (const q of presas) { const d = Math.max(Math.abs(q.x - l.x), Math.abs(q.y - l.y)); if (d < dmin) { dmin = d; presa = q; } }
    // (solo caza dentro del bosque o en su borde: fuera de él, la gente está a salvo)
    if (l.salvaje > 0) l.salvaje--;
    // (de noche, los lobos salen del bosque a cazar)
    const enBosque = this.t(l.x, l.y) === TERRENO.BOSQUE || l.salvaje > 0 || this.esNoche;
    if (presa && dmin <= 1 && enBosque && !this.fortificado(presa) && this.azar() < this.vulnerable(presa)) {
      if (this.ladra(presa, l)) return;
      if (this.luz[presa.y * this.ancho + presa.x]) { l.espera = 30; this.lobosEspantados = (this.lobosEspantados || 0) + 1; return; }   // (el fuego los espanta)
      // (si el vigía lo ha evitado, el mérito es suyo)
      if (presa.guardadoPor && presa.guardadoPor.vigila > this.tick) { const v = presa.guardadoPor; presa.guardadoPor = null; this.practicar(v, 'vigilar', 1); this.acierto(v); this.protegidos = (this.protegidos || 0) + 1; }
      this.herir(presa, 20, 'lobo');
      l.espera = 60;
      return;
    }
    let dx, dy;
    if (presa && enBosque && this.tick % 3 === 0) { dx = Math.sign(presa.x - l.x); dy = Math.sign(presa.y - l.y); }
    else { dx = this.azar.entero(3) - 1; dy = this.azar.entero(3) - 1; }
    const nx = l.x + dx, ny = l.y + dy;
    if (this.pisable(nx, ny) && (this.t(nx, ny) === TERRENO.BOSQUE || l.salvaje > 0 || this.azar() < 0.03)) { l.x = nx; l.y = ny; }
  }

  // ---- los poderes del dios: cada uno toca el mundo de verdad, y las mentes aprenden del dolor como de todo ----
  /** RAYO: mata a quien toca; los que lo ven se asustan (un susto pequeño, pero les enseña algo... aunque sea mentira). */
  rayo(x, y, natural = false) {
    const muertos = [];
    for (const q of this.cercanos(x, y, 6)) this.temer(q);
    for (const q of this.cercanos(x, y, 1)) { muertos.push(q); this.herir(q, 999, 'rayo'); }
    for (const q of this.cercanos(x, y, 6)) if (q.vivo) this.herir(q, 4, 'rayo');
    this.efecto('rayo', x, y);
    this.nombrarSuceso('e:rayo', x, y, 7);
    if (this.pisable(x, y)) this.encender(x, y, null, true, 120);   // (el rayo prende: unas brasas que se apagan solas)
    const quien = muertos.length ? `y mata a ${muertos.map((q) => `${q.nombre} (${this.tribus[q.tribu].nombre})`).slice(0, 3).join(', ')}${muertos.length > 3 ? ` y ${muertos.length - 3} más` : ''}` : 'sin matar a nadie';
    this.anotar(`${natural ? 'En una tormenta cae' : 'Cae'} un rayo ${quien}.`, natural ? 'clima' : 'dios');
  }

  /** VOLCÁN: revienta el volcán más cercano (a 15 casillas o menos); si no hay, la tierra se abre y nace uno aquí. */
  volcanAqui(x, y) {
    if (!this.geologia) return;
    const g = this.geologia;
    let v = g.volcanes.find((w) => Math.hypot(w.x - x, w.y - y) <= 15);
    if (!v) {
      v = { x, y, presion: 1, ritmo: 0.01, erupciones: 0, ultima: null, humo: true, nuevo: true };
      g.volcanes.push(v);
      this.anotar(`La tierra se abre ${this.describirSitio(x, y)} y nace una montaña de fuego.`, 'dios');
    }
    g.erupcion(v);
  }

  /** TERREMOTO: tiembla la tierra con fuerza alrededor del sitio. */
  terremotoAqui(x, y) { if (this.geologia) this.geologia.terremoto(x, y, 0.9); }

  /** LLUVIA: llueve a mares en la comarca: el suelo se empapa y el año cuenta como muy lluvioso allí (los lagos crecerán). */
  lluviaAqui(x, y) {
    const f = this.fisica; if (!f) return;
    const c0 = f.celda(x, y), cx = c0 % f.cw, cy = Math.floor(c0 / f.cw);
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const X = cx + dx, Y = cy + dy; if (X < 0 || Y < 0 || X >= f.cw || Y >= f.ch) continue;
      const c = Y * f.cw + X; f.suelo[c] = 1; f.nube[c] = 1.2; f.lluviaAhora[c] = 0.3; f.lluviaAnio[c] = Math.max(f.lluviaAnio[c], f.normal[c] * 1.6);
    }
    this.efecto('lluvia', x, y);
    this.anotar(`Llueve a mares ${this.describirSitio(x, y)}.`, 'dios');
  }

  /** SEQUÍA: la comarca se seca: el suelo, sin agua; el año cuenta como muy seco allí (los lagos menguarán). */
  sequiaAqui(x, y) {
    const f = this.fisica; if (!f) return;
    const c0 = f.celda(x, y), cx = c0 % f.cw, cy = Math.floor(c0 / f.cw);
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const X = cx + dx, Y = cy + dy; if (X < 0 || Y < 0 || X >= f.cw || Y >= f.ch) continue;
      const c = Y * f.cw + X; f.suelo[c] = 0; f.nube[c] = 0; f.vapor[c] = 0; f.lluviaAnio[c] = Math.min(f.lluviaAnio[c], f.normal[c] * 0.35);
    }
    for (const i of this.arbustosEn(x, y, 16)) if (this.azar() < 0.5) this.fruta[i] = 0;
    this.efecto('sequia', x, y);
    this.anotar(`Una sequía repentina agosta la tierra ${this.describirSitio(x, y)}.`, 'dios');
  }

  /** PLAGA: enferma a quien está en la zona; se contagia a los vecinos; quien se cura queda inmune. */
  plaga(x, y) {
    let n = 0;
    for (const q of this.cercanos(x, y, 5)) if (this.contagiar(q)) n++;
    this.efecto('plaga', x, y);
    this.nombrarSuceso('e:plaga', x, y, 6);
    this.anotar(`Una plaga cae sobre ${n} personas.`, 'dios');
  }
  contagiar(q, causa = 'plaga') {
    if (!q.vivo || q.enfermo > 0 || q.inmune) return false;
    this.temer(q);
    q.enfermo = 300 + this.azar.entero(200);
    q.causaEnfermedad = causa;
    q.asoc.suceso('enfermar', this.tick);
    if (!(this.homeostasis && q.nucleo.sentir)) this.leccion(q, () => q.nucleo.aprenderDeFracaso(null));   // enfermar duele: es un fracaso (con la recompensa interna, lo dice el cuerpo)
    return true;
  }

  /** COMIDA: brotan bayas rojas alrededor. */
  comida(x, y) {
    let n = 0;
    for (let yy = y - 4; yy <= y + 4; yy++) for (let xx = x - 4; xx <= x + 4; xx++) {
      if (!this.pisable(xx, yy) || this.azar() > 0.35) continue;
      const i = yy * this.ancho + xx;
      if (!this.baya[i]) this.apuntarArbusto(i);
      this.baya[i] = 1; this.fruta[i] = 3; n++;
    }
    this.efecto('comida', x, y);
    this.anotar(`Brotan ${n} arbustos de bayas rojas.`, 'dios');
  }

  /** LOBOS: una manada que, durante un tiempo, caza también fuera del bosque. */
  soltarLobos(x, y) {
    let n = 0;
    for (let k = 0; k < 4; k++) {
      const lx = x + this.azar.entero(5) - 2, ly = y + this.azar.entero(5) - 2;
      if (!this.pisable(lx, ly)) continue;
      this.lobos.push({ x: lx, y: ly, espera: 0, vivo: true, salvaje: 1500 });
      n++;
    }
    this.efecto('lobos', x, y);
    this.anotar(`Una manada de ${n} lobos aparece en ${this.t(x, y) === TERRENO.BOSQUE ? 'el bosque' : 'campo abierto'}.`, 'dios');
  }

  // ---- la vida de una persona ----
  vivir(p) {
    p.edad++;
    p.hambre = Math.min(100, p.hambre + 0.07);
    p.sed = Math.min(100, p.sed + 0.1);
    if (p.hambre >= 100) this.herir(p, 0.4, 'hambre', false);
    if (p.sed >= 100) this.herir(p, 0.8, 'sed', false);
    p.proteina = Math.max(0, p.proteina - 0.035); p.vitaminas = Math.max(0, p.vitaminas - 0.035);
    // (con carencia de proteína se cura la mitad; sin vitaminas, el cuerpo se va dañando: escorbuto)
    if (p.hambre < 60 && p.sed < 60) p.salud = Math.min(100, p.salud + (p.edad > EDAD_ANCIANA * TICKS_POR_ANIO ? 0.04 : 0.08) * (p.proteina < 15 ? 0.5 : 1));
    if (p.vitaminas < 10) this.herir(p, 0.02, 'carencia', false);
    if (p.hambre > 70 && !p.hambriento) { p.hambriento = true; p.asoc.suceso('pasar hambre', this.tick); if (this.estacion === 'invierno') { p.hambreInvierno = true; p.hambresInvierno = (p.hambresInvierno || 0) + 1; } } else if (p.hambre < 50) p.hambriento = false;
    if (p.sed > 70 && !p.sediento) { p.sediento = true; p.asoc.suceso('pasar sed', this.tick); } else if (p.sed < 50) p.sediento = false;
    if (!p.vivo) return;
    if (p.edad >= p.vejez) { this.morir(p, 'vejez'); return; }
    if (p.sexo === 'f' && p.edad === EDAD_FERTIL_MAX * TICKS_POR_ANIO) { const d = this.periodo(); d.mujeres++; d.hijos += p.hijos.length; }
    if (p.incuba && this.tick >= p.incuba) { p.incuba = 0; if (this.contagiar(p, 'agua')) this.estadAgua.infecciones++; }
    if (p.enfermo > 0) {
      p.enfermo--;
      this.herir(p, 0.12, p.causaEnfermedad || 'plaga', false);
      if (!p.vivo) return;
      if (p.enfermo === 0) p.inmune = true;
      else if (this.tick % 10 === p.id % 10) for (const q of this.cercanos(p.x, p.y, 1)) if (q !== p && this.azar() < 0.12) this.contagiar(q, p.causaEnfermedad);
    }

    if (p.edad === 5 * TICKS_POR_ANIO) for (const id of [p.madre, p.padre]) { const f = id != null && this.porId.get(id); if (f && f.vivo) f.asoc.suceso('criar un hijo', this.tick); }
    if (p.edad < 3 * TICKS_POR_ANIO) {   // los pequeños van con su madre (y duermen con ella)
      let m = this.porId.get(p.madre);
      // (HUÉRFANO: lo cría el padre; si no, un abuelo, una abuela o un hermano mayor; si no queda familia, alguien de
      // su pueblo, antes cuanto más generoso)
      if (!m || !m.vivo) { m = this.porId.get(p.cuidador); if (!m || !m.vivo) m = this.adoptar(p); }
      if (m && m.vivo) { p.x = m.x; p.y = m.y; p.dormido = m.dormido; if (m.carga > 0 && p.hambre > 40) { m.carga--; p.hambre -= 35; } p.sed = Math.min(p.sed, m.sed); }
      return;
    }
    // LA INFANCIA: los niños aprenden IMITANDO lo que ven hacer a los adultos de su pueblo (la neurona de lo que el
    // adulto está haciendo ahora mismo, si la tiene)
    if (this.cultura && this.copias && p.edad < EDAD_ADULTA * TICKS_POR_ANIO && this.tick % 10 === p.id % 10 && this.azar() < 0.3) this.imitar(p);
    // EL SUEÑO: dormido, el cansancio baja (en casa, más deprisa) y no se decide nada; se despierta descansado o
    // con el día. Agotado del todo, enferma. Despertar descansado y a salvo es un acierto (lo que le llevó a dormir así)
    if (p.dormido) {
      p.cansancio = Math.max(0, p.cansancio - (p.refugioNoche ? 1.0 : this.enCasa(p) && !this.refugios ? 0.9 : 0.5));
      if (this.estacion === 'invierno' && this.esNoche && this.enCasa(p) && this.uso(p, 'abrigo') < 0.5) {
        const f = this.frio(p.x, p.y);
        if (f > 1.4 && !this.calor[p.y * this.ancho + p.x] && !(p.refugioNoche && p.refugioNoche.tipo !== 'cobijo')) { this.herir(p, 0.05 * f * this.abrigo(p) * this.fragilFrio(p), 'frío', false); if (!p.vivo) return; }
      }
      if (this.estacion === 'invierno' && this.esNoche && !this.enCasa(p)) {
        this.herir(p, 0.3 * this.abrigo(p) * this.frio(p.x, p.y) * this.fragilFrio(p) * (this.calor[p.y * this.ancho + p.x] ? 0.3 : 1) * (p.refugioNoche ? (p.refugioNoche.tipo === 'cobijo' ? 0.45 : 0.15) : 1), 'frío', false);
        if (this.uso(p, 'abrigo') > 0.1) this.servir(p, 'abrigo', 0.05);
        if (!p.vivo) return;
        if (!p.paso_frio) { p.paso_frio = true; p.asoc.suceso('pasar frío', this.tick); }
      } else p.paso_frio = false;
      if (p.cansancio < 8 || (!this.esNoche && p.cansancio < 35)) {
        p.dormido = false; p.refugioNoche = null;
        this.consolidarSueno(p);
        p.asoc.suceso(p.durmioEnCasa ? 'dormir en casa' : 'dormir al raso', this.tick);
        if (p.salud > 60) this.acierto(p);
      }
      return;
    }
    p.cansancio = Math.min(100, p.cansancio + (this.uso(p, 'proteccion') > 0.2 ? 0.09 : 0.07));   // (lo que protege pesa)
    // (de noche en invierno, fuera de casa y sin abrigo, también despierto se pasa frío)
    if (this.estacion === 'invierno' && this.esNoche && this.uso(p, 'abrigo') < 0.5 && !this.enCasa(p) && p.edad >= 3 * TICKS_POR_ANIO) {
      if (!this.calor[p.y * this.ancho + p.x]) this.herir(p, 0.08 * this.abrigo(p) * this.frio(p.x, p.y) * this.fragilFrio(p), 'frío', false);
      if (!p.paso_frio) { p.paso_frio = true; p.asoc.suceso('pasar frío', this.tick); }
    }
    if (p.cansancio >= 100) this.herir(p, 0.3, 'agotamiento', false);
    if (!p.vivo) return;
    p.cansado = p.cansancio > 60;
    // (en el agua, con los años de lluvias, alguna balsa vuelca)
    if (this.estadoClima === 'lluvias' && this.terreno[p.y * this.ancho + p.x] === TERRENO.AGUA && this.azar() < 0.0003) { this.herir(p, 999, 'ahogado', false); return; }
    const deDuelo = p.duelo > this.tick;
    if (this.tick % (deDuelo ? 6 : p.pena > this.tick ? 4 : 3) === p.id % 3) this.decidir(p);
    this.mover(p);
    this.usarSitio(p);
    if (p.edad >= EDAD_ADULTA * TICKS_POR_ANIO && this.tick % 10 === p.id % 10) { if (deDuelo) this.migrar(p); else this.vidaSocial(p); }
  }

  percibir(p) {
    // (LA NECESIDAD: sed, hambre... y, si no, lo que le falta al cuerpo aunque esté lleno: carne o fruta)
    const nec = p.sed > 55 && p.sed >= p.hambre ? 's' : p.hambre > 50 ? 'h' : p.frioHasta > this.tick ? 'f' : p.proteina < 25 ? 'p' : p.vitaminas < 25 ? 'v' : 'b';
    let dr = Infinity, dm = Infinity, da = Infinity, dl = Infinity, dp = Infinity, dx = Infinity;
    let roja = null, morada = null, agua = null, lobo = null, propio = null, extrano = null;
    let dc = Infinity, ciervo = null, bosque = null, roca = null, db = Infinity, dk = Infinity;
    const W = this.ancho, aqui = p.y * W + p.x;
    const casilla = (j) => [j % W, (j / W) | 0];
    { const j = this.cerca_[TERRENO.AGUA][aqui]; if (j >= 0) { da = this.dist_[TERRENO.AGUA][aqui]; agua = casilla(j); } }
    { const j = this.cerca_[TERRENO.BOSQUE][aqui]; if (j >= 0) { db = this.dist_[TERRENO.BOSQUE][aqui]; bosque = casilla(j); } }
    { const j = this.cerca_[TERRENO.ROCA][aqui]; if (j >= 0) { dk = this.dist_[TERRENO.ROCA][aqui]; roca = casilla(j); } }
    const cy0 = Math.max(0, (p.y - RADIO) >> 3), cy1 = (p.y + RADIO) >> 3, cx0 = Math.max(0, (p.x - RADIO) >> 3), cx1 = (p.x + RADIO) >> 3;
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
      const k = cy * this.cw + cx;
      const arbustos = this.bayasCelda[cy * this.cwFija + cx];
      if (arbustos) for (const i of arbustos) {
        if (!this.fruta[i]) continue;
        const x = i % W, y = (i / W) | 0, d = Math.max(Math.abs(x - p.x), Math.abs(y - p.y));
        if (d > RADIO) continue;
        if ((this.baya[i] === 1 || (this.baya[i] > 2 && !(p.evita && p.evita.has(this.baya[i])))) && d < dr) { dr = d; roja = [x, y]; }
        else if (this.baya[i] === 2 && d < dm) { dm = d; morada = [x, y]; }
      }
      const ls = this.celdasLobo.get(k);
      if (ls) for (const l of ls) { const d = Math.max(Math.abs(l.x - p.x), Math.abs(l.y - p.y)); if (d <= RADIO && d < dl) { dl = d; lobo = l; } }
      const cs = this.celdasCiervo.get(k);
      if (cs) for (const c of cs) { const d = Math.max(Math.abs(c.x - p.x), Math.abs(c.y - p.y)); if (d <= RADIO && d < dc) { dc = d; ciervo = c; } }
    }
    for (const q of this.cercanos(p.x, p.y, RADIO)) {
      if (q === p || q.edad < 3 * TICKS_POR_ANIO) continue;
      const d = Math.max(Math.abs(q.x - p.x), Math.abs(q.y - p.y));
      if (q.tribu === p.tribu) { if (d < dp) { dp = d; propio = q; } }
      else if (d < dx) { dx = d; extrano = q; }
    }
    const op = extrano ? this.opinionDe(p, extrano) : 0;
    const opinion = extrano ? (op >= 3 ? 'a' : op <= -3 ? 'e' : 'n') : '-';
    if (extrano) this.contacto(p, extrano);
    // GRITAR: quien ve un lobo o un enemigo cerca, avisa con su palabra (una vez cada poco)
    if (this.tick - p.ultimoGrito > 30) {
      // LA MENTIRA: con hambre, mal genio y bayas cerca que otros también quieren, grita "lobo" sin haberlo
      if (this.inducidas && dl > RADIO && p.hambre > 45 && p.genio > 0.3 && dr <= 4 && (dp <= 4 || dx <= 4) && p.palabras.has('lobo') && this.azar() < p.genio * 0.25) {
        this.mentiras = (this.mentiras || 0) + 1;
        this.gritar(p, 'lobo', p.x + 3, p.y + 3, true);
      } else if (dl <= 3) { this.avisosVerdad = (this.avisosVerdad || 0) + 1; this.gritar(p, 'lobo', lobo.x, lobo.y); }
      else if (extrano && opinion === 'e' && dx <= 3) this.gritar(p, 'enemigo', extrano.x, extrano.y);
    }
    // HABLAR: quien ve algo que a otro de los suyos le hace falta, se lo dice con su palabra (y dónde está)
    if (this.tick - p.ultimoGrito > 30 && this.cultura) this.hablar(p, { ciervo, dc, roja, dr, agua, da });
    if (p.aviso && this.tick > p.aviso.hasta) p.aviso = null;
    // OÍR ES COMO VER (Quian Quiroga: la neurona de concepto responde igual a la cosa que a su nombre): si le han dicho
    // "ciervo", "bayas" o "agua" y no lo ve, su concepto se enciende como si lo viera, cerca y por donde le dijeron
    if (p.aviso && p.aviso.que === 'ayuda' && !extrano) {
      // ("¡AYUDA!": se enciende el concepto del enemigo, por donde está el agresor)
      const ag = this.cercanos(p.aviso.x, p.aviso.y, 1).find((q) => q.tribu !== p.tribu);
      if (ag) { extrano = ag; dx = Math.max(2, Math.min(3, Math.max(Math.abs(ag.x - p.x), Math.abs(ag.y - p.y)))); }
    }
    if (p.aviso && p.aviso.que !== 'lobo' && p.aviso.que !== 'enemigo' && p.aviso.que !== 'ayuda') {
      const a = p.aviso, d = Math.max(2, Math.min(3, Math.max(Math.abs(a.x - p.x), Math.abs(a.y - p.y))));
      if (a.que === 'ciervo' && !ciervo) { ciervo = { x: a.x, y: a.y, oido: true }; dc = d; }
      else if (a.que === 'bayas' && !roja) { roja = [a.x, a.y]; dr = d; }
      else if (a.que === 'agua' && !agua) { agua = [a.x, a.y]; da = d; }
    }
    // (EL OFENSOR A LA VISTA: alguien contra quien guarda un agravio; y el OFENDIDO: alguien que se lo guarda a él)
    let ofensor = null, ofendido = null;
    if (this.indignacion !== 'no') for (const q of this.cercanos(p.x, p.y, RADIO)) {
      if (q === p || !q.vivo) continue;
      if (!ofensor && p.agravios && (p.agravios.get(q.id) || 0) > 0.2) ofensor = q;
      if (!ofendido && q.agravios && (q.agravios.get(p.id) || 0) > 0.2) ofendido = q;
    }
    p.vista = { roja, morada, agua, lobo, propio, extrano, ciervo, bosque, roca, ofensor, ofendido };
    // (y el clima de este año: en sequía lo que funciona puede ser otra cosa)
    let clima = { sequia: 's', lluvias: 'l', normal: 'n' }[this.estadoClima] || 'n';
    let nubes = '';
    const marea = this.mareas && this.enCosta(p) ? ` T${this.bajamar ? 1 : 0}` : '';
    // (VER AGUA TURBIA es un suceso: así la memoria puede esperar lo que viene después, antes de beber)
    if (this.aguaSucia && da <= 1 && agua && this.turbia(agua[0], agua[1]) && this.tick - (p.vioTurbia || -999) > TICKS_POR_DIA) { p.vioTurbia = this.tick; p.asoc.suceso('ver agua turbia', this.tick); }
    // (LA EXPECTATIVA: lo que su memoria de sucesos espera ahora —el efecto más fuerte de lo que acaba de pasar—, tal
    // cual, sin decir si es bueno o malo: eso lo aprende el núcleo con lo que siente su cuerpo)
    p.espera = this.prediccion && this.mente === 'neutro' ? this.esperaDe(p) : '0';
    const espera = this.prediccion && this.mente === 'neutro' ? ` E${p.espera}` : '';
    if (this.fisica && this.senales) {
      // (lo que nota él: lo que ha llovido en SU zona este año, y si tiene nubes encima)
      const h = this.fisica.humedadLocal(p.x, p.y);
      clima = h < 0.8 ? 's' : h > 1.2 ? 'l' : 'n';
      nubes = ` N${this.fisica.nube[this.fisica.celda(p.x, p.y)] > 0.5 ? 1 : 0}`;
    }
    // (y el cuerpo y la hora: cansado, de noche, en casa)
    const z = `Z${p.cansado ? 1 : 0}${this.esNoche ? 1 : 0}${this.enCasa(p) ? 1 : 0}${this.estacion === 'invierno' ? 'i' : this.estacion === 'otoño' ? 'o' : 'v'}`;
    // (y si le han avisado de algo que no ve: el aviso es una percepción más)
    const aviso = p.aviso && !(p.aviso.que === 'lobo' && lobo) && !(p.aviso.que === 'enemigo' && extrano) ? p.aviso.que[0] : '0';
    // (y si hay un muerto cerca, sin enterrar ni quemar)
    p.muertoCerca = this.cadaveres.size ? this.cadaverCerca(p.x, p.y, 4) : null;
    return `${nec} R${bin(dr)} M${bin(dm)} A${bin(da)} L${bin(dl)} P${bin(dp)} X${bin(dx)}${opinion} C${bin(dc)} K${clima} ${z} V${aviso} D${p.muertoCerca ? 1 : 0}${nubes}${marea}${espera}${ofensor ? ' G1' : ofendido ? ' G2' : ''}`;
  }

  contacto(p, q) {
    const k = p.tribu < q.tribu ? `${p.tribu}-${q.tribu}` : `${q.tribu}-${p.tribu}`;
    if (this.islas && this.isla(p.hogar[0], p.hogar[1]) !== this.isla(q.hogar[0], q.hogar[1])) {
      this.primeraVez(`mar-${k}`, `${p.nombre} (${this.tribus[p.tribu].nombre}) y ${q.nombre} (${this.tribus[q.tribu].nombre}) se encuentran: dos pueblos de islas distintas se ven por primera vez.`, 'contacto');
    }
    if (!this.contactos.has(k)) {
      this.contactos.add(k);
      this.anotar(`${p.nombre} (${this.tribus[p.tribu].nombre}) ve por primera vez a alguien de los ${this.tribus[q.tribu].nombre}: ${q.nombre}.`, 'contacto');
    }
  }

  decidir(p) {
    if (p.estacionVista !== this.estacion) {
      // (AL LLEGAR LA PRIMAVERA, CUÁNTO HIZO FALTA: lo que comió de su despensa en invierno y las comidas que le faltaron
      // —las veces que pasó hambre—. Esa es su reserva para el próximo invierno: una unidad de comida es una comida)
      if (this.estacion === 'primavera' && p.estacionVista === 'invierno') {
        const falto = (p.comidoInvierno || 0) + (p.hambresInvierno || 0);
        if (falto > 0) p.reservaObjetivo = falto;
        p.comidoInvierno = 0; p.hambresInvierno = 0;
      }
      p.estacionVista = this.estacion; p.asoc.suceso(`llega ${this.estacion}`, this.tick);
    }
    if (p.agravios && p.agravios.size) for (const [id, v] of p.agravios) { const w = v * 0.996; if (w < 0.05) p.agravios.delete(id); else p.agravios.set(id, w); }
    // (LO QUE SIENTE EL CUERPO desde la última decisión: si el impulso ha bajado de golpe, lo hecho fue bueno; si ha
    // subido de golpe, malo. El cerebro lo valora; el mundo solo dice cómo está el cuerpo)
    if (this.homeostasis && p.nucleo.sentir) {
      const imp = this.impulso(p);
      // (EL EPISODIO: lo que hizo la última vez y cuánto cambió su cuerpo después; se guardan los 30 más intensos del día)
      if (this.repasoPriorizado && p.impPrevio != null && p.situacion) {
        const d = p.impPrevio - imp;
        if (Math.abs(d) >= 0.02) {
          p.episodios = p.episodios || [];
          p.episodios.push([p.situacion, p.accion, d]);
          if (p.episodios.length > 30) { let k = 0; for (let i = 1; i < p.episodios.length; i++) if (Math.abs(p.episodios[i][2]) < Math.abs(p.episodios[k][2])) k = i; p.episodios.splice(k, 1); }
        }
      }
      p.impPrevio = imp;
      p.asoc.sentir(imp, this.tick);
      // (EL DOLOR DE CADA SUCESO: lo mal que está su cuerpo cuando pasa, frente a lo habitual; así sabe que «pasar
      // hambre» es malo aunque después coma. Es lo que imaginará cuando lo espere)
      p.impMedio = p.impMedio == null ? imp : p.impMedio * 0.98 + imp * 0.02;
      p.hambreMedia = p.hambreMedia == null ? p.hambre / 100 : p.hambreMedia * 0.98 + p.hambre / 100 * 0.02;
      const ult = p.asoc.recientes[p.asoc.recientes.length - 1];
      if (ult && this.tick - ult[1] < 4 && p.ultDolor !== ult) {
        // (cuánto le dolió, y qué parte de eso fue hambre: al imaginarlo, cada necesidad se imagina por su lado)
        p.ultDolor = ult; p.dolorDe = p.dolorDe || new Map();
        const v = p.dolorDe.get(ult[0]) || { t: 0, h: 0 };
        v.t += 0.2 * ((imp - p.impMedio) - v.t); v.h += 0.2 * ((p.hambre / 100 - p.hambreMedia) - v.h);
        p.dolorDe.set(ult[0], v);
      }   // (y la memoria de sucesos aprende lo que vale cada cosa por cómo queda el cuerpo)
      const r = p.nucleo.sentir(imp, this.umbralAlivio);
      if (this.metas && p.nucleo.fijarMeta) this.perseguirMeta(p);
      if (r !== 0 && this.vicario) this.observarResultado(p, r > 0);   // (antes de la lección: lo que hizo, en la situación en que lo hizo)
      if (r > 0) { this.estadHomeostasis.buenas++; this.leccion(p, () => p.nucleo.consolidar(0)); this.recordarLugar(p, p.x, p.y, 0.3); }
      else if (r < 0) { this.estadHomeostasis.malas++; this.leccion(p, () => p.nucleo.aprenderDeFracaso(null)); }
    }
    if (this.apego && p.pareja) {
      const q = this.porId.get(p.pareja);
      if (q && q.vivo && Math.max(Math.abs(p.x - q.x), Math.abs(p.y - q.y)) > 6) p.anoranza = (p.anoranza || 0) + 1;
      else p.anoranza = 0;
    }
    const s = this.percibir(p);
    p.situacion = s;
    p.concepto = percepcion.nombrar(s);
    if (!p.firma) p.firma = () => `${p.x >> 4},${p.y >> 4}`;
    const decision = p.nucleo.decidirSituacion(s, true, p.firma);
    p.exploro = false;
    let accion = decision[0];
    if (decision[1]) p.usadasHoy.add(s);
    const edadAnios = p.edad / TICKS_POR_ANIO;
    const inquieto = this.exploradores ? 0.2 * p.inquietud * p.inquietud : 0;
    let explora = (0.01 + 0.05 * p.curiosidad + inquieto) * (edadAnios < 14 ? 2 : edadAnios > EDAD_ANCIANA ? 0.5 : 1);
    // (LA CURIOSIDAD: lo poco visto atrae; lo muy visto, no. Cuántas veces ha vivido esta situación y qué probó en ella)
    let vista = null;
    if (this.curiosidadNovedad) {
      p.vistas = p.vistas || new Map();
      vista = p.vistas.get(s);
      if (!vista) { vista = { n: 0, a: {} }; p.vistas.set(s, vista); if (p.vistas.size > 300) p.vistas.delete(p.vistas.keys().next().value); }
      if (!this.curiosidadPorVisita || p.situacionVista !== s) vista.n++;
      p.situacionVista = s;
      explora = (0.02 + 0.1 * p.curiosidad + 2 * inquieto) * (edadAnios < 14 ? 2 : edadAnios > EDAD_ANCIANA ? 0.5 : 1) / Math.sqrt(vista.n);
    }
    if (this.mente !== 'instinto' && this.mente !== 'azar' && this.mente !== 'reglas' && this.azar() < explora) {
      // EXPLORAR: a veces otra cosa al azar (lo que el instinto nunca haría también se descubre); aprende de lo que HIZO.
      // El inquieto, de dos que se le ocurren, prueba la que menos ha hecho: busca lo nuevo
      accion = this.azar.elegir(ACCIONES); p.exploro = true;
      if (vista) {
        // (la que menos ha probado en esta situación: buscar información, no un dado)
        let menos = Infinity; const cand = [];
        for (const a of ACCIONES) { const k = vista.a[a] || 0; if (k < menos) { menos = k; cand.length = 0; cand.push(a); } else if (k === menos) cand.push(a); }
        accion = this.azar.elegir(cand);
        this.estadCuriosidad.exploraciones++; if (vista.n <= 3) this.estadCuriosidad.enNuevas++;
      } else if (inquieto > 0.02) { const otra = this.azar.elegir(ACCIONES); if ((p.usos[otra] || 0) < (p.usos[accion] || 0)) accion = otra; }
      const h = p.nucleo.historial[p.nucleo.historial.length - 1];
      h[2] = accion;
    }
    // ROBAR solo si hay qué: sin una despensa ajena a la vista, sigue su instinto (y así robar no se lleva méritos ajenos)
    if ((accion === 'robar' && !this.despensaAjena(p)) || (accion === 'curar' && !this.paciente(p)) || (accion === 'vigilar' && !this.esNoche) || (accion === 'muerto' && !p.muertoCerca)) {
      accion = 'instinto';
      const h = p.nucleo.historial[p.nucleo.historial.length - 1];
      if (h) h[2] = accion;
    }
    p.usos[accion] = (p.usos[accion] || 0) + 1; p.usosTotal++;
    // LA SUPERSTICIÓN: si teme lo que iba a hacer, a veces no lo hace (aunque no tenga nada que ver con la desgracia)
    const miedo = p.tabues.size ? p.tabues.get(accion) || 0 : 0;
    if (this.inducidas && miedo >= 1.5 && this.azar() < Math.min(0.5, miedo / 8)) {
      accion = 'esperar';
      const h = p.nucleo.historial[p.nucleo.historial.length - 1];
      if (h) h[2] = accion;
      this.porMiedo = (this.porMiedo || 0) + 1;
    }
    // (LA COSTUMBRE: quien sabe que «en otoño se guarda» —porque lo vio pintado o se lo contaron—, con comida en la mano,
    // a veces guarda aunque su mente no lo diría; luego el repaso dirá si le sirvió)
    if (this.contrafactual && this.estacion === 'otoño' && p.carga > 1 && (p.costumbreGuardar || 0) >= 1 && accion !== 'guardar' && this.azar() < 0.3) {
      accion = 'guardar'; this.estadRepaso.siguenCostumbre++;
      const h = p.nucleo.historial[p.nucleo.historial.length - 1]; if (h) h[2] = accion;
    }
    p.accion = accion;
    if (vista) vista.a[accion] = (vista.a[accion] || 0) + 1;
    if (this.alivio && p.espera && p.espera !== '0') {
      // (LA HUELLA: lo que hace mientras espera algo queda marcado hasta saber si llegó)
      p.huellas = p.huellas || new Map();
      const k = p.espera.slice(1), lista = p.huellas.get(k) || [];
      const j = lista.findIndex((e) => e[0] === s); if (j >= 0) lista.splice(j, 1);
      lista.push([s, accion]); if (lista.length > 20) lista.shift();
      p.huellas.set(k, lista);
    }
    if (p.espera && p.espera !== '0') { const k = `${p.espera}|${accion}`; this.estadPrediccion.accionConEspera[k] = (this.estadPrediccion.accionConEspera[k] || 0) + 1; }
    if (this.repaso && this.estacion === 'otoño' && p.carga > 0 && p.nucleo.repasar) {
      p.diario = p.diario || [];
      const j = p.diario.findIndex((e) => e[0] === s); if (j >= 0) p.diario.splice(j, 1);
      p.diario.push([s, accion]); if (p.diario.length > 30) p.diario.shift();
    }
    // (el historial de una vida larga no cabe: entre suceso y suceso se recuerda lo último)
    if (p.nucleo.historial.length > 120) p.nucleo.historial.splice(0, 60);
    this.ejecutar(p, accion);
  }

  /** De la acción a un objetivo en el mapa (el cuerpo va hacia allí un paso por tick). */
  ejecutar(p, accion) {
    const v = p.vista, campo = p.hogar;
    p.objetivo = null; p.intencion = accion;
    switch (accion) {
      case 'instinto': {   // lo que haría cualquiera sin saber nada: ir a por lo que necesita, la baya que esté más cerca
        // (el sueño: agotado, duerme donde esté; en casa, cansado y de noche, se acuesta)
        if (p.cansancio > 88 || (p.cansado && this.esNoche && this.enCasa(p))) { this.dormir(p); break; }
        if (this.inducidas && this.instintoSocial(p)) break;
        // (EL APEGO: sin sed ni hambre fuertes, de noche a casa; y si echa de menos a su pareja, a buscarla)
        // (EL COBIJO DE RAMAS: de noche, en casa y sin techo, con un par de maderas, se hace un paraviento)
        if (this.inducidas && this.refugios && this.esNoche && this.enCasa(p) && p.madera >= 2 && p.edad >= EDAD_ADULTA * TICKS_POR_ANIO && !this.refugioDe(p) && this.hacerCobijo(p)) break;
        if (this.apego && p.sed < 60 && p.hambre < 60) {
          if (this.esNoche && !this.enCasa(p) && p.edad >= 3 * TICKS_POR_ANIO) { p.objetivo = p.hogar; break; }
          const q = p.anoranza > 40 && this.porId.get(p.pareja);
          if (q && q.vivo) { p.objetivo = [q.x, q.y]; break; }
        }
        if (p.sed > 40 && p.sed >= p.hambre) p.objetivo = this.aguaParaBeber(p, v.agua) || v.agua || p.hogar;   // (sin agua a la vista, a casa)
        else if (p.hambre > 35) p.objetivo = this.masCerca(p, v.roja, v.morada) || (this.inducidas && this.sitioDeTemporada(p)) || this.pasear(p);
        else if (p.proteina < 25) p.objetivo = v.bosque || this.pasear(p);   // (larvas y huevos en el bosque)
        else if (p.vitaminas < 25) p.objetivo = v.roja || this.pasear(p);
        // (TRASTEAR: tranquilo y sin hambre, el curioso a veces prueba a combinar lo que lleva)
        else if (this.inducidas && p.hambre < 30 && p.sed < 30 && this.azar() < 0.04 * p.curiosidad && this.combinar(p)) break;
        else p.objetivo = this.pasear(p);
        break;
      }
      case 'buscar_roja': p.objetivo = v.roja || (p.sed > 40 && v.agua) || this.sitioDeTemporada(p) || this.pasear(p); break;
      case 'evitar': {
        const amenaza = (v.lobo && [v.lobo.x, v.lobo.y]) || (v.extrano && [v.extrano.x, v.extrano.y]) || (p.aviso && [p.aviso.x, p.aviso.y]) || v.morada;
        p.objetivo = amenaza ? [p.x * 2 - amenaza[0], p.y * 2 - amenaza[1]] : this.pasear(p);
        break;
      }
      case 'volver': p.objetivo = campo; break;
      // (explorar no es mudarse: quien lo prueba por curiosidad va a echar un vistazo, no se lleva a su familia)
      case 'mudarse': if (p.exploro || !this.mudarse(p)) p.objetivo = p.exploro ? this.pasear(p) : campo; break;
      case 'esperar': p.objetivo = [p.x, p.y]; break;
      case 'acercarse': p.objetivo = v.extrano ? [v.extrano.x, v.extrano.y] : v.propio ? [v.propio.x, v.propio.y] : this.pasear(p); break;
      case 'compartir': {
        // (sin nadie con quien compartir y con un lobo al lado: echarle comida)
        if (!v.extrano && !v.propio && v.lobo && p.carga > 0 && Math.max(Math.abs(v.lobo.x - p.x), Math.abs(v.lobo.y - p.y)) <= 1) { this.alimentarLobo(p, v.lobo); break; }
        const otro = v.ofendido || v.extrano || v.propio;
        if (otro && Math.max(Math.abs(otro.x - p.x), Math.abs(otro.y - p.y)) <= 1) this.compartir(p, otro);
        else p.objetivo = otro ? [otro.x, otro.y] : this.pasear(p);
        break;
      }
      case 'guardar':
        if (p.carga > 0 && this.enCasa(p)) this.guardar(p);
        else p.objetivo = p.carga > 0 ? p.hogar : (p.vista.roja || this.pasear(p));
        break;
      case 'sembrar':
        if (!this.sembrar(p)) p.objetivo = p.carga > 0 ? (p.vista.agua || p.hogar) : (p.vista.roja || this.pasear(p));
        break;
      case 'dormir':
        // tumbarse aquí mismo (si está cansado; si no, no hay sueño)
        if (p.cansancio > 30) this.dormir(p);
        else p.objetivo = this.pasear(p);
        break;
      case 'pescar':
        if (v.agua && Math.max(Math.abs(v.agua[0] - p.x), Math.abs(v.agua[1] - p.y)) <= 1) this.pescar(p);
        else p.objetivo = v.agua || this.pasear(p);
        break;
      case 'cazar':
        if (v.ciervo && !v.ciervo.oido && Math.max(Math.abs(v.ciervo.x - p.x), Math.abs(v.ciervo.y - p.y)) <= 1) this.cazar(p, v.ciervo);
        else p.objetivo = v.ciervo ? [v.ciervo.x, v.ciervo.y] : (this.sitioDeCaza(p) || this.pasear(p));
        break;
      case 'fabricar':
        if (!this.fabricar(p)) p.objetivo = v.bosque || v.roca || this.pasear(p);
        break;
      case 'construir':
        if (!this.inducidas && this.refugios && !this.refugioDe(p) && p.madera >= 2 && this.enCasa(p)) { this.construir(p); break; }
        if (this.refugios && !this.refugioDe(p) && p.madera >= 4 && p.fibra < 2 && p.pieles < 1) { if (!this.fabricar(p)) p.objetivo = v.bosque || this.pasear(p); }
        else if (p.madera < 3 || (this.refugios && !this.refugioDe(p) && p.madera < 4)) { if (!this.fabricar(p, true)) p.objetivo = v.bosque || this.pasear(p); }
        else if (Math.max(Math.abs(p.x - p.hogar[0]), Math.abs(p.y - p.hogar[1])) <= 2) this.construir(p);
        else p.objetivo = p.hogar;
        break;
      case 'muerto': {
        const c = p.muertoCerca;
        if (!c || p.edad < EDAD_ADULTA * TICKS_POR_ANIO) { p.objetivo = [p.x, p.y]; break; }
        if (Math.max(Math.abs(c.x - p.x), Math.abs(c.y - p.y)) <= 1) this.atenderMuerto(p, c); else p.objetivo = [c.x, c.y];
        break;
      }
      case 'combinar':
        if (!this.combinar(p)) p.objetivo = v.bosque || v.roca || this.pasear(p);
        break;
      case 'curar': {
        const q = this.paciente(p);
        if (!q) { p.objetivo = [p.x, p.y]; break; }
        if (Math.max(Math.abs(q.x - p.x), Math.abs(q.y - p.y)) <= 1) this.curar(p, q); else p.objetivo = [q.x, q.y];
        break;
      }
      case 'vigilar':
        // (de noche y en casa, despierto: los que duermen cerca están a salvo; de día no tiene sentido)
        if (this.esNoche) { p.objetivo = this.enCasa(p) ? [p.x, p.y] : p.hogar; p.vigila = this.tick + 6; p.cansancio = Math.min(100, p.cansancio + 0.3); }
        else p.objetivo = [p.x, p.y];
        break;
      case 'robar': {
        const k = this.despensaAjena(p);
        if (!k) { p.objetivo = [p.x, p.y]; break; }   // (sin nada que robar no hace nada: robar no es pasear)
        const [hx, hy] = k.split(',').map(Number);
        if (Math.max(Math.abs(hx - p.x), Math.abs(hy - p.y)) <= 1) this.robar(p, k);
        else p.objetivo = [hx, hy];
        break;
      }
      case 'atacar': {
        const blanco = v.lobo || v.ofensor || v.extrano;
        if (blanco && blanco === v.ofensor && Math.max(Math.abs(blanco.x - p.x), Math.abs(blanco.y - p.y)) <= 1) this.estadIndignacion.ataquesAlOfensor++;
        if (blanco && Math.max(Math.abs(blanco.x - p.x), Math.abs(blanco.y - p.y)) <= 1) { this.origenAtaque = blanco === v.lobo ? 'accion-lobo' : blanco === v.ofensor ? 'accion-ofensor' : 'accion-extraño'; this.atacar(p, blanco); }
        else p.objetivo = blanco ? [blanco.x, blanco.y] : this.pasear(p);
        break;
      }
    }
  }

  /**
   * EL INSTINTO SOCIAL (no se aprende: lo corrige la experiencia). Con la familia hambrienta, compartir; con un extraño
   * neutral, curiosidad (acercarse y a veces ofrecer comida); con un enemigo, atacar si se ve más fuerte, si no
   * apartarse; y con hambre de verdad, asaltar a un extraño que lleva comida (las guerras nacen de las hambrunas).
   * Devuelve si ha decidido algo.
   */
  instintoSocial(p) {
    const v = p.vista, d = (q) => Math.max(Math.abs(q.x - p.x), Math.abs(q.y - p.y));
    // (no se comparte con quien se tiene por ladrón o enemigo: la reputación cuenta)
    if (v.propio && p.carga > 0 && v.propio.hambre > 60 && d(v.propio) <= 1 && this.opinionDe(p, v.propio) > -3) { this.compartir(p, v.propio); return true; }
    // GRATITUD: a quien le ayudó (le aprecia mucho) y tiene hambre, le devuelve el favor, sea de donde sea
    for (const q of [v.propio, v.extrano]) {
      if (!q || p.carga <= 0 || q.hambre <= 50 || d(q) > 1) continue;
      const e = p.conocidos.get(q.id);
      if (e && e.afecto >= 5) { this.devueltos = (this.devueltos || 0) + 1; this.compartir(p, q); return true; }
    }
    // VENGANZA: a alguien de su propio pueblo que le hizo mucho daño (le odia), si se ve con fuerzas y no es de buen genio
    if (v.propio && p.genio > -0.3) {
      const e = p.conocidos.get(v.propio.id);
      if (e && e.afecto <= -6 && p.salud >= v.propio.salud) {
        if (d(v.propio) <= 1) this.vengar(p, v.propio); else p.objetivo = [v.propio.x, v.propio.y];
        return true;
      }
    }
    // (con mucha hambre, el de mal genio va a por la despensa de otro)
    if (p.hambre > 70 && p.genio > 0.3 && this.azar() < p.genio * 0.3) {
      const k = this.despensaAjena(p);
      if (k) { const [hx, hy] = k.split(',').map(Number); if (Math.max(Math.abs(hx - p.x), Math.abs(hy - p.y)) <= 1) this.robar(p, k); else p.objetivo = [hx, hy]; return true; }
    }
    const x = v.extrano;
    if (!x) return false;
    const opinion = this.opinionDe(p, x);
    if (opinion <= -3 + p.genio * 1.5) {
      if (p.salud >= x.salud) { if (d(x) <= 1) { this.origenAtaque = 'instinto-enemigo'; this.atacar(p, x); } else p.objetivo = [x.x, x.y]; }
      else p.objetivo = [p.x * 2 - x.x, p.y * 2 - x.y];
      return true;
    }
    if (p.hambre > 60 && x.carga > 0) { if (d(x) <= 1) { this.origenAtaque = 'instinto-asalto'; this.atacar(p, x); } else p.objetivo = [x.x, x.y]; return true; }
    if (p.hambre < 50 && this.azar() < 0.3 * (1 - p.genio * 0.7)) {
      if (d(x) <= 1) { if (p.carga > 0 || opinion >= 3) this.compartir(p, x); }
      else p.objetivo = [x.x, x.y];
      return true;
    }
    return false;
  }

  masCerca(p, a, b) {
    if (!a) return b; if (!b) return a;
    return Math.max(Math.abs(a[0] - p.x), Math.abs(a[1] - p.y)) <= Math.max(Math.abs(b[0] - p.x), Math.abs(b[1] - p.y)) ? a : b;
  }

  pasear(p) {
    const c = p.hogar;
    const lejos = Math.hypot(p.x - c[0], p.y - c[1]) > 14;
    // (EXPLORAR EN BALSA: el curioso que tiene balsa a veces se lanza lejos, al otro lado del agua)
    if (this.uso(p, 'flota') >= 0.5 && this.azar() < 0.04 * p.curiosidad) {
      const ang = this.azar() * Math.PI * 2, d = 20 + this.azar() * 25;
      return [Math.round(p.x + Math.cos(ang) * d), Math.round(p.y + Math.sin(ang) * d)];
    }
    if (lejos && this.azar() < 0.5) return c;
    // (entre dos rumbos al azar, el de la zona que recuerda mejor: se evitan los sitios malos y se vuelve a los buenos)
    const a = [p.x + this.azar.entero(9) - 4, p.y + this.azar.entero(9) - 4], b = [p.x + this.azar.entero(9) - 4, p.y + this.azar.entero(9) - 4];
    return (p.lugares.get(this.zona(a[0], a[1])) || 0) >= (p.lugares.get(this.zona(b[0], b[1])) || 0) ? a : b;
  }

  /** PRESTIGIO: lo que respeta su pueblo (la edad, los hijos, las herramientas, cuánta gente le conoce). */
  prestigio(p) {
    const fama = this.fama && this.fama.get(p.id);
    return p.edad / TICKS_POR_ANIO / 10 + p.hijos.length * 0.6 + p.cosas.length + p.objetos.size + (fama ? fama.n / 10 : 0);
  }

  mover(p) {
    if (!p.objetivo) return;
    if (p.edad > EDAD_ANCIANA * TICKS_POR_ANIO && (this.tick + p.id) % 3 === 0) return;   // (los mayores, más despacio)
    const dx = Math.sign(p.objetivo[0] - p.x), dy = Math.sign(p.objetivo[1] - p.y);
    if (dx === 0 && dy === 0) return;
    for (const [mx, my] of [[dx, dy], [dx, 0], [0, dy]]) {
      if ((mx || my) && this.pisableP(p, p.x + mx, p.y + my)) {
        p.x += mx; p.y += my;
        if (this.islas && this.pisable(p.x, p.y)) {
          const is = this.isla(p.x, p.y);
          if (p.islaNatal == null) p.islaNatal = is;
          else if (is !== p.islaNatal && !p.cruzo) {
            p.cruzo = true; this.cruces = (this.cruces || 0) + 1;
            this.primeraVez(`cruce-${p.tribu}`, `${p.nombre} (${this.tribus[p.tribu].nombre}) cruza el mar en balsa y pisa otra isla: la primera vez para su pueblo.`, 'invento');
          }
        }
        return;
      }
    }
  }

  usarSitio(p) {
    const i = p.y * this.ancho + p.x;
    // la despensa: en casa y con hambre, se come de lo guardado
    if (p.hambre > 45 && this.enCasa(p)) {
      const t = this.tribus[p.tribu];
      if (t.reparto === 'comun') {
        // (EL GRANERO DEL PUEBLO: come cualquiera, haya guardado o no)
        const g = this.graneros.get(t.id) || 0;
        if (g > 0) { this.graneros.set(t.id, g - 1); p.hambre = Math.max(0, p.hambre - 35); p.comioDelGranero = (p.comioDelGranero || 0) + 1; if (this.estacion === 'invierno') p.comioGuardado = true; this.acierto(p); }
      } else {
        const k = `${p.hogar[0]},${p.hogar[1]}`, d = this.despensas.get(k) || 0;
        if (d > 0) { this.despensas.set(k, d - 1); p.hambre = Math.max(0, p.hambre - 35); if (this.estacion === 'invierno') { p.comioGuardado = true; p.comidoInvierno = (p.comidoInvierno || 0) + 1; if (this.contrafactual) for (const q of this.cercanos(p.x, p.y, 3)) if (q !== p && q.tribu === p.tribu) q.vioComerGuardado = true; } p.proteina = Math.min(100, p.proteina + 8); p.vitaminas = Math.min(100, p.vitaminas + 8); if (this.calor[i]) this.cocinar(p); this.acierto(p); }
      }
    }
    // beber: junto al agua y con sed
    if (p.sed > 25 && p.accion !== 'evitar' && this.cerca(p.x, p.y, 1, (x, y) => this.t(x, y) === TERRENO.AGUA) && this.beber(p)) { p.sed = 0; this.acierto(p); }
    // (EL PREVISOR: quien sabe que tras la tierra encharcada vienen las langostas, guarda lo que lleva al llegar a casa)
    if (p.previsor > this.tick && p.carga > 0 && this.enCasa(p)) { this.estadLangostas.guardadoPrevisor += p.carga; this.guardar(p); }
    if (this.fruta[i] > 0 && this.baya[i] > 2 && (p.hambre > 30 || p.vitaminas < 30)) { this.comerPlanta(p, i); return; }
    if (this.fruta[i] > 0 && this.baya[i] <= 2 && (p.hambre > 30 || p.vitaminas < 30 || p.carga < this.capacidad(p))) {
      if (this.baya[i] === 2) {
        if (p.hambre > 30) { this.fruta[i]--; p.hambre = Math.max(0, p.hambre - 10); this.herir(p, 35, 'veneno'); }
      } else if (p.hambre > 30 || p.vitaminas < 30) {
        // (solo es un acierto si cubre lo que le hacía falta: con hambre o con falta de fruta; con falta de carne, no)
        const servia = p.hambre > 50 || p.vitaminas < 25 || p.proteina >= 25;
        this.fruta[i]--; this.desgaste[i] += 0.5; p.hambre = Math.max(0, p.hambre - 40); p.vitaminas = Math.min(100, p.vitaminas + 35);
        if (this.calor[i]) this.cocinar(p);
        this.practicar(p, 'recoger', 0.2);
        if (servia) this.acierto(p);
      } else {
        this.fruta[i]--; this.desgaste[i] += 0.5; p.carga++;
        if (p.carga > 3) this.servir(p, 'carga', 0.05);   // (lleva más de lo que cabe en las manos: le sirve)
        // (quien recoge mucho, recoge mejor: a veces se lleva una más)
        if (p.pericia.recoger >= 10 && this.fruta[i] > 0 && p.carga < this.capacidad(p) && this.azar() < 0.3) { this.fruta[i]--; p.carga++; }
        this.practicar(p, 'recoger', 0.2);
      }
    }
    // EL FUEGO NATURAL: junto a unas brasas (de un rayo o un incendio), con madera, se puede llevar el fuego a casa
    if (!p.brasa && p.madera > 0 && this.calor[i] && p.edad >= EDAD_ADULTA * TICKS_POR_ANIO) {
      const h = this.hogueraCerca(p.x, p.y, 2);
      if (h && h.natural && !this.hogueras.has(`${p.hogar[0]},${p.hogar[1]}`)) { p.brasa = this.tick + 160; p.madera--; }
    }
    if (p.brasa) {
      if (this.tick > p.brasa) p.brasa = 0;
      else if (this.enCasa(p)) {
        p.brasa = 0;
        if (this.encender(p.hogar[0], p.hogar[1], p, false))
          this.primeraVez(`brasa-${p.tribu}`, `${p.nombre} (${this.tribus[p.tribu].nombre}) se lleva unas brasas de un fuego del cielo y enciende una hoguera en su hogar: los ${this.tribus[p.tribu].nombre} ya tienen fuego (aunque aún no saben hacerlo).`, 'invento');
      }
    }
    // LARVAS Y HUEVOS: en el bosque, con falta de carne, algo se encuentra (poco: pescar y cazar es mucho mejor)
    if (p.proteina < 40 && this.terreno[i] === TERRENO.BOSQUE && this.azar() < 0.02) {
      p.proteina = Math.min(100, p.proteina + 5);
      if (p.proteina >= 25 && p.proteina < 30) this.acierto(p);
    }
  }

  /** GUARDAR en la despensa de su hogar lo que lleva (para cuando falte). Es un acierto inmediato, como fabricar. */
  guardar(p) {
    const t = this.tribus[p.tribu];
    p.aporto = (p.aporto || 0) + p.carga;
    let carga = p.carga;
    // (EL TRIBUTO: en una jefatura, un tercio va a la despensa del jefe)
    const jefe = t.gobierno === 'jefatura' && this.lideres && this.porId.get(this.lideres.get(t.id));
    if (jefe && jefe.vivo && jefe !== p && carga) {
      const tributo = Math.max(1, Math.round(carga / 3));
      const kj = `${jefe.hogar[0]},${jefe.hogar[1]}`;
      this.despensas.set(kj, Math.min(60, (this.despensas.get(kj) || 0) + tributo));
      carga -= tributo; t.tributo = (t.tributo || 0) + tributo;
    }
    if (t.reparto === 'comun') this.graneros.set(t.id, Math.min(40 + t.vivos * 2, (this.graneros.get(t.id) || 0) + carga));
    else { const k = `${p.hogar[0]},${p.hogar[1]}`; this.despensas.set(k, Math.min(30, (this.despensas.get(k) || 0) + carga)); }
    if (this.pudrir) this.estadPudrir.guardadoPor[this.estacion] += p.carga;
    // (AGENCIA: lo que guarda él cuenta para su meta, y el logro se siente ahora, sobre lo que acaba de hacer: guardar)
    if (this.metas && this.agencia && p.nucleo.meta && p.reservaObjetivo && p.carga > 0) {
      p.guardadoPropio = (p.guardadoPropio || 0) + p.carga;
      if (p.nucleo.avanzarMeta(p.guardadoPropio / p.reservaObjetivo) > 0) {
        this.estadMetas.logros++;
        this.leccion(p, () => { for (let k = 0; k < this.valorMeta; k++) p.nucleo.consolidar(0); });
        this.primeraVez(`meta-${p.tribu}`, `${p.nombre} (${this.tribus[p.tribu].nombre}) guarda comida pensando en el invierno que imagina, y nota que va por buen camino.`, 'idea');
      }
    }
    { const d = Math.floor(this.anio / 10); const g = this.guardadoSerie[d] || (this.guardadoSerie[d] = { otono: 0, total: 0 }); g.total += p.carga; if (this.estacion === 'otoño') g.otono += p.carga; }
    p.carga = 0;
    this.efecto('objeto', p.x, p.y);
    this.inventoPrimero(p, 'despensa', 'guarda comida en su hogar para cuando falte');
    this.acierto(p);
  }

  /**
   * SEMBRAR: con una baya en la mano, en hierba libre cerca de casa y del agua, planta un arbusto que da fruto dentro de
   * un año. El nacimiento de la agricultura. (Sembrar es un acierto inmediato: el fruto llega mucho después.)
   */
  sembrar(p) {
    if (p.carga < 1 || this.t(p.x, p.y) !== TERRENO.HIERBA) return false;
    const i = p.y * this.ancho + p.x;
    if (this.baya[i] || Math.max(Math.abs(p.x - p.hogar[0]), Math.abs(p.y - p.hogar[1])) > 5) return false;
    if (!this.cerca(p.x, p.y, 3, (x, y) => this.t(x, y) === TERRENO.AGUA)) return false;
    p.carga--;
    this.apuntarArbusto(i);
    this.baya[i] = 1; this.fruta[i] = 0;
    this.brotes.set(i, this.tick + Math.round(TICKS_POR_ANIO * (1 - Math.min(0.5, p.pericia.sembrar / 30))));
    this.practicar(p, 'sembrar', 1);
    this.huertos.add(i);
    this.efecto('objeto', p.x, p.y);
    this.inventoPrimero(p, 'siembra', 'siembra una baya: nace la agricultura');
    this.acierto(p);
    return true;
  }

  /** IMITAR: un niño copia la neurona de lo que un adulto de su pueblo, cerca, está haciendo ahora. */
  imitar(p) {
    const cerca = this.cercanos(p.x, p.y, 2).filter((q) => q !== p && q.tribu === p.tribu && q.edad >= EDAD_ADULTA * TICKS_POR_ANIO && !q.dormido);
    if (!cerca.length) return;
    // (a quién se imita depende de la condición: al más respetado, al que mejor vive, o lo que hace la mayoría)
    let q;
    if (this.copia === 'mayoria') {
      const cuenta = new Map();
      for (const r of cerca) cuenta.set(r.accion, (cuenta.get(r.accion) || 0) + 1);
      const comun = [...cuenta].sort((a, b) => b[1] - a[1])[0][0];
      q = cerca.find((r) => r.accion === comun);
    } else q = this.modelo(cerca);
    const n = q.nucleo.neuronas.get(q.situacion);
    if (!n || n.accion === 'instinto' || p.nucleo.neuronas.size >= MAX_NEURONAS) return;
    const suya = p.nucleo.neuronas.get(q.situacion);
    if (suya && suya.accion === n.accion) return;
    p.nucleo.neuronas.set(q.situacion, { concepto: n.concepto, fallos: { ...n.fallos }, aciertos: n.aciertos ? { ...n.aciertos } : undefined, accion: n.accion });
    const o = q.origen.get(q.situacion) || { autor: q.id, nombre: q.nombre, tribu: q.tribu, anio: this.anio, manos: 0 };
    p.origen.set(q.situacion, { ...o, manos: o.manos + 1, de: q.id, cuando: this.anio, imitada: true });
  }

  /**
   * EL SUEÑO CONSOLIDA Y OLVIDA (Quian Quiroga: recordar exige olvidar). Al despertar: lo que usó ese día y le funcionó
   * se refuerza; lo que apenas ha vivido y no ha usado, a veces se olvida; la memoria de sucesos se desvanece un poco.
   */
  consolidarSueno(p) {
    let reforzadas = 0, olvidadas = 0;
    for (const [k, n] of p.nucleo.neuronas) {
      if (p.usadasHoy.has(k)) {
        if (n.aciertos && n.aciertos[n.accion] > 0) { n.aciertos[n.accion] += 0.5; reforzadas++; }
      } else if (this.azar() < 0.25 && !n.protegida && experiencia(n) < 1) {
        p.nucleo.neuronas.delete(k); p.origen.delete(k); olvidadas++;
      }
    }
    p.asoc.olvidar(0.98);
    p.usadasHoy.clear();
    p.ultimoSueno = { reforzadas, olvidadas, anio: this.anio };
  }

  // ---- personas concretas ----
  /** Lo que p opina de q: si le conoce, su afecto personal pesa más que lo que opine de su pueblo. */
  opinionDe(p, q) {
    const e = p.conocidos.get(q.id);
    // (a un extraño con tu misma seña se le mira mejor: favoritismo por una pintura, nada más)
    if (e && Math.abs(e.afecto) >= 2) return e.afecto;
    let base = p.afinidad[q.tribu] + (p.marca === q.marca && p.tribu !== q.tribu ? 1.5 : 0);
    // (en una jefatura en guerra, el enemigo del jefe es enemigo de todos: se obedece)
    if (this.inducidas && p.tribu !== q.tribu && this.tribus[p.tribu].gobierno === 'jefatura' && this.relaciones.get(p.tribu < q.tribu ? `${p.tribu}-${q.tribu}` : `${q.tribu}-${p.tribu}`) === 'guerra') base = Math.min(base, -4);
    return base;
  }

  /** A QUIEN LE VA BIEN: salud, comida, hijos vivos y herramientas (lo que se ve desde fuera). */
  exito(p) {
    return p.salud / 100 + (100 - p.hambre) / 100 + p.hijos.filter((h) => { const q = this.porId.get(h); return q && q.vivo; }).length * 0.4 + (p.cosas.length + p.objetos.size) * 0.3;
  }

  /** El modelo al que copiar, según la condición: el más respetado o el que mejor vive. */
  modelo(cands) {
    const f = this.copia === 'exito' ? (q) => this.exito(q) : (q) => this.prestigio(q);
    return cands.reduce((a, b) => (f(b) > f(a) ? b : a));
  }

  /**
   * CONFORMISMO: q copia de p una idea solo si la tiene la mayoría de los suyos que andan cerca. Devuelve si copió.
   */
  heredarConforme(q, p) {
    const grupo = this.cercanos(q.x, q.y, 5).filter((r) => r !== q && r.tribu === q.tribu && r.edad >= EDAD_ADULTA * TICKS_POR_ANIO);
    if (grupo.length < 2) return false;
    const todas = [...p.nucleo.neuronas];
    for (let k = 0; k < 6 && todas.length; k++) {
      const [sit, n] = todas[this.azar.entero(todas.length)];
      if (n.accion === 'instinto') continue;
      const suya = q.nucleo.neuronas.get(sit);
      if (suya && suya.accion === n.accion) continue;
      let iguales = 0;
      for (const r of grupo) { const m = r.nucleo.neuronas.get(sit); if (m && m.accion === n.accion) iguales++; }
      if (iguales * 2 < grupo.length || q.nucleo.neuronas.size >= MAX_NEURONAS) continue;
      q.nucleo.neuronas.set(sit, { concepto: n.concepto, fallos: { ...n.fallos }, aciertos: n.aciertos ? { ...n.aciertos } : undefined, accion: n.accion });
      const o = p.origen.get(sit) || { autor: p.id, nombre: p.nombre, tribu: p.tribu, anio: this.anio, manos: 0 };
      q.origen.set(sit, { ...o, manos: o.manos + 1, de: p.id, cuando: this.anio });
      return true;
    }
    return false;
  }

  /** p conoce (o recuerda mejor) a q: su afecto cambia en `delta`. Caben 40; se olvida al que menos importa. */
  conocer(p, q, delta, enPersona = true, de = null) {
    let e = p.conocidos.get(q.id);
    if (!e) {
      if (p.conocidos.size >= 40) {
        let peor = null, v = Infinity;
        for (const [id, x] of p.conocidos) { const imp = Math.abs(x.afecto) * (x.enPersona ? 2 : 1); if (imp < v) { v = imp; peor = id; } }
        p.conocidos.delete(peor);
      }
      e = { afecto: 0, veces: 0, enPersona: false, de: null };
      p.conocidos.set(q.id, e);
    }
    e.afecto = Math.max(-10, Math.min(10, e.afecto + delta));
    e.veces++;
    if (enPersona) e.enPersona = true; else if (e.de == null) e.de = de;
  }

  // ---- palabras y avisos ----
  /**
   * ¿Entiende `a` a `de` cuando le cuenta esta idea? Hace falta la misma palabra para su concepto y para su acción.
   * Quien enseña nombra lo que aún no tiene nombre; quien no entiende se queda con las palabras (a veces), no con la idea.
   */
  seEntienden(a, de, n) {
    let entiende = true;
    const claves = this.gramatica === 'holistica' ? [`f:${n.concepto}|${n.accion}`] : [`c:${n.concepto}`, `a:${n.accion}`];
    const dichas = [];
    for (const k of claves) {
      let w = de.palabras.get(k);
      if (!w) { w = this.gramatica === 'holistica' ? this.inventarFrase(de, n) : this.inventarPalabra(de); de.palabras.set(k, w); this.palabraNueva(de, k, w); this.palabrasInventadas = (this.palabrasInventadas || 0) + 1; }
      dichas.push(w);
      if (a.palabras.get(k) !== w) { entiende = false; if (!a.palabras.has(k) || this.azar() < 0.3) a.palabras.set(k, w); }
    }
    // (CONTAR LO QUE SE HA VIVIDO: al hablar, quien enseña nombra también algo que vio —un rayo, lo que cayó del cielo—
    // y el otro, si no tenía palabra para eso, se queda con la suya: así lo que vieron unos pocos llega a todo el pueblo)
    if (this.lenguaje && a.tribu === de.tribu && this.azar() < 0.5) {
      const vividas = []; for (const k of de.palabras.keys()) if (k.startsWith('e:') || k.startsWith('m:')) vividas.push(k);
      if (vividas.length) { const k = this.azar.elegir(vividas); if (!a.palabras.has(k)) a.palabras.set(k, de.palabras.get(k)); }
    }
    if (entiende) this.ensenadasHablando = (this.ensenadasHablando || 0) + 1;
    else this.noEntendidas = (this.noEntendidas || 0) + 1;
    // (la frase se ve en el mapa, a veces)
    if (this.verEfectos && this.azar() < 0.15) { this.efecto('grito', de.x, de.y); this.efectos[this.efectos.length - 1].palabra = dichas.join(' '); }
    return entiende;
  }

  /**
   * GRAMÁTICA HOLÍSTICA: una palabra para la idea entera. Al inventarla, se reaprovecha la primera mitad de otra frase que
   * ya sepa con el mismo concepto y la segunda de otra con la misma acción (si las sabe). Si eso se impone generación
   * tras generación, aparece la estructura sola: la lengua se vuelve composicional (Kirby).
   */
  inventarFrase(p, n) {
    let ini = null, fin = null;
    for (const [k, w] of p.palabras) {
      if (!k.startsWith('f:') || !w.includes('-')) continue;
      const [c, a] = k.slice(2).split('|');
      if (!ini && c === n.concepto) ini = w.split('-')[0];
      if (!fin && a === n.accion) fin = w.split('-')[1];
      if (ini && fin) break;
    }
    const sil = this.tribus[p.tribu].silabas;
    return `${ini || this.azar.elegir(sil)}-${fin || this.azar.elegir(sil)}`;
  }

  /**
   * CUÁNTA ESTRUCTURA TIENE una lengua holística: de las frases que comparten concepto, en cuántas pares coincide la
   * primera mitad; de las que comparten acción, la segunda. Por azar sería 1 de cada 8 (las sílabas de un pueblo).
   */
  composicionalidad(lengua) {
    const frases = [...lengua].filter(([k, w]) => k.startsWith('f:') && w.includes('-')).map(([k, w]) => { const [c, a] = k.slice(2).split('|'); const [x, y] = w.split('-'); return { c, a, x, y }; });
    let pares = 0, iguales = 0;
    for (let i = 0; i < frases.length; i++) for (let j = i + 1; j < frases.length; j++) {
      if (frases[i].c === frases[j].c) { pares++; if (frases[i].x === frases[j].x) iguales++; }
      if (frases[i].a === frases[j].a) { pares++; if (frases[i].y === frases[j].y) iguales++; }
    }
    return pares >= 5 ? +(iguales / pares).toFixed(2) : null;
  }

  /** HABLAR de lo que se ve, a quien le hace falta: ciervo (a los que tienen hambre o falta de carne), bayas, agua. */
  hablar(p, v) {
    if (p.dormido || p.edad < EDAD_ADULTA * TICKS_POR_ANIO || this.azar() > 0.3 * (1 - p.genio * 0.5)) return;
    const suyos = this.cercanos(p.x, p.y, 7).filter((q) => q !== p && q.tribu === p.tribu && !q.dormido && q.edad >= 3 * TICKS_POR_ANIO);
    if (!suyos.length) return;
    let que = null, x, y;
    if (v.ciervo && !v.ciervo.oido && v.dc <= 3 && (p.accion === 'cazar' || suyos.some((q) => q.hambre > 40 || q.proteina < 40))) { que = 'ciervo'; x = v.ciervo.x; y = v.ciervo.y; }
    else if (v.roja && v.dr <= 3 && suyos.some((q) => (q.hambre > 50 || q.vitaminas < 30) && Math.max(Math.abs(q.x - v.roja[0]), Math.abs(q.y - v.roja[1])) > 3)) { que = 'bayas'; [x, y] = v.roja; }
    else if (v.agua && v.da <= 3 && suyos.some((q) => q.sed > 50 && Math.max(Math.abs(q.x - v.agua[0]), Math.abs(q.y - v.agua[1])) > 3)) { que = 'agua'; [x, y] = v.agua; }
    if (!que) return;
    this.dichos = (this.dichos || 0) + 1;
    this.gritar(p, que, x, y);
  }

  /** Un cambio de sonido: una vocal por otra, o una sílaba por otra de su pueblo (las de los pueblos nuevos ya son otras). */
  cambiarSonido(w, tribu) {
    this.cambiosDeSonido = (this.cambiosDeSonido || 0) + 1;
    const vocales = 'aeiou';
    if (this.azar() < 0.6) {
      const pos = [...w].map((c, i) => (vocales.includes(c) ? i : -1)).filter((i) => i >= 0);
      if (pos.length) { const i = this.azar.elegir(pos); return w.slice(0, i) + vocales[this.azar.entero(5)] + w.slice(i + 1); }
    }
    const s = this.azar.elegir(tribu.silabas);
    return this.azar() < 0.5 ? s + w.slice(Math.ceil(w.length / 2)) : w.slice(0, Math.floor(w.length / 2)) + s;
  }

  /**
   * LAS LENGUAS DE LOS PUEBLOS, cada año: la palabra que más usan los adultos de cada pueblo para cada cosa, y cuánto se
   * parecen las lenguas entre sí (de las cosas que los dos nombran, en cuántas usan la misma palabra).
   */
  medirLenguas(vivos) {
    const antes = this.lenguas || new Map();
    this.lenguas = new Map();
    for (const t of this.tribus) {
      const suyos = vivos.filter((p) => p.tribu === t.id && p.edad >= EDAD_ADULTA * TICKS_POR_ANIO);
      if (suyos.length < 3) {
        // (LA MUERTE DE UNA LENGUA, cuando el pueblo se extingue: cuántas de sus palabras siguen vivas en otros pueblos)
        if (t.vivos <= 0 && antes.has(t.id) && !t.lenguaMuerta) {
          t.lenguaMuerta = true;
          const suya = antes.get(t.id);
          let viven = 0;
          for (const [k, w] of suya) if ([...antes].some(([o, l]) => o !== t.id && l.get(k) === w)) viven++;
          this.anotar(`Muere la lengua de los ${t.nombre}: tenía ${suya.size} palabras; ${viven ? `${viven} siguen vivas en otros pueblos` : 'ninguna sobrevive'}.`, 'extincion');
        }
        if (antes.has(t.id)) this.lenguas.set(t.id, antes.get(t.id));   // (con pocos adultos, se guarda la que tenía)
        continue;
      }
      const cuenta = new Map();
      for (const p of suyos) for (const [k, w] of p.palabras) { let m = cuenta.get(k); if (!m) cuenta.set(k, m = new Map()); m.set(w, (m.get(w) || 0) + 1); }
      const lengua = new Map();
      for (const [k, m] of cuenta) { const [w, n] = [...m].sort((a, b) => b[1] - a[1])[0]; if (n >= suyos.length * 0.25) lengua.set(k, w); }
      this.lenguas.set(t.id, lengua);
    }
    this.parecido = new Map();
    const ids = [...this.lenguas.keys()];
    for (const a of ids) for (const b of ids) {
      if (b <= a) continue;
      const la = this.lenguas.get(a), lb = this.lenguas.get(b);
      let comun = 0, iguales = 0;
      for (const [k, w] of la) if (lb.has(k)) { comun++; if (lb.get(k) === w) iguales++; }
      if (comun >= 5) this.parecido.set(`${a}-${b}`, +(iguales / comun).toFixed(2));
    }
    // (UN PUEBLO NACIDO DE OTRO YA HABLA DISTINTO: la primera vez que se parecen menos de la mitad)
    for (const t of this.tribus) {
      if (t.madre == null || t.hablaDistinto) continue;
      const k = `${Math.min(t.id, t.madre)}-${Math.max(t.id, t.madre)}`, s = this.parecido.get(k);
      if (s != null && s < 0.5) { t.hablaDistinto = true; this.anotar(`Los ${t.nombre} ya no hablan como los ${this.tribus[t.madre].nombre}, de quienes descienden: solo comparten el ${Math.round(s * 100)} % de sus palabras.`, 'idea'); }
    }
  }

  inventarPalabra(p) {
    const sil = this.tribus[p.tribu].silabas;
    return this.azar.elegir(sil) + this.azar.elegir(sil);
  }

  /** Apunta quién dijo primero una palabra en su pueblo, y cuándo (el diccionario lo enseña). */
  palabraNueva(p, k, w) {
    const clave = `${p.tribu}|${k}`;
    if (!this.origenPalabras.has(clave)) this.origenPalabras.set(clave, { palabra: w, anio: this.anio, quien: p.nombre });
  }

  /**
   * PONERLE NOMBRE A LO QUE SE VE JUNTOS (el juego de nombrar, para todo lo nuevo): cuando pasa algo que llama la
   * atención (un rayo, un incendio, algo que cae del cielo, un muerto, un perro...), de cada pueblo que lo ve, uno lo
   * nombra con su palabra (o se la inventa, si nadie de los que miran la tiene) y los suyos que también lo ven la
   * aprenden. Así cada pueblo llena su vocabulario con lo que le pasa de verdad, y de otro modo que sus vecinos.
   */
  nombrarSuceso(que, x, y, radio = 6) {
    if (!this.lenguaje) return;
    const porPueblo = new Map();
    for (const q of this.cercanos(x, y, radio)) {
      if (!q.vivo || q.dormido || q.edad < 3 * TICKS_POR_ANIO) continue;
      let l = porPueblo.get(q.tribu); if (!l) porPueblo.set(q.tribu, l = []); l.push(q);
    }
    for (const qs of porPueblo.values()) {
      const habla = qs.find((q) => q.palabras.has(que)) || qs[0];
      let w = habla.palabras.get(que);
      if (!w) { w = this.inventarPalabra(habla); habla.palabras.set(que, w); this.palabraNueva(habla, que, w); this.palabrasInventadas = (this.palabrasInventadas || 0) + 1; }
      for (const q of qs) if (q !== habla && (!q.palabras.has(que) || this.azar() < 0.3)) q.palabras.set(que, w);
      if (qs.length > 1 && this.verEfectos && this.azar() < 0.5) { this.efecto('grito', habla.x, habla.y); this.efectos[this.efectos.length - 1].palabra = w; }
    }
  }

  /**
   * GRITAR un aviso con su palabra. Quien la oye y la entiende (tiene la misma palabra para lo mismo) sabe que hay un
   * lobo o un enemigo aunque no lo vea. Quien la oye y también lo ve, la aprende (el juego de nombrar): así cada pueblo
   * acaba con su propio vocabulario, y entre pueblos no se entienden.
   */
  gritar(p, que, x, y, mentira = false) {
    p.ultimoGrito = this.tick;
    let w = p.palabras.get(que);
    if (!w) { w = this.inventarPalabra(p); p.palabras.set(que, w); this.palabraNueva(p, que, w); }
    this.efecto('grito', p.x, p.y, null, null);
    this.efectos.length && (this.efectos[this.efectos.length - 1].palabra = w);
    let entendieron = 0;
    for (const h of this.cercanos(p.x, p.y, 7)) {
      if (h === p || h.dormido || h.edad < 3 * TICKS_POR_ANIO) continue;
      // (a quien ya le pilló mintiendo, no le hace caso: ni aunque esta vez sea verdad)
      const e = h.conocidos.get(p.id);
      if (e && e.mintio >= 1 && h.palabras.get(que) === w) {
        this.ignorados = (this.ignorados || 0) + 1;
        if (!mentira) this.primeraVez(`pastor-${p.tribu}`, `${p.nombre} (${this.tribus[p.tribu].nombre}) avisa de un ${que} de verdad, y ${h.nombre} no le hace caso: ya le pilló mintiendo.`, 'idea');
        continue;
      }
      if (h.palabras.get(que) === w) {
        h.aviso = { que, x, y, hasta: this.tick + 30, de: p.id, palabra: w }; entendieron++;
        // ¿le pilla? quien está cerca y mira, ve que no hay lobo
        if (mentira && Math.max(Math.abs(h.x - p.x), Math.abs(h.y - p.y)) <= 4 && this.azar() < 0.35) {
          this.conocer(h, p, -3);
          const k = h.conocidos.get(p.id); if (k) k.mintio = (k.mintio || 0) + 1;
          this.descubiertas = (this.descubiertas || 0) + 1;
          this.primeraVez(`mentira-${p.tribu}`, `${h.nombre} pilla a ${p.nombre} (${this.tribus[p.tribu].nombre}) gritando «${w}» sin que haya ningún ${que}: quería la comida para él. Ya no se fía.`, 'idea');
        }
      }
      else if (Math.max(Math.abs(h.x - x), Math.abs(h.y - y)) <= RADIO && (!h.palabras.has(que) || this.azar() < 0.3)) h.palabras.set(que, w);
    }
    if (entendieron) {
      const que2 = { lobo: 'viene un lobo', enemigo: 'viene un enemigo', ciervo: 'hay un ciervo cerca', bayas: 'hay bayas cerca', agua: 'hay agua cerca' }[que] || que;
      this.primeraVez(`aviso-${p.tribu}-${que}`, `${p.nombre} (${this.tribus[p.tribu].nombre}) grita «${w}» y ${entendieron === 1 ? 'uno de los suyos entiende' : `${entendieron} de los suyos entienden`} que ${que2}: su pueblo ya tiene una palabra para ${que === 'bayas' ? 'las bayas' : `el ${que}`}.`, 'idea');
    }
  }

  dormir(p) {
    p.dormido = true; p.objetivo = null; p.durmioEnCasa = this.enCasa(p);
    if (this.refugios) {
      p.refugioNoche = this.lechoLibre(p.x, p.y);
      if (p.refugioNoche) this.estadRefugios.aCubierto++; else this.estadRefugios.alRaso++;
    }
    if (p.repasoPendiente) this.repasarDurmiendo(p);
    if (this.repasoPriorizado && p.episodios && p.episodios.length) this.repasoNocturno(p);
    this.primeraVez(`raso-${p.tribu}`, `${p.nombre} (${this.tribus[p.tribu].nombre}) se queda dormido al raso${this.esNoche ? ', de noche' : ''}.`, 'vida');
  }

  // ---- formas de vivir que se descubren ----
  inventoPrimero(p, que, texto, cronica = true) {
    const t = this.tribus[p.tribu].nombre;
    // (el registro de inventos: quién y cuándo lo descubrió, y cuándo llegó a cada pueblo)
    this.inventos = this.inventos || new Map();
    if (!this.inventos.has(que)) this.inventos.set(que, { anio: this.anio, nombre: p.nombre, tribu: p.tribu, adopciones: [] });
    const inv = this.inventos.get(que);
    if (!inv.adopciones.some((a) => a.tribu === p.tribu)) inv.adopciones.push({ tribu: p.tribu, anio: this.anio, nombre: p.nombre });
    if (!this.primeras.has(`mundo-${que}`)) { this.primeras.add(`mundo-${que}`); this.primeras.add(`${que}-${p.tribu}`); if (cronica) this.anotar(`${p.nombre} (${t}) ${texto}: es la primera vez en el mundo.`, 'invento'); }
    else if (cronica) this.primeraVez(`${que}-${p.tribu}`, `${p.nombre} (${t}) ${texto}: la primera vez en su pueblo.`, 'invento');
    else this.primeras.add(`${que}-${p.tribu}`);
  }

  /** PESCAR junto al agua: mejor con red, y mejor con lluvias que en sequía. */
  pescar(p) {
    p.cansancio = Math.min(100, p.cansancio + 0.5);
    if (this.mareas && this.enCosta(p)) {
      if (this.bajamar) {
        // (EL MARISCO: con la marea baja, en la orilla, se coge seguro)
        p.hambre = Math.max(0, p.hambre - 20); p.proteina = Math.min(100, p.proteina + 25);
        this.estadMareas.marisco++; this.efecto('pesca', p.x, p.y);
        this.inventoPrimero(p, 'marisco', 'coge marisco en la orilla con la marea baja');
        this.acierto(p); return;
      }
      this.estadMareas.enAlta++;
    }
    const clima = ({ sequia: 0.3, lluvias: 1.3 }[this.estadoClima] || 1) * (this.inviernoDuro && this.estacion === 'invierno' ? 0.4 : 1);
    const zona = (p.y >> 3) * Math.ceil(this.ancho / 8) + (p.x >> 3);
    if (this.azar() < 0.25 * (1 + 1.25 * this.uso(p, 'pesca')) * clima * this.peces[zona] * (1 + Math.min(1, p.pericia.pescar / 15))) {
      this.servir(p, 'pesca');
      this.peces[zona] = Math.max(0, this.peces[zona] - 0.04);
      p.hambre = Math.max(0, p.hambre - 30); p.carga = Math.min(this.capacidad(p), p.carga + 1); p.proteina = Math.min(100, p.proteina + 35);
      this.practicar(p, 'pescar', 1);
      this.efecto('pesca', p.x, p.y);
      this.inventoPrimero(p, 'pesca', 'pesca un pez');
      this.acierto(p);
    } else this.decepcionar(p);
  }

  /**
   * APRENDER DURMIENDO: la primera noche de primavera repasa lo que hizo el otoño pasado con comida en la mano. Si en
   * invierno comió de lo guardado, cada vez que guardó cuenta como un acierto; si pasó hambre sin haber comido nada
   * guardado, lo que hizo en vez de guardar cuenta como un fallo pequeño.
   */
  repasarDurmiendo(p) {
    p.repasoPendiente = false;
    const diario = p.diario || [];
    let cambios = 0;
    if (p.comioGuardado) {
      const e = diario.filter(([, a]) => a === 'guardar');
      if (e.length) { this.leccion(p, () => { cambios = p.nucleo.repasar(e, true, 1); }); this.estadRepaso.buenos++; }
    } else if (p.hambreInvierno) {
      const e = diario.filter(([, a]) => a !== 'guardar');
      if (e.length) { this.leccion(p, () => { cambios = p.nucleo.repasar(e, false, 0.3); }); this.estadRepaso.malos++; }
      // (LO CONTRAFACTUAL: vio a un vecino comer de lo guardado mientras él pasaba hambre: «si hubiera guardado...»)
      if (this.contrafactual && p.vioComerGuardado && diario.length) {
        const otras = diario.map(([sit]) => [sit, 'guardar']);
        let c2 = 0; this.leccion(p, () => { c2 = p.nucleo.repasar(otras, true, 1); });
        cambios = (cambios || 0) + c2; this.estadRepaso.contrafactuales++;
        this.primeraVez(`contrafactual-${p.tribu}`, `${p.nombre} (${this.tribus[p.tribu].nombre}) pasó hambre en invierno mientras su vecino comía de lo que había guardado. Soñando con el otoño piensa: «si hubiera guardado...». Al despertar, sabe que en otoño hay que guardar.`, 'idea');
      }
    }
    // (si ha aprendido a guardar en otoño, ya tiene la costumbre: la puede pintar y contar)
    if (this.contrafactual && (p.comioGuardado || (p.hambreInvierno && p.vioComerGuardado)) && cambios) {
      if ((p.costumbreGuardar || 0) < 2) this.estadRepaso.aprendieronGuardar++;
      p.costumbreGuardar = 2;
    }
    if (p.hambreInvierno) this.estadRepaso.hambreInvierno++;
    p.vioComerGuardado = false;
    this.estadRepaso.repasos++; this.estadRepaso.cambios += cambios || 0;
    if (cambios && p.comioGuardado) this.primeraVez(`repaso-${p.tribu}`, `${p.nombre} (${this.tribus[p.tribu].nombre}) sueña con el otoño pasado: lo que guardó le dio de comer en invierno. Al despertar, ya sabe que en otoño hay que guardar.`, 'idea');
    p.diario = []; p.comioGuardado = false; p.hambreInvierno = false;
  }

  /**
   * PINTAR: quien sabe una lección (tras A vino B) o un lugar de fruta de temporada, y tiene una roca al lado, la pinta.
   * Si su pueblo ya escribe, pinta sus palabras (escritura); si no, un dibujo. Una pintura por roca.
   */
  pintar(p) {
    if (p.edad < EDAD_ADULTA * TICKS_POR_ANIO) return;
    // (en una roca cercana; si no hay, en la pared de su refugio)
    const roca = this.cerca(p.x, p.y, 3, (x, y) => this.t(x, y) === TERRENO.ROCA) || (this.enCasa(p) ? [p.hogar[0], p.hogar[1]] : null);
    if (!roca) return;
    const k = `${roca[0]},${roca[1]}`;
    if (this.pinturas.has(k)) return;
    const t = this.tribus[p.tribu];
    if ([...this.pinturas.values()].filter((q) => q.tribu === p.tribu).length >= 40) return;
    // (lo que pinta: la lección que mejor sabe; o, si no sabe ninguna, su lugar de fruta de temporada)
    let contenido = null;
    for (const [a, palabra] of LECCIONES) for (const b of PELIGROS) {
      // (solo se pinta lo que se sabe de verdad: vivido u oído al menos 3 veces, no deducido ni de una casualidad)
      const v = p.asoc.vinculos.get(`${a}→${b}`);
      // (y que de verdad vaya por delante: lo malo vino tras eso más de lo que vendría por azar)
      if (contenido || a === b || !v || v.veces < 3 || !this.sabe(p, a, b) || p.asoc.requisito(a, b) < 0.15) continue;
      contenido = { tipo: 'leccion', a, b, palabra };
    }
    if (!this.inducidas) {
      contenido = null; let f = 0;
      for (const v of p.asoc.vinculos.values()) {
        if (v.veces < 3 || v.a === v.b || Math.abs(p.asoc.valencia.get(v.b) || 0) < 0.05 || p.asoc.requisito(v.a, v.b) < 0.15) continue;
        const x = p.asoc.fuerza(v.a, v.b); if (x > f && x >= 0.3) { f = x; contenido = { tipo: 'leccion', a: v.a, b: v.b, palabra: `e:${abreviar(v.a)}` }; }
      }
    }
    if (!contenido && this.contrafactual && (p.costumbreGuardar || 0) >= 2 && p.palabras.has('a:guardar')) contenido = { tipo: 'costumbre', estacion: 'otoño', accion: 'guardar', palabra: 'a:guardar' };
    if (!contenido && p.temporada) {
      let mejor = null, v = 2.5;
      for (const [kk, w] of p.temporada) if (w > v) { v = w; mejor = kk; }
      if (mejor) { const [e, z] = mejor.split('|'); contenido = { tipo: 'lugar', estacion: e, zona: +z }; }
    }
    if (!contenido) return;
    if ([...this.pinturas.values()].some((q) => q.tribu === p.tribu && q.tipo === contenido.tipo && q.a === contenido.a && q.b === contenido.b && q.zona === contenido.zona && Math.hypot(q.x - roca[0], q.y - roca[1]) < 12)) return;
    const escrita = !!t.escritura && (contenido.tipo === 'leccion' || contenido.tipo === 'costumbre') && p.palabras.has(contenido.palabra);
    const pin = { x: roca[0], y: roca[1], tribu: p.tribu, autor: p.id, nombreAutor: p.nombre, anio: this.anio, escrita, palabra: escrita ? p.palabras.get(contenido.palabra) : null, lecturas: 0, deOtros: 0, ...contenido };
    this.pinturas.set(k, pin);
    this.estadDibujos.pinturas++; if (escrita) this.estadDibujos.escritas++;
    this.efecto('objeto', roca[0], roca[1]);
    this.primeraVez(`pinta-${p.tribu}`, `${p.nombre} (${t.nombre}) pinta en una roca lo que sabe: ${this.textoPintura(pin)}.`, 'idea');
    // (LA ESCRITURA NACE en un pueblo asentado que ya ha pintado mucho: alguien pinta las palabras en vez de las cosas)
    const suyas = [...this.pinturas.values()].filter((q) => q.tribu === p.tribu).length;
    if (!t.escritura && suyas >= 8 && (this.despensas.size || this.hogueras.size) && this.azar() < 0.08) {
      t.escritura = this.anio;
      this.anotar(`${p.nombre} (${t.nombre}) pinta las palabras de su lengua en vez de las cosas: nace la escritura de los ${t.nombre}. Solo la leerá quien hable como ellos.`, 'invento');
    }
  }

  /** Lo que dice una pintura, en palabras (para la crónica y la web). */
  textoPintura(pin) {
    const QUE = { 'pasar hambre': 'el hambre', 'pasar sed': 'la sed', 'erupción': 'el fuego de la montaña', 'ser herido': 'el daño', 'perder a alguien': 'la muerte', 'enfermar': 'la enfermedad', 'langostas': 'las langostas' };
    const CAUSA = { 'tierra seca': 'la tierra seca', temblor: 'los temblores', 'beber agua turbia': 'beber agua turbia', 'tierra encharcada': 'la tierra encharcada', langostas: 'las langostas' };
    if (pin.tipo === 'lugar') return `aquí cerca hay fruta en ${pin.estacion}`;
    if (pin.tipo === 'costumbre') return 'en otoño, guardar comida para el invierno';
    const que = QUE[pin.b] || pin.b;
    return `tras ${CAUSA[pin.a] || pin.a} ${que.startsWith('las ') ? 'vienen' : 'viene'} ${que}`;
  }

  /**
   * LEER LAS PINTURAS de alrededor (a 3 casillas): cada una, una vez por persona. Un dibujo enseña a medias (medio
   * suceso vivido); lo escrito, entero, si el lector tiene la misma palabra (si no, no lo entiende). Un lugar pintado
   * se recuerda como si hubiera comido allí una vez.
   */
  leerPinturas(p) {
    if (!this.pinturas.size) return;
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      const pin = this.pinturas.get(`${p.x + dx},${p.y + dy}`);
      if (!pin || pin.autor === p.id) continue;
      p.leidas = p.leidas || new Set();
      const clave = `${pin.x},${pin.y}`;
      if (p.leidas.has(clave)) continue;
      p.leidas.add(clave);
      const clavePalabra = pin.tipo === 'costumbre' ? 'a:guardar' : pin.tipo === 'leccion' ? (pin.palabra && pin.palabra.startsWith ? `e:${abreviar(pin.a)}` : (LECCIONES.find(([c]) => c === pin.a) || [, `e:${abreviar(pin.a)}`])[1]) : null;
      if (pin.escrita && p.palabras.get(clavePalabra) !== pin.palabra) { this.estadDibujos.sinEntender++; continue; }
      const cuanto = pin.escrita ? 1 : 0.5;
      if (pin.tipo === 'costumbre') p.costumbreGuardar = Math.min(2, (p.costumbreGuardar || 0) + cuanto);
      else if (pin.tipo === 'leccion') {
        const k = `${pin.a}→${pin.b}`, A = p.asoc;
        let v = A.vinculos.get(k);
        if (!v) A.vinculos.set(k, v = { a: pin.a, b: pin.b, peso: 0, previa: 0, veces: 0 });
        v.peso += cuanto; v.previa += cuanto; v.veces += cuanto;
        A.frecuencias.set(pin.a, (A.frecuencias.get(pin.a) || 0) + cuanto); A.frecuencias.set(pin.b, (A.frecuencias.get(pin.b) || 0) + cuanto);
      } else if (this.mente === 'neutro') {
        p.temporada = p.temporada || new Map();
        const k = `${pin.estacion}|${pin.zona}`;
        p.temporada.set(k, Math.min(10, (p.temporada.get(k) || 0) + 1.5 * cuanto));
      }
      pin.lecturas++; this.estadDibujos.lecturas++;
      const autor = this.porId.get(pin.autor);
      if (!autor || !autor.vivo) this.estadDibujos.deMuertos++;
      if (pin.tribu !== p.tribu) { pin.deOtros++; this.estadDibujos.deOtroPueblo++; if (this.tribus[pin.tribu].vivos <= 0) this.estadDibujos.deExtintos++; }
      if (pin.escrita && pin.tribu !== p.tribu) {
        // (quien lee la escritura de otro pueblo puede llevársela al suyo)
        const t = this.tribus[p.tribu];
        if (!t.escritura && this.azar() < 0.1) { t.escritura = this.anio; this.anotar(`${p.nombre} (${t.nombre}) aprende a leer lo que escribieron los ${this.tribus[pin.tribu].nombre}: los ${t.nombre} empiezan a escribir.`, 'invento'); }
      }
      if (!autor || !autor.vivo) this.primeraVez(`lee-muerto-${p.tribu}`, `${p.nombre} (${this.tribus[p.tribu].nombre}) ${pin.escrita ? 'lee' : 'mira'} en una roca lo que dejó ${pin.nombreAutor} (${this.tribus[pin.tribu].nombre}), que ya murió: ${this.textoPintura(pin)}. Una idea que sobrevive a quien la tuvo.`, 'idea');
    }
  }

  // ---- los refugios: cuevas, chozas, casas; aldeas, pueblos, ciudades ----
  /** Las cuevas: en el borde de las rocas, separadas; cada una con sitio para unos pocos. */
  generarCuevas() {
    const W = this.ancho, H = this.alto, T = this.terreno;
    for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) {
      const i = y * W + x;
      if (T[i] !== TERRENO.ROCA || this.azar() > 0.08) continue;
      const boca = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [x + dx, y + dy]).find(([a, b]) => this.pisable(a, b));
      if (!boca) continue;
      if ([...this.refugios.values()].some((r) => Math.abs(r.x - x) + Math.abs(r.y - y) < 9)) continue;
      this.refugios.set(`${boca[0]},${boca[1]}`, { x: boca[0], y: boca[1], roca: [x, y], tipo: 'cueva', capacidad: 5 + this.azar.entero(6), habitantes: new Set(), estado: 1 });
    }
  }

  /** El refugio que tiene una persona en su hogar (a 2 casillas o menos), si la cuenta entre los suyos. */
  refugioDe(p) {
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const r = this.refugios.get(`${p.hogar[0] + dx},${p.hogar[1] + dy}`);
      if (r && r.tipo !== 'ruina' && r.habitantes.has(p.id)) return r;
    }
    return null;
  }

  /** Un lecho libre esta noche a 1 casilla (las plazas se cuentan por noche). */
  lechoLibre(x, y) {
    const noche = Math.floor(this.tick / TICKS_POR_DIA);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const r = this.refugios.get(`${x + dx},${y + dy}`);
      if (!r || r.tipo === 'ruina') continue;
      if (r.noche !== noche) { r.noche = noche; r.durmiendo = 0; }
      if (r.durmiendo < r.capacidad) { r.durmiendo++; if (r.tipo === 'cueva') this.estadRefugios.aCueva++; return r; }
    }
    return null;
  }

  /** Cuántos viven de verdad en un refugio (los vivos que lo tienen por casa). */
  ocupacion(r) { let n = 0; for (const id of r.habitantes) { const q = this.porId.get(id); if (q && q.vivo) n++; else r.habitantes.delete(id); } return n; }

  /**
   * BUSCAR REFUGIO (instinto): quien no tiene techo en su hogar busca uno con sitio para su familia: una cueva (o una
   * choza abandonada a medias) a 15 casillas o menos; si la encuentra, la familia se muda allí.
   */
  buscarRefugio(p) {
    if (this.refugioDe(p)) return;
    // (¿hay sitio en algún refugio de su hogar, de alguien de su pueblo? se queda con ellos)
    const familia = [p, this.porId.get(p.pareja), ...p.hijos.map((h) => this.porId.get(h))].filter((q) => q && q.vivo && !this.refugioDe(q));
    let mejor = null, dmin = 16;
    for (const r of this.refugios.values()) {
      if (r.tipo === 'ruina' || this.ocupacion(r) + familia.length > r.capacidad) continue;
      if (this.dist_[TERRENO.AGUA][r.y * this.ancho + r.x] > 10) continue;   // (nadie se queda a vivir lejos del agua)
      if (r.tribu != null && r.tribu !== p.tribu && this.ocupacion(r) > 0) continue;
      const d = Math.max(Math.abs(r.x - p.x), Math.abs(r.y - p.y));
      if (d < dmin && (!this.islas || this.isla(r.x, r.y) === this.isla(p.x, p.y))) { dmin = d; mejor = r; }
    }
    if (!mejor) return;
    for (const q of familia) { q.hogar = [mejor.x, mejor.y]; mejor.habitantes.add(q.id); }
    if (mejor.tribu == null) mejor.tribu = p.tribu;
    if (mejor.tipo === 'cueva') this.primeraVez(`cueva-${p.tribu}`, `${p.nombre} (${this.tribus[p.tribu].nombre}) encuentra una cueva ${this.describirSitio(mejor.x, mejor.y)} y se queda a vivir allí con los suyos: por fin, un techo para la noche.`, 'vida');
  }

  /**
   * CONSTRUIR UN TECHO: sin refugio, una choza en su hogar (4 de madera y 2 de fibra o una piel); con choza y oficio, la
   * convierte en casa de barro (3 de arcilla y 2 de madera), más cálida y duradera; si está estropeada, la repara.
   * Devuelve si ha hecho algo (si no, se sigue con la empalizada).
   */
  construirTecho(p) {
    let r = this.refugioDe(p);
    if (r && r.tipo === 'cobijo') r = null;   // (un cobijo de ramas se rehace en choza)
    if (!r) {
      if (p.madera < 4 || (p.fibra < 2 && p.pieles < 1)) return false;
      const ya = this.refugios.get(`${p.hogar[0]},${p.hogar[1]}`);
      if (ya && ya.tipo !== 'cobijo' && ya.tipo !== 'ruina') return false;
      p.madera -= 4; if (p.fibra >= 2) p.fibra -= 2; else p.pieles--;
      const familia = [p, this.porId.get(p.pareja), ...p.hijos.map((h) => this.porId.get(h))].filter((q) => q && q.vivo && !this.refugioDe(q));
      // (JUNTO A LOS SUYOS: si hay casas de su pueblo cerca, la choza se levanta al lado; así nacen las aldeas)
      const sitio = this.sitioJuntoALosSuyos(p) || p.hogar;
      if (sitio !== p.hogar) for (const q of familia) q.hogar = [sitio[0], sitio[1]];
      const choza = { x: sitio[0], y: sitio[1], tipo: 'choza', capacidad: 5, habitantes: new Set(familia.map((q) => q.id)), estado: 1, tribu: p.tribu, anio: this.anio };
      this.refugios.set(`${choza.x},${choza.y}`, choza); this.estadRefugios.chozas++;
      this.practicar(p, 'construir', 1); this.efecto('objeto', p.x, p.y);
      this.inventoPrimero(p, 'choza', 'levanta una choza de madera y fibra: su familia ya duerme bajo techo');
      this.acierto(p);
      return true;
    }
    if (r.tipo === 'choza' && p.arcilla >= 2 && p.madera >= 2 && p.pericia.construir >= 2) {
      p.arcilla -= 2; p.madera -= 2; r.tipo = 'casa'; r.capacidad = 7; r.estado = 1; this.estadRefugios.casas++;
      this.practicar(p, 'construir', 1); this.efecto('objeto', p.x, p.y);
      this.inventoPrimero(p, 'casa', 'levanta una casa de barro sobre su choza: más cálida y más duradera');
      this.acierto(p);
      return true;
    }
    if (r.tipo !== 'cueva' && r.estado < 0.7 && p.madera >= 1) { p.madera--; r.estado = 1; this.practicar(p, 'construir', 0.5); this.acierto(p); return true; }
    return false;
  }

  /** Un hueco libre junto a las chozas y casas de su pueblo (a 8 casillas o menos de su hogar), a 2 de la más cercana. */
  sitioJuntoALosSuyos(p) {
    let mejor = null, dmin = 9;
    for (const r of this.refugios.values()) {
      if ((r.tipo !== 'choza' && r.tipo !== 'casa') || r.tribu !== p.tribu) continue;
      const d = Math.max(Math.abs(r.x - p.hogar[0]), Math.abs(r.y - p.hogar[1]));
      if (d >= dmin) continue;
      for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2], [2, 2], [-2, 2], [2, -2], [-2, -2]]) {
        const x = r.x + dx, y = r.y + dy;
        if (this.pisable(x, y) && this.t(x, y) !== TERRENO.AGUA && !this.refugios.has(`${x},${y}`) && this.dist_[TERRENO.AGUA][y * this.ancho + x] <= 10) { mejor = [x, y]; dmin = d; break; }
      }
    }
    return mejor;
  }

  /**
   * EL REPASO NOCTURNO PRIORIZADO (la reactivación del hipocampo durante el sueño; Mattar y Daw 2018): de los episodios
   * del día, los 8 que más movieron su cuerpo se repasan: lo que salió bien se refuerza, lo que salió mal se castiga,
   * con más peso cuanto más intenso fue. Luego se olvidan.
   */
  repasoNocturno(p) {
    const top = [...p.episodios].sort((a, b) => Math.abs(b[2]) - Math.abs(a[2])).slice(0, 8);
    p.episodios = [];
    if (!p.nucleo.repasar) return;
    let cambios = 0;
    this.leccion(p, () => {
      for (const [s, a, d] of top) cambios += p.nucleo.repasar([[s, a]], d > 0, Math.min(1, Math.abs(d) * 4)) || 0;
    });
    this.estadRepasoP.noches++; this.estadRepasoP.episodios += top.length; this.estadRepasoP.cambios += cambios;
  }

  /** Un cobijo de ramas en su hogar (2 de madera): sitio para 3; dura poco. */
  hacerCobijo(p) {
    const k = `${p.hogar[0]},${p.hogar[1]}`;
    if (this.refugios.has(k) && this.refugios.get(k).tipo !== 'ruina') return false;
    p.madera -= 2;
    const familia = [p, this.porId.get(p.pareja), ...p.hijos.map((h) => this.porId.get(h))].filter((q) => q && q.vivo && !this.refugioDe(q)).slice(0, 3);
    this.refugios.set(k, { x: p.hogar[0], y: p.hogar[1], tipo: 'cobijo', capacidad: 3, habitantes: new Set(familia.map((q) => q.id)), estado: 1, tribu: p.tribu, anio: this.anio });
    this.estadRefugios.cobijos = (this.estadRefugios.cobijos || 0) + 1;
    this.inventoPrimero(p, 'cobijo', 'se hace un cobijo de ramas para pasar la noche a resguardo');
    return true;
  }

  /** Cada año: chozas y casas se estropean (más las chozas); sin reparar, se caen. Y se ven las aldeas, pueblos y ciudades. */
  refugiosAnual() {
    for (const [k, r] of this.refugios) {
      if (r.tipo === 'cueva') continue;
      if (r.tipo === 'ruina') { if (this.anio - r.cayo > 20) this.refugios.delete(k); continue; }
      r.estado -= r.tipo === 'cobijo' ? 0.4 : r.tipo === 'choza' ? 0.15 : 0.05;
      if (r.estado <= 0 || (this.ocupacion(r) === 0 && this.anio - (r.anio || 0) > 10 && this.azar() < 0.2)) this.arruinar(r);
    }
    this.verAsentamientos();
  }

  arruinar(r) { if (r.tipo === 'cueva') return; r.tipo = 'ruina'; r.capacidad = 0; r.cayo = this.anio; for (const id of r.habitantes) { const q = this.porId.get(id); if (q) q.refugioNoche = null; } r.habitantes.clear(); this.estadRefugios.destruidos++; }

  /** Los desastres tiran chozas y casas (las cuevas aguantan, salvo la lava). */
  destruirRefugios(x, y, R, prob, cuevasTambien = false) {
    if (!this.refugios) return 0;
    let n = 0;
    for (const r of this.refugios.values()) {
      if (r.tipo === 'ruina' || (r.tipo === 'cueva' && !cuevasTambien)) continue;
      if (Math.max(Math.abs(r.x - x), Math.abs(r.y - y)) <= R && this.azar() < (r.tipo === 'casa' ? prob * 0.5 : prob)) {
        if (r.tipo === 'cueva') { r.tipo = 'ruina'; r.cayo = this.anio; r.capacidad = 0; r.habitantes.clear(); } else this.arruinar(r);
        n++;
      }
    }
    return n;
  }

  /**
   * ALDEAS, PUEBLOS Y CIUDADES: chozas y casas de un pueblo a 4 casillas o menos unas de otras forman un grupo; con 5 o
   * más, aldea; con 15, pueblo; con 40, ciudad. Cada pueblo y ciudad tiene su nombre (de las sílabas de su gente), que
   * guarda su casa más antigua.
   */
  verAsentamientos() {
    const casas = [...this.refugios.values()].filter((r) => (r.tipo === 'choza' || r.tipo === 'casa') && r.tribu != null);
    const visto = new Set(), grupos = [];
    for (const c of casas) {
      if (visto.has(c)) continue;
      const g = [c]; visto.add(c);
      for (let k = 0; k < g.length; k++) for (const d of casas) if (!visto.has(d) && d.tribu === g[k].tribu && Math.max(Math.abs(d.x - g[k].x), Math.abs(d.y - g[k].y)) <= 4) { visto.add(d); g.push(d); }
      grupos.push(g);
    }
    this.asentamientos = [];
    for (const g of grupos) {
      if (g.length < 5) continue;
      const tipo = g.length >= 40 ? 'ciudad' : g.length >= 15 ? 'pueblo' : 'aldea';
      const t = this.tribus[g[0].tribu];
      const vieja = g.reduce((a, b) => ((a.anio ?? 0) <= (b.anio ?? 0) ? a : b));
      let nombre = g.find((r) => r.nombreLugar)?.nombreLugar || null;
      if (!nombre && tipo !== 'aldea') { nombre = this.azar.elegir(t.silabas) + this.azar.elegir(t.silabas); nombre = nombre[0].toUpperCase() + nombre.slice(1); vieja.nombreLugar = nombre; }
      const x = Math.round(g.reduce((s, r) => s + r.x, 0) / g.length), y = Math.round(g.reduce((s, r) => s + r.y, 0) / g.length);
      this.asentamientos.push({ tribu: t.id, x, y, casas: g.length, tipo, nombre });
      const texto = { aldea: `Las chozas de los ${t.nombre} ${this.describirSitio(x, y)} ya son una aldea: ${g.length} casas juntas.`,
        pueblo: `La aldea de los ${t.nombre} ${this.describirSitio(x, y)} crece hasta ser un pueblo: ${nombre}, con ${g.length} casas.`,
        ciudad: `${nombre}, de los ${t.nombre}, es ya una ciudad: ${g.length} casas. Es la primera vez que tanta gente vive junta.` }[tipo];
      this.primeraVez(`${tipo}-${t.id}`, texto, 'vida');
    }
  }

  /** Una decepción (si la opción está puesta y la mente sabe decepcionarse). */
  decepcionar(p) {
    if (!this.decepcion || !p.nucleo.decepcionar) return;
    this.decepciones++;
    this.leccion(p, () => p.nucleo.decepcionar());
  }

  /** CAZAR un ciervo que está al lado: mucho mejor con lanza, y mejor si ayudan los suyos. */
  cazar(p, c) {
    p.cansancio = Math.min(100, p.cansancio + 1);
    const ayuda = this.cercanos(c.x, c.y, 1).filter((q) => q !== p && q.tribu === p.tribu).length;
    if (ayuda) this.cazasEnGrupo = (this.cazasEnGrupo || 0) + 1;
    if (this.azar() < 0.2 * (1 + 3 * this.uso(p, 'caza')) + 0.15 * ayuda + (p.perro ? 0.15 : 0) + Math.min(0.3, p.pericia.cazar / 30)) {
      p.proteina = Math.min(100, p.proteina + 45); this.practicar(p, 'cazar', 1); p.pieles = Math.min(4, p.pieles + 1); p.hueso = Math.min(4, p.hueso + 1);
      const arma = this.servir(p, 'caza');
      c.vivo = false; this.recordarCaza(p, c.x, c.y);
      p.hambre = Math.max(0, p.hambre - 50); p.carga = Math.min(this.capacidad(p), p.carga + 2);
      this.efecto('caza', c.x, c.y);
      this.inventoPrimero(p, 'caza-ciervo', `caza un ciervo${arma ? ` con su «${arma.nombre}»` : ''}`);
      this.acierto(p);
    } else {
      this.decepcionar(p); c.x += Math.sign(c.x - p.x) * 2; c.y += Math.sign(c.y - p.y) * 2; if (!this.pisable(c.x, c.y)) { c.x -= Math.sign(c.x - p.x) * 2; c.y -= Math.sign(c.y - p.y) * 2; } }
  }

  /**
   * FABRICAR, ahora: RECOGER MATERIALES. Madera y fibra junto al bosque (a veces resina), piedra junto a las rocas,
   * arcilla junto al agua (los huesos y las pieles salen de cazar). Con oficio, además, el artesano hace una copia de
   * sobra de lo que más le ha servido, para dar o cambiar. Recoger no es un acierto: lo es usar lo que se hace.
   */
  fabricar(p, soloMadera = false) {
    let hizo = false;
    p.cansancio = Math.min(100, p.cansancio + 0.6);
    const bosque = this.cerca(p.x, p.y, 1, (x, y) => this.t(x, y) === TERRENO.BOSQUE);
    let cogido = null;
    if (p.madera < 6 && bosque) { p.madera++; hizo = true; cogido = 'madera'; }
    if (soloMadera) return hizo;
    if (bosque && p.fibra < 4 && this.azar() < 0.6) { p.fibra++; hizo = true; cogido = 'fibra'; }
    if (bosque && p.resina < 2 && this.azar() < 0.15) { p.resina++; hizo = true; cogido = 'resina'; }
    if (p.piedra < 4 && this.cerca(p.x, p.y, 1, (x, y) => this.t(x, y) === TERRENO.ROCA)) { p.piedra++; hizo = true; cogido = 'piedra'; }
    if (p.arcilla < 3 && this.cerca(p.x, p.y, 1, (x, y) => this.t(x, y) === TERRENO.AGUA) && this.azar() < 0.4) { p.arcilla++; hizo = true; cogido = 'arcilla'; }
    if (cogido && this.azar() < 0.03) this.nombrarSuceso(`m:${cogido}`, p.x, p.y, 3);
    // (LO QUE CAYÓ DEL CIELO: quien pasa por allí recoge un poco)
    if (this.yacimientos.size) for (const [k, y] of this.yacimientos) {
      if (Math.max(Math.abs(y.x - p.x), Math.abs(y.y - p.y)) > 1 || p[y.material] >= 3) continue;
      p[y.material]++; y.queda--; hizo = true;
      if (this.azar() < 0.3) this.nombrarSuceso(`m:${y.material}`, p.x, p.y, 3);
      const m = this.delCielo.get(y.material); m.recogido++;
      if (m.recogido === 1) this.anotar(`${p.nombre} (${this.tribus[p.tribu].nombre}) recoge ${MATERIALES_DEL_CIELO[y.material]} de lo que cayó del cielo (${y.material}). Nadie sabe aún para qué sirve.`, 'invento');
      if (y.queda <= 0) this.yacimientos.delete(k);
      break;
    }
    // (LA CARRETA sigue siendo una receta: con algo que lleve cosas, oficio y madera)
    if (!p.objetos.has('carreta') && this.uso(p, 'carga') >= 0.5 && p.madera >= 4 && p.pericia.fabricar >= 3) {
      p.madera -= 4; p.objetos.add('carreta'); this.practicar(p, 'fabricar', 1); this.efecto('objeto', p.x, p.y);
      this.inventoPrimero(p, 'carreta', 'construye una carreta'); this.acierto(p); return true;
    }
    // (EL ARTESANO: una copia de sobra de lo que más le ha servido)
    if (p.excedentes.length < 3 && p.recetas.size) {
      let mejor = null, v = 1;
      for (const k of p.recetas.keys()) if ((p.valor.get(k) || 0) > v) { v = p.valor.get(k); mejor = k; }
      if (mejor) { const a = this.hacer(p, mejor, true); if (a) { p.excedentes.push(a); return true; } }
    }
    return hizo;
  }

  // ---- materiales, combinaciones y usos (los inventos que nadie programa) ----
  /** Lo mejor que tiene para un uso (caza, pesca, carga, abrigo, proteccion, flota): de 0 a 1. */
  uso(p, u) { let m = 0; for (const a of p.cosas) if (a.usos[u] > m) m = a.usos[u]; return m; }
  /** La cosa que más sirve para un uso (para darle el mérito cuando sirve). */
  mejorPara(p, u) { let m = null; for (const a of p.cosas) if (a.usos[u] > 0 && (!m || a.usos[u] > m.usos[u])) m = a; return m; }
  /** Le sirvió: esa receta vale más para él (es lo que le hace quedársela, rehacerla y enseñarla). */
  servir(p, u, cuanto = 1) {
    const a = this.mejorPara(p, u);
    if (a) p.valor.set(a.clave, (p.valor.get(a.clave) || 0) + cuanto);
    return a;
  }

  /** Lo que tiene a mano para combinar: materiales (por nombre) y cosas que lleva (por su clave). */
  aMano(p) {
    const m = [];
    for (const [k, campo] of Object.entries(CAMPO_MATERIAL)) if (p[campo] > 0) m.push({ tipo: 'm', id: k, props: MATERIALES[k] });
    for (const a of p.cosas) m.push({ tipo: 'a', id: a.clave, props: a.props, cosa: a });
    return m;
  }

  /**
   * COMBINAR dos cosas con una técnica: el resultado es un objeto con PROPIEDADES que salen de las de las piezas (la
   * física del mundo); nadie le dice qué es ni para qué sirve. Devuelve las propiedades, o null si no se puede.
   */
  combinarProps(tecnica, A, B, p) {
    const g = (x, k) => x[k] || 0, mx = (k) => Math.max(g(A, k), g(B, k));
    if (tecnica === 'golpear') {
      // (FORJAR: lo que se dobla en vez de romperse, golpeado junto al fuego, coge un filo que no se mella)
      if (g(A, 'maleable') >= 0.5 && g(A, 'dureza') >= 0.6 && g(B, 'dureza') >= 0.6 && this.calor[p.y * this.ancho + p.x])
        return { ...A, filo: 0.95, punta: 0.8, largo: g(A, 'largo') * 0.9, maleable: 0, forjado: 1 };
      if (g(A, 'dureza') < 0.6 || !g(A, 'fragil') || g(B, 'dureza') < 0.6) return null;
      return { ...A, filo: g(A, 'fragil') * 0.8, punta: Math.max(g(A, 'punta'), g(A, 'fragil') * 0.5), largo: g(A, 'largo') * 0.5, fragil: 0 };
    }
    if (tecnica === 'atar') {
      if (!(p.fibra > 0 || p.resina > 0)) return null;   // (hace falta con qué atar)
      const [L, C] = g(A, 'largo') >= g(B, 'largo') ? [A, B] : [B, A];
      return { filo: mx('filo'), punta: mx('punta'), dureza: mx('dureza'), largo: Math.min(1, g(L, 'largo') + g(C, 'largo') * 0.3),
               flota: (g(A, 'flota') + g(B, 'flota')) / 2, tamano: (g(A, 'largo') + g(B, 'largo')) / 2, cobertura: mx('cobertura'), aislante: mx('aislante') };
    }
    // (TRENZAR: lo hueco necesita un armazón, duro y largo, como unas varas)
    if (tecnica === 'trenzar') {
      if (g(A, 'flex') < 0.5 && g(B, 'flex') < 0.5) return null;
      return { malla: g(A, 'flex') * g(B, 'flex'), hueco: Math.min(1, (g(A, 'flex') * g(B, 'dureza') * g(B, 'largo') + g(B, 'flex') * g(A, 'dureza') * g(A, 'largo')) * 2.2), largo: mx('largo'), flex: mx('flex'), aislante: mx('aislante') * 0.8 };
    }
    if (tecnica === 'coser') {
      const blandos = (g(A, 'flex') >= 0.5) + (g(B, 'flex') >= 0.5);
      if (blandos === 0 || (blandos === 1 && Math.max(g(A, 'dureza'), g(B, 'dureza')) < 0.5)) return null;
      if (!(p.hueso > 0 || this.uso(p, 'punzar') > 0.3)) return null;   // (hace falta algo que pinche: un hueso, una punta)
      return { cobertura: Math.min(1, (g(A, 'flex') + g(B, 'flex')) / 2 + 0.2), aislante: mx('aislante'), dureza: mx('dureza') * 0.7, imp: mx('imp'), flex: mx('flex') };
    }
    if (tecnica === 'moldear') {
      if (g(A, 'moldeable') < 0.5) return null;
      // (junto al fuego, el barro se cuece: más duro, más hondo y no deja pasar el agua)
      if (this.calor[p.y * this.ancho + p.x]) return { hueco: 0.85, imp: 0.95, dureza: 0.6, cocido: 1 };
      return { hueco: 0.7, imp: g(A, 'imp'), dureza: 0.3 };
    }
    return null;
  }

  /** Para qué sirve algo, según sus propiedades (la física general: lo mismo para cualquier invento). */
  usosDe(x) {
    const g = (k) => x[k] || 0;
    return { caza: Math.max(g('filo'), g('punta')) * (0.3 + 0.7 * g('largo')), pesca: g('malla'), carga: g('hueco'), abrigo: g('aislante') * g('cobertura'),
             proteccion: g('dureza') * g('cobertura'), flota: g('flota') * g('tamano'), punzar: g('punta') };
  }

  /** Gastar las piezas de una combinación (el martillo de golpear no se gasta; atar gasta un poco de fibra o resina). */
  gastar(p, tecnica, ia, ib) {
    const quitar = (it) => { if (it.tipo === 'm') p[CAMPO_MATERIAL[it.id]]--; else p.cosas.splice(p.cosas.indexOf(it.cosa), 1); };
    quitar(ia);
    if (tecnica !== 'golpear' && tecnica !== 'moldear') quitar(ib);   // (golpear y moldear solo gastan la pieza principal)
    if (tecnica === 'atar') { if (p.fibra > 0) p.fibra--; else p.resina--; }
  }

  /** Una cosa nueva en la mano (caben 4: si no, se deja la que menos le ha servido). */
  guardarCosa(p, a) {
    p.cosas.push(a);
    if (p.cosas.length > 4) {
      let peor = p.cosas[0];
      for (const c of p.cosas) if ((p.valor.get(c.clave) || 0) < (p.valor.get(peor.clave) || 0)) peor = c;
      p.cosas.splice(p.cosas.indexOf(peor), 1);
    }
  }

  /** Hacer una receta que ya sabe (si tiene las piezas; si una pieza es otra cosa que sabe hacer, la hace antes). */
  hacer(p, clave, deSobra = false, hondo = 0) {
    const r = p.recetas.get(clave);
    if (!r || hondo > 2) return null;
    const busca = (desc) => {
      const mano = this.aMano(p);
      let it = mano.find((m) => (m.tipo === 'm' ? `m:${m.id}` : m.id) === desc);
      if (!it && !desc.startsWith('m:') && p.recetas.has(desc)) { const a = this.hacer(p, desc, false, hondo + 1); if (a) { this.guardarCosa(p, a); it = this.aMano(p).find((m) => m.id === desc); } }
      return it;
    };
    const ia = busca(r.a); if (!ia) return null;
    const ib = r.tecnica === 'golpear' ? this.aMano(p).find((m) => (m.props.dureza || 0) >= 0.6 && m !== ia) : r.tecnica === 'moldear' ? ia : busca(r.b);
    if (!ib || (ib === ia && r.tecnica !== 'moldear' && !(ia.tipo === 'm' && p[CAMPO_MATERIAL[ia.id]] >= 2))) return null;
    const props = this.combinarProps(r.tecnica, ia.props, ib.props, p);
    if (!props) return null;
    this.gastar(p, r.tecnica, ia, ib);
    const a = { clave, nombre: this.nombreDe(p, clave), props, usos: this.usosDe(props), receta: r };
    if (!deSobra) this.guardarCosa(p, a);
    p.hechas = (p.hechas || 0) + 1; this.practicar(p, 'fabricar', 1);
    this.efecto('objeto', p.x, p.y);
    return a;
  }

  /** El nombre de una cosa: la palabra de su pueblo (se inventa con sus sílabas la primera vez). */
  nombreDe(p, clave) {
    let w = p.palabras.get(`o:${clave}`);
    if (!w) { w = this.inventarPalabra(p); p.palabras.set(`o:${clave}`, w); this.palabraNueva(p, `o:${clave}`, w); }
    return w;
  }

  /**
   * PROBAR A COMBINAR: si sabe hacer algo que le sirve y no lo lleva, lo hace; si no, prueba algo nuevo con lo que tiene
   * a mano (una técnica y dos piezas al azar). Encontrar algo nuevo satisface (la curiosidad); lo útil se ve al usarlo.
   */
  combinar(p) {
    p.cansancio = Math.min(100, p.cansancio + 0.8);
    // lo que sabe hacer y le ha servido, si no lo lleva
    for (const [k] of [...p.recetas].sort((x, y) => (p.valor.get(y[0]) || 0) - (p.valor.get(x[0]) || 0))) {
      if ((p.valor.get(k) || 0) < 1 || p.cosas.some((c) => c.clave === k)) continue;
      if (this.hacer(p, k)) { this.acierto(p); return true; }
    }
    // probar algo nuevo
    const mano = this.aMano(p);
    if (mano.length < 1) return false;
    const tecnica = this.azar.elegir(TECNICAS);
    const ia = this.azar.elegir(mano);
    let ib = this.azar.elegir(mano);
    if (ib === ia && tecnica !== 'moldear' && !(ia.tipo === 'm' && p[CAMPO_MATERIAL[ia.id]] >= 2)) return false;
    const props = this.combinarProps(tecnica, ia.props, ib.props, p);
    if (!props) return false;
    // (LA CHISPA: golpear piedra contra piedra llevando algo que arde, a veces prende)
    if (tecnica === 'golpear' && ia.id === 'piedra' && (ib.id === 'piedra' || (ib.props.dureza || 0) >= 0.8) && (p.madera > 0 || p.fibra > 0 || p.resina > 0) && this.azar() < 0.3) {
      if (this.chispa(p)) return true;
    }
    const desc = (it) => (it.tipo === 'm' ? `m:${it.id}` : it.id);
    const sola = tecnica === 'golpear' || tecnica === 'moldear';   // (la segunda pieza solo es el martillo o las manos)
    const [da, db] = sola ? [desc(ia), tecnica === 'golpear' ? 'golpe' : 'mano'] : [desc(ia), desc(ib)].sort();
    const clave = `${tecnica}(${da}+${db})`;
    const receta = { tecnica, a: da, b: db };
    this.gastar(p, tecnica, ia, ib);
    const nueva = !p.recetas.has(clave);
    p.recetas.set(clave, receta);
    const a = { clave, nombre: this.nombreDe(p, clave), props, usos: this.usosDe(props), receta };
    this.guardarCosa(p, a);
    p.hechas = (p.hechas || 0) + 1; this.practicar(p, 'fabricar', 1);
    this.efecto('objeto', p.x, p.y);
    this.combinaciones = (this.combinaciones || 0) + 1;
    for (const it of (sola ? [ia] : [ia, ib])) if (it.tipo === 'm' && this.delCielo.has(it.id)) {
      const m = this.delCielo.get(it.id); m.usado++;
      const [u0, v0] = Object.entries(a.usos).filter(([k]) => k !== 'punzar').sort((x, y) => y[1] - x[1])[0];
      if (v0 > m.mejor) { m.mejor = v0; m.para = u0; m.objeto = a.nombre; m.quien = `${p.nombre} (${this.tribus[p.tribu].nombre})`; m.anio = this.anio; }
      if (v0 >= 0.3 && !m.anunciado) { m.anunciado = true; this.anotar(`${p.nombre} (${this.tribus[p.tribu].nombre}) le encuentra uso al ${it.id} que cayó del cielo: «${a.nombre}», ${TEXTO_TECNICA[tecnica]}, ${TEXTO_USO[u0]} (${Math.round(v0 * 100)} %).`, 'invento'); }
    }
    // (en la crónica, solo lo que de verdad sirve para algo)
    const [u, val] = Object.entries(a.usos).filter(([k]) => k !== 'punzar').sort((x, y) => y[1] - x[1])[0];
    if (val >= 0.3) {
      // (cada receta nueva se registra; en la crónica solo sale si es la mejor hasta ahora para su uso, con margen: si no,
      // cada variante de «algo para llevar cosas» sería «la primera vez en el mundo»)
      this.mejorPorUso = this.mejorPorUso || {};
      const mejora = val > (this.mejorPorUso[u] ?? 0) + 0.1;
      if (mejora) this.mejorPorUso[u] = val;
      this.inventoPrimero(p, clave, `inventa «${a.nombre}» (${TEXTO_TECNICA[tecnica]} ${this.describirPiezas(receta)}): ${TEXTO_USO[u]}${this.usosDescubiertos && this.usosDescubiertos.has(u) ? `, mejor que nada de lo que había (${Math.round(val * 100)} %)` : ''}`, mejora);
      const inv = this.inventos.get(clave); inv.usos = a.usos; inv.como = `${TEXTO_TECNICA[tecnica]} ${this.describirPiezas(receta)}`; inv.objeto = inv.objeto || a.nombre;
      // (la primera cosa del mundo para cada uso es un gran momento)
      this.usosDescubiertos = this.usosDescubiertos || new Set();
      if (!this.usosDescubiertos.has(u)) { this.usosDescubiertos.add(u); this.anotar(`Por primera vez en el mundo, algo que ${TEXTO_USO[u]}: «${a.nombre}», de ${p.nombre} (${this.tribus[p.tribu].nombre}).`, 'invento'); }
    }
    if (nueva) this.acierto(p);
    return true;
  }

  describirPiezas(r) {
    const n = (d) => (d.startsWith('m:') ? d.slice(2) : 'algo hecho antes');
    return r.tecnica === 'golpear' ? n(r.a) : `${n(r.a)} y ${n(r.b)}`;
  }

  /** ENSEÑAR A HACER algo que le sirve: con lenguaje, solo si el otro ya tiene la palabra (si no, aprende la palabra). */
  ensenarReceta(a, de) {
    if (!de.recetas || !de.recetas.size) return;
    const k = [...de.recetas.keys()].filter((x) => (de.valor.get(x) || 0) >= 1 && !a.recetas.has(x)).sort((x, y) => (de.valor.get(y) || 0) - (de.valor.get(x) || 0))[0];
    if (!k) return;
    const w = this.nombreDe(de, k);
    if (this.lenguaje && a.palabras.get(`o:${k}`) !== w) { if (this.azar() < 0.5) a.palabras.set(`o:${k}`, w); return; }
    a.recetas.set(k, de.recetas.get(k)); a.valor.set(k, 0.5); a.palabras.set(`o:${k}`, w);
    this.recetasEnsenadas = (this.recetasEnsenadas || 0) + 1;
    // (y si lo que enseña se hace con otra cosa que sabe hacer, también la explica)
    for (const d of [de.recetas.get(k).a, de.recetas.get(k).b]) if (de.recetas.has(d) && !a.recetas.has(d)) a.recetas.set(d, de.recetas.get(d));
  }

  /** CONSTRUIR una empalizada en su hogar (3 de madera por nivel, hasta 3). También es un acierto inmediato. */
  construir(p) {
    p.cansancio = Math.min(100, p.cansancio + 3);
    // (sin inducidas, construir es también: encender el fuego del hogar si sabe y hacerse un cobijo de ramas si no tiene techo)
    if (!this.inducidas) {
      if (p.sabeFuego && !this.hogueras.has(`${p.hogar[0]},${p.hogar[1]}`) && p.piedra >= 2 && (p.madera > 0 || p.fibra > 0)) {
        if (p.madera > 0) p.madera--; else p.fibra--;
        this.encender(p.hogar[0], p.hogar[1], p, false); return;
      }
      if (this.refugios && !this.refugioDe(p) && p.madera >= 2 && (p.madera < 4 || (p.fibra < 2 && p.pieles < 1)) && this.hacerCobijo(p)) return;
    }
    if (this.refugios && this.construirTecho(p)) return;
    const k = `${p.hogar[0]},${p.hogar[1]}`, nivel = this.fuertes.get(k) || 0;
    if (nivel >= 3) return;
    p.madera -= p.pericia.construir >= 3 ? 2 : 3;
    this.practicar(p, 'construir', 1);
    this.fuertes.set(k, nivel + 1);
    this.efecto('objeto', p.x, p.y);
    this.inventoPrimero(p, 'empalizada', nivel ? `refuerza la empalizada de su hogar (nivel ${nivel + 1})` : 'levanta una empalizada en su hogar');
    this.acierto(p);
  }

  // ---- aprender ----
  /**
   * EL IMPULSO (Keramati y Gutkin 2014): lo lejos que está el cuerpo de su equilibrio, la raíz de la suma de los
   * cuadrados de cada desequilibrio (0 a 1): hambre, sed, cansancio, dolor (la salud perdida), frío y falta de carne
   * o de fruta.
   */
  impulso(p) {
    const h = p.hambre / 100, s = p.sed / 100, c = p.cansancio / 100, d = Math.max(0, 100 - p.salud) / 100;
    const k = this.escalaNecesidades, f = (p.frioHasta > this.tick ? 0.5 : 0) * k, pr = Math.max(0, 40 - p.proteina) / 80 * k, vi = Math.max(0, 40 - p.vitaminas) / 80 * k;
    const e = this.empatia ? this.malestarAjeno(p) : 0;
    let g = 0;
    if (p.agravios && p.agravios.size) for (const v of p.agravios.values()) if (v > g) g = v;
    g *= 0.6;
    const a = this.prospeccion ? this.malestarImaginado(p) : 0;
    return Math.sqrt(h * h + s * s + c * c + d * d + f * f + pr * pr + vi * vi + e * e + g * g + a * a);
  }

  /**
   * LA META DE RESERVA: si imagina hambre por venir (prospección), se la fija; la suelta cuando ya no la imagina. Cada
   * tramo de su despensa llena (de la reserva que aprendió que hace falta) es un logro: se refuerza lo que acaba de hacer.
   */
  perseguirMeta(p) {
    const n = p.nucleo;
    if ((p.hambreImaginada || 0) > 0.01) { if (!n.meta) { this.estadMetas.fijadas++; p.guardadoPropio = 0; } n.fijarMeta('reserva'); }
    else if (n.meta && this.estacion === 'primavera') { n.soltarMeta(); p.guardadoPropio = 0; }
    if (!n.meta || !p.reservaObjetivo || this.agencia) return;   // (con agencia, el progreso se cuenta al guardar él)   // (sin haber vivido un invierno, no sabe cuánto hace falta)
    const d = this.despensas.get(`${p.hogar[0]},${p.hogar[1]}`) || 0;
    if (n.avanzarMeta(d / p.reservaObjetivo) > 0) {
      this.estadMetas.logros++;
      // (EL VALOR DE LA META: cuántos aciertos vale un logro, frente a uno del cuerpo; se prueba su sensibilidad)
      this.leccion(p, () => { for (let k = 0; k < this.valorMeta; k++) n.consolidar(0); });
      this.primeraVez(`meta-${p.tribu}`, `${p.nombre} (${this.tribus[p.tribu].nombre}) ve crecer lo que tiene guardado para el invierno que imagina: va por buen camino.`, 'idea');
    }
  }

  /**
   * EL MALESTAR IMAGINADO (prospección): de lo que su memoria espera ahora, el que más daño hizo cuando pasó, por lo seguro
   * que es (la fuerza del lazo). Al imaginar el futuro cuenta con lo que tendrá entonces: si lo que espera es pasar
   * hambre, la comida guardada en casa —que aguanta hasta entonces— lo calma; la que lleva en la mano, no (se come o se
   * pudre antes).
   */
  malestarImaginado(p) {
    if (!p.dolorDe || !p.asoc.esperando.length) return 0;
    // (la comida guardada en casa —que aguanta hasta entonces— calma la parte de hambre de lo que imagina)
    const guardado = Math.exp(-(this.despensas.get(`${p.hogar[0]},${p.hogar[1]}`) || 0) / 6);
    let m = 0, hi = 0;
    for (const [causa, efecto, hasta] of p.asoc.esperando) {
      if (hasta < this.tick) continue;
      const d = p.dolorDe.get(efecto); if (!d || d.t <= 0.02) continue;
      // (CUÁNDO: pesa más cuanto más cerca está lo que espera, según cuánto suele tardar —el retardo aprendido—)
      const v = p.asoc.vinculos.get(`${causa}→${efecto}`), desde = hasta - p.asoc.ventana;
      const falta = v && v.retardo != null ? desde + v.retardo - this.tick : TICKS_POR_ANIO;
      const cerca = falta < -TICKS_POR_ANIO / 8 ? 0.2 : Math.exp(-Math.max(0, falta) / (TICKS_POR_ANIO / 4));
      const hambre = Math.max(0, Math.min(d.h, d.t)), resto = d.t - hambre;
      const f = cerca * Math.min(1, p.asoc.fuerza(causa, efecto));
      const x = (resto + hambre * guardado) * f;
      if (x > m) m = x;
      if (hambre * f > hi) hi = hambre * f;
    }
    p.hambreImaginada = hi;
    if (m <= 0) return 0;
    this.estadProspeccion.conAnticipo++;
    return Math.min(1, this.pesoProspeccion * m);
  }

  /**
   * EL MALESTAR AJENO (empatía): de quienes están a 2 casillas o menos y despiertos, el mayor malestar (dolor y hambre),
   * pesado por el lazo: familia 1, su pueblo 0,5, otro pueblo 0,2, y más o menos según el afecto que le tiene.
   */
  malestarAjeno(p) {
    let m = 0;
    for (const q of this.cercanos(p.x, p.y, 2)) {
      if (q === p || !q.vivo) continue;
      const fam = q.id === p.madre || q.id === p.padre || q.id === p.pareja || p.hijos.includes(q.id) || (p.madre != null && q.madre === p.madre);
      const e = p.conocidos.get(q.id), af = e ? e.afecto / 10 : 0;
      const w = Math.max(0, (fam ? 1 : q.tribu === p.tribu ? 0.5 : 0.2) * (1 + af));
      const dq = Math.max(0, 100 - q.salud) / 100, hq = q.hambre / 100;
      const x = w * Math.sqrt(dq * dq + hq * hq) * 0.6 * this.escalaEmpatia;
      if (x > m) m = x;
    }
    return Math.min(1, m);
  }

  acierto(p) {
    if (this.homeostasis && p.nucleo.sentir) return;   // (con la recompensa interna, los aciertos los da el cuerpo)
    // lo que le llevó hasta aquí funcionó: suma aciertos; y empieza un episodio nuevo
    this.leccion(p, () => p.nucleo.consolidar(0));
    this.recordarLugar(p, p.x, p.y, 0.3);
  }

  /** La zona de una casilla (4×4), para las células de lugar. */
  zona(x, y) { return (y >> 2) * 64 + (x >> 2); }

  /** Recordar lo que pasó en un sitio (caben 30 zonas; se olvida la menos marcada). */
  recordarLugar(p, x, y, delta) {
    const k = this.zona(x, y);
    const v = Math.max(-10, Math.min(10, (p.lugares.get(k) || 0) + delta));
    if (!p.lugares.has(k) && p.lugares.size >= 30) {
      let peor = null, m = Infinity;
      for (const [z, w] of p.lugares) if (Math.abs(w) < m) { m = Math.abs(w); peor = z; }
      p.lugares.delete(peor);
    }
    p.lugares.set(k, v);
  }

  herir(p, dano, causa, aprende = true) {
    if (!p.vivo) return;
    // (LA SANCIÓN ALIVIA: quien guardaba un agravio contra él y lo ve sufrir, se calma mucho)
    if (this.indignacion !== 'no' && dano > 3) for (const q of this.cercanos(p.x, p.y, 4)) {
      if (!q.agravios || !q.agravios.has(p.id) || q.dormido) continue;
      q.agravios.set(p.id, q.agravios.get(p.id) * 0.25); this.estadIndignacion.sanciones++;
      this.primeraVez(`sancion-${q.tribu}`, `${q.nombre} (${this.tribus[q.tribu].nombre}) ve sufrir a ${p.nombre}, que le había robado, y se queda en paz: el agravio se le pasa.`, 'idea');
    }
    if (causa === 'frío') p.frioHasta = this.tick + 60;   // (el frío se siente: es una necesidad un buen rato)
    if ((causa === 'pelea' || causa === 'lobo' || causa === 'castigo') && this.uso(p, 'proteccion') > 0.05) { dano *= 1 - 0.6 * this.uso(p, 'proteccion'); this.servir(p, 'proteccion', 0.5); this.golpesParados = (this.golpesParados || 0) + 1; }
    p.salud -= dano;
    if (aprende) { if (!(this.homeostasis && p.nucleo.sentir)) this.leccion(p, () => p.nucleo.aprenderDeFracaso(null)); p.asoc.suceso('ser herido', this.tick); this.recordarLugar(p, p.x, p.y, -2); }
    if (p.salud <= 0) this.morir(p, causa);
  }

  /** Una lección: lo que cambia por la experiencia propia es una idea SUYA (en la genealogía, el autor es él). */
  leccion(p, aprender) {
    // (solo puede cambiar lo vivido desde la última lección: no hace falta mirar la mente entera)
    const antes = new Map();
    for (const h of p.nucleo.historial) if (!antes.has(h[0])) { const n = p.nucleo.neuronas.get(h[0]); antes.set(h[0], n ? n.accion : null); }
    aprender();
    for (const [k, a] of antes) {
      const n = p.nucleo.neuronas.get(k);
      if (!n || a === n.accion || n.accion === 'instinto') continue;
      p.origen.set(k, { autor: p.id, nombre: p.nombre, tribu: p.tribu, anio: this.anio, manos: 0, de: null, cuando: this.anio });
      this.hito(p, n);
    }
    p.nucleo.reiniciarEstadisticas();
    // OLVIDO: si no cabe, se va lo que menos experiencia tiene (y con ello su genealogía)
    // (de golpe al pasarse en 20: ordenar la mente en cada lección costaría demasiado)
    if (p.nucleo.neuronas.size > MAX_NEURONAS + 20) {
      const orden = [...p.nucleo.neuronas].sort((u, v) => experiencia(u[1]) - experiencia(v[1]));
      for (const [k] of orden.slice(0, p.nucleo.neuronas.size - MAX_NEURONAS)) { p.nucleo.neuronas.delete(k); p.origen.delete(k); }
    }
  }

  hito(p, n) {
    const t = this.tribus[p.tribu].nombre;
    if (n.concepto === 'Baya morada al lado' && n.accion !== 'instinto')
      this.primeraVez(`morada-${p.tribu}`, `${p.nombre} (${t}) es la primera de su pueblo en aprender a no comer bayas moradas (${n.accion}).`, 'idea');
    if (n.concepto === 'Lobo cerca' && n.accion !== 'instinto')
      this.primeraVez(`lobo-${p.tribu}-${n.accion}`, `${p.nombre} (${t}) aprende ante un lobo: ${n.accion}.`, 'idea');
  }

  morir(p, causa) {
    if (!p.vivo) return;
    p.vivo = false; p.causa = causa; p.muerte = this.tick;
    Object.assign(this.registro.get(p.id), { murio: this.anio, causa });
    this.efecto('morir', p.x, p.y);
    this.nombrarSuceso('e:muerte', p.x, p.y, 4);
    this.muertos[causa]++;
    { // (SOLO MEDIDA: por décadas, cuántas muertes hay y cuántas son violentas entre personas, como mide la antropología;
      // aparte, las de adultos —la violencia se compara sobre muertes de adultos en muchos estudios—)
      const d = Math.floor(this.anio / 10), V = this.estadViolencia.porDecada || (this.estadViolencia.porDecada = []);
      const x = V[d] || (V[d] = { muertes: 0, pelea: 0, adultos: 0, peleaAdultos: 0, vivos: 0 });
      x.muertes++; if (causa === 'pelea' || causa === 'castigo') x.pelea++;
      if (p.edad >= EDAD_ADULTA * TICKS_POR_ANIO) { x.adultos++; if (causa === 'pelea' || causa === 'castigo') x.peleaAdultos++; }
    }
    this.tribus[p.tribu].vivos--;
    this.sumaEdadMuerte += p.edad / TICKS_POR_ANIO; this.nMuertes++;
    { const d = this.periodo(); if (p.edad < 5 * TICKS_POR_ANIO) d.infantiles++; }
    { const t = this.tribus[p.tribu]; t.sumaEdadMuerte = (t.sumaEdadMuerte || 0) + p.edad / TICKS_POR_ANIO; t.nMuertes = (t.nMuertes || 0) + 1; }
    if (p.pareja) { const q = this.porId.get(p.pareja); if (q) q.pareja = null; }
    // la familia recuerda dónde murió (un lugar triste, que se evita)
    // EL DUELO: quien le quería (pareja, hijos, padres) pasa un tiempo apagado, tanto más cuanto más le quería
    for (const id of [p.madre, p.padre, p.pareja, ...p.hijos]) {
      const f = id != null && this.porId.get(id);
      if (!f || !f.vivo || f.edad < 3 * TICKS_POR_ANIO) continue;
      const e = f.conocidos.get(p.id), carino = e ? Math.max(0, e.afecto) / 10 : 0.3;
      f.duelo = Math.max(f.duelo, this.tick + Math.round(TICKS_POR_ANIO * (0.3 + carino)));
      f.asoc.suceso('perder a alguien', this.tick);
      this.duelos = (this.duelos || 0) + 1;
    }
    // (solo una muerte violenta marca el sitio: morir de viejo en casa no hace de la casa un lugar maldito)
    if (MUERTE_VIOLENTA.has(causa)) for (const id of [p.madre, p.padre, p.pareja, ...p.hijos]) { const f = id != null && this.porId.get(id); if (f && f.vivo) this.recordarLugar(f, p.x, p.y, -4); }
    // HERENCIA: sus herramientas pasan a un hijo vivo (o a la pareja)
    if (p.objetos.size || p.cosas.length) {
      const heredero = p.hijos.map((h) => this.porId.get(h)).find((q) => q && q.vivo && q.edad >= 10 * TICKS_POR_ANIO) || (p.pareja && this.porId.get(p.pareja));
      if (heredero && heredero.vivo) {
        for (const o of p.objetos) heredero.objetos.add(o);
        for (const a of [...p.cosas, ...p.excedentes]) { this.guardarCosa(heredero, a); if (!heredero.recetas.has(a.clave)) heredero.recetas.set(a.clave, a.receta); }
      }
    }
    if (p.perro) {
      const d = p.perro; p.perro = null;
      const h = p.hijos.map((x) => this.porId.get(x)).find((q) => q && q.vivo && !q.perro && q.edad >= 10 * TICKS_POR_ANIO) || (p.pareja && this.porId.get(p.pareja));
      if (h && h.vivo && !h.perro) { d.dueno = h.id; h.perro = d; } else d.vivo = false;   // (sin nadie, vuelve al monte)
    }
    // EL CUERPO se queda donde cayó (salvo en el agua)
    if (this.pisable(p.x, p.y)) this.cadaveres.set(p.id, { id: p.id, x: p.x, y: p.y, desde: this.tick, tribu: p.tribu, nombre: p.nombre });
    // EL DUELO DE LOS QUE LE QUERÍAN SIN SER FAMILIA: un poco, en proporción a cuánto le apreciaban
    const familia = new Set([p.madre, p.padre, p.pareja, ...p.hijos]);
    let lloran = 0;
    for (const q of this.personas) {
      if (!q.vivo || familia.has(q.id) || q.edad < 3 * TICKS_POR_ANIO) continue;
      const e = q.conocidos.get(p.id);
      if (!e || e.afecto < 6) continue;
      // (PENA, no duelo: decide algo más despacio unas semanas, pero sigue con su vida: pareja, hijos, conversación)
      q.pena = Math.max(q.pena || 0, this.tick + Math.round(TICKS_POR_ANIO * 0.1 * (e.afecto / 10)));
      q.asoc.suceso('perder a alguien', this.tick); lloran++;
    }
    if (lloran >= 15) this.anotar(`Muere ${p.nombre} (${this.tribus[p.tribu].nombre}), y le lloran ${lloran} personas que no eran de su familia.`, 'vida');
    this.primeraVez(`muerte-${causa}`, `${p.nombre} (${this.tribus[p.tribu].nombre}) muere por ${causa}: la primera muerte así.`, 'muerte');
    if (this.tribus[p.tribu].vivos === 0)
      this.anotar(`El pueblo ${this.tribus[p.tribu].nombre} se extingue. Su último miembro fue ${p.nombre}.`, 'extincion');
  }

  /**
   * GUERRA, PAZ Y ALIANZA, de verdad: lo que opina de media cada pueblo del otro (su memoria de lo vivido: regalos,
   * agresiones). Guerra si los dos se tienen por enemigos; alianza si los dos se tienen por amigos. Los cambios, a la
   * crónica.
   */
  medirRelaciones() {
    const vivos = this.personas.filter((p) => p.vivo);
    // LA FAMA: a quién conoce mucha gente (y cuántos de ellos no le han visto nunca)
    const fama = new Map();
    for (const p of vivos) for (const [id, e] of p.conocidos) {
      let f = fama.get(id); if (!f) fama.set(id, f = { n: 0, oidas: 0, afecto: 0 });
      f.n++; f.afecto += e.afecto; if (!e.enPersona) f.oidas++;
    }
    this.fama = fama;
    // LÍDERES: la persona más respetada de cada pueblo
    this.lideres = this.lideres || new Map();
    for (const t of this.tribus) {
      const suyos = vivos.filter((p) => p.tribu === t.id && p.edad >= EDAD_ADULTA * TICKS_POR_ANIO);
      if (!suyos.length) { this.lideres.delete(t.id); continue; }
      if (t.gobierno === 'jefatura' || t.gobierno === 'democracia') { this.elegirGobernante(t, suyos); continue; }
      const mejor = t.gobierno === 'teocracia'
        ? suyos.reduce((a, b) => (this.prestigio(b) + this.piedad(b) > this.prestigio(a) + this.piedad(a) ? b : a))
        : suyos.reduce((a, b) => (this.prestigio(b) > this.prestigio(a) ? b : a));
      const idActual = this.lideres.get(t.id), actual = this.porId.get(idActual) || (idActual != null && { id: idActual, vivo: false, nombre: this.registro.get(idActual).nombre });
      // (el respeto no cambia de manos cada año: hace falta que muera o que otro le supere claramente)
      const sigue = actual && actual.vivo && actual.tribu === t.id && this.prestigio(mejor) < this.prestigio(actual) * 1.5 + 1;
      if (!sigue && (!actual || actual.id !== mejor.id)) {
        if (actual) this.anotar(`${mejor.nombre} es ahora la persona más respetada de los ${t.nombre} (${Math.floor(mejor.edad / TICKS_POR_ANIO)} años, ${mejor.hijos.length} hijos${mejor.cosas.length ? `, con su «${mejor.cosas.map((c) => c.nombre).join('» y su «')}»` : ''})${actual.vivo ? '' : `, tras la muerte de ${actual.nombre}`}.`, 'vida');
        this.lideres.set(t.id, mejor.id);
      }
    }
    // TRADICIONES (lo más parecido a un rito que se puede decir con honestidad): una idea que tiene buena parte del
    // pueblo y que casi todos RECIBIERON de otros (no la vivieron primero), cuyo inventor murió hace mucho. Se mantiene
    // por transmisión, sea útil o no.
    if (this.cultura) for (const t of this.tribus) {
      const suyos = vivos.filter((p) => p.tribu === t.id && p.edad >= EDAD_ADULTA * TICKS_POR_ANIO);
      if (suyos.length < 10) continue;
      const ideas = new Map();
      for (const p of suyos) {
        const vistas = new Set();
        for (const [sit, n] of p.nucleo.neuronas) {
          if (n.accion === 'instinto') continue;
          const k = `${n.concepto}→${n.accion}`;
          if (vistas.has(k)) continue;
          vistas.add(k);
          const o = p.origen.get(sit);
          let e = ideas.get(k); if (!e) ideas.set(k, e = { n: 0, recibida: 0, autor: null, anio: Infinity });
          e.n++;
          if (o && o.manos >= 1) e.recibida++;
          if (o && o.anio < e.anio) { e.anio = o.anio; e.autor = o.autor; }
        }
      }
      for (const [k, e] of ideas) {
        if (e.n < suyos.length * 0.5 || e.recibida < e.n * 0.9 || this.anio - e.anio < 50) continue;
        const r = this.registro.get(e.autor);
        if (!r || r.murio == null || this.anio - r.murio < 20) continue;
        const clave = `${t.id}|${k}`;
        if (this.tradiciones.has(clave)) continue;
        if ([...this.tradiciones.values()].filter((x) => x.tribu === t.id).length >= 2) continue;
        this.tradiciones.set(clave, { tribu: t.id, idea: k, desde: this.anio, autor: e.autor, origen: e.anio });
        const [concepto, accion] = k.split('→');
        this.anotar(`Entre los ${t.nombre} es ya una tradición: ante «${concepto}», ${TEXTO_ACCION[accion] || accion}. La tienen ${e.n} de ${suyos.length} adultos y casi todos la recibieron de otros: viene de ${r.nombre} (${this.tribus[r.tribu].nombre}), que la pensó en el año ${e.anio} y murió hace ${this.anio - r.murio} años.`, 'idea');
      }
    }
    // CREENCIAS: los miedos se olvidan si nada los alimenta; si un tercio del pueblo teme lo mismo, es una creencia
    this.creencias = this.creencias || new Map();
    for (const p of vivos) {
      for (const [a, f] of p.tabues) { if (f < 0.3) p.tabues.delete(a); else p.tabues.set(a, f * 0.93); }
      if (p.usosTotal > 400) { for (const a in p.usos) p.usos[a] *= 0.5; p.usosTotal *= 0.5; }
    }
    for (const t of this.tribus) {
      const suyos = vivos.filter((p) => p.tribu === t.id && p.edad >= EDAD_ADULTA * TICKS_POR_ANIO);
      if (suyos.length < 10) continue;
      const cuenta = new Map();
      for (const p of suyos) for (const [a, f] of p.tabues) if (f >= 1.5) cuenta.set(a, (cuenta.get(a) || 0) + 1);
      for (const [a, n] of cuenta) {
        const k = `${t.id}|${a}`;
        if (n >= suyos.length * 0.3 && !this.creencias.has(k)) {
          this.creencias.set(k, { tribu: t.id, accion: a, desde: this.anio, n, de: suyos.length });
          this.anotar(`Los ${t.nombre} creen que ${TEXTO_ACCION[a] || a} trae desgracias: ${n} de ${suyos.length} lo evitan, porque les cayó una desgracia mientras lo hacían (o se lo contaron).`, 'idea');
        } else if (this.creencias.has(k)) this.creencias.get(k).n = n;
      }
      for (const [k, c] of this.creencias) if (c.tribu === t.id && !cuenta.has(c.accion)) { this.creencias.delete(k); this.anotar(`Los ${t.nombre} ya no temen ${TEXTO_ACCION[c.accion] || c.accion}: la creencia se ha olvidado.`, 'idea'); }
      // OFICIOS: un pueblo con 5 o más expertos (4 o más hechas) en algo es "un pueblo de" eso
      { const n = suyos.filter((p) => p.hechas >= 6).length;
        if (n >= 5) this.primeraVez(`oficio-${t.id}`, `Los ${t.nombre} tienen ya ${n} artesanos: hacen de sobra para dar a los suyos y cambiar con otros pueblos.`, 'invento'); }
    }
    // (LA ROPA SE GASTA: cada año, alguna se rompe)
    for (const p of vivos) for (const a of [...p.cosas]) if (this.azar() < (a.usos.abrigo > 0.1 ? 0.08 : 0.05)) p.cosas.splice(p.cosas.indexOf(a), 1);
    // (LAS COSTUMBRES CON LOS MUERTOS: un pueblo que hace casi siempre lo mismo -el 70 % o más de 8 funerales o más-)
    for (const t of this.tribus) {
      const f = t.funerales; if (!f) continue;
      const total = f.enterrar + f.quemar + f.apartar; if (total < 8) continue;
      const [forma, n] = Object.entries(f).sort((a, b) => b[1] - a[1])[0];
      if (n >= total * 0.7) this.primeraVez(`costumbre-funebre-${t.id}-${forma}`, `Los ${t.nombre} ya tienen su costumbre con los muertos: los ${{ enterrar: 'entierran', quemar: 'queman', apartar: 'apartan lejos de la aldea' }[forma]} (${n} de ${total} veces). Nadie se lo enseñó a todos: cada uno hizo lo que vio hacer.`, 'idea');
    }
    this.gobernar(vivos);
    if (this.cultura) this.medirLenguas(vivos);
    // LUGARES DE CADA PUEBLO: una zona que muchos recuerdan igual se vuelve prohibida o de abundancia
    this.lugaresPueblo = this.lugaresPueblo || new Map();
    for (const t of this.tribus) {
      const suyos = vivos.filter((p) => p.tribu === t.id && p.edad >= EDAD_ADULTA * TICKS_POR_ANIO);
      if (suyos.length < 10) continue;
      const malo = new Map(), bueno = new Map();
      for (const p of suyos) for (const [z, v] of p.lugares) { if (v <= -3) malo.set(z, (malo.get(z) || 0) + 1); else if (v >= 3) bueno.set(z, (bueno.get(z) || 0) + 1); }
      for (const [mapa, tipo] of [[malo, 'prohibido'], [bueno, 'abundancia']]) for (const [z, n] of mapa) {
        if (n < suyos.length * 0.3) continue;
        const k = `${t.id}|${z}`;
        if (this.lugaresPueblo.has(k)) continue;
        // (un pueblo tiene pocos lugares así: los tres primeros de cada clase)
        if ([...this.lugaresPueblo.values()].filter((l) => l.tribu === t.id && l.tipo === tipo).length >= 3) continue;
        this.lugaresPueblo.set(k, { tribu: t.id, zona: z, tipo, desde: this.anio });
        const x = (z % 64) * 4 + 2, y = Math.floor(z / 64) * 4 + 2;
        this.anotar(tipo === 'prohibido'
          ? `Los ${t.nombre} evitan un lugar ${this.describirSitio(x, y)}: allí pasó algo malo, y ya es un lugar prohibido para ellos (lo recuerdan ${n} de ${suyos.length}).`
          : `Los ${t.nombre} vuelven una y otra vez a un lugar ${this.describirSitio(x, y)}: es su lugar de abundancia (lo recuerdan ${n} de ${suyos.length}).`, 'idea');
      }
    }
    for (const [id, f] of fama) {
      if (f.n < 40) continue;
      const r = this.registro.get(id);
      if (!r) continue;
      const tono = f.afecto / f.n >= 1 ? 'por generoso' : f.afecto / f.n <= -1 ? 'y temido' : '';
      this.primeraVez(`famoso-${id}`, `${r.nombre} (${this.tribus[r.tribu].nombre}) es conocido ${tono} por ${f.n} personas; ${f.oidas} de ellas no le han visto nunca${r.murio != null ? ', y murió hace años' : ''}.`, 'idea');
    }
    const pob = new Array(this.tribus.length).fill(0);
    for (const p of vivos) pob[p.tribu]++;
    this.historia.push(pob);
    // (la proporción de adultos que tienen al otro pueblo por enemigo, o por amigo: la media escondía que el rencor
    // empieza en unos pocos y se contagia)
    const parte = (a, b, cond) => {
      let s = 0, n = 0;
      for (const p of vivos) if (p.tribu === a && p.edad >= EDAD_ADULTA * TICKS_POR_ANIO) { if (cond(p.afinidad[b])) s++; n++; }
      return n ? s / n : null;
    };
    const enemigos = (a, b) => parte(a, b, (v) => v <= -3), amigos = (a, b) => parte(a, b, (v) => v >= 3);
    // (los muertos entre pueblos de hace 2 años, para la guerra que se ve)
    this.caidosAnios = this.caidosAnios || [];
    this.caidosAnios.push(new Map(this.caidos)); if (this.caidosAnios.length > 3) this.caidosAnios.shift();
    this.caidosHace2 = this.caidosAnios[0];
    for (const k of this.contactos) {
      const [a, b] = k.split('-').map(Number);
      const eab = enemigos(a, b), eba = enemigos(b, a), aab = amigos(a, b), aba = amigos(b, a);
      const antes = this.relaciones.get(k) || 'paz';
      if (eab === null || eba === null) { this.relaciones.delete(k); continue; }
      let ahora = 'paz';
      // (QUIÉN DECIDE LA GUERRA: en una banda o una teocracia basta un cuarto de rencorosos; en una democracia, la
      // mayoría; en una jefatura, el jefe solo, y puede declararla aunque el otro pueblo no la quiera)
      const quiere = (x, y, e) => { const g = this.tribus[x].gobierno; return g === 'democracia' ? e >= 0.5 : g === 'jefatura' ? this.jefeOdia(x, y) : e >= 0.25; };
      const declara = (x, y) => this.tribus[x].gobierno === 'jefatura' && this.jefeOdia(x, y, -5);
      if (!this.inducidas) {
        // (SIN REGLAS DE GRUPO: la guerra no se declara; es el nombre de lo que pasa —al menos 2 muertos en peleas entre
        // los dos pueblos en los últimos 2 años, peleas que eligió cada uno—; la alianza, que la mitad de cada pueblo
        // tenga al otro por amigo)
        const muertos = (this.caidos.get(k) || 0) - ((this.caidosHace2 && this.caidosHace2.get(k)) || 0);
        ahora = muertos >= 2 ? 'guerra' : aab >= 0.5 && aba >= 0.5 ? 'alianza' : 'paz';
      } else if ((quiere(a, b, eab) && quiere(b, a, eba)) || declara(a, b) || declara(b, a)) ahora = 'guerra';
      else if (aab >= 0.5 && aba >= 0.5) ahora = 'alianza';
      // (para salir de la guerra hace falta algo más: que en los dos pueblos queden menos de un 10 % de rencorosos)
      if (this.inducidas && antes === 'guerra' && ahora !== 'guerra' && (eab >= 0.1 || eba >= 0.1) && !(this.tribus[a].gobierno === 'jefatura' || this.tribus[b].gobierno === 'jefatura')) ahora = 'guerra';
      if (ahora === antes) continue;
      this.relaciones.set(k, ahora);
      const ta = this.tribus[a].nombre, tb = this.tribus[b].nombre;
      if (ahora === 'guerra') {
        this.guerras.set(k, { desde: this.anio, caidos: 0 });
        this.anotar(`Comienza la guerra entre los ${ta} y los ${tb}.`, 'guerra');
      } else if (antes === 'guerra') {
        const g = this.guerras.get(k);
        this.anotar(`Vuelve la paz entre los ${ta} y los ${tb}, tras ${this.anio - g.desde} años de guerra y ${g.caidos} caídos.`, 'paz');
      }
      if (ahora === 'alianza') {
        const ya = this.alianzas.has(k);
        this.alianzas.add(k);
        this.anotar(ya ? `Los ${ta} y los ${tb} renuevan su alianza.` : `Los ${ta} y los ${tb} se tienen por amigos: alianza.`, 'paz');
      }
    }
  }

  /** ENFERMEDADES NATURALES: en las aldeas grandes (12 o más en el mismo hogar), a veces, alguien enferma; se contagia. */
  brotesDeEnfermedad() {
    const hogares = new Map();
    for (const p of this.personas) if (p.vivo) { const k = `${p.hogar[0]},${p.hogar[1]}`; if (!hogares.has(k)) hogares.set(k, []); hogares.get(k).push(p); }
    for (const gente of hogares.values()) {
      if (gente.length < 12 || this.azar() > 0.02 * (gente.length / 12)) continue;
      const q = this.azar.elegir(gente);
      if (this.contagiar(q, 'enfermedad')) this.anotar(`Una enfermedad aparece en una aldea de los ${this.tribus[q.tribu].nombre} (${gente.length} personas): enferma ${q.nombre}.`, 'muerte');
    }
  }

  /** El clima de este año y lo que hace con el agua. */
  /** La zona de una casilla según lo que ha llovido este año frente a lo normal: seca, normal o mojada. */
  zonaClima(x, y) {
    if (!this.fisica) return null;
    const h = this.fisica.humedadLocal(x, y);
    return h < 0.8 ? 'seca' : h > 1.2 ? 'mojada' : 'normal';
  }

  /** Lo que espera ahora su memoria de sucesos (abreviado: las tres primeras letras del efecto), o '0'. */
  esperaDe(p) {
    // (solo lo que importa: lo esperado cuya valencia —lo que hace al cuerpo, aprendido por él— es clara)
    const A = p.asoc; let mejor = null, f = 0;
    for (const [causa, efecto, hasta] of A.esperando) {
      if (hasta < this.tick) continue;
      const v = this.valorDe(p, efecto);
      if (Math.abs(v) < 0.05) continue;
      const x = A.fuerza(causa, efecto) * Math.abs(v); if (x > f) { f = x; mejor = efecto; }
    }
    if (!mejor) return '0';
    return (this.valorDe(p, mejor) > 0 ? 'm' : 'b') + abreviar(mejor);
  }

  /** Lo que vale un suceso para esta persona (> 0 malo): su valencia y, con el valor encadenado, lo que espera que traiga. */
  valorDe(p, que) {
    const A = p.asoc; let v = A.valencia.get(que) || 0;
    if (!this.valorEncadenado) return v;
    for (const w of A.vinculos.values()) {
      if (w.a !== que || w.veces < 2) continue;
      const f = A.fuerza(que, w.b); if (f < 0.3) continue;
      v += Math.min(1, f) * (A.valencia.get(w.b) || 0);
    }
    return v;
  }

  /**
   * REFUERZO VICARIO (Bandura): a alguien le ha ido bien o mal lo que acaba de hacer (su cuerpo lo nota); hasta 3 de los
   * que están mirando a 3 casillas o menos aprenden esa acción en esa situación, con la mitad de peso. La idea pasa de
   * uno a otro por verla, y su genealogía lo apunta.
   */
  observarResultado(q, bueno) {
    if (!q.situacion || !q.accion) return;
    let n = 0;
    for (const o of this.cercanos(q.x, q.y, 3)) {
      if (o === q || !o.vivo || o.dormido || o.edad < 3 * TICKS_POR_ANIO || !o.nucleo.repasar || n >= 3 || this.azar() > 0.5) continue;
      n++; this.estadVicario.vistas++;
      if (o.nucleo.repasar([[q.situacion, q.accion]], bueno, 0.5) && o.origen) {
        this.estadVicario.cambios++;
        const og = q.origen.get(q.situacion) || { autor: q.id, nombre: q.nombre, tribu: q.tribu, anio: this.anio, manos: 0 };
        o.origen.set(q.situacion, { ...og, manos: og.manos + 1, de: q.id, cuando: this.anio, vista: true });
      }
    }
  }

  /**
   * VER COMER (refuerzo vicario, también para las plantas): quienes ven a alguien comer una planta y que le siente bien o
   * mal aprenden sobre esa planta —sus rasgos— con su propia mente de comer, con la mitad de peso.
   */
  verComer(q, rasgos, bueno) {
    let n = 0;
    for (const o of this.cercanos(q.x, q.y, 3)) {
      if (o === q || !o.vivo || o.dormido || o.edad < 3 * TICKS_POR_ANIO || n >= 4) continue;
      const m = this.menteDeComer(o); if (!m.repasar) continue;
      n++; m.repasar([[rasgos, 'comer']], bueno, 0.5); m.reiniciarEstadisticas(); this.estadVicario.plantas = (this.estadVicario.plantas || 0) + 1;
    }
  }

  /**
   * EL MIEDO POR OBSERVACIÓN (Olsson y Phelps 2007): a alguien le pasa algo que le importa (valencia clara para él: enfermar,
   * herirse...); quienes lo ven unen en su memoria lo que le vieron vivir en los días de antes con lo que le pasó.
   */
  verSuceso(q, que) {
    if (Math.abs(q.asoc.valencia.get(que) || 0) < 0.05) return;
    const rec = q.asoc.recientes, contexto = [];
    for (let i = rec.length - 2; i >= 0 && contexto.length < 4; i--) { if (this.tick - rec[i][1] > 4 * TICKS_POR_DIA) break; if (rec[i][0] !== que) contexto.push(rec[i][0]); }
    if (!contexto.length) return;
    let n = 0;
    for (const o of this.cercanos(q.x, q.y, 3)) {
      if (o === q || !o.vivo || o.dormido || o.edad < 3 * TICKS_POR_ANIO || n >= 4) continue;
      n++; o.asoc.observar(contexto, que, 0.5); this.estadVicario.miedos++;
    }
  }

  /**
   * SE CUMPLE LO QUE ESPERABA: si era malo para su cuerpo (valencia aprendida), lo que hizo mientras lo esperaba se
   * castiga (miedo condicionado); si era bueno, se refuerza.
   */
  seCumple(p, cumplidas) {
    if (!p.huellas) return;
    for (const [, efecto] of cumplidas) {
      const k = abreviar(efecto), lista = p.huellas.get(k); if (!lista || !lista.length) continue;
      const v = this.valorDe(p, efecto);
      if (v > 0.05) { this.leccion(p, () => p.nucleo.repasar(lista, false, 1)); this.estadAlivio.miedos++; }
      else if (v < -0.05) { this.leccion(p, () => p.nucleo.repasar(lista, true, 0.5)); this.estadAlivio.logros++; }
      p.huellas.delete(k);
    }
  }

  /**
   * NO LLEGÓ LO QUE ESPERABA: si era malo, ALIVIO —lo que hizo mientras tanto se refuerza: quizá fue eso lo que lo
   * evitó—; si era bueno, desengaño —un fallo pequeño—.
   */
  noLlego(p, sorpresas) {
    if (!p.huellas) return;
    for (const [, efecto] of sorpresas) {
      const k = abreviar(efecto), lista = p.huellas.get(k); if (!lista || !lista.length) continue;
      const v = this.valorDe(p, efecto);
      if (v > 0.05) {
        this.leccion(p, () => p.nucleo.repasar(lista, true, 1)); this.estadAlivio.alivios++;
        this.primeraVez(`alivio-${p.tribu}`, `${p.nombre} (${this.tribus[p.tribu].nombre}) esperaba «${efecto}» y no llegó: lo que hizo mientras tanto se le queda como lo que hay que hacer.`, 'idea');
      } else if (v < -0.05) { this.leccion(p, () => p.nucleo.repasar(lista, false, 0.3)); this.estadAlivio.desengaños++; }
      p.huellas.delete(k);
    }
  }

  /**
   * MUDARSE CON LOS SUYOS (una acción que elige su cerebro): la familia se va a 15-30 casillas, al sitio con agua que
   * más comida tenga de los que mira. Como mucho una vez al año.
   */
  mudarse(p) {
    if (!this.permitirMudanzas) return false;
    if (p.edad < EDAD_ADULTA * TICKS_POR_ANIO || this.tick - (p.ultimaMudanza ?? -1e9) < TICKS_POR_ANIO) return false;
    let mejor = null;
    for (let k = 0; k < 14; k++) {
      const ang = this.azar() * Math.PI * 2, d = 15 + this.azar() * 15;
      const x = Math.round(p.hogar[0] + Math.cos(ang) * d), y = Math.round(p.hogar[1] + Math.sin(ang) * d);
      if (!this.pisable(x, y) || this.t(x, y) === TERRENO.AGUA || (this.islas && this.uso(p, 'flota') < 0.5 && this.isla(x, y) !== this.isla(p.hogar[0], p.hogar[1]))) continue;
      if (!this.cerca(x, y, 5, (xx, yy) => this.t(xx, yy) === TERRENO.AGUA)) continue;
      if (this.cercanos(x, y, 8).some((q) => q.vivo && q.tribu !== p.tribu)) continue;   // (no donde ya vive otro pueblo)
      const nota = this.comidaCerca(x, y, 8);
      if (!mejor || nota > mejor.nota) mejor = { x, y, nota };
    }
    if (!mejor) return false;
    const familia = [p, this.porId.get(p.pareja), ...p.hijos.map((h) => this.porId.get(h))].filter((q) => q && q.vivo);
    // (si cerca del sitio hay una cueva libre, con agua, se quedan en ella)
    if (this.refugios) {
      for (const r of this.refugios.values()) for (const q of familia) r.habitantes.delete(q.id);
      for (const r of this.refugios.values()) {
        if (r.tipo !== 'cueva' || Math.max(Math.abs(r.x - mejor.x), Math.abs(r.y - mejor.y)) > 6 || this.ocupacion(r) + familia.length > r.capacidad || this.dist_[TERRENO.AGUA][r.y * this.ancho + r.x] > 10) continue;
        mejor.x = r.x; mejor.y = r.y; for (const q of familia) r.habitantes.add(q.id); if (r.tribu == null) r.tribu = p.tribu; break;
      }
    }
    for (const q of familia) { q.hogar = [mejor.x, mejor.y]; q.ultimaMudanza = this.tick; q.asoc.suceso('migrar', this.tick); }
    // (una familia que se va lejos de los suyos funda un asentamiento: si dura y crece, puede nacer de ahí un pueblo)
    if (!this.inducidas) {
      const t = this.tribus[p.tribu];
      if (Math.hypot(mejor.x - t.campo[0], mejor.y - t.campo[1]) > 35 && !this.colonias.some((c) => c.tribu === p.tribu && Math.hypot(c.campo[0] - mejor.x, c.campo[1] - mejor.y) < 20))
        this.colonias.push({ tribu: p.tribu, campo: [mejor.x, mejor.y], desde: this.anio });
    }
    this.estadPrediccion.mudanzas++;
    if (p.espera && p.espera !== '0') this.estadPrediccion.conEspera[p.espera] = (this.estadPrediccion.conEspera[p.espera] || 0) + 1;
    this.primeraVez(`mudanza-${p.tribu}`, `${p.nombre} (${this.tribus[p.tribu].nombre}) decide mudarse con los suyos ${this.describirSitio(mejor.x, mejor.y)}${p.espera && p.espera !== '0' ? ` (su memoria esperaba «${p.espera}…»)` : ''}.`, 'migracion');
    return true;
  }

  /** La celda de agua (8×8) de una casilla. */
  celdaAgua(x, y) { return (Math.max(0, y) >> 3) * Math.ceil(this.ancho / 8) + (Math.max(0, x) >> 3); }

  /**
   * EL AGUA SE ENSUCIA (cada paso de física): junto a un cadáver sin enterrar, y donde vive mucha gente; se limpia sola
   * poco a poco, y deprisa con la lluvia. Más de 0,5 se ve turbia.
   */
  ensuciarAgua() {
    const S = this.suciedad, cw = Math.ceil(this.ancho / 8);
    for (let c = 0; c < S.length; c++) {
      if (!S[c]) continue;
      const llueve = this.fisica && this.fisica.lluviaAhora[this.fisica.celda((c % cw) * 8 + 4, Math.floor(c / cw) * 8 + 4)] > 0.02;
      S[c] = S[c] < 0.02 ? 0 : S[c] * (llueve ? 0.6 : 0.88);
    }
    for (const c of this.cadaveres.values()) if (this.dist_[TERRENO.AGUA][c.y * this.ancho + c.x] <= 3) { const k = this.celdaAgua(c.x, c.y); S[k] = Math.min(1.5, S[k] + 0.35); }
    const gente = new Uint16Array(S.length);
    for (const q of this.personas) if (q.vivo) gente[this.celdaAgua(q.x, q.y)]++;
    for (let c = 0; c < S.length; c++) if (gente[c] > 14) S[c] = Math.min(1.5, S[c] + 0.015 * (gente[c] - 14));
  }

  /** ¿Es turbia el agua de esta casilla? (el mar no: sale de muy lejos) */
  turbia(x, y) { return !this.mar[y * this.ancho + x] && this.suciedad[this.celdaAgua(x, y)] > 0.5; }

  /**
   * BEBER del agua de al lado. Si es turbia: quien sabe que enferma (y no tiene una sed terrible), no bebe; si bebe,
   * puede enfermar entre 2 y 4 días después. Devuelve si ha bebido.
   */
  beber(p) {
    if (!this.aguaSucia) return true;
    let turbiaAqui = true;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (this.t(p.x + dx, p.y + dy) === TERRENO.AGUA && !this.turbia(p.x + dx, p.y + dy)) turbiaAqui = false;
    this.estadAgua.tragos++;
    if (!turbiaAqui) return true;
    if (this.conductasAMano && p.sed < 85 && this.sabe(p, 'beber agua turbia', 'enfermar')) { this.estadAgua.evitados++; return false; }
    this.estadAgua.turbios++;
    p.asoc.suceso('beber agua turbia', this.tick);
    if (this.azar() < 0.15) this.nombrarSuceso('e:turbia', p.x, p.y, 3);
    const s = this.suciedad[this.celdaAgua(p.x, p.y)];
    if (!p.incuba && !(p.enfermo > 0) && this.azar() < Math.min(0.45, 0.3 * s)) p.incuba = this.tick + 160 + this.azar.entero(160);
    return true;
  }

  /** Quien sabe que el agua turbia enferma y tiene delante agua turbia, busca agua limpia cerca (a 8 casillas o menos). */
  aguaParaBeber(p, agua) {
    if (!this.conductasAMano || !this.aguaSucia || !agua || !this.turbia(agua[0], agua[1]) || !this.sabe(p, 'beber agua turbia', 'enfermar')) return null;
    let mejor = null, dmin = 99;
    for (let y = p.y - 8; y <= p.y + 8; y += 1) for (let x = p.x - 8; x <= p.x + 8; x += 1) {
      if (this.t(x, y) !== TERRENO.AGUA || this.turbia(x, y)) continue;
      const d = Math.max(Math.abs(x - p.x), Math.abs(y - p.y)); if (d < dmin) { dmin = d; mejor = [x, y]; }
    }
    return mejor;
  }

  /** La mente de comer de una persona: decide ante cada especie nueva si la come o la deja (del tipo de su mundo). */
  menteDeComer(p) {
    if (p.comer) return p.comer;
    const acc = ['comer', 'dejar'];
    if (this.mente === 'neutro') p.comer = new Nucleo(PERCEPCION_PLANTAS, { acciones: acc, completar: true });
    else if (this.mente === 'q') p.comer = new MenteQ(acc);
    else if (this.mente === 'azar') p.comer = new MenteAzar(acc, this.azar);
    else p.comer = new MenteInstinto(acc);
    // (con cultura, lo que su madre sabía de las plantas, como lo demás)
    const madre = this.cultura && this.copias && p.madre != null && this.porId.get(p.madre);
    if (madre && madre.comer) {
      if (madre.comer.aObjeto && p.comer.cargarObjeto) p.comer.cargarObjeto(JSON.parse(JSON.stringify(madre.comer.aObjeto())));
      else if (madre.comer.q && p.comer.q) for (const [k, f] of madre.comer.q) p.comer.q.set(k, Float32Array.from(f));
      if (madre.evita) p.evita = new Set(madre.evita);
    }
    return p.comer;
  }

  /**
   * COMER UNA PLANTA NUEVA: su mente de comer mira sus rasgos (color, forma, hoja, olor) y decide. Si la come y es
   * venenosa, enferma (y su mente aprende); si es buena, alimenta. Se cuenta qué hace cada uno LA PRIMERA VEZ que ve una
   * especie: ahí se ve si generaliza por el parecido o tiene que probarlo todo.
   */
  comerPlanta(p, i) {
    const id = this.baya[i], e = this.especies[id], mente = this.menteDeComer(p);
    p.probadas = p.probadas || new Set();
    const primera = !p.probadas.has(id); p.probadas.add(id);
    const [accion] = mente.decidirSituacion(e.rasgos, true, () => 0);
    const come = accion !== 'dejar';
    const st = primera ? this.estadPlantas.primeras : this.estadPlantas.despues;
    if (e.efecto === 'veneno') st[come ? 'venenoComio' : 'venenoDejo'] = (st[come ? 'venenoComio' : 'venenoDejo'] || 0) + 1;
    else if (primera) st[come ? 'comidaComio' : 'comidaDejo']++;
    if (!come) { p.evita = p.evita || new Set(); p.evita.add(id); mente.reiniciarEstadisticas(); return; }
    if (p.evita) p.evita.delete(id);
    this.fruta[i]--;
    if (e.efecto === 'veneno') {
      p.hambre = Math.max(0, p.hambre - 10);
      mente.aprenderDeFracaso(null); mente.reiniciarEstadisticas();
      p.evita = p.evita || new Set(); p.evita.add(id);
      this.herir(p, 30, 'veneno');
      if (this.vicario) this.verComer(p, e.rasgos, false);
    } else {
      this.desgaste[i] += 0.5; p.hambre = Math.max(0, p.hambre - 40); p.vitaminas = Math.min(100, p.vitaminas + 35);
      if (e.temporada) this.recordarTemporada(p, i % this.ancho, (i / this.ancho) | 0);
      if (this.vicario) this.verComer(p, e.rasgos, true);
      mente.consolidar(0); mente.reiniciarEstadisticas();
      this.acierto(p);
    }
  }

  /**
   * LLEGA UNA PLANTA NUEVA: unos rasgos que no tenía ninguna (que sea venenosa sale de sus rasgos, por la regla del
   * mundo), y brota en unos sitios de hierba.
   */
  llegaPlanta(x0 = null, y0 = null) {
    const C = 'ranmzb', F = 'ol', H = 'af', O = 'dp';
    let r = null;
    for (let k = 0; k < 50 && !r; k++) {
      const x = C[this.azar.entero(6)] + F[this.azar.entero(2)] + H[this.azar.entero(2)] + O[this.azar.entero(2)];
      if (!this.especies.some((e) => e && e.rasgos === x)) r = x;
    }
    if (!r) return;
    const frio = 'mzb'.includes(r[0]) ? 2 : 0, veneno = frio + (r[3] === 'p' ? 1 : 0) + (r[2] === 'f' ? 1 : 0) >= 3;
    const id = this.especies.length;
    this.especies.push({ rasgos: r, efecto: veneno ? 'veneno' : 'comida', llego: this.anio });
    let n = 0;
    for (let k = 0; k < (x0 != null ? 1 : 3); k++) {
      const [cx, cy] = x0 != null ? [x0, y0] : this.sitioLibre((t) => t === TERRENO.HIERBA);
      for (let j = 0; j < 40; j++) {
        const x = cx + this.azar.entero(9) - 4, y = cy + this.azar.entero(9) - 4, i = y * this.ancho + x;
        if (!this.pisable(x, y) || this.t(x, y) === TERRENO.AGUA || this.baya[i]) continue;
        this.apuntarArbusto(i); this.baya[i] = id; this.fruta[i] = 3; n++;
      }
    }
    this.estadPlantas.llegadas++;
    const COLOR = { r: 'rojas', a: 'amarillas', n: 'naranjas', m: 'moradas', z: 'azules', b: 'blancas' };
    if (x0 != null) this.efecto('comida', x0, y0);
    this.anotar(`Aparece una planta que nadie había visto: bayas ${COLOR[r[0]]}, ${r[1] === 'o' ? 'redondas' : 'alargadas'}, de hoja ${r[2] === 'a' ? 'ancha' : 'fina'} y olor ${r[3] === 'd' ? 'dulce' : 'picante'} (${n} matas).`, 'invento');
  }

  /** 4: LO GUARDADO SE PUDRE (cada paso de física): según la temperatura del sitio; con fuego en el hogar, mucho menos. */
  pudrirComida() {
    for (const [k, d] of this.despensas) {
      if (!d) continue;
      const [x, y] = k.split(',').map(Number), t = this.fisica ? this.fisica.temperatura(x, y) : 12;
      let r = 0.02 + 0.006 * Math.max(0, t);
      if (this.hogueras.has(k)) r *= 0.25;   // (ahumado)
      const pierde = Math.floor(d * r) + (this.azar() < (d * r) % 1 ? 1 : 0);
      if (pierde) { this.despensas.set(k, d - pierde); this.estadPudrir.podrido += pierde; }
    }
    for (const q of this.personas) {
      if (!q.vivo || !q.carga) continue;
      const t = this.fisica ? this.fisica.temperatura(q.x, q.y) : 12;
      if (this.azar() < 0.02 + 0.008 * Math.max(0, t)) { q.carga--; this.estadPudrir.podrido++; }
    }
  }

  /** 5: ¿Hay marea baja ahora? (un ciclo de 1,6 días: baja algo más de un tercio del tiempo) */
  get bajamar() { return this.mareas && Math.sin(2 * Math.PI * this.tick / 128) < -0.35; }

  /** ¿Está en la orilla del mar? */
  enCosta(p) {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const x = p.x + dx, y = p.y + dy; if (x >= 0 && y >= 0 && x < this.ancho && y < this.alto && this.mar[y * this.ancho + x]) return true; }
    return false;
  }

  /**
   * 6: LAS LANGOSTAS: la primavera después de un año de lluvias, a veces, una nube de langostas arrasa la fruta de una
   * comarca y no deja que rebrote en toda la estación. Los que lo ven lo recuerdan (y lo nombran).
   */
  plagaDeLangostas(x0 = null, y0 = null) {
    const vivos = this.personas.filter((q) => q.vivo); if (!vivos.length && x0 == null) return;
    const c = x0 != null ? { x: x0, y: y0 } : this.azar.elegir(vivos), R = x0 != null ? 16 : 28;
    this.plagaLangosta = { x: c.x, y: c.y, R, hasta: this.tick + TICKS_POR_ANIO / 4 };
    for (const i of this.arbustosEn(c.x, c.y, R)) this.fruta[i] = 0;
    for (const q of this.cercanos(c.x, c.y, R)) if (q.vivo) q.asoc.suceso('langostas', this.tick);
    this.nombrarSuceso('e:langosta', c.x, c.y, R);
    this.estadLangostas.plagas++;
    this.efecto('plaga', c.x, c.y);
    this.anotar(`${x0 != null ? 'Llega' : 'Tras las lluvias llega'} una nube de langostas ${this.describirSitio(c.x, c.y)}: se comen toda la fruta de la comarca.`, x0 != null ? 'dios' : 'clima');
  }

  arbustosEn(x0, y0, R) {
    const out = [];
    for (let y = Math.max(0, y0 - R); y <= Math.min(this.alto - 1, y0 + R); y++) for (let x = Math.max(0, x0 - R); x <= Math.min(this.ancho - 1, x0 + R); x++) {
      const i = y * this.ancho + x; if (this.baya[i] && Math.hypot(x - x0, y - y0) <= R) out.push(i);
    }
    return out;
  }

  /** Un paso de la física; y quien está sobre el hielo cuando se deshiela, a veces se hunde. */
  pasoFisica() {
    const f = this.fisica;
    for (const q of this.personas) if (q.vivo) this.gentePorZona[this.zonaClima(q.x, q.y)]++;
    if (this.aguaSucia) this.ensuciarAgua();
    if (this.pudrir) this.pudrirComida();
    // (mientras dura la plaga, la fruta de la comarca no rebrota)
    if (this.plagaLangosta) { if (this.tick > this.plagaLangosta.hasta) this.plagaLangosta = null; else { const { x, y, R } = this.plagaLangosta; for (const i of this.arbustosEn(x, y, R)) this.fruta[i] = 0; } }
    f.deshielos = [];
    f.paso(this.tick);
    if (this.geologia) this.geologia.paso();
    for (const i of f.deshielos) {
      const x = i % this.ancho, y = (i / this.ancho) | 0;
      for (const q of this.cercanos(x, y, 0)) {
        if (this.uso(q, 'flota') >= 0.5 || this.azar() > 0.03) continue;
        this.herir(q, 999, 'ahogado');
        this.primeraVez('hielo-roto', `El hielo se rompe bajo ${q.nombre} (${this.tribus[q.tribu].nombre}), que se ahoga: llega el deshielo.`, 'clima');
      }
    }
    if (f.hieloCambiado) { f.hieloCambiado = false; this.hieloSucio = true; this.cercaniaSucia = true; }
  }

  cambiarClima() {
    // (con la física, la humedad del año es lo que ha llovido frente a lo normal; sin ella, un paseo al azar)
    if (this.fisica) this.humedad = Math.max(0.35, Math.min(1.7, this.fisica.humedadMundo()));
    else this.humedad += (this.azar() - 0.5) * 0.3 + (1 - this.humedad) * 0.08;
    this.humedad = Math.max(0.35, Math.min(1.7, this.humedad));
    const antes = this.estadoClima;
    // (con histéresis: una sequía empieza por debajo de 0,65 pero no acaba hasta pasar de 0,85; igual las lluvias)
    if (antes === 'sequia') this.estadoClima = this.humedad > 0.85 ? 'normal' : 'sequia';
    else if (antes === 'lluvias') this.estadoClima = this.humedad < 1.15 ? 'normal' : 'lluvias';
    else this.estadoClima = this.humedad < 0.65 ? 'sequia' : this.humedad > 1.35 ? 'lluvias' : 'normal';
    if (this.estadoClima !== antes) {
      if (this.estadoClima !== 'normal') for (const p of this.personas) if (p.vivo) p.asoc.suceso(this.estadoClima === 'sequia' ? 'sequía' : 'lluvias', this.tick);
      if (this.estadoClima === 'sequia') { this.anotar('Comienza una gran sequía: los lagos menguan y hay menos bayas.', 'clima'); this.antesDeSequia = { pob: this.personas.filter((p) => p.vivo).length, anio: this.anio, minimo: Infinity }; }
      else if (this.estadoClima === 'lluvias') this.anotar('Años de lluvias: los lechos secos se llenan y los ríos crecen.', 'clima');
      else this.anotar(antes === 'sequia' ? `Termina la sequía, tras ${this.anio - this.inicioClima} años.` : `Las lluvias amainan, tras ${this.anio - this.inicioClima} años.`, 'clima');
      this.inicioClima = this.anio;
    }
    // RESISTENCIA: cuántos años tardan en volver a la población de antes de la sequía (y cuánto cayó)
    if (this.antesDeSequia) {
      const pob = this.personas.filter((p) => p.vivo).length, s = this.antesDeSequia;
      s.minimo = Math.min(s.minimo, pob);
      if (this.estadoClima !== 'sequia' && pob >= s.pob) { this.recuperaciones.push({ anios: this.anio - s.anio, caida: +(1 - s.minimo / s.pob).toFixed(2) }); this.antesDeSequia = null; }
    }
    // EL BOSQUE QUEMADO vuelve a crecer con los años
    for (const [i, cuando] of this.quemado) if (this.anio >= cuando) {
      if (this.terreno[i] === TERRENO.HIERBA) { this.terreno[i] = TERRENO.BOSQUE; this.terrenoCambiado = true; this.cercaniaSucia = true; }
      this.quemado.delete(i);
    }
    if (this.estadoClima === 'sequia' && this.azar() < 0.6) this.incendio();
    if (this.estadoClima === 'lluvias' && this.azar() < 0.6) this.riada();
    // TORMENTAS: en años de lluvias cae algún rayo de verdad, cerca de alguien (no lo lanza el jugador)
    if (this.estadoClima === 'lluvias' && this.azar() < 0.5) {
      const vivos = this.personas.filter((p) => p.vivo);
      if (vivos.length) { const q = this.azar.elegir(vivos); this.rayo(q.x + this.azar.entero(7) - 3, q.y + this.azar.entero(7) - 3, true); }
    }
    const W = this.ancho, H = this.alto, T = this.terreno;
    const vecinosAgua = (x, y) => { let n = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && this.t(x + dx, y + dy) === TERRENO.AGUA) n++; return n; };
    // (con la física, cada lago responde a lo que ha llovido en su zona; sin ella, a la humedad de todo el mundo)
    const hum = (x, y) => (this.fisica ? this.fisica.humedadLocal(x, y) : this.humedad);
    {
      // SEQUÍA: las orillas se secan (el agua con mucha tierra alrededor), y queda un lecho que puede volver a llenarse
      const secar = [];
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (T[i] !== TERRENO.AGUA || this.mar[i]) continue;
        const h = hum(x, y); if (h >= 0.8) continue;
        const prob = (0.8 - h) * 0.5, agua = vecinosAgua(x, y);
        if (agua <= 5 && this.azar() < prob * (6 - agua) / 6) secar.push(i);
      }
      for (const i of secar) { T[i] = TERRENO.HIERBA; this.lecho[i] = 1; if (this.fisica && this.fisica.hielo[i]) { this.fisica.hielo[i] = 0; this.fisica.nHielo--; } }
      if (secar.length) this.cercaniaSucia = true;
      // y parte de los arbustos se quedan sin fruta (la sequía muerde)
      if (this.humedad < 0.8) for (let i = 0; i < this.baya.length; i++) if (this.baya[i] && this.azar() < 0.35) this.fruta[i] = 0;
      if (secar.length) this.terrenoCambiado = true;
    }
    {
      // LLUVIAS: los lechos junto al agua se llenan; y, con mucha lluvia, algún desbordamiento (nunca sobre alguien)
      const llenar = [];
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (T[i] === TERRENO.AGUA || T[i] === TERRENO.ROCA) continue;
        const h = hum(x, y); if (h <= 1.2) continue;
        const prob = (h - 1.2) * 0.8;
        const agua = vecinosAgua(x, y);
        if (!agua) continue;
        if ((this.lecho[i] && this.azar() < prob) || (agua >= 4 && this.azar() < prob * 0.05)) llenar.push(i);
      }
      for (const i of llenar) {
        const x = i % W, y = (i / W) | 0;
        if (this.cercanos(x, y, 0).length) continue;
        T[i] = TERRENO.AGUA; this.baya[i] = 0; this.fruta[i] = 0; this.lecho[i] = 0;
      }
      if (llenar.length) { this.terrenoCambiado = true; this.cercaniaSucia = true; }
    }
  }

  /** INCENDIO (en sequía): prende en un bosque y se extiende por él; quema a quien pilla y la fruta; el bosque volverá. */
  incendio(x0, y0) {
    const W = this.ancho, T = this.terreno;
    let inicio = -1;
    if (x0 != null) for (let dy = -1; dy <= 1 && inicio < 0; dy++) for (let dx = -1; dx <= 1 && inicio < 0; dx++) if (this.t(x0 + dx, y0 + dy) === TERRENO.BOSQUE) inicio = (y0 + dy) * W + x0 + dx;
    for (let k = 0; k < 200 && inicio < 0; k++) { const i = this.azar.entero(T.length); if (T[i] === TERRENO.BOSQUE) inicio = i; }
    if (inicio < 0) return;
    const ardido = [], cola = [inicio], visto = new Set([inicio]);
    while (cola.length && ardido.length < 160) {
      const i = cola.shift(); ardido.push(i);
      const x = i % W, y = (i / W) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const j = (y + dy) * W + (x + dx);
        if (x + dx < 0 || y + dy < 0 || x + dx >= W || y + dy >= this.alto || visto.has(j)) continue;
        visto.add(j);
        if (T[j] === TERRENO.BOSQUE && this.azar() < 0.62) cola.push(j);
      }
    }
    if (ardido.length < 12) return;
    // (el incendio deja brasas en sus bordes un tiempo)
    for (let k = 0; k < 4; k++) { const j = ardido[this.azar.entero(ardido.length)]; this.encender(j % W, (j / W) | 0, null, true, 200); }
    let heridos = 0, muertos = 0;
    const tocados = new Set();
    for (const i of ardido) {
      T[i] = TERRENO.HIERBA; this.quemado.set(i, this.anio + 12 + this.azar.entero(10));
      const x = i % W, y = (i / W) | 0;
      if (this.baya[i]) this.fruta[i] = 0;
      for (const q of this.cercanos(x, y, 1)) if (!tocados.has(q)) { tocados.add(q); this.herir(q, 35, 'fuego'); heridos++; if (!q.vivo) muertos++; }
      if (this.verEfectos && this.azar() < 0.15) this.efecto('fuego', x, y);
    }
    const [cx, cy] = [inicio % W, (inicio / W) | 0];
    for (const q of this.cercanos(cx, cy, 14)) { q.asoc.suceso('incendio', this.tick); this.temer(q); }
    this.destruirRefugios(cx, cy, 8, 0.5);
    this.nombrarSuceso('e:incendio', cx, cy, 14);
    this.terrenoCambiado = true; this.cercaniaSucia = true;
    this.incendios = (this.incendios || 0) + 1;
    this.ultimoDesastre = { tipo: 'fuego', x: cx, y: cy, anio: this.anio };
    this.anotar(`Con la sequía arde el bosque ${this.describirSitio(cx, cy)}: ${ardido.length} casillas quemadas${heridos ? `, ${heridos} personas alcanzadas${muertos ? ` (${muertos} mueren)` : ''}` : ', sin nadie dentro'}. Volverá a crecer.`, 'clima');
  }

  /** RIADA (en años de lluvias): un río se desborda junto a donde vive gente; arrastra despensas y empalizadas. */
  riada() {
    const junto = this.personas.filter((p) => p.vivo && this.dist_[TERRENO.AGUA][p.y * this.ancho + p.x] <= 2);
    if (!junto.length) return;
    const c = this.azar.elegir(junto);
    let heridos = 0, muertos = 0, casas = 0;
    for (const q of this.cercanos(c.x, c.y, 5)) {
      if (this.dist_[TERRENO.AGUA][q.y * this.ancho + q.x] > 2) continue;
      this.herir(q, 25, 'riada'); heridos++; if (!q.vivo) muertos++;
    }
    for (const k of new Set([...this.fuertes.keys(), ...this.despensas.keys()])) {
      const [hx, hy] = k.split(',').map(Number);
      if (Math.max(Math.abs(hx - c.x), Math.abs(hy - c.y)) > 5 || this.dist_[TERRENO.AGUA][hy * this.ancho + hx] > 3) continue;
      casas++;
      this.despensas.delete(k);
      const f = this.fuertes.get(k); if (f) { if (f > 1) this.fuertes.set(k, f - 1); else this.fuertes.delete(k); }
    }
    for (const q of this.cercanos(c.x, c.y, 12)) { q.asoc.suceso('riada', this.tick); this.temer(q); }
    this.destruirRefugios(c.x, c.y, 5, 0.6);
    this.efecto('riada', c.x, c.y);
    this.nombrarSuceso('e:riada', c.x, c.y, 12);
    this.riadas = (this.riadas || 0) + 1;
    this.ultimoDesastre = { tipo: 'riada', x: c.x, y: c.y, anio: this.anio };
    this.anotar(`Con tanta lluvia el agua se desborda ${this.describirSitio(c.x, c.y)}: ${heridos} personas arrastradas${muertos ? ` (${muertos} mueren)` : ''}${casas ? `, ${casas} hogares pierden su despensa o su empalizada` : ''}.`, 'clima');
  }

  /** DOMESTICAR: echarle comida a un lobo lo calma; si come dos veces, se queda: es un perro. */
  alimentarLobo(p, l) {
    p.carga--;
    l.espera = 80;                       // (un lobo que ha comido no ataca)
    l.manso = (l.manso || 0) + 1;
    this.efecto('regalo', l.x, l.y);
    if (l.manso < 2 || p.perro) return;
    const d = { x: l.x, y: l.y, dueno: p.id, nacio: this.anio, vivo: true };
    this.perros.push(d); p.perro = d; this.domesticados = (this.domesticados || 0) + 1;
    l.vivo = false; l.manso = 0;         // (otro lobo salvaje ocupará su sitio con el tiempo)
    this.nombrarSuceso('e:perro', l.x, l.y, 6);
    this.inventoPrimero(p, 'perro', 'da de comer a un lobo hasta que se queda a su lado: el primer perro');
    this.acierto(p);                     // (la satisfacción inmediata, como fabricar)
  }

  /** Los perros van con su dueño; viven unos 12 años; cada año alguno tiene un cachorro para alguien de su pueblo. */
  moverPerros() {
    for (const d of this.perros) {
      if (!d.vivo) continue;
      const q = this.porId.get(d.dueno);
      if (!q || !q.vivo) { d.vivo = false; continue; }
      if (Math.max(Math.abs(d.x - q.x), Math.abs(d.y - q.y)) > 1 || this.azar() < 0.2) { d.x = q.x + this.azar.entero(3) - 1; d.y = q.y + this.azar.entero(3) - 1; }
    }
    if (this.tick % TICKS_POR_ANIO) return;
    const nuevos = [];
    for (const d of this.perros) {
      if (!d.vivo) continue;
      if (this.anio - d.nacio >= 12) { d.vivo = false; const q = this.porId.get(d.dueno); if (q) q.perro = null; continue; }
      const q = this.porId.get(d.dueno);
      if (this.perros.length + nuevos.length >= 120 || this.azar() > 0.15) continue;
      const otro = this.cercanos(q.x, q.y, 6).find((r) => r.tribu === q.tribu && !r.perro && r.edad >= EDAD_ADULTA * TICKS_POR_ANIO);
      if (!otro) continue;
      const c = { x: otro.x, y: otro.y, dueno: otro.id, nacio: this.anio, vivo: true };
      nuevos.push(c); otro.perro = c;
      this.primeraVez(`cachorro-${q.tribu}`, `El perro de ${q.nombre} tiene un cachorro, y se lo queda ${otro.nombre}: los ${this.tribus[q.tribu].nombre} empiezan a criar perros.`, 'invento');
    }
    this.perros = this.perros.filter((d) => d.vivo).concat(nuevos);
  }

  /** Si hay un perro cerca de la presa, ladra: el lobo se espanta casi siempre y los de alrededor quedan avisados. */
  ladra(presa, l) {
    const d = this.perros.find((x) => x.vivo && Math.max(Math.abs(x.x - presa.x), Math.abs(x.y - presa.y)) <= 2);
    if (!d || this.azar() > 0.75) return false;
    l.espera = 60; l.x += Math.sign(l.x - presa.x) * 2; l.y += Math.sign(l.y - presa.y) * 2;
    if (!this.pisable(l.x, l.y)) { l.x -= Math.sign(l.x - presa.x) * 2; l.y -= Math.sign(l.y - presa.y) * 2; }
    this.efecto('grito', d.x, d.y); if (this.efectos.length && this.verEfectos) this.efectos[this.efectos.length - 1].palabra = 'guau';
    for (const h of this.cercanos(d.x, d.y, 5)) if (!h.dormido) h.aviso = { que: 'lobo', x: l.x, y: l.y, hasta: this.tick + 30, de: null, palabra: 'guau' };
    presa.asoc.suceso('ladra el perro', this.tick);
    this.ladridos = (this.ladridos || 0) + 1;
    this.primeraVez(`ladra-${presa.tribu}`, `Un perro ladra y espanta a un lobo que iba a por ${presa.nombre} (${this.tribus[presa.tribu].nombre}).`, 'vida');
    return true;
  }

  /**
   * LAS ALDEAS SE DIVIDEN: si una aldea es grande y pasa hambre, un tercio de sus familias se va lejos a fundar otra.
   * (Una aldea = los hogares de un pueblo en un cuadro de 12×12.)
   */
  dividirAldeas() {
    const aldeas = new Map();
    for (const p of this.personas) {
      if (!p.vivo || p.edad < 3 * TICKS_POR_ANIO) continue;
      const k = `${p.tribu}|${(p.hogar[0] / 12) | 0},${(p.hogar[1] / 12) | 0}`;
      let a = aldeas.get(k); if (!a) aldeas.set(k, a = { tribu: p.tribu, gente: [], hambre: 0 });
      a.gente.push(p); if (p.hambre > 55) a.hambre++;
    }
    for (const a of aldeas.values()) {
      const t = this.tribus[a.tribu];
      // (en una jefatura el jefe no deja irse a nadie salvo con mucha hambre; en una democracia se vota)
      const umbral = t.gobierno === 'jefatura' ? 0.4 : t.gobierno === 'democracia' ? 0.3 : 0.2;
      if (a.gente.length < 50 || a.hambre < a.gente.length * umbral || this.anio - (t.ultimaDivision ?? -99) < 8) continue;
      const c = a.gente[0].hogar;
      let mejor = null;
      for (let k = 0; k < 30; k++) {
        const ang = this.azar() * Math.PI * 2, d = 25 + this.azar() * 25;
        const x = Math.round(c[0] + Math.cos(ang) * d), y = Math.round(c[1] + Math.sin(ang) * d);
        if (!this.pisable(x, y) || !this.cerca(x, y, 5, (xx, yy) => this.t(xx, yy) === TERRENO.AGUA)) continue;
        if (this.cercanos(x, y, 10).length) continue;   // (tierra de nadie)
        const nota = this.comidaCerca(x, y, 8) + this.azar() * 2;
        if (!mejor || nota > mejor.nota) mejor = { x, y, nota };
      }
      if (!mejor || mejor.nota < 6) continue;
      // se van familias enteras (un adulto, su pareja y sus hijos) hasta un tercio de la aldea
      const van = new Set();
      const adultos = a.gente.filter((p) => p.edad >= EDAD_ADULTA * TICKS_POR_ANIO);
      for (let k = 0; k < adultos.length && van.size < a.gente.length / 3; k++) {
        const p = adultos[this.azar.entero(adultos.length)];
        if (van.has(p) || (this.lideres && this.lideres.get(p.tribu) === p.id)) continue;   // (el líder se queda)
        for (const q of [p, this.porId.get(p.pareja), ...p.hijos.map((h) => this.porId.get(h))]) if (q && q.vivo && q.tribu === p.tribu) van.add(q);
      }
      if (van.size < 8) continue;
      for (const q of van) { q.hogar = [mejor.x, mejor.y]; q.asoc.suceso('migrar', this.tick); }
      t.ultimaDivision = this.anio;
      this.colonias.push({ tribu: a.tribu, campo: [mejor.x, mejor.y], desde: this.anio });
      this.divisiones = (this.divisiones || 0) + 1;
      this.anotar(`La aldea de los ${t.nombre} ${this.describirSitio(c[0], c[1])} es ya de ${a.gente.length} y pasan hambre: ${van.size} se van lejos a fundar otra ${this.describirSitio(mejor.x, mejor.y)}.`, 'migracion');
    }
  }

  /**
   * NACE UN PUEBLO: una colonia que lleva 40 años viva y con gente se ha vuelto otra cosa (sus palabras y sus ideas
   * ya se transmiten entre ellos): pasa a ser un pueblo con nombre propio, hijo del de origen.
   */
  nacenPueblos() {
    for (const col of this.colonias) {
      if (col.hecha || this.anio - col.desde < 40) continue;
      const madre = this.tribus[col.tribu];
      const suyos = this.personas.filter((p) => p.vivo && p.tribu === col.tribu && Math.hypot(p.hogar[0] - col.campo[0], p.hogar[1] - col.campo[1]) <= 12);
      if (suyos.length < 15) { if (this.anio - col.desde > 80) col.hecha = true; continue; }   // (se deshizo)
      const resto = this.personas.filter((p) => p.vivo && p.tribu === col.tribu && !suyos.includes(p));
      if (resto.length < 10) { col.hecha = true; continue; }   // (si no queda nadie en el origen, es el mismo pueblo que se mudó)
      if (this.tribus.length >= MAX_PUEBLOS) return;
      col.hecha = true;
      const id = this.tribus.length;
      // el nombre: dos sílabas de su pueblo de origen, una de ellas cambiada (como cambia una lengua al separarse)
      const vocales = 'aeiou';
      const silabas = madre.silabas.map((s) => (this.azar() < 0.35 ? s.replace(/[aeiou]/, () => vocales[this.azar.entero(5)]) : s));
      let nombre;
      for (let k = 0; k < 20; k++) {
        const n = silabas[this.azar.entero(silabas.length)] + silabas[this.azar.entero(silabas.length)];
        nombre = n[0].toUpperCase() + n.slice(1);
        if (nombre.length >= 4 && !this.tribus.some((t) => t.nombre === nombre)) break;
      }
      const tribu = { id, nombre, color: madre.color, silabas, campo: [...col.campo], vivos: 0, nacidos: 0, madre: madre.id, desde: this.anio,
                      gobierno: madre.gobierno, reparto: madre.reparto };
      this.tribus.push(tribu);
      for (const p of suyos) {
        p.afinidad[id] = p.afinidad[madre.id];          // (se tienen el aprecio que se tenían)
        p.tribu = id; madre.vivos--; tribu.vivos++;
      }
      // los demás los ven como a su pueblo de origen, un poco menos
      for (const p of this.personas) if (p.vivo && p.tribu !== id) p.afinidad[id] = p.tribu === madre.id ? p.afinidad[madre.id] * 0.6 : p.afinidad[madre.id];
      this.contactos.add(`${Math.min(id, madre.id)}-${Math.max(id, madre.id)}`);
      for (let o = 0; o < id; o++) if (this.contactos.has(`${Math.min(o, madre.id)}-${Math.max(o, madre.id)}`)) this.contactos.add(`${Math.min(o, id)}-${Math.max(o, id)}`);
      this.anotar(`Nace un pueblo nuevo: los ${nombre}. Son ${suyos.length}, descendientes de los ${madre.nombre} que se fueron hace ${this.anio - col.desde} años; ya no se sienten de allí.`, 'tribu');
    }
  }

  /** EL JUGADOR CAMBIA EL GOBIERNO (o el reparto) de un pueblo: se apunta en la crónica, como un poder más. */
  cambiarGobierno(id, gobierno, reparto) {
    const t = this.tribus[id];
    if (gobierno && gobierno !== t.gobierno) {
      t.gobierno = gobierno;
      if (gobierno === 'jefatura') { const q = this.porId.get(this.lideres && this.lideres.get(id)); if (q) t.jefe = q; }
      this.anotar(`Por voluntad del dios, los ${t.nombre} pasan a ser ${NOMBRE_GOBIERNO[gobierno]}.`, 'dios');
    }
    if (reparto && reparto !== t.reparto) {
      // (al pasar a granero común, lo de las despensas de sus hogares va al granero; al revés, se queda en el granero)
      if (reparto === 'comun') {
        let n = 0;
        for (const p of this.personas) if (p.vivo && p.tribu === id) { const k = `${p.hogar[0]},${p.hogar[1]}`; n += this.despensas.get(k) || 0; this.despensas.delete(k); }
        this.graneros.set(id, (this.graneros.get(id) || 0) + n);
      }
      t.reparto = reparto;
      this.anotar(`Por voluntad del dios, los ${t.nombre} ${reparto === 'comun' ? 'lo guardan todo en un granero común' : 'vuelven a tener cada familia su despensa'}.`, 'dios');
    }
  }

  /** ADOPTAR a un pequeño que se ha quedado sin madre (o sin quien le cuidaba). Devuelve quién lo cría, o nadie. */
  adoptar(p) {
    const ok = (q) => q && q.vivo && q.edad >= EDAD_ADULTA * TICKS_POR_ANIO && q.tribu === p.tribu;
    const madre = this.registro.get(p.madre) && this.porId.get(p.madre), padre = this.porId.get(p.padre);
    const abuelos = [madre && madre.madre, madre && madre.padre, padre && padre.madre, padre && padre.padre].map((id) => this.porId.get(id));
    const hermanos = this.personas.filter((q) => q.vivo && q !== p && q.madre != null && q.madre === p.madre && q.edad >= 16 * TICKS_POR_ANIO);
    let quien = [padre, ...abuelos, ...hermanos].find(ok), tipo = 'familia';
    if (!quien) {
      const cerca = this.cercanos(p.x, p.y, 10).filter((q) => ok(q) && q.genio < 0.4);
      quien = cerca.sort((a, b) => a.genio - b.genio)[0]; tipo = 'pueblo';
    }
    if (!quien) { if (!p.sinNadie) { p.sinNadie = true; this.huerfanosSinNadie = (this.huerfanosSinNadie || 0) + 1; } return null; }
    p.cuidador = quien.id;
    this.adopciones = this.adopciones || { familia: 0, pueblo: 0 }; this.adopciones[tipo]++;
    this.conocer(quien, p, 4); this.conocer(p, quien, 5);
    this.primeraVez(`adopta-${p.tribu}-${tipo}`, tipo === 'familia'
      ? `${quien.nombre} (${this.tribus[p.tribu].nombre}) se hace cargo de ${p.nombre}, que se ha quedado sin madre.`
      : `${quien.nombre} (${this.tribus[p.tribu].nombre}) adopta a ${p.nombre}, un huérfano sin familia: es la primera vez que alguien de su pueblo cría a un niño que no es suyo.`, 'familia');
    return quien;
  }

  /** El muerto (sin enterrar ni quemar) más cercano a r casillas, o null. */
  cadaverCerca(x, y, r) {
    let mejor = null, dm = r + 1;
    for (const c of this.cadaveres.values()) { const d = Math.max(Math.abs(c.x - x), Math.abs(c.y - y)); if (d < dm) { dm = d; mejor = c; } }
    return mejor;
  }

  /**
   * OCUPARSE DEL MUERTO: con lo que se tenga a mano. Enterrar (no en la roca; cansa; deja una tumba), quemar (si hay
   * fuego cerca, o sabe hacerlo y lleva leña) o apartarlo lejos de la aldea. Nadie elige por ellos: cada uno hace lo que
   * ha visto hacer a los suyos (o lo que pueda, si nunca lo ha visto), y lo que hace lo ven los de alrededor.
   */
  atenderMuerto(p, c) {
    const W = this.ancho, aqui = c.y * W + c.x;
    const posible = {
      enterrar: this.t(c.x, c.y) !== TERRENO.ROCA && this.t(c.x, c.y) !== TERRENO.AGUA,
      quemar: !!this.calor[aqui] || (p.sabeFuego && p.madera >= 2),
      apartar: true,
    };
    let forma = Object.entries(p.vistoFunebre).filter(([f]) => posible[f]).sort((a, b) => b[1] - a[1])[0]?.[0];
    if (!forma) { const opciones = Object.keys(posible).filter((f) => posible[f]); forma = opciones[this.azar.entero(opciones.length)]; }
    this.cadaveres.delete(c.id);
    if (forma === 'enterrar') { p.cansancio = Math.min(100, p.cansancio + 15); this.tumbas.set(`${c.x},${c.y}`, { x: c.x, y: c.y, tribu: c.tribu, nombre: c.nombre, anio: this.anio }); }
    else if (forma === 'quemar') { if (!this.calor[aqui]) p.madera -= 2; this.encender(c.x, c.y, null, true, 40); }
    else {
      // (lo lleva lejos de la aldea: el cuerpo sigue, pero fuera de casa)
      const ang = this.azar() * Math.PI * 2, x = Math.round(c.x + Math.cos(ang) * 10), y = Math.round(c.y + Math.sin(ang) * 10);
      if (this.pisable(x, y)) this.cadaveres.set(c.id, { ...c, x, y, apartado: true });
      p.cansancio = Math.min(100, p.cansancio + 8);
    }
    this.funerales[forma]++;
    this.nombrarSuceso(`e:${forma}`, c.x, c.y, 5);
    const t = this.tribus[p.tribu];
    t.funerales = t.funerales || { enterrar: 0, quemar: 0, apartar: 0 }; t.funerales[forma]++;
    // los que lo ven, lo aprenden (y quien lo hace, lo refuerza)
    p.vistoFunebre[forma] = (p.vistoFunebre[forma] || 0) + 2;
    for (const q of this.cercanos(p.x, p.y, 5)) if (q !== p && q.tribu === p.tribu && !q.dormido) q.vistoFunebre[forma] = (q.vistoFunebre[forma] || 0) + 1;
    // (consuela: ocuparse de alguien querido acorta el duelo)
    const e = p.conocidos.get(c.id);
    if (e && e.afecto >= 3 && p.duelo > this.tick) { p.duelo = this.tick + Math.round((p.duelo - this.tick) / 2); this.acierto(p); }
    const palabra = { enterrar: 'entierra', quemar: 'quema', apartar: 'aparta lejos de la aldea' }[forma];
    this.primeraVez(`funeral-${forma}`, `${p.nombre} (${t.nombre}) ${palabra} el cuerpo de ${c.nombre}: la primera vez que alguien hace esto con un muerto.`, 'idea');
    this.efecto(forma === 'quemar' ? 'objeto' : 'compartir', c.x, c.y);
  }

  /** Un cerebro nuevo, del tipo que toque en este mundo. */
  nuevaMente() {
    if (this.mente === 'q') return new MenteQ(ACCIONES);
    if (this.mente === 'instinto') return new MenteInstinto(ACCIONES);
    if (this.mente === 'azar') return new MenteAzar(ACCIONES, this.azar);
    if (this.mente === 'reglas') return new MenteReglas(ACCIONES);
    return new Nucleo(percepcion, { acciones: ACCIONES, generalizar: true, prudencia: this.prudencia ? PRUDENCIA : null, porConcepto: this.porConcepto });
  }

  /** Lo que ocupa una mente, en números guardados (Neutro: lo que guarda cada neurona; Q: la tabla entera). */
  memoriaDe(p) {
    if (p.nucleo.memoria) return p.nucleo.memoria();
    let n = 0;
    for (const x of p.nucleo.neuronas.values()) n += 2 + Object.keys(x.fallos || {}).length + Object.keys(x.aciertos || {}).length;
    return n;
  }

  /** El cajón de la demografía de estos 50 años. */
  periodo() {
    const k = Math.floor(this.anio / 50);
    return this.demografia[k] || (this.demografia[k] = { desde: k * 50, nacimientos: 0, infantiles: 0, mujeres: 0, hijos: 0 });
  }

  /**
   * LAS GANAS DE TENER OTRO HIJO. Instinto: con hambre o con carencias, menos. Y lo aprendido (memoria de sucesos, que se
   * hereda de la madre si hay cultura): si tener un hijo le ha traído hambre o perder a alguien, menos; si le ha traído
   * criarlo, más. Nadie le dice cuántos tener: lo decide lo que ha vivido.
   */
  ganasDeHijo(p) {
    if (this.natalidad !== 'decidida') return 1;
    let g = 1;
    if (p.hambre > 50 || p.proteina < 25 || p.vitaminas < 25) g *= 0.5;
    const a = p.asoc;
    const malo = Math.max(a.fuerza('tener un hijo', 'pasar hambre'), a.fuerza('tener un hijo', 'perder a alguien'));
    const bueno = a.fuerza('tener un hijo', 'criar un hijo');
    g *= Math.max(0.15, Math.min(1.5, 1 - 0.8 * Math.max(0, malo) + 0.5 * Math.max(0, bueno)));
    return g;
  }

  /** ¿Odia el jefe de este pueblo al otro? (su opinión, la de una sola persona, decide) */
  jefeOdia(x, y, umbral = -3) {
    const jefe = this.lideres && this.porId.get(this.lideres.get(x));
    return !!jefe && jefe.vivo && jefe.afinidad[y] <= umbral;
  }

  /** Cuánto teme a lo sagrado: la suma de sus miedos (en una teocracia manda el más piadoso entre los respetados). */
  piedad(p) { let s = 0; for (const f of p.tabues.values()) s += f; return s * 0.5; }

  /**
   * QUIÉN GOBIERNA. Jefatura: el jefe manda hasta morir y le hereda su hijo mayor (si no tiene, el más respetado).
   * Democracia: cada 10 años se vota; cada adulto vota, de entre los cuatro más respetados, al que más aprecia.
   */
  elegirGobernante(t, suyos) {
    const idActual = this.lideres.get(t.id), actual = this.porId.get(idActual) || (t.jefe && t.jefe.id === idActual ? t.jefe : null);
    const vivoAqui = actual && actual.vivo && actual.tribu === t.id;
    if (t.gobierno === 'jefatura') {
      if (vivoAqui) return;
      const hijo = actual && actual.hijos.map((h) => this.porId.get(h)).filter((q) => q && q.vivo && q.tribu === t.id && q.edad >= EDAD_ADULTA * TICKS_POR_ANIO).sort((a, b) => b.edad - a.edad)[0];
      const nuevo = hijo || suyos.reduce((a, b) => (this.prestigio(b) > this.prestigio(a) ? b : a));
      this.lideres.set(t.id, nuevo.id); t.jefe = nuevo;   // (se guarda la persona: muerta, sus hijos siguen a mano)
      this.anotar(hijo ? `${nuevo.nombre} hereda el mando de los ${t.nombre} a la muerte de su ${actual.sexo === 'f' ? 'madre' : 'padre'}, ${actual.nombre}.` : `${nuevo.nombre} se hace con el mando de los ${t.nombre}.`, 'vida');
      return;
    }
    if (vivoAqui && this.anio % 10 !== 0) return;
    const candidatos = [...suyos].sort((a, b) => this.prestigio(b) - this.prestigio(a)).slice(0, 4);
    const votos = new Map();
    for (const v of suyos) {
      let elegido = candidatos[0], mejor = -Infinity;
      for (const c of candidatos) { const e = v.conocidos.get(c.id); const n = (e ? e.afecto : 0) + this.prestigio(c) * 0.1; if (n > mejor) { mejor = n; elegido = c; } }
      votos.set(elegido.id, (votos.get(elegido.id) || 0) + 1);
    }
    const [ganador, n] = [...votos].sort((a, b) => b[1] - a[1])[0];
    const q = this.porId.get(ganador);
    if (ganador !== idActual) this.anotar(`Los ${t.nombre} votan: gana ${q.nombre}, con ${n} de ${suyos.length} votos.`, 'vida');
    this.lideres.set(t.id, ganador);
    this.elecciones = (this.elecciones || 0) + 1;
  }

  /**
   * GOBERNAR, cada año. El DESCONTENTO sube con hambre mientras la despensa del jefe rebosa, con los castigos duros y
   * con los hijos muertos en guerra; baja solo. Con mucho, la familia HUYE a otro pueblo (vota con los pies). Si en una
   * jefatura un tercio de los adultos está muy descontento, hay REVUELTA: el jefe cae y el pueblo pasa a votar. En una
   * teocracia, quien hace lo que el pueblo teme es castigado y obligado a temerlo.
   */
  gobernar(vivos) {
    for (const t of this.tribus) {
      const suyos = vivos.filter((p) => p.tribu === t.id && p.edad >= EDAD_ADULTA * TICKS_POR_ANIO);
      if (!suyos.length) continue;
      const jefe = this.lideres && this.porId.get(this.lideres.get(t.id));
      // EL TRIBUTO ANUAL (jefatura): un tercio de cada despensa y una de cada carga van al jefe; él reparte entre sus
      // fieles (a quien aprecia) si tienen hambre. De ahí sale la desigualdad
      if (t.gobierno === 'jefatura' && jefe && jefe.vivo) {
        const kj = `${jefe.hogar[0]},${jefe.hogar[1]}`;
        let tomado = 0;
        const hogares = new Set(suyos.filter((p) => p !== jefe).map((p) => `${p.hogar[0]},${p.hogar[1]}`));
        hogares.delete(kj);
        for (const k of hogares) { const d = this.despensas.get(k) || 0, x = Math.floor(d / 3); if (x) { this.despensas.set(k, d - x); tomado += x; } }
        for (const p of suyos) if (p !== jefe && p.carga >= 2) { p.carga--; tomado++; }
        this.despensas.set(kj, Math.min(80, (this.despensas.get(kj) || 0) + tomado));
        t.tributo = (t.tributo || 0) + tomado;
        let dado = 0;
        for (const [id, e] of jefe.conocidos) {
          if (dado >= 5 || e.afecto < 3) continue;
          const q = this.porId.get(id);
          if (!q || !q.vivo || q.tribu !== t.id || q.hambre < 40 || !(this.despensas.get(kj) > 0)) continue;
          this.despensas.set(kj, this.despensas.get(kj) - 1); q.hambre = Math.max(0, q.hambre - 35); this.conocer(q, jefe, 1); dado++;
        }
      }
      const despensaJefe = jefe && jefe.vivo ? this.despensas.get(`${jefe.hogar[0]},${jefe.hogar[1]}`) || 0 : 0;
      for (const p of suyos) {
        p.descontento = (p.descontento || 0) * 0.7;
        if (p.hambre > 55 && t.gobierno === 'jefatura' && despensaJefe > 10 && p !== jefe) p.descontento += 1.5;
        if (p.hambre > 70) p.descontento += 0.5;
      }
      // LA LEY SAGRADA (teocracia): quien hace a menudo lo que el pueblo teme, castigado y convertido
      if (t.gobierno === 'teocracia' && this.creencias) {
        for (const c of this.creencias.values()) {
          if (c.tribu !== t.id) continue;
          for (const p of suyos) {
            if ((p.tabues.get(c.accion) || 0) >= 1.5 || !p.usosTotal || (p.usos[c.accion] || 0) / p.usosTotal < 0.05) continue;
            this.herir(p, 10, 'castigo'); p.tabues.set(c.accion, 2); p.descontento += 1;
            this.castigosSagrados = (this.castigosSagrados || 0) + 1;
            this.primeraVez(`sagrado-${t.id}`, `Los ${t.nombre} castigan a ${p.nombre} por ${TEXTO_ACCION[c.accion] || c.accion}, que su pueblo tiene por sacrílego.`, 'idea');
          }
        }
      }
      // HUIR: los muy descontentos se van con su familia al pueblo que mejor les cae (y que no sea una jefatura)
      if (this.inducidas) for (const p of suyos) {
        if (p.descontento < 3 || p === jefe) continue;
        let destino = null, af = 2;
        for (const o of this.tribus) if (o.id !== t.id && o.vivos > 5 && o.gobierno !== 'jefatura' && p.afinidad[o.id] > af) { af = p.afinidad[o.id]; destino = o; }
        if (!destino) continue;
        const alguien = vivos.find((q) => q.tribu === destino.id);
        if (!alguien) continue;
        const familia = [p, this.porId.get(p.pareja), ...p.hijos.map((h) => this.porId.get(h))].filter((q) => q && q.vivo && q.tribu === t.id && (q === p || q.id === p.pareja || q.edad < EDAD_ADULTA * TICKS_POR_ANIO));
        for (const q of familia) { q.tribu = destino.id; q.hogar = [...alguien.hogar]; q.afinidad[destino.id] = Math.max(q.afinidad[destino.id], 5); q.descontento = 0; t.vivos--; destino.vivos++; }
        t.huidas = (t.huidas || 0) + familia.length; this.huidas = (this.huidas || 0) + familia.length;
        this.primeraVez(`huida-${t.id}`, `${p.nombre} huye de los ${t.nombre} con su familia (${familia.length}) y se va a vivir con los ${destino.nombre}.`, 'migracion');
      }
      // LA REVUELTA
      const furiosos = suyos.filter((p) => p.vivo && p.tribu === t.id && p.descontento >= 2).length;
      if (this.inducidas && t.gobierno === 'jefatura' && jefe && jefe.vivo && suyos.length >= 10 && furiosos >= suyos.length / 3) {
        this.herir(jefe, 60, 'pelea', false);
        t.gobierno = 'democracia'; t.revueltas = (t.revueltas || 0) + 1; this.revueltas = (this.revueltas || 0) + 1;
        this.anotar(`Revuelta entre los ${t.nombre}: ${furiosos} de ${suyos.length} adultos se alzan contra ${jefe.nombre}${jefe.vivo ? ', que pierde el mando' : ', que muere'}. A partir de ahora votarán.`, 'guerra');
        for (const p of suyos) p.descontento = 0;
      }
    }
  }

  /**
   * LAS MEDIDAS (con la tierra limitada, contar personas ya no distingue): esperanza de vida, muertes evitables,
   * desigualdad, salud, conflictos, inventos, ideas distintas, resistencia a las sequías, y lo mismo pueblo a pueblo.
   */
  medidas() {
    const vivos = this.personas.filter((p) => p.vivo), adultos = vivos.filter((p) => p.edad >= EDAD_ADULTA * TICKS_POR_ANIO);
    const riqueza = (p) => p.carga + (p.cosas.length + p.objetos.size) * 2 + p.excedentes.length + (this.despensas.get(`${p.hogar[0]},${p.hogar[1]}`) || 0) / 3;
    const gini = (xs) => { if (xs.length < 2) return 0; const s = [...xs].sort((a, b) => a - b), n = s.length, tot = s.reduce((a, b) => a + b, 0); if (!tot) return 0; let acc = 0; s.forEach((x, i) => { acc += (2 * (i + 1) - n - 1) * x; }); return +(acc / (n * tot)).toFixed(3); };
    const media = (xs) => (xs.length ? +(xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(1) : 0);
    const m = this.muertos, total = Object.values(m).reduce((a, b) => a + b, 0);
    const evitables = m.hambre + m.sed + m.veneno + m.lobo + m.pelea + m.castigo + m.frío;
    const ideas = new Set();
    for (const p of vivos) for (const n of p.nucleo.neuronas.values()) if (n.accion !== 'instinto') ideas.add(`${n.concepto}→${n.accion}`);
    return {
      vivos: vivos.length,
      esperanzaVida: this.nMuertes ? +(this.sumaEdadMuerte / this.nMuertes).toFixed(1) : null,
      evitables: total ? +(evitables / total).toFixed(3) : 0,
      desigualdad: gini(adultos.map(riqueza)),
      salud: media(vivos.map((p) => p.salud)), hambre: media(vivos.map((p) => p.hambre)),
      conflictos: { robos: this.robos || 0, venganzas: this.venganzas || 0, peleas: m.pelea, guerras: this.guerras.size, revueltas: this.revueltas || 0, huidas: this.huidas || 0 },
      inventos: [...this.primeras].filter((k) => k.startsWith('mundo-')).length,
      carencias: { proteina: vivos.length ? +(vivos.filter((p) => p.proteina < 25).length / vivos.length).toFixed(3) : 0, vitaminas: vivos.length ? +(vivos.filter((p) => p.vitaminas < 25).length / vivos.length).toFixed(3) : 0 },
      oficios: (() => { const o = {}; let esp = 0, n = 0; for (const p of adultos) { const r = this.oficioPrincipal(p); if (r) { o[r.oficio] = (o[r.oficio] || 0) + 1; esp += r.especializacion; n++; } } return { ...o, especializacion: n ? +(esp / n).toFixed(2) : 0, conOficio: adultos.length ? +(n / adultos.length).toFixed(2) : 0 }; })(),
      curas: this.curas || 0, protegidos: this.protegidos || 0,
      muertos: { funerales: { ...this.funerales }, tumbas: this.tumbas.size, sinEnterrar: this.cadaveres.size, enfermosPorMuertos: this.enfermosPorMuertos || 0,
                 adopciones: this.adopciones || { familia: 0, pueblo: 0 }, huerfanosSinNadie: this.huerfanosSinNadie || 0,
                 costumbres: Object.fromEntries(this.tribus.filter((t) => t.funerales).map((t) => [t.nombre, t.funerales])) },
      cerebro: { mente: this.mente, memoriaMedia: adultos.length ? Math.round(adultos.reduce((s, p) => s + this.memoriaDe(p), 0) / adultos.length) : 0,
                 situacionesMedia: adultos.length ? Math.round(adultos.reduce((s, p) => s + (p.nucleo.q ? p.nucleo.q.size : p.nucleo.neuronas.size), 0) / adultos.length) : 0,
                 personaTicks: this.personaTicks },
      delCielo: Object.fromEntries([...this.delCielo].map(([k, v]) => [k, { cayo: v.cayo, recogido: v.recogido, usado: v.usado, mejor: +v.mejor.toFixed(2), para: v.para, objeto: v.objeto, quien: v.quien || null }])),
      fuego: { hogueras: [...this.hogueras.values()].filter((h) => !h.natural).length, sabenHacerlo: vivos.filter((p) => p.sabeFuego).length, pueblosConFuego: new Set([...this.hogueras.values()].filter((h) => h.tribu != null).map((h) => h.tribu)).size,
               cocinadas: this.comidasCocinadas || 0, lobosEspantados: this.lobosEspantados || 0, incendiosPorHoguera: this.incendiosPorHoguera || 0, encendidos: this.fuegosEncendidos || 0, ensenado: this.fuegoEnsenado || 0 },
      demografia: this.demografia.filter(Boolean).map((d) => ({ desde: d.desde, hijosPorMujer: d.mujeres ? +(d.hijos / d.mujeres).toFixed(2) : null,
        mortalidadInfantil: d.nacimientos ? +(d.infantiles / d.nacimientos).toFixed(2) : null, nacimientos: d.nacimientos })),
      transporte: { carretas: vivos.filter((p) => p.objetos.has('carreta')).length, balsas: vivos.filter((p) => this.uso(p, 'flota') >= 0.5).length, cruces: this.cruces || 0, ahogados: m.ahogado },
      fríoNorteSur: { abrigosNorte: vivos.filter((p) => p.y < this.alto / 3 && this.abrigo(p) < 1).length, norte: vivos.filter((p) => p.y < this.alto / 3).length,
                      abrigosSur: vivos.filter((p) => p.y > (2 * this.alto) / 3 && this.abrigo(p) < 1).length, sur: vivos.filter((p) => p.y > (2 * this.alto) / 3).length },
      materiales: { combinaciones: this.combinaciones || 0, recetasEnsenadas: this.recetasEnsenadas || 0, distintas: new Set(vivos.flatMap((p) => p.cosas.map((c) => c.clave))).size,
                    usos: Object.fromEntries(['caza', 'pesca', 'carga', 'abrigo', 'proteccion', 'flota'].map((u) => [u, vivos.filter((p) => this.uso(p, u) >= 0.3).length])) },
      ropa: { abrigos: vivos.filter((p) => this.uso(p, 'abrigo') >= 0.3).length, armaduras: vivos.filter((p) => this.uso(p, 'proteccion') >= 0.2).length, golpesParados: this.golpesParados || 0, muertosDeFrio: m.frío },
      fisica: this.fisica ? { ...this.fisica.resumen(), anticipaciones: this.anticipaciones || 0 } : null,
      vida: this.biologia ? { bosque: +(this.fraccionBosque || 0).toFixed(3), bosqueAvanza: this.bosqueAvanza || 0, bosqueRetrocede: this.bosqueRetrocede || 0, ciervos: this.ciervos.filter((d) => d.vivo).length, lobos: this.lobos.filter((l) => l.vivo).length } : null,
      contar: { contadas: this.contadas || 0 },
      pudrir: this.pudrir ? this.estadPudrir : null, mareas: this.mareas ? this.estadMareas : null, langostas: this.langostas ? this.estadLangostas : null, inferidas: this.inferidas, decepciones: this.decepciones, alivio: this.alivio ? this.estadAlivio : null, vicario: this.vicario ? this.estadVicario : null, repasoPriorizado: this.repasoPriorizado ? this.estadRepasoP : null, curiosidad: this.curiosidadNovedad ? this.estadCuriosidad : null, indignacion: this.indignacion !== 'no' ? this.estadIndignacion : null, violencia: this.estadViolencia, prospeccion: this.prospeccion ? this.estadProspeccion : null, metas: this.metas ? this.estadMetas : null, guardadoSerie: this.guardadoSerie.map((g) => (g && g.total ? +(g.otono / g.total).toFixed(3) : null)), prediccion: this.prediccion ? this.estadPrediccion : null, homeostasis: this.homeostasis ? this.estadHomeostasis : null, repaso: this.repaso ? this.estadRepaso : null, dibujos: this.dibujos ? { ...this.estadDibujos, enPie: this.pinturas.size, pueblosQueEscriben: this.tribus.filter((t) => t.escritura).length } : null,
      manadas: this.manadas ? { ...this.estadManadas, temporada: { ...this.estadTemporada } } : null,
      agua: this.aguaSucia ? { ...this.estadAgua, saben: vivos.filter((q) => this.sabe(q, 'beber agua turbia', 'enfermar')).length } : null,
      plantas: this.plantas ? { ...this.estadPlantas, especies: this.especies.length - 1 } : null,
      peleas: this.fisica ? { peleas: this.peleasPorZona, muertes: this.muertesPorZona, gente: this.gentePorZona } : null,
      refugios: this.refugios ? (() => { const r = [...this.refugios.values()], c = (t) => r.filter((x) => x.tipo === t).length;
        return { cobijosEnPie: c('cobijo'), cuevas: c('cueva'), cuevasHabitadas: r.filter((x) => x.tipo === 'cueva' && this.ocupacion(x) > 0).length, chozas: c('choza'), casas: c('casa'), ruinas: c('ruina'), ...this.estadRefugios,
          aldeas: this.asentamientos.filter((a) => a.tipo === 'aldea').length, pueblos: this.asentamientos.filter((a) => a.tipo === 'pueblo').length, ciudades: this.asentamientos.filter((a) => a.tipo === 'ciudad').length, mayor: Math.max(0, ...this.asentamientos.map((a) => a.casas)) }; })() : null,
      geologia: this.geologia ? { ...this.geologia.resumen(), huidasVolcan: this.huidasVolcan || 0, muertosCaida: m.caida } : null,
      exploradores: { nomadas: this.nomadas || 0, inquietudMedia: vivos.length ? +(vivos.reduce((s, p) => s + p.inquietud, 0) / vivos.length).toFixed(2) : 0 },
      lenguaje: { palabrasMedia: vivos.length ? +(vivos.reduce((s, p) => s + p.palabras.size, 0) / vivos.length).toFixed(1) : 0, ensenadasHablando: this.ensenadasHablando || 0,
                  noEntendidas: this.noEntendidas || 0, dichos: this.dichos || 0, cambiosDeSonido: this.cambiosDeSonido || 0,
                  cazasEnGrupo: this.cazasEnGrupo || 0, defensas: this.defensas || 0, gramatica: this.gramatica,
                  composicionalidad: this.gramatica === 'holistica' && this.lenguas ? [...this.lenguas.values()].map((l) => this.composicionalidad(l)).filter((x) => x != null) : null,
                  parecido: this.parecido ? Object.fromEntries(this.parecido) : {} },
      ideasDistintas: ideas.size,
      recuperaciones: this.recuperaciones,
      pueblos: this.tribus.map((t) => {
        const suyos = vivos.filter((p) => p.tribu === t.id), ad = suyos.filter((p) => p.edad >= EDAD_ADULTA * TICKS_POR_ANIO);
        return { nombre: t.nombre, gobierno: t.gobierno, reparto: t.reparto, vivos: suyos.length, esperanzaVida: t.nMuertes ? +(t.sumaEdadMuerte / t.nMuertes).toFixed(1) : null,
                 desigualdad: gini(ad.map(riqueza)), salud: media(suyos.map((p) => p.salud)), huidas: t.huidas || 0, revueltas: t.revueltas || 0, tributo: t.tributo || 0 };
      }),
    };
  }

  /** Practicar un oficio: la pericia sube (y el primero de cada pueblo en ser bueno en algo sale en la crónica). */
  practicar(p, oficio, cuanto) {
    const antes = p.pericia[oficio];
    p.pericia[oficio] = antes + cuanto;
    if (antes < 10 && p.pericia[oficio] >= 10) this.primeraVez(`experto-${p.tribu}-${oficio}`, `${p.nombre} (${this.tribus[p.tribu].nombre}) es ya un experto en ${NOMBRE_OFICIO[oficio]}: el primero de su pueblo.`, 'invento');
  }

  /** El oficio principal de alguien (en lo que más pericia tiene), si tiene alguno de verdad. */
  oficioPrincipal(p) {
    let mejor = null, m = 5, total = 0;
    for (const k in p.pericia) { total += p.pericia[k]; if (p.pericia[k] > m) { m = p.pericia[k]; mejor = k; } }
    return mejor ? { oficio: mejor, especializacion: m / total } : null;
  }

  /** A quién curar: alguien de su pueblo cerca, enfermo o herido. */
  paciente(p) {
    let mejor = null, dm = 4;
    for (const q of this.cercanos(p.x, p.y, 3)) {
      if (q === p || q.tribu !== p.tribu || !(q.enfermo > 0 || q.salud < 60)) continue;
      const d = Math.max(Math.abs(q.x - p.x), Math.abs(q.y - p.y));
      if (d < dm) { dm = d; mejor = q; }
    }
    return mejor;
  }

  /** CURAR: con plantas del bosque (mejor si hay bosque cerca) y con práctica. El curado lo agradece. */
  curar(p, q) {
    const bosque = this.cerca(p.x, p.y, 3, (x, y) => this.t(x, y) === TERRENO.BOSQUE) ? 1.5 : 1;
    const arte = 1 + Math.min(1, p.pericia.curar / 10);
    q.salud = Math.min(100, q.salud + 6 * bosque * arte);
    if (q.enfermo > 0) q.enfermo = Math.max(1, q.enfermo - Math.round(40 * bosque * arte));
    this.conocer(q, p, 2);
    this.practicar(p, 'curar', 1);
    this.curas = (this.curas || 0) + 1;
    this.efecto('compartir', q.x, q.y);
    this.inventoPrimero(p, 'curar', 'cura a alguien con plantas del bosque');
    this.acierto(p);
  }

  /** VENGANZA: ataca a quien le hizo daño (de su propio pueblo). La familia del herido no lo olvida: así empiezan las enemistades. */
  vengar(p, q) {
    this.efecto('pelea', q.x, q.y);
    this.venganzas = (this.venganzas || 0) + 1;
    { const V = this.estadViolencia; V.ataques.venganza = (V.ataques.venganza || 0) + 1; }
    this.herir(q, 12, 'pelea', false);
    if (!q.vivo) { const V = this.estadViolencia; V.muertesVictima.venganza = (V.muertesVictima.venganza || 0) + 1; }
    this.conocer(q, p, -4);
    const e = p.conocidos.get(q.id); if (e) e.afecto = Math.min(10, e.afecto + 4);   // (la venganza calma)
    for (const id of [q.madre, q.padre, q.pareja, ...q.hijos]) { const f = id != null && this.porId.get(id); if (f && f.vivo && f !== p) this.conocer(f, p, -3, false, q.id); }
    this.primeraVez(`venganza-${p.tribu}`, `${p.nombre} se venga de ${q.nombre}, de su mismo pueblo (${this.tribus[p.tribu].nombre}): no le perdonaba lo que le hizo.`, 'vida');
  }

  /** SUPERSTICIÓN: le cae una desgracia y teme lo que estaba haciendo en ese momento (sea lo que sea). */
  temer(q) {
    if (!q.vivo || !q.accion || q.accion === 'instinto' || q.accion === 'esperar' || q.accion === 'dormir') return;
    // (CONTRASTE: lo que hace siempre no destaca -le pasa todo mientras lo hace-; lo raro sí. Si es el 40 % o más de
    // lo que hace, no se asocia)
    const parte = q.usosTotal ? (q.usos[q.accion] || 0) / q.usosTotal : 0;
    const peso = 2.5 * Math.max(0, 1 - 2.5 * parte);
    if (peso > 0) q.tabues.set(q.accion, Math.min(8, (q.tabues.get(q.accion) || 0) + peso));
  }

  /** La despensa ajena (no la de su hogar) con comida más cercana, a RADIO·2 como mucho. Devuelve su clave "x,y". */
  despensaAjena(p) {
    const mia = `${p.hogar[0]},${p.hogar[1]}`;
    let mejor = null, dm = RADIO * 2 + 1;
    for (const [k, n] of this.despensas) {
      if (n <= 0 || k === mia) continue;
      const c = k.indexOf(','), x = +k.slice(0, c), y = +k.slice(c + 1), d = Math.max(Math.abs(x - p.x), Math.abs(y - p.y));
      if (d < dm) { dm = d; mejor = k; }
    }
    return mejor;
  }

  /**
   * ROBAR de una despensa ajena. Si nadie lo ve, es comida gratis (un acierto). Si lo ve alguien de ese hogar o de su
   * pueblo, le recordará como ladrón (neurona de persona), lo contará, y casi siempre le castigan: el dolor le enseña.
   */
  robar(p, k) {
    const n = this.despensas.get(k) || 0;
    if (n <= 0) return;
    const toma = Math.min(2, n);
    this.despensas.set(k, n - toma);
    if (p.hambre > 40) { p.hambre = Math.max(0, p.hambre - 35); if (toma > 1) p.carga = Math.min(this.capacidad(p), p.carga + 1); }
    else p.carga = Math.min(this.capacidad(p), p.carga + toma);
    this.robos = (this.robos || 0) + 1;
    const t = this.tribus[p.tribu];
    t.robos = (t.robos || 0) + 1;
    const [hx, hy] = k.split(',').map(Number);
    // ¿de quién es? de alguien que vive ahí
    const duenos = this.cercanos(hx, hy, 6).filter((q) => q.hogar[0] === hx && q.hogar[1] === hy);
    const pueblo = duenos.length ? duenos[0].tribu : null;
    const testigos = this.cercanos(p.x, p.y, 5).filter((q) => q !== p && !q.dormido && q.edad >= EDAD_ADULTA * TICKS_POR_ANIO
      && ((q.hogar[0] === hx && q.hogar[1] === hy) || q.tribu === pueblo));
    this.efecto('robo', p.x, p.y);
    if (this.indignacion !== 'no') {
      // (la víctima: quien vive en esa casa y está cerca; los testigos de su pueblo, si la indignación es humana)
      const sumar = (q, x) => { if (q === p || !q.vivo) return; q.agravios = q.agravios || new Map(); q.agravios.set(p.id, Math.min(1, (q.agravios.get(p.id) || 0) + x)); this.estadIndignacion.agravios++; };
      for (const q of duenos) sumar(q, 0.8 * this.escalaIndignacion);
      if (this.indignacion === 'humana') for (const q of testigos) if (!duenos.includes(q)) sumar(q, 0.45 * this.escalaIndignacion);
    }
    if (!testigos.length) { this.acierto(p); return; }
    for (const q of testigos) { this.conocer(q, p, -4); if (q.tribu !== p.tribu) q.afinidad[p.tribu] = Math.max(-10, q.afinidad[p.tribu] - 1); }
    // EL CASTIGO: lo decide el testigo; los de buen genio perdonan más
    const juez = testigos[0];
    this.primeraVez(`robo-${p.tribu}`, `${juez.nombre} (${this.tribus[juez.tribu].nombre}) pilla a ${p.nombre} (${t.nombre}) robando de una despensa. Ya le conocen como ladrón.`, 'vida');
    const ley = this.tribus[juez.tribu].gobierno;
    const duro = ley === 'jefatura' || ley === 'teocracia';
    // (sin inducidas no hay castigo automático: castigar al ladrón tendrá que ser una decisión de quien lo vio)
    if (this.inducidas && this.azar() < (duro ? 0.9 : ley === 'democracia' ? 0.6 : 0.55 + juez.genio * 0.35)) {
      this.castigos = (this.castigos || 0) + 1;
      t.castigos = (t.castigos || 0) + 1;
      this.efecto('pelea', p.x, p.y);
      this.herir(p, duro ? 28 : 15, 'castigo');
      p.descontento = (p.descontento || 0) + (duro ? 1.5 : 0.5);
      p.asoc.suceso('castigo', this.tick);
      this.primeraVez(`castigo-${juez.tribu}`, `Los ${this.tribus[juez.tribu].nombre} castigan por primera vez a un ladrón: ${p.nombre}.`, 'vida');
    } else this.acierto(p);
  }

  /**
   * EL REGALO DEL CIELO (un poder del dios): cae un material que no existía, en un montón que se agota. Nadie sabe qué
   * es: si le encuentran uso, será combinándolo, como todo lo demás. Cada vez, uno distinto de los que aún no han caído.
   */
  meteorito(x, y, material) {
    const yaCaidos = new Set(this.delCielo.keys());
    const m = material || Object.keys(MATERIALES_DEL_CIELO).find((k) => !yaCaidos.has(k)) || this.azar.elegir(Object.keys(MATERIALES_DEL_CIELO));
    let n = 0;
    for (let k = 0; k < 6; k++) {
      const xx = x + this.azar.entero(5) - 2, yy = y + this.azar.entero(5) - 2;
      if (!this.pisable(xx, yy)) continue;
      const kk = `${xx},${yy}`, act = this.yacimientos.get(kk);
      if (act) act.queda += 6; else this.yacimientos.set(kk, { x: xx, y: yy, material: m, queda: 6 });
      n++;
    }
    if (!this.delCielo.has(m)) this.delCielo.set(m, { cayo: this.anio, recogido: 0, usado: 0, mejor: 0, para: null, objeto: null });
    this.efecto('meteorito', x, y);
    for (const q of this.cercanos(x, y, 6)) this.temer(q);   // (un susto: también puede nacer una creencia)
    this.nombrarSuceso('e:cielo', x, y, 8);
    this.anotar(`Cae algo del cielo ${this.describirSitio(x, y)}: ${MATERIALES_DEL_CIELO[m]} (${m}), en ${n} montones. Nadie lo había visto nunca.`, 'dios');
    return m;
  }

  /** UN MUERTO ABANDONADO: a partir de unos días enferma a quien está al lado; a los dos años solo quedan huesos. */
  pudrirse() {
    for (const [id, c] of this.cadaveres) {
      const edad = this.tick - c.desde;
      if (edad > 2 * TICKS_POR_ANIO) { this.cadaveres.delete(id); this.funerales.abandonado++; continue; }
      if (edad < 30) continue;
      for (const q of this.cercanos(c.x, c.y, 1)) if (this.azar() < 0.01 && this.contagiar(q, 'enfermedad')) {
        this.enfermosPorMuertos = (this.enfermosPorMuertos || 0) + 1;
        this.primeraVez(`podrido-${q.tribu}`, `${q.nombre} (${this.tribus[q.tribu].nombre}) enferma junto al cuerpo sin enterrar de ${c.nombre}.`, 'muerte');
      }
    }
  }

  /** ENCENDER una hoguera (con leña para un año; si es natural, dura poco y se apaga sola). */
  encender(x, y, p, natural, lena = TICKS_POR_ANIO) {
    if (!this.pisable(x, y)) return false;
    const k = `${x},${y}`;
    if (this.hogueras.has(k)) { const h = this.hogueras.get(k); h.lena = Math.max(h.lena, lena); return false; }
    this.hogueras.set(k, { x, y, lena, natural, tribu: p ? p.tribu : null });
    this.calorSucio = true;
    if (p) this.fuegosEncendidos = (this.fuegosEncendidos || 0) + 1;
    return true;
  }

  /** LA CHISPA: prende. Quien lo consigue sabe hacer fuego (y su pueblo, una palabra para él). */
  chispa(p) {
    if (p.madera > 0) p.madera--; else if (p.fibra > 0) p.fibra--; else p.resina--;
    const nueva = this.encender(p.x, p.y, p, false, 80);
    const sabia = p.sabeFuego;
    p.sabeFuego = true;
    this.nombreDe(p, 'fuego');
    this.efecto('objeto', p.x, p.y);
    if (!sabia) {
      this.inventoPrimero(p, 'fuego', 'golpeando piedra contra piedra junto a algo que arde, saca una chispa y prende: sabe hacer fuego');
      this.acierto(p);
    }
    return nueva || !sabia;
  }

  /** ENSEÑAR A HACER FUEGO: con lenguaje, solo si el otro ya tiene la palabra (si no, aprende la palabra). */
  ensenarFuego(a, de) {
    if (!de.sabeFuego || a.sabeFuego || a.edad < 8 * TICKS_POR_ANIO) return;
    const w = this.nombreDe(de, 'fuego');
    if (this.lenguaje && a.palabras.get('o:fuego') !== w) { if (this.azar() < 0.5) a.palabras.set('o:fuego', w); return; }
    a.sabeFuego = true; a.palabras.set('o:fuego', w);
    this.fuegoEnsenado = (this.fuegoEnsenado || 0) + 1;
    this.primeraVez(`fuego-${a.tribu}`, `${a.nombre} (${this.tribus[a.tribu].nombre}) aprende a hacer fuego: ${de.nombre} le enseña («${w}»).`, 'invento');
  }

  /** COCINAR: comer junto al fuego alimenta más y da algo más de proteína. */
  cocinar(p) {
    p.hambre = Math.max(0, p.hambre - 10); p.proteina = Math.min(100, p.proteina + 4);
    this.comidasCocinadas = (this.comidasCocinadas || 0) + 1;
    this.primeraVez(`cocina-${p.tribu}`, `${p.nombre} (${this.tribus[p.tribu].nombre}) come junto al fuego: la comida caliente alimenta más.`, 'invento');
  }

  /** La hoguera más cercana a r casillas (o null). */
  hogueraCerca(x, y, r) {
    for (const h of this.hogueras.values()) if (Math.max(Math.abs(h.x - x), Math.abs(h.y - y)) <= r) return h;
    return null;
  }

  /**
   * CUIDAR LAS HOGUERAS (cada 10 ticks): la leña se gasta; quien está al lado con madera echa más; las que se quedan sin
   * leña se apagan; en sequía, una hoguera junto al bosque puede prenderlo. Y se rehacen las rejillas de calor y de luz.
   */
  cuidarHogueras() {
    for (const [k, h] of this.hogueras) {
      h.lena -= 10;
      if (!h.natural && h.lena < 120) {
        const q = this.cercanos(h.x, h.y, 1).find((r) => r.madera > 0 && !r.dormido);
        if (q) { q.madera--; h.lena += TICKS_POR_ANIO; }
      }
      if (h.lena <= 0) { this.hogueras.delete(k); this.calorSucio = true; continue; }
      if (this.estadoClima === 'sequia' && !h.natural && this.azar() < 0.0006 && this.cerca(h.x, h.y, 1, (x, y) => this.t(x, y) === TERRENO.BOSQUE)) {
        this.incendiosPorHoguera = (this.incendiosPorHoguera || 0) + 1;
        this.anotar(`Una hoguera de los ${h.tribu != null ? this.tribus[h.tribu].nombre : 'hombres'} prende el bosque en plena sequía.`, 'clima');
        this.incendio(h.x, h.y);
      }
    }
    if (!this.calorSucio && this.tick % 60) return;
    this.calor.fill(0); this.luz.fill(0);
    const W = this.ancho, H = this.alto;
    for (const h of this.hogueras.values()) for (let y = Math.max(0, h.y - 3); y <= Math.min(H - 1, h.y + 3); y++) for (let x = Math.max(0, h.x - 3); x <= Math.min(W - 1, h.x + 3); x++) {
      const i = y * W + x; this.luz[i] = 1;
      if (Math.abs(x - h.x) <= 2 && Math.abs(y - h.y) <= 2) this.calor[i] = 1;
    }
    this.calorSucio = false;
  }

  /** Lo que ve la gente queda explorado para siempre (en la vista, lo demás es niebla). */
  explorar() {
    const W = this.ancho, H = this.alto, R = 6;
    for (const p of this.personas) {
      if (!p.vivo) continue;
      for (let y = Math.max(0, p.y - R); y <= Math.min(H - 1, p.y + R); y++) for (let x = Math.max(0, p.x - R); x <= Math.min(W - 1, p.x + R); x++) this.explorado[y * W + x] = 1;
    }
  }

  limpiarMuertos() {
    // los muertos se olvidan del mapa (pero sus ideas siguen en quien las aprendió)
    this.personas = this.personas.filter((p) => p.vivo);
    for (const [id, p] of this.porId) if (!p.vivo) this.porId.delete(id);
  }

  // ---- lo social ----
  compartir(p, q) {
    // (RESTAURAR EL EQUILIBRIO: si el que da es alguien contra quien el otro tenía un agravio, el agravio casi se borra)
    if (q.agravios && q.agravios.has(p.id) && p.carga > 0) {
      q.agravios.set(p.id, q.agravios.get(p.id) * 0.2); this.estadIndignacion.restituciones++;
      this.primeraVez(`restitucion-${p.tribu}`, `${p.nombre} (${this.tribus[p.tribu].nombre}) le da comida a ${q.nombre}, a quien había robado: se reconcilian.`, 'paz');
    }
    // TRUEQUE: con un extraño, si tengo una herramienta que le falta y él lleva comida, se la cambio
    // EL ARTESANO REGALA a los suyos lo que le sobra y les falta
    if (p.tribu === q.tribu) {
      const a = p.excedentes.find((x) => !q.cosas.some((c) => c.clave === x.clave));
      if (a) { p.excedentes.splice(p.excedentes.indexOf(a), 1); this.guardarCosa(q, a); this.conocer(q, p, 2); this.efecto('regalo', q.x, q.y); this.regalos = (this.regalos || 0) + 1; }
    }
    if (p.tribu !== q.tribu && q.carga >= 2) {
      // (primero lo que le sobra; si no, lo suyo que más le sobre)
      const sobra = p.excedentes.find((x) => !q.cosas.some((c) => c.clave === x.clave));
      const cosa = sobra || p.cosas.find((x) => !q.cosas.some((c) => c.clave === x.clave));
      const o = cosa && `«${cosa.nombre}»`;
      if (cosa) {
        this.trueques = (this.trueques || 0) + 1;
        const ruta = `${Math.min(p.tribu, q.tribu)}-${Math.max(p.tribu, q.tribu)}`;
        this.rutas = this.rutas || new Map(); this.rutas.set(ruta, (this.rutas.get(ruta) || 0) + 1);
        if (sobra) p.excedentes.splice(p.excedentes.indexOf(sobra), 1); else p.cosas.splice(p.cosas.indexOf(cosa), 1);
        this.guardarCosa(q, { ...cosa, nombre: q.palabras.get(`o:${cosa.clave}`) || cosa.nombre });
        if (this.azar() < 0.3 && !q.recetas.has(cosa.clave)) q.recetas.set(cosa.clave, cosa.receta);   // (a veces, viéndolo, entiende cómo se hace)
        q.carga -= 2; p.carga = Math.min(this.capacidad(p), p.carga + 2);
        this.efecto('regalo', q.x, q.y);
        this.conocer(q, p, 1.5); this.conocer(p, q, 1.5);
        this.primeraVez(`trueque-${Math.min(p.tribu, q.tribu)}-${Math.max(p.tribu, q.tribu)}`, `${p.nombre} (${this.tribus[p.tribu].nombre}) cambia su ${o} por comida con ${q.nombre} (${this.tribus[q.tribu].nombre}): el primer trueque entre sus pueblos.`, 'paz');
        this.acierto(p);
        return;
      }
    }
    this.efecto(p.tribu === q.tribu ? 'compartir' : 'regalo', q.x, q.y);
    if (p.tribu !== q.tribu) { this.regalosFuera = this.regalosFuera || { misma: 0, otra: 0 }; this.regalosFuera[p.marca === q.marca ? 'misma' : 'otra']++; }
    this.conocer(q, p, 2); this.conocer(p, q, 0.5);
    if (p.carga > 0 && q.hambre > 30) { p.carga--; q.hambre = Math.max(0, q.hambre - 35); q.proteina = Math.min(100, q.proteina + 10); q.vitaminas = Math.min(100, q.vitaminas + 10); this.acierto(q); }
    // AL COMPARTIR SE ENSEÑA: una idea pasa de uno a otro
    const aprendio = this.cultura ? this.heredar(q, p, 0.5, 1) : 0;
    if (this.cultura) this.ensenarReceta(q, p);
    q.afinidad[p.tribu] = Math.min(10, q.afinidad[p.tribu] + 1.5);
    // LAS OPINIONES TAMBIÉN SE TRANSMITEN: lo que piensa quien comparte de los demás pueblos se le contagia un poco al
    // otro (un 20 %). Así un agravio puede crecer hasta enemistad colectiva... o quedarse en algo personal
    if (this.cultura) for (let t = 0; t < q.afinidad.length; t++) {
      if (t === q.tribu || t === p.tribu) continue;
      q.afinidad[t] += 0.2 * (p.afinidad[t] - q.afinidad[t]);
    }
    p.afinidad[q.tribu] = Math.min(10, p.afinidad[q.tribu] + 0.5);
    if (p.tribu !== q.tribu) {
      this.primeraVez(`comparte-${Math.min(p.tribu, q.tribu)}-${Math.max(p.tribu, q.tribu)}`,
        `${p.nombre} (${this.tribus[p.tribu].nombre}) comparte con ${q.nombre} (${this.tribus[q.tribu].nombre}): primer intercambio entre sus pueblos.`, 'paz');
      if (aprendio) this.primeraVez(`idea-${p.tribu}-${q.tribu}`,
        `Una idea de los ${this.tribus[p.tribu].nombre} llega a los ${this.tribus[q.tribu].nombre}, de ${p.nombre} a ${q.nombre}.`, 'idea');
    }
    this.acierto(p);
  }

  atacar(p, blanco) {
    if (blanco.edad === undefined) {   // un lobo
      const ayuda = this.cercanos(blanco.x, blanco.y, 1).filter((q) => q.tribu === p.tribu).length;
      if (this.azar() < 0.25 + 0.2 * ayuda + 0.6 * this.uso(p, 'caza')) {
        blanco.vivo = false; p.carga = Math.min(this.capacidad(p), p.carga + 2); p.hambre = Math.max(0, p.hambre - 30); p.proteina = Math.min(100, p.proteina + 30); p.pieles = Math.min(4, p.pieles + 1);
        this.primeraVez(`caza-${p.tribu}`, `${p.nombre} (${this.tribus[p.tribu].nombre}) caza un lobo.`, 'idea');
        this.acierto(p);
      } else this.herir(p, 25, 'lobo');
      return;
    }
    const q = blanco;
    { const V = this.estadViolencia, o = this.origenAtaque || 'otro';
      V.ataques[o] = (V.ataques[o] || 0) + 1; if (p.hambre > 60) V.conHambre[o] = (V.conHambre[o] || 0) + 1;
      if (o.startsWith('accion')) { const k = `${o}|${p.concepto}`; V.conceptos[k] = (V.conceptos[k] || 0) + 1; } }
    this.efecto('pelea', q.x, q.y);
    const zonaPelea = this.zonaClima(q.x, q.y); if (zonaPelea) this.peleasPorZona[zonaPelea]++;
    // (¡AYUDA!: la víctima grita; los suyos que estén al lado la defienden)
    if (!q.dormido && this.tick - q.ultimoGrito > 10) this.gritar(q, 'ayuda', p.x, p.y);
    const aliados = this.cercanos(q.x, q.y, 1).filter((r) => r !== q && r.tribu === q.tribu && r.edad >= EDAD_ADULTA * TICKS_POR_ANIO && !r.dormido).length;
    if (aliados) { this.defensas = (this.defensas || 0) + 1; this.efecto('compartir', q.x, q.y); }
    const fuerza = (r) => (r.salud / 100) * (0.5 + this.azar()) * (1 + 0.6 * this.uso(r, 'caza')) * (r === q ? (1 + 0.25 * this.fortificado(q)) * (1 + 0.4 * aliados) : 1);
    const tp = this.tribus[p.tribu].nombre, tq = this.tribus[q.tribu].nombre;
    this.primeraVez(`pelea-${Math.min(p.tribu, q.tribu)}-${Math.max(p.tribu, q.tribu)}`,
      `${p.nombre} (${tp}) ataca a ${q.nombre} (${tq}): la primera pelea entre sus pueblos.`, 'guerra');
    // los que lo ven, lo recuerdan
    for (const r of this.cercanos(q.x, q.y, 4)) {
      if (r.tribu === q.tribu) r.afinidad[p.tribu] = Math.max(-10, r.afinidad[p.tribu] - 2);
    }
    q.afinidad[p.tribu] = Math.max(-10, q.afinidad[p.tribu] - 4);
    // (y a ESA persona: la víctima y los testigos de su pueblo recuerdan al agresor)
    this.conocer(q, p, -5);
    for (const r of this.cercanos(q.x, q.y, 4)) if (r !== q && r.tribu === q.tribu) this.conocer(r, p, -2);
    if (fuerza(p) > fuerza(q)) {
      const botin = q.carga; q.carga = 0; p.carga = Math.min(this.capacidad(p), p.carga + botin);
      this.herir(q, 40, 'pelea');
      if (!q.vivo) { const V = this.estadViolencia, o = this.origenAtaque || 'otro'; V.muertesVictima[o] = (V.muertesVictima[o] || 0) + 1; }
      if (!q.vivo && zonaPelea) this.muertesPorZona[zonaPelea]++;
      if (!q.vivo) {
        // LA FAMILIA DEL MUERTO lo sabe aunque no lo viera: guarda rencor al pueblo del agresor
        if (this.cultura) for (const id of [q.madre, q.padre, q.pareja, ...q.hijos]) {
          const f = id != null && this.porId.get(id);
          if (f && f.vivo) { f.afinidad[p.tribu] = Math.max(-10, f.afinidad[p.tribu] - 5); this.conocer(f, p, -6, false, q.id); }
        }
        const k = p.tribu < q.tribu ? `${p.tribu}-${q.tribu}` : `${q.tribu}-${p.tribu}`;
        this.caidos.set(k, (this.caidos.get(k) || 0) + 1);
        const g = this.guerras.get(k);
        if (g && this.relaciones.get(k) === 'guerra') g.caidos++;
      }
      if (botin) this.acierto(p);
    } else {
      this.herir(p, 30, 'pelea');
      if (!p.vivo) { const V = this.estadViolencia, o = this.origenAtaque || 'otro'; V.muertesAtacante[o] = (V.muertesAtacante[o] || 0) + 1; }
    }
    this.origenAtaque = null;
  }

  /** Bayas con fruta en un radio (para saber si una tierra da de comer). */
  comidaCerca(x, y, r) {
    let n = 0;
    for (let yy = y - r; yy <= y + r; yy++) for (let xx = x - r; xx <= x + r; xx++) {
      if (xx < 0 || yy < 0 || xx >= this.ancho || yy >= this.alto) continue;
      const i = yy * this.ancho + xx;
      if (this.fruta[i] > 0 && this.baya[i] === 1) n++;
    }
    return n;
  }

  /**
   * MIGRAR: si no queda comida cerca de casa, la familia se va a buscar tierras mejores (más bayas rojas a 15-30
   * casillas). Así los pueblos se expanden y acaban encontrándose.
   */
  migrar(p) {
    // APRENDER DEL CLIMA: si su memoria de sucesos dice que tras la sequía viene el hambre (o la sed), en cuanto hay
    // sequía se va antes de que falte la comida, a un sitio con más agua
    let anticipa = this.conductasAMano && this.estadoClima === 'sequia' && !p.migroEnSequia
      && (this.sabe(p, 'sequía', 'pasar hambre') || this.sabe(p, 'sequía', 'pasar sed'));
    // (CON LAS SEÑALES: quien ha aprendido que la tierra seca trae hambre o sed, se va en cuanto su zona se seca,
    // aunque aún no sea sequía para todos)
    const porSenal = this.conductasAMano && !anticipa && this.senales && p.vioSeco && !p.migroEnSeco
      && (this.sabe(p, 'tierra seca', 'pasar hambre') || this.sabe(p, 'tierra seca', 'pasar sed'));
    if (porSenal) anticipa = true;
    // (EL VOLCÁN QUE TIEMBLA: quien ha aprendido que tras los temblores viene la erupción, o el daño, se va lejos)
    const huyeVolcan = this.conductasAMano && !anticipa && this.geologia && p.temblorDe && this.tick - p.temblorDe.tick < TICKS_POR_ANIO && !p.huyoDe
      && (this.sabe(p, 'temblor', 'erupción') || this.sabe(p, 'temblor', 'ser herido') || this.sabe(p, 'temblor', 'perder a alguien'));
    if (huyeVolcan) anticipa = true;
    // (EL NÓMADA: sin hambre, el inquieto a veces se va con los suyos lejos, si allí hay bastante más comida que en casa)
    const nomada = !anticipa && !this.curiosidadNovedad && this.exploradores && p.inquietud > 0.4 && this.azar() < 0.004 * p.inquietud * p.inquietud;
    if (!anticipa && !nomada && (p.hambre < 40 || this.azar() > 0.1 || this.comidaCerca(p.hogar[0], p.hogar[1], 10) >= 8)) return;
    if (anticipa && this.azar() > 0.2) return;
    let mejor = null;
    for (let k = 0; k < 14; k++) {
      const ang = this.azar() * Math.PI * 2, d = (p.objetos.has('carreta') ? 20 + this.azar() * 25 : 15 + this.azar() * 15) * (nomada ? 1.5 : 1);
      const x = Math.round(p.hogar[0] + Math.cos(ang) * d), y = Math.round(p.hogar[1] + Math.sin(ang) * d);
      if (this.islas && this.uso(p, 'flota') < 0.5 && this.pisable(x, y) && this.isla(x, y) !== this.isla(p.hogar[0], p.hogar[1])) continue;   // (sin balsa, no se cruza)
      if (!this.pisable(x, y)) continue;
      if (!this.cerca(x, y, 5, (xx, yy) => this.t(xx, yy) === TERRENO.AGUA)) continue;   // (sin agua no se vive)
      let nota = this.comidaCerca(x, y, 8);
      if (porSenal) nota += 6 * Math.min(1.5, this.fisica.humedadLocal(x, y));   // (hacia donde llueve más)
      if (huyeVolcan && Math.hypot(x - p.temblorDe.x, y - p.temblorDe.y) < 22) continue;   // (lejos del volcán)
      if (anticipa) { let agua = 0; for (let yy = y - 5; yy <= y + 5; yy++) for (let xx = x - 5; xx <= x + 5; xx++) if (this.t(xx, yy) === TERRENO.AGUA) agua++; nota += agua * 0.3; }
      if (!mejor || nota > mejor.nota) mejor = { x, y, nota };
    }
    if (!mejor || mejor.nota < 8) return;
    if (nomada && mejor.nota < this.comidaCerca(p.hogar[0], p.hogar[1], 8) * 1.3 + 4) return;
    const familia = [p, this.porId.get(p.pareja), ...p.hijos.map((h) => this.porId.get(h))].filter((q) => q && q.vivo);
    for (const q of familia) { q.hogar = [mejor.x, mejor.y]; q.asoc.suceso('migrar', this.tick); if (this.estadoClima === 'sequia') q.migroEnSequia = true; if (porSenal) q.migroEnSeco = true; }
    if (porSenal) { this.anticipaciones = (this.anticipaciones || 0) + 1; this.primeraVez(`senal-${p.tribu}`, `${p.nombre} (${this.tribus[p.tribu].nombre}) ve que su tierra se seca y recuerda que después viene el hambre: se va con los suyos antes de que llegue.`, 'clima'); }
    if (huyeVolcan) {
      for (const q of familia) q.huyoDe = `${p.temblorDe.x},${p.temblorDe.y}`;
      this.huidasVolcan = (this.huidasVolcan || 0) + 1;
      this.primeraVez(`huye-volcan-${p.tribu}`, `${p.nombre} (${this.tribus[p.tribu].nombre}) siente temblar la tierra y recuerda lo que vino después la otra vez: se va lejos de la montaña con los suyos.`, 'clima');
    }
    if (anticipa && !porSenal && !huyeVolcan) this.primeraVez(`anticipa-${p.tribu}`, `${p.nombre} (${this.tribus[p.tribu].nombre}) ha aprendido que la sequía trae ${p.asoc.fuerza('sequía', 'pasar hambre') >= p.asoc.fuerza('sequía', 'pasar sed') ? 'hambre' : 'sed'}: parte con su familia antes de que falte, hacia más agua.`, 'clima');
    const t = this.tribus[p.tribu];
    if (nomada) {
      this.nomadas = (this.nomadas || 0) + 1;
      this.primeraVez(`nomada-${p.tribu}`, `${p.nombre} (${t.nombre}), de carácter inquieto, se va con su familia (${familia.length}) lejos, a tierras nuevas con más comida, sin que nada les empuje.`, 'migracion');
      return;
    }
    t.migraciones = (t.migraciones || 0) + 1;
    if (t.migraciones === 1 || t.migraciones % 10 === 0)
      this.anotar(`${p.nombre} (${t.nombre}) parte con su familia (${familia.length}) en busca de tierras con más comida${t.migraciones > 1 ? ` (ya van ${t.migraciones} familias)` : ''}.`, 'migracion');
  }

  /**
   * CONTAR UNA LECCIÓN: el mayor le cuenta al otro lo que aprendió de un suceso que avisa de algo malo (si lo sabe de
   * verdad: lo vivió al menos dos veces). Con lenguaje, solo si los dos tienen la misma palabra para la causa. Oírlo
   * cuenta como haberlo vivido una vez: quien lo oye de dos, ya lo sabe. Así un saber que cuesta una vida aprender
   * pasa de unos a otros.
   */
  contarLeccion(p, q) {
    if (p.edad <= q.edad) return;
    if (!this.inducidas) { this.contarLoVivido(p, q); return; }
    // (la costumbre de guardar en otoño, si los dos tienen la palabra para «guardar»)
    if (this.contrafactual && (p.costumbreGuardar || 0) >= 2 && (q.costumbreGuardar || 0) < 2 && (!this.lenguaje || (p.palabras.has('a:guardar') && q.palabras.get('a:guardar') === p.palabras.get('a:guardar'))) && this.azar() < 0.5) {
      q.costumbreGuardar = Math.min(2, (q.costumbreGuardar || 0) + 1); this.contadas = (this.contadas || 0) + 1;
      this.primeraVez(`cuenta-guardar-${p.tribu}`, `${p.nombre} (${this.tribus[p.tribu].nombre}) le dice a ${q.nombre}: en otoño hay que guardar comida para el invierno.`, 'idea');
      return;
    }
    for (const [a, palabra] of LECCIONES) {
      if (this.lenguaje && (!p.palabras.has(palabra) || q.palabras.get(palabra) !== p.palabras.get(palabra))) continue;
      for (const b of PELIGROS) {
        if (a === b || !this.sabe(p, a, b) || this.sabe(q, a, b)) continue;
        const k = `${a}→${b}`, A = q.asoc;
        let v = A.vinculos.get(k);
        if (!v) A.vinculos.set(k, v = { a, b, peso: 0, previa: 0, veces: 0 });
        v.peso += 1; v.previa += 1; v.veces += 1;
        A.frecuencias.set(a, (A.frecuencias.get(a) || 0) + 1); A.frecuencias.set(b, (A.frecuencias.get(b) || 0) + 1);
        this.contadas = (this.contadas || 0) + 1;
        const w = p.palabras.get(palabra);
        this.primeraVez(`cuenta-${p.tribu}-${a}`, `${p.nombre} (${this.tribus[p.tribu].nombre}) le cuenta a ${q.nombre} lo que vivió: tras ${{ temblor: 'los temblores', 'beber agua turbia': 'beber agua turbia', 'tierra encharcada': 'la tierra encharcada', langostas: 'las langostas' }[a] || 'la tierra seca'}${w ? ` («${w}»)` : ''} vino ${{ 'pasar hambre': 'el hambre', 'pasar sed': 'la sed', 'erupción': 'el fuego de la montaña', 'ser herido': 'el daño', 'perder a alguien': 'la muerte de alguien', 'enfermar': 'la enfermedad', 'langostas': 'las langostas' }[b]}.`, 'idea');
        return;
      }
    }
  }

  /**
   * CONTAR LO VIVIDO (sin lista mía): el mayor cuenta su lazo más fuerte cuyo efecto le importa (valencia clara, aprendida
   * por su cuerpo); con lenguaje, hace falta que el otro tenga su misma palabra para la causa. Oírlo es medio vivirlo.
   */
  contarLoVivido(p, q) {
    let mejor = null, f = 0;
    for (const v of p.asoc.vinculos.values()) {
      if (v.veces < 3 || v.a === v.b || Math.abs(p.asoc.valencia.get(v.b) || 0) < 0.05) continue;
      const x = p.asoc.fuerza(v.a, v.b); if (x > f) { f = x; mejor = v; }
    }
    if (!mejor || f < 0.3) return;
    if (this.lenguaje) {
      const k = `e:${abreviar(mejor.a)}`;
      if (!p.palabras.has(k)) { p.palabras.set(k, this.inventarPalabra(p)); this.palabraNueva(p, k, p.palabras.get(k)); }
      if (q.palabras.get(k) !== p.palabras.get(k)) { if (!q.palabras.has(k) || this.azar() < 0.3) q.palabras.set(k, p.palabras.get(k)); return; }
    }
    q.asoc.observar([mejor.a], mejor.b, 0.5);
    this.contadas = (this.contadas || 0) + 1;
  }

  vidaSocial(p) {
    if (this.estadoClima !== 'sequia') p.migroEnSequia = false;
    if (this.dibujos) { this.leerPinturas(p); if (this.azar() < 0.04) this.pintar(p); }
    if (this.inducidas && this.refugios && this.azar() < 0.25) this.buscarRefugio(p);
    if (this.fisica && this.senales) {
      // (LA TIERRA SECA: su zona lleva un año con mucha menos lluvia de lo normal; es un suceso que recordar)
      const h = this.fisica.humedadLocal(p.hogar[0], p.hogar[1]);
      if (h < 0.75 && !p.vioSeco) { p.vioSeco = true; p.asoc.suceso('tierra seca', this.tick); this.nombrarSuceso('e:seco', p.x, p.y, 4); }
      else if (h > 0.95) { if (p.vioSeco) p.migroEnSeco = false; p.vioSeco = false; }
      if (h > 1.3 && !p.vioMojado) {
        p.vioMojado = true; p.asoc.suceso('tierra encharcada', this.tick); this.nombrarSuceso('e:mojado', p.x, p.y, 4);
        if (this.conductasAMano && this.langostas && (this.sabe(p, 'tierra encharcada', 'langostas') || this.sabe(p, 'tierra encharcada', 'pasar hambre'))) { p.previsor = this.tick + TICKS_POR_ANIO; this.estadLangostas.previsores++; }
      }
      else if (h < 1.1) p.vioMojado = false;
    }
    // (QUIEN SABE HACER FUEGO, en casa y sin fuego, lo enciende: dos piedras y algo que arda)
    if (this.inducidas && p.sabeFuego && this.enCasa(p) && !this.hogueras.has(`${p.hogar[0]},${p.hogar[1]}`) && p.piedra >= 2 && (p.madera > 0 || p.fibra > 0) && this.azar() < 0.3) {
      if (p.madera > 0) p.madera--; else p.fibra--;
      this.encender(p.hogar[0], p.hogar[1], p, false);
    }
    { const sorpresas = p.asoc.vigilar(this.tick); if (this.alivio && sorpresas.length) this.noLlego(p, sorpresas); }
    if (this.inducidas) this.migrar(p);
    // CONVERSAR: dos adultos del mismo pueblo que están cerca acercan lo que opinan de los demás pueblos (un 10 %).
    // Así los rencores y las amistades se vuelven de todo un pueblo... o se diluyen
    if (this.cultura && this.azar() < 0.2) {
      const cerca = this.cercanos(p.x, p.y, 3).filter((q) => q !== p && q.tribu === p.tribu && q.edad >= EDAD_ADULTA * TICKS_POR_ANIO);
      if (cerca.length) {
        const q = this.azar.elegir(cerca);
        if (this.contar) this.contarLeccion(p, q);
        if (this.metas && p.edad > q.edad && (p.reservaObjetivo || 0) > (q.reservaObjetivo || 0)) q.reservaObjetivo = p.reservaObjetivo;
        for (let t = 0; t < p.afinidad.length; t++) {
          if (t === p.tribu) continue;
          const m = (p.afinidad[t] + q.afinidad[t]) / 2;
          p.afinidad[t] += 0.1 * (m - p.afinidad[t]); q.afinidad[t] += 0.1 * (m - q.afinidad[t]);
        }
        // HABLAR DE ALGUIEN: p le cuenta a q de la persona que más le importa; así corre la fama (buena o mala), y
        // muchos acaban teniendo una neurona para alguien a quien nunca vieron
        let famoso = null, v = 1.5;
        for (const [id, e] of p.conocidos) if (Math.abs(e.afecto) > v && id !== q.id) { v = Math.abs(e.afecto); famoso = id; }
        const f = famoso != null && (this.porId.get(famoso) || this.registro.get(famoso));
        if (f) { const e = p.conocidos.get(famoso); this.conocer(q, { id: famoso }, e.afecto * 0.4, false, p.id); }
        // (y se le hace caso al que más respeto tiene: el de menos prestigio copia una idea del otro)
        if (this.copia === 'mayoria') this.heredarConforme(q, p);
        else {
          const f = this.copia === 'exito' ? (r) => this.exito(r) : (r) => this.prestigio(r), margen = this.copia === 'exito' ? 0.3 : 1;
          const [alto, bajo] = f(p) >= f(q) ? [p, q] : [q, p];
          if (f(alto) > f(bajo) + margen) this.heredar(bajo, alto, 0.5, 1);
        }
        // y a hacer fuego (con lenguaje, hace falta la palabra)
        this.ensenarFuego(q, p);
        // y sus miedos: el más fuerte se contagia un poco
        let temido = null, tf = 1.2;
        for (const [a, f] of p.tabues) if (f > tf) { tf = f; temido = a; }
        if (temido) q.tabues.set(temido, Math.min(8, (q.tabues.get(temido) || 0) + 0.6));
        // y se cuentan dónde pasó lo bueno o lo malo (el lugar más marcado)
        let lugar = null, lv = 2;
        for (const [z, w] of p.lugares) if (Math.abs(w) > lv) { lv = Math.abs(w); lugar = z; }
        if (lugar != null) q.lugares.set(lugar, Math.max(-10, Math.min(10, (q.lugares.get(lugar) || 0) + p.lugares.get(lugar) * 0.3)));
      }
    }
    // formar pareja: alguien libre, cerca, del otro sexo y de un pueblo con el que se lleva bien (o el suyo)
    if (!p.pareja && this.azar() < 0.25) {
      // ELEGIR PAREJA: entre los libres de alrededor, a quien más aprecia, más respeta y lleva su seña; nunca a un
      // pariente cercano (padres, hijos, hermanos)
      let mejor = null, nota = 0.5;
      for (const q of this.cercanos(p.x, p.y, 4)) {
        if (q === p || q.pareja || q.sexo === p.sexo || q.edad < EDAD_ADULTA * TICKS_POR_ANIO || q.duelo > this.tick) continue;
        if (q.tribu !== p.tribu && (p.afinidad[q.tribu] < 3 || q.afinidad[p.tribu] < 3)) continue;
        if (q.id === p.madre || q.id === p.padre || p.hijos.includes(q.id) || (p.madre != null && q.madre === p.madre)) continue;
        const e = p.conocidos.get(q.id);
        const n = (e ? e.afecto / 5 : 0) + this.prestigio(q) * 0.2 + (q.marca === p.marca ? 0.5 : 0) + (q.tribu === p.tribu ? 0.5 : 0) + this.azar();
        if (n > nota) { nota = n; mejor = q; }
      }
      if (mejor) {
        const q = mejor;
        p.pareja = q.id; q.pareja = p.id;
        this.parejas = (this.parejas || 0) + 1; if (q.tribu !== p.tribu) this.parejasMixtas = (this.parejasMixtas || 0) + 1;
        this.conocer(p, q, 4); this.conocer(q, p, 4);
        if (q.tribu !== p.tribu)
          this.anotar(`${p.nombre} (${this.tribus[p.tribu].nombre}) y ${q.nombre} (${this.tribus[q.tribu].nombre}) forman una familia: dos pueblos se mezclan.`, 'familia');
      }
    }
    // tener hijos: la madre, con pareja cerca, bien alimentados y no muy seguidos
    if (p.sexo === 'f' && p.pareja && p.edad < EDAD_FERTIL_MAX * TICKS_POR_ANIO && this.tick - p.ultimoHijo > 2 * TICKS_POR_ANIO
        && p.hambre < 70 && p.sed < 70 && this.azar() < (p.proteina < 15 ? 0.03 : 0.08) * this.ganasDeHijo(p)) {
      const q = this.cercanos(p.x, p.y, 6).find((r) => r.id === p.pareja);
      if (q) {
        p.ultimoHijo = this.tick;
        const hijo = this.nacer(this.tribus[p.tribu], p, q, p.x, p.y);
        p.asoc.suceso('tener un hijo', this.tick); q.asoc.suceso('tener un hijo', this.tick);
        this.periodo().nacimientos++;
        this.primeraVez(`hijo-${p.tribu}`, `Nace ${hijo.nombre}, el primer hijo de los ${this.tribus[p.tribu].nombre} en este mundo.`, 'familia');
      }
    }
    // enseñar a los hijos que andan cerca (la cultura también se transmite al crecer)
    if (this.cultura && p.hijos.length && this.azar() < 0.3) {
      for (const q of this.cercanos(p.x, p.y, 2)) if (p.hijos.includes(q.id) && q.edad < EDAD_ADULTA * 1.5 * TICKS_POR_ANIO) { this.heredar(q, p, 0.3, 1); this.ensenarReceta(q, p); this.ensenarFuego(q, p); }
    }
    // LOS MAYORES ENSEÑAN: a cualquier niño o joven de su pueblo que tengan cerca, y más de una idea
    if (this.cultura && p.edad > EDAD_ANCIANA * TICKS_POR_ANIO && this.azar() < 0.3) {
      for (const q of this.cercanos(p.x, p.y, 3)) if (q.tribu === p.tribu && q.edad < EDAD_ADULTA * 1.5 * TICKS_POR_ANIO && q.edad > 3 * TICKS_POR_ANIO) this.heredar(q, p, 0.5, 2);
    }
  }

  // ---- para mirar ----
  estadisticas() {
    const vivos = this.personas.filter((p) => p.vivo);
    const ideas = new Map();   // "autor|situación|acción" → {autor, nombre, tribu, concepto, accion, portadores, tribus}
    for (const p of vivos) for (const [k, o] of p.origen) {
      const n = p.nucleo.neuronas.get(k);
      if (!n) continue;
      const clave = `${o.autor}|${n.concepto}|${n.accion}`;
      let i = ideas.get(clave);
      if (!i) ideas.set(clave, i = { autor: o.autor, nombre: o.nombre, tribu: o.tribu, anio: o.anio, concepto: n.concepto, accion: n.accion, portadores: 0, tribus: new Set(), manosMax: 0 });
      if (!i.personas) i.personas = new Set();
      if (!i.personas.has(p.id)) { i.personas.add(p.id); i.portadores++; }
      i.tribus.add(p.tribu); i.manosMax = Math.max(i.manosMax, o.manos);
    }
    return {
      anio: this.anio, vivos: vivos.length,
      porTribu: this.tribus.map((t) => ({ nombre: t.nombre, vivos: vivos.filter((p) => p.tribu === t.id).length, nacidos: t.nacidos })),
      muertos: { ...this.muertos },
      neuronasMedia: vivos.length ? vivos.reduce((s, p) => s + p.nucleo.neuronas.size, 0) / vivos.length : 0,
      ideas: [...ideas.values()].sort((a, b) => b.portadores - a.portadores),
    };
  }
}
