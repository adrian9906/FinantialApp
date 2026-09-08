-- Google accounts have no password, so the column becomes optional.
-- Existing rows keep their hash untouched.
ALTER TABLE "usuarios" ALTER COLUMN "contrasena" DROP NOT NULL;
ALTER TABLE "usuarios" ADD COLUMN "googleId" TEXT;
CREATE UNIQUE INDEX "usuarios_googleId_key" ON "usuarios"("googleId");
