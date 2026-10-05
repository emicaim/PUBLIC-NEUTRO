# Integrar Neutro en tu proyecto

Dos formas de usarlo:

1. **El agente general** (C#, recomendado para juegos): le das el cuerpo, lo que ve y sus acciones, y hace el resto.
2. **El núcleo directamente** (C#, JS o Python): tú decides qué es una situación y cuándo algo sale bien o mal.

## 1. El agente general (Unity / C#)

Instala el paquete en Unity: *Window → Package Manager → + → Add package from git URL*:

```
https://github.com/emicaim/PUBLIC-NEUTRO.git?path=/csharp/Neutro.Nucleo
```

En cada paso de tu juego (por ejemplo, cada medio segundo), dale lo que siente y lo que ve, y ejecuta lo que quiere:

```csharp
using Neutro.General;

// Al crear el personaje: los tipos de cosas que puede haber, las variables de su cuerpo y las señales del mundo
var agente = new AgenteGeneral(
    tipos:     new[] { "fruta", "árbol", "roca", "lobo", "cueva" },
    variables: new[] { "energía", "salud" },
    senales:   new[] { "oscuro" },
    velocidad: 1.5,      // metros por segundo: las distancias se miden en segundos de camino
    semilla:   1);

// En cada paso:
var obs = new Observacion { Tiempo = tiempoDeJuego };
obs.Cuerpo.Add(new Variable("energía", energia));   // valores de 0 a 1 (equilibrio = 1)
obs.Cuerpo.Add(new Variable("salud", salud));
foreach (var cosa in cosasCercanas)                  // tipo, distancia y dirección (vector unitario en el plano)
    obs.Objetos.Add(new Percibido(cosa.tipo, cosa.distancia, cosa.dirX, cosa.dirZ));
if (esDeNoche) obs.Senales.Add("oscuro");

Intencion i = agente.Paso(obs);
switch (i.Verbo)
{
    case "ir":       MoverHacia(i.Tipo); break;     // ir hacia lo más cercano de ese tipo
    case "huir":     AlejarseDe(i.Tipo); break;
    case "consumir": Consumir(i.Tipo);   break;     // comer o beber lo que tiene al lado (si se puede)
    case "explorar": Explorar();         break;
    default:         /* esperar */       break;
}
```

**Lo que pones tú (el mundo)**: qué hace cada cosa al cuerpo (la fruta da energía, el lobo quita salud). El agente no lo
sabe de antemano: lo aprende por cómo cambia su cuerpo.

**Lo que trae de serie (lo innato)**: con una necesidad, ir hacia lo que su memoria asocia con alivio de esa necesidad;
probar lo que tiene al lado si nunca lo ha probado; alejarse de lo que sabe que le hace daño; la curiosidad.

**Para mostrar lo que piensa**: `agente.Situacion`, `agente.Concepto`, `agente.Accion`, `agente.Foco`,
`agente.Espera` (lo que espera que pase), `agente.ValorDeConsumir(tipo, necesidad)`, `agente.ValorDeCerca(tipo)`,
`agente.Nucleo.Miedos`, `agente.Nucleo.Neuronas`.

Un ejemplo completo y medible, sin Unity: `csharp/Neutro.Ejemplos` (un bosque en consola).

## 2. El núcleo directamente

El núcleo no sabe nada del mundo. Le das:

- una **percepción**: `nombrar(situacion)` → el concepto, y `tranquila(situacion)` → si no merece neurona propia;
- las **acciones** posibles (la primera es la de reposo, la que hace sin neurona);
- en cada paso, la **situación** (una cadena que resume lo que importa: dos momentos que hay que afrontar igual dan la
  misma cadena), y después **cómo le ha ido**.

### JavaScript

```js
import { Nucleo } from './js/index.js';

const percepcion = { nombrar: (s) => s.split(' ')[0], tranquila: (s) => s === 'calma' };
const cerebro = new Nucleo(percepcion, { acciones: ['esperar', 'comer', 'huir'], porConcepto: true });

// en cada paso
const [accion] = cerebro.decidirSituacion(situacion, true, () => '');
// ... tu mundo ejecuta la acción ...
const r = cerebro.sentir(impulso);        // impulso: lo lejos que está el cuerpo de estar bien (0 = perfecto)
if (r > 0) { cerebro.consolidar(0); cerebro.reiniciarEstadisticas(); }
else if (r < 0) { cerebro.aprenderDeFracaso(); cerebro.reiniciarEstadisticas(); }
```

### Python

```python
from neutro import Nucleo

class Percepcion:
    def nombrar(self, s): return s.split(" ")[0]
    def tranquila(self, s): return s == "calma"

cerebro = Nucleo(Percepcion(), acciones=("esperar", "comer", "huir"), por_concepto=True)

accion, _ = cerebro.decidir_situacion(situacion, True, lambda: "")
r = cerebro.sentir(impulso)
if r > 0:
    cerebro.consolidar(0); cerebro.reiniciar_estadisticas()
elif r < 0:
    cerebro.aprender_de_fracaso(); cerebro.reiniciar_estadisticas()
```

### C#

```csharp
using Neutro;

class Percepcion : IPercepcion
{
    public string Nombrar(string s) => s.Split(' ')[0];
    public bool Tranquila(string s) => s == "calma";
}

var cerebro = new Nucleo(new Percepcion(), new[] { "esperar", "comer", "huir" }) { PorConcepto = true };
var (accion, _) = cerebro.DecidirSituacion(situacion, true, () => "");
int r = cerebro.Sentir(impulso);
if (r > 0) { cerebro.Consolidar(0); cerebro.ReiniciarEstadisticas(); }
else if (r < 0) { cerebro.AprenderDeFracaso(); cerebro.ReiniciarEstadisticas(); }
```

## Consejos (aprendidos midiendo)

- **Cada lección, lo vivido desde la anterior**: tras `consolidar` o `aprenderDeFracaso`, vacía el historial
  (`reiniciarEstadisticas`) o recórtalo. Si no, un buen momento premia todo lo que hizo en su vida.
- **Pon curiosidad**: el núcleo no explora solo. Haz que a veces pruebe otra acción, más en lo poco visto
  (`(0,02 + 0,1·curiosidad) / √veces que ha entrado en esa situación`), y anota en el historial lo que hizo de verdad.
  Cuenta las **veces que entra** en la situación, no los instantes que pasa en ella: si no, quedarse quieto apaga la
  curiosidad y una conducta inútil sigue para siempre.
- **La situación, con lo que importa**: cuantos menos detalles irrelevantes, antes generaliza. El agente general lo
  hace solo (atención guiada por el valor).
- **Pocas acciones y relativas a lo que importa** («alejarse de lo que tengo delante») funcionan mucho mejor que una
  acción por cada cosa del mundo.
