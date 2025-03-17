/*
  Warnings:

  - The `reason` column on the `payment` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "payment" DROP COLUMN "reason",
ADD COLUMN     "reason" INTEGER;
