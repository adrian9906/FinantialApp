CREATE TABLE "suscripciones" (
  "id" TEXT NOT NULL,
  "nombre" TEXT NOT NULL,
  "cantidad" DOUBLE PRECISION NOT NULL,
  "diaCobro" INTEGER NOT NULL,
  "estado" TEXT NOT NULL DEFAULT 'active',
  "fechaInicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "fechaCancelacion" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "usuarioId" TEXT NOT NULL,
  CONSTRAINT "suscripciones_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "suscripciones_diaCobro_check" CHECK ("diaCobro" BETWEEN 1 AND 31),
  CONSTRAINT "suscripciones_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "suscripciones_usuarioId_estado_idx" ON "suscripciones"("usuarioId", "estado");
