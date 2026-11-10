from __future__ import annotations

"""Private, low-volume browser capture for Phase 17.

This module is backend/CLI-only. It never exposes source page URLs, raw review
text, place names, or encryption material to the frontend or application logs.
"""

from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal

from cryptography.fernet import Fernet

from .review_analysis import sanitize_review_text


Provider = Literal["naver", "kakao"]
MAX_PLACES_PER_RUN = 10
MAX_REVIEWS_PER_PLACE = 40
MAX_REVIEWS_PER_RUN = MAX_PLACES_PER_RUN * MAX_REVIEWS_PER_PLACE


@dataclass(frozen=True)
class CaptureTarget:
    provider: Provider
    public_url: str
    peer_label: str


@dataclass(frozen=True)
class CapturedReview:
    provider: Provider
    peer_label: str
    redacted_text: str
    encrypted_text: bytes
    fetched_at: datetime


@dataclass(frozen=True)
class CaptureBatch:
    reviews: list[CapturedReview]
    failed_labels: list[str]


class CaptureConfigurationError(ValueError):
    pass


def cipher_from_key(key: str | None) -> Fernet:
    if not key:
        raise CaptureConfigurationError("REVIEW_CAPTURE_ENCRYPTION_KEY is required for review capture.")
    try:
        return Fernet(key.encode("utf-8"))
    except (TypeError, ValueError) as error:
        raise CaptureConfigurationError("REVIEW_CAPTURE_ENCRYPTION_KEY must be a valid Fernet key.") from error


def validate_targets(targets: list[CaptureTarget]) -> None:
    if not 1 <= len(targets) <= MAX_PLACES_PER_RUN:
        raise ValueError(f"A capture run must contain 1 to {MAX_PLACES_PER_RUN} places.")
    labels = [target.peer_label for target in targets]
    if len(set(labels)) != len(labels):
        raise ValueError("Each target must have a unique peer label.")
    for target in targets:
        if target.provider not in ("naver", "kakao"):
            raise ValueError("Only Naver and Kakao public review pages are supported.")
        if not target.public_url.startswith("https://"):
            raise ValueError("Capture targets must use public HTTPS URLs.")


def configured_browser_path() -> str | None:
    from .config import get_settings

    path = (get_settings().review_capture_browser_path or "").strip()
    # 예시 문장이 값으로 남아 있는 등 실제 파일이 아니면 무시하고 Playwright 기본 브라우저를 씁니다.
    return path if path and Path(path).is_file() else None


class PublicReviewBrowserCollector:
    """Captures rendered review text only; it does not call private APIs or authenticate."""

    _selectors: dict[Provider, tuple[str, ...]] = {
        "naver": (".pui__vn15t2", ".place_section_content .zPfVt"),
        "kakao": (".desc_review", ".txt_review", ".txt_comment", ".comment_info .txt_comment"),
    }

    def __init__(self, encryption_key: str | None, executable_path: str | None = None) -> None:
        self._cipher = cipher_from_key(encryption_key)
        # 서버(Linux)에서는 `.env`의 REVIEW_CAPTURE_BROWSER_PATH, 없으면 `playwright install chromium`으로 받은 브라우저를 씁니다.
        self._executable_path = executable_path or configured_browser_path() or self._find_local_browser()

    @staticmethod
    def _find_local_browser() -> str | None:
        candidates = (
            r"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
            r"C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
        )
        return next((candidate for candidate in candidates if Path(candidate).is_file()), None)

    def capture(self, targets: list[CaptureTarget]) -> list[CapturedReview]:
        return self.capture_with_failures(targets).reviews

    def capture_with_failures(self, targets: list[CaptureTarget]) -> CaptureBatch:
        validate_targets(targets)
        try:
            from playwright.sync_api import Error as PlaywrightError, sync_playwright
        except ImportError as error:
            raise CaptureConfigurationError("Playwright is required. Install backend requirements first.") from error

        captured: list[CapturedReview] = []
        failed_labels: list[str] = []
        with sync_playwright() as playwright:
            try:
                browser = playwright.chromium.launch(
                    headless=True,
                    executable_path=self._executable_path,
                )
            except PlaywrightError as error:
                # 브라우저가 설치되지 않은 서버에서는 500 대신 ‘설정 준비 안 됨’(503)으로 안내합니다.
                raise CaptureConfigurationError("Review capture browser is not available on this server.") from error
            try:
                page = browser.new_page()
                for target in targets:
                    try:
                        response = page.goto(target.public_url, wait_until="domcontentloaded", timeout=30_000)
                        if response is None or response.status >= 400:
                            failed_labels.append(target.peer_label)
                            continue
                        self._open_review_section(page, target.provider)
                        text_values = self._read_public_review_text(page, target.provider)
                    except PlaywrightError:
                        failed_labels.append(target.peer_label)
                        continue
                    for text in text_values[:MAX_REVIEWS_PER_PLACE]:
                        redacted = sanitize_review_text(text)
                        if not redacted:
                            continue
                        captured.append(CapturedReview(
                            provider=target.provider,
                            peer_label=target.peer_label,
                            redacted_text=redacted,
                            encrypted_text=self._cipher.encrypt(redacted.encode("utf-8")),
                            fetched_at=datetime.now(timezone.utc),
                        ))
                        if len(captured) >= MAX_REVIEWS_PER_RUN:
                            return CaptureBatch(captured, failed_labels)
            finally:
                browser.close()
        return CaptureBatch(captured, failed_labels)

    @staticmethod
    def _open_review_section(page, provider: Provider) -> None:
        if provider != "kakao":
            return
        page.wait_for_timeout(1_500)
        review_link = page.locator(".link_reviewall")
        if review_link.count() == 0:
            return
        review_link.first.click(timeout=5_000)
        page.wait_for_timeout(1_000)

    def _read_public_review_text(self, page, provider: Provider) -> list[str]:
        for selector in self._selectors[provider]:
            locator = page.locator(selector)
            if locator.count() == 0:
                continue
            texts = [text.strip() for text in locator.all_text_contents()]
            visible = [text for text in texts if text]
            if visible:
                return visible
        return []
