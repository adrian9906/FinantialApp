ALTER TABLE "ahorros"
ADD COLUMN "fuenteIngresoId" TEXT,
ADD COLUMN "fuenteIngresoNombre" TEXT;

CREATE INDEX "ahorros_usuarioId_fuenteIngresoId_fecha_idx"
ON "ahorros"("usuarioId", "fuenteIngresoId", "fecha");
