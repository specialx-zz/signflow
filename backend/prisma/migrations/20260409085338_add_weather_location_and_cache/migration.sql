-- CreateTable
CREATE TABLE `WeatherLocation` (
    `id` VARCHAR(191) NOT NULL,
    `sido` VARCHAR(191) NOT NULL,
    `sigungu` VARCHAR(191) NOT NULL,
    `nx` INTEGER NOT NULL,
    `ny` INTEGER NOT NULL,
    `regIdLand` VARCHAR(191) NOT NULL,
    `regIdTa` VARCHAR(191) NOT NULL,
    `airStationName` VARCHAR(191) NULL,
    `searchKey` VARCHAR(191) NOT NULL,
    `displayName` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `WeatherLocation_sido_sigungu_idx`(`sido`, `sigungu`),
    INDEX `WeatherLocation_searchKey_idx`(`searchKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WeatherCache` (
    `id` VARCHAR(191) NOT NULL,
    `cacheKey` VARCHAR(191) NOT NULL,
    `payload` LONGTEXT NOT NULL,
    `fetchedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `WeatherCache_cacheKey_key`(`cacheKey`),
    INDEX `WeatherCache_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
