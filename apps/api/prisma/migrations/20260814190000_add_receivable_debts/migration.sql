ALTER TABLE "deudas"
ADD COLUMN "tipo" TEXT NOT NULL DEFAULT 'payable',
ADD COLUMN "contraparte" TEXT;
