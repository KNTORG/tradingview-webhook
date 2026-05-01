-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "text" TEXT NOT NULL,
    "receivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "speakers" TEXT NOT NULL DEFAULT '[]',
    "error" TEXT
);

-- CreateTable
CREATE TABLE "SpeakerSchedule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "speakerName" TEXT NOT NULL,
    "speakerIp" TEXT,
    "channelType" TEXT NOT NULL DEFAULT 'chromecast',
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "AppSetting" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL
);

-- CreateIndex
CREATE INDEX "Message_receivedAt_idx" ON "Message"("receivedAt");

-- CreateIndex
CREATE INDEX "Message_status_idx" ON "Message"("status");

-- CreateIndex
CREATE INDEX "SpeakerSchedule_speakerName_idx" ON "SpeakerSchedule"("speakerName");

-- CreateIndex
CREATE INDEX "SpeakerSchedule_dayOfWeek_idx" ON "SpeakerSchedule"("dayOfWeek");

-- CreateIndex
CREATE INDEX "SpeakerSchedule_channelType_idx" ON "SpeakerSchedule"("channelType");
