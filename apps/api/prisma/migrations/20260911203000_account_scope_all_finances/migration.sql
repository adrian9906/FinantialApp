ALTER TABLE "deudas" ADD COLUMN "fuenteIngresoId" TEXT, ADD COLUMN "fuenteIngresoNombre" TEXT;
ALTER TABLE "eventos" ADD COLUMN "fuenteIngresoId" TEXT, ADD COLUMN "fuenteIngresoNombre" TEXT;
ALTER TABLE "deseos" ADD COLUMN "fuenteIngresoId" TEXT, ADD COLUMN "fuenteIngresoNombre" TEXT;
ALTER TABLE "proyecciones" ADD COLUMN "fuenteIngresoId" TEXT, ADD COLUMN "fuenteIngresoNombre" TEXT;
ALTER TABLE "metas_ahorro" ADD COLUMN "fuenteIngresoId" TEXT, ADD COLUMN "fuenteIngresoNombre" TEXT;
ALTER TABLE "suscripciones" ADD COLUMN "fuenteIngresoId" TEXT, ADD COLUMN "fuenteIngresoNombre" TEXT;

-- Preserve legacy records by assigning them to the user's first real income account.
WITH defaults AS (
  SELECT DISTINCT ON (f."usuarioId") f."usuarioId", f.id, f.nombre
  FROM "fuentes_ingreso" f
  WHERE f.archivada = false AND f.nombre NOT LIKE 'Ahorro %'
  ORDER BY f."usuarioId", CASE WHEN lower(f.nombre) = 'salario all novu' THEN 0 ELSE 1 END, f."createdAt" ASC
)
UPDATE "gastos" x SET "fuenteIngresoId" = d.id, "fuenteIngresoNombre" = d.nombre FROM defaults d WHERE x."usuarioId" = d."usuarioId" AND x."fuenteIngresoId" IS NULL;
WITH defaults AS (SELECT DISTINCT ON (f."usuarioId") f."usuarioId", f.id, f.nombre FROM "fuentes_ingreso" f WHERE f.archivada = false AND f.nombre NOT LIKE 'Ahorro %' ORDER BY f."usuarioId", CASE WHEN lower(f.nombre) = 'salario all novu' THEN 0 ELSE 1 END, f."createdAt" ASC)
UPDATE "gustos" x SET "fuenteIngresoId" = d.id, "fuenteIngresoNombre" = d.nombre FROM defaults d WHERE x."usuarioId" = d."usuarioId" AND x."fuenteIngresoId" IS NULL;
WITH defaults AS (SELECT DISTINCT ON (f."usuarioId") f."usuarioId", f.id, f.nombre FROM "fuentes_ingreso" f WHERE f.archivada = false AND f.nombre NOT LIKE 'Ahorro %' ORDER BY f."usuarioId", CASE WHEN lower(f.nombre) = 'salario all novu' THEN 0 ELSE 1 END, f."createdAt" ASC)
UPDATE "ahorros" x SET "fuenteIngresoId" = d.id, "fuenteIngresoNombre" = d.nombre FROM defaults d WHERE x."usuarioId" = d."usuarioId" AND x."fuenteIngresoId" IS NULL;
WITH defaults AS (SELECT DISTINCT ON (f."usuarioId") f."usuarioId", f.id, f.nombre FROM "fuentes_ingreso" f WHERE f.archivada = false AND f.nombre NOT LIKE 'Ahorro %' ORDER BY f."usuarioId", CASE WHEN lower(f.nombre) = 'salario all novu' THEN 0 ELSE 1 END, f."createdAt" ASC)
UPDATE "deudas" x SET "fuenteIngresoId" = d.id, "fuenteIngresoNombre" = d.nombre FROM defaults d WHERE x."usuarioId" = d."usuarioId" AND x."fuenteIngresoId" IS NULL;
WITH defaults AS (SELECT DISTINCT ON (f."usuarioId") f."usuarioId", f.id, f.nombre FROM "fuentes_ingreso" f WHERE f.archivada = false AND f.nombre NOT LIKE 'Ahorro %' ORDER BY f."usuarioId", CASE WHEN lower(f.nombre) = 'salario all novu' THEN 0 ELSE 1 END, f."createdAt" ASC)
UPDATE "eventos" x SET "fuenteIngresoId" = d.id, "fuenteIngresoNombre" = d.nombre FROM defaults d WHERE x."usuarioId" = d."usuarioId" AND x."fuenteIngresoId" IS NULL;
WITH defaults AS (SELECT DISTINCT ON (f."usuarioId") f."usuarioId", f.id, f.nombre FROM "fuentes_ingreso" f WHERE f.archivada = false AND f.nombre NOT LIKE 'Ahorro %' ORDER BY f."usuarioId", CASE WHEN lower(f.nombre) = 'salario all novu' THEN 0 ELSE 1 END, f."createdAt" ASC)
UPDATE "deseos" x SET "fuenteIngresoId" = d.id, "fuenteIngresoNombre" = d.nombre FROM defaults d WHERE x."usuarioId" = d."usuarioId" AND x."fuenteIngresoId" IS NULL;
WITH defaults AS (SELECT DISTINCT ON (f."usuarioId") f."usuarioId", f.id, f.nombre FROM "fuentes_ingreso" f WHERE f.archivada = false AND f.nombre NOT LIKE 'Ahorro %' ORDER BY f."usuarioId", CASE WHEN lower(f.nombre) = 'salario all novu' THEN 0 ELSE 1 END, f."createdAt" ASC)
UPDATE "proyecciones" x SET "fuenteIngresoId" = d.id, "fuenteIngresoNombre" = d.nombre FROM defaults d WHERE x."usuarioId" = d."usuarioId" AND x."fuenteIngresoId" IS NULL;
WITH defaults AS (SELECT DISTINCT ON (f."usuarioId") f."usuarioId", f.id, f.nombre FROM "fuentes_ingreso" f WHERE f.archivada = false AND f.nombre NOT LIKE 'Ahorro %' ORDER BY f."usuarioId", CASE WHEN lower(f.nombre) = 'salario all novu' THEN 0 ELSE 1 END, f."createdAt" ASC)
UPDATE "metas_ahorro" x SET "fuenteIngresoId" = d.id, "fuenteIngresoNombre" = d.nombre FROM defaults d WHERE x."usuarioId" = d."usuarioId" AND x."fuenteIngresoId" IS NULL;
WITH defaults AS (SELECT DISTINCT ON (f."usuarioId") f."usuarioId", f.id, f.nombre FROM "fuentes_ingreso" f WHERE f.archivada = false AND f.nombre NOT LIKE 'Ahorro %' ORDER BY f."usuarioId", CASE WHEN lower(f.nombre) = 'salario all novu' THEN 0 ELSE 1 END, f."createdAt" ASC)
UPDATE "suscripciones" x SET "fuenteIngresoId" = d.id, "fuenteIngresoNombre" = d.nombre FROM defaults d WHERE x."usuarioId" = d."usuarioId" AND x."fuenteIngresoId" IS NULL;

CREATE INDEX "deudas_usuarioId_fuenteIngresoId_idx" ON "deudas"("usuarioId", "fuenteIngresoId");
CREATE INDEX "eventos_usuarioId_fuenteIngresoId_fecha_idx" ON "eventos"("usuarioId", "fuenteIngresoId", "fecha");
CREATE INDEX "deseos_usuarioId_fuenteIngresoId_idx" ON "deseos"("usuarioId", "fuenteIngresoId");
CREATE INDEX "proyecciones_usuarioId_fuenteIngresoId_idx" ON "proyecciones"("usuarioId", "fuenteIngresoId");
CREATE INDEX "metas_ahorro_usuarioId_fuenteIngresoId_idx" ON "metas_ahorro"("usuarioId", "fuenteIngresoId");
CREATE INDEX "suscripciones_usuarioId_fuenteIngresoId_estado_idx" ON "suscripciones"("usuarioId", "fuenteIngresoId", "estado");
