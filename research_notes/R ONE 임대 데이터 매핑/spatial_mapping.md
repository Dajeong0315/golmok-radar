# R-ONE과 서울 공식 상권의 공간 매핑

## R-ONE은 어떤 공간 식별자와 경계를 제공하는가

### Takeaway
R-ONE 상업용부동산 임대동향조사의 `상권`은 서울시 상권분석서비스 상권과 같은 공통 행정·공간 코드가 아니라, 한국부동산원이 표본조사를 위해 자체 구획한 층화 단위다. 공식 공개 API는 통계표·분류 ID와 명칭을 제공하지만, 확인한 공개 계약에는 상권 경계 폴리곤이나 좌표 필드가 없다.

### Cited Findings
- 한국부동산원은 시·도 안에서 상가 집중도, 공간 분포, 전문 조사자 의견, 언론 이슈, 상권 활성화 정도를 종합해 조사 상권을 구획하고, 그 상권별로 표본을 층화한다고 설명한다. 즉 조사 상권은 다른 기관의 상권 코드를 재사용한 단위가 아니다. — [한국부동산원 상업용부동산 임대동향조사](https://www.reb.or.kr/reb/cm/cntnts/cntntsView.do?cntntsId=1049&mi=10335&statId=S237220284)
- 현재 공표 단위는 오피스 52개, 중대형 상가 248개, 소규모 상가 232개, 집합 상가 222개 상권이며, 전국·시도·상권별 임대료·공실률·임대가격지수 등을 분기별로 공표한다. — [한국부동산원 조사 개요 및 자료제공](https://www.reb.or.kr/reb/cm/cntnts/cntntsView.do?cntntsId=1049&mi=10335&statId=S237220284)
- R-ONE 통계지도는 `지역별`과 `상권별` 조회를 구분하고 주소 검색 및 경계 표시 UI를 제공하지만, 페이지에서 재사용 가능한 경계 파일이나 경계 코드 계약은 제시하지 않는다. — [R-ONE 상업용부동산 임대동향 통계지도](https://www.reb.or.kr/r-one/portal/gis/rcsGisViewerPage.do)
- R-ONE Open API는 `STATBL_ID`, `CLS_ID`, `ITM_ID` 같은 통계표·분류·항목 식별자로 값을 조회한다. 인증키가 없으면 sample 모드로 첫 5건만 내려오고, 외부 브라우저 직접 호출은 CORS 미지원으로 불가능해 서버 연계가 필요하다. — [R-ONE Open API 개발가이드](https://www.reb.or.kr/r-one/portal/openapi/openApiDevPage.do)
- 소규모상가 임대가격지수 통계표의 공개 sample 분류 응답은 `ITM_ID`, `PAR_ITM_ID`, `ITM_NM`, `ITM_FULLNM` 등을 제공하고 `전국`, `서울` 같은 분류명을 보여 주지만, 좌표·폴리곤·서울시 `TRDAR_CD` 필드는 포함하지 않는다. — [R-ONE 공식 sample 분류 API](https://www.reb.or.kr/r-one/openapi/SttsApiTblItm.do?STATBL_ID=T241273134677393&Type=json)
- 공개 API의 전체 분류 목록은 인증키 없이 조회할 수 없으며, sample 응답은 전체 277개 중 첫 5개만 노출한다. — [R-ONE 공식 sample 분류 API](https://www.reb.or.kr/r-one/openapi/SttsApiTblItm.do?STATBL_ID=T241273134677393&Type=json); [R-ONE Open API 개발가이드](https://www.reb.or.kr/r-one/portal/openapi/openApiDevPage.do)

### Inferences
- R-ONE 통계 분류 ID를 지리 경계 ID로 간주하면 안 된다. 공식 API 계약에서 좌표·경계·공통 행정코드가 확인되지 않았기 때문에, ID만으로 서울시 상권 폴리곤과 공간 연산을 수행할 수 없다.
- R-ONE 통계지도에 경계가 보인다는 사실만으로 그 내부 지도 경계를 다운로드·재사용할 권한이나 안정된 API 계약이 있다고 추정해서는 안 된다.

### Gaps
- 인증키가 없어 2026년 전체 R-ONE 분류 목록과 성동구·광진구 관련 조사 상권 ID를 아직 내려받지 못했다.
- 한국부동산원이 R-ONE 조사 상권 경계 SHP/GeoJSON 또는 공식 crosswalk를 별도 제공하는지 공개 문서에서 확인하지 못했다. 공식 문의 또는 키 발급 후 관련파일·메타데이터 재확인이 필요하다.

## 골목 레이더에는 어떤 공간 식별자와 지오메트리가 있는가

### Takeaway
골목 레이더의 원천은 서울시 공식 `TRDAR_CD`와 EPSG:5181 SHP 상권 영역이지만, 현재 애플리케이션 DB에는 폴리곤이 아니라 중심좌표만 저장한다. 따라서 서울시 쪽은 원천 폴리곤을 복원할 수 있어도, R-ONE 경계가 없으면 양쪽 폴리곤 교차율 계산은 불가능하다.

### Cited Findings
- 서울시 `영역-상권` 데이터는 상권 구분, `TRDAR_CD`, 상권명, 중심 X/Y, 자치구, 행정동, 영역 면적을 제공하고 좌표계는 EPSG:5181이다. 다운로드 파일은 상권 영역 ZIP이며 공공누리 1유형으로 출처표시 후 상업적 이용과 변경이 가능하다. — [서울시 상권분석서비스 영역-상권](https://data.seoul.go.kr/dataList/OA-15560/A/1/datasetView.do)
- 프로젝트가 보관한 원천 영역 파일은 SHP+DBF이고 1,650개 `TRDAR_CD`를 포함하며, 성동구·광진구 117개 상권을 추출한다. — [프로젝트 데이터 출처 기록](../../docs/data_sources.md)
- 현재 적재 코드는 SHP/DBF에서 `TRDAR_CD`, 자치구, 상권 유형, EPSG:5181 중심좌표를 읽어 WGS84 경·위도로 변환하지만 폴리곤 자체는 DB에 넣지 않는다. — [프로젝트 적재 코드](../../database/scripts/load_data.py)
- 현재 `trade_areas` 모델에는 코드·이름·자치구·상권유형·EPSG:5181 중심좌표·WGS84 경위도만 있고 geometry 컬럼이 없다. — [프로젝트 DB 모델](../../backend/app/models.py)
- 동일한 생활권 이름도 서울시 코드에서는 여러 공식 상권으로 분리된다. 현재 원천에는 `건대입구역(건대)`(`3120053`), `건대입구역 6번`(`3110140`), `건대입구역 1번`(`3110141`)처럼 서로 다른 세 상권 코드가 존재한다. — [프로젝트 원천 적재 로직과 영역 데이터](../../database/scripts/load_data.py); [프로젝트 데이터 출처 기록](../../docs/data_sources.md)
- 한국부동산원 조사에서는 적어도 과거 공표에서 `건대입구`를 하나의 조사 상권명으로 사용했다. — [정부 마이홈포털 2016년 1분기 상업용부동산 임대동향 발표](https://www.myhome.go.kr/hws/portal/bbs/selectBoardPressDetailView.do?bbsId=BBST03&nttId=473)

### Inferences
- 이름 기반 조인은 `건대입구` 한 건을 서울시 3개 공식 상권에 임의 복제할 위험이 있다. 이 값은 해당 `TRDAR_CD`의 정확한 임대료가 아니라 R-ONE 조사 상권의 표본 평균이므로, 동일값을 세 상권의 고유값처럼 저장하면 출처와 공간 범위를 왜곡한다.
- 서울시 SHP를 DB에 적재하더라도 R-ONE 공식 경계가 없으면 centroid-in-polygon 또는 면적 중첩률 방식은 성립하지 않는다.

### Gaps
- 현재 앱 DB에는 서울시 폴리곤이 없어 실제 교차 분석을 하려면 원천 SHP geometry를 별도 테이블 또는 오프라인 검증 파이프라인에서 다뤄야 한다.
- R-ONE의 현재 `건대입구` 조사 상권 존재 여부와 2024년 3분기 표본 재설계 이후 경계 변화는 키 발급 후 2026년 분류 목록·관련파일로 다시 확인해야 한다.

## 코드·폴리곤·중심점·행정구역 중 어떤 조인이 가능한가

### Takeaway
현재 확인된 공식 계약으로는 정확 코드 조인과 폴리곤 조인은 모두 불가하다. 가능한 것은 서울 또는 확인된 R-ONE 조사 상권을 `주변 임대시장 참고치`로 연결하는 명시적 다대다 crosswalk뿐이며, 경계 일치로 표현해서는 안 된다.

### Cited Findings
- R-ONE 상권은 조사 목적의 자체 층화 구획이고, 서울시는 별도의 `TRDAR_CD` 상권 영역을 사용한다. — [한국부동산원 조사 설계](https://www.reb.or.kr/reb/cm/cntnts/cntntsView.do?cntntsId=1049&mi=10335&statId=S237220284); [서울시 영역-상권](https://data.seoul.go.kr/dataList/OA-15560/A/1/datasetView.do)
- R-ONE 통계는 표본조사 결과이며, 공실률은 해당 조사 상권 표본의 공실면적 합을 표본 임대가능면적 합으로 나누고 임대료는 표본의 환산임대료를 임대가능면적으로 나누어 산출한다. — [한국부동산원 산출방법](https://www.reb.or.kr/reb/cm/cntnts/cntntsView.do?cntntsId=1049&mi=10335&statId=S237220284)
- R-ONE 상가 임대료는 1층 기준, 부가가치세·관리비 제외, 보증금을 전환율로 환산한 월 임대료를 포함한 단위면적당 통계다. — [한국부동산원 임대료 정의](https://www.reb.or.kr/reb/cm/cntnts/cntntsView.do?cntntsId=1049&mi=10335&statId=S237220284)
- R-ONE은 통계 신뢰성 검토를 위해 RSE와 표준오차를 제공하며, 95% 신뢰구간 계산법도 안내한다. — [한국부동산원 이용시 유의점](https://www.reb.or.kr/reb/cm/cntnts/cntntsView.do?cntntsId=1049&mi=10335&statId=S237220284)

### Inferences
- `code_exact`: 불가. 두 기관이 공유하는 공식 상권 코드가 확인되지 않았다.
- `polygon_overlap`: 보류. 서울시 폴리곤은 있으나 재사용 가능한 R-ONE 폴리곤이 확인되지 않았다.
- `centroid_match`: 금지. R-ONE 중심좌표가 없고, 중심점 근접성만으로 표본조사 경계를 동일하다고 볼 수 없다.
- `administrative_context`: 제한적으로 가능. 동일 시도(`서울`) 값은 모든 성동구·광진구 상권에 `서울 전체 참고치`로 표시할 수 있지만 개별 상권 값으로 저장하면 안 된다.
- `curated_rone_context`: 조건부 가능. R-ONE 전체 분류 목록과 현재 분기를 확인한 뒤, 명칭·공식 설명·수동 검토 근거가 있는 조사 상권을 하나 이상의 `TRDAR_CD`에 다대다로 연결하고 `경계 불일치 가능`을 항상 노출해야 한다.

### Gaps
- 자치구 단위 값이 각 상가 유형·지표에 항상 존재하는지 전체 분류 목록으로 확인하지 못했다. 없으면 서울 시도값까지만 사용할 수 있다.
- R-ONE 조사 상권의 공식 주소 목록 또는 경계가 제공되지 않으면 `curated_rone_context`도 이름과 현장 지식에 의존하므로 낮은 신뢰도로 제한해야 한다.

## 어떤 출처·신뢰도·화면 계약이 필요한가

### Takeaway
R-ONE 값은 `골목 레이더 상권의 임대료`가 아니라 `별도 조사 상권의 표본 벤치마크`로 모델링해야 한다. 데이터 모델과 UI가 원천 공간 단위, 건물유형, 기준분기, 단위, 표본통계, 매핑방법과 불확실성을 함께 전달해야 한다.

### Cited Findings
- R-ONE은 오피스·중대형상가·소규모상가·집합상가를 건축물 유형과 규모로 구분하며, 카페 같은 서비스 업종별 통계가 아니다. — [한국부동산원 조사대상 정의](https://www.reb.or.kr/reb/cm/cntnts/cntntsView.do?cntntsId=1049&mi=10335&statId=S237220284)
- 공표값은 개별 매물 가격이 아니라 상권 내 표본을 가중 집계한 통계다. — [한국부동산원 임대료·공실률 산출방법](https://www.reb.or.kr/reb/cm/cntnts/cntntsView.do?cntntsId=1049&mi=10335&statId=S237220284)
- 임대가격지수는 임대료 수준이 아니라 기준시점 대비 변화 지수이며, 현재 공식 설명의 기준시점은 2024년 2분기다. — [한국부동산원 임대가격지수 정의](https://www.reb.or.kr/reb/cm/cntnts/cntntsView.do?cntntsId=1049&mi=10335&statId=S237220284)

### Inferences
- 권장 crosswalk 필드: `rone_table_id`, `rone_area_id`, `rone_area_name`, `trade_area_code`, `mapping_method`, `mapping_scope`, `confidence`, `verified_at`, `source_url`, `review_note`.
- `mapping_method` 허용값은 `administrative_context`, `curated_rone_context`로 시작하고, 향후 공식 경계가 확보된 경우에만 `official_crosswalk` 또는 `polygon_overlap`을 추가한다.
- `confidence`는 정확도를 가장하지 않도록 `coarse`와 `contextual`만 사용한다. 공식 공통코드·공식 crosswalk·공식 양쪽 경계가 없는 현재 상태에서 `exact`를 부여하면 안 된다.
- 화면 문구 예시: `한국부동산원 건대입구 조사상권 기준 참고치 · 골목 레이더 상권과 경계가 다를 수 있음 · 중대형상가 표본 · 1층 환산임대료 · 관리비·부가세 제외`.
- 같은 R-ONE 조사 상권이 여러 `TRDAR_CD`에 연결되면 값을 복제한 세 개의 독립 지표로 보여주지 말고, 하나의 `공유 벤치마크` 카드와 연결된 골목 레이더 상권 목록을 표시해야 한다.
- 값 옆에 `source_period`, `building_type`, `unit`, `sample_statistic`, `mapping_method`, `confidence`, `RSE/표준오차(제공 시)`와 원문 링크를 함께 노출해야 한다.

### Gaps
- R-ONE API의 현재 지표별 RSE/표준오차 표 코드와 분류 ID는 인증키 발급 후 확정해야 한다.
- 데이터 재배포 문구와 캐시 허용 기간은 R-ONE 이용약관·공공데이터 이용정책을 별도로 확인해야 한다.

## Phase 12의 표본 매핑과 go no-go 검증은 무엇인가

### Takeaway
현재 판정은 `상권별 정확 조인 NO-GO`, `출처가 분리된 참고 벤치마크 CONDITIONAL GO`다. R-ONE 키로 전체 분류·값을 받고 공식 경계 또는 crosswalk 제공 여부를 확인하기 전에는 임대료를 117개 `TRDAR_CD`의 고유 속성으로 적재해서는 안 된다.

### Cited Findings
- R-ONE 전체 Open API 사용에는 로그인 후 인증키 발급이 필요하고, 무키 sample은 첫 5건만 제공한다. — [R-ONE Open API 개발가이드](https://www.reb.or.kr/r-one/portal/openapi/openApiDevPage.do)
- 기존 공공데이터포털의 9개 부동산 통계 API는 2024년 말 폐기되었고, 현재는 구조가 다른 R-ONE Open API를 사용해야 한다. — [한국부동산원 폐기 및 대체 서비스 안내](https://www.reb.or.kr/reb/na/ntt/selectNttInfo.do?mi=10251&nttSn=98700)
- 프로젝트의 제품 규칙은 같은 공간 코드와 기준기간이 확인된 데이터만 결합하고 검증 전 값은 `0`이 아니라 `비교 불가`와 사유로 반환하도록 요구한다. — [프로젝트 SPEC](../../docs/spec.md); [프로젝트 데이터 규칙](../../AGENTS.md)

### Inferences
- 시작 전 사용자 준비: R-ONE 회원가입·Open API 인증키 발급. 키는 백엔드 `.env`에만 두고 프런트로 전달하지 않는다.
- 1차 수집 검증: 관련 통계표의 전체 분류 목록, 건물유형별 임대료·공실률·임대가격지수, 최신 분기, 단위, 결측기호, RSE/표준오차 코드를 원문 그대로 저장한다.
- 공간 go/no-go: 한국부동산원이 공식 경계 또는 crosswalk를 제공하면 서울시 SHP와 좌표계를 맞춰 교차율을 계산한다. 제공하지 않으면 정확 공간 조인은 NO-GO로 고정한다.
- 최소 표본 검증: `건대입구역(건대)`, `건대입구역 1번`, `건대입구역 6번`을 한 테스트 묶음으로 두고, 한 R-ONE 명칭이 세 코드의 독립값으로 자동 복제되지 않는지 확인한다. `성수역`·`성수동카페거리`, `왕십리역(왕십리)`·주변 골목상권도 같은 방식으로 다대다·모호성 사례를 점검한다.
- 성공 기준: 각 노출값이 R-ONE 원문 행으로 역추적되고, 기준분기·건물유형·단위·매핑방법·신뢰도·경계 불일치 경고가 보이며, 모호한 상권은 `비교 불가` 또는 `서울 참고치만 제공`으로 처리된다.
- 실패 기준: 이름 유사도만으로 자동 조인, 중심점 최근접 조인, 한 R-ONE 값을 여러 서울 상권의 고유 임대료처럼 복제, 임대가격지수를 임대료 금액으로 표시, 결측을 0으로 대체하는 경우다.
- API 테스트: 무키/잘못된 키, 최신 분기 없음, 중복 분류, 단위 변경, R-ONE 상권 1:N 매핑, 서울 상권 미매핑, RSE 누락을 포함해야 한다.

### Gaps
- 사용자가 R-ONE 인증키를 발급하기 전에는 전체 분류 및 운영 응답을 기준으로 한 실제 coverage 비율을 계산할 수 없다.
- 공식 경계·crosswalk 부재가 확정되면 Phase 12 완료 조건을 `개별 상권 임대료`가 아니라 `별도 공간 단위의 임대시장 참고 벤치마크`로 문서에서 명확히 확정해야 한다.
