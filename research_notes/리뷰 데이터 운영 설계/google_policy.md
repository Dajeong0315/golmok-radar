# Google Maps 리뷰 데이터 정책

## Google 리뷰를 크롤링·저장·분석할 수 있는가

### Takeaway
공개 Google Maps 화면을 크롤링해 경쟁점 리뷰를 수집하는 경로는 채택하면 안 된다. 공식 Places API는 제한된 수의 리뷰를 반환하지만, API 콘텐츠를 분석용 DB로 축적·집계하는 방식은 저장·집계 제한과 충돌한다. 반면 인증된 사업주가 관리하는 자기 매장의 리뷰는 Google Business Profile API가 공식 조회 경로다.

### Cited Findings
- Google Maps Platform 약관은 콘텐츠를 서비스 밖에서 사용·내보내기·저장하지 못하게 하며, 성능 목적의 제한적 임시 저장도 최대 30일, 보안 유지, 콘텐츠·서비스의 조작 또는 집계 금지를 조건으로 한다. [Google Maps Platform Terms](https://developers.google.com/maps/terms-20180207?hl=en)
- Places API 정책도 place ID 외의 Places 콘텐츠는 사전 수집·캐시·저장을 금지한다고 명시한다. place ID만 무기한 저장 예외다. [Places API policies](https://developers.google.com/maps/documentation/places/web-service/policies)
- Place Details (New)는 `reviews` 요청 시 최대 5개의 사용자 리뷰만 반환한다. 리뷰를 요청하는 SKU와 평점·총 리뷰 수만 요청하는 SKU도 구분된다. [Place Details](https://developers.google.com/maps/documentation/places/web-service/place-details)
- Google Business Profile API의 review list는 인증된 계정의 **검증된** Business Profile 위치에 대해서만 동작하고, 페이지당 최대 50건의 리뷰와 페이지네이션을 제공한다. [Reviews list](https://developers.google.com/my-business/reference/rest/v4/accounts.locations.reviews/list)
- Business Profile API 정책은 소유하거나 사업주로부터 관리 권한을 받은 목록을 관리·보고하는 용도로만 API를 사용하도록 제한하며, 해당 API 콘텐츠 역시 성능 목적의 제한적 임시 저장(최대 30일)만 허용한다. [Business Profile API policies](https://developers.google.com/my-business/content/policies)

### Inferences
- Google 경로는 두 갈래로 분리하는 것이 안전하다. (1) 사업주 OAuth와 검증된 Business Profile을 통한 **내 매장 운영 점검**, (2) 공개 경쟁점 리뷰 원문을 장기 저장·주제별 재분석하지 않는 Places API의 즉시 표시 기능이다.
- 경쟁점 리뷰를 여러 매장에서 자동 수집하여 자체 토픽 빈도·벤치마크 데이터셋으로 저장하는 설계는 '집계 금지'와 '서비스 밖 사용 금지'에 저촉될 위험이 커서 Phase 17의 데이터 경로로 채택하지 않는 편이 타당하다.
- API가 최대 5개만 주는 Places 리뷰는 상권 전체의 표본 분석 근거로도 부족하다. `rating`·`userRatingCount`만을 즉시 표시하는 보조 정보로 제한하는 편이 더 적절하다.

### Gaps
- Google의 일반 약관·정책은 공식 문서로 확인했지만, 특정 유료 엔터프라이즈 계약이 경쟁점 원문 리뷰의 장기 분석·재사용을 별도로 허가할 수 있는지는 계약서와 Google 담당자의 서면 답변 없이는 판단할 수 없다.

## 표시·익명화·AI 요약에는 어떤 조건이 붙는가

### Takeaway
가게 이름을 A/B/C로 바꾸어도 Google 리뷰 콘텐츠의 출처·저장 제한은 사라지지 않는다. 리뷰 원문 또는 Google 제공 AI 요약을 화면에 보일 때는 저자·Google Maps 출처·원문 링크·신고 링크 등 필수 표시 조건을 지켜야 한다.

### Cited Findings
- 지도 밖에서 Places API 콘텐츠를 표시할 때도 Google Maps 로고 또는 허용된 텍스트 귀속을 포함해야 한다. [Places API policies](https://developers.google.com/maps/documentation/places/web-service/policies)
- 리뷰·사진을 표시하면 저자 귀속을 항상 제공해야 하며, 각 리뷰·사진의 Google Maps 원문으로 이동할 수 있어야 한다. [Places API policies](https://developers.google.com/maps/documentation/places/web-service/policies)
- Review 리소스에는 본문, 별점, 저자 귀속, 게시 시각, 신고 URL, Google Maps 원문 URL이 포함된다. [Places REST reference](https://developers.google.com/maps/documentation/places/web-service/reference/rest/v1/places)
- Google 제공 AI 요약을 표시할 때는 제공된 전체 요약문, disclosureText, 신고 링크와 참조 링크를 함께 표시해야 하며 disclosureText는 변경·보강하면 안 된다. [Places API policies](https://developers.google.com/maps/documentation/places/web-service/policies)

### Inferences
- A/B/C는 경쟁점 식별 노출을 줄이는 제품 UX일 뿐, Google 콘텐츠의 라이선스·출처·저자 귀속·링크·신고 요건을 대체하지 않는다. 특히 원문 리뷰와 저자 정보를 제거한 뒤 자체 요약만 남기는 방식은 요구된 귀속 및 직접 접근 조건을 충족하기 어렵다.
- Google 공식 AI `reviewSummary`가 제공되는 경우에도 서비스가 만든 별도 AI 요약으로 바꾸어 저장·재배포하는 근거가 되지 않는다. 해당 API의 요약을 그대로, 정해진 표시 요건과 함께 즉시 표시하는 경우에만 별도 검토할 수 있다.

### Gaps
- A/B/C 가명화만으로 리뷰 표시 요건을 모두 충족한다는 Google의 명시적 답변은 찾지 못했다. 제품 출시 전 Google Maps Platform 지원 또는 계약 담당자에게 화면 시안을 첨부해 서면 확인이 필요하다.

## 권장 구현 경로와 제외 범위

### Takeaway
Phase 17의 즉시 구현 범위는 ‘가게 소유자가 OAuth로 연결한 검증된 자기 매장’의 리뷰 운영 점검으로 한정하고, 경쟁점·상권 단위 비교는 재사용 권한을 계약으로 받은 별도 공급자 adapter가 준비된 뒤 활성화하는 것이 권장된다.

### Cited Findings
- Business Profile API는 OAuth `business.manage` 등의 범위를 요구하며, 계정이 소유·관리하는 위치를 조회하는 API를 제공한다. [Work with location data](https://developers.google.com/my-business/content/location-data)
- Google은 Business Profile 리뷰 응답을 사업주 권한 없이 자동으로 만들거나 수정하는 행위를 금지하고, 사업주 대신 리뷰 답글을 작성할 경우 사전 승인을 요구한다. [Business Profile API policies](https://developers.google.com/my-business/content/policies)
- Places API의 공식 Place Details는 평점·총 리뷰 수 또는 최대 5개 리뷰를 field mask로 선택해 조회할 수 있다. [Place Details](https://developers.google.com/maps/documentation/places/web-service/place-details)

### Inferences
- **허용 전제의 MVP:** 사용자가 Google OAuth로 본인 Business Profile을 연결 → 관리 가능한 검증 위치를 선택 → 최근 리뷰를 조회 → 화면 내 운영 이슈를 요약하되, 원문·파생 데이터 보관은 정책의 30일 제한과 계약 검토가 끝날 때까지 최소화한다. 답글 자동 생성·자동 게시·경쟁점 수집은 제외한다.
- **상권 분석:** Google Places API로는 사용자가 클릭한 상권에서 실시간 평점·리뷰 수를 참고 정보로 표시하는 선택지는 있으나, 리뷰 원문 자동 수집·A/B/C 경쟁점 토픽 분석에는 사용하지 않는다. 상권/경쟁점 분석은 계약으로 분석·저장·익명 집계가 허가된 데이터 제공자 또는 사용자가 적법하게 제공한 내보내기 파일만 사용한다.
- **자동 주기:** Google 콘텐츠에 대해 야간 배치로 대량 사전 수집하지 않는다. 사용자의 명시적 화면 요청이나 연결된 자기 매장 점검 요청 때만 API를 호출하고, refresh·TTL·삭제 로직은 계약/정책 문구를 재검토한 후 확정한다.

### Gaps
- Business Profile API 정책의 30일 임시 저장 예외가 모델 학습용 파생 임베딩·토픽 집계·운영 리포트에 각각 어떻게 적용되는지는 문서에 명시돼 있지 않다. 저장하기 전에 Google에 서면 확인을 요청해야 한다.
