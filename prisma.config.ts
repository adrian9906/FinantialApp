import "dotenv/config";
import { defineConfig } from "prisma/config";

const isDev = process.env["NODE_ENV"] === "development";

export default defineConfig({
  schema: isDev ? "prisma/schema.dev.prisma" : "prisma/schema.prisma",
  migrations: {
    path: isDev ? "prisma/migrations/dev" : "prisma/migrations",
  },
  datasource: {
    url: isDev ? process.env["DATABASE_URL_DEV"] : process.env["DATABASE_URL"],
  },
});
