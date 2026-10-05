// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 FOKO SOFT (Emilio Martinez) — Neutro, https://github.com/emicaim/PUBLIC-NEUTRO
// EL AGENTE GENERAL de Neutro: el mismo cerebro para cualquier mundo. El mundo solo le da tres cosas —cómo está el
// cuerpo, qué hay alrededor (tipo, distancia y dirección de cada objeto) y unas señales (por ejemplo «oscuro»)— y el
// agente arma solo su percepción, siente su recompensa y aprende con las mismas piezas de Neutro Minds: el núcleo (con
// aprender por concepto y el instinto aprendido), la recompensa homeostática y la memoria de sucesos.
//
// Lo que no sabe de serie: qué es bueno ni qué es peligroso. Ni siquiera qué objeto calma qué necesidad: eso lo aprende
// la memoria de sucesos por cómo queda su cuerpo después de cada cosa (la valencia).
//
// LO INNATO (y nada más): ir hacia lo que su memoria asocia con alivio cuando el cuerpo lo necesita, llevarse a la boca
// lo que tiene al lado si tiene una necesidad, y la curiosidad (lo poco visto atrae). Ver LabGeneral.md.
using System;
using System.Collections.Generic;
using System.Linq;

namespace Neutro.General
{
    /// <summary>Una variable del cuerpo: su valor y su punto de equilibrio (en las mismas unidades).</summary>
    public class Variable
    {
        public string Nombre;
        public double Valor, Equilibrio = 1;
        public Variable(string nombre, double valor, double equilibrio = 1) { Nombre = nombre; Valor = valor; Equilibrio = equilibrio; }
        /// <summary>Lo que falta para el equilibrio, en fracción del equilibrio (0 = bien, 1 = nada).</summary>
        public double Deficit => Equilibrio <= 0 ? 0 : Math.Max(0, Math.Min(1, (Equilibrio - Valor) / Equilibrio));
    }

    /// <summary>Un objeto que el agente ve: su tipo (una etiqueta), a qué distancia y en qué dirección (unitaria, en el plano).</summary>
    public struct Percibido
    {
        public string Tipo;
        public double Distancia, DirX, DirZ;
        public Percibido(string tipo, double distancia, double dirX, double dirZ) { Tipo = tipo; Distancia = distancia; DirX = dirX; DirZ = dirZ; }
    }

    /// <summary>Lo que el mundo le da al agente en cada paso.</summary>
    public class Observacion
    {
        public double Tiempo;                                  // segundos de juego
        public List<Variable> Cuerpo = new List<Variable>();
        public List<Percibido> Objetos = new List<Percibido>();
        public List<string> Senales = new List<string>();     // las que están activas ahora
    }

    /// <summary>Lo que el agente quiere hacer: un verbo y, si hace falta, el tipo de objeto. El mundo lo ejecuta.</summary>
    public struct Intencion
    {
        public string Verbo;   // esperar, explorar, consumir, ir, huir
        public string Tipo;    // a qué (para consumir, ir y huir)
        public override string ToString() => Tipo == null ? Verbo : $"{Verbo} {Tipo}";
    }

    public class AgenteGeneral
    {
        // ---- parámetros (todos en PARAMETROS.md) ----
        /// <summary>Las tres distancias de la percepción, en SEGUNDOS DE CAMINO a su velocidad (unidad natural: no depende del tamaño del mundo).</summary>
        public static readonly double[] Distancias = { 1, 5, 15 };
        /// <summary>Déficit a partir del cual una variable es una necesidad (elegido).</summary>
        public const double UmbralNecesidad = 0.3;
        /// <summary>Curiosidad: la misma fórmula que Neutro Minds con curiosidad media (0,02 + 0,1 × 0,5) / √veces.</summary>
        public const double Curiosidad = 0.5;

        public readonly string[] Tipos, Senales;
        public readonly double Velocidad;
        public readonly Nucleo Nucleo;
        public readonly Asociaciones Memoria;
        /// <summary>Si aprende (el núcleo). Sin él queda solo lo innato y la memoria de sucesos: la línea base «sin núcleo».</summary>
        public bool Aprende = true;
        /// <summary>Si explora por curiosidad.</summary>
        public bool Explora = true;
        /// <summary>(experimento) Los fracasos solo enseñan a través de lo esperado (alivio y miedo condicionado), no cualquier malestar.</summary>
        public bool SoloLoEsperado;
        /// <summary>(experimento) Rescorla y Wagner: la culpa de un daño solo va a las decisiones tomadas con su causa conocida a la vista.</summary>
        public bool PorCausa = true;
        /// <summary>La defensa innata (alejarse de lo que se sabe que daña). Por defecto, sí.</summary>
        public bool Defensa = true;
        readonly List<(string situacion, string accion, HashSet<string> vistos)> recientes = new List<(string, string, HashSet<string>)>();

        /// <summary>
        /// LA CULPA A LA CAUSA: de lo que se perdió, qué tipos lo suelen traer según la memoria de sucesos («cerca lobo» →
        /// «pierde salud»); las decisiones de los últimos 10 s tomadas con uno de ellos a la vista suman un fallo. Si la
        /// memoria aún no conoce la causa, no se culpa a nada (el primer golpe enseña a la memoria, no a las acciones).
        /// </summary>
        void CulparALaCausa(List<string> perdidas)
        {
            var causas = new HashSet<string>();
            foreach (var efecto in perdidas)
                foreach (var tipo in Tipos)
                    if (Memoria.Fuerza("cerca " + tipo, efecto) >= Asociaciones.UmbralPrediccion) causas.Add(tipo);
            if (causas.Count == 0) return;
            var lista = recientes.Where(e => e.vistos.Overlaps(causas)).Select(e => (e.situacion, e.accion)).Distinct().ToList();
            if (lista.Count > 0) Nucleo.Repasar(lista, false, 1);
        }

        // lo último que pensó (para «ver la mente»)
        public string Situacion, Concepto, Accion, Foco;
        public Intencion Ultima;
        public bool Exploro;
        public int Buenas, Malas;

        readonly Random azar;
        readonly Dictionary<string, (int n, Dictionary<string, int> a)> vistas = new Dictionary<string, (int, Dictionary<string, int>)>();
        readonly Dictionary<string, int> binPrevio = new Dictionary<string, int>();
        readonly HashSet<string> senalesPrevias = new HashSet<string>();
        string situacionAnterior;
        readonly string[] variables;
        // EL VALOR DE CADA COSA PARA CADA NECESIDAD (Dickinson y Balleine 1994: el valor de incentivo es específico de la
        // necesidad; Balleine 1992): cuánto bajó el déficit de cada variable tras consumirla, en media móvil (20 %)
        readonly Dictionary<string, double[]> valorConsumir = new Dictionary<string, double[]>();
        readonly List<(string tipo, double cuando, double[] deficit)> bocados = new List<(string, double, double[])>();
        // EL ALIVIO (Mowrer: teoría de los dos factores), como en Neutro Minds: lo que hace mientras espera algo queda
        // marcado (la huella); si lo malo esperado no llega, se refuerza; si llega, se castiga
        readonly Dictionary<string, List<(string situacion, string accion)>> huellas = new Dictionary<string, List<(string, string)>>();
        double[] deficitPrevio;

        public string Espera;   // lo que espera ahora (el efecto), o null
        public int Alivios, MiedosCondicionados;

        /// <param name="tipos">Todos los tipos de objeto que puede haber en este mundo.</param>
        /// <param name="variables">Las variables del cuerpo, en orden.</param>
        /// <param name="senales">Las señales que puede dar el mundo.</param>
        /// <param name="velocidad">Metros por segundo al andar (para medir las distancias en segundos).</param>
        public AgenteGeneral(IList<string> tipos, IList<string> variables, IList<string> senales, double velocidad, int semilla)
        {
            Tipos = tipos.ToArray(); this.variables = variables.ToArray(); Senales = senales.ToArray(); Velocidad = velocidad;
            azar = new Random(semilla);
            // (las acciones son pocas y relativas a LO QUE IMPORTA AHORA —el foco, el objeto que da nombre a la
            // situación—, como «evitar» en Neutro Minds: acercarse al lobo o alejarse de él, no «huir de cada cosa»)
            var acciones = new List<string> { "instinto", "esperar", "explorar", "consumir", "acercarse", "alejarse" };
            Nucleo = new Nucleo(new PercepcionGeneral(this), acciones) { Generalizar = true, PorConcepto = true };
            // (la memoria de sucesos: une lo que pasa en 20 s y mira cómo quedó el cuerpo 4 s después de cada suceso)
            Memoria = new Asociaciones(20, 120, 4);
        }

        public string[] Acciones => Nucleo.Acciones;

        /// <summary>IMPULSO (Keramati y Gutkin 2014): la distancia del cuerpo a su equilibrio, raíz de la suma de los déficits al cuadrado.</summary>
        public static double Impulso(IEnumerable<Variable> cuerpo) => Math.Sqrt(cuerpo.Sum(v => v.Deficit * v.Deficit));

        public int Bin(double distancia)
        {
            for (int i = 0; i < Distancias.Length; i++) if (distancia <= Distancias[i] * Velocidad) return i + 1;
            return 0;
        }

        /// <summary>Un paso: siente, aprende, percibe, decide. Devuelve lo que quiere hacer.</summary>
        public Intencion Paso(Observacion o)
        {
            double t = o.Tiempo;
            // 1b. LO QUE SIENTE EL CUERPO desde la última decisión, y la lección (igual que Neutro Minds)
            double imp = Impulso(o.Cuerpo);
            var deficit = variables.Select(n => o.Cuerpo.FirstOrDefault(x => x.Nombre == n)?.Deficit ?? 0).ToArray();
            for (int k = bocados.Count - 1; k >= 0; k--)
            {
                var (tipo, cuando, antes) = bocados[k];
                if (t - cuando < Memoria.VentanaValencia) continue;
                if (!valorConsumir.TryGetValue(tipo, out var val)) valorConsumir[tipo] = val = new double[variables.Length];
                for (int j = 0; j < variables.Length; j++) val[j] += 0.2 * ((antes[j] - deficit[j]) - val[j]);
                bocados.RemoveAt(k);
            }
            // 1. LA INTEROCEPCIÓN: un cambio brusco del cuerpo es un suceso («pierde salud», «gana energía»). Se anota ANTES de
            // sentir el cuerpo de ahora, para que su valencia mida el cambio mismo (si no, «pierde salud» parece bueno: tras
            // el golpe, el cuerpo se recupera)
            var sorpresas = Memoria.Vigilar(t);
            var cumplidas = new List<(string causa, string efecto)>();
            var perdidas = new List<string>();
            if (deficitPrevio != null)
                for (int j = 0; j < variables.Length; j++)
                {
                    double d = deficit[j] - deficitPrevio[j];
                    if (d >= Nucleo.UmbralHomeostasis) { cumplidas.AddRange(Memoria.Suceso("pierde " + variables[j], t)); perdidas.Add("pierde " + variables[j]); }
                    else if (d <= -Nucleo.UmbralHomeostasis) cumplidas.AddRange(Memoria.Suceso("gana " + variables[j], t));
                }
            deficitPrevio = deficit;

            Memoria.Sentir(imp, t);
            int r = Nucleo.Sentir(imp);
            if (Aprende)
            {
                if (r > 0) { Buenas++; Nucleo.Consolidar(0); }
                else if (r < 0)
                {
                    Malas++;
                    if (PorCausa) CulparALaCausa(perdidas);
                    else if (!SoloLoEsperado) Nucleo.AprenderDeFracaso(null);
                }
            }

            // 2. LOS SUCESOS: lo que aparece cerca y las señales que cambian
            var cercano = new Dictionary<string, Percibido>();
            foreach (var p in o.Objetos)
                if (!cercano.TryGetValue(p.Tipo, out var q) || p.Distancia < q.Distancia) cercano[p.Tipo] = p;
            var bins = new int[Tipos.Length];
            for (int i = 0; i < Tipos.Length; i++)
            {
                bins[i] = cercano.TryGetValue(Tipos[i], out var p) ? Bin(p.Distancia) : 0;
                int antes = binPrevio.TryGetValue(Tipos[i], out var b) ? b : 0;
                if (bins[i] >= 1 && bins[i] <= 2 && !(antes >= 1 && antes <= 2)) cumplidas.AddRange(Memoria.Suceso("cerca " + Tipos[i], t));
                binPrevio[Tipos[i]] = bins[i];
            }
            foreach (var s in Senales)
            {
                bool ahora = o.Senales.Contains(s);
                if (ahora && !senalesPrevias.Contains(s)) cumplidas.AddRange(Memoria.Suceso(s, t));
                if (ahora) senalesPrevias.Add(s); else senalesPrevias.Remove(s);
            }

            if (Aprende) { SeCumple(cumplidas); NoLlego(sorpresas); }
            Espera = EsperaDe(t);

            // 3. LA SITUACIÓN: la necesidad más urgente, lo más cercano de cada tipo a tres distancias y las señales
            int nec = -1; double peor = UmbralNecesidad;
            for (int i = 0; i < variables.Length; i++)
            {
                var v = o.Cuerpo.FirstOrDefault(x => x.Nombre == variables[i]);
                if (v != null && v.Deficit >= peor) { peor = v.Deficit; nec = i; }
            }
            var sb = new System.Text.StringBuilder();
            sb.Append(nec < 0 ? '-' : (char)('a' + nec));
            // (LA INTEROCEPCIÓN GRADUADA: no es lo mismo un hambre leve que una desesperada; al empeorar, la situación cambia)
            sb.Append(nec < 0 ? '0' : peor < 0.6 ? '1' : peor < 0.8 ? '2' : '3');
            // (LA ATENCIÓN GUIADA POR EL VALOR —Anderson 2013—: solo entra en la situación lo que ha importado a su
            // cuerpo, por lo que alivia o por lo que daña; lo demás no se atiende)
            for (int i = 0; i < bins.Length; i++) sb.Append(Atiende(Tipos[i]) ? (char)('0' + bins[i]) : '.');
            foreach (var s in Senales) sb.Append(o.Senales.Contains(s) ? '1' : '0');
            // (LA EXPECTATIVA, como en Neutro Minds: lo que espera, tal cual; si es bueno o malo lo aprende el núcleo)
            sb.Append(' ').Append(Espera == null ? "0" : (Memoria.Valencia[Espera] > 0 ? "m" : "b") + Espera);
            Situacion = sb.ToString();
            Concepto = Nucleo.Percepcion.Nombrar(Situacion);

            // 4. DECIDIR (activación dispersa), y a veces EXPLORAR por curiosidad: la acción que menos ha probado aquí
            var (accion, _) = Nucleo.DecidirSituacion(Situacion, true, () => "");
            Exploro = false;
            if (Explora)
            {
                if (!vistas.TryGetValue(Situacion, out var vista)) vista = (0, new Dictionary<string, int>());
                // (cuenta las VECES QUE ENTRA en la situación, no los instantes que pasa en ella: si contara instantes,
                // quedarse quieto apagaría la curiosidad y una conducta inútil seguiría para siempre)
                if (Situacion != situacionAnterior) vista.n++;
                situacionAnterior = Situacion;
                double p = (0.02 + 0.1 * Curiosidad) / Math.Sqrt(vista.n);
                if (azar.NextDouble() < p)
                {
                    int menos = int.MaxValue; var cand = new List<string>();
                    foreach (var a in Acciones)
                    {
                        int k = vista.a.TryGetValue(a, out var x) ? x : 0;
                        if (k < menos) { menos = k; cand.Clear(); cand.Add(a); } else if (k == menos) cand.Add(a);
                    }
                    accion = cand[azar.Next(cand.Count)]; Exploro = true;
                    var h = Nucleo.Historial[Nucleo.Historial.Count - 1]; h.Accion = accion; Nucleo.Historial[Nucleo.Historial.Count - 1] = h;
                }
                vista.a[accion] = (vista.a.TryGetValue(accion, out var c) ? c : 0) + 1;
                vistas[Situacion] = vista;
            }
            Accion = accion;
            if (Espera != null)
            {
                if (!huellas.TryGetValue(Espera, out var lista)) huellas[Espera] = lista = new List<(string, string)>();
                lista.RemoveAll(e => e.situacion == Situacion);
                lista.Add((Situacion, accion)); if (lista.Count > 20) lista.RemoveAt(0);
            }
            {
                var vistos = new HashSet<string>(Tipos.Where((tp, k) => bins[k] >= 1));
                recientes.Add((Situacion, accion, vistos));
                while (recientes.Count > 20) recientes.RemoveAt(0);   // (10 s de decisiones)
            }
            // (el historial de una vida larga no cabe: entre suceso y suceso se recuerda lo último, como en Neutro Minds)
            if (Nucleo.Historial.Count > 120) Nucleo.Historial.RemoveRange(0, 60);

            // 5. DE LA ACCIÓN A LA INTENCIÓN (el instinto se resuelve aquí)
            var previa = Ultima;
            var instinto = Instinto(nec, cercano);
            Foco = FocoDe(Concepto, instinto, cercano);
            Ultima = accion == "instinto" ? instinto : Traducir(accion, cercano);
            // (una tanda de bocados es un suceso, no uno por bocado: lo que se recuerda es «comí fruta»)
            if (Ultima.Verbo == "consumir" && Ultima.Tipo != null && !(previa.Verbo == "consumir" && previa.Tipo == Ultima.Tipo))
            {
                Memoria.Suceso("consumir " + Ultima.Tipo, t);
                bocados.Add((Ultima.Tipo, t, deficit));
            }
            return Ultima;
        }

        /// <summary>Lo que espera ahora su memoria: el efecto esperado más fuerte de valencia clara (como esperaDe en Neutro Minds).</summary>
        string EsperaDe(double t)
        {
            string mejor = null; double f = 0;
            foreach (var (causa, efecto, hasta) in Memoria.Esperando)
            {
                if (hasta < t) continue;
                double v = Memoria.Valencia.TryGetValue(efecto, out var x) ? x : 0;
                if (Math.Abs(v) < 0.05) continue;
                double fz = Memoria.Fuerza(causa, efecto) * Math.Abs(v);
                if (fz > f) { f = fz; mejor = efecto; }
            }
            return mejor;
        }

        /// <summary>SE CUMPLE LO QUE ESPERABA: si era malo, lo que hizo mientras lo esperaba se castiga (miedo condicionado); si era bueno, se refuerza.</summary>
        void SeCumple(List<(string causa, string efecto)> cumplidas)
        {
            foreach (var (_, efecto) in cumplidas)
            {
                if (!huellas.TryGetValue(efecto, out var lista) || lista.Count == 0) continue;
                double v = Memoria.Valencia.TryGetValue(efecto, out var x) ? x : 0;
                if (v > 0.05) { Nucleo.Repasar(lista, false, 1); MiedosCondicionados++; }
                else if (v < -0.05) Nucleo.Repasar(lista, true, 0.5);
                huellas.Remove(efecto);
            }
        }

        /// <summary>NO LLEGÓ LO QUE ESPERABA: si era malo, ALIVIO (lo que hizo se refuerza); si era bueno, desengaño (un fallo pequeño).</summary>
        void NoLlego(List<(string causa, string efecto)> sorpresas)
        {
            foreach (var (_, efecto) in sorpresas)
            {
                if (!huellas.TryGetValue(efecto, out var lista) || lista.Count == 0) continue;
                double v = Memoria.Valencia.TryGetValue(efecto, out var x) ? x : 0;
                if (v > 0.05) { Nucleo.Repasar(lista, true, 1); Alivios++; }
                else if (v < -0.05) Nucleo.Repasar(lista, false, 0.3);
                huellas.Remove(efecto);
            }
        }

        /// <summary>
        /// EL FOCO: el objeto del concepto si la situación lleva el nombre de uno («lobo cerca»); si no, aquello hacia lo
        /// que va el instinto; si no, lo más cercano.
        /// </summary>
        string FocoDe(string concepto, Intencion instinto, Dictionary<string, Percibido> cercano)
        {
            if (concepto.EndsWith(" cerca")) return concepto.Substring(0, concepto.Length - 6);
            if (instinto.Tipo != null) return instinto.Tipo;
            string mejor = null; double d = double.MaxValue;
            foreach (var kv in cercano) if (kv.Value.Distancia < d) { d = kv.Value.Distancia; mejor = kv.Key; }
            return mejor;
        }

        Intencion Traducir(string accion, Dictionary<string, Percibido> cercano)
        {
            switch (accion)
            {
                case "consumir": return new Intencion { Verbo = "consumir", Tipo = AlLado(cercano) };
                case "acercarse": return Foco == null ? new Intencion { Verbo = "esperar" } : new Intencion { Verbo = "ir", Tipo = Foco };
                case "alejarse": return Foco == null ? new Intencion { Verbo = "esperar" } : new Intencion { Verbo = "huir", Tipo = Foco };
                default: return new Intencion { Verbo = accion };
            }
        }

        /// <summary>El tipo más cercano si está al lado (primera distancia), o null.</summary>
        string AlLado(Dictionary<string, Percibido> cercano)
        {
            string mejor = null; double d = double.MaxValue;
            foreach (var kv in cercano) if (Bin(kv.Value.Distancia) == 1 && kv.Value.Distancia < d) { d = kv.Value.Distancia; mejor = kv.Key; }
            return mejor;
        }

        /// <summary>Si este tipo ha importado a su cuerpo: alivia alguna necesidad al consumirlo, o su cercanía cambia el cuerpo.</summary>
        public bool Atiende(string tipo)
        {
            if (!Atencion) return true;
            double c = ValorDeConsumir(tipo);
            return (!double.IsNaN(c) && c >= Nucleo.UmbralHomeostasis) || Math.Abs(ValorDeCerca(tipo)) >= 0.05;
        }
        /// <summary>(experimento) Con la atención guiada por el valor (por defecto) o atendiendo a todo.</summary>
        public bool Atencion = true;

        /// <summary>Cuánto alivia consumir este tipo a la variable `necesidad` (déficit que baja), o NaN si nunca lo probó.</summary>
        public double ValorDeConsumir(string tipo, int necesidad) => valorConsumir.TryGetValue(tipo, out var v) ? v[necesidad] : double.NaN;
        /// <summary>El mayor alivio que da consumir este tipo a alguna variable (para «ver la mente»), o NaN.</summary>
        public double ValorDeConsumir(string tipo) => valorConsumir.TryGetValue(tipo, out var v) ? v.Max() : double.NaN;
        public string[] Variables => variables;
        /// <summary>Cómo queda el cuerpo cuando este tipo aparece cerca (negativo = peor).</summary>
        public double ValorDeCerca(string tipo) => Memoria.Valencia.TryGetValue("cerca " + tipo, out var v) ? -v : 0;

        /// <summary>
        /// LO INNATO. Ante un peligro conocido y cercano, alejarse. Sin necesidad, quedarse quieto. Con una necesidad: si al lado hay algo que nunca se ha llevado a la
        /// boca, probarlo; si al lado está lo que su memoria asocia con alivio DE ESA NECESIDAD, consumirlo; si lo ve más
        /// lejos, ir hacia ello; si no conoce nada que la alivie, explorar.
        /// </summary>
        Intencion Instinto(int necesidad, Dictionary<string, Percibido> cercano)
        {
            // (LA DEFENSA INNATA —Bolles 1970—: ante lo que su memoria sabe que daña, si está cerca, alejarse; no sabe
            // de serie qué daña, solo cómo defenderse cuando lo sabe)
            if (Defensa)
            {
                string peligro = null; double peor = -0.05;
                foreach (var kv in cercano)
                {
                    if (Bin(kv.Value.Distancia) > 2) continue;
                    double v = ValorDeCerca(kv.Key);
                    if (v <= peor) { peor = v; peligro = kv.Key; }
                }
                if (peligro != null) return new Intencion { Verbo = "huir", Tipo = peligro };
            }
            if (necesidad < 0) return new Intencion { Verbo = "esperar" };
            string lado = AlLado(cercano);
            if (lado != null && double.IsNaN(ValorDeConsumir(lado))) return new Intencion { Verbo = "consumir", Tipo = lado };
            string mejor = null; double valor = Nucleo.UmbralHomeostasis;
            foreach (var kv in cercano)
            {
                double v = ValorDeConsumir(kv.Key, necesidad);
                if (!double.IsNaN(v) && v >= valor) { valor = v; mejor = kv.Key; }
            }
            if (mejor == null) return new Intencion { Verbo = "explorar" };
            if (mejor == lado) return new Intencion { Verbo = "consumir", Tipo = mejor };
            return new Intencion { Verbo = "ir", Tipo = mejor };
        }

        /// <summary>
        /// LA PERCEPCIÓN AUTOMÁTICA: el concepto de una situación es el tipo de objeto cercano que más ha cambiado su
        /// cuerpo (por la memoria de sucesos); si ninguno importa, su necesidad; si no tiene, la calma.
        /// </summary>
        class PercepcionGeneral : IPercepcion
        {
            readonly AgenteGeneral a;
            public PercepcionGeneral(AgenteGeneral agente) { a = agente; }

            string Importante(string s)
            {
                string mejor = null; double fuerza = Nucleo.UmbralHomeostasis;
                for (int i = 0; i < a.Tipos.Length; i++)
                {
                    char b = s[2 + i];
                    if (b != '1' && b != '2') continue;
                    double v = Math.Abs(a.ValorDeCerca(a.Tipos[i]));
                    if (v >= fuerza) { fuerza = v; mejor = a.Tipos[i]; }
                }
                return mejor;
            }

            public string Nombrar(string s)
            {
                var t = Importante(s);
                if (t != null) return t + " cerca";
                if (s[0] != '-') return "necesidad " + a.variables[s[0] - 'a'];
                return "calma";
            }

            public bool Tranquila(string s) => s[0] == '-' && Importante(s) == null;
        }
    }
}
