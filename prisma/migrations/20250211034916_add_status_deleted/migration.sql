/*
  Warnings:

  - You are about to drop the column `user_id` on the `fine` table. All the data in the column will be lost.
  - You are about to drop the `user` table. If the table is not empty, all the data it contains will be lost.
  - Made the column `name` on table `fine` required. This step will fail if there are existing NULL values in that column.
  - Made the column `phone` on table `fine` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterEnum
ALTER TYPE "FineStatus" ADD VALUE 'deleted';

-- DropForeignKey
ALTER TABLE "fine" DROP CONSTRAINT "fine_user_id_fkey";

-- AlterTable
ALTER TABLE "fine" DROP COLUMN "user_id",
ALTER COLUMN "name" SET NOT NULL,
ALTER COLUMN "phone" SET NOT NULL;

-- DropTable
DROP TABLE "user";

-- DropEnum
DROP TYPE "Role";

-- CreateTable
CREATE TABLE "admin" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "login" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'admin',
    "refreshToken" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inspector" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "login" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'inspector',
    "refreshToken" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inspector_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_login_key" ON "admin"("login");

-- CreateIndex
CREATE UNIQUE INDEX "inspector_login_key" ON "inspector"("login");

-- AddForeignKey
ALTER TABLE "fine" ADD CONSTRAINT "fine_inspector_id_fkey" FOREIGN KEY ("inspector_id") REFERENCES "inspector"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
