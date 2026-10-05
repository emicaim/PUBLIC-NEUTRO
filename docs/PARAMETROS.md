# Los números del cerebro

Un modelo no puede quedarse sin parámetros; lo riguroso es que cada uno tenga una justificación y probar si los
resultados dependen de él. Tipos:

- **Unidad natural**: sale de las unidades del propio mundo, no es una elección.
- **Literatura**: hay un valor o una forma documentada en humanos o animales.
- **Elegido**: puesto con criterio; hay que probar su sensibilidad.

## Núcleo

| Parámetro | Valor | Qué hace | Tipo |
|---|---|---|---|
| `UMBRAL_MIEDO` | 1 | un fracaso de lleno basta para temer una acción en todo el concepto | literatura (aprendizaje de una sola vez del miedo; García) |
| `EXTINCION_MIEDO` | 0,9 | el miedo baja un 10 % cada vez que la acción temida sale bien | elegido (la extinción es lenta, sin valor exacto) |
| `UMBRAL_HOMEOSTASIS` | 0,04 | cambio del impulso que se siente como alivio o malestar | elegido; **probado**: cambia el nivel de violencia en Neutro Minds, no la ventaja en población |
| `PESO_DECEPCION` | 0,3 | una recompensa esperada que no llega cuenta como 0,3 fallos | elegido |
| `TRAMO_META` | 0,2 | cada 20 % de una meta es un logro | elegido |
| `DISTANCIA_COMPLETADO` | 2 | posiciones distintas que tolera el completado de patrones (opción `completar`) | elegido |
| Culpables de un fracaso | 4 más recientes, de los últimos 20 pasos, peso 0,5^i | a quién culpa un fracaso | elegido |

## Memoria de sucesos

| Parámetro | Valor | Qué hace | Tipo |
|---|---|---|---|
| `UMBRAL_PREDICCION` | 0,3 | fuerza mínima (y 2 veces visto) para esperar un efecto | elegido |
| `CASTIGO_SORPRESA` | 0,5 | lo que se debilita un vínculo si lo esperado no llega | elegido |
| `UMBRAL_OLVIDO` | 0,3 | por debajo, el vínculo se olvida | elegido |
| `DESCUENTO_INFERENCIA` | 0,8 | una relación deducida vale el 80 % del eslabón más débil | elegido |
| ventana, ventana de valencia | las pone quien la crea | cuánto tiempo se unen sucesos y cuándo se mira cómo quedó el cuerpo | elegido por mundo |
| medias móviles (valencia, retardo) | 20 % | lo rápido que se actualizan | elegido |

## Agente general

| Parámetro | Valor | Qué hace | Tipo |
|---|---|---|---|
| Distancias de la percepción | 1, 5 y 15 s de camino | al lado, cerca, lejos | **unidad natural** (segundos a su velocidad, no metros); los tres valores, elegidos |
| Umbral de necesidad | déficit 0,3 | cuándo una variable es «la necesidad» | elegido |
| Niveles de necesidad | 0,3 / 0,6 / 0,8 | interocepción graduada | elegido |
| Impulso | raíz de la suma de déficits² | combina las variables del cuerpo | literatura (Keramati y Gutkin 2014); todas pesan igual |
| Valor de consumir por necesidad | media móvil del 20 % del déficit que baja | cuánto alivia cada cosa a cada necesidad | literatura en la forma (Dickinson y Balleine 1994) |
| Memoria de sucesos | ventana 20 s, valencia a los 4 s | | elegido |
| Curiosidad | (0,02 + 0,1 × 0,5) / √visitas | exploración por recuento de lo poco visto | literatura en la forma |
| Valencia clara | 0,05 | a partir de cuánto algo «importa» (concepto, atención, expectativa) | elegido |
