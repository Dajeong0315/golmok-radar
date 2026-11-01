import { useEffect, useState } from "react";

import App from "./App";
import { parseComparisonCodes } from "./comparison";
import { ComparisonPage } from "./ComparisonPage";
import { FounderQuizPage } from "./FounderQuizPage";
import { FundingPage } from "./FundingPage";
import { parseFundingAreaCode } from "./fundingGuides";
import { loadProfile, SKIPPED_KEY } from "./founderProfile";
import { RecommendationsPage } from "./RecommendationsPage";
import { RentPage } from "./RentPage";
import { ReviewInsightsPage } from "./ReviewInsightsPage";
import { parseRentAreaCode } from "./rentCalculator";

export default function Root() {
  const [hash, setHash] = useState(window.location.hash);

  useEffect(() => {
    const update = () => setHash(window.location.hash);
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);

  if (hash.startsWith("#compare")) return <ComparisonPage codes={parseComparisonCodes(hash)} />;
  if (hash.startsWith("#recommendations")) return <RecommendationsPage />;
  if (hash.startsWith("#rent")) return <RentPage code={parseRentAreaCode(hash)} />;
  if (hash.startsWith("#funding")) return <FundingPage code={parseFundingAreaCode(hash)} />;
  if (hash.startsWith("#reviews")) return <ReviewInsightsPage />;
  const shouldShowQuiz = hash.startsWith("#quiz") || (!loadProfile(localStorage) && localStorage.getItem(SKIPPED_KEY) !== "true");
  return shouldShowQuiz ? <FounderQuizPage /> : <App />;
}
