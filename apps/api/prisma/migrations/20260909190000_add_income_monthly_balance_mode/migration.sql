ALTER TABLE "fuentes_ingreso" ADD COLUMN "modoSaldo" TEXT;
ALTER TABLE "salarios" ADD COLUMN "modoSaldo" TEXT;

UPDATE "fuentes_ingreso" SET "modoSaldo" = 'fixed' WHERE "modoSaldo" IS NULL;
UPDATE "salarios" SET "modoSaldo" = 'fixed' WHERE "modoSaldo" IS NULL;

ALTER TABLE "fuentes_ingreso" ALTER COLUMN "modoSaldo" SET DEFAULT 'fixed';
ALTER TABLE "fuentes_ingreso" ALTER COLUMN "modoSaldo" SET NOT NULL;
ALTER TABLE "salarios" ALTER COLUMN "modoSaldo" SET DEFAULT 'fixed';
ALTER TABLE "salarios" ALTER COLUMN "modoSaldo" SET NOT NULL;

ALTER TABLE "fuentes_ingreso" ADD CONSTRAINT "fuentes_ingreso_modo_saldo_check"
CHECK ("modoSaldo" IN ('fixed', 'zero')) NOT VALID;
ALTER TABLE "salarios" ADD CONSTRAINT "salarios_modo_saldo_check"
CHECK ("modoSaldo" IN ('fixed', 'zero')) NOT VALID;

ALTER TABLE "fuentes_ingreso" VALIDATE CONSTRAINT "fuentes_ingreso_modo_saldo_check";
ALTER TABLE "salarios" VALIDATE CONSTRAINT "salarios_modo_saldo_check";
