ALTER TABLE "deseos"
ADD COLUMN "aportado" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "comprado" BOOLEAN NOT NULL DEFAULT false;

UPDATE "deseos"
SET "comprado" = true
WHERE "cantidad" > 0;
