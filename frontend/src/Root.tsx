import { useEffect, useState } from "react";

import App from "./App";
import { parseComparisonCodes } from "./comparison";
import { ComparisonPage } from "./ComparisonPage";

export default function Root() {
  const [hash, setHash] = useState(window.location.hash);

  useEffect(() => {
    const update = () => setHash(window.location.hash);
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);

  return hash.startsWith("#compare") ? <ComparisonPage codes={parseComparisonCodes(hash)} /> : <App />;
}
