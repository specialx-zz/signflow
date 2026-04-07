-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target" TEXT,
    "details" TEXT,
    "ipAddress" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_AuditLog" ("action", "createdAt", "details", "id", "ipAddress", "target", "tenantId", "userId") SELECT "action", "createdAt", "details", "id", "ipAddress", "target", "tenantId", "userId" FROM "AuditLog";
DROP TABLE "AuditLog";
ALTER TABLE "new_AuditLog" RENAME TO "AuditLog";
CREATE INDEX "AuditLog_tenantId_idx" ON "AuditLog"("tenantId");
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
CREATE TABLE "new_Content" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "mimeType" TEXT,
    "size" INTEGER NOT NULL DEFAULT 0,
    "duration" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "thumbnail" TEXT,
    "filePath" TEXT NOT NULL,
    "url" TEXT,
    "storageType" TEXT NOT NULL DEFAULT 'local',
    "categoryId" TEXT,
    "createdBy" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "tags" TEXT,
    "metadata" TEXT,
    "startAt" DATETIME,
    "expiresAt" DATETIME,
    "publishStatus" TEXT NOT NULL DEFAULT 'published',
    "isCanvas" BOOLEAN NOT NULL DEFAULT false,
    "canvasJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Content_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Content_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ContentCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Content_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Content" ("canvasJson", "categoryId", "createdAt", "createdBy", "duration", "expiresAt", "filePath", "height", "id", "isActive", "isCanvas", "metadata", "mimeType", "name", "publishStatus", "size", "startAt", "storageType", "tags", "tenantId", "thumbnail", "type", "updatedAt", "url", "width") SELECT "canvasJson", "categoryId", "createdAt", "createdBy", "duration", "expiresAt", "filePath", "height", "id", "isActive", "isCanvas", "metadata", "mimeType", "name", "publishStatus", "size", "startAt", "storageType", "tags", "tenantId", "thumbnail", "type", "updatedAt", "url", "width" FROM "Content";
DROP TABLE "Content";
ALTER TABLE "new_Content" RENAME TO "Content";
CREATE INDEX "Content_tenantId_idx" ON "Content"("tenantId");
CREATE INDEX "Content_publishStatus_idx" ON "Content"("publishStatus");
CREATE INDEX "Content_expiresAt_idx" ON "Content"("expiresAt");
CREATE INDEX "Content_startAt_idx" ON "Content"("startAt");
CREATE TABLE "new_ContentCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ContentCategory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ContentCategory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ContentCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ContentCategory" ("createdAt", "id", "name", "parentId", "tenantId", "updatedAt") SELECT "createdAt", "id", "name", "parentId", "tenantId", "updatedAt" FROM "ContentCategory";
DROP TABLE "ContentCategory";
ALTER TABLE "new_ContentCategory" RENAME TO "ContentCategory";
CREATE INDEX "ContentCategory_tenantId_idx" ON "ContentCategory"("tenantId");
CREATE TABLE "new_Device" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "storeId" TEXT,
    "name" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "groupId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OFFLINE',
    "ipAddress" TEXT,
    "macAddress" TEXT,
    "model" TEXT,
    "firmware" TEXT,
    "resolution" TEXT,
    "orientation" TEXT NOT NULL DEFAULT 'LANDSCAPE',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Seoul',
    "volume" INTEGER NOT NULL DEFAULT 50,
    "brightness" INTEGER NOT NULL DEFAULT 100,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSeen" DATETIME,
    "settings" TEXT,
    "location" TEXT,
    "tags" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Device_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Device_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Device_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "DeviceGroup" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Device" ("brightness", "createdAt", "deviceId", "firmware", "groupId", "id", "ipAddress", "isActive", "lastSeen", "location", "macAddress", "model", "name", "orientation", "resolution", "settings", "status", "storeId", "tags", "tenantId", "timezone", "updatedAt", "volume") SELECT "brightness", "createdAt", "deviceId", "firmware", "groupId", "id", "ipAddress", "isActive", "lastSeen", "location", "macAddress", "model", "name", "orientation", "resolution", "settings", "status", "storeId", "tags", "tenantId", "timezone", "updatedAt", "volume" FROM "Device";
DROP TABLE "Device";
ALTER TABLE "new_Device" RENAME TO "Device";
CREATE UNIQUE INDEX "Device_deviceId_key" ON "Device"("deviceId");
CREATE INDEX "Device_tenantId_idx" ON "Device"("tenantId");
CREATE TABLE "new_DeviceGroup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "storeId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DeviceGroup_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DeviceGroup_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_DeviceGroup" ("createdAt", "description", "id", "name", "storeId", "tenantId", "updatedAt") SELECT "createdAt", "description", "id", "name", "storeId", "tenantId", "updatedAt" FROM "DeviceGroup";
DROP TABLE "DeviceGroup";
ALTER TABLE "new_DeviceGroup" RENAME TO "DeviceGroup";
CREATE INDEX "DeviceGroup_tenantId_idx" ON "DeviceGroup"("tenantId");
CREATE TABLE "new_Layout" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "baseWidth" INTEGER NOT NULL DEFAULT 1920,
    "baseHeight" INTEGER NOT NULL DEFAULT 1080,
    "thumbnail" TEXT,
    "createdBy" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Layout_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Layout_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Layout" ("baseHeight", "baseWidth", "createdAt", "createdBy", "description", "id", "isActive", "name", "tenantId", "thumbnail", "updatedAt") SELECT "baseHeight", "baseWidth", "createdAt", "createdBy", "description", "id", "isActive", "name", "tenantId", "thumbnail", "updatedAt" FROM "Layout";
DROP TABLE "Layout";
ALTER TABLE "new_Layout" RENAME TO "Layout";
CREATE INDEX "Layout_tenantId_idx" ON "Layout"("tenantId");
CREATE TABLE "new_Playlist" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'GENERAL',
    "description" TEXT,
    "thumbnail" TEXT,
    "duration" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "settings" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Playlist_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Playlist_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Playlist" ("createdAt", "createdBy", "description", "duration", "id", "isActive", "name", "settings", "tenantId", "thumbnail", "type", "updatedAt") SELECT "createdAt", "createdBy", "description", "duration", "id", "isActive", "name", "settings", "tenantId", "thumbnail", "type", "updatedAt" FROM "Playlist";
DROP TABLE "Playlist";
ALTER TABLE "new_Playlist" RENAME TO "Playlist";
CREATE INDEX "Playlist_tenantId_idx" ON "Playlist"("tenantId");
CREATE TABLE "new_Schedule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'CONTENT',
    "playlistId" TEXT,
    "layoutId" TEXT,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME,
    "startTime" TEXT,
    "endTime" TEXT,
    "repeatType" TEXT NOT NULL DEFAULT 'NONE',
    "repeatDays" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdBy" TEXT NOT NULL,
    "settings" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Schedule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Schedule_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Schedule_playlistId_fkey" FOREIGN KEY ("playlistId") REFERENCES "Playlist" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Schedule_layoutId_fkey" FOREIGN KEY ("layoutId") REFERENCES "Layout" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Schedule" ("createdAt", "createdBy", "endDate", "endTime", "id", "isActive", "layoutId", "name", "playlistId", "repeatDays", "repeatType", "settings", "startDate", "startTime", "status", "tenantId", "type", "updatedAt") SELECT "createdAt", "createdBy", "endDate", "endTime", "id", "isActive", "layoutId", "name", "playlistId", "repeatDays", "repeatType", "settings", "startDate", "startTime", "status", "tenantId", "type", "updatedAt" FROM "Schedule";
DROP TABLE "Schedule";
ALTER TABLE "new_Schedule" RENAME TO "Schedule";
CREATE INDEX "Schedule_tenantId_idx" ON "Schedule"("tenantId");
CREATE TABLE "new_Statistics" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "deviceId" TEXT,
    "contentId" TEXT,
    "type" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" TEXT,
    CONSTRAINT "Statistics_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Statistics_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Statistics_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "Content" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Statistics" ("contentId", "date", "deviceId", "id", "metadata", "tenantId", "type", "value") SELECT "contentId", "date", "deviceId", "id", "metadata", "tenantId", "type", "value" FROM "Statistics";
DROP TABLE "Statistics";
ALTER TABLE "new_Statistics" RENAME TO "Statistics";
CREATE INDEX "Statistics_tenantId_idx" ON "Statistics"("tenantId");
CREATE INDEX "Statistics_date_idx" ON "Statistics"("date");
CREATE INDEX "Statistics_deviceId_idx" ON "Statistics"("deviceId");
CREATE INDEX "Statistics_contentId_idx" ON "Statistics"("contentId");
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "storeId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLogin" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_User" ("createdAt", "email", "id", "isActive", "lastLogin", "password", "role", "storeId", "tenantId", "updatedAt", "username") SELECT "createdAt", "email", "id", "isActive", "lastLogin", "password", "role", "storeId", "tenantId", "updatedAt", "username" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_tenantId_idx" ON "User"("tenantId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
