ALTER TABLE "salarios" ADD COLUMN "moneda" TEXT;

UPDATE "salarios"
SET "moneda" = 'USD'
WHERE "moneda" IS NULL OR BTRIM("moneda") = '';

ALTER TABLE "salarios" ALTER COLUMN "moneda" SET DEFAULT 'USD';
ALTER TABLE "salarios" ALTER COLUMN "moneda" SET NOT NULL;

ALTER TABLE "salarios"
ADD CONSTRAINT "salarios_moneda_formato_check"
CHECK ("moneda" ~ '^[A-Z][A-Z0-9]{2,7}$') NOT VALID;

ALTER TABLE "salarios" VALIDATE CONSTRAINT "salarios_moneda_formato_check";
