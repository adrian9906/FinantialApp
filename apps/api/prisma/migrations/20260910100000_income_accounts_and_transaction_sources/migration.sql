ALTER TABLE "fuentes_ingreso" ADD COLUMN "esEfectivo" BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE "salarios" ADD COLUMN "saldo" DOUBLE PRECISION;
UPDATE "salarios" SET "saldo" = "salario" WHERE "saldo" IS NULL;
ALTER TABLE "salarios" ALTER COLUMN "saldo" SET NOT NULL;

ALTER TABLE "gastos" ADD COLUMN "fuenteIngresoId" TEXT;
ALTER TABLE "gastos" ADD COLUMN "fuenteIngresoNombre" TEXT;
ALTER TABLE "gustos" ADD COLUMN "fuenteIngresoId" TEXT;
ALTER TABLE "gustos" ADD COLUMN "fuenteIngresoNombre" TEXT;

CREATE INDEX "gastos_usuarioId_fuenteIngresoId_fecha_idx"
ON "gastos" ("usuarioId", "fuenteIngresoId", "fecha");
CREATE INDEX "gustos_usuarioId_fuenteIngresoId_fecha_idx"
ON "gustos" ("usuarioId", "fuenteIngresoId", "fecha");
