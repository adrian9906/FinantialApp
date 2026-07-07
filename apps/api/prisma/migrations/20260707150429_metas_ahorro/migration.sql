-- CreateTable
CREATE TABLE "metas_ahorro" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "montoObjetivo" DOUBLE PRECISION NOT NULL,
    "montoActual" DOUBLE PRECISION NOT NULL,
    "aporteMensual" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "usuarioId" TEXT NOT NULL,

    CONSTRAINT "metas_ahorro_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "metas_ahorro" ADD CONSTRAINT "metas_ahorro_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
