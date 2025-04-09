/*
  Warnings:

  - You are about to drop the column `action` on the `FileLog` table. All the data in the column will be lost.
  - You are about to drop the column `message` on the `FileLog` table. All the data in the column will be lost.
  - Added the required column `amount` to the `FileLog` table without a default value. This is not possible if the table is not empty.
  - Added the required column `status` to the `FileLog` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "FileLog" DROP COLUMN "action",
DROP COLUMN "message",
ADD COLUMN     "amount" INTEGER NOT NULL,
ADD COLUMN     "status" "FineStatus" NOT NULL;
