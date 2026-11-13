-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "cartId" TEXT,
ADD COLUMN     "paymentProvider" TEXT NOT NULL DEFAULT 'stripe';

-- CreateIndex
CREATE INDEX "Order_cartId_idx" ON "Order"("cartId");
