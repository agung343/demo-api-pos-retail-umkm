-- AlterTable
ALTER TABLE "Sales" ADD COLUMN     "editedAt" TIMESTAMP(3),
ADD COLUMN     "editedBy" TEXT,
ADD COLUMN     "isEdited" BOOLEAN NOT NULL DEFAULT false;

-- AddForeignKey
ALTER TABLE "Sales" ADD CONSTRAINT "Sales_editedBy_fkey" FOREIGN KEY ("editedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
