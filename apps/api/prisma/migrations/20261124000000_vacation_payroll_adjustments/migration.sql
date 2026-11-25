ALTER TABLE "salarios" ADD COLUMN "ajusteVacaciones" DOUBLE PRECISION NOT NULL DEFAULT 0;

CREATE TABLE "ajustes_vacaciones" (
    "id" TEXT NOT NULL,
    "modo" TEXT NOT NULL,
    "fuenteIngresoId" TEXT NOT NULL,
    "fuenteIngresoNombre" TEXT NOT NULL,
    "fechaInicio" TEXT NOT NULL,
    "fechaFin" TEXT NOT NULL,
    "mesNomina" TEXT NOT NULL,
    "diasLaborablesMes" INTEGER NOT NULL,
    "diasVacaciones" INTEGER NOT NULL,
    "tarifaDiaria" DOUBLE PRECISION NOT NULL,
    "cantidad" DOUBLE PRECISION NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ajustes_vacaciones_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ajustes_vacaciones_usuarioId_mesNomina_fuenteIngresoId_idx" ON "ajustes_vacaciones"("usuarioId", "mesNomina", "fuenteIngresoId");

ALTER TABLE "ajustes_vacaciones" ADD CONSTRAINT "ajustes_vacaciones_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
