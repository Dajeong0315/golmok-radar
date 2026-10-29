import { useEffect, useState } from "react";

import App from "./App";
import { parseComparisonCodes } from "./comparison";
import { ComparisonPage } from "./ComparisonPage";
import { FounderQuizPage } from "./FounderQuizPage";
import { loadProfile, SKIPPED_KEY } from "./founderProfile";
import { RecommendationsPage } from "./RecommendationsPage";

export default function Root() {
  const [hash, setHash] = useState(window.location.hash);

  useEffect(() => {
    const update = () => setHash(window.location.hash);
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);

  if (hash.startsWith("#compare")) return <ComparisonPage codes={parseComparisonCodes(hash)} />;
  if (hash.startsWith("#recommendations")) return <RecommendationsPage />;
  const shouldShowQuiz = hash.startsWith("#quiz") || (!loadProfile(localStorage) && localStorage.getItem(SKIPPED_KEY) !== "true");
  return shouldShowQuiz ? <FounderQuizPage /> : <App />;
}
