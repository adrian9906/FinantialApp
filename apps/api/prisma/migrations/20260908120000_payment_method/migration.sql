-- Existing expenses/wants/savings are shown as cash, so that is the default.
ALTER TABLE "ahorros" ADD COLUMN "esEfectivo" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "gastos" ADD COLUMN "esEfectivo" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "gustos" ADD COLUMN "esEfectivo" BOOLEAN NOT NULL DEFAULT true;
