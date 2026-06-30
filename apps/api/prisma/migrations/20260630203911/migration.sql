-- CreateTable
CREATE TABLE "deudas_pagos" (
    "id" TEXT NOT NULL,
    "cantidad" DOUBLE PRECISION NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deudaId" TEXT NOT NULL,

    CONSTRAINT "deudas_pagos_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "deudas_pagos" ADD CONSTRAINT "deudas_pagos_deudaId_fkey" FOREIGN KEY ("deudaId") REFERENCES "deudas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
