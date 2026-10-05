# Neutro

**A brain for agents and game characters that learn on their own from what they feel.**

Neutro needs no millions of examples and no neural network. Give it three things —how its body is doing, what is
around it, and what it can do— and it learns while it lives: what relieves hunger, what hurts, what to run from. You
can read what it is thinking at any moment, and why.

It is inspired by the **concept cells** discovered by Rodrigo Quian Quiroga: neurons that store ideas («wolf nearby»,
«hunger»), not details. Each concept learns what to do, and what one situation learns carries over to similar ones.

> The code and the documentation are written in Spanish; the API is small and the examples are easy to follow.

## Why it is different

- **Learns online**, with no prior training: from every relief and every discomfort of its body (homeostatic
  reinforcement learning, Keramati & Gutkin 2014).
- **Readable**: every decision has a neuron, a concept and a history (which failures and successes shaped it).
- **Tiny**: no dependencies, a few KB per agent. Thousands of agents at once in a browser.
- **The same brain in three languages** —C# (Unity), JavaScript and Python— making **exactly** the same decisions,
  checked by cross tests.
- **Honestly measured**: what it can and cannot do is in [docs/RESULTADOS.md](docs/RESULTADOS.md).

## Try it in one minute

```bash
node ejemplos/minimo.mjs        # or:  python ejemplos/minimo.py
```

A hungry creature and a wolf. Nobody tells it what to do: after a few hundred steps it runs from the wolf and eats when
hungry. The general agent in a forest (fruit trees, a wolf that hunts at night, a cave), compared with random play:

```bash
dotnet run --project csharp/Neutro.Ejemplos -c Release -- 10 30 --oraculos
```

## Install

| Where | How |
|---|---|
| **Unity** | Package Manager → *Add package from git URL* → `https://github.com/emicaim/PUBLIC-NEUTRO.git?path=/csharp/Neutro.Nucleo` |
| **.NET** | copy `csharp/Neutro.Nucleo` or reference its `.csproj` (.NET Standard 2.1) |
| **JavaScript** | `import { Nucleo } from './js/index.js'` (browser or Node, ES modules) |
| **Python** | `pip install ./python` and `from neutro import Nucleo` |

Step-by-step guide (in Spanish, with code): [docs/INTEGRAR.md](docs/INTEGRAR.md).

## License and credit

Apache 2.0. Free to use, including in commercial projects. If you redistribute Neutro or ship it in your game or
software, **keep the [NOTICE](NOTICE) file** and credit **FOKO SOFT (Emilio Martinez)**. To cite it in academic work:
[CITATION.cff](CITATION.cff).

Copyright 2026 FOKO SOFT (Emilio Martinez).
