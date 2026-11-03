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
import { AnonymousSessionNotice } from "./AnonymousSessionNotice";

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

  let page;
  if (hash.startsWith("#compare")) page = <ComparisonPage codes={parseComparisonCodes(hash)} />;
  else if (hash.startsWith("#recommendations")) page = <RecommendationsPage />;
  else if (hash.startsWith("#rent")) page = <RentPage code={parseRentAreaCode(hash)} />;
  else if (hash.startsWith("#worksheet")) page = <PropertyWorksheetPage />;
  else if (hash.startsWith("#funding")) page = <FundingPage code={parseFundingAreaCode(hash)} />;
  else if (hash.startsWith("#reviews")) page = <ReviewInsightsPage />;
  else {
  const shouldShowQuiz = hash.startsWith("#quiz");
    page = shouldShowQuiz ? <FounderQuizPage /> : isExplorerHash(hash) ? <App /> : <HomePage />;
  }
  return <><AnonymousSessionNotice />{page}</>;
}
