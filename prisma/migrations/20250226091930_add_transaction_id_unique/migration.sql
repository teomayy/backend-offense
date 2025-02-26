/*
  Warnings:

  - A unique constraint covering the columns `[transactionId]` on the table `payment` will be added. If there are existing duplicate values, this will fail.
  - Made the column `transactionId` on table `payment` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "payment" ALTER COLUMN "transactionId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "payment_transactionId_key" ON "payment"("transactionId");
