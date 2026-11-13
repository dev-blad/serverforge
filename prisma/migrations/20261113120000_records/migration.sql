-- CreateTable
CREATE TABLE "Record" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "guildId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "number" INTEGER NOT NULL DEFAULT 0,
    "userId" TEXT,
    "status" TEXT,
    "data" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "Record_guildId_kind_idx" ON "Record"("guildId", "kind");

-- CreateIndex
CREATE INDEX "Record_kind_status_idx" ON "Record"("kind", "status");
