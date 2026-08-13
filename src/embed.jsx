import React from "react";
import { createRoot } from "react-dom/client";
import { FraunhoferLab } from "./components/FraunhoferLab.jsx";
import { ExperimentWorkspace } from "./components/ExperimentWorkspace.jsx";
import labStyles from "./styles.css?inline";
import katexStyles from "katex/dist/katex.min.css?inline";

const STYLE_ID = "fraunhofer-lab-embed-styles";
const mountedRoots = new WeakMap();

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `${katexStyles}\n${labStyles}`;
  document.head.append(style);
}

/**
 * Mount the simulator into any host element.
 * Returns an unmount function so a parent application can cleanly dispose it.
 */
export function mountFraunhoferLab(element, options = {}) {
  if (!(element instanceof Element)) {
    throw new TypeError("mountFraunhoferLab 需要一个有效的 DOM Element");
  }
  ensureStyles();
  mountedRoots.get(element)?.unmount();
  const root = createRoot(element);
  const lab = (
    <FraunhoferLab
      compact={Boolean(options.compact)}
      communityApiBase={options.communityApiBase || "/api/community-apertures"}
    />
  );
  root.render(options.strict ? <React.StrictMode>{lab}</React.StrictMode> : lab);
  mountedRoots.set(element, root);
  return () => {
    root.unmount();
    mountedRoots.delete(element);
  };
}

export function mountOpticsWorkspace(element, options = {}) {
  if (!(element instanceof Element)) {
    throw new TypeError("mountOpticsWorkspace 需要一个有效的 DOM Element");
  }
  ensureStyles();
  mountedRoots.get(element)?.unmount();
  const root = createRoot(element);
  const workspace = (
    <ExperimentWorkspace
      compact={Boolean(options.compact)}
      communityApiBase={options.communityApiBase || "/api/community-apertures"}
      initialExperiment={options.initialExperiment || "fraunhofer"}
    />
  );
  root.render(options.strict ? <React.StrictMode>{workspace}</React.StrictMode> : workspace);
  mountedRoots.set(element, root);
  return () => {
    root.unmount();
    mountedRoots.delete(element);
  };
}

export { ExperimentWorkspace, FraunhoferLab };

if (typeof window !== "undefined") {
  window.FraunhoferLabEmbed = { mountFraunhoferLab, mountOpticsWorkspace };
}
