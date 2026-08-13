import { ExperimentWorkspace } from "./components/ExperimentWorkspace.jsx";

export function App() {
  const requestedExperiment = typeof window === "undefined"
    ? "fraunhofer"
    : new URLSearchParams(window.location.search).get("experiment") ?? "fraunhofer";
  return <ExperimentWorkspace initialExperiment={requestedExperiment} />;
}
