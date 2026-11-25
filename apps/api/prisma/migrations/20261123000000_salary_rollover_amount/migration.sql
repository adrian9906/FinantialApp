ALTER TABLE "salarios"
ADD COLUMN "saldoArrastre" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Recover unspent extra deposits on each account's latest recurring salary.
UPDATE "salarios" AS salary
SET "saldoArrastre" = GREATEST(
  0,
  salary."saldo" - salary."salario" - GREATEST(0, salary."ajusteTransferencias")
)
WHERE salary."tipo" IS DISTINCT FROM 'one-off'
  AND NOT EXISTS (
    SELECT 1
    FROM "salarios" AS newer
    WHERE newer."usuarioId" = salary."usuarioId"
      AND newer."fuenteId" IS NOT DISTINCT FROM salary."fuenteId"
      AND newer."fecha" > salary."fecha"
      AND newer."tipo" IS DISTINCT FROM 'one-off'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM "fuentes_ingreso" AS source
    WHERE source."id" = salary."fuenteId"
      AND lower(trim(source."nombre")) LIKE 'ahorro %'
  );
