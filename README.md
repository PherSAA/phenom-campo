# Phenom · Prueba de campo (célula en el celular)

Página web estática para probar en celulares reales la idea de la **llave** y el **split run**: cada celular corre una "célula" que trabaja sin parar, y se compara el consumo de batería entre dos modos:

- **Siempre encendido**: la célula trabaja todo el tiempo.
- **Metro**: alterna trabajo y descanso (como los trenes: más en hora pico, menos en la noche), con un servicio mínimo que nunca se apaga.

> ⚠️ Es una **simulación / XRPL testnet**. **No mueve dinero real** y no contiene llaves privadas: la llave de firma se genera en tu propio navegador y no sale de él.

## Cómo usarla en el celular

1. Carga el celular al 100 % y desconéctalo.
2. Abre https://phersaa.github.io/phenom-campo/ en el navegador.
3. Escribe un nombre para el celular, elige el modo (uno en *Siempre encendido* y otro en *Metro*) y el % de batería inicial.
4. Toca **Iniciar**. Deja la pantalla encendida y la página al frente.
5. A mitad de la prueba toca **Simular desastre**, firma 2 o 3 pagos y toca **Duplicar** (doble gasto). Luego termina el desastre.
6. Después de 1–2 horas toca **Parar**, escribe el % de batería final y usa **Compartir** o **Descargar** para enviar el resultado (JSON).

## Notas

- En iPhone, Safari no da el nivel de batería: escríbelo a mano.
- Si el celular cambia de app o se bloquea, el navegador congela el trabajo.
- **Liquidar** necesita un servidor de liquidación (campo "Servidor de liquidación"); en GitHub Pages no hay servidor, así que los pagos quedan guardados en cola en el celular.
- Incluye [TweetNaCl](https://github.com/dchest/tweetnacl-js) (dominio público, ver `vendor/tweetnacl-LICENSE`).
