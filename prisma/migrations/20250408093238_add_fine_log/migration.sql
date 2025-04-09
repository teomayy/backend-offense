-- CreateTable
CREATE TABLE "FileLog" (
    "id" TEXT NOT NULL,
    "fine_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FileLog_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "FileLog" ADD CONSTRAINT "FileLog_fine_id_fkey" FOREIGN KEY ("fine_id") REFERENCES "fine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
