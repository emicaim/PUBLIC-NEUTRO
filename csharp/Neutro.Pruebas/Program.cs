// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 FOKO SOFT (Emilio Martinez) — Neutro, https://github.com/emicaim/PUBLIC-NEUTRO
// PRUEBA CRUZADA: el núcleo en C# tiene que dar exactamente lo mismo que el de Python y el de JavaScript.
//
//     dotnet run --project csharp/Neutro.Pruebas -c Release > c.txt
//     python pruebas/cruzado.py > p.txt ;  node pruebas/cruzado.mjs > j.txt
//     python pruebas/comparar.py p.txt c.txt ;  python pruebas/comparar.py p.txt j.txt
using System;
using System.Collections.Generic;
using System.Linq;
using Neutro;

static class Program
{
    static int Main() { Cruzado.Correr(); return 0; }
}

/// <summary>
/// PRUEBA CRUZADA de lo nuevo del núcleo (aprender por concepto, homeostasis, metas, decepción, repaso) y de la memoria
/// de sucesos: la misma secuencia que pruebas/cruzado.py y pruebas/cruzado.mjs. Se compara con pruebas/comparar.py.
/// </summary>
static class Cruzado
{
    class Percep : IPercepcion
    {
        public string Nombrar(string s) => s.Split(' ')[0];
        public bool Tranquila(string s) => s.StartsWith("calma");
    }
    static readonly System.Globalization.CultureInfo CI = System.Globalization.CultureInfo.InvariantCulture;
    static string Num(double v) => v.ToString("R", CI);

    public static void Correr()
    {
        long estado = 12345;
        int azar(int n) { estado = (estado * 1103515245L + 12345L) % 2147483648L; return (int)(estado % n); }
        var acciones = new[] { "instinto", "evitar", "atacar", "comer", "esperar" };
        for (int caso = 0; caso < 2; caso++)
        {
            bool gen = caso == 1;
            var n = new Nucleo(new Percep(), acciones) { PorConcepto = true, Generalizar = gen };
            if (gen) n.Prudencia = new Dictionary<string, string[]> { ["lobo"] = new[] { "evitar", "atacar" } };
            var conceptos = new[] { "lobo", "hambre", "calma", "bayas" };
            var salida = new List<string>();
            for (int paso = 0; paso < 6000; paso++)
            {
                string s = $"{conceptos[azar(4)]} x{azar(6)} y{azar(3)}";
                bool activo = azar(10) > 0;
                var (accion, _) = n.DecidirSituacion(s, activo, () => azar(5).ToString());
                salida.Add(accion);
                salida.Add("S" + n.Sentir(azar(100) / 100.0));
                int r2 = azar(50);
                if (r2 == 0) n.FijarMeta(new[] { "reserva", "otra" }[azar(2)]);
                else if (r2 == 1) n.SoltarMeta();
                else salida.Add("M" + n.AvanzarMeta(azar(101) / 100.0));
                int r = azar(100);
                if (r < 4)
                {
                    var res = n.AprenderDeFracaso(null);
                    salida.Add("F" + (res == null ? "null" : $"{res.Value.concepto}|{res.Value.situacion}|{res.Value.accion}|{res.Value.retroceso}"));
                    n.ReiniciarEstadisticas();
                }
                else if (r < 10) { n.Consolidar(azar(3)); n.ReiniciarEstadisticas(); }
                else if (r < 14 && gen) { salida.Add("D" + (n.Decepcionar() ?? "None")); n.ReiniciarEstadisticas(); }
                else if (r < 16 && gen)
                {
                    var entradas = new List<(string, string)>();
                    for (int k = 0; k < 3; k++) { string c = conceptos[azar(4)]; int x = azar(6), y = azar(3); entradas.Add(($"{c} x{x} y{y}", acciones[azar(5)])); }
                    bool exito = azar(2) == 1;
                    salida.Add("R" + n.Repasar(entradas, exito, 0.5));
                    n.ReiniciarEstadisticas();
                }
            }
            Console.WriteLine(string.Join(" ", salida));
            var m = n.Miedos.OrderBy(k => k.Key, StringComparer.Ordinal).Select(k => $"\"{k.Key}\": {{" + string.Join(", ", k.Value.OrderBy(a => a.Key, StringComparer.Ordinal).Select(a => $"\"{a.Key}\": {Num(Math.Round(a.Value, 5))}")) + "}");
            Console.WriteLine("{" + string.Join(", ", m) + "}");
            var ns = n.Neuronas.EnOrden().OrderBy(k => k.Key, StringComparer.Ordinal).Select(k => $"\"{k.Key}\": \"{k.Value.Accion}\"");
            Console.WriteLine("{" + string.Join(", ", ns) + "}");
        }
        // la memoria de sucesos
        var asoc = new Asociaciones(10, 40);
        long est = 777;
        var sucesos = new[] { "lluvia", "langosta", "hambre", "calma", "frio", "fuego" };
        var sal = new List<string>();
        for (int t = 0; t < 3000; t++)
        {
            est = (est * 1103515245L + 12345L) % 2147483648L;
            var c = asoc.Suceso(sucesos[est % 6], t);
            if (c.Count > 0) sal.Add("C" + string.Join("/", c.Select(x => $"{x.causa}>{x.efecto}")));
            asoc.Sentir((est % 97) / 97.0, t);
            if (t % 7 == 0) asoc.Observar(new[] { sucesos[(est / 7) % 6], sucesos[(est / 11) % 6] }, sucesos[(est / 13) % 6], 0.5);
            if (t % 50 == 0)
            {
                asoc.Vigilar(t);
                var v = asoc.Vinculo("lluvia", "hambre");
                string f(double x) => x.ToString("F6", CI);
                sal.Add($"{f(v?.Retardo ?? 0)}|{f(asoc.Valencia.TryGetValue("langosta", out var vl) ? vl : 0)}|{f(asoc.Inferida("lluvia", "hambre"))}|{f(asoc.Inferida("frio", "fuego"))}|{f(asoc.Inferida("calma", "langosta"))}");
            }
        }
        Console.WriteLine(string.Join(" ", sal));
    }
}
