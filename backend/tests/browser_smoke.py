"""Manual live browser journey audit against the running local servers.

Run with: py backend/tests/browser_smoke.py
Uses a fresh browser profile, so it never reads the user's account or local records.
"""

from __future__ import annotations

import json
from urllib.parse import parse_qs, unquote, urlparse

from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
from playwright.sync_api import sync_playwright


BASE = "http://127.0.0.1:5173/"
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"


def check(name: str, action, results: list[dict]) -> None:
    try:
        detail = action()
        results.append({"name": name, "status": "pass", "detail": detail})
    except Exception as error:
        results.append({"name": name, "status": "fail", "detail": f"{type(error).__name__}: {error}"[:250]})


def audit_desktop(browser, results: list[dict]) -> None:
    context = browser.new_context(viewport={"width": 1280, "height": 900})
    page = context.new_page()
    page_errors: list[str] = []
    api_errors: list[str] = []
    page.on("pageerror", lambda error: page_errors.append(str(error)[:160]))
    page.on("response", lambda response: api_errors.append(f"{response.status} {urlparse(response.url).path}") if response.status >= 400 and "/api/v1/" in response.url else None)

    def home():
        page.goto(BASE, wait_until="networkidle")
        assert page.get_by_role("heading", name="궁금한 골목에서,").count() == 1
        page.get_by_role("link", name="상권 바로 탐색하기").click()
        assert page.url.endswith("#explore")
        return "home → explore"

    check("home navigation", home, results)

    def explore():
        page.goto(BASE + "#explore", wait_until="networkidle")
        page.locator(".area-card").first.wait_for()
        count = page.locator(".area-card").count()
        assert count > 0
        assert page.get_by_label("자치구 필터").locator("option").count() == 26
        page.get_by_label("자치구 필터").select_option(label="성동구")
        assert page.locator(".area-card").count() > 0
        page.get_by_placeholder("상권 이름을 검색하세요").fill("성수역")
        page.locator(".area-card").first.click()
        page.locator(".area-card.is-map-focused").wait_for()
        assert page.locator(".map-canvas img").count() > 0
        return f"area cards {count}, district/search/map selection"

    check("explorer filters and map", explore, results)

    def compare():
        page.get_by_placeholder("상권 이름을 검색하세요").fill("")
        cards = page.locator(".area-card")
        assert cards.count() >= 2
        cards.nth(0).locator(".favorite-button").click()
        cards.nth(1).locator(".favorite-button").click()
        assert page.locator(".favorite-card").count() == 2
        page.locator(".favorite-card").nth(0).click()
        page.locator(".favorite-card").nth(1).click()
        page.get_by_role("button", name="선택한 상권 비교하기").click()
        page.get_by_role("heading", name="2개 상권 비교").wait_for()
        page.get_by_role("button", name="근거 보기").first.click()
        assert page.locator(".evidence-drawer").count() or page.get_by_text("원천값").count()
        page.get_by_role("button", name="근거 보기 닫기").click()
        return "favorites → compare → evidence"

    check("favorites comparison evidence", compare, results)

    def rent():
        page.get_by_role("link", name="선택 상권의 R-ONE 임대 벤치마크 보기").click()
        page.get_by_role("heading", name="지역 평균부터 확인하기").wait_for()
        select = page.locator(".rent-market-select select")
        page.wait_for_function("document.querySelectorAll('.rent-market-select option').length > 1")
        assert select.locator("option").count() > 1, f"market options={select.locator('option').count()}"
        select.select_option(index=1)
        page.locator(".rent-market-summary").wait_for()
        page.locator(".rent-fields input").nth(1).fill("250")
        assert page.locator(".rent-result strong").first.inner_text().strip()
        return "R-ONE selection and cost update"

    check("rent benchmark", rent, results)

    def worksheet():
        page.goto(BASE + "#worksheet", wait_until="networkidle")
        page.get_by_role("button", name="+ 매물 후보 추가").click()
        page.get_by_placeholder("예: 성수 A 코너 1층").fill("브라우저 점검")
        page.locator(".worksheet-save").click()
        page.get_by_text("이 브라우저에 매물 워크시트를 저장했습니다.", exact=False).wait_for()
        page.reload(wait_until="networkidle")
        assert page.get_by_placeholder("예: 성수 A 코너 1층").input_value() == "브라우저 점검"
        return "create → save → reload"

    check("worksheet persistence", worksheet, results)

    def worksheet_delete():
        page.get_by_role("button", name="이 후보 삭제").click()
        page.get_by_role("heading", name="매물 후보를 추가해 주세요.").wait_for()
        page.reload(wait_until="networkidle")
        assert page.get_by_text("브라우저 점검").count() == 0
        return "delete → reload without deleted worksheet"

    check("worksheet deletion", worksheet_delete, results)

    def quiz():
        page.goto(BASE + "#quiz", wait_until="networkidle")
        page.get_by_role("button", name="창업 성향 알아보기").click()
        for index in range(6):
            page.locator(".answer-grid button").first.click()
            page.locator(".question-next").click()
        page.get_by_role("heading", name="지금 정해진 네 가지 기준").wait_for()
        page.get_by_role("button", name="상권 후보 3곳 보기").click()
        page.wait_for_url("**/#recommendations")
        return "six answers → result → recommendations"

    check("quiz and recommendations", quiz, results)

    def save_recommendations():
        page.get_by_role("button", name="3곳을 저장하고 비교하기").click()
        page.get_by_role("heading", name="3개 상권 비교").wait_for()
        page.goto(BASE + "#explore", wait_until="networkidle")
        page.locator(".favorite-card").first.wait_for()
        assert page.locator(".favorite-card").count() >= 3, f"after navigation: {page.locator('.favorite-card').count()}"
        page.reload(wait_until="networkidle")
        assert page.locator(".favorite-card").count() >= 3, f"after reload: {page.locator('.favorite-card').count()}"
        return "three candidates saved, compared, and restored after reload"

    check("candidate save and restore", save_recommendations, results)

    def funding():
        page.goto(BASE + "#funding", wait_until="networkidle")
        assert page.locator(".funding-page").count() == 1
        page.get_by_role("button", name="공식 공고 후보 확인").click()
        page.locator(".funding-result h2").wait_for()
        return "official program query rendered"

    check("official funding", funding, results)

    def reviews():
        page.goto(BASE + "#reviews", wait_until="networkidle")
        page.locator("#review-auto-title").wait_for()
        assert page.locator(".review-shop-search").count() == 1
        assert page.locator(".review-coming").count() == 0
        assert page.locator(".reviews-form").count() == 0
        assert page.locator("textarea").count() == 0
        return "automatic review flow rendered without retired inputs"

    check("automatic review entry", reviews, results)

    def mypage():
        page.goto(BASE + "#mypage", wait_until="networkidle")
        assert page.get_by_role("heading", name="내 기록은 로그인 후에").count() == 1
        return "anonymous account gate"

    check("my page anonymous gate", mypage, results)

    def oauth():
        page.goto(BASE + "#explore", wait_until="networkidle")
        page.get_by_role("button", name="카카오로 저장하기").click()
        page.wait_for_url("**/login/**", timeout=15_000)
        url = unquote(page.url)
        assert urlparse(page.url).hostname == "accounts.kakao.com"
        assert "hngvwhpujtotgoqligji.supabase.co" in url
        return_url = unquote(url[url.find("redirect_to="):].split("&", 1)[0])
        assert return_url == "redirect_to=http://127.0.0.1:5173", f"Unexpected OAuth return URL: {return_url}"
        return "Kakao login page reached; account sign-in not automated"

    check("OAuth redirect", oauth, results)
    results.append({"name": "desktop runtime", "status": "pass" if not page_errors and not api_errors else "fail", "detail": {"page_errors": page_errors, "api_errors": api_errors}})
    context.close()


def audit_mobile(browser, results: list[dict]) -> None:
    context = browser.new_context(viewport={"width": 360, "height": 780}, is_mobile=True, has_touch=True)
    page = context.new_page()
    areas = page.request.get("http://127.0.0.1:8000/api/v1/trade-areas?industry=CS100010").json()
    mobile_compare = f"#compare?codes={areas[0]['code']},{areas[1]['code']}"
    for route in ("", "#explore", mobile_compare, "#quiz", "#worksheet", "#funding", "#reviews", "#mypage"):
        def inspect(route=route):
            page.goto(BASE + route, wait_until="networkidle")
            if route.startswith("#compare"):
                page.get_by_role("heading", name="2개 상권 비교").wait_for()
                assert page.locator(".comparison-scroll").count() == 1
            width = page.evaluate("({scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth})")
            assert width["scroll"] <= width["client"] + 1, width
            assert page.locator("main").count() == 1
            return width
        check(f"mobile {route or 'home'}", inspect, results)

    def mobile_tools():
        page.goto(BASE + "#explore", wait_until="networkidle")
        page.locator(".tools-menu summary").click()
        page.locator(".tools-menu").get_by_role("link", name="공식 정보").click()
        page.wait_for_url("**/#funding")
        return "tools menu opens and navigates"

    check("mobile tools navigation", mobile_tools, results)
    context.close()


def audit_mock_account(browser, results: list[dict]) -> None:
    """Exercise account UI with a fabricated browser session, never a real account."""
    context = browser.new_context(viewport={"width": 1280, "height": 900})
    context.add_init_script("""
      if (location.origin === 'http://127.0.0.1:5173') {
        const user = { id: 'browser-audit-user', aud: 'authenticated', role: 'authenticated',
          app_metadata: { provider: 'kakao', providers: ['kakao'] },
          user_metadata: { nickname: '점검 계정' }, created_at: '2026-01-01T00:00:00Z' };
        if (!sessionStorage.getItem('browser-audit-withdrawn')) {
          localStorage.setItem('sb-hngvwhpujtotgoqligji-auth-token', JSON.stringify({
            access_token: 'e30.eyJleHAiOjQxMDI0NDQ4MDB9.signature', refresh_token: 'browser-audit',
            token_type: 'bearer', expires_at: 4102444800, expires_in: 3600, user
          }));
        }
        if (!sessionStorage.getItem('browser-audit-return-used')) {
          sessionStorage.setItem('golmok-radar:auth-return-hash', '#mypage');
          sessionStorage.setItem('browser-audit-return-used', '1');
        }
      }
    """)
    records = [{
        "record_id": "browser-audit-record", "kind": "founder_profile", "title": "점검용 테스트 결과",
        "payload": {"version": 2, "completedAt": "2026-01-01T00:00:00Z", "answers": {
            "business": "cafe", "demand": "office", "risk": "lean", "operation": "solo",
            "strength": "numbers", "competition": "avoid",
        }}, "schema_version": 2,
        "created_at": "2026-01-01T00:00:00Z", "updated_at": "2026-01-01T00:00:00Z", "source_batch_id": None,
    }]
    failed_record_write = False

    def mock_supabase(route):
        nonlocal failed_record_write
        path = urlparse(route.request.url).path
        method = route.request.method
        if path.endswith("/user_records"):
            if method == "POST":
                if not failed_record_write:
                    failed_record_write = True
                    route.fulfill(status=503, content_type="application/json", body='{"message":"temporary failure"}')
                    return
                changed = route.request.post_data_json
                for index, existing in enumerate(records):
                    if existing["record_id"] == changed["record_id"]:
                        records[index] = changed
                        break
                route.fulfill(status=201, content_type="application/json", body="[]")
                return
            if method == "DELETE":
                records.clear()
                route.fulfill(status=204, body="")
                return
            route.fulfill(status=200, content_type="application/json", body=json.dumps(records))
            return
        route.fulfill(status=200, content_type="application/json", body="[]")

    context.route("https://hngvwhpujtotgoqligji.supabase.co/rest/v1/**", mock_supabase)
    context.route("https://hngvwhpujtotgoqligji.supabase.co/auth/v1/logout**", lambda route: route.fulfill(status=204, body=""))
    page = context.new_page()

    def restored_route():
        page.goto(BASE + "#home", wait_until="networkidle")
        page.wait_for_url("**/#mypage")
        page.get_by_role("heading", name="점검 계정의 준비 기록").wait_for()
        page.get_by_text("카카오 로그인됨").wait_for()
        page.get_by_role("link", name="점검용 테스트 결과").wait_for()
        assert page.get_by_text("저장한 상권이 없습니다.").count() == 1
        return "saved route restored and account UI rendered with mocked session"

    check("mock account route restore", restored_route, results)

    def account_profile_restore():
        page.goto(BASE + "#quiz", wait_until="networkidle")
        page.get_by_role("heading", name="지금 정해진 네 가지 기준").wait_for()
        page.get_by_role("button", name="다시 진단하기").click()
        page.wait_for_url("**/#quiz?restart=1")
        page.locator(".answer-grid button").first.wait_for()
        page.goto(BASE + "#recommendations", wait_until="networkidle")
        page.get_by_role("heading", name="내 답과 잘 맞는 상권 3곳을").wait_for()
        page.goto(BASE + "#mypage", wait_until="networkidle")
        return "stored test, fresh retest, and recommendations reopened from mocked account"

    check("mock account profile restore", account_profile_restore, results)

    def account_record_actions():
        page.once("dialog", lambda dialog: dialog.accept("이름 바꾼 결과"))
        page.get_by_role("button", name="이름 변경").first.click()
        page.get_by_text("이름을 변경하지 못했습니다:", exact=False).wait_for()
        page.get_by_role("link", name="점검용 테스트 결과").wait_for()
        page.once("dialog", lambda dialog: dialog.accept("이름 바꾼 결과"))
        page.get_by_role("button", name="이름 변경").first.click()
        page.get_by_role("link", name="이름 바꾼 결과").wait_for()
        page.once("dialog", lambda dialog: dialog.accept())
        page.get_by_role("button", name="삭제").first.click()
        page.get_by_text("아직 계정에 저장된 테스트 결과가 없습니다.").wait_for()
        return "failed rename feedback, retry, and delete through mocked account API"

    check("mock account record actions", account_record_actions, results)

    account_delete_calls = 0

    def mock_account_delete(route):
        nonlocal account_delete_calls
        account_delete_calls += 1
        if account_delete_calls == 1:
            route.fulfill(status=403, content_type="application/json", body=json.dumps({"detail": {"stage": "reauthentication", "message": "Reauthentication required"}}))
        else:
            route.fulfill(status=200, content_type="application/json", body='{"status":"deleted","scope":"records"}')

    context.route("**/api/v1/account/records", mock_account_delete)

    def account_bulk_delete():
        page.goto(BASE + "#mypage", wait_until="networkidle")
        page.evaluate("localStorage.setItem('golmok-radar:favorites:v1', '[\"3120052\"]')")
        page.locator(".account-management-actions button").first.click()
        page.locator(".account-management-confirm input").fill("전체 삭제")
        page.locator(".account-management-confirm button").first.click()
        page.get_by_text("Reauthentication required").wait_for()
        assert page.locator(".account-management > button").count() >= 2
        with page.expect_navigation(wait_until="networkidle"):
            page.locator(".account-management-confirm button").first.click()
        assert account_delete_calls == 2
        assert page.evaluate("localStorage.getItem('golmok-radar:favorites:v1')") is None
        return "reauthentication error shown; confirmed server deletion clears account cache"

    check("mock account bulk deletion", account_bulk_delete, results)

    def account_logout():
        page.goto(BASE + "#worksheet", wait_until="networkidle")
        page.get_by_role("button", name="+ 매물 후보 추가").click()
        page.get_by_placeholder("예: 성수 A 코너 1층").fill("계정 전용 매물")
        page.get_by_role("button", name="저장하기").click()
        page.get_by_text("카카오 계정에 저장했습니다.").wait_for()
        page.get_by_role("button", name="로그아웃").click()
        page.get_by_role("heading", name="매물 후보를 추가해 주세요.").wait_for()
        assert page.get_by_text("계정 전용 매물").count() == 0
        page.get_by_role("link", name="내 기록").click()
        page.get_by_role("heading", name="내 기록은 로그인 후에").wait_for()
        return "worksheet cache and account view hidden after sign out"

    check("mock account logout", account_logout, results)

    membership_calls = 0

    def mock_membership_delete(route):
        nonlocal membership_calls
        membership_calls += 1
        if membership_calls == 1:
            route.fulfill(status=502, content_type="application/json", body=json.dumps({"detail": {"stage": "supabase_delete", "message": "Deletion incomplete; retry"}}))
        else:
            route.fulfill(status=200, content_type="application/json", body='{"status":"deleted","scope":"membership","kakao_unlinked":true}')

    context.route("**/api/v1/account/membership", mock_membership_delete)

    def account_withdrawal():
        page.goto(BASE + "#mypage", wait_until="networkidle")
        page.reload(wait_until="networkidle")
        page.locator(".account-management-actions button").last.click()
        page.locator(".account-management-confirm button").last.click()
        assert membership_calls == 0
        page.locator(".account-management-actions button").last.click()
        page.locator(".account-management-confirm input").fill("회원 탈퇴")
        page.locator(".account-management-confirm button").first.click()
        page.get_by_text("Deletion incomplete; retry").wait_for()
        assert page.evaluate("localStorage.getItem('sb-hngvwhpujtotgoqligji-auth-token')") is not None
        page.evaluate("sessionStorage.setItem('browser-audit-withdrawn', '1')")
        with page.expect_navigation(wait_until="networkidle"):
            page.locator(".account-management-confirm button").first.click()
        page.locator(".home-page").wait_for()
        assert membership_calls == 2
        assert page.evaluate("localStorage.getItem('sb-hngvwhpujtotgoqligji-auth-token')") is None
        assert page.url.endswith("/#home")
        return "cancel and partial failure retain account; completed withdrawal clears local session"

    check("mock account withdrawal", account_withdrawal, results)
    context.close()


def audit_automatic_review_for_two_shops(browser, results: list[dict]) -> None:
    """Select two real Kakao cafe results and inspect separate aggregate report requests."""
    context = browser.new_context(viewport={"width": 1280, "height": 900})
    context.add_init_script("""
      if (location.origin === 'http://127.0.0.1:5173') {
        const user = { id: 'review-smoke-user', aud: 'authenticated', role: 'authenticated',
          app_metadata: { provider: 'kakao', providers: ['kakao'] },
          user_metadata: { nickname: '점검 계정' }, created_at: '2026-01-01T00:00:00Z' };
        localStorage.setItem('sb-hngvwhpujtotgoqligji-auth-token', JSON.stringify({
          access_token: 'e30.eyJleHAiOjQxMDI0NDQ4MDB9.signature', refresh_token: 'review-smoke',
          token_type: 'bearer', expires_at: 4102444800, expires_in: 3600, user
        }));
      }
    """)
    context.route("**/rest/v1/**", lambda route: route.fulfill(
        status=201 if route.request.method == "POST" else 200,
        content_type="application/json", body="[]",
    ))
    requested_ids: list[str] = []

    def mock_report(route):
        requested_ids.append(route.request.post_data_json["own"]["id"])
        route.fulfill(status=200, content_type="application/json", body=json.dumps({
            "status": "limited", "area": {"code": "3110135", "name": "공식 상권", "district_name": "서울", "area_type_name": "골목상권"},
            "location_status": "inside", "area_distance_m": 0,
            "own_review_count": 19, "peer_samples": [
                {"label": label, "review_count": count, "same_trade_area": True, "included_in_analysis": count >= 5}
                for label, count in zip("ABCD", (20, 5, 2, 2))
            ],
            "total_review_count": 48, "analyzed_review_count": 44,
            "eligible_place_count": 3, "required_place_count": 3, "required_review_count": 30,
            "topics": [{"topic_key": "taste", "label": "메뉴·맛", "own": {"mentions": 4, "positive": 3, "negative": 1, "neutral": 0},
                        "nearby": {"mentions": 5, "positive": 4, "negative": 1, "neutral": 0}}],
            "insights": [], "failed_labels": [], "captured_at": "2026-11-04T02:00:00+00:00",
            "expires_at": "2027-02-02T02:00:00+00:00", "from_cache": False,
            "source": "kakao", "message": "제한 표본 비교입니다.",
        }, ensure_ascii=False))

    context.route("**/api/v1/captured-review-report", mock_report)
    page = context.new_page()

    def two_shops():
        for query in ("성수 온더", "강남 스타벅스 역삼역점"):
            page.goto(BASE + "#reviews", wait_until="domcontentloaded")
            page.locator("#review-shop-query").fill(query)
            page.locator(".review-shop-search button").click()
            page.locator(".review-shop-results button").first.wait_for(timeout=20_000)
            page.locator(".review-shop-results button").first.click()
            page.locator(".review-area-card").wait_for(timeout=20_000)
            page.locator(".review-run input[type=checkbox]").check()
            page.locator(".review-run button").click()
            page.locator(".review-auto-topics article").first.wait_for(timeout=10_000)
            assert page.locator(".review-auto-counts > div").count() == 5
        assert len(requested_ids) == 2 and len(set(requested_ids)) == 2
        return "two cafe searches → separate area and review requests → limited reports"

    check("automatic review for distinct shops", two_shops, results)
    context.close()


def main() -> int:
    results: list[dict] = []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True, executable_path=CHROME)
        try:
            audit_desktop(browser, results)
            audit_mobile(browser, results)
            audit_mock_account(browser, results)
            audit_automatic_review_for_two_shops(browser, results)
        finally:
            browser.close()
    for result in results:
        print(json.dumps(result, ensure_ascii=False))
    print(f"passed={sum(item['status'] == 'pass' for item in results)} failed={sum(item['status'] == 'fail' for item in results)}")
    return int(any(item["status"] == "fail" for item in results))


if __name__ == "__main__":
    raise SystemExit(main())
