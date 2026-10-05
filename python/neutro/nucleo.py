# SPDX-License-Identifier: Apache-2.0
# Copyright 2026 FOKO SOFT (Emilio Martinez) — Neutro, https://github.com/emicaim/PUBLIC-NEUTRO
"""
NÚCLEO DE NEUTRO: el cerebro de neuronas de concepto, sin saber a qué juega.

No ve mapas ni píxeles. Recibe SITUACIONES (una cadena que resume lo que percibe el cuerpo, ya abstraída por la
percepción de cada mundo), decide una ACCIÓN y aprende de los fracasos y de los éxitos. Lo que depende del mundo lo
pone una PERCEPCIÓN (un objeto con estos dos métodos):
    percepcion.nombrar(situacion)   -> concepto ("Peligro en trayectoria", "Vacío adelante"...)
    percepcion.tranquila(situacion) -> True si la situación no merece neurona propia (camino liso y libre)

La especificación de lo que hace cada parte está en docs/COMO-FUNCIONA.md; las versiones en JavaScript y C# (Unity)
la siguen y pruebas/cruzado.* comprueba que las tres deciden exactamente lo mismo.
"""
import heapq
import json
from pathlib import Path

DISTANCIA_COMPLETADO = 2  # casillas distintas que tolera el completado de patrones
CAMBIOS_CONFLICTO = 3     # cambios de respuesta (en sitios distintos) que delatan un conflicto entre lugares
MAX_AGOTADO = 2           # agotamientos de un sitio antes de olvidar su memoria de trabajo
TOLERANCIA_LUGAR = 48     # dos fracasos a menos de 48 unidades de avance cuentan como el mismo sitio
UMBRAL_MIEDO = 1          # (aprender por concepto) un fracaso de lleno basta para temer: aprender de una vez
EXTINCION_MIEDO = 0.9     # cada vez que la acción temida sale bien, el miedo baja un 10 %
PESO_DECEPCION = 0.3      # (decepción) lo que cuenta como fallo una recompensa esperada que no llega
UMBRAL_HOMEOSTASIS = 0.04  # (homeostasis) cambio del impulso entre dos decisiones que se siente como bueno o malo
TRAMO_META = 0.2          # (metas) cada tramo cubierto de una meta sostenida es un logro que se siente


class Nucleo:
    """
    Memoria y aprendizaje. `acciones` son las respuestas posibles del cuerpo; la primera es la de REPOSO (lo que hace
    sin ninguna neurona: en un juego de plataformas, avanzar).

    Opciones (todas apagadas por defecto, como en las mediciones):
        completar  ante una situación sin neurona, responde la del mismo concepto más parecida (invariancia)
        separar    un concepto que funciona en un sitio y falla en otro aprende por lugar (separación de patrones)
        instintos  {concepto: acciones preferidas}; con modo "despues" deciden qué se prueba primero tras fallar, con
                   "antes" también la primera respuesta ante una situación nunca vista
        prudencia  {concepto: acciones}; tras fallar, se prueban antes que el resto (se aplica después de los instintos)
        generalizar  INSTINTO APRENDIDO: cada concepto resume lo que funcionó en todas sus situaciones; ante una
                   situación nunca vista responde lo que su concepto hace casi siempre, y tras fallar prueba antes lo
                   que más usa su concepto (en vez de una tabla escrita a mano)
        por_concepto  APRENDER POR CONCEPTO (el miedo, LeDoux; la invariancia, Quian Quiroga): un fracaso enseña
                   también al concepto entero; la acción que le falló queda vetada en todas sus situaciones, hasta que
                   salga bien unas cuantas veces
    """

    def __init__(self, percepcion, ruta_memoria=None, acciones=("avanzar",), completar=False, separar=False,
                 instintos=None, modo_instintos=False, prudencia=None,
                 generalizar=False, por_concepto=False):
        self.percepcion = percepcion
        self.ruta_memoria = Path(ruta_memoria) if ruta_memoria else None
        self.acciones = tuple(acciones)
        self.reposo = self.acciones[0]
        self.completar = completar
        self.separar = separar
        self.tabla_instintos = instintos or {}
        self.instintos = modo_instintos
        self.prudencia = prudencia or {}
        self.generalizar = generalizar
        self.por_concepto = por_concepto
        self.miedos = {}          # concepto -> {acción: fallos} (aprender por concepto)
        self.votos_previos = {}   # conceptos traídos de otro juego (ver traer_conceptos)
        self._impulso = None      # (homeostasis) el impulso de la última vez que se sintió el cuerpo
        self.meta = None          # (metas) {"nombre", "tramos"}: la meta sostenida activa y los tramos ya cubiertos
        self._votos = None     # resumen de lo que responde cada concepto: se recalcula al empezar y al terminar cada lección
        # Neuronas de concepto: situación -> {"concepto", "fallos", "accion", ...}
        self.neuronas = {}
        # Excepciones por lugar (memoria por contexto, como el hipocampo): "situación|lugar" -> neurona
        self.excepciones = {}
        # Memoria de trabajo de los sitios donde fracasa (no se guarda en disco): ver aprender_de_fracaso
        self.callejones = []
        if self.ruta_memoria and self.ruta_memoria.exists():
            self.cargar()
        self.reiniciar_estadisticas()

    def reiniciar_estadisticas(self):
        self.ticks = 0
        self.evaluaciones = 0  # veces que el cerebro realmente "pensó"
        self.disparos = 0      # ticks con una neurona de concepto encendida
        # una entrada por tick: (situación, activo, acción, lugar, excepción). "activo" = el cuerpo puede decidir (en
        # plataformas, con los pies en el suelo); la culpa y los aciertos solo cuentan los ticks activos
        self.historial = []
        self._ultima_situacion = None
        self._ultima_decision = (self.reposo, None, "", False)

    # ---- decidir ----------------------------------------------------------------------------------------------

    def decidir_situacion(self, situacion, activo, lugar):
        """
        ACTIVACIÓN DISPERSA: solo se evalúa cuando el cuerpo puede actuar y el estímulo cambió; si no, se repite la
        última decisión (o se descansa, si no puede actuar). `lugar` es una función que devuelve la firma del sitio
        (solo se calcula al evaluar). Devuelve (acción, neurona que decidió o None).
        """
        self.ticks += 1
        if not activo:
            accion, neurona, firma, excepcion = self.reposo, None, "", False
        elif situacion == self._ultima_situacion:
            accion, neurona, firma, excepcion = self._ultima_decision
        else:
            self.evaluaciones += 1
            firma = lugar()
            neurona = self.excepciones.get(f"{situacion}|{firma}")
            excepcion = neurona is not None
            if not excepcion:
                neurona = self.neuronas.get(situacion)
                if neurona is None and self.completar:
                    neurona = self._completar(situacion)
            accion = neurona["accion"] if neurona else self.reposo
            if neurona is None and self.generalizar:
                general = self._respuesta_del_concepto(self.percepcion.nombrar(situacion))
                if general:
                    accion = general
            if neurona is None and self.instintos == "antes":
                # INSTINTO ANTE LO DESCONOCIDO: una situación nunca vista no se afronta en reposo, sino con la
                # respuesta preferida de su concepto. Lo aprendido la corrige
                preferidas = [a for a in self.tabla_instintos.get(self.percepcion.nombrar(situacion), ())
                              if a in self.acciones]
                if preferidas:
                    accion = preferidas[0]
            if self.por_concepto and not excepcion:
                accion = self._veto_del_concepto(neurona["concepto"] if neurona else self.percepcion.nombrar(situacion), accion)
            self._ultima_decision = (accion, neurona, firma, excepcion)

        self._ultima_situacion = situacion if activo else None
        if accion != self.reposo:
            self.disparos += 1
        # el lugar se guarda para poder crear una excepción si esta decisión resulta un callejón
        self.historial.append((situacion, activo, accion, firma, excepcion))
        return accion, neurona

    def _veto_del_concepto(self, concepto, accion):
        """
        EL VETO DEL CONCEPTO: si la acción le ha fallado a este concepto (en cualquiera de sus situaciones) al menos
        UMBRAL_MIEDO, se hace la que menos le ha fallado (ante empate, la primera del orden: la prudencia primero).
        """
        miedo = self.miedos.get(concepto)
        if not miedo or miedo.get(accion, 0) < UMBRAL_MIEDO:
            return accion
        orden = self.acciones
        if concepto in self.prudencia:
            primeras = self.prudencia[concepto]
            orden = (*primeras, *(a for a in self.acciones if a not in primeras))
        return max(orden, key=lambda a: -miedo.get(a, 0))

    def _completar(self, situacion):
        """
        INVARIANCIA / COMPLETADO DE PATRONES: ante una situación nunca vista presta su respuesta la neurona del mismo
        concepto que difiere en menos posiciones (hasta DISTANCIA_COMPLETADO). Si falla, la culpa crea una neurona
        propia para la situación nueva, que desde entonces tiene prioridad.
        """
        concepto = self.percepcion.nombrar(situacion)
        mejor, distancia_mejor = None, DISTANCIA_COMPLETADO + 1
        for otra, neurona in self.neuronas.items():
            if neurona["concepto"] != concepto:
                continue
            distancia = sum(a != b for a, b in zip(situacion, otra))
            if distancia < distancia_mejor:
                mejor, distancia_mejor = neurona, distancia
        return mejor

    def _elegir(self, neurona):
        """
        La acción con mejor tasa de éxito: (aciertos + 1) / (aciertos + fallos + 2); ante empate, la primera del orden
        de prueba (las acciones en su orden, salvo que instintos o prudencia adelanten otras para su concepto).
        """
        aciertos = neurona.get("aciertos", {})
        orden = self.acciones
        concepto = neurona.get("concepto")
        if self.instintos and concepto in self.tabla_instintos:
            preferidas = [a for a in self.tabla_instintos[concepto] if a in self.acciones]
            orden = (self.reposo, *preferidas) + tuple(a for a in self.acciones if a not in preferidas and a != self.reposo)
        if self.generalizar:
            votos = self._votos_del_concepto(concepto)
            preferidas = sorted((a for a in self.acciones if a != self.reposo and votos.get(a)),
                                key=lambda a: -votos[a])
            # (las no votadas, en el orden de antes: el de los instintos si los hay; sin ellos, el de las acciones)
            orden = (self.reposo, *preferidas) + tuple(a for a in orden if a not in preferidas and a != self.reposo)
        if concepto in self.prudencia:
            primeras = self.prudencia[concepto]
            orden = (self.reposo, *primeras) + tuple(a for a in self.acciones if a not in (self.reposo, *primeras))
        return max(orden, key=lambda a: (aciertos.get(a, 0) + 1)
                   / (aciertos.get(a, 0) + neurona["fallos"].get(a, 0) + 2))

    # ---- instinto aprendido (generalizar) ------------------------------------------------------------------------

    def _leccion(self, aprender, *args):
        """Cada lección ve el resumen de los conceptos de antes de empezar, y lo deja al día al terminar."""
        self._votos = None
        self._votos_del_concepto(None)   # el resumen de antes de la lección
        resultado = aprender(*args)
        self._votos = None
        return resultado

    def _votos_del_concepto(self, concepto):
        """Cuántas situaciones del concepto responden con cada acción (sus campos receptivos votan)."""
        if self._votos is None:
            self._votos = {}
            if self.generalizar:
                for concepto_previo, votos in self.votos_previos.items():
                    self._votos[concepto_previo] = dict(votos)
                for neurona in self.neuronas.values():
                    votos = self._votos.setdefault(neurona["concepto"], {})
                    votos[neurona["accion"]] = votos.get(neurona["accion"], 0) + 1
        return self._votos.get(concepto, {})

    def traer_conceptos(self, otra_memoria, peso=10):
        """
        TRANSFERENCIA ENTRE JUEGOS: de la memoria de otro juego se trae solo el resumen de cada concepto, qué hizo cuando
        avanzar (el reposo) no bastaba, como `peso` votos repartidos en proporción. Ninguna situación concreta: la
        experiencia propia lo supera enseguida. EXPERIMENTAL: solo en Python, fuera de docs/COMO-FUNCIONA.md hasta que demuestre
        una mejora (ver NOCHE.md).
        """
        conteo = {}
        for neurona in otra_memoria.get("neuronas", {}).values():
            if neurona["accion"] != self.reposo and neurona["accion"] in self.acciones:
                votos = conteo.setdefault(neurona["concepto"], {})
                votos[neurona["accion"]] = votos.get(neurona["accion"], 0) + 1
        self.votos_previos = {c: {a: peso * n / sum(v.values()) for a, n in v.items()} for c, v in conteo.items()}
        self._votos = None
        return self.votos_previos

    def _respuesta_del_concepto(self, concepto):
        """
        Lo que el concepto hace casi siempre: la acción de al menos 3 de sus situaciones y de más de la mitad. Si no
        hay acuerdo, None (lo desconocido se afronta en reposo, como sin generalizar).
        """
        votos = self._votos_del_concepto(concepto)
        if not votos:
            return None
        accion = max(votos, key=votos.get)
        if accion != self.reposo and accion in self.acciones and votos[accion] >= 3 and 2 * votos[accion] > sum(votos.values()):
            return accion
        return None

    def _nueva(self, situacion, accion=None, concepto=None):
        return {"concepto": concepto if concepto is not None else self.percepcion.nombrar(situacion),
                "fallos": {a: 0 for a in self.acciones}, "accion": accion if accion is not None else self.reposo}

    def descartar(self, n):
        """
        Olvida los últimos `n` ticks del historial. Para cuando el fracaso se detecta tarde (en algunos juegos las vidas
        bajan al reaparecer, no al morir): lo que hizo ya muerto no debe cargar con la culpa.
        """
        if n > 0:
            del self.historial[-n:]

    # ---- aprender de lo que sale bien -------------------------------------------------------------------------

    def consolidar(self, margen=20):
        return self._leccion(self._consolidar, margen)

    def _consolidar(self, margen):
        """
        CONSOLIDACIÓN: lo que se dejó atrás con vida (más de `margen` ticks activos antes del final) suma un acierto a
        la acción usada. Solo cuenta lo que se superó: una situación que reaparece en el tramo final no.
        """
        finales, activos = set(), 0
        for situacion, activo, *_ in reversed(self.historial):
            if activo:
                activos += 1
                if activos > margen:
                    break
                finales.add(situacion)
        vistas, activos = set(), 0
        for situacion, activo, accion, firma, excepcion in reversed(self.historial):
            if not activo:
                continue
            activos += 1
            if activos <= margen or situacion in finales or self.percepcion.tranquila(situacion):
                continue
            memoria, clave = (self.excepciones, f"{situacion}|{firma}") if excepcion else (self.neuronas, situacion)
            if clave in vistas:
                continue
            vistas.add(clave)
            neurona = memoria.setdefault(clave, self._nueva(situacion))
            aciertos = neurona.setdefault("aciertos", {})
            aciertos[accion] = aciertos.get(accion, 0) + 1
            neurona["accion"] = self._elegir(neurona)
            if self.por_concepto:
                miedo = self.miedos.get(neurona["concepto"])
                if miedo and miedo.get(accion):
                    miedo[accion] *= EXTINCION_MIEDO

    def proteger(self):
        return self._leccion(self._proteger)

    def _proteger(self):
        """
        CONSOLIDACIÓN DE UN EPISODIO SUPERADO: cada concepto general que decidió en la pasada ganadora queda protegido
        con la acción que usó; después, sus correcciones se guardan como excepción del lugar y no lo reescriben.
        Devuelve cuántas neuronas quedaron protegidas.
        """
        protegidas = set()
        for situacion, activo, accion, _firma, excepcion in self.historial:
            if not activo or excepcion or self.percepcion.tranquila(situacion) or situacion in protegidas:
                continue
            neurona = self.neuronas.setdefault(situacion, self._nueva(situacion, accion=accion))
            if neurona["accion"] == accion:   # la respuesta que de verdad funcionó (no una prestada distinta)
                neurona["protegida"] = True
                protegidas.add(situacion)
        return len(protegidas)

    # ---- la recompensa interna (homeostasis) -----------------------------------------------------------------

    def sentir(self, impulso, umbral=UMBRAL_HOMEOSTASIS):
        """
        RECOMPENSA HOMEOSTÁTICA (Keramati y Gutkin 2014): el cuerpo da su impulso (lo lejos que está de su equilibrio:
        hambre, sed, dolor...) y la recompensa es cuánto ha bajado desde la última vez. Solo los cambios bruscos
        (fásicos, como la dopamina) cuentan: si baja al menos UMBRAL_HOMEOSTASIS, devuelve 1 (lo hecho fue bueno);
        si sube al menos eso, -1 (fue malo); si no, 0. Quien juega aplica la lección (consolidar o aprender del fracaso).
        """
        previo, self._impulso = self._impulso, impulso
        if previo is None:
            return 0
        r = previo - impulso
        if r >= umbral:
            return 1
        if r <= -umbral:
            return -1
        return 0

    # ---- las metas sostenidas -------------------------------------------------------------------------------

    def fijar_meta(self, nombre):
        """
        META SOSTENIDA (la corteza prefrontal mantiene un objetivo; O'Reilly y Frank 2006): mientras está activa, el
        progreso hacia ella cuenta. Fijar la misma meta otra vez no la reinicia.
        """
        if self.meta is None or self.meta["nombre"] != nombre:
            self.meta = {"nombre": nombre, "tramos": 0}

    def soltar_meta(self):
        self.meta = None

    def avanzar_meta(self, fraccion):
        """
        PROGRESO POR TRAMOS (submetas; Botvinick 2009): `fraccion` es lo cubierto de la meta (0 a 1). Cada tramo nuevo de
        TRAMO_META devuelve 1 (un logro: quien juega lo consolida); si se pierde terreno, se cuentan los tramos de nuevo
        sin castigo. Sin meta activa, 0.
        """
        if self.meta is None:
            return 0
        tramos = int(min(1.0, max(0.0, fraccion)) / TRAMO_META + 1e-9)
        if tramos > self.meta["tramos"]:
            self.meta["tramos"] = tramos
            return 1
        if tramos < self.meta["tramos"]:
            self.meta["tramos"] = tramos
        return 0

    # ---- la decepción (error de predicción) ------------------------------------------------------------------

    def decepcionar(self, peso=PESO_DECEPCION):
        return self._leccion(self._decepcionar, peso)

    def _decepcionar(self, peso):
        """
        ERROR DE PREDICCIÓN (la dopamina, Schultz): si la última decisión activa usó una acción que en esa situación ya
        había salido bien (tiene aciertos) y esta vez no ha dado nada, cuenta como un fallo pequeño (`peso`). Sin
        expectativa no hay decepción. Devuelve la acción que queda, o None.
        """
        for situacion, activo, accion, firma, excepcion in reversed(self.historial):
            if not activo:
                continue
            memoria, clave = (self.excepciones, f"{situacion}|{firma}") if excepcion else (self.neuronas, situacion)
            neurona = memoria.get(clave)
            if not neurona or neurona.get("aciertos", {}).get(accion, 0) <= 0:
                return None
            neurona["fallos"][accion] = neurona["fallos"].get(accion, 0) + peso
            neurona["accion"] = self._elegir(neurona)
            return neurona["accion"]
        return None

    # ---- el repaso durante el sueño (replay) ------------------------------------------------------------------

    def repasar(self, entradas, exito, peso=1.0):
        return self._leccion(self._repasar, entradas, exito, peso)

    def _repasar(self, entradas, exito, peso):
        """
        REPASO (la reactivación del hipocampo durante el sueño, Wilson y McNaughton): quien juega guarda unas decisiones
        de hace tiempo (situación, acción) y, al saber cómo acabó aquello, las repasa: si salió bien, cada una suma
        `peso` aciertos a su acción; si salió mal, `peso` fallos. Cada neurona vuelve a elegir. Une causas y efectos
        separados por meses, que la culpa normal (lo último que hizo) no alcanza. Lo que sale bien apaga además el
        miedo del concepto (extinción). Devuelve cuántas neuronas cambiaron.
        """
        cambiadas = 0
        for situacion, accion in entradas:
            if accion not in self.acciones or self.percepcion.tranquila(situacion):
                continue
            neurona = self.neuronas.setdefault(situacion, self._nueva(situacion))
            antes = neurona["accion"]
            if exito:
                aciertos = neurona.setdefault("aciertos", {})
                aciertos[accion] = aciertos.get(accion, 0) + peso
                # (EXTINCIÓN POR ÉXITO: lo que sale bien al repasarlo —también el alivio de un mal que no llegó— apaga
                # el miedo del concepto como lo apaga una recompensa del cuerpo, en proporción al peso)
                if self.por_concepto:
                    miedo = self.miedos.get(neurona["concepto"])
                    if miedo and miedo.get(accion):
                        miedo[accion] *= EXTINCION_MIEDO ** peso
            else:
                neurona["fallos"][accion] = neurona["fallos"].get(accion, 0) + peso
            neurona["accion"] = self._elegir(neurona)
            if neurona["accion"] != antes:
                cambiadas += 1
        return cambiadas

    # ---- aprender de los fracasos -----------------------------------------------------------------------------

    def aprender_de_fracaso(self, lugar=None):
        return self._leccion(self._aprender_de_fracaso, lugar)

    def _aprender_de_fracaso(self, lugar):
        """
        PLASTICIDAD: la culpa se reparte entre las últimas situaciones activas (la más reciente carga con todo, la
        anterior con la mitad...). Cada neurona suma fallos a la acción que eligió y elige la de mejor tasa de éxito.

        CALLEJÓN SIN SALIDA (si se indica `lugar`, dónde fracasó): cuando fracasa una y otra vez en el mismo sitio y la
        situación culpada ya probó ahí todas sus acciones, se congela como excepción de ese lugar con la acción que más
        lejos llegó y la culpa pasa a la anterior. Si se agotan todas, se amplía la memoria de culpables.

        Devuelve (concepto, situación, nueva acción, retroceso) del principal culpable, o None.
        """
        callejon = self._callejon(lugar) if lugar is not None else None
        ventana = 60 * (1 + (callejon["agotado"] if callejon else 0))
        culpables, recencia, contexto = {}, {}, {}
        # la recencia se cuenta en ticks activos: sin poder actuar, el cerebro no pudo equivocarse
        i = 0
        for situacion, activo, accion, firma, excepcion in reversed(self.historial):
            if not activo:
                continue
            if i >= ventana:
                break
            if not self.percepcion.tranquila(situacion) and situacion not in culpables:
                culpables[situacion], recencia[situacion], contexto[situacion] = accion, i, (firma, excepcion)
            i += 1
        orden = list(culpables)

        retroceso = self._retroceso_en_callejon(callejon, orden, culpables, contexto) if callejon else 0
        if callejon and orden and retroceso >= len(orden):
            # todas agotadas: empezar de nuevo en este sitio mirando más atrás; la memoria de trabajo es de corta
            # duración y tras varios agotamientos se borra
            agotado = callejon["agotado"] + 1
            callejon.update(retroceso=0, pruebas={}, agotado=0 if agotado > MAX_AGOTADO else agotado)
            return None
        orden = [s for s in orden if recencia[s] < 20] if retroceso == 0 else orden[retroceso:]

        for i, situacion in enumerate(orden[:4]):
            firma, excepcion = contexto[situacion]
            general = self.neuronas.get(situacion)
            if not excepcion and general and (general.get("protegida") or self.separar and general.get("conflicto")):
                # SEPARACIÓN DE PATRONES: la corrección se guarda solo para este lugar (el general no se toca)
                excepcion = True
                self.excepciones.setdefault(f"{situacion}|{firma}",
                                            self._nueva(situacion, accion=general["accion"], concepto=general["concepto"]))
            memoria, clave = (self.excepciones, f"{situacion}|{firma}") if excepcion else (self.neuronas, situacion)
            neurona = memoria.setdefault(clave, self._nueva(situacion))
            antes = neurona["accion"]
            neurona["fallos"][culpables[situacion]] = neurona["fallos"].get(culpables[situacion], 0) + 0.5 ** i
            if self.por_concepto:
                miedo = self.miedos.setdefault(neurona["concepto"], {})
                miedo[culpables[situacion]] = miedo.get(culpables[situacion], 0) + 0.5 ** i
            neurona["accion"] = self._elegir(neurona)
            if self.separar and not excepcion and lugar is not None and neurona["accion"] != antes:
                # cada cambio de respuesta del concepto general anota dónde se fracasó; si cambia una y otra vez por
                # fracasos en sitios distintos, es un conflicto entre lugares
                sitios = neurona.setdefault("sitios_cambio", [])
                sitios.append(round(lugar / TOLERANCIA_LUGAR))
                if len(sitios) >= CAMBIOS_CONFLICTO and len(set(sitios)) >= 2:
                    neurona["conflicto"] = True

        if not orden:
            return None
        principal = orden[0]
        return self.neuronas[principal]["concepto"], principal, self.neuronas[principal]["accion"], retroceso

    def _callejon(self, lugar):
        """Memoria de trabajo del sitio donde fracasó (se crea la primera vez)."""
        callejon = next((c for c in self.callejones if abs(c["lugar"] - lugar) <= TOLERANCIA_LUGAR), None)
        if callejon is None:
            callejon = {"lugar": lugar, "retroceso": 0, "pruebas": {}, "agotado": 0}
            self.callejones.append(callejon)
        return callejon

    def agotado(self, lugar):
        """Cuántas veces se agotaron todas las situaciones recordadas en ese sitio."""
        return self._callejon(lugar)["agotado"]

    def _retroceso_en_callejon(self, callejon, orden, culpables, contexto):
        """Qué probó cada situación en este sitio y hasta dónde llegó; devuelve cuántas recientes están agotadas."""
        lugar = callejon["lugar"]
        for situacion in orden:
            pruebas = callejon["pruebas"].setdefault(situacion, {})
            pruebas[culpables[situacion]] = max(pruebas.get(culpables[situacion], lugar), lugar)
        while callejon["retroceso"] < len(orden):
            situacion = orden[callejon["retroceso"]]
            pruebas = callejon["pruebas"][situacion]
            if not all(a in pruebas for a in self.acciones):
                break
            # agotada: se fija la acción que más lejos llegó COMO EXCEPCIÓN DE ESTE LUGAR y la culpa retrocede
            mejor = max(self.acciones, key=lambda a: pruebas[a])
            self.excepciones[f"{situacion}|{contexto[situacion][0]}"] = {
                "concepto": self.percepcion.nombrar(situacion),
                "fallos": {a: (0 if a == mejor else 0.01) for a in self.acciones},
                "accion": mejor,
            }
            callejon["retroceso"] += 1
        return callejon["retroceso"]

    # ---- memoria ------------------------------------------------------------------------------------------------

    def neuronas_activas(self):
        """Las que cambian la conducta: con la acción de reposo equivalen a no tener neurona."""
        return {s: n for s, n in self.neuronas.items() if n["accion"] != self.reposo}

    def conceptos(self):
        """Cuántas situaciones (campos receptivos) tiene cada neurona de concepto."""
        conteo = {}
        for neurona in self.neuronas_activas().values():
            conteo[neurona["concepto"]] = conteo.get(neurona["concepto"], 0) + 1
        return conteo

    def recortar(self, capacidad=None, cuota_protegidas=0.6):
        """
        MEMORIA DE TAMAÑO ACOTADO. EXPERIMENTAL: solo en Python, fuera de docs/COMO-FUNCIONA.md hasta que demuestre que no empeora
        (ver NOCHE.md). Dos pasos:

        1. COMPACTAR: una neurona libre (no protegida) que responde con el reposo y nunca ha fallado decide lo mismo que
           no tenerla. Se quita, salvo que su voto cambie lo que su concepto hace por generalización (entonces se
           quedan todas las de ese concepto). Lo que se pierde es la firmeza de sus aciertos: si un día falla, cambia
           a la primera.
        2. TOPE: si aún hay más de `capacidad` neuronas (con las excepciones), sale lo de menos experiencia (aciertos +
           fallos), primero lo libre. Lo protegido no pasa de `cuota_protegidas` de la capacidad: si se pasa, lo
           protegido con menos experiencia deja de estarlo (y compite por el sitio).

        Devuelve (compactadas, recortadas).
        """
        def experiencia(n):
            return sum(n["fallos"].values()) + sum(n.get("aciertos", {}).values())

        # (una neurona general con excepciones las sostiene: aprender de una excepción consulta su general)
        con_excepciones = {clave.rsplit("|", 1)[0] for clave in self.excepciones}

        # 1. compactar, concepto a concepto
        self._votos = None
        candidatas = {}
        for situacion, n in self.neuronas.items():
            if (n["accion"] == self.reposo and not n.get("protegida") and not n.get("conflicto")
                    and not any(n["fallos"].values()) and situacion not in con_excepciones):
                candidatas.setdefault(n["concepto"], []).append(situacion)
        compactadas = 0
        for concepto, situaciones in candidatas.items():
            antes = self._respuesta_del_concepto(concepto)
            votos = self._votos_del_concepto(concepto)
            votos[self.reposo] = votos.get(self.reposo, 0) - len(situaciones)
            despues = self._respuesta_del_concepto(concepto)
            votos[self.reposo] += len(situaciones)
            if despues != antes:
                continue
            for situacion in situaciones:
                del self.neuronas[situacion]
            compactadas += len(situaciones)
        self._votos = None

        # 2. tope
        recortadas = 0
        if capacidad and len(self.neuronas) + len(self.excepciones) > capacidad:
            protegidas = sorted((n for n in self.neuronas.values() if n.get("protegida")), key=experiencia)
            for n in protegidas[:max(0, len(protegidas) - int(capacidad * cuota_protegidas))]:
                n["protegida"] = False
            todas = [(experiencia(n), memoria is self.excepciones, clave, memoria)
                     for memoria in (self.neuronas, self.excepciones)
                     for clave, n in memoria.items()
                     if not n.get("protegida") and not (memoria is self.neuronas and clave in con_excepciones)]
            todas.sort(key=lambda t: (t[0], t[1], t[2]))   # (orden estable: experiencia, primero neuronas, clave)
            sobran = len(self.neuronas) + len(self.excepciones) - capacidad
            for _, _, clave, memoria in todas[:sobran]:
                del memoria[clave]
                recortadas += 1
            self._votos = None
        return compactadas, recortadas

    def guardar(self):
        if self.ruta_memoria:
            datos = {"neuronas": self.neuronas, "excepciones": self.excepciones}
            self.ruta_memoria.write_text(json.dumps(datos, ensure_ascii=False, indent=2), encoding="utf-8")

    def cargar(self):
        datos = json.loads(self.ruta_memoria.read_text(encoding="utf-8"))
        self.neuronas, self.excepciones = datos["neuronas"], datos.get("excepciones", {})


# ==== MEMORIA DE SUCESOS Y DE RUTAS (EXPERIMENTAL) ===================================================================
# Nacieron en HER (https://foko-games.itch.io/her, el juego de plataformas donde Neutro juega en directo y que llegó a terminar entero) y
# aquí no saben a qué juego se juega. EXPERIMENTAL: solo en Python y fuera de docs/COMO-FUNCIONA.md hasta que demuestren una mejora
# medida en un juego de la NES (ver NOCHE.md). No tocan las decisiones del Nucleo: quien juega decide cómo usarlas.

UMBRAL_PREDICCION = 0.3   # fuerza mínima de un vínculo (y 2 veces vistos) para esperar su efecto
CASTIGO_SORPRESA = 0.5    # lo que pierde el peso de un vínculo cuando lo esperado no llega
UMBRAL_OLVIDO = 0.3       # por debajo (peso y previa), el vínculo se olvida
DESCUENTO_INFERENCIA = 0.8  # una relación deducida (A→B→C) vale algo menos que el eslabón más débil


class Asociaciones:
    """
    ASOCIAR, como las neuronas de concepto: lo que pasa junto queda enlazado. Cada suceso (una cadena: "romper un orbe",
    "se abre la puerta", "morir") se une a los que ocurrieron en la `ventana` anterior, en ese orden: A y luego B.

    - La FUERZA de un vínculo no es cuántas veces ha pasado (lo frecuente se asociaría con todo), sino cuánto más de lo
      esperable: juntos / raíz(veces de A · veces de B).
    - PREDICCIÓN: tras A, se espera durante una `ventana` el B de cada vínculo fuerte y repetido. Si llega, se cumple;
      si no, es una SORPRESA y el vínculo se debilita (Quian Quiroga: la memoria se fija en lo que no encaja).
    - REQUISITO frente a CAUSA: `previa` cuenta las veces que B vino tras A sin restar sorpresas. Mide si A es requisito
      de B ("la puerta no se abre sin romper antes un orbe") aunque A no siempre traiga B (solo el último orbe la abre).
      Con CONTRASTE: se resta lo que A aparecería antes de B por puro azar, según lo frecuente que es A. Sin eso, un
      suceso constante ("ver un peligro") parecía requisito de todo (en HER no importaba: el código elegía el par).

    El tiempo (`ahora`) lo pone quien juega, en la unidad que quiera (ticks, frames, segundos), igual que la `ventana`.
    """

    def __init__(self, ventana, capacidad=120, ventana_valencia=80):
        self.ventana = ventana
        self.capacidad = capacidad
        self.ventana_valencia = ventana_valencia   # (valencia) cuánto después de un suceso se mira cómo quedó el cuerpo
        self.valencia = {}      # suceso -> lo que empeora (+) o mejora (-) el cuerpo después, de media
        self.pendientes = []    # [(suceso, cuando, impulso entonces)] esperando a ver cómo queda el cuerpo
        self.impulso = None     # el último impulso del cuerpo que se sintió
        self.vinculos = {}      # "A→B" -> {"a", "b", "peso", "previa", "veces"}
        self.frecuencias = {}   # suceso -> veces (se desvanece con el olvido)
        self.recientes = []     # [(suceso, cuando)] dentro de la ventana
        self.esperando = []     # [(causa, efecto, hasta)]
        self.cumplidas = 0
        self.sorpresas = 0
        self.ultima_sorpresa = None
        self.tiempo = 0.0       # tiempo vivido (se desvanece con el olvido, igual que las frecuencias)
        self.ultimo = None      # el último momento visto

    def suceso(self, que, ahora):
        """
        Algo ha pasado: cumple lo que se esperaba, se enlaza con lo reciente y predice lo que suele venir detrás.
        Devuelve las expectativas que se han cumplido ([(causa, efecto)]), por si quien juega quiere aprender de ellas.
        """
        if self.impulso is not None:
            self.pendientes.append((que, ahora, self.impulso))
        self._pasar(ahora)
        cumplidas = []
        for i in range(len(self.esperando) - 1, -1, -1):
            if self.esperando[i][1] == que:
                self.cumplidas += 1
                cumplidas.append((self.esperando[i][0], que))
                del self.esperando[i]
        self.recientes = [(q, t) for q, t in self.recientes if ahora - t <= self.ventana]
        for antes, t in self.recientes:
            if antes == que:
                continue
            v = self.vinculos.setdefault(f"{antes}→{que}", {"a": antes, "b": que, "peso": 0.0, "previa": 0.0, "veces": 0})
            v["peso"] += 1.0
            v["previa"] += 1.0
            v["veces"] += 1
            # (CUÁNTO TARDA: el retardo típico de B tras A, media móvil; Gallistel y Gibbon, la medida del intervalo)
            v["retardo"] = (ahora - t) if "retardo" not in v else v["retardo"] * 0.8 + (ahora - t) * 0.2
        self.recientes.append((que, ahora))
        self.frecuencias[que] = self.frecuencias.get(que, 0.0) + 1.0
        for v in self.vinculos.values():
            if v["a"] != que or v["veces"] < 2 or self.fuerza(v["a"], v["b"]) < UMBRAL_PREDICCION:
                continue
            if any(efecto == v["b"] for _, efecto, _ in self.esperando):
                continue
            self.esperando.append((que, v["b"], ahora + self.ventana))
        return cumplidas

    def _pasar(self, ahora):
        # (si el reloj de quien juega vuelve a empezar, p. ej. en una vida nueva, ese salto no cuenta)
        if self.ultimo is not None and ahora > self.ultimo:
            self.tiempo += ahora - self.ultimo
        self.ultimo = ahora

    def vigilar(self, ahora):
        """Lo esperado que no llegó a tiempo: sorpresas. Devuelve la lista de (causa, efecto) sorprendidos."""
        self._pasar(ahora)
        sorprendidos = []
        for i in range(len(self.esperando) - 1, -1, -1):
            causa, efecto, hasta = self.esperando[i]
            if ahora <= hasta:
                continue
            del self.esperando[i]
            self.sorpresas += 1
            v = self.vinculos.get(f"{causa}→{efecto}")
            if v:
                v["peso"] = max(0.0, v["peso"] - CASTIGO_SORPRESA)
            self.ultima_sorpresa = (causa, efecto)
            sorprendidos.append((causa, efecto))
        return sorprendidos

    def fuerza(self, a, b):
        """Cuánto más de lo esperable van juntos A y luego B (0 si nunca)."""
        v = self.vinculos.get(f"{a}→{b}")
        if not v:
            return 0.0
        fa, fb = self.frecuencias.get(a, 1.0), self.frecuencias.get(b, 1.0)
        return v["peso"] / (max(1.0, fa) * max(1.0, fb)) ** 0.5

    def observar(self, contexto, que, peso=0.5):
        """
        APRENDER VIENDO A OTROS (el miedo por observación, Olsson y Phelps 2007): a otro le ha pasado `que` después de
        `contexto` (lo que vivió justo antes). Cada suceso del contexto queda enlazado con `que` como si se hubiera
        vivido, pero con `peso` (menos que lo propio). No crea expectativas ni valencia: eso es de lo vivido.
        """
        for antes in contexto:
            if antes == que:
                continue
            v = self.vinculos.setdefault(f"{antes}→{que}", {"a": antes, "b": que, "peso": 0.0, "previa": 0.0, "veces": 0})
            v["peso"] += peso
            v["previa"] += peso
            v["veces"] += peso
        self.frecuencias[que] = self.frecuencias.get(que, 0.0) + peso

    def sentir(self, impulso, ahora):
        """
        VALENCIA (la amígdala aprende lo que vale cada cosa por cómo queda el cuerpo después): quien juega da el impulso
        del cuerpo (lo lejos que está de su equilibrio). De cada suceso de hace al menos `ventana_valencia`, la diferencia
        entre el impulso de ahora y el de entonces se suma a su valencia (media móvil, 20 %): positiva si después el cuerpo
        estuvo peor, negativa si mejor. Nadie le dice qué es bueno o malo.
        """
        self.impulso = impulso
        quedan = []
        for que, cuando, antes in self.pendientes:
            if ahora - cuando < self.ventana_valencia:
                quedan.append((que, cuando, antes))
                continue
            v = self.valencia.get(que, 0.0)
            self.valencia[que] = v + 0.2 * ((impulso - antes) - v)
        self.pendientes = quedan[-400:]

    def inferida(self, a, c):
        """
        INFERENCIA TRANSITIVA (el hipocampo, Eichenbaum): si A lleva a B y B lleva a C (cada vínculo visto al menos dos
        veces y con fuerza de predicción), A lleva a C aunque nunca se hayan visto juntos. Devuelve la fuerza deducida:
        la del eslabón más débil, rebajada (DESCUENTO_INFERENCIA); 0 si no hay cadena.
        """
        if a == c:
            return 0.0   # una cadena que vuelve al mismo suceso no deduce nada
        mejor = 0.0
        for v in self.vinculos.values():
            if v["a"] != a or v["b"] == c or v["veces"] < 2:
                continue
            f1 = self.fuerza(a, v["b"])
            if f1 < UMBRAL_PREDICCION:
                continue
            w = self.vinculos.get(f"{v['b']}→{c}")
            if not w or w["veces"] < 2:
                continue
            f2 = self.fuerza(v["b"], c)
            if f2 < UMBRAL_PREDICCION:
                continue
            mejor = max(mejor, min(f1, f2) * DESCUENTO_INFERENCIA)
        return mejor

    def requisito(self, a, b, minimo_veces=2):
        """
        De las veces que pasó B, qué parte vino tras A (con `previa`, que las sorpresas no rebajan), MENOS la parte que
        vendría tras A por azar: la probabilidad de que un momento cualquiera tenga un A en su ventana anterior, que es
        veces de A · ventana / tiempo vivido (hasta 1). Entre -1 y 1; 0 si el vínculo no se ha repetido. En HER, sin el
        contraste, bastaba 0,3 porque el par lo elegía el código.
        """
        v = self.vinculos.get(f"{a}→{b}")
        veces_b = self.frecuencias.get(b, 0.0)
        if not v or v["veces"] < minimo_veces or veces_b <= 0:
            return 0.0
        tiempo = max(self.ventana, self.tiempo)
        azar = min(1.0, self.frecuencias.get(a, 0.0) * self.ventana / tiempo)
        return min(1.0, v["previa"] / veces_b) - azar

    def espera(self, efecto):
        """Si ahora mismo espera que pase `efecto`."""
        return any(e == efecto for _, e, _ in self.esperando)

    def mas_fuertes(self, n=3):
        """Los vínculos repetidos más fuertes: [(a, b, fuerza, veces)]."""
        lista = [v for v in self.vinculos.values() if v["veces"] >= 2]
        lista.sort(key=lambda v: -self.fuerza(v["a"], v["b"]))
        return [(v["a"], v["b"], self.fuerza(v["a"], v["b"]), v["veces"]) for v in lista[:n]]

    def olvidar(self, olvido):
        """El repaso (en HER, en cada vida nueva): todo se desvanece con raíz(olvido); lo débil se olvida; y el tope."""
        factor = olvido ** 0.5
        for clave in list(self.vinculos):
            v = self.vinculos[clave]
            v["peso"] *= factor
            v["previa"] *= factor
            if v["peso"] < UMBRAL_OLVIDO and v["previa"] < UMBRAL_OLVIDO:
                del self.vinculos[clave]
        for que in self.frecuencias:
            self.frecuencias[que] *= factor
        self.tiempo *= factor
        if len(self.vinculos) > self.capacidad:
            sobran = len(self.vinculos) - self.capacidad
            for clave in sorted(self.vinculos, key=lambda k: self.vinculos[k]["peso"])[:sobran]:
                del self.vinculos[clave]

    def a_dict(self):
        return {"vinculos": self.vinculos, "frecuencias": self.frecuencias, "tiempo": self.tiempo}

    def desde_dict(self, datos):
        self.vinculos = datos.get("vinculos", {})
        self.frecuencias = datos.get("frecuencias", {})
        self.tiempo = datos.get("tiempo", 0.0)


class Tramos:
    """
    MEMORIA DE RUTAS: de cada tramo (de un nodo a otro, dentro de una zona: un nivel, una pantalla) cuántas veces se
    recorrió con éxito y cuántas se fracasó intentándolo. Planificar busca el camino más barato (Dijkstra): cada tramo
    cuesta 1, más lo que dice la experiencia: 4 · fallos / (1 + éxitos). Uno donde se ha muerto o atascado sale caro;
    uno recorrido con éxito, barato.

    Qué es un nodo (una casilla, una plataforma) y cuáles son sus vecinos lo pone el mundo: el núcleo no sabe de mapas.
    Los nodos se nombran con str() en las claves, así que deben tener una representación estable.
    """

    def __init__(self, capacidad_por_zona=120):
        self.capacidad_por_zona = capacidad_por_zona
        self.tramos = {}         # "zona|a>b" -> {"exitos", "fallos"}
        self._en_esta_vida = set()
        self._usados = set()

    @staticmethod
    def clave(zona, a, b):
        return f"{zona}|{a}>{b}"

    def _tramo(self, zona, a, b):
        k = self.clave(zona, a, b)
        self._usados.add(k)
        return self.tramos.setdefault(k, {"exitos": 0.0, "fallos": 0.0})

    def exito(self, zona, a, b):
        """Recorrió el tramo. Una sola vez por vida: dar vueltas por el mismo sitio no lo hace más fiable."""
        k = self.clave(zona, a, b)
        t = self._tramo(zona, a, b)
        if k not in self._en_esta_vida:
            self._en_esta_vida.add(k)
            t["exitos"] += 1.0

    def fallo(self, zona, a, b):
        """Murió o se atascó intentando el tramo."""
        self._tramo(zona, a, b)["fallos"] += 1.0

    def coste(self, zona, a, b):
        t = self.tramos.get(self.clave(zona, a, b))
        if not t:
            return 1.0
        return 1.0 + 4.0 * t["fallos"] / (1.0 + t["exitos"])

    def planificar(self, zona, desde, meta, vecinos, coste_extra=None):
        """
        El camino más barato de `desde` al primer nodo que cumpla `meta(nodo)`, sin incluir `desde`. `vecinos(nodo)` da
        los nodos a un tramo; `coste_extra(a, b)` suma lo que el mundo quiera (una casilla sin ver, un enemigo). Ante
        empate de coste, el primero que se abrió. [] si no hay camino (o si ya está en la meta).
        """
        coste = {desde: 0.0}
        previo = {desde: desde}
        abiertos = [(0.0, 0, desde)]
        contador = 1
        llegada = None
        while abiertos:
            c, _, n = heapq.heappop(abiertos)
            if c > coste[n]:
                continue
            if meta(n):
                llegada = n
                break
            for v in vecinos(n):
                nuevo = c + self.coste(zona, n, v) + (coste_extra(n, v) if coste_extra else 0.0)
                if v in coste and coste[v] <= nuevo:
                    continue
                coste[v] = nuevo
                previo[v] = n
                heapq.heappush(abiertos, (nuevo, contador, v))
                contador += 1
        if llegada is None or llegada == desde:
            return []
        camino = []
        n = llegada
        while n != desde:
            camino.append(n)
            n = previo[n]
        camino.reverse()
        return camino

    def nueva_vida(self):
        self._en_esta_vida.clear()

    def olvidar(self, zona, olvido):
        """
        El repaso: solo se desvanece lo de la zona en la que está, y no lo que ha usado desde el último repaso (en HER,
        cada muerte en el nivel 6 borraba poco a poco el mapa del 1). Lo casi vacío se olvida; y el tope por zona.
        """
        prefijo = f"{zona}|"
        for k in [k for k in self.tramos if k.startswith(prefijo) and k not in self._usados]:
            t = self.tramos[k]
            t["exitos"] *= olvido
            t["fallos"] *= olvido
            if t["exitos"] + t["fallos"] < UMBRAL_OLVIDO:
                del self.tramos[k]
        self._usados.clear()
        por_zona = {}
        for k in self.tramos:
            por_zona.setdefault(k.split("|", 1)[0], []).append(k)
        for claves in por_zona.values():
            if len(claves) > self.capacidad_por_zona:
                claves.sort(key=lambda k: self.tramos[k]["exitos"] + self.tramos[k]["fallos"])
                for k in claves[:len(claves) - self.capacidad_por_zona]:
                    del self.tramos[k]

    def a_dict(self):
        return {"tramos": self.tramos}

    def desde_dict(self, datos):
        self.tramos = datos.get("tramos", {})
