# SPDX-License-Identifier: Apache-2.0
# Copyright 2026 FOKO SOFT (Emilio Martinez) — Neutro, https://github.com/emicaim/PUBLIC-NEUTRO
"""
EJEMPLO MÍNIMO: una criatura con hambre y un lobo. Nadie le dice que comer es bueno ni que hay que huir del lobo:
lo aprende por cómo queda su cuerpo después de cada cosa (recompensa homeostática).

    python ejemplos/minimo.py
"""
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "python"))
from neutro import Nucleo  # noqa: E402


class Percepcion:
    """Qué concepto es cada situación y cuáles no merecen neurona propia."""

    def nombrar(self, situacion):
        return situacion          # aquí la situación ya es el concepto

    def tranquila(self, situacion):
        return situacion == "calma"


cerebro = Nucleo(Percepcion(), acciones=("esperar", "comer", "huir"), por_concepto=True)

semilla = 7


def azar():
    global semilla
    semilla = (semilla * 1103515245 + 12345) % 2147483648
    return semilla / 2147483648


hambre = dolor = 0.0
mordiscos = comidas = 0
for paso in range(1, 3001):
    situacion = "lobo cerca" if azar() < 0.25 else ("hambre" if hambre > 0.3 else "calma")
    accion, _ = cerebro.decidir_situacion(situacion, True, lambda: "")
    # CURIOSIDAD: a veces prueba otra cosa (el núcleo no explora por sí solo; eso lo pone quien lo usa).
    # Se anota en el historial lo que de verdad hizo, para que aprenda de eso.
    if azar() < 0.05:
        accion = cerebro.acciones[int(azar() * len(cerebro.acciones))]
        cerebro.historial[-1] = cerebro.historial[-1][:2] + (accion,) + cerebro.historial[-1][3:]

    # lo que pasa en el mundo (el cerebro no ve estas reglas)
    hambre = min(1.0, hambre + 0.04)
    dolor = max(0.0, dolor - 0.1)
    if situacion == "lobo cerca" and accion != "huir":
        dolor = min(1.0, dolor + 0.5)
        mordiscos += 1
    if situacion == "hambre" and accion == "comer":
        hambre = max(0.0, hambre - 0.5)
        comidas += 1

    # lo que siente el cuerpo, y la lección (cada lección cubre lo vivido desde la anterior)
    r = cerebro.sentir(math.sqrt(hambre * hambre + dolor * dolor))
    if r > 0:
        cerebro.consolidar(0)          # alivio: lo que hizo estuvo bien
        cerebro.reiniciar_estadisticas()
    elif r < 0:
        cerebro.aprender_de_fracaso()  # malestar: lo que hizo estuvo mal
        cerebro.reiniciar_estadisticas()

    if paso % 500 == 0:
        print(f"pasos {paso - 499}-{paso}: {mordiscos} mordiscos, {comidas} comidas")
        mordiscos = comidas = 0

print("\nLo que ha aprendido:")
for situacion, neurona in cerebro.neuronas.items():
    print(f"  {situacion} -> {neurona['accion']}")
