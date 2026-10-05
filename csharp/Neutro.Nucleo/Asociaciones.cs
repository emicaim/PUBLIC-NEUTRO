// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 FOKO SOFT (Emilio Martinez) — Neutro, https://github.com/emicaim/PUBLIC-NEUTRO
// ASOCIACIONES (memoria de sucesos) en C#: la misma pieza que Asociaciones en python/neutro/nucleo.py y js/src/asociaciones.js,
// con las mismas fórmulas y el mismo orden (lo comprueba la prueba cruzada). Ver la explicación en la versión de Python.
using System;
using System.Collections.Generic;
using System.Linq;

namespace Neutro
{
    public class Vinculo
    {
        public string A, B;
        public double Peso, Previa, Veces;
        public double? Retardo;   // cuánto tarda B tras A (media móvil; Gallistel y Gibbon)
    }

    public class Asociaciones
    {
        public const double UmbralPrediccion = 0.3;
        public const double CastigoSorpresa = 0.5;
        public const double UmbralOlvido = 0.3;
        public const double DescuentoInferencia = 0.8;

        public readonly double Ventana, VentanaValencia;
        public readonly int Capacidad;
        // (los vínculos guardan el orden en que nacieron, como los diccionarios de Python y los Map de JavaScript)
        readonly Dictionary<string, Vinculo> vinculos = new Dictionary<string, Vinculo>();
        readonly List<string> orden = new List<string>();
        public Dictionary<string, double> Frecuencias = new Dictionary<string, double>();
        public Dictionary<string, double> Valencia = new Dictionary<string, double>();
        public List<(string que, double cuando)> Recientes = new List<(string, double)>();
        public List<(string causa, string efecto, double hasta)> Esperando = new List<(string, string, double)>();
        List<(string que, double cuando, double impulso)> pendientes = new List<(string, double, double)>();
        double? impulso;
        public int Cumplidas, Sorpresas;
        public double Tiempo;
        double? ultimo;

        public Asociaciones(double ventana, int capacidad = 120, double ventanaValencia = 80)
        {
            Ventana = ventana; Capacidad = capacidad; VentanaValencia = ventanaValencia;
        }

        public IEnumerable<Vinculo> Vinculos() { foreach (var k in orden) yield return vinculos[k]; }
        public Vinculo Vinculo(string a, string b) => vinculos.TryGetValue(a + "→" + b, out var v) ? v : null;

        Vinculo VinculoNuevo(string a, string b)
        {
            string k = a + "→" + b;
            if (!vinculos.TryGetValue(k, out var v)) { v = new Vinculo { A = a, B = b }; vinculos[k] = v; orden.Add(k); }
            return v;
        }

        void Pasar(double ahora)
        {
            if (ultimo.HasValue && ahora > ultimo.Value) Tiempo += ahora - ultimo.Value;
            ultimo = ahora;
        }

        /// <summary>Algo ha pasado. Devuelve las expectativas que se han cumplido [(causa, efecto)].</summary>
        public List<(string causa, string efecto)> Suceso(string que, double ahora)
        {
            if (impulso.HasValue) pendientes.Add((que, ahora, impulso.Value));
            Pasar(ahora);
            var cumplidas = new List<(string, string)>();
            for (int i = Esperando.Count - 1; i >= 0; i--)
                if (Esperando[i].efecto == que) { Cumplidas++; cumplidas.Add((Esperando[i].causa, que)); Esperando.RemoveAt(i); }
            Recientes = Recientes.Where(r => ahora - r.cuando <= Ventana).ToList();
            foreach (var (antes, t) in Recientes)
            {
                if (antes == que) continue;
                var v = VinculoNuevo(antes, que);
                v.Peso += 1; v.Previa += 1; v.Veces += 1;
                v.Retardo = v.Retardo == null ? ahora - t : v.Retardo.Value * 0.8 + (ahora - t) * 0.2;
            }
            Recientes.Add((que, ahora));
            Frecuencias[que] = (Frecuencias.TryGetValue(que, out var f) ? f : 0) + 1;
            foreach (var v in Vinculos())
            {
                if (v.A != que || v.Veces < 2 || Fuerza(v.A, v.B) < UmbralPrediccion) continue;
                if (Esperando.Any(e => e.efecto == v.B)) continue;
                Esperando.Add((que, v.B, ahora + Ventana));
            }
            return cumplidas;
        }

        /// <summary>Lo esperado que no llegó a tiempo: sorpresas [(causa, efecto)].</summary>
        public List<(string causa, string efecto)> Vigilar(double ahora)
        {
            Pasar(ahora);
            var sorprendidos = new List<(string, string)>();
            for (int i = Esperando.Count - 1; i >= 0; i--)
            {
                var (causa, efecto, hasta) = Esperando[i];
                if (ahora <= hasta) continue;
                Esperando.RemoveAt(i);
                Sorpresas++;
                var v = Vinculo(causa, efecto);
                if (v != null) v.Peso = Math.Max(0, v.Peso - CastigoSorpresa);
                sorprendidos.Add((causa, efecto));
            }
            return sorprendidos;
        }

        public double Fuerza(string a, string b)
        {
            var v = Vinculo(a, b);
            if (v == null) return 0;
            double fa = Frecuencias.TryGetValue(a, out var x) ? x : 1, fb = Frecuencias.TryGetValue(b, out var y) ? y : 1;
            return v.Peso / Math.Pow(Math.Max(1, fa) * Math.Max(1, fb), 0.5);
        }

        /// <summary>APRENDER VIENDO A OTROS (Olsson y Phelps 2007): lo que le pasó a otro tras `contexto`, con `peso`.</summary>
        public void Observar(IEnumerable<string> contexto, string que, double peso = 0.5)
        {
            foreach (var antes in contexto)
            {
                if (antes == que) continue;
                var v = VinculoNuevo(antes, que);
                v.Peso += peso; v.Previa += peso; v.Veces += peso;
            }
            Frecuencias[que] = (Frecuencias.TryGetValue(que, out var f) ? f : 0) + peso;
        }

        /// <summary>VALENCIA: de cada suceso de hace al menos VentanaValencia, cómo cambió el impulso desde entonces.</summary>
        public void Sentir(double impulsoAhora, double ahora)
        {
            impulso = impulsoAhora;
            var quedan = new List<(string, double, double)>();
            foreach (var (que, cuando, antes) in pendientes)
            {
                if (ahora - cuando < VentanaValencia) { quedan.Add((que, cuando, antes)); continue; }
                double v = Valencia.TryGetValue(que, out var x) ? x : 0;
                Valencia[que] = v + 0.2 * ((impulsoAhora - antes) - v);
            }
            pendientes = quedan.Count > 400 ? quedan.Skip(quedan.Count - 400).ToList() : quedan;
        }

        /// <summary>INFERENCIA TRANSITIVA (Eichenbaum): A trae B y B trae C, luego A trae C.</summary>
        public double Inferida(string a, string c)
        {
            if (a == c) return 0;
            double mejor = 0;
            foreach (var v in Vinculos())
            {
                if (v.A != a || v.B == c || v.Veces < 2) continue;
                double f1 = Fuerza(a, v.B);
                if (f1 < UmbralPrediccion) continue;
                var w = Vinculo(v.B, c);
                if (w == null || w.Veces < 2) continue;
                double f2 = Fuerza(v.B, c);
                if (f2 < UmbralPrediccion) continue;
                mejor = Math.Max(mejor, Math.Min(f1, f2) * DescuentoInferencia);
            }
            return mejor;
        }

        public double Requisito(string a, string b, double minimoVeces = 2)
        {
            var v = Vinculo(a, b);
            double vecesB = Frecuencias.TryGetValue(b, out var x) ? x : 0;
            if (v == null || v.Veces < minimoVeces || vecesB <= 0) return 0;
            double tiempo = Math.Max(Ventana, Tiempo);
            double azar = Math.Min(1, (Frecuencias.TryGetValue(a, out var y) ? y : 0) * Ventana / tiempo);
            return Math.Min(1, v.Previa / vecesB) - azar;
        }

        public void Olvidar(double olvido)
        {
            double factor = Math.Pow(olvido, 0.5);
            foreach (var k in orden.ToList())
            {
                var v = vinculos[k];
                v.Peso *= factor; v.Previa *= factor;
                if (v.Peso < UmbralOlvido && v.Previa < UmbralOlvido) { vinculos.Remove(k); orden.Remove(k); }
            }
            foreach (var k in Frecuencias.Keys.ToList()) Frecuencias[k] *= factor;
            Tiempo *= factor;
            if (vinculos.Count > Capacidad)
                foreach (var k in orden.OrderBy(k => vinculos[k].Peso).Take(vinculos.Count - Capacidad).ToList()) { vinculos.Remove(k); orden.Remove(k); }
        }
    }
}
