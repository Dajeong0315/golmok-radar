# 골목 레이더 구조와 API

## 시스템 흐름

```mermaid
flowchart LR
    U[브라우저 사용자] -->|상권 탐색·관심 목록| R[React + TypeScript]
    R -->|상권·비교·근거 조회| F[FastAPI]
    R -->|지도 표시| K[Kakao Maps SDK]
    F --> S[SQLAlchemy]
    S --> D[(SQLite 또는 Supabase PostgreSQL)]
    O[서울시 원천 ZIP·Open API] --> V[수집·검증·정규화 스크립트]
    O2[R-ONE Open API] --> V
    V --> D
```

관심 상권 코드는 브라우저 `localStorage`의 `golmok-radar:favorites:v1`에만 저장됩니다. FastAPI는 읽기 API를 제공하며 추천 점수나 사용자 프로필은 만들지 않습니다.

## 데이터 모델

```mermaid
erDiagram
    TRADE_AREAS ||--o| STORE_METRICS : has
    TRADE_AREAS ||--o| SALES_METRICS : has
    TRADE_AREAS ||--o| POPULATION_METRICS : has
    RENT_BENCHMARKS {
        string period_code PK
        string region_code PK
        string building_type PK
        string metric_key PK
        float value
        string unit
        string mapping_scope
    }
    DATA_SOURCES {
        string key PK
        string dataset_name
        string provider
        datetime fetched_at
    }
    TRADE_AREAS {
        string code PK
        string name
        string district_name
        float longitude
        float latitude
    }
    STORE_METRICS {
        string quarter_code PK
        string trade_area_code PK
        string industry_code PK
        int store_count
        float opening_rate
        float closing_rate
    }
    SALES_METRICS {
        string quarter_code PK
        string trade_area_code PK
        string industry_code PK
        int sales_amount
        int sales_count
    }
    POPULATION_METRICS {
        string quarter_code PK
        string trade_area_code PK
        int total_population
        int population_00_06
        int population_06_11
        int population_11_14
        int population_14_17
        int population_17_21
        int population_21_24
    }
```

점포·매출은 `기준분기 + 상권코드 + 업종코드`, 인구는 `기준분기 + 상권코드`가 논리 키입니다. 원천 행이 없으면 계산 계층은 0으로 대체하지 않고 `unavailable`과 사유를 반환합니다.

## HTTP API

| Method | 경로 | 용도 |
| --- | --- | --- |
| GET | `/health` | 앱·DB 상태 확인 |
| GET | `/api/v1/trade-areas` | 서울 25개 자치구 상권 목록과 데이터 보유 상태 |
| GET | `/api/v1/trade-areas/{code}` | 상권 상세와 지표 |
| POST | `/api/v1/recommendations` | 창업 성향 답변 기반 설명 가능한 카페 후보 2~3곳 |
| GET | `/api/v1/trade-areas/{code}/report` | 완전 데이터 상권 1,068곳 비교군 기준 강점·주의·수요 특성 리포트 |
| GET | `/api/v1/trade-areas/{code}/rent-benchmark` | R-ONE 서울 전체 소규모상가 참고지표와 공간 범위·공식 출처 확인 |
| GET | `/api/v1/rent-markets` | R-ONE 서울 세부 조사상권 59곳의 코드·이름·권역·기준기간 조회 |
| GET | `/api/v1/trade-areas/{code}/rent-benchmark?market_code={R-ONE코드}` | 선택한 R-ONE 조사상권과 서울 전체의 임대료·공실률·임대가격지수 비교 |
| POST | `/api/v1/support-programs` | 최소 조건 기반 공식 창업지원 연동 상태와 후보 확인 |
| POST | `/api/v1/review-analysis` | 사용자 제공 리뷰의 주제별 내 가게·주변 비교군 분석 |
| GET | `/api/v1/comparisons?codes=A,B&quarter=20254` | 서로 다른 상권 2~4곳, 지표 14개 비교 |
| GET | `/api/v1/comparisons/{comparison_id}/evidence/{metric_key}` | 지표 출처·필터·수식·원천값 확인 |
| GET | `/api/v1/field-checklist` | 현장 확인 질문 5개 |

비교 API는 코드 1개·5개 이상·중복·없는 코드·미지원 분기를 거부합니다. 프런트엔드는 금액, 비율, 점포 수 단위를 구분하며 결측 사유를 각 셀에 표시합니다.

## 검증 기준

| 계층 | 검증 |
| --- | --- |
| 수집 | API 보고 행 수와 저장 행 수, 필수 컬럼, 기준분기 확인 |
| 적재 | 새 DB 적재, 논리 키 중복, 상권 코드 결합, 예상 행 수 확인 |
| 계산 | 정상·경계·결측 사례를 엑셀 손계산표와 pytest로 대조 |
| API | 2·3·4곳 성공 및 잘못된 코드 수·중복·분기 실패 테스트 |
| UI | 서울 공식 상권 1,650곳 로딩, 관심 목록 유지, 최대 4곳 제한, 14지표·결측·근거 패널 확인 |

2026-10-30 통합 검증 기준으로 백엔드 53개, 프런트엔드 16개 테스트와 Vite production build가 통과했습니다. 서울 전역 원천 검증에서 상권 1,650곳, 점포 1,518곳, 매출 1,069곳, 인구 1,648곳, 완전 데이터 비교군 1,068곳과 논리 키 중복 0건을 확인했습니다. Supabase에 revision `20261030_0003`까지 적용하고 R-ONE 참고지표 3건과 K-Startup 모집 진행 공고 215건을 유지합니다. 전체 목록은 일괄 조회로 약 0.56초, 후보 계산은 약 1.13초에 응답하는지 로컬에서 확인했습니다. 전체 서울 지도는 초기 부하를 줄이기 위해 자치구 선택 전에는 서울 전체 위치만 보여 주고, 자치구를 선택하면 해당 구의 공식 상권 라벨을 표시합니다.

R-ONE 값은 `trade_areas`에 외래키로 결합하지 않습니다. 공식 경계 대응표가 없으므로 `mapping_scope=administrative_context`, `confidence=contextual`인 서울 전체 공유 벤치마크로만 반환하며, 조사상권 이름 유사도나 중심점으로 개별 상권 값을 추정하지 않습니다.

Phase 13 지원사업 계층은 `K_STARTUP_API_KEY`를 수집 설정 계약으로 사용합니다. 공공데이터포털의 모집 진행 공고를 페이지별 원문 JSON으로 보존한 뒤 `support_programs`에 적재하며, API 요청 시 모집 기간·지역·창업 단계·연령·업력을 순수 함수로 판정해 명백히 불일치한 공고를 제외하고 최대 2건을 반환합니다. 자유 서술형 대상 조건은 자동 적합으로 보지 않고 원문 확인 항목으로 분리합니다. 키가 없거나 검증된 적재 행이 없으면 후보 배열을 비워 오래되거나 가상의 지원상품이 현재 추천처럼 보이지 않게 합니다. 신용·부채 정보와 대출 승인 예측은 수집하지 않습니다.

Phase 14 리뷰 분석은 가게 소유·관리 또는 위임 권한과 데이터 이용 권한을 클라이언트와 서버에서 모두 확인한 뒤 사용자 제공 텍스트를 요청 중에만 처리하며 저장하지 않습니다. 한 줄 입력 또는 `group,review` CSV를 동일한 배열 계약으로 변환하고, 전화번호·이메일·링크·계정명을 분석 전에 제거합니다. 메뉴·가격·응대·대기·청결·공간의 6개 공개 키워드 규칙으로 언급과 긍부정을 집계하고, 각 그룹 5개 미만이면 실행 아이디어를 만들지 않습니다. 관찰 문장과 제안 문장을 별도 필드로 반환하며 인사이트의 주제 키에서 비식별 리뷰 번호·일부 문구 근거로 추적할 수 있습니다.
