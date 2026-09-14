# Recuperación de Plata con PostgreSQL en Docker

El respaldo `plata-backup-2026-09-11.json` se importa a las tablas relacionales actuales, no como un único JSON. Se encontró un documento de sincronización: `f8228346-1a7d-4993-991d-a9117a3588ce`.

| Datos revisados | Registros |
| --- | ---: |
| Salarios / fuentes de ingreso | 5 / 3 |
| Transacciones / deudas | 57 / 2 |
| Deseos / historial mensual | 24 / 7 |
| Metas / suscripciones | 1 / 1 |
| Eventos, proyecciones, recordatorios | 0 / 0 / 0 |

Las imágenes Base64 del respaldo se suben a Cloudinary antes de crear los deseos; PostgreSQL conserva únicamente sus URLs HTTPS. El archivo no guarda correo, contraseña ni sesiones. La semilla crea por defecto `adriandfl99@gmail.com` con la contraseña temporal configurada para esta recuperación; cámbiala tras el primer acceso. Sí contiene en `localStorage` las monedas y fórmulas de ahorro, que la semilla transfiere a `PreferenciaUsuario`; los ajustes visuales y las reglas de categorías permanecen del lado del cliente.

Mientras Neon no esté disponible, este JSON de IndexedDB es la fuente recuperable. A partir de esta restauración, usa `pg_dump` para conservar también copias SQL de PostgreSQL.

## PostgreSQL con Docker en Ubuntu

Instala Docker Engine y el complemento Docker Compose en Ubuntu. La configuración siguiente guarda los datos en un volumen Docker persistente y deja PostgreSQL disponible únicamente para procesos del mismo servidor mediante `127.0.0.1`. No abras el puerto `5432` en UFW ni en el proveedor.

```bash
sudo install -d -m 0750 /srv/plata
sudo nano /srv/plata/docker-compose.yml
```

Pega este contenido en `/srv/plata/docker-compose.yml`. Sustituye `CLAVE_LARGA_DE_MIGRACIONES` por una clave larga, aleatoria y segura para URL (sin `@`, `:`, `/` ni espacios):

```yaml
services:
  postgres:
    image: postgres:17
    container_name: plata-db
    restart: unless-stopped
    environment:
      POSTGRES_USER: plata_migrator
      POSTGRES_PASSWORD: CLAVE_LARGA_DE_MIGRACIONES
      POSTGRES_DB: plata
    ports:
      - "127.0.0.1:5432:5432"
    volumes:
      - plata_postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U plata_migrator -d plata"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  plata_postgres_data:
```

Inicia el contenedor y espera que quede sano:

```bash
cd /srv/plata
sudo docker compose up -d
sudo docker compose ps
```

La primera ejecución crea automáticamente la base `plata` y el rol propietario `plata_migrator`. Ahora crea el rol de acceso limitado para la API. Cambia también la segunda clave por un secreto URL-seguro:

```bash
sudo docker exec -it plata-db psql -U plata_migrator -d plata
```

```sql
CREATE ROLE plata_app LOGIN PASSWORD 'CLAVE_LARGA_DE_APLICACION';
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO plata_app;
```

Esta configuración inicial es para API y base en el mismo Ubuntu. Si la API estará en Vercel, lee primero la sección **Vercel → PostgreSQL en Ubuntu** antes de cambiar el puerto publicado.

Para actualizar la imagen más adelante:

```bash
cd /srv/plata
sudo docker compose pull
sudo docker compose up -d
```

## Configurar Prisma y aplicar migraciones

En el checkout del proyecto, crea `apps/api/.env` a partir de `apps/api/.env.example`:

```dotenv
DATABASE_URL="postgresql://plata_app:CLAVE_LARGA_DE_APLICACION@127.0.0.1:5432/plata?schema=public"
DIRECT_URL="postgresql://plata_migrator:CLAVE_LARGA_DE_MIGRACIONES@127.0.0.1:5432/plata?schema=public"
SESSION_SECRET="secreto-aleatorio-de-al-menos-32-bytes"
APP_URL="https://tu-dominio.example"
CORS_ALLOWED_ORIGINS="https://tu-dominio.example"
CLOUDINARY_URL="cloudinary://API_KEY:API_SECRET@CLOUD_NAME"
CLOUDINARY_FOLDER="plata"
```

`DATABASE_URL` es la conexión de la API. `DIRECT_URL` usa el rol de migración y sirve para Prisma CLI y recuperación. Nunca copies estas variables al frontend/Vite.

## Imágenes con Cloudinary

Crea un producto en Cloudinary y, desde **Settings → API Keys**, copia la variable de entorno completa `CLOUDINARY_URL` al archivo `apps/api/.env`. Define también `CLOUDINARY_FOLDER` (por ejemplo `plata`) para agrupar las imágenes. No copies este secreto a `apps/web/.env`, al repositorio ni al chat. La API recibe temporalmente el archivo, lo sube autenticada a Cloudinary y devuelve una URL HTTPS; por eso las próximas sincronizaciones ya no transportan imágenes Base64 desde PostgreSQL.

Cloudinary crea las subcarpetas al recibir la primera carga. Con `CLOUDINARY_FOLDER="plata"`, la organización queda así (cada usuario tiene su propia subcarpeta):

```text
plata/
├── deseos/<usuario-id>/
├── gastos/<usuario-id>/
├── gustos/<usuario-id>/
└── ahorros/<usuario-id>/
```

La web ya envía `gastos` para las fotos de compras y `deseos` para la lista de deseos. El componente reutilizable de fotos admite también `kind="want"` y `kind="saving"`, que se almacenan respectivamente en `gustos` y `ahorros`.

Si la API está en Vercel, crea las mismas variables `CLOUDINARY_URL` y `CLOUDINARY_FOLDER` en **Project Settings → Environment Variables → Production**. Para ejecutar la semilla desde tu equipo, deben existir también en tu `apps/api/.env` local.

`127.0.0.1` significa «este mismo servidor». Por tanto, aunque Ubuntu tenga la IP LAN `192.168.8.9`, conserva `127.0.0.1` cuando la API y Docker se ejecuten en ese Ubuntu: evita exponer PostgreSQL a la red.

## Vercel → PostgreSQL en Ubuntu

La dirección `192.168.8.9` es privada (LAN) y Vercel no puede enrutar hacia ella. Para mantener la API en Vercel necesitas una IP pública o, preferiblemente, un dominio como `db.tu-dominio.example` que resuelva a esa IP pública, además de una regla NAT del router que reenvíe TCP `5432` al Ubuntu.

Esto no es compatible con el mapeo local `127.0.0.1:5432:5432` de arriba. Solo después de configurar TLS en PostgreSQL y las reglas de red, cambia el mapeo a:

```yaml
ports:
  - "0.0.0.0:5432:5432"
```

Abre TCP `5432` en el firewall del Ubuntu únicamente para las IP de salida de Vercel. Por defecto esas IP son dinámicas; Vercel ofrece **Static IPs** en planes Pro/Enterprise para poder permitir una pareja conocida de IPs. Sin IPs estáticas, publicar PostgreSQL directamente es una exposición innecesaria: la opción más segura es alojar también la API en Ubuntu o usar un PostgreSQL administrado.

Usa un certificado TLS válido para el dominio público, activa TLS en PostgreSQL, añade `sslmode=require` a las URLs y configura en Vercel solamente `DATABASE_URL` como secreto de Production:

```dotenv
DATABASE_URL="postgresql://plata_app:CLAVE_URL_SEGURA@db.tu-dominio.example:5432/plata?schema=public&sslmode=require"
```

No uses `DIRECT_URL` como secreto de ejecución en Vercel: ejecuta `db:migrate:deploy` y la semilla desde el Ubuntu, usando la conexión local `127.0.0.1`. Para cargas serverless conviene añadir PgBouncer entre Vercel y PostgreSQL, porque las funciones pueden abrir conexiones en paralelo.

## Recomendado: API en Ubuntu, web en Vercel

Esta es la configuración recomendada para este proyecto: Vercel sirve el frontend y Ubuntu ejecuta la API en el puerto local `3001`; Nginx publica únicamente la API por HTTPS. PostgreSQL sigue publicado solo en `127.0.0.1`, por lo que no se expone a Internet.

Necesitas un dominio público para la API, por ejemplo `api.tu-dominio.example`, que apunte a la IP pública del servidor. La IP LAN `192.168.8.9` no se usa en Vercel ni en las URLs públicas.

### Instalar y compilar la API

En el servidor, deja el repositorio en `/srv/plata/app` (clonándolo desde Git o copiándolo) e instala Node.js LTS, Corepack, Git y Nginx. Luego:

```bash
sudo useradd --system --home /srv/plata/app --shell /usr/sbin/nologin plata 2>/dev/null || true
sudo chown -R plata:plata /srv/plata/app
sudo corepack enable
sudo -u plata -H bash -lc 'cd /srv/plata/app && pnpm install --frozen-lockfile'
sudo cp /srv/plata/app/apps/api/.env.example /srv/plata/app/apps/api/.env
sudo chmod 600 /srv/plata/app/apps/api/.env
sudo chown plata:plata /srv/plata/app/apps/api/.env
```

Edita `apps/api/.env`. Como API y PostgreSQL están en el mismo Ubuntu, ambas conexiones permanecen en localhost:

```dotenv
HOST="127.0.0.1"
PORT=3001
DATABASE_URL="postgresql://plata_app:CLAVE_LARGA_DE_APLICACION@127.0.0.1:5432/plata?schema=public"
DIRECT_URL="postgresql://plata_migrator:CLAVE_LARGA_DE_MIGRACIONES@127.0.0.1:5432/plata?schema=public"
SESSION_SECRET="SECRETO_ALEATORIO_DE_AL_MENOS_32_BYTES"
APP_URL="https://tu-frontend.vercel.app"
CORS_ALLOWED_ORIGINS="https://tu-frontend.vercel.app"
```

Aplica las migraciones y compila. La semilla se ejecuta una sola vez, después de crear el contenedor y las migraciones:

```bash
sudo -u plata -H bash -lc 'cd /srv/plata/app && pnpm --dir apps/api build'
sudo -u plata -H bash -lc 'cd /srv/plata/app && RECOVERY_CONFIRM=replace pnpm --dir apps/api db:seed:recovery'
```

### Mantener la API activa con systemd

Crea `/etc/systemd/system/plata-api.service`:

```ini
[Unit]
Description=Plata API
After=network-online.target docker.service
Wants=network-online.target docker.service

[Service]
Type=simple
User=plata
Group=plata
WorkingDirectory=/srv/plata/app
EnvironmentFile=/srv/plata/app/apps/api/.env
Environment=NODE_ENV=production
Environment=PATH=/usr/local/bin:/usr/bin:/bin
ExecStart=/usr/bin/env pnpm --dir apps/api start
Restart=always
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full

[Install]
WantedBy=multi-user.target
```

Actívalo y comprueba el endpoint local de salud:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now plata-api
sudo systemctl status plata-api
curl http://127.0.0.1:3001/healthz
```

Para consultar errores: `sudo journalctl -u plata-api -f`. En cada actualización del código ejecuta de nuevo `pnpm install --frozen-lockfile` y `pnpm --dir apps/api build` como usuario `plata`, y luego `sudo systemctl restart plata-api`.

### Publicar HTTPS con Nginx

Instala Nginx y Certbot:

```bash
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx
sudo nano /etc/nginx/sites-available/plata-api
```

Usa esta configuración, sustituyendo el dominio:

```nginx
server {
    listen 80;
    server_name api.tu-dominio.example;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/plata-api /etc/nginx/sites-enabled/plata-api
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d api.tu-dominio.example
sudo ufw allow 'Nginx Full'
```

No abras `3001` ni `5432` en el firewall. Nginx será el único servicio público de la API.

### Conectar el frontend de Vercel

En el proyecto web de Vercel, crea la variable de entorno de Production y vuelve a desplegar el frontend:

```dotenv
VITE_API_BASE_URL=https://api.tu-dominio.example
```

Usa exactamente el dominio público del frontend en `APP_URL` y `CORS_ALLOWED_ORIGINS` de la API. Por ejemplo, si el frontend es `https://finantial-app-web.vercel.app`, ese es el valor permitido; no incluyas una barra final.

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm --dir apps/api db:generate
pnpm --dir apps/api db:migrate:deploy
```

Después de migrar, concede permisos mínimos al proceso de aplicación:

```bash
sudo docker exec -it plata-db psql -U plata_migrator -d plata
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
sudo docker exec plata-db psql -U plata_migrator -d plata -c 'SELECT correo, nombre FROM usuarios;'
sudo docker exec plata-db psql -U plata_migrator -d plata -c 'SELECT COUNT(*) AS gastos FROM gastos UNION ALL SELECT COUNT(*) FROM gustos UNION ALL SELECT COUNT(*) FROM ahorros;'
```

## Conexión de la API

No necesitas cambiar el código para abandonar Neon: la API ya crea Prisma con el adaptador PostgreSQL y `DATABASE_URL`. En producción entrega `DATABASE_URL`, `SESSION_SECRET`, `APP_URL` y `CORS_ALLOWED_ORIGINS` como secretos del servicio; reserva `DIRECT_URL` para migraciones y la recuperación.

## Respaldos a partir de ahora

Programa una copia periódica en el servidor y guarda una segunda copia fuera de él. Como PostgreSQL está en Docker, ejecuta `pg_dump` dentro del contenedor:

```bash
sudo install -d -m 0700 /srv/plata/backups
sudo sh -c 'docker exec plata-db pg_dump -U plata_migrator -d plata --format=custom > "/srv/plata/backups/plata-$(date +%F).dump"'
```
