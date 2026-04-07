@echo off
REM 7za.cmd - 심볼릭 링크 권한 에러(exit 2)를 무시하는 래퍼
REM Windows에서 macOS 심볼릭 링크 생성 실패는 치명적 오류가 아니므로 0으로 변환

"D:\work\claude_project\magicinfo\player\node_modules\7zip-bin\win\x64\7za.exe" %*
set EXITCODE=%ERRORLEVEL%
if %EXITCODE%==2 exit /b 0
exit /b %EXITCODE%
