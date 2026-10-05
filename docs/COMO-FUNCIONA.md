# Cómo funciona Neutro

Neutro tiene tres piezas. El **núcleo** decide y aprende; la **memoria de sucesos** aprende qué trae cada cosa; el
**agente general** las junta para cualquier mundo. Las versiones en C#, JavaScript y Python siguen esta descripción
al pie de la letra y deciden exactamente lo mismo (`pruebas/cruzado.*`).

## La idea

Las neuronas de concepto del cerebro humano (Quian Quiroga) responden a una idea —una persona, un lugar— sea cual sea
la forma en que aparece. Neutro hace lo mismo con las situaciones: cada **situación** (una cadena que resume lo que
importa) tiene un **concepto** («lobo cerca», «hambre») y una neurona que decide una **acción**. Lo que una situación
aprende pasa a su concepto entero.

El cerebro pasa casi todo el tiempo en reposo (**activación dispersa**): solo vuelve a pensar cuando la situación cambia.

## 1. Lo que pone el mundo (la percepción)

- `situacion`: una cadena. Dos momentos que el cuerpo debe afrontar igual dan la misma cadena.
- `activo`: si el cuerpo puede decidir ahora.
- `lugar()`: una firma del sitio, para las excepciones por lugar (opcional; solo se pide al pensar).
- `nombrar(situacion)` → su **concepto**.
- `tranquila(situacion)`: si no merece neurona propia (ni se culpa ni se premia).

Las **acciones** las pone el cuerpo; la primera es la de **reposo** (la que se hace sin neurona).

## 2. La memoria

- **Neurona**: `situación → { concepto, fallos{acción}, aciertos{acción}, acción, [protegida] }`.
- **Excepción por lugar**: igual, con clave `situación|firma` (para lo que solo vale en un sitio).
- **Miedos por concepto**: por acción, cuánto le ha fallado al concepto entero.
- **Historial**: lo decidido desde la última lección.

## 3. Decidir

1. Si no está `activo`: reposo.
2. Si la situación no ha cambiado: repite la última decisión.
3. Si ha cambiado (**pensar**): la excepción de ese lugar si existe; si no, la neurona de la situación; si no hay, el
   **instinto aprendido** de su concepto (lo que hacen casi todas sus situaciones) o el reposo. Después, el **veto del
   concepto**: si el concepto le tiene miedo a esa acción, hace la que menos miedo le da.

## 4. Elegir la acción de una neurona

Tasa de cada acción: `(aciertos + 1) / (aciertos + fallos + 2)`. Gana la mayor; ante empate, la primera del orden de
prueba (con `generalizar`, primero las que más usa su concepto).

## 5. Aprender

- **De un fracaso** (`aprenderDeFracaso`): las últimas situaciones vividas (las 4 más recientes de los últimos 20
  pasos) suman un fallo a lo que hicieron, con peso `0,5^i`; su concepto suma el mismo miedo. Con lugar, si una
  situación agota todas las acciones en un sitio, se fija la que más lejos llegó como excepción de ese sitio.
- **De lo que sale bien** (`consolidar(margen)`): cada situación vivida suma un acierto a lo que hizo, y el miedo del
  concepto a esa acción baja un 10 % (extinción).
- **Proteger** (`proteger()`): lo que funcionó en una pasada ganadora queda protegido; una corrección posterior va a
  una excepción del lugar, no a la neurona general.

## 6. La recompensa del cuerpo y lo demás

- **Recompensa homeostática** (`sentir(impulso)`, Keramati y Gutkin 2014): el **impulso** es lo lejos que está el
  cuerpo de su equilibrio (por ejemplo, la raíz de la suma de los déficits al cuadrado). Si baja de golpe (al menos
  0,04) es un alivio (+1); si sube de golpe, un malestar (−1). Quien usa el núcleo decide qué lección dar con cada uno
  (normalmente `consolidar` con +1 y `aprenderDeFracaso` con −1).
- **Metas sostenidas** (`fijarMeta`, `avanzarMeta`, O'Reilly y Frank 2006; Botvinick 2009): cada 20 % de avance hacia
  una meta es un pequeño logro.
- **Decepción** (`decepcionar`, Schultz): lo que solía salir bien y esta vez no da nada cuenta como 0,3 fallos.
- **Repaso** (`repasar`, Wilson y McNaughton): decisiones de hace tiempo se repasan sabiendo cómo acabó aquello; lo que
  sale bien apaga además el miedo del concepto.

## 7. La memoria de sucesos (`Asociaciones`)

Une lo que pasa cerca en el tiempo (`suceso`): de cada par A→B guarda su fuerza, cuánto tarda B tras A y cuántas veces
se ha visto. Con eso:

- **espera** lo que suele venir (`esperando`) y se **sorprende** si no llega (`vigilar`), lo que debilita el vínculo;
- aprende la **valencia** de cada suceso: cómo quedó el cuerpo un rato después (`sentir`);
- **deduce** relaciones que nunca vio juntas (`inferida`, A→B y B→C ⇒ A→C, Eichenbaum);
- aprende **viendo a otros** (`observar`, Olsson y Phelps 2007);
- distingue un **requisito** de una casualidad (`requisito`).

## 8. El agente general (C#)

Junta todo para cualquier mundo. El mundo le da tres cosas: **el cuerpo** (variables con su equilibrio), **lo que ve**
(tipo, distancia y dirección de cada objeto) y **señales** (como «oscuro»). El agente:

- **arma su situación solo**: la necesidad más urgente y cuánta (interocepción graduada), lo más cercano de cada tipo a
  tres distancias medidas en segundos de camino, las señales y lo que espera que pase. Solo entran los tipos que han
  importado a su cuerpo (**atención guiada por el valor**, Anderson 2013);
- **elige su concepto solo**: el objeto cercano que más ha cambiado su cuerpo; si no, su necesidad; si no, la calma;
- **aprende el valor de cada cosa para cada necesidad** (Dickinson y Balleine 1994): cuánto bajó el déficit de cada
  variable tras consumirla;
- **siente su cuerpo**: los cambios bruscos son sucesos («pierde salud»), y la valencia mide el cambio mismo;
- **culpa a la causa** (Rescorla y Wagner): un daño solo enseña a las decisiones tomadas con su causa conocida a la vista;
- **aprende del alivio** (Mowrer): si esperaba algo malo y no llegó, lo que hizo se refuerza; si llegó, se castiga;
- **lo innato**: con una necesidad, ir hacia lo que alivia esa necesidad; probar lo que tiene al lado si nunca lo ha
  probado; alejarse de lo que sabe que daña (defensa innata, Bolles 1970); la curiosidad por lo poco visto.

Sus acciones son pocas y relativas a **lo que importa ahora** (el foco): instinto, esperar, explorar, consumir,
acercarse, alejarse.

## 9. Lo que va fuera del núcleo

- **Cuándo** algo es un fracaso o un éxito, y qué lección dar: lo decide quien lo usa (o el agente general, con su cuerpo).
- **La exploración** (curiosidad): el núcleo no explora solo.
- **Los reflejos** que no se aprenden.
