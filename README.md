# 골목 레이더

오프라인 창업을 원하는 사람이 막연한 아이디어에서 후보 상권, 입지 비용, 지원 제도, 개업 후 운영 개선까지 이어갈 수 있도록 돕는 첫 파이프라인입니다. 서울 25개 자치구 카페 상권의 탐색·비교 엔진과 초보 창업자용 성향 진단·결과 리포트를 제공합니다.

## 현재 구현된 상권 판단 엔진

- 서울 공식 상권 1,650곳 검색·25개 자치구 필터·카카오맵 표시
- 비로그인 브라우저 `localStorage` 관심 상권 저장 및 카카오 로그인 시 계정 동기화
- 저장한 상권 중 2~4곳 선택, 최대 4곳 제한
- 2025년 4분기 카페 지표 14개 비교
- 원천 행 누락 시 `0`이 아닌 `비교 불가`와 사유 표시
- 지표별 제공기관·데이터셋·필터·계산식·분자/분모 확인
- 읽기 전용 현장 체크리스트 5개

공유 리포트, 전국 확대, 창업 성공 확률·계약 판정은 범위 밖입니다. 카카오 로그인 기반 계정 기록과 관심 상권·매물 워크시트 동기화는 구현했습니다. 전체 업종 확장은 `docs/plan.md`의 Phase 29~33에서 계획합니다.

## V2 파이프라인 로드맵

1. 첫 방문 6문항 창업 성향 진단 — 구현 완료
2. 결과를 바탕으로 근거가 보이는 후보 상권 2~3곳 제시 — 카페 구현 완료
3. 후보별 강점·주의점 리포트 — 구현 완료
4. 공식 임대 통계와 허가된 실매물 연결 — R-ONE 서울 평균·세부 조사상권 59곳 비교, 면적 환산·비용 계산·외부 매물 확인 구현 완료
5. K-Startup 등 공식 출처의 지원·자금 후보 2건 — 공식 API 수집·자격 판정·원문 링크 구현 완료
6. 개업 후 내 가게와 주변 동종 가게의 리뷰 주제 비교 — 사용자 제공 리뷰 분석 구현, 정식 제공자 제휴 대기

상세 요구사항과 외부 데이터 제약은 [docs/product_v2_pipeline.md](docs/product_v2_pipeline.md)에 정리되어 있습니다.

## 기술 구성

| 영역 | 기술 |
| --- | --- |
| 프런트엔드 | React 19, TypeScript, Vite, Vitest |
| 백엔드 | FastAPI, SQLAlchemy 2, Alembic, pytest |
| 데이터베이스 | 로컬 SQLite / Supabase PostgreSQL |
| 지도 | Kakao Maps JavaScript SDK |
| 데이터 | 서울시 상권분석서비스, 서울 열린데이터광장 Open API |

전체 구조·ERD·API 목록은 [docs/architecture.md](docs/architecture.md), 데이터 출처와 검증 결과는 [docs/data_sources.md](docs/data_sources.md)를 참고하세요.

## 빠른 시작

### 1. 저장소와 Python 환경

```powershell
git clone https://github.com/Dajeong0315/golmok-radar.git
cd golmok-radar
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt -r backend\requirements-dev.txt
Copy-Item backend\.env.example backend\.env
```

`backend/.env`에 서울 Open API 키를 넣습니다. 실제 키와 DB 비밀번호는 Git에 커밋하지 않습니다.

### 2. 원천 데이터 준비와 적재

상권 영역·점포·매출 ZIP 파일은 [database/README.md](database/README.md)의 파일명과 위치에 맞춰 `database/raw/` 아래에 둡니다. 인구 데이터는 API로 수집합니다.

```powershell
.\.venv\Scripts\python.exe database\scripts\fetch_population.py
.\.venv\Scripts\python.exe database\scripts\validate_phase1.py
Push-Location backend
..\.venv\Scripts\alembic.exe upgrade head
Pop-Location
.\.venv\Scripts\python.exe database\scripts\load_data.py
```

정상 적재 결과는 상권 1,650건, 점포 1,518건, 매출 1,069건, 인구 1,648건, 기본 출처 4건입니다.

### 3. 백엔드 실행

```powershell
Push-Location backend
..\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

- API 상태: <http://127.0.0.1:8000/health>
- Swagger: <http://127.0.0.1:8000/docs>

### 4. 프런트엔드 실행

새 터미널에서 실행합니다.

```powershell
cd frontend
Copy-Item .env.example .env
npm install
npm run dev -- --host 127.0.0.1
```

<http://127.0.0.1:5173>에서 확인합니다. 카카오 개발자 콘솔에서 카카오맵 API를 활성화하고, JavaScript 키의 SDK 도메인에 `http://localhost:5173`과 `http://127.0.0.1:5173`을 등록한 뒤 `frontend/.env`의 `VITE_KAKAO_MAP_KEY`에 키를 넣어야 실제 지도가 나타납니다. 키가 없거나 카카오맵 API가 비활성화되어 있으면 상권 목록과 비교 기능은 그대로 동작하고 지도 영역에는 설정 안내가 표시됩니다.

2026-10-30 로컬 환경에서 카카오맵 타일, 서울 전체 위치, 자치구 선택 후 공식 상권 라벨 렌더링과 관심 상권 저장·해제를 확인했습니다. 전체 화면에서는 1,650개 라벨을 한꺼번에 그리지 않고 자치구를 고른 뒤 해당 구 라벨을 표시합니다. JavaScript 키는 Git에 추적하지 않습니다.

## 테스트

전체 자동 검증은 루트에서 한 번에 실행할 수 있습니다.

```powershell
.\scripts\verify.ps1
```

개별 명령은 다음과 같습니다.

```powershell
Push-Location backend
..\.venv\Scripts\python.exe -m pytest -q
Pop-Location

Push-Location frontend
npm test -- --run
npm run build
Pop-Location
```

현재 기준 백엔드 55개, 프런트엔드 26개 테스트가 통과합니다. 지표의 손계산 기대값은 [docs/지표_손계산_기준표.xlsx](docs/지표_손계산_기준표.xlsx)에 고정되어 있습니다.

## Supabase 연결

Supabase 대시보드의 Session pooler 연결 문자열을 `backend/.env`에 넣습니다. 일반 `postgresql://` 또는 `postgres://` 주소는 애플리케이션이 설치된 psycopg 3 드라이버 형식으로 자동 변환합니다.

```dotenv
DATABASE_URL=postgresql://postgres.PROJECT_REF:PASSWORD@REGION.pooler.supabase.com:5432/postgres?sslmode=require
```

```powershell
Push-Location backend
..\.venv\Scripts\alembic.exe upgrade head
Pop-Location
.\.venv\Scripts\python.exe database\scripts\load_data.py
.\.venv\Scripts\python.exe database\scripts\fetch_rone.py
.\.venv\Scripts\python.exe database\scripts\load_rone.py
.\.venv\Scripts\python.exe database\scripts\fetch_kstartup.py
.\.venv\Scripts\python.exe database\scripts\load_kstartup.py
```

운영 데이터에 적용하기 전에 별도 테스트 프로젝트에서 마이그레이션과 행 수를 확인하세요. 연결 문자열은 로그, 이슈, 커밋에 남기지 않습니다.

2026-10-30 `golmok-radar` Supabase 프로젝트에 revision `20261030_0003`까지 적용했습니다. 상권 1,650건, 점포 1,518건, 매출 1,069건, 인구 1,648건과 K-Startup 모집 공고 215건을 적재했습니다. R-ONE은 2026-11-02 서울 전체·권역·세부 조사상권 64개 지역단계의 지표 3종, 총 192건으로 확장했습니다.

## 주요 문서

- [MVP](docs/mvp.md), [PRD](docs/prd.md), [SPEC](docs/spec.md), [구현 PLAN](docs/plan.md)
- [V2 오프라인 창업 파이프라인](docs/product_v2_pipeline.md)
- [구조·ERD·API](docs/architecture.md)
- [데이터 출처와 검증 기록](docs/data_sources.md)
- [프로젝트 결정사항](docs/프로젝트_결정사항_v2.md)

## 알려진 한계

- 데이터는 2025년 4분기, 카페 업종, 서울 25개 자치구로 고정되어 있습니다.
- 매출 원천 행이 없는 상권은 관련 지표를 비교할 수 없습니다.
- 관심 상권은 현재 브라우저에만 저장되므로 저장소 삭제나 기기 변경 시 사라집니다.
- 공공데이터는 추정 통계이며 매물 상태·임대료·시간대별 보행 동선 등은 현장에서 확인해야 합니다.
- R-ONE 값은 서울 전체 또는 사용자가 직접 고른 공식 조사상권의 소규모상가 표본통계입니다. 서울시 골목상권과 경계가 다르며 개별 매물의 고유 임대료·평균 보증금이 아닙니다.
- Supabase와 카카오맵의 로컬 실연결은 확인했습니다. 배포할 때는 운영 도메인을 카카오 JavaScript 키의 SDK 도메인에 별도로 등록해야 합니다.
