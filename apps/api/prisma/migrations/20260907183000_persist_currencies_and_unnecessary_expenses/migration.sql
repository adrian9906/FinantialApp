ALTER TABLE "items"
ADD COLUMN "innecesario" BOOLEAN NOT NULL DEFAULT false;

UPDATE "items"
SET "innecesario" = true
WHERE "categoria" = 'expense'
  AND "nombre" ~ '^[^:]+::(pending|checked)::1::';

CREATE TABLE "preferencias_usuario" (
  "usuarioId" TEXT NOT NULL,
  "monedas" JSONB NOT NULL,
  "monedaActiva" TEXT NOT NULL DEFAULT 'USD',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "preferencias_usuario_pkey" PRIMARY KEY ("usuarioId")
);

ALTER TABLE "preferencias_usuario"
ADD CONSTRAINT "preferencias_usuario_usuarioId_fkey"
FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
