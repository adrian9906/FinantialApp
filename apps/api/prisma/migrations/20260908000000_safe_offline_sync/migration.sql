-- Additive migration: existing financial records remain untouched.
CREATE TABLE "sync_records" (
  "usuarioId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "revision" TEXT NOT NULL,
  CONSTRAINT "sync_records_pkey" PRIMARY KEY ("usuarioId", "key"),
  CONSTRAINT "sync_records_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "sync_receipts" (
  "usuarioId" TEXT NOT NULL,
  "operationId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "digest" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sync_receipts_pkey" PRIMARY KEY ("usuarioId", "operationId"),
  CONSTRAINT "sync_receipts_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
