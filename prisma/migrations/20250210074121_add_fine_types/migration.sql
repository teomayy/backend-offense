-- CreateEnum
CREATE TYPE "Role" AS ENUM ('admin', 'inspector', 'employee');

-- CreateEnum
CREATE TYPE "FineStatus" AS ENUM ('pending', 'paid');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('payme', 'paynet', 'uzum');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('success', 'failed');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "phone" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fine" (
    "id" TEXT NOT NULL,
    "inspector_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "fine_type_id" TEXT NOT NULL,
    "base_salary" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "discounted_amount" INTEGER,
    "status" "FineStatus" NOT NULL,
    "payment_reference" TEXT NOT NULL,
    "issue_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "due_date" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "user_id" TEXT,

    CONSTRAINT "fine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FineType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "percentage" DOUBLE PRECISION,
    "fixed_amount" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FineType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment" (
    "id" TEXT NOT NULL,
    "fine_id" TEXT NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "status" "PaymentStatus" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_phone_key" ON "user"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "fine_payment_reference_key" ON "fine"("payment_reference");

-- CreateIndex
CREATE UNIQUE INDEX "FineType_name_key" ON "FineType"("name");

-- AddForeignKey
ALTER TABLE "fine" ADD CONSTRAINT "fine_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fine" ADD CONSTRAINT "fine_fine_type_id_fkey" FOREIGN KEY ("fine_type_id") REFERENCES "FineType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
