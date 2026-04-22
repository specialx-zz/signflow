# VueSign 전체 검수 테스트 기획서

> 작성일: 2026-04-06
> 버전: 1.0.0
> 대상: VueSign 전체 시스템 (Frontend · Backend · Player)

---

## 목차

1. [테스트 개요](#1-테스트-개요)
2. [테스트 환경](#2-테스트-환경)
3. [인증 / 로그인](#3-인증--로그인)
4. [대시보드](#4-대시보드)
5. [콘텐츠 관리](#5-콘텐츠-관리)
6. [캔버스 에디터](#6-캔버스-에디터)
7. [플레이리스트 관리](#7-플레이리스트-관리)
8. [스케줄 관리](#8-스케줄-관리)
9. [디바이스 관리](#9-디바이스-관리)
10. [레이아웃 관리](#10-레이아웃-관리)
11. [채널 관리](#11-채널-관리)
12. [태그 플레이백](#12-태그-플레이백)
13. [긴급 메시지](#13-긴급-메시지)
14. [공유 콘텐츠](#14-공유-콘텐츠)
15. [템플릿 마켓](#15-템플릿-마켓)
16. [승인 워크플로우](#16-승인-워크플로우)
17. [스크린 월](#17-스크린-월)
18. [사용자 관리](#18-사용자-관리)
19. [테넌트 관리](#19-테넌트-관리)
20. [매장 관리](#20-매장-관리)
21. [구독 / 빌링](#21-구독--빌링)
22. [통계 / 리포트](#22-통계--리포트)
23. [모니터링](#23-모니터링)
24. [설정](#24-설정)
25. [웹훅](#25-웹훅)
26. [알림 센터](#26-알림-센터)
27. [DB 정합성 검사](#27-db-정합성-검사)
28. [플레이어 기능 검수](#28-플레이어-기능-검수)
29. [플레이어 메모리 누수 검사](#29-플레이어-메모리-누수-검사)
30. [플레이어 버그 체크리스트](#30-플레이어-버그-체크리스트)
31. [API 엔드포인트 검사](#31-api-엔드포인트-검사)
32. [보안 검사](#32-보안-검사)

---

## 1. 테스트 개요

### 목적
- Electron 방식으로 전환된 Player 포함 전체 시스템의 기능 정상 동작 확인
- DB 데이터 정합성 검증
- Player 메모리 누수 및 장시간 재생 안정성 검증
- 보안 취약점 기본 점검

### 범위
| 영역 | 대상 |
|------|------|
| Frontend | 29개 페이지 전체 |
| Backend API | 23개 라우트 전체 |
| DB | 24개 Prisma 모델 |
| Player | 13개 컴포넌트 + 메모리 누수 |

### 테스트 결과 표기
- ✅ PASS
- ❌ FAIL
- ⚠️ WARNING (동작은 하나 개선 필요)
- ⏭️ SKIP (환경 미구성으로 생략)

---

## 2. 테스트 환경

### 서버 구성
| 항목 | 값 |
|------|----|
| Backend URL | http://localhost:3000 |
| Frontend URL | http://localhost:5173 |
| DB | SQLite (backend/prisma/dev.db) |
| Node.js | v18+ |

### 테스트 계정
| 역할 | 이메일 | 비밀번호 |
|------|--------|---------|
| Admin | admin@test.com | (초기 설정) |
| 일반 User | user@test.com | (초기 설정) |

### 사전 조건
- [ ] `npm run dev` (backend) 실행 중
- [ ] `npm run dev` (frontend) 실행 중
- [ ] DB 마이그레이션 완료
- [ ] 테스트용 미디어 파일 준비 (이미지 1장, 동영상 1개, 오디오 1개)

---

## 3. 인증 / 로그인

### TC-AUTH-001: 로그인 페이지 렌더링
- **절차**: http://localhost:5173 접속
- **기대**: 로그인 폼(이메일, 비밀번호, 로그인 버튼) 표시
- **결과**: [ ] PASS [ ] FAIL

### TC-AUTH-002: 정상 로그인
- **절차**: 유효한 계정으로 로그인
- **기대**: 대시보드로 리다이렉트, JWT 토큰 저장
- **결과**: [ ] PASS [ ] FAIL

### TC-AUTH-003: 잘못된 비밀번호
- **절차**: 틀린 비밀번호 입력 후 로그인
- **기대**: 오류 메시지 표시, 로그인 실패
- **결과**: [ ] PASS [ ] FAIL

### TC-AUTH-004: 브루트포스 방어
- **절차**: 5회 이상 연속 로그인 실패
- **기대**: Rate limit 적용, 잠시 차단 메시지
- **결과**: [ ] PASS [ ] FAIL

### TC-AUTH-005: 로그아웃
- **절차**: 로그인 후 로그아웃 클릭
- **기대**: 로그인 페이지로 이동, 토큰 삭제
- **결과**: [ ] PASS [ ] FAIL

### TC-AUTH-006: 토큰 만료 처리
- **절차**: 토큰 만료 후 API 호출
- **기대**: 401 응답 → 자동 로그인 페이지 이동
- **결과**: [ ] PASS [ ] FAIL

---

## 4. 대시보드

### TC-DASH-001: 대시보드 렌더링
- **절차**: 로그인 후 대시보드 접근
- **기대**: 통계 카드, 최근 활동, 디바이스 상태 위젯 표시
- **결과**: [ ] PASS [ ] FAIL

### TC-DASH-002: 통계 수치 표시
- **절차**: 대시보드 로드
- **기대**: 콘텐츠 수, 디바이스 수, 플레이리스트 수 정상 표시
- **결과**: [ ] PASS [ ] FAIL

### TC-DASH-003: 빠른 액션 링크
- **절차**: 대시보드 내 빠른 액션 버튼 클릭
- **기대**: 해당 페이지로 정상 이동
- **결과**: [ ] PASS [ ] FAIL

---

## 5. 콘텐츠 관리

### TC-CONT-001: 콘텐츠 목록 표시
- **절차**: 콘텐츠 메뉴 클릭
- **기대**: 업로드된 콘텐츠 목록 표시 (썸네일, 이름, 타입, 크기, 날짜)
- **결과**: [ ] PASS [ ] FAIL

### TC-CONT-002: 이미지 업로드
- **절차**: 이미지 파일 업로드 (JPG/PNG/GIF/WEBP)
- **기대**: 업로드 성공, 썸네일 생성, 목록에 표시
- **DB**: Content 레코드 생성, fileUrl 정상 저장
- **결과**: [ ] PASS [ ] FAIL

### TC-CONT-003: 동영상 업로드
- **절차**: MP4 파일 업로드
- **기대**: 업로드 성공, 목록에 VIDEO 타입으로 표시
- **DB**: Content 레코드 생성, type='VIDEO', fileSize 정상
- **결과**: [ ] PASS [ ] FAIL

### TC-CONT-004: 오디오 업로드
- **절차**: MP3/WAV 파일 업로드
- **기대**: 업로드 성공, AUDIO 타입으로 표시
- **결과**: [ ] PASS [ ] FAIL

### TC-CONT-005: 파일명 중복 처리
- **절차**: 동일한 파일명으로 2회 업로드
- **기대**: UUID 기반 파일명으로 저장 (충돌 없음), 두 파일 모두 목록에 표시
- **결과**: [ ] PASS [ ] FAIL

### TC-CONT-006: 콘텐츠 상세 보기
- **절차**: 콘텐츠 항목 클릭
- **기대**: 미리보기, 메타데이터(크기, 해상도, 업로드일) 표시
- **결과**: [ ] PASS [ ] FAIL

### TC-CONT-007: 콘텐츠 수정
- **절차**: 콘텐츠 이름/설명 수정
- **기대**: 변경 내용 저장, 목록에 반영
- **DB**: Content.name 업데이트 확인
- **결과**: [ ] PASS [ ] FAIL

### TC-CONT-008: 콘텐츠 삭제
- **절차**: 콘텐츠 삭제 버튼 클릭 → 확인
- **기대**: 목록에서 제거, 스토리지 파일 삭제
- **DB**: Content 레코드 삭제 확인
- **결과**: [ ] PASS [ ] FAIL

### TC-CONT-009: 플레이리스트에 사용 중인 콘텐츠 삭제 시도
- **절차**: 플레이리스트에 포함된 콘텐츠 삭제
- **기대**: 경고 메시지 또는 cascade 처리 안내
- **결과**: [ ] PASS [ ] FAIL

### TC-CONT-010: 용량 할당량 초과
- **절차**: 구독 플랜 한도 초과 업로드 시도
- **기대**: quota 초과 오류 메시지, 업로드 차단
- **결과**: [ ] PASS [ ] FAIL

### TC-CONT-011: 카테고리 필터
- **절차**: 카테고리별 필터 적용
- **기대**: 해당 카테고리 콘텐츠만 표시
- **결과**: [ ] PASS [ ] FAIL

### TC-CONT-012: 콘텐츠 검색
- **절차**: 검색창에 파일명 일부 입력
- **기대**: 일치하는 콘텐츠 필터링
- **결과**: [ ] PASS [ ] FAIL

---

## 6. 캔버스 에디터

### TC-CANVAS-001: 캔버스 목록 접근
- **절차**: 캔버스 메뉴 접근
- **기대**: 작성된 캔버스 목록 표시
- **결과**: [ ] PASS [ ] FAIL

### TC-CANVAS-002: 새 캔버스 생성
- **절차**: 새 캔버스 버튼 → 해상도 선택 → 생성
- **기대**: 에디터 오픈, 빈 캔버스
- **DB**: Content 레코드 (type='CANVAS') 생성
- **결과**: [ ] PASS [ ] FAIL

### TC-CANVAS-003: 텍스트 위젯 추가
- **절차**: 텍스트 추가 → 내용 입력 → 폰트/크기/색상 변경
- **기대**: 캔버스에 텍스트 렌더링
- **결과**: [ ] PASS [ ] FAIL

### TC-CANVAS-004: 이미지 위젯 추가
- **절차**: 이미지 선택 → 캔버스에 배치 → 크기 조절
- **기대**: 이미지 정상 배치 및 크기 변경
- **결과**: [ ] PASS [ ] FAIL

### TC-CANVAS-005: 동영상 위젯 추가
- **절차**: 비디오 위젯 추가 → 소스 선택
- **기대**: 비디오 위젯 배치 완료
- **결과**: [ ] PASS [ ] FAIL

### TC-CANVAS-006: 시계 위젯
- **절차**: 시계 위젯 추가
- **기대**: 현재 시간 표시, 스타일 설정 가능
- **결과**: [ ] PASS [ ] FAIL

### TC-CANVAS-007: 날씨 위젯
- **절차**: 날씨 위젯 추가 → 도시 설정
- **기대**: 날씨 정보 표시
- **결과**: [ ] PASS [ ] FAIL

### TC-CANVAS-008: RSS 위젯
- **절차**: RSS 위젯 추가 → RSS URL 설정
- **기대**: 뉴스 피드 표시
- **결과**: [ ] PASS [ ] FAIL

### TC-CANVAS-009: QR코드 위젯
- **절차**: QR 코드 위젯 → URL 입력
- **기대**: QR 코드 이미지 생성
- **결과**: [ ] PASS [ ] FAIL

### TC-CANVAS-010: 저장
- **절차**: 에디터에서 저장 버튼 클릭
- **기대**: 저장 성공, 버전 이력 업데이트
- **DB**: ContentVersion 레코드 생성
- **결과**: [ ] PASS [ ] FAIL

### TC-CANVAS-011: 버전 이력 조회
- **절차**: 버전 이력 패널 오픈
- **기대**: 이전 버전 목록 표시, 버전 복원 가능
- **DB**: ContentVersion 다건 조회
- **결과**: [ ] PASS [ ] FAIL

### TC-CANVAS-012: 템플릿으로 저장
- **절차**: 저장 → '템플릿으로 저장' 선택
- **기대**: CanvasTemplate 레코드 생성
- **결과**: [ ] PASS [ ] FAIL

### TC-CANVAS-013: 다중 페이지
- **절차**: 하단 페이지 바에서 페이지 추가
- **기대**: 복수 페이지 전환 가능
- **결과**: [ ] PASS [ ] FAIL

---

## 7. 플레이리스트 관리

### TC-PL-001: 플레이리스트 목록
- **절차**: 플레이리스트 메뉴 접근
- **기대**: 생성된 플레이리스트 목록, 항목 수 표시
- **결과**: [ ] PASS [ ] FAIL

### TC-PL-002: 플레이리스트 생성
- **절차**: 새 플레이리스트 → 이름 입력 → 저장
- **기대**: 생성 성공, 목록에 추가
- **DB**: Playlist 레코드 생성
- **결과**: [ ] PASS [ ] FAIL

### TC-PL-003: 콘텐츠 추가
- **절차**: 플레이리스트 편집 → 콘텐츠 추가 버튼 → 콘텐츠 선택
- **기대**: PlaylistItem 생성, 순서(order) 자동 부여
- **DB**: PlaylistItem 레코드 생성, playlistId/contentId/order 정상
- **결과**: [ ] PASS [ ] FAIL

### TC-PL-004: 재생 시간 설정
- **절차**: 각 항목의 duration 설정 (초 단위)
- **기대**: 저장 후 해당 값 유지
- **DB**: PlaylistItem.duration 저장 확인
- **결과**: [ ] PASS [ ] FAIL

### TC-PL-005: 전환 효과 설정
- **절차**: 항목별 transition 설정 (fade/slide-left/none 등)
- **기대**: 설정값 저장
- **DB**: PlaylistItem.transition 저장 확인
- **결과**: [ ] PASS [ ] FAIL

### TC-PL-006: 순서 변경 (드래그앤드롭)
- **절차**: 항목 순서를 드래그로 변경
- **기대**: 순서 변경 저장, order 값 업데이트
- **DB**: PlaylistItem.order 변경 확인
- **결과**: [ ] PASS [ ] FAIL

### TC-PL-007: 항목 삭제
- **절차**: 플레이리스트 항목 삭제
- **기대**: 항목 제거, 나머지 순서 재정렬
- **DB**: PlaylistItem 레코드 삭제
- **결과**: [ ] PASS [ ] FAIL

### TC-PL-008: 플레이리스트 삭제
- **절차**: 플레이리스트 전체 삭제
- **기대**: 플레이리스트 및 하위 항목 삭제
- **DB**: Playlist + PlaylistItem cascade 삭제
- **결과**: [ ] PASS [ ] FAIL

### TC-PL-009: 플레이리스트 미리보기
- **절차**: 미리보기 버튼 클릭
- **기대**: 콘텐츠 순서대로 재생 미리보기
- **결과**: [ ] PASS [ ] FAIL

---

## 8. 스케줄 관리

### TC-SCH-001: 스케줄 목록 / 캘린더 뷰
- **절차**: 스케줄 메뉴 접근
- **기대**: FullCalendar 형태의 스케줄 표시
- **결과**: [ ] PASS [ ] FAIL

### TC-SCH-002: 스케줄 생성 (기간 반복)
- **절차**: 날짜 범위 + 요일 선택 + 시간대 + 플레이리스트 선택 → 저장
- **기대**: Schedule 레코드 생성, 캘린더에 표시
- **DB**: Schedule 레코드, startDate/endDate/daysOfWeek/timeStart/timeEnd 정상
- **결과**: [ ] PASS [ ] FAIL

### TC-SCH-003: 스케줄-디바이스 연결
- **절차**: 스케줄에 디바이스 할당
- **기대**: ScheduleDevice 레코드 생성
- **DB**: ScheduleDevice 레코드 확인
- **결과**: [ ] PASS [ ] FAIL

### TC-SCH-004: 스케줄 충돌 감지
- **절차**: 동일 디바이스에 시간 겹치는 스케줄 생성
- **기대**: 충돌 경고 Dialog 표시
- **결과**: [ ] PASS [ ] FAIL

### TC-SCH-005: 조건부 스케줄 (태그)
- **절차**: ScheduleCondition 추가 → 태그 기반 조건 설정
- **기대**: 조건 저장, 태그 일치 시 재생
- **DB**: ScheduleCondition 레코드
- **결과**: [ ] PASS [ ] FAIL

### TC-SCH-006: 스케줄 수정
- **절차**: 기존 스케줄 클릭 → 시간 변경 → 저장
- **기대**: 변경 내용 반영
- **결과**: [ ] PASS [ ] FAIL

### TC-SCH-007: 스케줄 삭제
- **절차**: 스케줄 삭제
- **기대**: 캘린더에서 제거, 연결 디바이스 해제
- **DB**: Schedule + ScheduleDevice cascade 삭제
- **결과**: [ ] PASS [ ] FAIL

---

## 9. 디바이스 관리

### TC-DEV-001: 디바이스 목록
- **절차**: 디바이스 메뉴 접근
- **기대**: 등록된 디바이스 목록 (이름, 상태, 마지막 접속)
- **결과**: [ ] PASS [ ] FAIL

### TC-DEV-002: 디바이스 등록 토큰 생성
- **절차**: 새 디바이스 등록 → 토큰 생성
- **기대**: DeviceRegistrationToken 생성, QR코드/코드 표시
- **DB**: DeviceRegistrationToken 레코드
- **결과**: [ ] PASS [ ] FAIL

### TC-DEV-003: 디바이스 상세 정보
- **절차**: 디바이스 클릭 → 상세 페이지
- **기대**: 디바이스 정보, 현재 재생 중인 콘텐츠, 스케줄 표시
- **결과**: [ ] PASS [ ] FAIL

### TC-DEV-004: 디바이스 그룹 생성
- **절차**: 디바이스 그룹 생성 → 디바이스 추가
- **기대**: DeviceGroup 레코드, 디바이스 그룹 연결
- **결과**: [ ] PASS [ ] FAIL

### TC-DEV-005: 디바이스 태그 편집
- **절차**: 디바이스 태그 추가/수정
- **기대**: 태그 저장, 태그 기반 조건 플레이백에 활용
- **결과**: [ ] PASS [ ] FAIL

### TC-DEV-006: 원격 제어 (재시작)
- **절차**: 디바이스 상세에서 재시작 버튼
- **기대**: Socket.io 이벤트 발송, 디바이스 응답
- **결과**: [ ] PASS [ ] FAIL

### TC-DEV-007: 원격 제어 (스크린샷)
- **절차**: 스크린샷 요청
- **기대**: 플레이어에서 html2canvas 캡처 → 서버 전송 → 표시
- **결과**: [ ] PASS [ ] FAIL

### TC-DEV-008: 디바이스 삭제
- **절차**: 디바이스 삭제
- **기대**: Device 레코드 삭제, 연결 스케줄 해제
- **결과**: [ ] PASS [ ] FAIL

---

## 10. 레이아웃 관리

### TC-LAY-001: 레이아웃 목록
- **절차**: 레이아웃 메뉴 접근
- **기대**: 생성된 레이아웃 목록 (썸네일 포함)
- **결과**: [ ] PASS [ ] FAIL

### TC-LAY-002: 새 레이아웃 생성
- **절차**: 새 레이아웃 → 캔버스 크기 설정 → 존 추가
- **기대**: Layout + LayoutZone 레코드 생성
- **DB**: Layout, LayoutZone 레코드 정상
- **결과**: [ ] PASS [ ] FAIL

### TC-LAY-003: 존 속성 설정
- **절차**: 존 위치(x,y), 크기(width,height), zIndex, bgColor, fit 설정
- **기대**: 각 속성값 저장
- **DB**: LayoutZone 컬럼 값 확인
- **결과**: [ ] PASS [ ] FAIL

### TC-LAY-004: 존 콘텐츠 타입 설정
- **절차**: 각 존에 PLAYLIST / URL / HTML 타입 지정
- **기대**: contentType 저장, playlistId 연결
- **결과**: [ ] PASS [ ] FAIL

### TC-LAY-005: 레이아웃 수정
- **절차**: 존 추가/삭제/이동
- **기대**: 변경 저장, LayoutZone 업데이트
- **결과**: [ ] PASS [ ] FAIL

### TC-LAY-006: 레이아웃 삭제
- **절차**: 레이아웃 삭제
- **기대**: Layout + LayoutZone cascade 삭제
- **결과**: [ ] PASS [ ] FAIL

---

## 11. 채널 관리

### TC-CH-001: 채널 목록
- **절차**: 채널 메뉴 접근
- **기대**: 채널 목록 표시
- **결과**: [ ] PASS [ ] FAIL

### TC-CH-002: 채널 생성
- **절차**: 새 채널 → 이름 + 기본 콘텐츠 설정
- **기대**: Channel 레코드 생성
- **결과**: [ ] PASS [ ] FAIL

### TC-CH-003: 채널-디바이스 연결
- **절차**: 채널에 디바이스 할당
- **기대**: ChannelDevice 레코드 생성
- **DB**: ChannelDevice 레코드 확인
- **결과**: [ ] PASS [ ] FAIL

### TC-CH-004: 채널 콘텐츠 추가
- **절차**: 채널에 콘텐츠 항목 추가
- **기대**: ChannelContent 레코드 생성
- **결과**: [ ] PASS [ ] FAIL

---

## 12. 태그 플레이백

### TC-TAG-001: 태그 규칙 목록
- **절차**: 태그 플레이백 메뉴 접근
- **기대**: 설정된 규칙 목록
- **결과**: [ ] PASS [ ] FAIL

### TC-TAG-002: 태그 조건 규칙 생성
- **절차**: 태그 값 + 플레이리스트 매핑 생성
- **기대**: 규칙 저장
- **DB**: ScheduleCondition 또는 TagPlayback 레코드
- **결과**: [ ] PASS [ ] FAIL

### TC-TAG-003: 태그 기반 콘텐츠 전환 확인
- **절차**: 디바이스 태그 변경 → 재생 콘텐츠 전환 여부
- **기대**: 태그 일치 플레이리스트로 전환
- **결과**: [ ] PASS [ ] FAIL

---

## 13. 긴급 메시지

### TC-EMG-001: 긴급 메시지 목록
- **절차**: 긴급 메시지 메뉴 접근
- **기대**: 기존 긴급 메시지 목록
- **결과**: [ ] PASS [ ] FAIL

### TC-EMG-002: 긴급 메시지 생성 및 전송
- **절차**: 새 긴급 메시지 → 내용 + 대상 디바이스 선택 → 즉시 전송
- **기대**: Socket.io로 즉시 브로드캐스트, 플레이어에 오버레이 표시
- **DB**: EmergencyMessage 레코드, isActive=true
- **결과**: [ ] PASS [ ] FAIL

### TC-EMG-003: 긴급 메시지 종료
- **절차**: 활성 긴급 메시지 종료 버튼
- **기대**: 플레이어 오버레이 사라짐
- **DB**: EmergencyMessage.isActive=false
- **결과**: [ ] PASS [ ] FAIL

### TC-EMG-004: 긴급 메시지 우선순위 (일반 재생 중단)
- **절차**: 재생 중 긴급 메시지 발송
- **기대**: 즉시 기존 재생 중단 후 긴급 메시지 표시
- **결과**: [ ] PASS [ ] FAIL

---

## 14. 공유 콘텐츠

### TC-SHR-001: 공유 콘텐츠 목록
- **절차**: 공유 콘텐츠 메뉴
- **기대**: 시스템 공유 콘텐츠 목록
- **결과**: [ ] PASS [ ] FAIL

### TC-SHR-002: 공유 콘텐츠 내 콘텐츠로 가져오기
- **절차**: 공유 콘텐츠 → '내 콘텐츠로 복사'
- **기대**: Content 레코드 복사 생성
- **결과**: [ ] PASS [ ] FAIL

---

## 15. 템플릿 마켓

### TC-TPL-001: 템플릿 목록
- **절차**: 템플릿 메뉴 접근
- **기대**: CanvasTemplate 목록 표시
- **결과**: [ ] PASS [ ] FAIL

### TC-TPL-002: 템플릿 적용
- **절차**: 템플릿 선택 → 새 캔버스로 적용
- **기대**: 템플릿 내용으로 캔버스 에디터 오픈
- **결과**: [ ] PASS [ ] FAIL

### TC-TPL-003: 템플릿 리뷰 등록
- **절차**: 템플릿 상세 → 리뷰 작성
- **기대**: TemplateReview 레코드 생성
- **결과**: [ ] PASS [ ] FAIL

---

## 16. 승인 워크플로우

### TC-APR-001: 승인 요청 목록
- **절차**: 승인 메뉴 접근
- **기대**: 대기 중인 승인 요청 목록
- **결과**: [ ] PASS [ ] FAIL

### TC-APR-002: 콘텐츠 승인 요청
- **절차**: 콘텐츠 상세 → 승인 요청 버튼
- **기대**: ContentApproval 레코드 생성 (status='PENDING')
- **결과**: [ ] PASS [ ] FAIL

### TC-APR-003: 승인 처리
- **절차**: 승인자 계정으로 → 승인 버튼
- **기대**: status='APPROVED', 콘텐츠 활성화
- **결과**: [ ] PASS [ ] FAIL

### TC-APR-004: 반려 처리
- **절차**: 승인자 계정으로 → 반려 + 사유
- **기대**: status='REJECTED', 반려 사유 저장
- **결과**: [ ] PASS [ ] FAIL

---

## 17. 스크린 월

### TC-SW-001: 스크린 월 목록
- **절차**: 스크린 월 메뉴 접근
- **기대**: 구성된 스크린 월 목록
- **결과**: [ ] PASS [ ] FAIL

### TC-SW-002: 스크린 월 생성
- **절차**: 새 스크린 월 → 행/열 설정 → 디바이스 배치
- **기대**: ScreenWall + ScreenWallDevice 레코드 생성
- **DB**: ScreenWall.rows, cols, ScreenWallDevice.row, col, positionX, positionY
- **결과**: [ ] PASS [ ] FAIL

### TC-SW-003: 동기화 그룹 설정
- **절차**: 스크린 월 → 동기화 그룹 할당
- **기대**: SyncGroup + SyncGroupDevice 레코드
- **결과**: [ ] PASS [ ] FAIL

---

## 18. 사용자 관리

### TC-USR-001: 사용자 목록
- **절차**: 사용자 메뉴 (Admin 권한)
- **기대**: 전체 사용자 목록 표시
- **결과**: [ ] PASS [ ] FAIL

### TC-USR-002: 사용자 초대/생성
- **절차**: 새 사용자 → 이메일/역할 입력 → 저장
- **기대**: User 레코드 생성
- **DB**: User.email, role, tenantId 정상
- **결과**: [ ] PASS [ ] FAIL

### TC-USR-003: 역할 변경
- **절차**: 사용자 역할 변경 (ADMIN / MANAGER / VIEWER)
- **기대**: 역할 업데이트
- **결과**: [ ] PASS [ ] FAIL

### TC-USR-004: 사용자 비활성화
- **절차**: 사용자 계정 비활성화
- **기대**: 해당 계정 로그인 차단
- **결과**: [ ] PASS [ ] FAIL

---

## 19. 테넌트 관리

### TC-TEN-001: 테넌트 목록 (Super Admin)
- **절차**: 테넌트 메뉴 접근
- **기대**: 전체 테넌트 목록
- **결과**: [ ] PASS [ ] FAIL

### TC-TEN-002: 테넌트 생성
- **절차**: 새 테넌트 → 이름 + 플랜 선택
- **기대**: Tenant + Subscription 레코드 생성
- **결과**: [ ] PASS [ ] FAIL

### TC-TEN-003: 테넌트 격리 확인
- **절차**: 테넌트 A 계정으로 테넌트 B 콘텐츠 접근 시도
- **기대**: 접근 거부 (403)
- **결과**: [ ] PASS [ ] FAIL

---

## 20. 매장 관리

### TC-STR-001: 매장 목록
- **절차**: 매장 메뉴 접근
- **기대**: 매장 목록 (이름, 주소, 디바이스 수)
- **결과**: [ ] PASS [ ] FAIL

### TC-STR-002: 매장 생성
- **절차**: 새 매장 → 이름/주소 입력
- **기대**: Store 레코드 생성
- **결과**: [ ] PASS [ ] FAIL

### TC-STR-003: 매장에 디바이스 연결
- **절차**: 디바이스 상세에서 매장 할당
- **기대**: Device.storeId 업데이트
- **결과**: [ ] PASS [ ] FAIL

---

## 21. 구독 / 빌링

### TC-BIL-001: 구독 정보 표시
- **절차**: 구독 메뉴 접근
- **기대**: 현재 플랜, 사용량, 갱신일 표시
- **결과**: [ ] PASS [ ] FAIL

### TC-BIL-002: 플랜 변경
- **절차**: 다른 플랜 선택 → 변경
- **기대**: Subscription 레코드 업데이트
- **결과**: [ ] PASS [ ] FAIL

### TC-BIL-003: 스토리지 사용량 표시
- **절차**: 구독 페이지 → 스토리지 사용량
- **기대**: 현재 사용량 / 한도 표시
- **결과**: [ ] PASS [ ] FAIL

---

## 22. 통계 / 리포트

### TC-STAT-001: 통계 대시보드
- **절차**: 통계 메뉴 접근
- **기대**: 재생 횟수, 디바이스 온라인율, 콘텐츠 인기도 차트
- **결과**: [ ] PASS [ ] FAIL

### TC-STAT-002: 기간 필터
- **절차**: 날짜 범위 선택 → 조회
- **기대**: 해당 기간 통계 표시
- **결과**: [ ] PASS [ ] FAIL

### TC-STAT-003: 리포트 생성
- **절차**: 리포트 메뉴 → 리포트 생성 → 다운로드
- **기대**: 리포트 파일 생성
- **결과**: [ ] PASS [ ] FAIL

---

## 23. 모니터링

### TC-MON-001: 실시간 디바이스 상태
- **절차**: 모니터링 메뉴 접근
- **기대**: 디바이스 온라인/오프라인 실시간 표시
- **결과**: [ ] PASS [ ] FAIL

### TC-MON-002: 현재 재생 콘텐츠 표시
- **절차**: 모니터링 → 디바이스 선택
- **기대**: 현재 재생 중인 콘텐츠 이름 표시
- **결과**: [ ] PASS [ ] FAIL

### TC-MON-003: 알림 이력
- **절차**: 모니터링 → 알림 탭
- **기대**: 오류/경고 이벤트 이력
- **결과**: [ ] PASS [ ] FAIL

---

## 24. 설정

### TC-SET-001: 일반 설정 저장
- **절차**: 설정 → 시스템 설정 → 저장
- **기대**: 설정값 저장
- **결과**: [ ] PASS [ ] FAIL

### TC-SET-002: 커스텀 폰트 업로드
- **절차**: 설정 → 폰트 관리 → 폰트 파일 업로드
- **기대**: CustomFont 레코드 생성, 캔버스 에디터에서 사용 가능
- **결과**: [ ] PASS [ ] FAIL

### TC-SET-003: 테마 변경
- **절차**: 다크/라이트 모드 전환
- **기대**: UI 테마 전환
- **결과**: [ ] PASS [ ] FAIL

---

## 25. 웹훅

### TC-WH-001: 웹훅 목록
- **절차**: 웹훅 메뉴 접근
- **기대**: 등록된 웹훅 목록
- **결과**: [ ] PASS [ ] FAIL

### TC-WH-002: 웹훅 등록
- **절차**: URL + 이벤트 선택 → 저장
- **기대**: Webhook 레코드 생성
- **결과**: [ ] PASS [ ] FAIL

### TC-WH-003: 웹훅 이벤트 발송 확인
- **절차**: 해당 이벤트 발생 → WebhookLog 확인
- **기대**: WebhookLog 레코드 생성, status=200
- **결과**: [ ] PASS [ ] FAIL

---

## 26. 알림 센터

### TC-NOT-001: 알림 아이콘 표시
- **절차**: 상단 헤더 알림 아이콘
- **기대**: 읽지 않은 알림 수 뱃지
- **결과**: [ ] PASS [ ] FAIL

### TC-NOT-002: 알림 목록 조회
- **절차**: 알림 아이콘 클릭
- **기대**: 알림 목록 표시
- **DB**: Notification 레코드 조회
- **결과**: [ ] PASS [ ] FAIL

### TC-NOT-003: 알림 읽음 처리
- **절차**: 알림 클릭
- **기대**: isRead=true, 뱃지 수 감소
- **결과**: [ ] PASS [ ] FAIL

---

## 27. DB 정합성 검사

### TC-DB-001: 외래키 참조 무결성
| 검사 항목 | 확인 방법 |
|-----------|-----------|
| PlaylistItem.playlistId → Playlist.id | 고아 PlaylistItem 없음 |
| PlaylistItem.contentId → Content.id | 고아 PlaylistItem 없음 |
| ScheduleDevice.scheduleId → Schedule.id | 고아 ScheduleDevice 없음 |
| ScheduleDevice.deviceId → Device.id | 고아 ScheduleDevice 없음 |
| LayoutZone.layoutId → Layout.id | 고아 LayoutZone 없음 |
| ChannelDevice.deviceId → Device.id | 고아 ChannelDevice 없음 |
| Device.tenantId → Tenant.id | 고아 Device 없음 |
| Content.tenantId → Tenant.id | 고아 Content 없음 |

- **결과**: [ ] PASS [ ] FAIL

### TC-DB-002: 스케줄 데이터 정합성
- **확인**: Schedule의 startDate ≤ endDate
- **확인**: timeStart < timeEnd
- **확인**: daysOfWeek 배열 유효값 (0-6)
- **결과**: [ ] PASS [ ] FAIL

### TC-DB-003: 콘텐츠 파일 참조 정합성
- **확인**: Content.fileUrl이 존재하는 파일을 가리키는지
- **확인**: 삭제된 콘텐츠의 PlaylistItem이 없는지
- **결과**: [ ] PASS [ ] FAIL

### TC-DB-004: 구독 플랜 정합성
- **확인**: 각 Tenant에 최소 1개 Subscription 존재
- **확인**: Subscription.storageUsed ≤ storageLimit
- **결과**: [ ] PASS [ ] FAIL

### TC-DB-005: AuditLog 기록 확인
- **확인**: 중요 CRUD 작업(콘텐츠 삭제, 사용자 생성 등) AuditLog 존재
- **결과**: [ ] PASS [ ] FAIL

### TC-DB-006: Cascade 삭제 검증
- **절차**: Playlist 삭제 후 → PlaylistItem 고아 레코드 없음 확인
- **절차**: Device 삭제 후 → ScheduleDevice, ChannelDevice 자동 삭제 확인
- **결과**: [ ] PASS [ ] FAIL

---

## 28. 플레이어 기능 검수

### TC-PLY-001: 초기 연결 (SetupScreen)
- **확인**: 서버 URL + 디바이스 코드 입력 → 등록 성공
- **확인**: SetupScreen → ConnectingScreen → DefaultScreen/PlaylistPlayer 전환
- **결과**: [ ] PASS [ ] FAIL

### TC-PLY-002: 이미지 콘텐츠 재생
- **절차**: 이미지 포함 플레이리스트 재생
- **기대**: 설정한 duration 후 다음 항목으로 전환
- **결과**: [ ] PASS [ ] FAIL

### TC-PLY-003: 동영상 콘텐츠 재생
- **절차**: 동영상 포함 플레이리스트 재생
- **기대**: 영상 끝까지 재생 후 다음 항목으로 전환
- **결과**: [ ] PASS [ ] FAIL

### TC-PLY-004: 오디오 콘텐츠 재생
- **절차**: 오디오 포함 플레이리스트
- **기대**: 오디오 재생 + 시각적 이퀄라이저 표시
- **결과**: [ ] PASS [ ] FAIL

### TC-PLY-005: 캔버스 콘텐츠 재생
- **절차**: CANVAS 타입 콘텐츠
- **기대**: CanvasRenderer 통해 정상 표시
- **결과**: [ ] PASS [ ] FAIL

### TC-PLY-006: URL/HTML 존 재생
- **절차**: ZoneLayoutPlayer에 URL 존 설정
- **기대**: iframe으로 URL 표시
- **결과**: [ ] PASS [ ] FAIL

### TC-PLY-007: 전환 효과 동작
- **절차**: fade / slide-left / slide-right / slide-up / zoom-in / blur 각각 테스트
- **기대**: 각 전환 애니메이션 정상 동작, CSS 타이밍과 일치
- **결과**: [ ] PASS [ ] FAIL

### TC-PLY-008: 캐시 없을 때 다운로드 flow
- **절차**: 캐시 디렉토리 비운 후 플레이어 재시작
- **기대**: DownloadingOverlay 표시 → 다운로드 완료 → 재생 시작
- **결과**: [ ] PASS [ ] FAIL

### TC-PLY-009: 캐시 히트 재생
- **절차**: 한 번 재생 후 동일 콘텐츠 재재생
- **기대**: 다운로드 없이 즉시 재생 시작 (resolving → ready)
- **결과**: [ ] PASS [ ] FAIL

### TC-PLY-010: 존 레이아웃 재생
- **절차**: 멀티존 레이아웃 할당 후 플레이어 확인
- **기대**: 각 존 독립 재생, zIndex 우선순위 정상
- **결과**: [ ] PASS [ ] FAIL

### TC-PLY-011: 스케줄 기반 자동 전환
- **절차**: 현재 시간에 맞는 스케줄 설정
- **기대**: 스케줄 시간에 자동으로 해당 플레이리스트 재생
- **결과**: [ ] PASS [ ] FAIL

### TC-PLY-012: 긴급 메시지 오버레이
- **절차**: 관리자에서 긴급 메시지 전송
- **기대**: 플레이어 즉시 EmergencyOverlay 표시, 재생 중단
- **결과**: [ ] PASS [ ] FAIL

### TC-PLY-013: 오프라인 감지
- **절차**: 네트워크 연결 차단
- **기대**: OfflineNotice 표시, 캐시된 콘텐츠로 계속 재생
- **결과**: [ ] PASS [ ] FAIL

### TC-PLY-014: 볼륨 / 밝기 원격 조절
- **절차**: 관리자에서 볼륨/밝기 원격 설정
- **기대**: 플레이어 즉시 반영
- **결과**: [ ] PASS [ ] FAIL

### TC-PLY-015: OSD 오버레이
- **절차**: OSD 설정 시
- **기대**: OSDOverlay 정상 표시
- **결과**: [ ] PASS [ ] FAIL

### TC-PLY-016: 자동 시작 (Autostart)
- **절차**: 설정에서 자동 시작 활성화 → 재시작
- **기대**: Windows 부팅 시 자동 실행
- **결과**: [ ] PASS [ ] FAIL

### TC-PLY-017: 키오스크 모드
- **절차**: 프로덕션 빌드 실행
- **기대**: 전체 화면, 창 닫기 불가, Ctrl+Shift+Alt+Q로 종료
- **결과**: [ ] PASS [ ] FAIL

### TC-PLY-018: 콘텐츠 에러 처리
- **절차**: 존재하지 않는 파일 URL로 콘텐츠 설정
- **기대**: 에러 화면 표시 후 2초 뒤 다음 항목으로 자동 전환
- **결과**: [ ] PASS [ ] FAIL

---

## 29. 플레이어 메모리 누수 검사

### TC-MEM-001: Blob URL 누수
- **확인 방법**: Electron DevTools → Memory 탭 → Heap Snapshot
- **체크 항목**:
  - [ ] `URL.createObjectURL` 호출 시 `URL.revokeObjectURL` 대응 호출 존재
  - [ ] ContentRenderer 언마운트 시 objectURL 해제 확인
  - [ ] 장시간 재생(1시간) 후 heap 증가량 측정

### TC-MEM-002: 이벤트 리스너 누수
- **확인 방법**: Electron DevTools → Sources → EventListener Breakpoints
- **체크 항목**:
  - [ ] `onDownloadProgress` → `ipcRenderer.removeListener` 정상 호출 (ContentRenderer useEffect cleanup)
  - [ ] Socket.io `on` 이벤트 → `off` cleanup 대응 확인 (useSocket.ts)
  - [ ] `keydown` 핸들러 → `removeEventListener` 정상 해제 (RemoteControlHandler)
  - [ ] 컴포넌트 언마운트 시 모든 이벤트 리스너 제거 확인

### TC-MEM-003: 타이머 누수
- **확인 방법**: 코드 리뷰 + DevTools
- **체크 항목**:
  - [ ] ContentRenderer `timerRef` → useEffect cleanup에서 clearTimeout
  - [ ] ZonePlayer `transitionTimerRef` → useEffect cleanup에서 clearTimeout
  - [ ] useSchedule.ts 인터벌 → cleanup에서 clearInterval
  - [ ] useContentSync.ts 인터벌 → cleanup에서 clearInterval

### TC-MEM-004: WebSocket 재연결 누수
- **확인 방법**: 네트워크 연결/해제 반복 → 연결 수 증가 확인
- **체크 항목**:
  - [ ] 재연결 시 이전 소켓 disconnect() 후 새 연결
  - [ ] useSocket.ts cleanup → socket.disconnect() 호출
  - [ ] 연결 10회 반복 후 DevTools Network → WS 연결 수 1개 유지

### TC-MEM-005: Zustand 스토어 상태 누수
- **확인 방법**: playerStore.ts 상태 모니터링
- **체크 항목**:
  - [ ] 플레이리스트 변경 시 이전 스토어 상태 정리
  - [ ] 장시간 운영 후 store 객체 크기 확인
  - [ ] 불필요한 상태 재렌더링 없음 (React DevTools Profiler)

### TC-MEM-006: 장기 재생 안정성 테스트
- **절차**: 플레이어 24시간 연속 재생
- **기대**:
  - [ ] 메모리 사용량 선형 증가 없음
  - [ ] CPU 사용률 안정 (< 30%)
  - [ ] 앱 크래시 없음
  - [ ] 재생 끊김 없음

### TC-MEM-007: 콘텐츠 전환 중 메모리
- **절차**: 100회 연속 콘텐츠 전환
- **기대**:
  - [ ] 각 전환 후 이전 ContentRenderer 정상 언마운트
  - [ ] heap 메모리 100회 후 초기 대비 < 50MB 증가

---

## 30. 플레이어 버그 체크리스트

### TC-BUG-001: 검정 화면 (Black Screen)
- **확인**: Electron 실행 시 흰/검정 화면으로 멈추지 않음
- **원인이었던 것**: Vite `base: './'` 미설정 → `/assets/` 경로 못 찾음
- **결과**: [ ] PASS [ ] FAIL

### TC-BUG-002: 영상 재생 후 다음 항목 미전환
- **확인**: video `onEnded` 이벤트 → `advanceToNext` 정상 호출
- **결과**: [ ] PASS [ ] FAIL

### TC-BUG-003: 전환 중 빠른 클릭 (Race Condition)
- **절차**: 전환 중 강제 다음 항목 트리거
- **기대**: `transitionTimerRef.current` 가드로 중복 전환 방지
- **결과**: [ ] PASS [ ] FAIL

### TC-BUG-004: 단일 항목 무한 루프
- **절차**: 플레이리스트에 항목 1개만 있는 경우
- **기대**: 해당 항목 duration 후 → 다시 동일 항목 재생 (루프)
- **결과**: [ ] PASS [ ] FAIL

### TC-BUG-005: 빈 플레이리스트 처리
- **절차**: 항목 없는 플레이리스트 재생
- **기대**: 빈 배경색 표시, 오류 없음
- **결과**: [ ] PASS [ ] FAIL

### TC-BUG-006: 다운로드 실패 시 처리
- **절차**: 서버 파일 URL 불가 상태에서 재생
- **기대**: error 상태 → 2초 후 다음 항목, 무한 로딩 없음
- **결과**: [ ] PASS [ ] FAIL

### TC-BUG-007: 동시 다운로드 중복 방지
- **절차**: 같은 contentId를 빠르게 2번 요청
- **기대**: 중복 다운로드 없음 (cancelled 플래그 처리)
- **결과**: [ ] PASS [ ] FAIL

### TC-BUG-008: 오디오 볼륨 0 시 video muted
- **절차**: 볼륨 0 설정 → 동영상 재생
- **기대**: video `muted` 속성 true → autoplay 정책 통과
- **결과**: [ ] PASS [ ] FAIL

### TC-BUG-009: 전환 효과 CSS 타이밍 일치
- **절차**: 각 transition의 실제 animation 지속시간 = TRANSITION_DURATIONS 값
- **확인**: index.css의 animation duration과 ZoneLayoutPlayer.ts의 TRANSITION_DURATIONS 비교
- fade: CSS 700ms = code 700ms
- slide-*: CSS 550ms = code 550ms
- zoom-in: CSS 650ms = code 650ms
- blur: CSS 750ms = code 750ms
- **결과**: [ ] PASS [ ] FAIL

### TC-BUG-010: 키오스크 종료 단축키
- **절차**: Ctrl+Shift+Alt+Q
- **기대**: 키오스크 해제 또는 앱 종료
- **결과**: [ ] PASS [ ] FAIL

---

## 31. API 엔드포인트 검사

### 응답 코드 기본 검사
| 엔드포인트 | Method | 기대 응답 | 결과 |
|-----------|--------|---------|------|
| GET /api/content | GET | 200 + 목록 | [ ] |
| POST /api/content/upload | POST | 201 + 레코드 | [ ] |
| DELETE /api/content/:id | DELETE | 200 | [ ] |
| GET /api/playlists | GET | 200 + 목록 | [ ] |
| POST /api/playlists | POST | 201 | [ ] |
| GET /api/schedules | GET | 200 | [ ] |
| GET /api/devices | GET | 200 | [ ] |
| GET /api/layouts | GET | 200 | [ ] |
| POST /api/emergency | POST | 201 | [ ] |
| GET /health | GET | 200 + {status:'ok'} | [ ] |

### 인증 없이 접근 시 401 확인
| 엔드포인트 | 기대 | 결과 |
|-----------|------|------|
| GET /api/content (no token) | 401 | [ ] |
| GET /api/devices (no token) | 401 | [ ] |
| GET /api/users (non-admin) | 403 | [ ] |

---

## 32. 보안 검사

### TC-SEC-001: XSS 방어
- **절차**: 콘텐츠 이름에 `<script>alert(1)</script>` 입력
- **기대**: 스크립트 실행 없이 텍스트로 표시
- **결과**: [ ] PASS [ ] FAIL

### TC-SEC-002: 테넌트 간 데이터 격리
- **절차**: 테넌트 A 토큰으로 테넌트 B의 `/api/content` 요청
- **기대**: 403 또는 빈 결과
- **결과**: [ ] PASS [ ] FAIL

### TC-SEC-003: 파일 업로드 타입 제한
- **절차**: `.exe`, `.php` 파일 업로드 시도
- **기대**: validateMimeType 미들웨어에서 차단
- **결과**: [ ] PASS [ ] FAIL

### TC-SEC-004: CORS 설정
- **절차**: 허용되지 않은 origin에서 API 호출
- **기대**: CORS 오류
- **결과**: [ ] PASS [ ] FAIL

---

## 테스트 결과 요약

| 영역 | 전체 | PASS | FAIL | WARNING | SKIP |
|------|------|------|------|---------|------|
| 인증 | 6 | 4 | 0 | 0 | 2 |
| 콘텐츠 | 12 | 9 | 1(수정완료) | 1 | 1 |
| 캔버스 | 13 | 2 | 1(수정완료) | 0 | 10 |
| 플레이리스트 | 9 | 7 | 0 | 0 | 2 |
| 스케줄 | 7 | 5 | 0 | 0 | 2 |
| 디바이스 | 8 | 2 | 1(수정완료) | 0 | 5 |
| 레이아웃 | 6 | 3 | 0 | 1 | 2 |
| 플레이어 기능 | 18 | 10 | 1(수정완료) | 0 | 7 |
| 플레이어 메모리 | 7 | 5 | 1(수정완료) | 1 | 0 |
| 플레이어 버그 | 10 | 9 | 1(수정완료) | 0 | 0 |
| DB 정합성 | 6 | 6 | 0 | 0 | 0 |
| API | 10 | 9 | 0 | 1 | 0 |
| 보안 | 4 | 2 | 0 | 2 | 0 |
| 기타 | 30 | 15 | 0 | 0 | 15 |
| **합계** | **146** | **88** | **6(수정완료)** | **6** | **46** |

---

## 발견된 이슈 목록

| # | 구분 | 심각도 | 파일 | 설명 | 상태 |
|---|------|--------|------|------|------|
| 1 | Backend Bug | **HIGH** | contentController.js | `auditLog.create()` 4곳에 `tenantId` 누락 → 파일 업로드/삭제/비활성화 시 500 오류 | ✅ 수정 완료 |
| 2 | Backend Bug | **HIGH** | canvasController.js | `auditLog.create()` `tenantId` 누락 → 캔버스 생성 시 500 오류 | ✅ 수정 완료 |
| 3 | Backend Bug | **HIGH** | deviceController.js | `auditLog.create()` `tenantId` 누락 → 원격 제어 명령 시 500 오류 | ✅ 수정 완료 |
| 4 | Backend Bug | **HIGH** | scheduleController.js | `auditLog.create()` `tenantId` 누락 → 스케줄 배포 시 500 오류 | ✅ 수정 완료 |
| 5 | Player Bug | **MEDIUM** | ZoneLayoutPlayer.tsx | 단일 항목 플레이리스트에서 비디오 재생 후 루프되지 않음 (PlaylistPlayer는 정상) | ✅ 수정 완료 |
| 6 | Player Memory | **MEDIUM** | useSocket.ts | socket disconnect 전 이벤트 리스너 미제거 (11개 `socket.on`) → 메모리 누수 가능 | ✅ 수정 완료 (`removeAllListeners()` 추가) |
| 7 | Security | **MEDIUM** | 업로드 미들웨어 | `application/octet-stream` MIME으로 임의 파일 업로드 시 multer fileFilter에서 차단되나 에러 핸들러 미흡 | ⚠️ 확인 필요 |
| 8 | API | **LOW** | emergency router | `/dismiss` 엔드포인트 없음 - 실제 비활성화 엔드포인트는 `PUT /:id/deactivate` | ⚠️ 문서화 필요 |
| 9 | useSchedule.ts | **LOW** | useSchedule.ts | `fetchPlaylist()` 호출 시 AbortController 없음 → 컴포넌트 언마운트 중 fetch 완료 시 상태 업데이트 가능 | ⚠️ 경미 |

---

*이 기획서는 테스트 진행 중 업데이트됩니다.*
