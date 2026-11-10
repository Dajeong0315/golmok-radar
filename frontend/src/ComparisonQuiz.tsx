import { useMemo, useState } from "react";

import { buildQuiz, guessFeedback, type QuizQuestion } from "./comparisonQuiz";
import type { ComparisonResponse } from "./types";

/** 비교표를 보기 전에 원할 때만 여는 맞히기 문제. 결과는 저장하지 않습니다. */
export function ComparisonQuiz({ data }: { data: ComparisonResponse }) {
  const questions = useMemo(() => buildQuiz(data), [data]);
  const [open, setOpen] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  if (!questions.length) return null;

  const correct = questions.filter((question) => isCorrect(question, answers[question.id])).length;
  const answered = questions.filter((question) => answers[question.id] !== undefined).length;
  return <section className="compare-quiz" aria-labelledby="compare-quiz-title">
    <div className="compare-quiz__head">
      <div><p className="eyebrow">선택 · 숫자 맞혀 보기</p><h3 id="compare-quiz-title">표를 보기 전에 맞혀 볼까요?</h3></div>
      <button type="button" className="compare-quiz__toggle" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? "닫기" : `맞혀 보기 (${questions.length}문제)`}</button>
    </div>
    {open ? <ol className="compare-quiz__list">
      {questions.map((question) => {
        const answer = answers[question.id];
        return <li key={question.id}>
          <p className="compare-quiz__prompt">{question.prompt}</p>
          {question.kind === "guess" ? <form onSubmit={(event) => { event.preventDefault(); const value = drafts[question.id]?.trim(); if (value && Number.isFinite(Number(value))) setAnswers({ ...answers, [question.id]: value }); }}>
            <label><span className="sr-only">예상 값</span><input inputMode="numeric" value={drafts[question.id] || ""} disabled={answer !== undefined} onChange={(event) => setDrafts({ ...drafts, [question.id]: event.target.value })} placeholder={`예상 ${question.unit} 수`} /></label>
            <button type="submit" disabled={answer !== undefined}>확인</button>
          </form> : <div className="compare-quiz__options" role="group" aria-label="보기">
            {question.options.map((option) => <button type="button" key={option.code} disabled={answer !== undefined} aria-pressed={answer === option.code} className={answer !== undefined && option.code === question.answerCode ? "is-answer" : ""} onClick={() => setAnswers({ ...answers, [question.id]: option.code })}>{option.name}</button>)}
          </div>}
          {answer !== undefined ? <p className="compare-quiz__feedback" role="status">{question.kind === "guess" ? guessFeedback(question, Number(answer)) : `${answer === question.answerCode ? "맞았어요." : "아쉬워요."} ${question.explanation}`}</p> : null}
        </li>;
      })}
    </ol> : null}
    {open && answered === questions.length ? <p className="compare-quiz__summary">{questions.length}문제 중 {correct}문제를 맞혔어요. 정답은 {data.quarter_label} 공식 원천값이며, 아래 표의 ‘근거 보기’에서 출처와 계산식을 확인할 수 있어요.</p> : null}
  </section>;
}

function isCorrect(question: QuizQuestion, answer: string | undefined): boolean {
  if (answer === undefined) return false;
  return question.kind === "guess" ? Number(answer) === question.answer : answer === question.answerCode;
}
