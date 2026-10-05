// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 FOKO SOFT (Emilio Martinez) — Neutro, https://github.com/emicaim/PUBLIC-NEUTRO
// FASE 0 DE NEUTRO LAB: el agente general en un Bosque de consola, antes de poner un solo asset.
//
// El mismo Bosque que la parcela 1 de Unity, en 2D y sin gráficos: 40 × 40 m, frutales que se agotan y rebrotan, un
// lobo que duerme de día en su guarida y caza de noche, y una cueva donde no entra. El agente solo recibe su cuerpo
// (energía y salud), lo que ve (tipo, distancia, dirección) y la señal «oscuro»; nadie le dice qué es cada cosa.
//
//     dotnet run --project csharp/Neutro.Ejemplos -c Release -- [semillas] [vidas]
//
// Compara tres agentes con las mismas semillas: Neutro (núcleo + memoria de sucesos + lo innato), «sin núcleo» (lo
// innato y la memoria de sucesos, sin aprender acciones) y azar. El cerebro se conserva de una vida a la siguiente: la
// curva de aprendizaje es la duración de cada vida.
using System;
using System.Collections.Generic;
using System.Linq;
using Neutro.General;

static class LabBosque
{
    public static void Correr(string[] args)
    {
        int semillas = args.Length > 1 ? int.Parse(args[1]) : 10;
        int vidas = args.Length > 2 ? int.Parse(args[2]) : 20;
        if (args.Contains("--lobo-manso")) { MundoBosque.VelLobo = 1.5; MundoBosque.Mordisco = 0.35; }
        MundoBosque.SoloLoEsperado = args.Contains("--solo-esperado");
        MundoBosque.SinAtencion = args.Contains("--sin-atencion");
        MundoBosque.PorCausa = !args.Contains("--culpa-normal");
        MundoBosque.SinDefensa = args.Contains("--sin-defensa");
        var modos = args.Contains("--oraculos") ? new[] { "neutro", "sinnucleo", "azar", "oraculo-huir", "oraculo-cueva" } : new[] { "neutro", "sinnucleo", "azar" };
        var res = new Dictionary<string, List<MundoBosque.Vida[]>>();
        foreach (var modo in modos)
        {
            res[modo] = new List<MundoBosque.Vida[]>();
            for (int s = 1; s <= semillas; s++) res[modo].Add(new MundoBosque(s, modo).Vivir(vidas));
        }

        Console.WriteLine($"BOSQUE · {semillas} semillas × {vidas} vidas (vida máxima {MundoBosque.VidaMaxima / 60:0} min)\n");
        int q = Math.Max(1, vidas / 4);
        Console.WriteLine($"{"agente",-10} {"vida (s) prim." + q,16} {"últ." + q,10} {"fruta/min",10} {"mordiscos/vida",15} {"muere de hambre",16} {"de lobo",8}");
        foreach (var modo in modos)
        {
            var r = res[modo];
            double Prim(Func<MundoBosque.Vida, double> f) => r.Average(v => v.Take(q).Average(f));
            double Ult(Func<MundoBosque.Vida, double> f) => r.Average(v => v.Skip(vidas - q).Average(f));
            var todas = r.SelectMany(v => v).ToList();
            Console.WriteLine($"{modo,-10} {Prim(v => v.Duracion),16:0} {Ult(v => v.Duracion),10:0} {todas.Sum(v => v.Frutas) / (todas.Sum(v => v.Duracion) / 60),10:0.00} {todas.Average(v => v.Mordiscos),15:0.00} {todas.Count(v => v.Causa == "hambre") * 100.0 / todas.Count,15:0}% {todas.Count(v => v.Causa == "lobo") * 100.0 / todas.Count,7:0}%");
        }

        // diferencias emparejadas por semilla, con intervalo de confianza al 95 % (t de Student)
        Console.WriteLine("\nDiferencias en la duración de las últimas vidas, emparejadas por semilla (IC 95 %):");
        foreach (var (a, b) in new[] { ("neutro", "azar"), ("neutro", "sinnucleo"), ("sinnucleo", "azar"), ("oraculo-huir", "sinnucleo"), ("oraculo-cueva", "sinnucleo") }.Where(x => res.ContainsKey(x.Item1)))
        {
            var d = Enumerable.Range(0, semillas).Select(i => res[a][i].Skip(vidas - q).Average(v => v.Duracion) - res[b][i].Skip(vidas - q).Average(v => v.Duracion)).ToList();
            var (m, ic) = MediaIC(d);
            Console.WriteLine($"  {a} − {b}: {m:+0;-0} s ± {ic:0}");
        }
        Console.WriteLine("\nAprendizaje dentro de Neutro (últimas − primeras vidas, emparejado):");
        {
            var d = res["neutro"].Select(v => v.Skip(vidas - q).Average(x => x.Duracion) - v.Take(q).Average(x => x.Duracion)).ToList();
            var (m, ic) = MediaIC(d);
            Console.WriteLine($"  {m:+0;-0} s ± {ic:0}");
        }

        // lo que aprendió un Neutro (semilla 1): ver la mente
        var mundo = new MundoBosque(1, "neutro"); mundo.Vivir(vidas);
        var ag = mundo.Agente;
        Console.WriteLine("\nLa mente de Neutro (semilla 1) al final:");
        for (int j = 0; j < ag.Variables.Length; j++)
            Console.WriteLine($"  cuánto alivia {ag.Variables[j]} consumir: " + string.Join(", ", ag.Tipos.Select(t => (t, v: ag.ValorDeConsumir(t, j))).Where(x => !double.IsNaN(x.v)).Select(x => $"{x.t} {x.v:+0.000;-0.000}")));
        Console.WriteLine("  cómo queda el cuerpo cuando aparece cerca: " + string.Join(", ", ag.Tipos.Select(t => $"{t} {ag.ValorDeCerca(t):+0.000;-0.000}")));
        Console.WriteLine("  miedos por concepto: " + string.Join("; ", ag.Nucleo.Miedos.Select(kv => kv.Key + ": " + string.Join(", ", kv.Value.Where(x => x.Value >= 0.5).Select(x => $"{x.Key} {x.Value:0.0}")))));
        Console.WriteLine($"  alivios: {ag.Alivios}, miedos condicionados: {ag.MiedosCondicionados}, buenas/malas: {ag.Buenas}/{ag.Malas}");
        Console.WriteLine($"  neuronas: {ag.Nucleo.Neuronas.Count}; lo que hace cada concepto (votos):");
        foreach (var g in ag.Nucleo.Neuronas.EnOrden().GroupBy(kv => kv.Value.Concepto))
            Console.WriteLine($"    {g.Key}: " + string.Join(", ", g.GroupBy(kv => kv.Value.Accion).OrderByDescending(x => x.Count()).Select(x => $"{x.Key} ×{x.Count()}")));
    }

    static (double media, double ic) MediaIC(List<double> d)
    {
        int n = d.Count; double m = d.Average();
        if (n < 2) return (m, 0);
        double sd = Math.Sqrt(d.Sum(x => (x - m) * (x - m)) / (n - 1));
        double[] t = { 0, 12.71, 4.30, 3.18, 2.78, 2.57, 2.45, 2.36, 2.31, 2.26, 2.23, 2.20, 2.18, 2.16, 2.14, 2.13, 2.12, 2.11, 2.10, 2.09, 2.09 };
        return (m, (n - 1 < t.Length ? t[n - 1] : 1.96) * sd / Math.Sqrt(n));
    }
}

/// <summary>El Bosque en 2D. Las mismas cifras que tendrá la parcela de Unity.</summary>
class MundoBosque
{
    public const double Tam = 40, Dt = 0.5, Vel = 1.5;
    public static double VelLobo = 1.8, Mordisco = 0.5;   // de noche el lobo corre algo más que el agente: huir pronto o esconderse
    public const double VidaMaxima = 1200;            // 20 minutos
    const double Dia = 120, Noche = 60;               // un día de 3 minutos
    const double GastoEnergia = 1.0 / 240;            // sin comer, 4 minutos de vida
    const double Fruta = 0.3, RadioConsumir = 2.2, Rebrote = 120, Bocado = 2;   // una fruta cada 2 s
    const double Cura = 0.004;                        // salud: lo que se cura por segundo bien comido
    const double RadioCueva = 3, RadioPersecucion = 15, PersecucionMax = 20, DescansoLobo = 30;

    public struct Vida { public double Duracion; public int Frutas, Mordiscos; public string Causa; }

    class Frutal { public double X, Z; public int Frutas = 4; public List<double> Rebrotes = new List<double>(); }

    readonly Random rnd;
    readonly string modo;
    public AgenteGeneral Agente;
    readonly List<string> buffer = new List<string>();
    public static bool SoloLoEsperado, SinAtencion, PorCausa, SinDefensa;
    public static bool Traza3 = Environment.GetEnvironmentVariable("NEUTRO_TRAZA") == "3";
    public static bool Traza2 = Environment.GetEnvironmentVariable("NEUTRO_TRAZA") == "2";
    public static bool Traza = Environment.GetEnvironmentVariable("NEUTRO_TRAZA") == "1";
    readonly List<Frutal> frutales = new List<Frutal>();
    readonly List<(string tipo, double x, double z)> fijos = new List<(string, double, double)>();
    double cuevaX = -14, cuevaZ = 13, guaridaX = 14, guaridaZ = -13;

    double t, ax, az, energia, salud, rumbo, cambioRumbo;
    double lx, lz, loboDescansa, persigueDesde = -1, proximoBocado;
    Vida vida;
    string accionAzar; double hastaAzar;

    public static readonly string[] Tipos = { "fruta", "árbol", "arbusto", "roca", "tronco", "cueva", "lobo" };

    public MundoBosque(int semilla, string modo)
    {
        rnd = new Random(semilla * 7919 + 13); this.modo = modo;
        Agente = new AgenteGeneral(Tipos, new[] { "energía", "salud" }, new[] { "oscuro" }, Vel, semilla);
        if (modo == "sinnucleo" || modo.StartsWith("oraculo")) Agente.Aprende = false;
        Agente.SoloLoEsperado = SoloLoEsperado;
        Agente.Atencion = !SinAtencion;
        Agente.PorCausa = PorCausa;
        Agente.Defensa = !SinDefensa;
        // el mismo reparto que el constructor de la escena: claro en el centro, cueva y guarida en esquinas opuestas
        var ocupado = new List<(double x, double z, double r)> { (0, 0, 5), (cuevaX, cuevaZ, 5), (guaridaX, guaridaZ, 4) };
        (double, double)? Hueco(double r, double margen)
        {
            for (int k = 0; k < 60; k++)
            {
                double x = R(-Tam / 2 + margen, Tam / 2 - margen), z = R(-Tam / 2 + margen, Tam / 2 - margen);
                if (ocupado.All(o => (o.x - x) * (o.x - x) + (o.z - z) * (o.z - z) > (o.r + r) * (o.r + r))) { ocupado.Add((x, z, r)); return (x, z); }
            }
            return null;
        }
        for (int k = 0; k < 7; k++) if (Hueco(2.5, 4) is (double x, double z)) frutales.Add(new Frutal { X = x, Z = z });
        void Varios(string tipo, int n, double r, double margen) { for (int k = 0; k < n; k++) if (Hueco(r, margen) is (double x, double z)) fijos.Add((tipo, x, z)); }
        Varios("árbol", 26, 2.2, 3); Varios("arbusto", 16, 1.2, 2); Varios("roca", 9, 1.6, 1.5); Varios("tronco", 3, 2, 3);
        fijos.Add(("cueva", cuevaX, cuevaZ));
    }

    double R(double a, double b) => a + rnd.NextDouble() * (b - a);
    bool EsNoche => t % (Dia + Noche) >= Dia;
    bool EnCueva => Dist(ax, az, cuevaX, cuevaZ) < RadioCueva;
    static double Dist(double x1, double z1, double x2, double z2) => Math.Sqrt((x1 - x2) * (x1 - x2) + (z1 - z2) * (z1 - z2));

    public Vida[] Vivir(int vidas)
    {
        var r = new Vida[vidas];
        for (int i = 0; i < vidas; i++) r[i] = UnaVida();
        return r;
    }

    Vida UnaVida()
    {
        double inicio = t;
        ax = 0; az = -1; energia = 1; salud = 1; lx = guaridaX - 2.5; lz = guaridaZ + 2.5; loboDescansa = 0; persigueDesde = -1;
        foreach (var f in frutales) { f.Frutas = 4; f.Rebrotes.Clear(); }
        vida = new Vida();
        while (true)
        {
            Intencion i = modo == "azar" ? Azar() : Agente.Paso(Observar());
            // (ORÁCULOS, escritos a mano solo para medir el techo: lo innato más huir del lobo, o esconderse de noche)
            if (modo == "oraculo-huir" && EsNoche && Dist(ax, az, lx, lz) < RadioPersecucion) i = new Intencion { Verbo = "huir", Tipo = "lobo" };
            if (modo == "oraculo-cueva" && EsNoche && !EnCueva) i = new Intencion { Verbo = "ir", Tipo = "cueva" };
            if (modo == "oraculo-cueva" && EsNoche && EnCueva) i = new Intencion { Verbo = "esperar" };
            if (Traza && i.Verbo == "consumir") Console.WriteLine($"t={t:0.0} consumir {i.Tipo} energía={energia:0.00} salud={salud:0.00} acción={Agente.Accion} val={Agente.ValorDeConsumir("fruta", 0):0.000}/{Agente.ValorDeConsumir("fruta", 1):0.000}");
            Ejecutar(i);
            Mundo();
            t += Dt;
            vida.Duracion = t - inicio;
            if ((Traza2 || Traza3) && modo == "neutro") { buffer.Add($"  t={vida.Duracion:0} e={energia:0.00} s={salud:0.00} [{Agente.Situacion}] {Agente.Concepto} → {Agente.Accion}{(Agente.Exploro ? "*" : "")} = {i} (foco {Agente.Foco}) lobo a {Dist(ax, az, lx, lz):0.0} m"); if (buffer.Count > 30) buffer.RemoveAt(0); }
            if (energia <= 0) { vida.Causa = "hambre"; if (Traza2 && modo == "neutro") { Console.WriteLine("MUERE DE HAMBRE:"); buffer.ForEach(Console.WriteLine); } break; }
            if (salud <= 0) { vida.Causa = "lobo"; break; }
            if (vida.Duracion >= VidaMaxima) { vida.Causa = "vive"; break; }
        }
        // (la última lección de cada vida: morir es el peor cambio del cuerpo)
        if (modo != "azar" && !modo.StartsWith("oraculo")) Agente.Paso(Observar());
        t += 600;   // (entre vida y vida pasa tiempo: la memoria de sucesos no une la muerte con la vida siguiente)
        return vida;
    }

    Intencion Azar()
    {
        if (t >= hastaAzar)
        {
            var acc = Agente.Acciones.Where(a => a != "instinto").ToArray();
            accionAzar = acc[rnd.Next(acc.Length)]; hastaAzar = t + 2;
        }
        // (el azar no tiene concepto: acercarse o alejarse de lo más cercano)
        var obs = Observar();
        string lado = obs.Objetos.Where(o => o.Distancia <= Vel).OrderBy(o => o.Distancia).Select(o => o.Tipo).FirstOrDefault();
        string cerca = obs.Objetos.OrderBy(o => o.Distancia).Select(o => o.Tipo).FirstOrDefault();
        switch (accionAzar)
        {
            case "consumir": return new Intencion { Verbo = "consumir", Tipo = lado };
            case "acercarse": return new Intencion { Verbo = "ir", Tipo = cerca };
            case "alejarse": return new Intencion { Verbo = "huir", Tipo = cerca };
            default: return new Intencion { Verbo = accionAzar };
        }
    }

    Observacion Observar()
    {
        var o = new Observacion { Tiempo = t };
        o.Cuerpo.Add(new Variable("energía", Math.Max(0, energia)));
        o.Cuerpo.Add(new Variable("salud", Math.Max(0, salud)));
        if (EsNoche) o.Senales.Add("oscuro");
        double alcance = AgenteGeneral.Distancias[2] * Vel;
        void Ver(string tipo, double x, double z)
        {
            double d = Dist(ax, az, x, z);
            if (d > alcance) return;
            o.Objetos.Add(new Percibido(tipo, d, d > 1e-6 ? (x - ax) / d : 0, d > 1e-6 ? (z - az) / d : 0));
        }
        // (un frutal sin fruta se ve como un árbol más)
        foreach (var f in frutales) Ver(f.Frutas > 0 ? "fruta" : "árbol", f.X, f.Z);
        foreach (var (tipo, x, z) in fijos) Ver(tipo, x, z);
        Ver("lobo", lx, lz);
        return o;
    }

    void Ejecutar(Intencion i)
    {
        (double x, double z)? Cercano(string tipo)
        {
            var obs = Observar().Objetos.Where(p => p.Tipo == tipo).OrderBy(p => p.Distancia).ToList();
            if (obs.Count == 0) return null;
            return (obs[0].DirX, obs[0].DirZ);
        }
        switch (i.Verbo)
        {
            case "ir": if (i.Tipo != null && Cercano(i.Tipo) is (double x1, double z1)) Mover(x1, z1, Vel); break;
            case "huir": if (i.Tipo != null && Cercano(i.Tipo) is (double x2, double z2)) Mover(-x2, -z2, Vel); break;
            case "explorar":
                if (t >= cambioRumbo) { rumbo = R(0, Math.PI * 2); cambioRumbo = t + R(3, 8); }
                Mover(Math.Cos(rumbo), Math.Sin(rumbo), Vel);
                if (Math.Abs(ax) >= Tam / 2 - 0.5 || Math.Abs(az) >= Tam / 2 - 0.5) rumbo = Math.Atan2(-az, -ax);
                break;
            case "consumir":
                if (i.Tipo == "fruta" && t >= proximoBocado)
                {
                    var f = frutales.Where(x => x.Frutas > 0).OrderBy(x => Dist(ax, az, x.X, x.Z)).FirstOrDefault();
                    if (f != null && Dist(ax, az, f.X, f.Z) <= RadioConsumir)
                    {
                        f.Frutas--; f.Rebrotes.Add(t + Rebrote); proximoBocado = t + Bocado;
                        energia = Math.Min(1, energia + Fruta); vida.Frutas++;
                    }
                }
                break;
        }
    }

    void Mover(double dx, double dz, double v)
    {
        double n = Math.Sqrt(dx * dx + dz * dz); if (n < 1e-9) return;
        ax = Math.Max(-Tam / 2, Math.Min(Tam / 2, ax + dx / n * v * Dt));
        az = Math.Max(-Tam / 2, Math.Min(Tam / 2, az + dz / n * v * Dt));
    }

    void Mundo()
    {
        energia -= GastoEnergia * Dt;
        if (energia > 0.3) salud = Math.Min(1, salud + Cura * Dt);
        foreach (var f in frutales)
            for (int k = f.Rebrotes.Count - 1; k >= 0; k--)
                if (t >= f.Rebrotes[k]) { f.Rebrotes.RemoveAt(k); f.Frutas++; }

        // EL LOBO: de día duerme en la guarida (muerde a quien se acerca a menos de 3 m); de noche caza a quien vea a
        // menos de 15 m, salvo dentro de la cueva. Tras morder, o tras 20 s de persecución, vuelve a descansar.
        double hogarX = guaridaX - 2.5, hogarZ = guaridaZ + 2.5;
        double d = Dist(ax, az, lx, lz);
        bool caza = t >= loboDescansa && !EnCueva && (EsNoche ? d < RadioPersecucion : d < 3);
        if (caza && persigueDesde < 0) persigueDesde = t;
        if (caza && t - persigueDesde > PersecucionMax) { caza = false; loboDescansa = t + DescansoLobo; }
        if (caza)
        {
            double n = Math.Max(1e-9, d);
            double paso = Math.Min(d, VelLobo * Dt);
            lx += (ax - lx) / n * paso; lz += (az - lz) / n * paso;
            if (Dist(ax, az, lx, lz) < 1)
            {
                salud -= Mordisco; vida.Mordiscos++;
                if (Traza3 && modo == "neutro") { Console.WriteLine($"MORDISCO (noche={EsNoche}):"); buffer.Skip(Math.Max(0, buffer.Count - 14)).ToList().ForEach(Console.WriteLine); }
                loboDescansa = t + DescansoLobo; persigueDesde = -1;
            }
        }
        else
        {
            persigueDesde = -1;
            double h = Dist(lx, lz, hogarX, hogarZ);
            if (h > 0.1) { double paso = Math.Min(h, VelLobo * Dt); lx += (hogarX - lx) / h * paso; lz += (hogarZ - lz) / h * paso; }
        }
    }
}
