// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 FOKO SOFT (Emilio Martinez) — Neutro, https://github.com/emicaim/PUBLIC-NEUTRO
// EJEMPLO: el agente general de Neutro en un bosque de consola (frutales, un lobo que caza de noche, una cueva).
//
//     dotnet run --project csharp/Neutro.Ejemplos -c Release -- [semillas] [vidas] [--oraculos]
//
// Compara Neutro con un agente al azar y con lo innato sin aprender, con varias semillas e intervalos de confianza.
using System.Linq;

static class Program
{
    static void Main(string[] args) => LabBosque.Correr(new[] { "bosque" }.Concat(args).ToArray());
}
