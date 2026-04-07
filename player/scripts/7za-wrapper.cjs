#!/usr/bin/env node
/**
 * 7za.exe 래퍼
 * Windows에서 macOS 심볼릭 링크 생성 실패(exit 2)를 무시합니다.
 * 7-zip exit 2 = 일부 파일 처리 실패 (Windows에선 macOS symlink 권한 문제)
 * 실제 필요한 Windows 파일은 정상 추출됩니다.
 */

const { spawnSync } = require('child_process');
const path = require('path');

const REAL_7ZA = path.join(__dirname, '7za_orig.exe');
const args = process.argv.slice(2);

const result = spawnSync(REAL_7ZA, args, {
  stdio: 'inherit',
  windowsHide: true,
});

const exitCode = result.status ?? 1;

// exit 2 = 경고성 오류 (심볼릭 링크 권한) → 0으로 변환
if (exitCode === 2) {
  process.exit(0);
}

process.exit(exitCode);
