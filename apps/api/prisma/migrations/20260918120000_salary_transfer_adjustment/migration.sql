ALTER TABLE "salarios" ADD COLUMN "ajusteTransferencias" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Previous versions kept incoming transfers only in the destination balance.
UPDATE "salarios" AS salary
SET "ajusteTransferencias" = salary."saldo" - salary."salario"
FROM "fuentes_ingreso" AS source
WHERE salary."fuenteId" = source."id"
  AND salary."saldo" > salary."salario"
  AND lower(trim(source."nombre")) NOT LIKE 'ahorro %';
