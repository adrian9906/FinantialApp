# Recuperar los datos y pasar a un servidor propio

Neon corta las conexiones cuando se pasa la cuota de transferencia, con este
error:

```
Your project has exceeded the data transfer quota. Upgrade your plan to increase limits.
```

El servidor rechaza la conexion antes de aceptar consultas, asi que **no se
puede sacar nada con `pg_dump` ni con ninguna otra herramienta** mientras la
cuota siga excedida. No es que los datos se hayan perdido: estan ahi, pero la
puerta esta cerrada.

Hay dos caminos.

## Camino A (recomendado): recuperar desde el navegador

La app guarda una copia completa de tus datos en el propio dispositivo
(IndexedDB), justo para funcionar sin conexion. De ahi se puede sacar todo sin
tocar Neon.

1. Abre la app en el navegador donde la usas, **con tu sesion iniciada**.
2. Pulsa `F12` y ve a la pestana **Console**.
3. Pega el contenido de `exportar-datos-navegador.js` y pulsa Enter.
4. Se descarga `plata-backup-<fecha>.json`. El script imprime un resumen
   (cuantos gastos, ingresos, etc.) para que verifiques antes de confiar en el.

Guarda ese archivo en un lugar seguro: es tu respaldo.

> Si usas la app tambien en el movil, exporta en **los dos** y quedate con el
> que tenga mas registros.

## Camino B: esperar o pagar

La cuota de transferencia de Neon se reinicia al empezar el nuevo ciclo de
facturacion. Si puedes esperar, la base vuelve sola y entonces si funciona:

```bash
pg_dump "postgresql://usuario:clave@host/neondb?sslmode=require" \
  --no-owner --no-privileges > neondb-dump.sql
```

Subir de plan un solo mes tambien reabre la conexion para hacer el dump.

## Montar tu propio Postgres

Con Docker, en el servidor:

```bash
docker run -d --name plata-db \
  -e POSTGRES_PASSWORD='una-clave-larga' \
  -e POSTGRES_DB=plata \
  -p 5432:5432 \
  -v /ruta/segura/plata-data:/var/lib/postgresql/data \
  --restart unless-stopped \
  postgres:17-alpine
```

El volumen (`-v`) es lo que hace que los datos sobrevivan si el contenedor se
borra. No lo omitas.

Luego apunta el backend a esa base en `apps/api/.env`:

```
DATABASE_URL="postgresql://postgres:una-clave-larga@TU_SERVIDOR:5432/plata"
DIRECT_URL="postgresql://postgres:una-clave-larga@TU_SERVIDOR:5432/plata"
```

Y crea las tablas:

```bash
cd apps/api
./node_modules/.bin/prisma migrate deploy
```

## Restaurar el respaldo

1. Registra tu usuario en la app apuntando ya al servidor nuevo (necesita
   existir antes de restaurar).
2. Comprueba primero que el archivo trae lo que esperas, sin escribir nada:

```bash
cd apps/api
./node_modules/.bin/tsx src/restaurar-backup.mts /ruta/plata-backup-2026-09-11.json --correo tu@correo
```

3. Si el resumen cuadra, aplica:

```bash
./node_modules/.bin/tsx src/restaurar-backup.mts /ruta/plata-backup-2026-09-11.json --correo tu@correo --aplicar
```

Escribe por el mismo camino que usa la sincronizacion normal, asi que los datos
quedan igual que si se hubieran sincronizado desde la app. Las filas que ya
existan en el destino se omiten y se avisan, en vez de duplicarse.

## Si tienes un dump SQL (camino B)

```bash
psql "postgresql://postgres:clave@TU_SERVIDOR:5432/plata" < neondb-dump.sql
```

## Respaldos de aqui en adelante

Para no volver a depender de esto, programa un dump periodico:

```bash
docker exec plata-db pg_dump -U postgres plata > plata-$(date +%F).sql
```
