-- CreateTable
CREATE TABLE "deudas" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cantidad" REAL NOT NULL,
    "historial" TEXT NOT NULL,
    "fechaInicio" DATETIME NOT NULL,
    "fechaTerminacion" DATETIME NOT NULL,
    "interes" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "usuarioId" TEXT NOT NULL,
    CONSTRAINT "deudas_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
