import { useEffect, useState } from "react";

import App from "./App";
import { parseComparisonCodes } from "./comparison";
import { ComparisonPage } from "./ComparisonPage";
import { FounderQuizPage } from "./FounderQuizPage";
import { FundingPage } from "./FundingPage";
import { parseFundingAreaCode } from "./fundingGuides";
import { RecommendationsPage } from "./RecommendationsPage";
import { RentPage } from "./RentPage";
import { ReviewInsightsPage } from "./ReviewInsightsPage";
import { parseRentAreaCode } from "./rentCalculator";
import { PropertyWorksheetPage } from "./PropertyWorksheetPage";
import { HomePage } from "./HomePage";
import { isExplorerHash } from "./routing";

export default function Root() {
  const [hash, setHash] = useState(window.location.hash);

  useEffect(() => {
    const update = () => setHash(window.location.hash);
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const anchor = ["#workflow", "#explorer-title", "#favorites-title"].includes(hash)
        ? document.getElementById(hash.slice(1)) : null;
      if (anchor) anchor.scrollIntoView();
      else window.scrollTo(0, 0);
    });
    return () => cancelAnimationFrame(frame);
  }, [hash]);

  if (hash.startsWith("#compare")) return <ComparisonPage codes={parseComparisonCodes(hash)} />;
  if (hash.startsWith("#recommendations")) return <RecommendationsPage />;
  if (hash.startsWith("#rent")) return <RentPage code={parseRentAreaCode(hash)} />;
  if (hash.startsWith("#worksheet")) return <PropertyWorksheetPage />;

  if (hash.startsWith("#funding")) return <FundingPage code={parseFundingAreaCode(hash)} />;
  if (hash.startsWith("#reviews")) return <ReviewInsightsPage />;
  const shouldShowQuiz = hash.startsWith("#quiz");
  return shouldShowQuiz ? <FounderQuizPage /> : isExplorerHash(hash) ? <App /> : <HomePage />;
}
