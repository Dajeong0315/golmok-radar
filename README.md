# 골목 레이더

서울 성동구·광진구에서 카페 창업 후보 상권을 탐색하고, 관심 상권 가운데 2~4곳을 같은 기준으로 비교하는 반응형 웹 애플리케이션입니다. 추천 점수 대신 점포·매출·유동인구와 그 근거를 보여주며, 통계로 알 수 없는 조건은 현장 질문으로 분리합니다.

## 현재 구현 범위

- 공식 상권 117곳 검색·자치구 필터·카카오맵 표시
- 브라우저 `localStorage`에 관심 상권 저장
- 저장한 상권 중 2~4곳 선택, 최대 4곳 제한
- 2025년 4분기 카페 지표 14개 비교
- 원천 행 누락 시 `0`이 아닌 `비교 불가`와 사유 표시
- 지표별 제공기관·데이터셋·필터·계산식·분자/분모 확인
- 읽기 전용 현장 체크리스트 5개

계정 동기화, 개인 메모, 공유 리포트, 전국 확대, 추천 점수는 MVP 범위 밖입니다.

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

정상 적재 결과는 상권 117건, 점포 110건, 매출 82건, 인구 117건, 출처 4건입니다.

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

<http://127.0.0.1:5173>에서 확인합니다. 카카오 개발자 콘솔에 `http://localhost:5173`과 `http://127.0.0.1:5173`을 Web 플랫폼 도메인으로 등록하고 `frontend/.env`의 `VITE_KAKAO_MAP_KEY`에 JavaScript 키를 넣어야 실제 지도가 나타납니다. 키가 없으면 상권 목록과 비교 기능은 그대로 동작하고 지도 영역에는 설정 안내가 표시됩니다.

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

현재 기준 백엔드 24개, 프런트엔드 6개 테스트가 통과합니다. 지표의 손계산 기대값은 [docs/지표_손계산_기준표.xlsx](docs/지표_손계산_기준표.xlsx)에 고정되어 있습니다.

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
```

운영 데이터에 적용하기 전에 별도 테스트 프로젝트에서 마이그레이션과 행 수를 확인하세요. 연결 문자열은 로그, 이슈, 커밋에 남기지 않습니다.

## 주요 문서

- [MVP](docs/mvp.md), [PRD](docs/prd.md), [SPEC](docs/spec.md), [구현 PLAN](docs/plan.md)
- [구조·ERD·API](docs/architecture.md)
- [데이터 출처와 검증 기록](docs/data_sources.md)
- [프로젝트 결정사항](docs/프로젝트_결정사항_v2.md)

## 알려진 한계

- 데이터는 2025년 4분기, 카페 업종, 성동구·광진구로 고정되어 있습니다.
- 매출 원천 행이 없는 상권은 관련 지표를 비교할 수 없습니다.
- 관심 상권은 현재 브라우저에만 저장되므로 저장소 삭제나 기기 변경 시 사라집니다.
- 공공데이터는 추정 통계이며 매물 상태·임대료·시간대별 보행 동선 등은 현장에서 확인해야 합니다.
- 실제 카카오 지도와 Supabase 연결은 각 서비스의 사용자 소유 키·프로젝트 설정이 필요합니다.
