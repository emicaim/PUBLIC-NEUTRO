# Resultados (medidos, con lo que sale bien y con lo que no)

Todo con varias semillas, comparando semilla a semilla e intervalos de confianza al 95 %. Lo que no funciona también
se cuenta: es la mejor forma de saber qué es Neutro de verdad.

## El agente general en un bosque (`csharp/Neutro.Ejemplos`)

Un bosque de 40 × 40 m con frutales que se agotan y rebrotan, un lobo que duerme de día y caza de noche (algo más rápido
que el agente) y una cueva. El agente solo recibe su energía y su salud, lo que ve (tipo, distancia, dirección) y la
señal «oscuro». El cerebro se conserva de una vida a la siguiente. 10 semillas × 60 vidas (vida máxima 20 minutos).

| agente | vida media (últimas vidas) | muere de hambre | muere por el lobo |
|---|---|---|---|
| **Neutro** | **1127 s** | 0 % | 6 % |
| lo innato + memoria de sucesos, sin aprender acciones | 1155 s | 0 % | 6 % |
| al azar | 276 s | 71 % | 29 % |
| oráculo escrito a mano (huir del lobo de noche) | 1200 s | 0 % | 0 % |

- **Lo que funciona**: sin que nadie le diga qué es cada cosa, aprende qué es comida y cuánto alivia cada necesidad, y
  qué es peligroso. Vive unas **4 veces más que el azar** (+851 ± 119 s) y casi tanto como el oráculo.
- **Lo que no**: en este bosque el aprendizaje de acciones del núcleo **no mejora** a lo innato con la memoria de
  sucesos (−28 ± 140 s, un empate): con lo innato ya casi no queda nada que aprender. Para medir lo que aporta el
  núcleo hace falta un mundo donde lo innato no baste.

## Neutro Minds: miles de mentes en un mundo con culturas

Un mundo simulado donde miles de personas, cada una con su propio cerebro de Neutro, viven, forman pueblos, construyen,
inventan palabras, comercian y se pelean. Solo traen lo innato (comer, beber, dormir, apego, curiosidad, empatía);
todo lo demás lo aprenden. Comparado con Q-learning (el aprendizaje por refuerzo clásico), 5 mundos de 100 años:

- **Mucho más que Q**: unas 4 veces más población, muchas más casas e inventos, menos muertes por veneno y por lobos.
- **Igual que Q**: la vida media (la ventaja es pequeña y cambia de signo según el mundo).
- **Peor que Q**: mucha más violencia entre personas (en torno al 22-28 % de las muertes, como las sociedades tribales
  más violentas; Q, casi ninguna) y beben más agua sucia.
- **Violencia a lo largo de 200 años** (2 mundos): empieza casi en cero, sube al crecer los pueblos (pico del 35-47 %)
  y baja algo después (20-30 %). Casi todas las muertes vienen de atacar a gente de otros pueblos; el castigo al
  ladrón casi nunca mata.

## Lo que Neutro todavía no sabe hacer

- **Planificar a largo plazo**: guardar comida para el invierno no aparece, ni con metas, ni con prospección, ni con un
  invierno más duro.
- **Unir causas y efectos muy separados** cuando la acción la dispara el instinto (beber agua sucia que enferma días
  después).
- **Generalizar a lo nunca visto**: solo evita a la primera alrededor de 1 de cada 5 plantas venenosas nuevas.

## Lo que depende de los números

Varios resultados cambian con los parámetros (ver [PARAMETROS.md](PARAMETROS.md)). Robusto: mucha más población y
casas que Q. No robusto: la ventaja en vida media y el nivel exacto de violencia (del 6 % al 27 % según el umbral del
alivio y la empatía).
