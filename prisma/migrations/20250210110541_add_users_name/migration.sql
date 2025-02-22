/*
  Warnings:

  - You are about to drop the column `employee_id` on the `fine` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "fine" DROP COLUMN "employee_id",
ADD COLUMN     "name" TEXT;
