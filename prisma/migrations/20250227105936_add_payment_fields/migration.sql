/*
  Warnings:

  - Added the required column `amount` to the `payment` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "payment" ADD COLUMN     "amount" INTEGER NOT NULL,
ADD COLUMN     "cancel_time" TIMESTAMP(3),
ADD COLUMN     "perform_time" TIMESTAMP(3),
ADD COLUMN     "reason" TEXT;
