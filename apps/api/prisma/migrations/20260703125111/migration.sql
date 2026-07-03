-- CreateTable
CREATE TABLE "historiales_mensuales" (
    "id" TEXT NOT NULL,
    "mesReferencia" TEXT NOT NULL,
    "etiqueta" TEXT NOT NULL,
    "gastos" JSONB NOT NULL,
    "gustos" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "usuarioId" TEXT NOT NULL,

    CONSTRAINT "historiales_mensuales_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "historiales_mensuales" ADD CONSTRAINT "historiales_mensuales_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
