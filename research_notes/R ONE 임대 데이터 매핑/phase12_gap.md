# Phase 12 구현과 실매물 연동 경계

## 현재 Phase 12 구현은 무엇을 제공하는가

### Takeaway
현재 구현은 사용자가 입력한 매물 비용의 계산과 “공식 통계·사용자 입력·실매물”의 시각적 분리는 제공하지만, R-ONE 수치를 아직 반환하지 않고 `mapping_required` 상태만 반환한다. 따라서 비용 시뮬레이터와 안전한 실패 상태는 구현됐지만 공식 임대 벤치마크의 데이터 연동은 완료되지 않았다.

### Cited Findings
- `GET /api/v1/trade-areas/{code}/rent-benchmark`는 상권 존재 여부를 확인한 뒤 `status="mapping_required"`, 제공기관, 데이터셋명, 분기 갱신, `is_live_listing=false`, 원문·API 문서 링크를 반환하며 임대료·공실률·임대가격지수의 수치 필드는 반환하지 않는다. — [backend/app/main.py L189-L204](https://github.com/Dajeong0315/golmok-radar/blob/c0efae7/backend/app/main.py#L189-L204); [backend/app/schemas.py L138-L147](https://github.com/Dajeong0315/golmok-radar/blob/c0efae7/backend/app/schemas.py#L138-L147)
- 프런트엔드는 보증금·월세·관리비·면적·예상 월매출을 입력받고 월 공간비, 연 공간비, 1평당 월 비용, 예상매출 대비 공간비를 표시하며 보증금은 반복비용에서 제외한다고 설명한다. — [frontend/src/RentPage.tsx L37-L48](https://github.com/Dajeong0315/golmok-radar/blob/c0efae7/frontend/src/RentPage.tsx#L37-L48); [frontend/src/rentCalculator.ts L16-L23](https://github.com/Dajeong0315/golmok-radar/blob/c0efae7/frontend/src/rentCalculator.ts#L16-L23)
- 같은 화면은 공식 임대 통계와 개별 실매물을 별도 패널로 보여 주고, 공식 통계에는 “매핑 검증 필요”, 실매물에는 “제휴 API 없음”을 표시하며 네이버 부동산으로 가는 일반 링크만 제공한다. — [frontend/src/RentPage.tsx L50-L52](https://github.com/Dajeong0315/golmok-radar/blob/c0efae7/frontend/src/RentPage.tsx#L50-L52)
- 후보 상권 화면에서 선택한 상권 코드를 `#rent?code=...`로 넘기고, 라우터가 해당 코드를 임대 화면에 전달한다. — [frontend/src/RecommendationsPage.tsx L51-L57](https://github.com/Dajeong0315/golmok-radar/blob/c0efae7/frontend/src/RecommendationsPage.tsx#L51-L57); [frontend/src/Root.tsx L23-L29](https://github.com/Dajeong0315/golmok-radar/blob/c0efae7/frontend/src/Root.tsx#L23-L29)
- 프런트 단위 테스트는 정상 계산, 면적·매출 분모 0, URL 상권 코드 파싱의 3사례를 검증하고, 백엔드 테스트는 임대 통계가 실시간 매물로 표현되지 않는지 검증한다. — [frontend/src/rentCalculator.test.ts L5-L23](https://github.com/Dajeong0315/golmok-radar/blob/c0efae7/frontend/src/rentCalculator.test.ts#L5-L23); [backend/tests/test_api.py L187-L194](https://github.com/Dajeong0315/golmok-radar/blob/c0efae7/backend/tests/test_api.py#L187-L194)

### Inferences
- 현재 응답 스키마에는 벤치마크 값, 단위, 기준분기, R-ONE 지역 식별자, 매핑 방식·신뢰도·공간 범위를 담을 필드가 없으므로, 수치를 연결하기 전에 API 계약 확장이 필요하다. — [backend/app/schemas.py L138-L147](https://github.com/Dajeong0315/golmok-radar/blob/c0efae7/backend/app/schemas.py#L138-L147)
- 현재 테스트는 계산 함수와 최소 API 안전장치는 다루지만, 임대 화면 렌더링, 출처·단위·기준기간 표시, 허가되지 않은 실매물 공급자가 비활성화되는 동작은 직접 검증하지 않는다. — [frontend/src/rentCalculator.test.ts L5-L23](https://github.com/Dajeong0315/golmok-radar/blob/c0efae7/frontend/src/rentCalculator.test.ts#L5-L23); [backend/tests/test_api.py L187-L194](https://github.com/Dajeong0315/golmok-radar/blob/c0efae7/backend/tests/test_api.py#L187-L194)

### Gaps
- React 컴포넌트 수준의 임대 화면 테스트와 모바일 브라우저 시나리오 검증 기록은 현재 Phase 12 테스트 파일에서 확인되지 않는다.
- 관리비가 면적 기준인지 고정액인지, 부가세 포함 여부, 월세 환산 시 보증금을 반영할지 등 사용자 입력 계약은 제품 결정으로 더 구체화할 필요가 있다.

## 계획 완료 조건과 비교해 무엇이 남았는가

### Takeaway
계획상 외부 제휴가 없을 때 실매물은 외부 링크만 제공해도 되므로 실매물 API 부재 자체는 Phase 12 완료를 막지 않는다. 실질적인 미완료 항목은 R-ONE 통계 계약·공간 매핑 검증과, 그 결과를 기준기간·단위·표본 통계라는 성격과 함께 표시하는 것이다.

### Cited Findings
- Phase 12 계획은 R-ONE 임대료·공실률·임대가격지수 계약 검증, 서울 상권 코드와의 공간 매핑, 사용자 입력 비용 계산, 기준일·표본 통계·비실매물 표시를 요구한다. — [docs/plan.md L300-L309](https://github.com/Dajeong0315/golmok-radar/blob/c0efae7/docs/plan.md#L300-L309)
- 계획은 정식 제휴·라이선스 API가 있을 때만 실매물을 adapter로 연결하고, 그렇지 않으면 외부 검색 링크를 제공하도록 명시한다. — [docs/plan.md L310-L314](https://github.com/Dajeong0315/golmok-radar/blob/c0efae7/docs/plan.md#L310-L314)
- 현재 진행표도 Phase 12를 “비용 시뮬레이터·출처 구분 완료; R-ONE 공간 매핑·실매물 제휴 대기”인 부분 완료로 기록한다. — [docs/plan.md L393-L397](https://github.com/Dajeong0315/golmok-radar/blob/c0efae7/docs/plan.md#L393-L397)
- 한국부동산원은 기존 공공데이터포털의 상업용부동산 임대동향 API를 포함한 9종을 2024년 12월 31일 종료하고, 구조가 다른 R-ONE Open API를 대체 서비스로 안내했다. — [한국부동산원 폐기·대체 공지](https://www.reb.or.kr/reb/na/ntt/selectNttInfo.do?mi=10251&nttSn=98700)
- R-ONE 개발가이드는 인증키 발급에 로그인이 필요하고, 인증키가 없으면 sample 모드로 제한되며, CORS·JSONP를 지원하지 않아 외부 웹앱에서는 서버가 호출해야 한다고 안내한다. — [R-ONE 개발가이드](https://www.reb.or.kr/r-one/portal/openapi/openApiDevPage.do)

### Inferences
- 외부 제휴 없이도 “사용자 입력 계산 + 공식 통계 벤치마크 + 외부 실매물 링크”로 Phase 12 완료 조건을 충족할 수 있다. 이는 계획이 제휴 부재 시 외부 링크를 명시적으로 허용하기 때문이다. — [docs/plan.md L310-L314](https://github.com/Dajeong0315/golmok-radar/blob/c0efae7/docs/plan.md#L310-L314)
- R-ONE 호출은 프런트가 아니라 FastAPI adapter에서 수행하고, 원천 응답·통계표 ID·지역 ID·항목 ID·기준분기·단위를 정규화해 내려야 한다. R-ONE이 브라우저 직접 호출을 지원하지 않는다는 공식 제약과 현재 FastAPI 엔드포인트 구조가 이 설계를 뒷받침한다. — [R-ONE 개발가이드](https://www.reb.or.kr/r-one/portal/openapi/openApiDevPage.do); [backend/app/main.py L189-L204](https://github.com/Dajeong0315/golmok-radar/blob/c0efae7/backend/app/main.py#L189-L204)
- 매핑이 정확한 코드 결합이 아니라면 API와 UI는 `exact`, `overlap`, `district_context`, `unavailable` 같은 매핑 수준과 사유를 명시하고, 구 단위 또는 R-ONE 상권 단위 수치를 골목 레이더 상권의 고유값처럼 표현하지 않아야 한다. — [docs/plan.md L306-L314](https://github.com/Dajeong0315/golmok-radar/blob/c0efae7/docs/plan.md#L306-L314)

### Gaps
- 사용할 R-ONE 통계표 ID, 항목 ID, 지역 ID와 성동구·광진구 커버리지는 별도의 공간 매핑 조사 결과가 필요하다.
- R-ONE 인증키의 운영 호출량·재배포·캐시 조건은 발급 과정과 명세서에서 추가 확인해야 한다.

## 합법적으로 사용할 수 있는 실매물 API가 확인되는가

### Takeaway
2026-10-30 현재 NAVER Developers의 공식 공개 API 목록에는 부동산 또는 실매물 API가 없다. 공식 공공데이터에서 확인되는 상업용 데이터는 매매 실거래 또는 영업 중 상가업소 정보이며, 현재 임대 매물 목록의 대체재가 아니다.

### Cited Findings
- NAVER Developers의 공식 공개 API 목록은 검색, 로그인·프로필, 데이터랩, 캡차, 캘린더, 카페, 공유하기를 열거하지만 부동산 매물 API를 포함하지 않는다. — [네이버 오픈 API 목록](https://developers.naver.com/products/intro/plan/plan.md)
- 네이버 약관은 API 결과를 허용 범위를 넘어 복제·저장·가공·배포하거나 네이버 지역정보를 별도 데이터베이스로 관리하는 행위를 금지한다. — [NAVER API 서비스 이용약관 7.3](https://developers.naver.com/products/intro/terms/terms.md)
- 네이버는 공식 운영정책에서 API 제휴 문의와 사업 제휴 제안 채널을 제공하지만, 해당 페이지는 부동산 매물 API 제공을 약속하거나 명세하지 않는다. — [NAVER Developers 운영 정책](https://developers.naver.com/products/intro/operation/operation.md)
- 국토교통부 공개 API는 상업·업무용 부동산의 신고된 **매매 실거래가**를 법정동 코드와 계약년월로 제공하며, 임대 매물 또는 현재 모집 중인 매물이 아니다. — [공공데이터포털 상업업무용 매매 실거래가](https://www.data.go.kr/data/15126463/openapi.do)
- 소상공인시장진흥공단의 상가정보 API는 영업 중 업소의 상호·주소·업종·좌표 등을 제공하는 사업체 현황 데이터로 설명되며, 공실·임대 매물 데이터가 아니다. — [공공데이터포털 상가정보 API](https://www.data.go.kr/data/15012005/openapi.do)
- R-ONE Open API는 부동산 통계 정보를 외부에 공개하는 통계 API이며 인증키 발급 절차를 제공한다. — [R-ONE Open API 소개](https://www.reb.or.kr/r-one/portal/openapi/openApiIntroPage.do)

### Inferences
- 네이버 검색 API나 내부 웹 요청을 실매물 공급원처럼 재사용해서 매물 DB를 만드는 것은 공개 API 목록의 제공 목적과 약관상 저장 제한에 맞지 않으므로 구현하면 안 된다. — [네이버 오픈 API 목록](https://developers.naver.com/products/intro/plan/plan.md); [NAVER API 서비스 이용약관 7.3](https://developers.naver.com/products/intro/terms/terms.md)
- 공공 상업용 매매 실거래가는 과거 체결 거래의 시장 맥락 지표로 별도 활용할 수 있지만, 월세·보증금 기반의 현재 실매물 카드로 표시해서는 안 된다. — [공공데이터포털 상업업무용 매매 실거래가](https://www.data.go.kr/data/15126463/openapi.do)
- 확인된 공식 출처만으로는 전국 일반 상가의 현재 임대 매물을 자동 표시하는 공개 API를 확정할 수 없다. 따라서 현 상태에서는 외부 링크와 사용자 직접 입력이 가장 방어 가능한 MVP 동작이다. — [docs/plan.md L310-L314](https://github.com/Dajeong0315/golmok-radar/blob/c0efae7/docs/plan.md#L310-L314); [네이버 오픈 API 목록](https://developers.naver.com/products/intro/plan/plan.md)

### Gaps
- “공개 문서에서 확인되지 않음”은 비공개 B2B 제휴 상품의 부재를 증명하지 않는다. 실매물 자동 연동을 원하면 공급자에게 데이터 필드, 갱신 주기, 저장·캐시, 재노출, 저자·중개사 표시, 상세 링크, 삭제·만료 처리 권한을 서면으로 받아야 한다.
- 네이버 제휴 문의 채널이 실제로 상가 임대 매물 API를 제공하는지는 공개 문서만으로 확인할 수 없다.

## 안전한 adapter 경계와 지금 진행 가능한 일은 무엇인가

### Takeaway
실매물 제휴 없이도 R-ONE adapter와 데이터 계약, 명시적인 `unavailable` 실매물 공급자, UI·API 테스트까지 구현할 수 있다. 실제 매물 행을 반환하는 기능만 공급자 계약·명세·인증정보가 확보될 때까지 비활성화해야 한다.

### Cited Findings
- 현재 프로젝트 원칙은 정식 제휴·라이선스 API가 있을 때만 adapter로 실매물을 연결하고, 없으면 외부 링크를 제공하는 것이다. — [docs/plan.md L310-L314](https://github.com/Dajeong0315/golmok-radar/blob/c0efae7/docs/plan.md#L310-L314)
- 현재 API 응답은 공식 통계에 대해 `is_live_listing=false`를 강제하며, 테스트도 이 구분을 검증한다. — [backend/app/main.py L194-L203](https://github.com/Dajeong0315/golmok-radar/blob/c0efae7/backend/app/main.py#L194-L203); [backend/tests/test_api.py L187-L194](https://github.com/Dajeong0315/golmok-radar/blob/c0efae7/backend/tests/test_api.py#L187-L194)
- 네이버 약관은 API 결과 데이터의 무단 저장·가공·제3자 제공과 지역정보의 별도 DB화를 금지하므로, 공급자별 저장·캐시·재노출 조건을 adapter 정책으로 분리해야 한다. — [NAVER API 서비스 이용약관 7.3](https://developers.naver.com/products/intro/terms/terms.md)

### Inferences
- 실매물 provider interface는 서버 전용으로 두고 `provider`, `provider_listing_id`, `detail_url`, `observed_at`, `updated_at`, `expires_at`, `address_or_area`, `latitude`, `longitude`, `property_type`, `deposit`, `monthly_rent`, `management_fee`, `area_m2`, `floor`, `broker_name`, `attribution`, `license_policy`를 nullable 필드로 정규화하는 것이 안전하다. 알 수 없는 값은 0이 아니라 `null`과 사유로 반환해야 프로젝트의 결측 처리 원칙을 유지할 수 있다. — [docs/plan.md L300-L314](https://github.com/Dajeong0315/golmok-radar/blob/c0efae7/docs/plan.md#L300-L314); [backend/app/schemas.py L138-L147](https://github.com/Dajeong0315/golmok-radar/blob/c0efae7/backend/app/schemas.py#L138-L147)
- 공급자 상태는 `available`, `configuration_required`, `partnership_required`, `temporarily_unavailable`로 분리하고, 허가된 adapter가 없을 때 빈 배열과 외부 링크만 반환해야 가상·오래된 매물이 현재 매물처럼 보이는 것을 막을 수 있다. — [docs/plan.md L310-L314](https://github.com/Dajeong0315/golmok-radar/blob/c0efae7/docs/plan.md#L310-L314)
- 지금 바로 가능한 구현은 (1) R-ONE 인증키 환경변수 계약, (2) 서버측 R-ONE client와 fixture 기반 parser, (3) 기준분기·단위·공간매핑 수준을 포함한 응답 스키마, (4) 실매물 provider interface와 비활성 기본 adapter, (5) 출처 세 종류를 혼동하지 않는 API·컴포넌트 테스트다. 실제 실매물 행은 공급자 계약 전에는 추가하지 않는다. — [R-ONE 개발가이드](https://www.reb.or.kr/r-one/portal/openapi/openApiDevPage.do); [docs/plan.md L306-L314](https://github.com/Dajeong0315/golmok-radar/blob/c0efae7/docs/plan.md#L306-L314)
- 계획을 그대로 따르면 사용자가 지금 결정해야 할 사항은 없다. 실매물 자동 표시를 MVP 필수로 올릴 때만 “외부 링크 유지”와 “정식 공급자 제휴 추진” 중 제품 범위 결정을 새로 해야 한다. — [docs/plan.md L310-L314](https://github.com/Dajeong0315/golmok-radar/blob/c0efae7/docs/plan.md#L310-L314)

### Gaps
- 실제 공급자 adapter 구현에는 서면 이용허락, API 명세, 인증 방식, 호출량, 가격, 저장·캐시 기간, 필수 저작자·중개사 표시, 삭제·만료 웹훅 또는 재조회 정책이 필요하다.
- R-ONE 숫자를 골목 레이더 상권에 표시할 수 있는지는 별도 공간 매핑 조사 결론에 따라야 한다.
