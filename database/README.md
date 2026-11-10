# database

실제 서비스 데이터는 Supabase에 저장합니다. 이 폴더에는 원천 파일과 적재·검증 스크립트만 둡니다.

| 폴더 | 내용 |
|---|---|
| `raw/store/` | 서울시 상권분석서비스(점포-상권) 원본 zip, 분기별 Open API CSV(`*_<분기>_OpenAPI.csv`) |
| `raw/sales/` | 서울시 상권분석서비스(추정매출-상권) 원본 zip, 분기별 Open API CSV(`*_<분기>_OpenAPI.csv`) |
| `raw/population/` | 서울시 상권분석서비스(길단위인구-상권) 원본 파일 |
| `raw/area/` | 서울시 상권분석서비스(영역-상권) 원본 zip |
| `raw/rone/` | 한국부동산원 R-ONE 소규모상가 임대료·공실률·임대가격지수 원문 JSON |
| `raw/kstartup/` | 창업진흥원 K-Startup 모집 중 지원사업 공고 원문 JSON |
| `scripts/` | 적재·검증 스크립트 (Phase 1에서 작성) |

규칙
- 원본 파일은 **받은 이름 그대로** 두고 내용을 수정하지 않습니다.
- 받은 날짜·출처·기준분기는 `docs/data_sources.md`에 기록합니다.
- `raw/` 안의 데이터 파일은 Git에 올리지 않습니다 (`.gitignore`).

## 품질 검사·갱신 파이프라인 (Phase 39)

새 원천을 받거나 적재 전에 한 번에 검사합니다. 기본 실행은 읽기·검사만 하며 운영 DB를 바꾸지 않습니다.

```powershell
.\.venv\Scripts\python.exe database\scripts\data_quality.py --quarter 20254
```

1. 원천 파일 매니페스트: 파일 경로·크기·SHA-256·수정 시각
2. 컬럼 검사: 형식(점포 ZIP 영문 소문자, 매출 ZIP 한글, Open API 영문 대문자)을 자동 판별하고 빠진 필수 컬럼을 보고
3. 품질 검사: 논리 키 중복, 필수값 결측, 음수·숫자 아님, 공식 상권 밖 코드, 업종명 불일치, 주중+주말 ≠ 당월 매출, 시간대 매출 합 ≠ 당월 매출, 매출 업종이 점포 원천에 없음, 이전 분기 대비 행 수 ±10% 초과(경고), 개·폐업률 정의 불일치(경고), 유동인구 시간대 합 차이 6명 초과(경고)
4. 차단 오류가 없으면 임시 SQLite에 적재하고, 업종 3개의 표본 12건을 원천 행으로 손계산한 값과 백엔드 계산 결과를 대조
5. 리포트를 `database/processed/data_quality/<기준분기>-<시각>.md`와 `.json`으로 저장 (Git 제외)

오류가 하나라도 있으면 종료 코드 1을 돌려줍니다. 운영 반영은 검사를 모두 통과했을 때만 실행합니다.

```powershell
.\.venv\Scripts\python.exe database\scripts\data_quality.py --quarter 20254 --apply
```

`--apply`는 기존 `load_data.py`의 적재를 그대로 호출하고, 대상 DB는 `backend/.env`의 `DATABASE_URL`을 씁니다. 테스트 DB에 먼저 반영할 때만 `--database-url sqlite:///경로.db`처럼 지정하고, 운영 연결 문자열은 명령줄·문서에 남기지 않습니다.
