# SPDX-License-Identifier: Apache-2.0
# Copyright 2026 FOKO SOFT (Emilio Martinez) — Neutro, https://github.com/emicaim/PUBLIC-NEUTRO
"""
PRUEBA CRUZADA de «aprender por concepto»: la misma secuencia pseudoaleatoria de decisiones, fracasos y aciertos en
el núcleo de Python y en el de JavaScript (pruebas/concepto_cruzado.mjs); las dos salidas tienen que ser idénticas.

    python pruebas/concepto_cruzado.py > a.txt ; node pruebas/concepto_cruzado.mjs > b.txt ; fc a.txt b.txt
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "python"))
from neutro import Nucleo  # noqa: E402


class Percepcion:
    def nombrar(self, s):
        return s.split(" ")[0]

    def tranquila(self, s):
        return s.startswith("calma")


def main():
    estado = 12345

    def azar(n):
        nonlocal estado
        estado = (estado * 1103515245 + 12345) % 2147483648
        return estado % n

    acciones = ["instinto", "evitar", "atacar", "comer", "esperar"]
    for opciones in ({"por_concepto": True}, {"por_concepto": True, "generalizar": True,
                                                "prudencia": {"lobo": ["evitar", "atacar"]}}):
        n = Nucleo(Percepcion(), acciones=acciones, **opciones)
        conceptos = ["lobo", "hambre", "calma", "bayas"]
        salida = []
        for paso in range(6000):
            s = f"{conceptos[azar(4)]} x{azar(6)} y{azar(3)}"
            accion, _ = n.decidir_situacion(s, azar(10) > 0, lambda: azar(5))
            salida.append(accion)
            salida.append("S" + str(n.sentir(azar(100) / 100)))
            r2 = azar(50)
            if r2 == 0:
                n.fijar_meta(["reserva", "otra"][azar(2)])
            elif r2 == 1:
                n.soltar_meta()
            else:
                salida.append("M" + str(n.avanzar_meta(azar(101) / 100)))
            r = azar(100)
            if r < 4:
                res = n.aprender_de_fracaso(None)
                salida.append("F" + ("null" if res is None else "|".join(str(x) for x in res)))
                n.reiniciar_estadisticas()
            elif r < 10:
                n.consolidar(azar(3))
                n.reiniciar_estadisticas()
            elif r < 14 and opciones.get("generalizar"):
                salida.append("D" + str(n.decepcionar()))
                n.reiniciar_estadisticas()
            elif r < 16 and opciones.get("generalizar"):
                entradas = [(f"{conceptos[azar(4)]} x{azar(6)} y{azar(3)}", acciones[azar(5)]) for _ in range(3)]
                exito = azar(2) == 1
                salida.append("R" + str(n.repasar(entradas, exito, 0.5)))
                n.reiniciar_estadisticas()
        print(" ".join(salida))
        print(json.dumps({c: {a: round(v, 5) for a, v in sorted(m.items())} for c, m in sorted(n.miedos.items())}))
        print(json.dumps({k: v["accion"] for k, v in sorted(n.neuronas.items())}))


if __name__ == "__main__":
    main()


def asociaciones():
    from neutro import Asociaciones
    a = Asociaciones(10, 40)
    estado = 777
    sucesos = ["lluvia", "langosta", "hambre", "calma", "frio", "fuego"]
    salida = []
    for t in range(3000):
        estado = (estado * 1103515245 + 12345) % 2147483648
        c = a.suceso(sucesos[estado % 6], t)
        if c:
            salida.append("C" + "/".join(f"{x}>{y}" for x, y in c))
        a.sentir((estado % 97) / 97, t)
        if t % 7 == 0:
            a.observar([sucesos[(estado // 7) % 6], sucesos[(estado // 11) % 6]], sucesos[(estado // 13) % 6], 0.5)
        if t % 50 == 0:
            a.vigilar(t)
            v = a.vinculos.get("lluvia→hambre")
            salida.append(f"{(v or {}).get('retardo', 0):.6f}|{a.valencia.get('langosta', 0):.6f}|{a.inferida('lluvia', 'hambre'):.6f}|{a.inferida('frio', 'fuego'):.6f}|{a.inferida('calma', 'langosta'):.6f}")
    print(" ".join(salida))


if __name__ == "__main__":
    asociaciones()
