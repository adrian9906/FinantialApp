# Recuperación de Plata en PostgreSQL autogestionado

El respaldo `plata-backup-2026-09-11.json` se importa a las tablas relacionales actuales, no como un único JSON. Se encontró un documento de sincronización: `f8228346-1a7d-4993-991d-a9117a3588ce`.

| Datos revisados | Registros |
| --- | ---: |
| Salarios / fuentes de ingreso | 5 / 3 |
| Transacciones / deudas | 57 / 2 |
| Deseos / historial mensual | 24 / 7 |
| Metas / suscripciones | 1 / 1 |
| Eventos, proyecciones, recordatorios | 0 / 0 / 0 |

La imagen incluida como `data:image/...` se conserva. El archivo no guarda correo, contraseña ni sesiones. La semilla crea por defecto `adriandfl99@gmail.com` con la contraseña temporal configurada para esta recuperación; cámbiala tras el primer acceso. Sí contiene en `localStorage` las monedas y fórmulas de ahorro, que la semilla transfiere a `PreferenciaUsuario`; los ajustes visuales y las reglas de categorías permanecen del lado del cliente.

Si en el futuro Neon vuelve a estar disponible, usa `pg_dump` con su URL directa para obtener también una copia SQL. Mientras un proyecto de Neon rechace conexiones por cuota, este JSON de IndexedDB es la fuente recuperable.

## PostgreSQL en Ubuntu

Instala PostgreSQL nativo. Si la API también vive en este servidor, deja PostgreSQL escuchando solo en `127.0.0.1`; no abras 5432 a Internet.

```bash
sudo apt update
sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable --now postgresql
sudo -u postgres psql
```

En `psql`, reemplaza las claves por secretos largos URL-seguros (sin `@`, `:`, `/` ni espacios):

```sql
CREATE ROLE plata_migrator LOGIN PASSWORD 'CLAVE_LARGA_DE_MIGRACIONES';
CREATE ROLE plata_app LOGIN PASSWORD 'CLAVE_LARGA_DE_APLICACION';
CREATE DATABASE plata OWNER plata_migrator;
\c plata
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO plata_app;
```

Comprueba el listener local:

```bash
sudo ss -ltnp | grep 5432
```

Si dejas la API en Vercel, una base local de Ubuntu no es accesible directamente. Aloja también la API en Ubuntu o usa VPN/red privada y TLS; no publiques PostgreSQL para resolverlo.

### Alternativa con Docker

Si prefieres Docker en vez del paquete nativo, usa un volumen persistente y publica solo en localhost:

```bash
docker run -d --name plata-db \
  -e POSTGRES_PASSWORD='CLAVE_LARGA_DE_MIGRACIONES' \
  -e POSTGRES_DB=plata \
  -p 127.0.0.1:5432:5432 \
  -v /srv/plata/postgres:/var/lib/postgresql/data \
  --restart unless-stopped postgres:17
```

## Configurar Prisma y aplicar migraciones

En el checkout del proyecto, crea `apps/api/.env` a partir de `apps/api/.env.example`:

```dotenv
DATABASE_URL="postgresql://plata_app:CLAVE_LARGA_DE_APLICACION@127.0.0.1:5432/plata?schema=public"
DIRECT_URL="postgresql://plata_migrator:CLAVE_LARGA_DE_MIGRACIONES@127.0.0.1:5432/plata?schema=public"
SESSION_SECRET="secreto-aleatorio-de-al-menos-32-bytes"
APP_URL="https://tu-dominio.example"
CORS_ALLOWED_ORIGINS="https://tu-dominio.example"
```

`DATABASE_URL` es la conexión de la API. `DIRECT_URL` usa el rol de migración y sirve para Prisma CLI y recuperación. Nunca copies estas variables al frontend/Vite.

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm --dir apps/api db:generate
pnpm --dir apps/api db:migrate:deploy
```

Después de migrar, concede permisos mínimos al proceso de aplicación:

```bash
sudo -u postgres psql -d plata
```

```sql
GRANT USAGE ON SCHEMA public TO plata_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO plata_app;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO plata_app;
ALTER DEFAULT PRIVILEGES FOR ROLE plata_migrator IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO plata_app;
ALTER DEFAULT PRIVILEGES FOR ROLE plata_migrator IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO plata_app;
```

## Validar e importar

Primero valida el JSON sin conexión a PostgreSQL:

```bash
pnpm --dir apps/api db:seed:recovery:check
```

La importación reemplaza solamente las colecciones recuperables del usuario elegido y no afecta a otros usuarios. Se requiere una confirmación explícita.

```bash
RECOVERY_CONFIRM=replace pnpm --dir apps/api db:seed:recovery
```

Puedes sustituir los valores predeterminados sin editar código mediante `RECOVERY_USER_EMAIL`, `RECOVERY_USER_PASSWORD` y `RECOVERY_USER_NAME`.

Por defecto usa como usuario el ID del documento del respaldo. Para otro usuario existente, añade `RECOVERY_USER_ID='UUID_DEL_USUARIO'`. `RECOVERY_BACKUP_FILE` permite indicar una copia del JSON en otra ruta.

Verifica:

```bash
psql "$DIRECT_URL" -c 'SELECT correo, nombre FROM usuarios;'
psql "$DIRECT_URL" -c 'SELECT COUNT(*) AS gastos FROM gastos UNION ALL SELECT COUNT(*) FROM gustos UNION ALL SELECT COUNT(*) FROM ahorros;'
```

## Conexión de la API

No necesitas cambiar el código para abandonar Neon: la API ya crea Prisma con el adaptador PostgreSQL y `DATABASE_URL`. En producción entrega `DATABASE_URL`, `SESSION_SECRET`, `APP_URL` y `CORS_ALLOWED_ORIGINS` como secretos del servicio; reserva `DIRECT_URL` para migraciones y la recuperación.

## Respaldos a partir de ahora

Programa una copia periódica en el servidor y guarda una segunda copia fuera de él:

```bash
pg_dump "$DIRECT_URL" --format=custom --file "/srv/plata/backups/plata-$(date +%F).dump"
```
