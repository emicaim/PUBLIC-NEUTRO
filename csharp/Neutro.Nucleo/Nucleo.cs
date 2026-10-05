// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 FOKO SOFT (Emilio Martinez) — Neutro, https://github.com/emicaim/PUBLIC-NEUTRO
// NÚCLEO DE NEUTRO en C#: el cerebro de neuronas de concepto, sin saber a qué juega.
//
// Sigue docs/COMO-FUNCIONA.md punto por punto; es la traducción de python/neutro/nucleo.py y tiene que comportarse EXACTAMENTE igual
// (lo comprueban las pruebas cruzadas: pruebas/cruzado.py, cruzado.mjs y csharp/Neutro.Pruebas).
// Sin dependencias: sirve en Unity, en Godot o en un servidor.
using System;
using System.Collections.Generic;
using System.Linq;

namespace Neutro
{
    /// <summary>Lo que pone cada mundo: qué concepto es una situación y si merece neurona propia.</summary>
    public interface IPercepcion
    {
        string Nombrar(string situacion);
        bool Tranquila(string situacion);
    }

    /// <summary>Una neurona de concepto (o una excepción de lugar): cuenta fallos y aciertos por acción y elige.</summary>
    public class Neurona
    {
        public string Concepto;
        public string Accion;
        public Dictionary<string, double> Fallos = new Dictionary<string, double>();
        public Dictionary<string, double> Aciertos;     // null hasta el primer acierto
        public bool Protegida, Conflicto;
        public List<int> SitiosCambio;                  // null hasta el primer cambio anotado

        public double FallosDe(string a) => Fallos.TryGetValue(a, out var v) ? v : 0;
        public double AciertosDe(string a) => Aciertos != null && Aciertos.TryGetValue(a, out var v) ? v : 0;
    }

    /// <summary>Diccionario que recuerda el orden de inserción (el completado recorre las neuronas por antigüedad).</summary>
    public class MapaOrdenado
    {
        readonly Dictionary<string, Neurona> mapa = new Dictionary<string, Neurona>();
        readonly List<string> orden = new List<string>();
        public int Count => mapa.Count;
        public bool TryGetValue(string clave, out Neurona n) => mapa.TryGetValue(clave, out n);
        public Neurona Get(string clave) => mapa.TryGetValue(clave, out var n) ? n : null;
        public void Set(string clave, Neurona n) { if (!mapa.ContainsKey(clave)) orden.Add(clave); mapa[clave] = n; }
        public Neurona SetDefault(string clave, Func<Neurona> nueva)
        {
            if (mapa.TryGetValue(clave, out var n)) return n;
            n = nueva(); Set(clave, n); return n;
        }
        public IEnumerable<KeyValuePair<string, Neurona>> EnOrden() { foreach (var k in orden) yield return new KeyValuePair<string, Neurona>(k, mapa[k]); }
    }

    /// <summary>Una entrada del historial: un tick.</summary>
    public struct Recuerdo
    {
        public string Situacion, Accion, Firma;
        public bool Activo, Excepcion;
    }

    class Callejon
    {
        public double Lugar;
        public int Retroceso, Agotado;
        public Dictionary<string, Dictionary<string, double>> Pruebas = new Dictionary<string, Dictionary<string, double>>();
    }

    public class Nucleo
    {
        public const int DistanciaCompletado = 2;
        public const int CambiosConflicto = 3;
        public const int MaxAgotado = 2;
        public const double ToleranciaLugar = 48;
        public const double UmbralMiedo = 1;          // (aprender por concepto) un fracaso de lleno basta para temer
        public const double ExtincionMiedo = 0.9;     // cada vez que la acción temida sale bien, el miedo baja un 10 %
        public const double PesoDecepcion = 0.3;      // (decepción) lo que cuenta como fallo una recompensa esperada que no llega
        public const double UmbralHomeostasis = 0.04; // (homeostasis) cambio del impulso que se siente como bueno o malo
        public const double TramoMeta = 0.2;          // (metas) cada tramo cubierto de una meta sostenida es un logro

        public readonly IPercepcion Percepcion;
        public readonly string[] Acciones;
        public readonly string Reposo;
        public bool Completar, Separar;
        /// <summary>Modo de los instintos: null (apagados), "despues" o "antes".</summary>
        public string ModoInstintos;
        public Dictionary<string, string[]> TablaInstintos = new Dictionary<string, string[]>();
        public Dictionary<string, string[]> Prudencia = new Dictionary<string, string[]>();
        /// <summary>
        /// INSTINTO APRENDIDO: ante lo nunca visto, lo que su concepto hace casi siempre; tras fallar, prueba antes lo que
        /// más usa su concepto (ver docs/COMO-FUNCIONA.md, sección 8).
        /// </summary>
        public bool Generalizar;
        /// <summary>APRENDER POR CONCEPTO (docs/COMO-FUNCIONA.md, sección 9): un fracaso enseña al concepto entero y veta la acción.</summary>
        public bool PorConcepto;
        public Dictionary<string, Dictionary<string, double>> Miedos = new Dictionary<string, Dictionary<string, double>>();
        double? impulso;                                   // (homeostasis) el impulso de la última vez
        public string MetaNombre; public int MetaTramos;   // (metas) la meta sostenida activa (null: ninguna)
        Dictionary<string, Dictionary<string, int>> votos;   // se recalcula al empezar y al terminar cada lección

        public MapaOrdenado Neuronas = new MapaOrdenado();
        public MapaOrdenado Excepciones = new MapaOrdenado();
        readonly List<Callejon> callejones = new List<Callejon>();

        public int Ticks, Evaluaciones, Disparos;
        public List<Recuerdo> Historial = new List<Recuerdo>();
        string ultimaSituacion;
        (string accion, Neurona neurona, string firma, bool excepcion) ultimaDecision;

        public Nucleo(IPercepcion percepcion, IList<string> acciones)
        {
            Percepcion = percepcion;
            Acciones = acciones.ToArray();
            Reposo = Acciones[0];
            ReiniciarEstadisticas();
        }

        public void ReiniciarEstadisticas()
        {
            Ticks = Evaluaciones = Disparos = 0;
            Historial = new List<Recuerdo>();
            ultimaSituacion = null;
            ultimaDecision = (Reposo, null, "", false);
        }

        // ---- decidir --------------------------------------------------------------------------------------------

        /// <summary>
        /// ACTIVACIÓN DISPERSA: solo se evalúa si el cuerpo puede actuar y el estímulo cambió. `lugar` da la firma
        /// del sitio (solo se pide al evaluar). Devuelve la acción y la neurona que decidió (o null).
        /// </summary>
        public (string accion, Neurona neurona) DecidirSituacion(string situacion, bool activo, Func<string> lugar)
        {
            Ticks++;
            string accion, firma; Neurona neurona; bool excepcion;
            if (!activo) { accion = Reposo; neurona = null; firma = ""; excepcion = false; }
            else if (situacion == ultimaSituacion) (accion, neurona, firma, excepcion) = ultimaDecision;
            else
            {
                Evaluaciones++;
                firma = lugar();
                neurona = Excepciones.Get(situacion + "|" + firma);
                excepcion = neurona != null;
                if (!excepcion)
                {
                    neurona = Neuronas.Get(situacion);
                    if (neurona == null && Completar) neurona = CompletarPatron(situacion);
                }
                accion = neurona != null ? neurona.Accion : Reposo;
                if (neurona == null && Generalizar)
                {
                    string general = RespuestaDelConcepto(Percepcion.Nombrar(situacion));
                    if (general != null) accion = general;
                }
                if (neurona == null && ModoInstintos == "antes"
                    && TablaInstintos.TryGetValue(Percepcion.Nombrar(situacion), out var preferidas))
                {
                    // INSTINTO ANTE LO DESCONOCIDO: la respuesta preferida de su concepto, no el reposo
                    foreach (var a in preferidas) if (Array.IndexOf(Acciones, a) >= 0) { accion = a; break; }
                }
                if (PorConcepto && !excepcion) accion = VetoDelConcepto(neurona != null ? neurona.Concepto : Percepcion.Nombrar(situacion), accion);
                ultimaDecision = (accion, neurona, firma, excepcion);
            }
            ultimaSituacion = activo ? situacion : null;
            if (accion != Reposo) Disparos++;
            Historial.Add(new Recuerdo { Situacion = situacion, Activo = activo, Accion = accion, Firma = firma, Excepcion = excepcion });
            return (accion, neurona);
        }

        /// <summary>EL VETO DEL CONCEPTO: si la acción le ha fallado al concepto al menos UmbralMiedo, la que menos le ha fallado.</summary>
        string VetoDelConcepto(string concepto, string accion)
        {
            if (!Miedos.TryGetValue(concepto, out var miedo) || (miedo.TryGetValue(accion, out var m) ? m : 0) < UmbralMiedo) return accion;
            IList<string> orden = Acciones;
            if (Prudencia.TryGetValue(concepto, out var primeras)) { var o = new List<string>(primeras); o.AddRange(Acciones.Where(a => !primeras.Contains(a))); orden = o; }
            string mejor = null; double valor = double.NegativeInfinity;
            foreach (var a in orden) { double v = -(miedo.TryGetValue(a, out var x) ? x : 0); if (v > valor) { valor = v; mejor = a; } }
            return mejor;
        }

        // ---- la recompensa interna (homeostasis), las metas, la decepción y el repaso ------------------------------

        /// <summary>RECOMPENSA HOMEOSTÁTICA (Keramati y Gutkin 2014): 1 si el impulso bajó de golpe, -1 si subió, 0 si no.</summary>
        public int Sentir(double impulsoAhora, double umbral = UmbralHomeostasis)
        {
            var previo = impulso; impulso = impulsoAhora;
            if (previo == null) return 0;
            double r = previo.Value - impulsoAhora;
            if (r >= umbral) return 1;
            if (r <= -umbral) return -1;
            return 0;
        }

        /// <summary>META SOSTENIDA (O'Reilly y Frank 2006): fijar la misma meta otra vez no la reinicia.</summary>
        public void FijarMeta(string nombre) { if (MetaNombre != nombre) { MetaNombre = nombre; MetaTramos = 0; } }
        public void SoltarMeta() { MetaNombre = null; MetaTramos = 0; }

        /// <summary>PROGRESO POR TRAMOS (Botvinick 2009): cada tramo nuevo devuelve 1; si se pierde terreno, se recuenta.</summary>
        public int AvanzarMeta(double fraccion)
        {
            if (MetaNombre == null) return 0;
            int tramos = (int)Math.Floor(Math.Min(1.0, Math.Max(0.0, fraccion)) / TramoMeta + 1e-9);
            if (tramos > MetaTramos) { MetaTramos = tramos; return 1; }
            if (tramos < MetaTramos) MetaTramos = tramos;
            return 0;
        }

        /// <summary>ERROR DE PREDICCIÓN (Schultz): lo que solía salir bien y esta vez no da nada, un fallo pequeño.</summary>
        public string Decepcionar(double peso = PesoDecepcion) => Leccion(() =>
        {
            for (int k = Historial.Count - 1; k >= 0; k--)
            {
                var r = Historial[k];
                if (!r.Activo) continue;
                var memoria = r.Excepcion ? Excepciones : Neuronas;
                var neurona = memoria.Get(r.Excepcion ? r.Situacion + "|" + r.Firma : r.Situacion);
                if (neurona == null || neurona.AciertosDe(r.Accion) <= 0) return null;
                neurona.Fallos[r.Accion] = neurona.FallosDe(r.Accion) + peso;
                neurona.Accion = Elegir(neurona);
                return neurona.Accion;
            }
            return null;
        });

        /// <summary>REPASO (Wilson y McNaughton): decisiones de hace tiempo se repasan sabiendo cómo acabó aquello; lo que sale bien apaga además el miedo del concepto.</summary>
        public int Repasar(IList<(string situacion, string accion)> entradas, bool exito, double peso = 1.0) => Leccion(() =>
        {
            int cambiadas = 0;
            foreach (var (s, a) in entradas)
            {
                if (Array.IndexOf(Acciones, a) < 0 || Percepcion.Tranquila(s)) continue;
                var neurona = Neuronas.SetDefault(s, () => Nueva(s));
                string antes = neurona.Accion;
                if (exito)
                {
                    if (neurona.Aciertos == null) neurona.Aciertos = new Dictionary<string, double>(); neurona.Aciertos[a] = neurona.AciertosDe(a) + peso;
                    // (EXTINCIÓN POR ÉXITO: lo que sale bien al repasarlo —también el alivio— apaga el miedo del concepto, en proporción al peso)
                    if (PorConcepto && Miedos.TryGetValue(neurona.Concepto, out var miedo) && miedo.TryGetValue(a, out var m) && m != 0) miedo[a] = m * Math.Pow(ExtincionMiedo, peso);
                }
                else neurona.Fallos[a] = neurona.FallosDe(a) + peso;
                neurona.Accion = Elegir(neurona);
                if (neurona.Accion != antes) cambiadas++;
            }
            return cambiadas;
        });

        /// <summary>INVARIANCIA: la neurona general del mismo concepto que difiere en menos posiciones (hasta 2).</summary>
        Neurona CompletarPatron(string situacion)
        {
            string concepto = Percepcion.Nombrar(situacion);
            Neurona mejor = null; int distanciaMejor = DistanciaCompletado + 1;
            foreach (var kv in Neuronas.EnOrden())
            {
                if (kv.Value.Concepto != concepto) continue;
                string otra = kv.Key; int n = Math.Min(situacion.Length, otra.Length), d = 0;
                for (int i = 0; i < n; i++) if (situacion[i] != otra[i]) d++;
                if (d < distanciaMejor) { mejor = kv.Value; distanciaMejor = d; }
            }
            return mejor;
        }

        /// <summary>La acción de mejor tasa de éxito (aciertos+1)/(aciertos+fallos+2); ante empate, la primera del orden de prueba.</summary>
        public string Elegir(Neurona neurona)
        {
            IList<string> orden = Acciones;
            string concepto = neurona.Concepto;
            if (ModoInstintos != null && concepto != null && TablaInstintos.TryGetValue(concepto, out var pref))
            {
                var preferidas = pref.Where(a => Array.IndexOf(Acciones, a) >= 0).ToList();
                var o = new List<string> { Reposo }; o.AddRange(preferidas);
                o.AddRange(Acciones.Where(a => !preferidas.Contains(a) && a != Reposo));
                orden = o;
            }
            if (Generalizar)
            {
                var v = VotosDelConcepto(concepto);
                // de más a menos votadas; ante empate, en el orden de las acciones (orden estable)
                var preferidas = Acciones.Where(a => a != Reposo && v.TryGetValue(a, out int c) && c > 0)
                                         .OrderByDescending(a => v[a]).ToList();
                var o = new List<string> { Reposo }; o.AddRange(preferidas);
                // (las no votadas, en el orden de antes: el de los instintos si los hay; sin ellos, el de las acciones)
                o.AddRange(orden.Where(a => !preferidas.Contains(a) && a != Reposo));
                orden = o;
            }
            if (concepto != null && Prudencia.TryGetValue(concepto, out var primeras))
            {
                var o = new List<string> { Reposo }; o.AddRange(primeras);
                o.AddRange(Acciones.Where(a => a != Reposo && !primeras.Contains(a)));
                orden = o;
            }
            string mejor = null; double tasaMejor = double.NegativeInfinity;
            foreach (var a in orden)
            {
                double ac = neurona.AciertosDe(a);
                double t = (ac + 1) / (ac + neurona.FallosDe(a) + 2);
                if (t > tasaMejor) { tasaMejor = t; mejor = a; }
            }
            return mejor;
        }

        // ---- instinto aprendido (generalizar) ----------------------------------------------------------------------

        /// <summary>Cada lección ve el resumen de los conceptos de antes de empezar, y lo deja al día al terminar.</summary>
        T Leccion<T>(Func<T> aprender)
        {
            votos = null;
            VotosDelConcepto(null);
            T resultado = aprender();
            votos = null;
            return resultado;
        }

        /// <summary>Cuántas situaciones del concepto responden con cada acción (sus campos receptivos votan).</summary>
        Dictionary<string, int> VotosDelConcepto(string concepto)
        {
            if (votos == null)
            {
                votos = new Dictionary<string, Dictionary<string, int>>();
                if (Generalizar)
                    foreach (var kv in Neuronas.EnOrden())
                    {
                        var n = kv.Value;
                        if (!votos.TryGetValue(n.Concepto, out var v)) votos[n.Concepto] = v = new Dictionary<string, int>();
                        v[n.Accion] = (v.TryGetValue(n.Accion, out int c) ? c : 0) + 1;
                    }
            }
            return concepto != null && votos.TryGetValue(concepto, out var r) ? r : new Dictionary<string, int>();
        }

        /// <summary>Lo que el concepto hace casi siempre: la acción de al menos 3 de sus situaciones y de más de la mitad.</summary>
        string RespuestaDelConcepto(string concepto)
        {
            var v = VotosDelConcepto(concepto);
            string mejor = null; int max = 0, total = 0;
            foreach (var kv in v) { total += kv.Value; if (kv.Value > max) { max = kv.Value; mejor = kv.Key; } }
            if (mejor != null && mejor != Reposo && Array.IndexOf(Acciones, mejor) >= 0 && max >= 3 && 2 * max > total) return mejor;
            return null;
        }

        Neurona Nueva(string situacion, string accion = null, string concepto = null)
        {
            var n = new Neurona { Concepto = concepto ?? Percepcion.Nombrar(situacion), Accion = accion ?? Reposo };
            foreach (var a in Acciones) n.Fallos[a] = 0;
            return n;
        }

        /// <summary>Olvida los últimos `n` ticks del historial (el fracaso se detectó tarde: lo hecho ya muerto no cuenta).</summary>
        public void Descartar(int n)
        {
            if (n <= 0) return;
            int quitar = Math.Min(n, Historial.Count);
            Historial.RemoveRange(Historial.Count - quitar, quitar);
        }

        // ---- aprender de lo que sale bien -----------------------------------------------------------------------

        /// <summary>CONSOLIDACIÓN: lo que se dejó atrás con vida (más de `margen` ticks activos antes del final) suma un acierto.</summary>
        public void Consolidar(int margen = 20) => Leccion(() => { ConsolidarSinResumen(margen); return 0; });

        void ConsolidarSinResumen(int margen)
        {
            var finales = new HashSet<string>(); int activos = 0;
            for (int k = Historial.Count - 1; k >= 0; k--)
            {
                var r = Historial[k];
                if (!r.Activo) continue;
                activos++;
                if (activos > margen) break;
                finales.Add(r.Situacion);
            }
            var vistas = new HashSet<string>(); activos = 0;
            for (int k = Historial.Count - 1; k >= 0; k--)
            {
                var r = Historial[k];
                if (!r.Activo) continue;
                activos++;
                if (activos <= margen || finales.Contains(r.Situacion) || Percepcion.Tranquila(r.Situacion)) continue;
                var memoria = r.Excepcion ? Excepciones : Neuronas;
                string clave = r.Excepcion ? r.Situacion + "|" + r.Firma : r.Situacion;
                if (!vistas.Add(clave)) continue;
                var neurona = memoria.SetDefault(clave, () => Nueva(r.Situacion));
                if (neurona.Aciertos == null) neurona.Aciertos = new Dictionary<string, double>();
                neurona.Aciertos[r.Accion] = neurona.AciertosDe(r.Accion) + 1;
                neurona.Accion = Elegir(neurona);
                if (PorConcepto && Miedos.TryGetValue(neurona.Concepto, out var miedo) && miedo.TryGetValue(r.Accion, out var m) && m != 0) miedo[r.Accion] = m * ExtincionMiedo;
            }
        }

        /// <summary>EPISODIO SUPERADO: los conceptos generales que decidieron en la pasada ganadora quedan protegidos.</summary>
        public int Proteger() => Leccion(ProtegerSinResumen);

        int ProtegerSinResumen()
        {
            var protegidas = new HashSet<string>();
            foreach (var r in Historial)
            {
                if (!r.Activo || r.Excepcion || Percepcion.Tranquila(r.Situacion) || protegidas.Contains(r.Situacion)) continue;
                var neurona = Neuronas.SetDefault(r.Situacion, () => Nueva(r.Situacion, accion: r.Accion));
                if (neurona.Accion == r.Accion) { neurona.Protegida = true; protegidas.Add(r.Situacion); }
            }
            return protegidas.Count;
        }

        // ---- aprender de los fracasos ---------------------------------------------------------------------------

        /// <summary>
        /// PLASTICIDAD con callejones sin salida (ver docs/COMO-FUNCIONA.md, sección 5). Devuelve (concepto, situación, nueva
        /// acción, retroceso) del principal culpable, o null.
        /// </summary>
        public (string concepto, string situacion, string accion, int retroceso)? AprenderDeFracaso(double? lugar = null)
            => Leccion(() => AprenderDeFracasoSinResumen(lugar));

        (string concepto, string situacion, string accion, int retroceso)? AprenderDeFracasoSinResumen(double? lugar)
        {
            var callejon = lugar.HasValue ? CallejonDe(lugar.Value) : null;
            int ventana = 60 * (1 + (callejon != null ? callejon.Agotado : 0));
            var orden = new List<string>();
            var culpables = new Dictionary<string, string>();
            var recencia = new Dictionary<string, int>();
            var contexto = new Dictionary<string, (string firma, bool excepcion)>();
            int i = 0;
            for (int k = Historial.Count - 1; k >= 0; k--)
            {
                var r = Historial[k];
                if (!r.Activo) continue;
                if (i >= ventana) break;
                if (!Percepcion.Tranquila(r.Situacion) && !culpables.ContainsKey(r.Situacion))
                {
                    culpables[r.Situacion] = r.Accion; recencia[r.Situacion] = i; contexto[r.Situacion] = (r.Firma, r.Excepcion);
                    orden.Add(r.Situacion);
                }
                i++;
            }

            int retroceso = callejon != null ? RetrocesoEnCallejon(callejon, orden, culpables, contexto) : 0;
            if (callejon != null && orden.Count > 0 && retroceso >= orden.Count)
            {
                int agotado = callejon.Agotado + 1;
                callejon.Retroceso = 0; callejon.Pruebas.Clear(); callejon.Agotado = agotado > MaxAgotado ? 0 : agotado;
                return null;
            }
            orden = retroceso == 0 ? orden.Where(s => recencia[s] < 20).ToList() : orden.Skip(retroceso).ToList();

            for (int j = 0; j < orden.Count && j < 4; j++)
            {
                string situacion = orden[j];
                var (firma, excepcion) = contexto[situacion];
                var general = Neuronas.Get(situacion);
                if (!excepcion && general != null && (general.Protegida || Separar && general.Conflicto))
                {
                    // SEPARACIÓN DE PATRONES: la corrección se guarda solo para este lugar
                    excepcion = true;
                    Excepciones.SetDefault(situacion + "|" + firma, () => Nueva(situacion, accion: general.Accion, concepto: general.Concepto));
                }
                var memoria = excepcion ? Excepciones : Neuronas;
                var neurona = memoria.SetDefault(excepcion ? situacion + "|" + firma : situacion, () => Nueva(situacion));
                string antes = neurona.Accion, culpable = culpables[situacion];
                neurona.Fallos[culpable] = neurona.FallosDe(culpable) + Math.Pow(0.5, j);
                if (PorConcepto)
                {
                    if (!Miedos.TryGetValue(neurona.Concepto, out var miedo)) Miedos[neurona.Concepto] = miedo = new Dictionary<string, double>();
                    miedo[culpable] = (miedo.TryGetValue(culpable, out var m) ? m : 0) + Math.Pow(0.5, j);
                }
                neurona.Accion = Elegir(neurona);
                if (Separar && !excepcion && lugar.HasValue && neurona.Accion != antes)
                {
                    if (neurona.SitiosCambio == null) neurona.SitiosCambio = new List<int>();
                    neurona.SitiosCambio.Add((int)Math.Round(lugar.Value / ToleranciaLugar));
                    if (neurona.SitiosCambio.Count >= CambiosConflicto && neurona.SitiosCambio.Distinct().Count() >= 2)
                        neurona.Conflicto = true;
                }
            }
            if (orden.Count == 0) return null;
            var principal = Neuronas.Get(orden[0]);
            return (principal.Concepto, orden[0], principal.Accion, retroceso);
        }

        Callejon CallejonDe(double lugar)
        {
            var c = callejones.FirstOrDefault(x => Math.Abs(x.Lugar - lugar) <= ToleranciaLugar);
            if (c == null) { c = new Callejon { Lugar = lugar }; callejones.Add(c); }
            return c;
        }

        /// <summary>Cuántas veces se agotaron todas las situaciones recordadas en ese sitio.</summary>
        public int Agotado(double lugar) => CallejonDe(lugar).Agotado;

        int RetrocesoEnCallejon(Callejon callejon, List<string> orden, Dictionary<string, string> culpables,
                                Dictionary<string, (string firma, bool excepcion)> contexto)
        {
            double lugar = callejon.Lugar;
            foreach (var s in orden)
            {
                if (!callejon.Pruebas.TryGetValue(s, out var p)) callejon.Pruebas[s] = p = new Dictionary<string, double>();
                string a = culpables[s];
                p[a] = Math.Max(p.TryGetValue(a, out var v) ? v : lugar, lugar);
            }
            while (callejon.Retroceso < orden.Count)
            {
                string s = orden[callejon.Retroceso];
                var pruebas = callejon.Pruebas[s];
                if (!Acciones.All(pruebas.ContainsKey)) break;
                // agotada: se fija la acción que más lejos llegó COMO EXCEPCIÓN DE ESTE LUGAR
                string mejor = null; double lejos = double.NegativeInfinity;
                foreach (var a in Acciones) if (pruebas[a] > lejos) { lejos = pruebas[a]; mejor = a; }
                var n = new Neurona { Concepto = Percepcion.Nombrar(s), Accion = mejor };
                foreach (var a in Acciones) n.Fallos[a] = a == mejor ? 0 : 0.01;
                Excepciones.Set(s + "|" + contexto[s].firma, n);
                callejon.Retroceso++;
            }
            return callejon.Retroceso;
        }
    }
}
