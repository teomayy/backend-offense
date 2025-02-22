-- AlterEnum
ALTER TYPE "PaymentStatus" ADD VALUE 'pending';

-- AlterTable
ALTER TABLE "payment" ADD COLUMN     "transactionId" TEXT;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_fine_id_fkey" FOREIGN KEY ("fine_id") REFERENCES "fine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
