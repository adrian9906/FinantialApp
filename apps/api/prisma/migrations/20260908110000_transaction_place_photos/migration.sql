-- Additive and optional: existing rows keep working with no place or photos.
ALTER TABLE "ahorros" ADD COLUMN "lugar" TEXT;
ALTER TABLE "ahorros" ADD COLUMN "adjuntos" TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE "gastos" ADD COLUMN "lugar" TEXT;
ALTER TABLE "gastos" ADD COLUMN "adjuntos" TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE "gustos" ADD COLUMN "lugar" TEXT;
ALTER TABLE "gustos" ADD COLUMN "adjuntos" TEXT[] NOT NULL DEFAULT '{}';
