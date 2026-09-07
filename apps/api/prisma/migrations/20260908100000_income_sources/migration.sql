-- Additive: existing salaries keep working as a single recurring income.
CREATE TABLE "fuentes_ingreso" (
  "id" TEXT NOT NULL,
  "nombre" TEXT NOT NULL,
  "recurrente" BOOLEAN NOT NULL DEFAULT true,
  "archivada" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "usuarioId" TEXT NOT NULL,
  CONSTRAINT "fuentes_ingreso_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "fuentes_ingreso_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Nullable so every existing row stays valid without a backfill.
ALTER TABLE "salarios" ADD COLUMN "fuenteId" TEXT;
ALTER TABLE "salarios" ADD COLUMN "fuenteNombre" TEXT;
ALTER TABLE "salarios" ADD COLUMN "tipo" TEXT;
