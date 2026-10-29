import { useMemo, useState } from "react";

import {
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
  const skip = () => { localStorage.setItem(SKIPPED_KEY, "true"); openExplorer(); };

  if (mode === "intro") {
    return <main className="quiz-shell quiz-intro">
      <div className="quiz-brand"><span className="brand-mark">G</span><span>골목 레이더</span></div>
      <div className="quiz-intro__copy">
        <p className="eyebrow">OFFLINE BUSINESS STARTER</p>
        <h1>어디서 시작할지보다,<br /><em>어떻게 시작하고 싶은지</em> 먼저.</h1>
        <p>여섯 가지 질문으로 원하는 업종과 공간, 운영 성향을 정리해 보세요. 정답을 맞히는 심리 검사가 아니라 상권 후보를 찾기 위한 첫 기준입니다.</p>
        <div className="quiz-actions"><button className="primary-action" onClick={() => setMode("question")}>창업 성향 알아보기 <span>→</span></button><button className="text-action" onClick={skip}>지금은 상권부터 보기</button></div>
      </div>
      <aside className="quiz-intro__meta"><span>6</span><strong>questions</strong><p>약 2분 · 로그인 없이 브라우저에만 저장</p></aside>
    </main>;
  }

  if (mode === "result" && profile) {
    return <main className="quiz-shell quiz-result">
      <header className="quiz-result__header"><div className="quiz-brand"><span className="brand-mark">G</span><span>골목 레이더</span></div><button className="text-action" onClick={startAgain}>다시 진단하기</button></header>
      <section className="result-hero">
        <p className="eyebrow">YOUR STARTER PROFILE</p>
        <h1>{profileTitle(profile.answers)}</h1>
        <p>{answerLabel("business", profile.answers.business)} · {answerLabel("risk", profile.answers.risk)}</p>
        <div className="result-notice">이 결과는 심리 진단이나 창업 성공 예측이 아닙니다. 답변을 상권 탐색 조건으로 정리한 결과이며 언제든 수정할 수 있습니다.</div>
      </section>
      <section className="result-axes" aria-label="창업 성향 결과 상세">
        {FOUNDER_QUESTIONS.map((question, index) => <article key={question.id}>
          <span>0{index + 1}</span><small>{question.eyebrow.split(" · ")[1]}</small><h2>{answerLabel(question.id, profile.answers[question.id])}</h2><p>{question.question}</p>
        </article>)}
      </section>
      <section className="result-next"><div><p className="eyebrow">NEXT PIPELINE</p><h2>이제 조건에 맞는<br />상권 후보를 찾아볼까요?</h2><p>현재 검증된 카페 데이터부터 후보를 좁힙니다. 다른 업종은 성향 결과를 저장하고 데이터 준비 상태를 안내합니다.</p></div><div className="quiz-actions"><button className="primary-action" onClick={openExplorer}>상권 탐색 계속하기 <span>→</span></button><button className="text-action" onClick={() => { setStep(0); setMode("question"); }}>답변 수정하기</button></div></section>
    </main>;
  }

  return <main className="quiz-shell quiz-question">
    <header className="quiz-question__header"><button className="text-action" onClick={step ? () => setStep(step - 1) : () => setMode("intro")}>← 이전</button><div className="quiz-progress" aria-label={`${step + 1}/${FOUNDER_QUESTIONS.length} 진행`}><span style={{ width: `${((step + 1) / FOUNDER_QUESTIONS.length) * 100}%` }} /></div><strong>{String(step + 1).padStart(2, "0")} / 06</strong></header>
    <section className="question-card">
      <p className="eyebrow">{current.eyebrow}</p><h1>{current.question}</h1><p className="question-helper">{current.helper}</p>
      <div className="answer-grid" role="radiogroup" aria-label={current.question}>
        {current.options.map((option, index) => <button role="radio" aria-checked={selected === option.id} className={selected === option.id ? "selected" : ""} onClick={() => choose(option.id)} key={option.id}><span>0{index + 1}</span><strong>{option.label}</strong><i>{selected === option.id ? "✓" : ""}</i></button>)}
      </div>
      <button className="primary-action question-next" disabled={!selected} onClick={next}>{step === FOUNDER_QUESTIONS.length - 1 ? "내 성향 결과 보기" : "다음 질문"}<span>→</span></button>
    </section>
  </main>;
}
