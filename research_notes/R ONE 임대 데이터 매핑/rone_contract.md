# R-ONE 공식 임대통계 제공 계약

## 어떤 공식 데이터가 제공되는가

### Takeaway
한국부동산원은 상업용부동산 임대동향조사를 분기 단위로 공표하며, 임대료·공실률·임대가격지수·투자수익률 등을 전국·시도·자체 조사상권 단위로 제공합니다. 이 값은 개별 매물이나 개별 건물 실측값이 아니라 표본조사 기반 상권 벤치마크입니다.

### Cited Findings
- 조사 대상은 오피스와 상가이고, 2026년 기준 일반건물 12,111동과 집합건물 29,500호를 표본으로 조사합니다. 공표 단위는 오피스 전국·16개 시도·52개 상권, 중대형 상가 전국·17개 시도·283개 상권, 소규모 상가 전국·17개 시도·254개 상권, 집합 상가 전국·17개 시도·229개 상권입니다. — [한국부동산원 조사개요](https://www.reb.or.kr/reb/cm/cntnts/cntntsView.do?cntntsId=1049&mi=10335&statId=S237220284)
- 조사 주기는 분기이고 기준시점은 매분기 마지막 달 말일입니다. 공식 자료는 R-ONE 통계조회, 공표보고서의 Excel·PDF, KOSIS 등으로 공개됩니다. — [한국부동산원 조사개요](https://www.reb.or.kr/reb/cm/cntnts/cntntsView.do?cntntsId=1049&mi=10335&statId=S237220284); [한국부동산원 자료제공](https://www.reb.or.kr/reb/cm/cntnts/cntntsView.do?cntntsId=1185&mi=9803)
- 공표 범위는 전국·시도별·상권별 투자수익률, 공실률, 임대료, 임대가격지수입니다. — [한국부동산원 자료제공](https://www.reb.or.kr/reb/cm/cntnts/cntntsView.do?cntntsId=1185&mi=9803)
- 상가 임대료는 1층 기준이며, `환산임대료 / 임대가능면적`으로 산출합니다. 환산임대료는 `(보증금 × 전환율 / 12) + 월 임대료`이고 관리비와 부가가치세는 제외됩니다. — [한국부동산원 조사개요](https://www.reb.or.kr/reb/cm/cntnts/cntntsView.do?cntntsId=1049&mi=10335&statId=S237220284)
- R-ONE 통계지도는 임대료 단위를 `천원/㎡`, 공실률과 수익률을 `%`로 안내하며 오피스·중대형·소규모·집합 유형을 분리합니다. — [R-ONE 통계지도 매뉴얼](https://www.reb.or.kr/r-one/images/rone/portal/gis/menual.pdf)
- 공실률은 임대료 파악이 주목적인 조사 표본을 활용한 부가 항목이어서 시장 체감보다 낮을 수 있습니다. 2026년 1분기부터 일반상가 통합 공실률과 1층 공실률이 추가 공표됩니다. — [R-ONE 통계조회 안내](https://www.reb.or.kr/r-one/portal/stat/multiStatPage.do)
- 2026년 3분기 결과는 2026-10-29 공표됐습니다. — [한국부동산원 2026년 3분기 보도자료](https://www.reb.or.kr/reb/na/ntt/selectNttInfo.do?mi=9565&nttSn=118007)

### Inferences
- 카페 후보지 비용 벤치마크에는 건물 유형상 소규모상가 또는 중대형상가 통계가 가장 가까우나, 어떤 유형을 적용할지는 실제 후보 건물 규모를 확인한 뒤 선택해야 합니다.
- 서비스 화면에는 `개별 매물 아님`, `1층 환산임대료`, `관리비·부가세 제외`, `표본조사`, `기준분기`를 함께 표시해야 오해를 줄일 수 있습니다.

### Gaps
- 공식 웹 문서만으로는 성동구·광진구의 모든 R-ONE 조사상권 명칭과 각 상권의 최신 수치를 정적 목록으로 확인할 수 없었습니다. 통계코드 검색 또는 인증키가 있는 API 응답으로 별도 추출해야 합니다.

## API와 다운로드 접근 방식은 무엇인가

### Takeaway
현재 정식 자동 연동 경로는 R-ONE REST Open API이며, R-ONE 로그인 후 인증키를 발급받아 백엔드에서 호출해야 합니다. 인증키 없이도 샘플 응답은 가능하지만 전체 데이터 수집에는 사용할 수 없습니다.

### Cited Findings
- 기존 공공데이터포털의 부동산 통계 9종 API는 R-ONE 개편으로 폐기됐고 2024-12-31 종료 예정이었으며, 현재 대체 경로는 R-ONE Open API입니다. — [한국부동산원 대체 서비스 안내](https://www.reb.or.kr/reb/na/ntt/selectNttInfo.do?mi=10251&nttSn=98700)
- R-ONE은 `https://www.reb.or.kr/r-one/openapi/` 아래 REST API를 제공하고, 인증키 발급에는 로그인이 필요합니다. — [R-ONE 개발가이드](https://www.reb.or.kr/r-one/portal/openapi/openApiDevPage.do)
- 통계값 조회 엔드포인트 예시는 `SttsApiTblData.do`이며 주요 요청값은 `STATBL_ID`, `DTACYCLE_CD`, `CLS_ID`, `ITM_ID`, `START_WRTTIME`, `END_WRTTIME`, `Type`, `KEY`, `pIndex`, `pSize`입니다. — [R-ONE 개발가이드](https://www.reb.or.kr/r-one/portal/openapi/openApiDevPage.do)
- 현재 개발가이드는 인증키 없는 sample 모드의 반환 건수를 본문에서는 10건, 최신 예제 설명에서는 5건이라고 서로 다르게 적고 있습니다. 따라서 sample 모드는 연결 확인에만 사용해야 합니다. — [R-ONE 개발가이드](https://www.reb.or.kr/r-one/portal/openapi/openApiDevPage.do)
- 응답에서 자주 쓰는 필드는 지역명 `CLS_NM`, 상위지역 포함 지역명 `CLS_FULLNM`, 항목명 `ITM_NM`, 값 `DTA_VAL`, 단위 `UI_NM`, 시점 `WRTTIME_DESC`입니다. — [R-ONE 개발가이드](https://www.reb.or.kr/r-one/portal/openapi/openApiDevPage.do)
- R-ONE API는 CORS와 JSONP를 지원하지 않아 외부 웹서비스에서는 브라우저가 아니라 서버에서 호출해야 합니다. — [R-ONE 개발가이드](https://www.reb.or.kr/r-one/portal/openapi/openApiDevPage.do)
- 공공데이터포털의 통합 부동산통계 조회 서비스는 JSON·XML, 무료, 이용허락범위 제한 없음으로 안내하고 개발 단계 자동승인·운영 단계 심의승인으로 표시합니다. — [공공데이터포털 한국부동산원 부동산통계 조회 서비스](https://www.data.go.kr/data/15134761/openapi.do)
- 한국부동산원 공공데이터 정책은 영리 목적을 포함한 자유로운 활용을 보장하되, 제3자 권리가 포함된 정보는 정당한 이용허락 없이는 제공 대상에서 제외한다고 밝힙니다. — [한국부동산원 공공데이터 이용정책](https://www.reb.or.kr/reb/cm/cntnts/cntntsView.do?cntntsId=1292&mi=9976)
- 수동 수집 대안으로 R-ONE 공표보고서의 Excel·PDF와 KOSIS 통계표가 공식 제공됩니다. — [한국부동산원 자료제공](https://www.reb.or.kr/reb/cm/cntnts/cntntsView.do?cntntsId=1185&mi=9803)

### Inferences
- 골목 레이더에서는 `RONE_API_KEY` 같은 서버 전용 환경변수로 보관하고 FastAPI 수집기에서 호출해야 합니다. 프런트 `VITE_` 환경변수에 넣으면 안 됩니다.
- 최초 구현은 공표보고서 Excel을 원천 파일로 고정해 스키마·매핑을 검증한 뒤, 같은 통계표 코드가 확인되면 API 수집기로 교체하는 순서가 안전합니다.
- 공공데이터포털 페이지가 `LINK` 유형인 점과 한국부동산원의 폐기 안내를 함께 보면, 새 프로젝트는 공공데이터포털의 옛 개별 API가 아니라 R-ONE 자체 인증키를 신청해야 합니다.

### Gaps
- 공개 페이지에는 R-ONE 인증키의 일·월 호출 한도와 운영 서비스용 심사 절차가 명시되어 있지 않습니다. 발급 화면 또는 담당부서 확인이 필요합니다.
- 상업용 임대동향에 해당하는 최신 `STATBL_ID`, `CLS_ID`, `ITM_ID` 전체 목록은 동적 통계코드 검색에서 조회해야 하며, 인증키 없는 표본 응답만으로는 확정할 수 없습니다.

## 공간·시간 단위와 MVP 재사용 가능성은 무엇인가

### Takeaway
R-ONE 자체 조사상권 통계는 공식 벤치마크로 재사용할 수 있지만 서울시 상권분석서비스의 117개 상권 코드와 동일한 공간 단위라고 볼 근거는 없습니다. 직접 값 결합은 금지하고, 경계 또는 코드 간 대응관계를 검증한 매핑표가 있을 때만 별도 벤치마크로 붙여야 합니다.

### Cited Findings
- 한국부동산원은 임대동향의 최소 공표 단위를 자체 조사상권으로 정의하며 중대형·소규모·집합 상가의 상권 수가 서로 다릅니다. — [한국부동산원 조사개요](https://www.reb.or.kr/reb/cm/cntnts/cntntsView.do?cntntsId=1049&mi=10335&statId=S237220284)
- R-ONE 통계지도는 `지역별`과 `상권별`을 구분하고 조사 유형별 상권을 선택하도록 구성되어 있습니다. — [R-ONE 상업용부동산 임대동향 통계지도](https://www.reb.or.kr/r-one/portal/gis/rcsGisViewerPage.do)
- 2026년 2분기 표본 재설계로 지수 기준시점이 `2024년 2분기=100`에서 `2026년 2분기=100`으로 바뀌었고, 오피스 권역도 새로 구획됐습니다. — [R-ONE 통계조회 안내](https://www.reb.or.kr/r-one/portal/stat/multiStatPage.do)
- 공식 공표 주기는 분기이며 2026년 3분기까지 결과가 게시되어 있습니다. — [한국부동산원 자료제공](https://www.reb.or.kr/reb/cm/cntnts/cntntsView.do?cntntsId=1185&mi=9803); [한국부동산원 2026년 3분기 보도자료](https://www.reb.or.kr/reb/na/ntt/selectNttInfo.do?mi=9565&nttSn=118007)

### Inferences
- 동일한 이름 또는 가까운 중심점만으로 R-ONE 상권 값을 서울시 상권 코드에 붙이면 공간 단위 불일치가 생길 수 있습니다. 경계 다각형이 확보되면 면적 중첩률 같은 명시적 규칙을 정하고, 없으면 `성동·광진과 관련된 더 넓은 R-ONE 조사상권 참고값`으로만 표시해야 합니다.
- 2026년 2분기 전후 임대가격지수는 기준시점과 표본 구성이 달라 단순 연속 시계열처럼 연결하면 안 됩니다. 임대료 수준값도 표본 재설계 전후 비교 시 주석이 필요합니다.
- MVP에는 최신 공통 분기의 임대료·공실률·임대가격지수를 출처와 단위가 포함된 별도 `rent_benchmark` 계층으로 저장하고, 개별 실매물·사용자 입력 비용과 시각적으로 분리하는 방식이 적합합니다.

### Gaps
- 공개 Open API 문서에서 R-ONE 조사상권의 경계 GeoJSON 또는 좌표를 제공한다는 근거를 찾지 못했습니다. 통계지도 경계의 정식 다운로드·재사용 가능 여부를 한국부동산원에 확인해야 합니다.
- 성동구·광진구 서울시 상권 117개와 R-ONE 상권의 1:1 또는 다:1 대응표는 공식적으로 제공된다는 근거를 찾지 못했습니다.

## 최근 변경과 구현 전 재확인 사항은 무엇인가

### Takeaway
2026년에는 표본·권역·지수 기준시점과 공실률 공표 항목이 변경됐습니다. 따라서 과거 기술문서나 이전 API 코드를 그대로 사용하지 말고 최신 통계코드와 2026년 분기 데이터를 다시 확인해야 합니다.

### Cited Findings
- 기존 9종 API는 R-ONE 단일 통계 API로 대체됐으며 기존 서비스는 2024-12-31 종료 예정이었습니다. — [한국부동산원 대체 서비스 안내](https://www.reb.or.kr/reb/na/ntt/selectNttInfo.do?mi=10251&nttSn=98700)
- R-ONE 기술문서는 2025-07-21 `RPSTUI_NM` 컬럼 추가를 반영해 갱신됐습니다. — [한국부동산원 R-ONE 기술문서 게시물](https://www.reb.or.kr/reb/na/ntt/selectNttInfo.do?bbsId=1268&mi=10251&nttSn=98606)
- 2026년 1분기부터 일반상가 통합 공실률과 1층 공실률이 추가됐습니다. — [R-ONE 통계조회 안내](https://www.reb.or.kr/r-one/portal/stat/multiStatPage.do)
- 2026년 2분기 표본 재설계로 임대가격지수 기준시점이 변경되고 오피스 권역이 재구획됐습니다. — [R-ONE 통계조회 안내](https://www.reb.or.kr/r-one/portal/stat/multiStatPage.do)

### Inferences
- API adapter는 통계표 코드와 항목 코드를 코드에 산재시키지 말고 설정 또는 매핑 파일에 모아야 2026년과 같은 개편에 대응할 수 있습니다.
- 수집 메타데이터에 API 기술문서 버전, 통계표 코드, 항목 코드, 분기, 표본 재설계 여부를 기록해야 재현성이 생깁니다.

### Gaps
- 2026년 3분기 공표보고서 Excel의 실제 시트명·컬럼명은 첨부파일을 내려받아 확인해야 합니다.
- 2026년 2분기 재설계 이후 성동구·광진구와 관련된 조사상권의 신·구 경계 변경 내역은 공개 정적 문서에서 확인하지 못했습니다.
