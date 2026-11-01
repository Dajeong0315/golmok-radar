# 리뷰 데이터 제휴 문의 현황

기준 시각은 **2026년 11월 1일 한국시간(KST)**입니다. 이 문서는 Phase 17의 정식 리뷰 데이터 확보 진행 상황을 기록합니다.

## 문의 결과

| 업체 | 채널 | 시각 | 상태 | 확인 근거 |
| --- | --- | --- | --- | --- |
| 다이닝코드 | `contact@diningcode.com` 이메일 | 10:47 | 발송 완료·회신 대기 | Gmail 보낸편지함에서 발송 확인 |
| Tripadvisor Terra | 공식 영업 문의 양식 | 10:46 | 접수 완료·회신 대기 | 화면에서 “응답이 기록되었습니다” 확인 |
| 식신 MetaDex | 공식 서비스 문의 양식 | 10:45, 10:47 | 접수 미확인·차단 | 두 번 모두 서버 오류 HTTP 500 |

문의 제목은 다음과 같습니다.

- 다이닝코드·식신: `[데이터 제휴 문의] 서울 카페 경쟁점 리뷰 API 및 분석 이용권`
- Tripadvisor Terra: `Data partnership inquiry for Seoul cafe competitor review analysis`

현재 확인된 업체의 실제 답변은 없습니다. 식신 문의는 성공으로 간주하지 않으며 자동으로 다시 제출하지 않습니다.

## 회신 확인

사용자가 지정한 Gmail 계정의 별도 자동화가 2026년 11월 1일 12:15부터 1시간마다 새 메일을 확인합니다. 개인 이메일 주소는 저장소에 기록하지 않습니다.

- 새 업체 답변 또는 반송 메일이 있을 때만 알림
- 자동 접수 메일과 담당자의 실제 답변을 구분
- 같은 메일을 중복 알림하지 않음
- 자동 답장과 식신 양식 자동 재제출은 하지 않음

이 저장소에는 메일 비밀번호, 세션, API 키 또는 원문 메일을 저장하지 않습니다.

## 다음 처리 순서

1. 다이닝코드와 Terra의 실제 회신 또는 반송 여부를 기다립니다.
2. 회신이 오면 서울 카페 100곳 표본, 원천별 권리, 경쟁점 리뷰 사용권, API 명세, 삭제 동기화, DPA, 가격을 같은 표로 검토합니다.
3. 식신 MetaDex 양식 장애가 계속되면 공식 페이지에 공개된 일반 문의 주소 `info@siksinhot.com` 사용 여부를 사용자가 결정합니다. 데이터 제휴 전용 주소로 확인된 것은 아니므로 자동 발송하지 않습니다.
4. 공급자가 분석·재사용·화면 표시 권리를 서면으로 확인하기 전에는 실데이터 adapter를 연결하지 않습니다.

## 공식 경로

- 식신 MetaDex: https://alipay.siksinhot.com/aidata
- 식신 일반 문의 안내: https://www.siksinhot.com/toplists/tagsearch
- Tripadvisor Terra: https://www.tripadvisor.com/business/solutions/hotels/terra-content-api-bottom

