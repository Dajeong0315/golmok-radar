import { useMemo, useState } from "react";

import {
  answerDescription,
  answerLabel,
  DRAFT_KEY,
  FOUNDER_QUESTIONS,
  loadDraft,
  loadProfile,
  PROFILE_KEY,
  PROFILE_VERSION,
  profileTitle,
  SKIPPED_KEY,
  type FounderProfile,
} from "./founderProfile";

type Mode = "intro" | "question" | "result";

export function FounderQuizPage() {
  const existingProfile = loadProfile(localStorage);
  const draft = loadDraft(localStorage);
  const [answers, setAnswers] = useState<Record<string, string>>(existingProfile?.answers || draft);
  const [step, setStep] = useState(Math.min(Object.keys(draft).length, FOUNDER_QUESTIONS.length - 1));
  const [mode, setMode] = useState<Mode>(existingProfile ? "result" : Object.keys(draft).length ? "question" : "intro");

  const current = FOUNDER_QUESTIONS[step];
  const selected = answers[current?.id];
  const profile = useMemo<FounderProfile | null>(() => mode === "result" ? {
    version: PROFILE_VERSION,
    completedAt: existingProfile?.completedAt || new Date().toISOString(),
    answers,
  } : null, [mode, answers]);

  const choose = (answerId: string) => {
    const next = { ...answers, [current.id]: answerId };
    setAnswers(next);
    localStorage.setItem(DRAFT_KEY, JSON.stringify(next));
  };

  const next = () => {
    if (!selected) return;
    if (step < FOUNDER_QUESTIONS.length - 1) {
      setStep(step + 1);
      return;
    }
    const completed: FounderProfile = { version: PROFILE_VERSION, completedAt: new Date().toISOString(), answers };
    localStorage.setItem(PROFILE_KEY, JSON.stringify(completed));
    localStorage.removeItem(DRAFT_KEY);
    localStorage.removeItem(SKIPPED_KEY);
    setMode("result");
  };

  const startAgain = () => {
    localStorage.removeItem(PROFILE_KEY);
    localStorage.removeItem(DRAFT_KEY);
    setAnswers({});
    setStep(0);
    setMode("question");
  };

  const openExplorer = () => { window.location.hash = "top"; };
  const openRecommendations = () => { window.location.hash = "recommendations"; };
  const skip = () => { localStorage.setItem(SKIPPED_KEY, "true"); openExplorer(); };

  if (mode === "intro") {
    return <main className="quiz-shell quiz-intro">
      <div className="quiz-brand"><span className="brand-mark">G</span><span>골목 레이더</span></div>
      <div className="quiz-intro__copy">
        <p className="eyebrow">첫 가게 준비 · 1단계</p>
        <h1>내가 원하는 가게의 모습을 먼저 정리해 보세요.</h1>
        <p>여섯 가지 질문에 답하면 업종, 손님, 비용, 운영 방식을 한 장의 준비 리포트로 정리해 드려요. 정답을 맞히는 검사가 아니라 상권을 찾기 전 생각을 정리하는 과정입니다.</p>
        <div className="quiz-actions"><button className="primary-action" onClick={() => setMode("question")}>창업 성향 알아보기 <span>→</span></button><button className="text-action" onClick={skip}>지금은 상권부터 보기</button></div>
      </div>
      <aside className="quiz-intro__meta"><span>6</span><strong>개의 쉬운 질문</strong><p>약 2분 · 로그인 없이 이 브라우저에만 저장돼요.</p><ol><li>가게 아이디어</li><li>원하는 손님</li><li>시작 비용</li><li>운영 방법</li></ol></aside>
    </main>;
  }

  if (mode === "result" && profile) {
    return <main className="quiz-shell quiz-result">
      <header className="quiz-result__header"><div className="quiz-brand"><span className="brand-mark">G</span><span>골목 레이더</span></div><button className="text-action" onClick={startAgain}>다시 진단하기</button></header>
      <section className="result-hero">
        <div className="result-report-meta"><span>나의 첫 가게 준비 리포트</span><span>{new Date(profile.completedAt).toLocaleDateString("ko-KR")}</span></div>
        <p className="eyebrow">진단 결과</p>
        <h1>{profileTitle(profile.answers)}</h1>
        <p>{answerLabel("business", profile.answers.business)} 가게를 생각하고 있고, {answerLabel("risk", profile.answers.risk)}을 원해요.</p>
        <div className="result-notice"><strong>이 리포트의 쓰임</strong><span>성공 가능성을 예측하는 검사가 아니에요. 내가 고른 답을 상권 탐색 조건으로 정리했으며, 언제든 다시 바꿀 수 있어요.</span></div>
      </section>
      <section className="result-overview" aria-labelledby="result-overview-title">
        <div className="result-section-heading"><div><p className="eyebrow">한눈에 보기</p><h2 id="result-overview-title">지금 정해진 네 가지 기준</h2></div><p>상권 후보를 찾을 때 아래 기준을 먼저 반영해요.</p></div>
        <div className="result-map" role="list">
          {["business", "demand", "operation", "risk"].map((questionId, index) => {
            const question = FOUNDER_QUESTIONS.find((item) => item.id === questionId)!;
            return <article role="listitem" key={questionId}><span>0{index + 1}</span><small>{question.eyebrow.split(" · ")[1]}</small><h3>{answerLabel(questionId, profile.answers[questionId])}</h3><p>{answerDescription(questionId, profile.answers[questionId])}</p></article>;
          })}
        </div>
      </section>
      <section className="result-route" aria-labelledby="route-title">
        <div><p className="eyebrow">다음 순서</p><h2 id="route-title">첫 가게 준비는 이렇게 이어져요.</h2><p>한 번에 결정하지 않아도 괜찮아요. 후보를 찾고, 같은 숫자로 비교한 뒤, 실제 비용을 확인하세요.</p></div>
        <ol><li><span>1</span><strong>후보 찾기</strong><p>내 답과 맞는 상권 3곳을 먼저 봐요.</p></li><li><span>2</span><strong>숫자 비교</strong><p>관심 상권 2~4곳을 같은 기준으로 봐요.</p></li><li><span>3</span><strong>현장 확인</strong><p>숫자로 알 수 없는 유동과 분위기를 확인해요.</p></li><li><span>4</span><strong>비용 확인</strong><p>보증금·월세와 지원 조건을 확인해요.</p></li></ol>
      </section>
      <section className="result-evidence" aria-labelledby="answers-title">
        <div className="result-section-heading"><div><p className="eyebrow">선택 근거</p><h2 id="answers-title">내가 고른 여섯 가지 답</h2></div><p>추천 조건이 왜 만들어졌는지 다시 확인할 수 있어요.</p></div>
        <div className="result-axes">
          {FOUNDER_QUESTIONS.map((question, index) => <article key={question.id}>
            <span>0{index + 1}</span><small>{question.eyebrow.split(" · ")[1]}</small><h3>{answerLabel(question.id, profile.answers[question.id])}</h3><p>{answerDescription(question.id, profile.answers[question.id])}</p>
          </article>)}
        </div>
      </section>
      <section className="result-next"><div><p className="eyebrow">다음 단계</p><h2>내 조건과 맞는 상권 후보를 확인해 보세요.</h2><p>현재는 검증이 끝난 카페 데이터로 후보를 좁혀요. 다른 업종을 골랐다면 결과는 저장하고, 상권은 직접 둘러볼 수 있어요.</p></div><div className="quiz-actions"><button className="primary-action" onClick={openRecommendations}>상권 후보 3곳 보기 <span>→</span></button><button className="text-action" onClick={() => { setStep(0); setMode("question"); }}>답변 수정하기</button></div></section>
    </main>;
  }

  return <main className="quiz-shell quiz-question">
    <header className="quiz-question__header"><button className="text-action" onClick={step ? () => setStep(step - 1) : () => setMode("intro")}>← 이전</button><div className="quiz-progress" aria-label={`${step + 1}/${FOUNDER_QUESTIONS.length} 진행`}><span style={{ width: `${((step + 1) / FOUNDER_QUESTIONS.length) * 100}%` }} /></div><strong>{String(step + 1).padStart(2, "0")} / 06</strong></header>
    <section className="question-card">
      <p className="eyebrow">{current.eyebrow}</p><h1>{current.question}</h1><p className="question-helper">{current.helper}</p>
      <div className="question-why"><strong>왜 묻나요?</strong><span>{current.why}</span></div>
      <div className="answer-grid" role="radiogroup" aria-label={current.question}>
        {current.options.map((option, index) => <button role="radio" aria-checked={selected === option.id} className={selected === option.id ? "selected" : ""} onClick={() => choose(option.id)} key={option.id}><span>0{index + 1}</span><span className="answer-copy"><strong>{option.label}</strong><small>{option.description}</small></span><i>{selected === option.id ? "✓" : ""}</i></button>)}
      </div>
      <button className="primary-action question-next" disabled={!selected} onClick={next}>{step === FOUNDER_QUESTIONS.length - 1 ? "내 성향 결과 보기" : "다음 질문"}<span>→</span></button>
    </section>
  </main>;
}
