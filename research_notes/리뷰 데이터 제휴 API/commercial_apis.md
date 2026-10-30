# 서울 카페 경쟁점 리뷰 데이터 제휴 API 조사

조사 기준일: 2026-10-31  
범위: 서울에서 사용자가 선택한 본인 카페와 주변 동종 카페의 리뷰 원문을 합법적으로 수집해 감성·주제 분석하고, 결과를 서비스 화면에 제공할 수 있는 B2B API/피드

## 어떤 제공자가 경쟁점 리뷰 원문과 주변 매장 검색을 함께 제공하는가?

### Takeaway

현재 공개된 공식 문서만으로 세 조건(서울 카페 커버리지, 주변 검색, 경쟁점 리뷰 원문)을 가장 가깝게 충족하는 정식 콘텐츠 제휴형 후보는 **Tripadvisor Terra**다. 다만 Tripadvisor에 등록된 서울 카페만 대상으로 하므로 실제 커버리지를 표본 검증해야 한다. **Yelp Insights**도 정식 라이선스형 원문 API이지만 Yelp의 공식 지원 로케일 목록에 한국이 없어 서울 서비스의 주 데이터원으로 채택하기 어렵다. Google Business Profile, Yext, Sprinklr는 본인 매장 리뷰 관리에는 유용하지만 경쟁점 리뷰 원문을 안정적으로 재사용하는 API로는 부족하다.

### Cited Findings

| 제공자 | 리뷰 원문 | 주변 경쟁점 탐색 | 한국/서울 근거 | 판정 |
|---|---|---|---|---|
| Tripadvisor Terra | `GET /locations/{id}/reviews`가 제목·본문·평점·세부평점·방문 맥락·소유자 답변을 반환하며, 계약으로 최근 N개 또는 최근 M개월의 리뷰 풀을 정한다. ([리뷰 API](https://docs.terra.tripadvisor.com/reference/locationreviewsget)) | 카탈로그 Nearby API는 좌표·반경 또는 경계 상자 안의 `RESTAURANT`를 거리/평점순으로 검색하고, 라이선스된 Location API는 허용목록의 상세 데이터를 반환한다. ([카탈로그 Nearby](https://docs.terra.tripadvisor.com/reference/cataloglocationsnearbyget), [라이선스 Nearby](https://docs.terra.tripadvisor.com/reference/locationsnearbyget)) | 리뷰 API가 `ko`를 지원하고 원문 그대로 받는 `language=primary`를 제공한다. 검색 문서는 한중일 검색어 정확도가 더 약하다고 명시한다. ([언어](https://docs.terra.tripadvisor.com/docs/supported-languages-for-reviews), [검색](https://docs.terra.tripadvisor.com/reference/locationssearch)) | **1순위 실증 후보**. 콘텐츠는 직접 제출된 Tripadvisor 리뷰이며 스크래핑이 아니라고 공식 설명한다. ([개발자 소개](https://www.tripadvisor.com/business/solutions/hotels/terra-content-api-bottom)) |
| Yelp Insights | Private Reviews가 최근 최대 200개 리뷰의 전체 본문과 ID를 제공하며, Business Search/Match로 후보 매장을 찾은 뒤 계약된 ID를 조회한다. ([기술 개요](https://docs.developer.yelp.com/docs/yelp-insights)) | Business Search가 위치·카테고리 기반 발견을 지원한다. 다만 자동 검색 결과를 곧바로 구독하지 말고 주소·전화·상태를 검증하라고 요구한다. ([기술 개요](https://docs.developer.yelp.com/docs/yelp-insights)) | Yelp Places 공식 로케일 목록에는 한국/한국어가 없다. ([지원 로케일](https://docs.developer.yelp.com/docs/resources-supported-locales)) | **라이선스 구조는 적합, 서울 커버리지는 부적합 가능성이 큼**. 계약 전에 Seoul/KR business ID 수와 한국어 리뷰 수를 서면 확인해야 한다. |
| Google Places API (New) | Place Details가 관련도순 리뷰를 **최대 5개**만 반환한다. ([Place 리소스](https://developers.google.com/maps/documentation/places/web-service/reference/rest/v1/places)) | Text Search와 Nearby Search로 장소 ID를 찾을 수 있다. ([개요](https://developers.google.com/maps/documentation/places/web-service/overview)) | Google Places 자체는 서울에서 사용할 수 있지만, 리뷰를 대량 수집하는 기능은 아니다. | **화면상 출처 링크가 있는 소량 미리보기만 검토**. 전체 경쟁점 리뷰 분석용 데이터셋으로 부적합. |
| Google Business Profile API | 인증된 계정의 특정 Location 리뷰를 최대 50개씩 페이지네이션해 읽고 답변할 수 있다. ([Reviews list](https://developers.google.com/my-business/reference/rest/v4/accounts.locations.reviews/list), [리뷰 관리](https://developers.google.com/my-business/content/review-data)) | 경쟁점 발견 기능이 아니라 소유자/관리자 계정과 연결된 검증 Location 관리용이다. ([Locations](https://developers.google.com/my-business/reference/rest/v4/accounts.locations)) | 소유 매장은 가능하나 경쟁점은 불가. | **본인 매장 전용 보조 커넥터**. 경쟁점 데이터 소스가 아니다. |
| Yext | Review Monitoring이 Google·Facebook·Yelp·Tripadvisor 등 자사 Location 리뷰를 모으며 Management API로 계정 내 리뷰를 읽는다. ([개요](https://help.yext.com/hc/en-us/articles/360001275683-Reviews-Overview), [API](https://www.yext.com/platform/features/apis)) | Competitive Intelligence는 5개 경쟁사의 별점·검색 성과 비교 기능이다. 공개 패키지 문서는 경쟁점 원문 API를 약속하지 않는다. ([패키지](https://www.yext.com/platform/packages)) | 한국 게시자별 커버리지는 공개 문서에서 확인되지 않는다. | **본인 매장 평판 관리에는 적합, 경쟁점 원문 수집에는 미확인/부적합**. Yelp 원문 200개 add-on도 entity 단위 상품이다. ([패키지](https://www.yext.com/platform/packages)) |
| Sprinklr | 자사 Google Business Profile은 공식 Owned Account API로 받지만, Google.com 경쟁점 URL은 데이터 벤더를 사용하며 직접 API가 아니고 100% 이력을 보장하지 않는다. ([비교 문서](https://www.sprinklr.com/help/articles/sources/account-based-listening-v-review-source/63e3951c55780d70a15bda1c), [Google.com 소스](https://www.sprinklr.com/help/articles/sources/adding-googlecom-as-a-source/63e3951ba9d511790301668d)) | URL 단위 경쟁점 추적과 감성·주제 분석이 가능하나, 수집 지연은 24~72시간이고 삭제/수정 준수도 지원하지 않는다고 명시한다. ([Google.com 소스](https://www.sprinklr.com/help/articles/sources/adding-googlecom-as-a-source/63e3951ba9d511790301668d)) | 서울 특정 출처 커버리지는 계약 확인이 필요하다. | **조건부/고위험**. 경쟁점 Google 리뷰가 직접 제휴가 아닌 벤더·크롤링 기반이라 원문 재사용권을 별도 보증받기 전에는 채택하지 않는다. |
| Brandwatch | 리뷰 사이트 데이터를 제3자 데이터 제공자로부터 수집하고, 원문·감성·주제 등 Mention 분석을 제공한다. ([소스](https://social-media-management-help.brandwatch.com/en/articles/17449910-sources-for-listen-mentions), [Listen](https://social-media-management-help.brandwatch.com/en/articles/17449911-introduction-to-listen)) | 키워드 기반 경쟁사 언급 탐색은 가능하지만 주변 카페 POI 탐색 API로 문서화되지 않았다. | Naver·Daum·Tistory 등 APAC 출처와 모든 언어 수집을 주장하지만, 서울 카페 리뷰 원문 출처별 범위는 공개되지 않았다. ([Consumer Research](https://www.brandwatch.com/products/consumer-research/features/)) | **보조 소셜 리스닝 후보**. 매장-리뷰 정합성과 원문 API 재사용권을 출처별로 계약 확인해야 한다. |
| TrustYou Data | 관광·숙박 리뷰를 집계한 Meta-Review를 API/AWS 덤프로 제공하며 식당·관광지도 포함할 수 있다. ([TrustYou Data](https://www.trustyou.com/trustyou-data/)) | 공개 문서에서 서울 카페 반경 검색과 제3자 리뷰 원문 API는 확인되지 않는다. | 전 세계 관광 POI 지향이며 서울 카페 커버리지 수치는 없다. | **Meta-Review/관광용 보조 후보**. 경쟁 카페 원문 분석의 1차 데이터원으로는 부적합. |
| Kakao Local / Naver Local | Kakao 공식 Local API의 장소 결과는 이름·카테고리·주소·좌표·상세 URL 등이며 리뷰 본문 필드가 없다. ([Kakao 응답 필드](https://developers.kakao.com/docs/ko/kakaomap/rest-api)) Naver Local은 업체 정보와 리뷰 수 기반 정렬만 제공한다. ([Naver Local](https://api.ncloud-docs.com/docs/naver-api-hub-search-local)) | 두 API 모두 서울 주변 카페 후보 탐색에는 유용하다. Kakao 장소 검색 무료 쿼터는 API별 하루 100,000회로 문서화되어 있다. ([Kakao 쿼터](https://developers.kakao.com/docs/en/getting-started/quota)) | 한국 POI 탐색에 적합. | **발견/매칭 전용**. 리뷰 원문은 별도 정식 제휴 데이터가 필요하다. |

### Inferences

- MVP의 가장 현실적인 합법 경로는 **Kakao 또는 Naver로 주변 카페 후보를 찾고 → Tripadvisor Terra 카탈로그에서 주소·좌표로 교차 매칭하고 → 라이선스 허용목록에 추가된 매장의 리뷰만 분석**하는 2단계 구조다. POI 후보 수와 리뷰 제공 가능 매장 수를 분리 표시해야 한다.
- 본인 매장은 Google Business Profile 공식 OAuth로 더 풍부한 자사 리뷰를 가져오고, 경쟁점은 Terra 같은 제휴형 데이터로 가져오는 이중 소스가 가능하다. 단, 서로 다른 플랫폼의 평점·리뷰 수를 동일 모집단처럼 직접 비교하면 안 된다.
- Yelp Insights의 기술·계약 구조는 목표에 매우 잘 맞지만, 한국 로케일 부재 때문에 서울 데이터는 없는 것으로 단정하지 말고 영업팀에 실제 한국 business ID 및 한국어 리뷰 표본을 요청한 뒤 제외 여부를 확정해야 한다.

### Gaps

- Terra가 서울의 독립 카페를 얼마나 보유하는지, `CAFE` 세부 분류를 안정적으로 구분하는지, 허용목록 추가 승인 시간과 최대 개수는 공개 문서만으로 확인되지 않았다.
- Yext·Sprinklr·Brandwatch가 Naver Place/Kakao Map 리뷰 원문을 정식 계약으로 제공한다는 공식 근거는 찾지 못했다.
- Naver/Kakao의 기업 제휴형 리뷰 원문 라이선스 상품은 공개 개발자 문서에 보이지 않는다. 별도 사업제휴 문의가 필요하다.

## 원문 보관·표시·파생 분석에는 어떤 제약이 있는가?

### Takeaway

정식 API라는 사실만으로 리뷰를 영구 보관하거나 임의의 AI 학습·파생 데이터 상품에 재사용할 수 있는 것은 아니다. Terra와 Yelp Insights는 계약이 실제 사용권의 기준이며, Google Places는 저장·출처표시 제약 때문에 분석 데이터베이스로 쓰기 어렵다. 계약에는 원문 임시 저장 기간, 삭제 전파, 파생 감성/주제 결과의 보유 기간, 최종 사용자 표시 범위, 모델 학습 금지를 명시해야 한다.

### Cited Findings

- Terra는 리뷰를 제품에 직접 표시할 수 있지만 Tripadvisor 귀속, 버블 평점, 리뷰 날짜 표시가 필요하다고 설명한다. ([Terra FAQ](https://www.tripadvisor.com/business/solutions/hotels/terra-content-api-bottom)) 리뷰 API의 `language=primary`는 원문 NLP·감성 분석에 유용하다고 공식 문서가 명시한다. ([지원 언어](https://docs.terra.tripadvisor.com/docs/supported-languages-for-reviews)) 다만 실제 리뷰 풀과 사용권은 delivery configuration/계약에 의해 정해진다. ([리뷰 API](https://docs.terra.tripadvisor.com/reference/locationreviewsget))
- Yelp Places는 상업적 분석을 금지하고, 캐시는 최대 24시간이며, 전체 리뷰 원문 대신 약 160자 발췌 3개만 기본 제공한다. 분석 목적 전체 원문은 Yelp Insights에 별도 신청해야 한다. ([Places FAQ](https://docs.developer.yelp.com/docs/places-faq)) Yelp Insights는 상업 SaaS·분석 플랫폼을 위한 파트너 API이며 최근 최대 200개 원문을 계약된 권한에 맞춰 제공한다. ([개요](https://docs.developer.yelp.com/docs/yelp-insights), [Getting Started](https://docs.developer.yelp.com/docs/getting-started)) 피드/폴링은 삭제된 리뷰가 다음 데이터에서 사라지므로 매일 갱신하라고 권고한다. ([기술 개요](https://docs.developer.yelp.com/docs/yelp-insights))
- Google Places 정책은 place ID 외 콘텐츠의 사전 수집·캐시·저장을 원칙적으로 금지하고, 리뷰를 표시할 때 저자 정보·Google Maps 원문 링크·Google 귀속을 요구한다. ([Places 정책](https://developers.google.com/maps/documentation/places/web-service/policies)) API가 접근시키는 제3자 콘텐츠는 권리자 라이선스 또는 법률상 허용 없이는 사용할 수 없다고 Google API 약관도 명시한다. ([Google API 약관](https://developers.google.com/terms))
- Yext는 자사 수집 1차 리뷰는 사업자가 소유하지만 Google·Yelp 같은 제3자 리뷰는 해당 게시자 플랫폼에 존재한다고 구분한다. ([Reviews Overview](https://help.yext.com/hc/en-us/articles/360001275683-Reviews-Overview)) 따라서 Yext 계정에서 API로 읽을 수 있다는 것과 외부 소비자 앱에 경쟁점 원문을 재게시할 수 있다는 것은 별개의 권리다.
- Brandwatch는 데이터 팩별 라이선스 제한으로 API 원문/메타데이터가 제거될 수 있다고 안내하며, 특정 출처의 전체 원문 제공 가능 여부는 계정 관리자 확인 사항이다. ([데이터 제한](https://developers.brandwatch.com/docs/data-restrictions))
- Sprinklr의 리뷰 리스닝은 벤더·firehose·crawler를 이용하고, 크롤링 금지 사이트는 수집하지 않는다고 설명한다. ([Reviews as Listening](https://www.sprinklr.com/help/articles/web-sources/reviews-as-a-listening-source/6460d2f430f12540268fa0f2)) Google.com 경쟁점 소스는 삭제/수정 준수를 지원하지 않는다고 명시한다. ([Google.com 소스](https://www.sprinklr.com/help/articles/sources/adding-googlecom-as-a-source/63e3951ba9d511790301668d))

### Inferences

- 저장 구조는 `raw_review_text`와 `derived_metrics`를 분리하고, 원문은 계약상 허용된 최소 기간만 암호화해 보관한 뒤 삭제하며, 감성·주제·집계 결과도 계약이 허용하는 경우에만 장기 보관해야 한다.
- 원문 삭제/수정 이벤트를 제공하지 않는 공급자는 매일 재동기화하고, 공급원에서 사라진 리뷰의 원문과 식별 가능한 파생 데이터를 함께 제거하는 절차가 필요하다.
- 모델 개선·재학습에 리뷰를 사용할 계획이라면 일반 “분석” 권한과 별도로 계약 조항이 필요하다. 초기 MVP는 요청 시점 분석과 비식별 집계만 허용하는 편이 안전하다.

### Gaps

- Terra 공개 문서에서 원문 캐시 기간, 리뷰 삭제 동기화 SLA, 파생 집계의 영구 보관, LLM 입력 허용, 모델 학습 허용 여부를 확인하지 못했다.
- Yelp Insights의 구체적 보관 기간·표시 의무·파생 분석 소유권은 공개 문서가 아니라 체결 계약이 기준이다.
- Yext·Brandwatch·Sprinklr의 외부 SaaS 재배포 권리와 출처별 보관 기간은 계정별 계약/데이터 팩에 달려 있다.

## 스크래핑 API는 왜 우선 후보에서 제외해야 하는가?

### Takeaway

DataForSEO, Outscraper, SerpApi는 기술적으로 Google 리뷰 원문을 빠르게 가져올 수 있지만, 공식 문서가 원천 플랫폼의 콘텐츠 재사용 라이선스를 부여한다는 근거는 없다. 특히 DataForSEO는 SERP를 에뮬레이션하고 고객에게 원천 약관 위반 책임을 돌리며, Outscraper는 스스로 스크래퍼라고 설명한다. 이 프로젝트의 “정식 리뷰 데이터 제휴 API” 요건에는 맞지 않는다.

### Cited Findings

- DataForSEO Google Reviews API는 Google SERP의 Reviews 요소를 수집하며 검색 엔진과 위치를 “emulate”한다고 설명하고, 최대 4,490개를 받을 수 있다고 한다. ([Google Reviews 개요](https://docs.dataforseo.com/v3/reviews-google-overview/)) 이용약관은 Google 등 SERP 데이터 사용이 원천 제공자 약관이나 법적 권리를 침해해 발생한 청구에 대해 고객이 DataForSEO를 면책하도록 한다. ([이용약관 §7](https://dataforseo.com/terms-of-service)) 이는 원문 재사용 라이선스가 아니라 수집 서비스에 가깝다.
- Outscraper는 Google Maps Reviews **Scraper**로 판매하며 첫 500개 무료, 이후 1,000개당 3달러, 100,000개 이후 1,000개당 1달러로 공개한다. ([가격](https://outscraper.com/ko/prices/)) FAQ도 scraping을 공개 웹사이트의 정보를 자동 추출하는 과정으로 정의하고 관할 법률 자문을 고객에게 권고한다. ([FAQ](https://outscraper.com/faq/)) 약관은 제3자 권리 침해에 대한 고객 면책 의무를 둔다. ([약관](https://outscraper.com/terms-of-service/))
- SerpApi의 Google Maps Reviews API는 Google Maps 결과를 “fetch”하고 1시간 캐시하며, 리뷰 본문 snippet·작성자·평점·응답 등을 구조화해 제공한다. ([API](https://serpapi.com/google-maps-reviews-api)) 공식 페이지에는 Legal Shield와 유료 검색 상품이 있지만, Google 리뷰 원문을 최종 사용자 서비스에서 분석·재게시할 수 있는 원천 콘텐츠 라이선스는 공개 문서에서 확인되지 않았다. ([홈](https://serpapi.com/))

### Inferences

- 이 세 서비스를 쓰면 단기 기술 구현은 쉬워도 원천 플랫폼 약관, 리뷰 작성자 권리, 개인정보 삭제 요구를 서비스 운영자가 직접 감당해야 한다. 공개 서비스 출시 전 법무 검토와 Google의 명시적 허락 없이는 제외하는 것이 타당하다.
- “공개 웹 데이터이므로 합법”이라는 공급자의 일반 설명은 한국 서비스에서의 저작권·개인정보·부정경쟁·플랫폼 계약상 재사용 허가를 대신하지 않는다.
- 경쟁점 리뷰 자동 수집의 사용자 가치를 먼저 검증하려면 실제 원문 대신 사용자가 직접 연결한 자사 리뷰, 공급자가 허용한 샌드박스 데이터, 또는 명시적으로 라이선스된 Terra 표본만 사용해야 한다.

### Gaps

- SerpApi가 특정 고객에게 별도 콘텐츠 재사용 보증이나 원천 플랫폼 계약을 제공하는지는 공개 자료로 확인되지 않았다.
- 한국법상 각 수집 방식의 적법성은 본 조사 범위를 넘으므로 실제 계약 전 전문 법률 검토가 필요하다.

## 비용·쿼터·보안과 최종 조달 순서는 어떻게 정해야 하는가?

### Takeaway

1차 PoC는 Terra의 무료 호출과 계약형 허용목록으로 데이터 적합성을 검증하고, 동시에 Yelp Insights에는 한국 커버리지 증빙을 요청하는 순서가 좋다. 엔터프라이즈 소셜 리스닝 도구는 가격·권리가 모두 견적/계약형이므로 후순위다. 계약 체결 전에는 리뷰 원문을 운영 DB에 영구 저장하지 않는다.

### Cited Findings

- Terra는 첫 1,000회 호출을 무료로 제공한다고 안내한다. 기본 패키지 쿼터는 Discover 10 RPS/일 10,000회, Growth 25 RPS/일 50,000회, Scale 50 RPS/일 200,000회, Innovate 100 RPS/맞춤형이다. Nearby/Search는 별도 1 RPS, burst 5, 일 86,400회 제한이다. ([개발자 FAQ](https://www.tripadvisor.com/business/solutions/hotels/terra-content-api-bottom), [쿼터](https://docs.terra.tripadvisor.com/docs/rate-limits)) Enterprise는 견적·맞춤 계약이다. ([개발자 FAQ](https://www.tripadvisor.com/business/solutions/hotels/terra-content-api-bottom))
- Yelp Places는 30일 평가판 5,000회이며 상업 배포에 쓸 수 없고, 유료 기본은 월 30,000회/일 5,000회라고 공개한다. 그러나 전체 원문·분석용 Yelp Insights는 고유 business ID 수와 체결 계약에 따라 과금되며 공개 정액 가격이 아니다. ([Places FAQ](https://docs.developer.yelp.com/docs/places-faq), [Insights](https://docs.developer.yelp.com/docs/yelp-insights))
- Yext 개발자 계정은 4개 entity를 시험할 수 있지만 Reviews API는 구독이 필요하다. ([Yext API 시작](https://help.yext.com/hc/en-us/articles/53018859697435-Get-Started-with-Yext-APIs)) 상품 페이지는 기능을 공개하지만 금액은 공개하지 않으며 Reviews 구매는 account team 문의 대상이다. ([Reviews Overview](https://help.yext.com/hc/en-us/articles/360001275683-Reviews-Overview)) Yext는 별도의 DPA와 법적 약관 목록을 공개한다. ([Yext Legal](https://www.yext.com/terms))
- Brandwatch Analysis API는 표준 계약에 포함되지 않고 query당 과금하며 담당자 문의가 필요하다. ([Analysis API 시작](https://developers.brandwatch.com/docs/getting-started-analysis-api)) Social Media Management API도 계정 관리자에게 가격을 받고 별도 API 약관에 서명해야 한다. ([API 접근](https://social-media-management-help.brandwatch.com/en/articles/17449961-getting-access-to-social-media-management-apis))
- Sprinklr는 표준 DPA, 하위처리자 목록, 국외 이전 메커니즘을 제공한다고 공식 자료가 설명한다. ([데이터 보호 개요](https://prod2-sprcdn-assets.sprinklr.com/50400/d4553798-5835-4d8b-8083-1abd6999d96b-989728172/Sprinklr-Data-Protection-Compl.pdf)) 공개 정가와 서울 경쟁점 리뷰 보장 범위는 확인되지 않았다.

### Inferences

권장 조달 순서는 다음과 같다.

1. **Terra 무료 PoC**: 서울 5개 구에서 프랜차이즈/독립 카페 각 20곳을 Kakao Local로 찾고, Terra 매칭률·최근 6개월 한국어 리뷰 보유율·리뷰 수·삭제 동기화 여부를 측정한다.
2. **Terra 영업/법무 질의**: 카페 분류, allowlist 한도, 원문 임시 저장 기간, 감성·주제 분석 및 결과 보관, LLM 입력, 사용자 화면 인용 범위, 삭제 SLA, 한국 개인정보 처리, DPA·하위처리자·데이터 위치를 서면 확정한다.
3. **Yelp Insights 병행 문의**: Seoul/KR business ID 수, 한국어 리뷰 수, 경쟁점 구독 가능 여부를 표본 파일로 요청한다. 충분한 데이터가 없다면 즉시 제외한다.
4. **본인 매장 연결**: Google Business Profile OAuth로 소유 매장 리뷰만 수집하고, 경쟁점과는 플랫폼별 출처를 명확히 나눠 비교한다.
5. **보조 도구 검토**: Terra 커버리지가 부족할 때만 Brandwatch/TrustYou/Yext/Sprinklr에 Naver·Kakao·Google의 서울 카페 원문 제공권과 외부 SaaS 재배포권을 문서로 요청한다.

계약서/RFP 필수 확인 항목:

- 데이터 출처별 직접 라이선스 또는 재라이선스 권한과 한국 지역 포함 여부
- 경쟁점/비고객 매장 리뷰까지 조회할 권리와 반경 검색·매장 매칭 방식
- 원문, 작성자 이름/프로필, 답변, 사진의 제공 필드와 귀속 표시 규칙
- 원문 캐시·백업·로그 보관 기간, 계약 종료 시 삭제, 삭제/수정 이벤트 SLA
- 감성·주제·요약·비식별 집계의 생성/저장/재판매 권리와 AI 모델 학습 금지 여부
- 한국 개인정보보호법 대응, DPA, 하위처리자, 국외 이전, 암호화, 접근통제, 침해 통지
- 서울 카페 표본의 매칭률·한국어 리뷰 최신성·결측률 SLA
- 호출/매장 ID/리뷰 수 기준 과금, 샌드박스, 월 최소금액, 초과요금, 해지 조건

### Gaps

- Terra의 패키지별 실제 월 금액과 DPA/보안 인증 자료는 공개 문서에서 확인되지 않았다.
- Yelp Insights, Yext, Sprinklr, Brandwatch, TrustYou의 서울 카페 원문 커버리지와 가격은 모두 영업/계약 확인이 필요하다.
- 본 조사만으로 특정 공급자의 계약이 한국 개인정보보호법상 충분하다고 결론 낼 수 없다.

