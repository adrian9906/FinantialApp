## Prisma + PostgreSQL

Este directorio ya esta preparado para usar Prisma con PostgreSQL en Neon.

Antes de correr migraciones:

1. Completa `apps/api/.env` con `DATABASE_URL`, `DIRECT_URL`, `APP_URL`, `API_BASE_URL` y `SESSION_SECRET`.
2. Ejecuta `pnpm db:generate`.
3. Crea una nueva migracion Postgres con `pnpm db:migrate`.

Nota:

- Las migraciones historicas movidas desde SQLite se conservan como referencia del modelo anterior.
- Cuando conectes Neon, conviene regenerar la linea base de migraciones para Postgres antes de mover datos de produccion.
