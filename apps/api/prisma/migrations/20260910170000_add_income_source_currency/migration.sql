ALTER TABLE "fuentes_ingreso"
ADD COLUMN "moneda" TEXT NOT NULL DEFAULT 'USD';

UPDATE "fuentes_ingreso" AS source
SET "moneda" = salary."moneda"
FROM "salarios" AS salary
WHERE salary."fuenteId" = source."id"
  AND salary."fecha" = (
    SELECT MAX(latest."fecha")
    FROM "salarios" AS latest
    WHERE latest."fuenteId" = source."id"
  );
