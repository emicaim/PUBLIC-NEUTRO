# SPDX-License-Identifier: Apache-2.0
# Copyright 2026 FOKO SOFT (Emilio Martinez) — Neutro, https://github.com/emicaim/PUBLIC-NEUTRO
"""
Compara dos salidas de la prueba cruzada (Python, JS o C#): las mismas palabras y los mismos números (los números, con
una tolerancia de 1e-6, porque cada lenguaje los escribe a su manera: 4.0 / 4).

    python pruebas/comparar_cruzado.py a.txt b.txt
"""
import json
import sys


def numeros_iguales(a, b):
    try:
        return abs(float(a) - float(b)) <= 1e-6
    except ValueError:
        return a == b


def comparar(x, y, donde):
    if isinstance(x, dict):
        if not isinstance(y, dict) or list(x) != list(y):
            return f"{donde}: claves distintas"
        for k in x:
            d = comparar(x[k], y[k], f"{donde}.{k}")
            if d:
                return d
        return None
    if isinstance(x, (int, float)) and isinstance(y, (int, float)):
        return None if abs(x - y) <= 1e-6 else f"{donde}: {x} / {y}"
    return None if x == y else f"{donde}: {x} / {y}"


def main():
    a = open(sys.argv[1], encoding="utf-8").read().replace("\r", "").strip().split("\n")
    b = open(sys.argv[2], encoding="utf-8").read().replace("\r", "").strip().split("\n")
    if len(a) != len(b):
        print(f"distinto número de líneas: {len(a)} / {len(b)}"); return 1
    for i, (la, lb) in enumerate(zip(a, b)):
        if la.startswith("{"):
            d = comparar(json.loads(la), json.loads(lb), f"línea {i + 1}")
            if d:
                print(d); return 1
            continue
        ta, tb = la.split(" "), lb.split(" ")
        if len(ta) != len(tb):
            print(f"línea {i + 1}: {len(ta)} / {len(tb)} palabras"); return 1
        for j, (u, v) in enumerate(zip(ta, tb)):
            if u == v:
                continue
            pu, pv = u.split("|"), v.split("|")
            if len(pu) == len(pv) and all(numeros_iguales(p, q) for p, q in zip(pu, pv)):
                continue
            print(f"línea {i + 1}, palabra {j + 1}: {u} / {v}"); return 1
    print("IDÉNTICOS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
