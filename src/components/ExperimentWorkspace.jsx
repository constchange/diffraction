import { useState } from "react";
import { Aperture } from "@phosphor-icons/react/Aperture";
import { Funnel } from "@phosphor-icons/react/Funnel";
import { FraunhoferLab } from "./FraunhoferLab.jsx";
import { SpatialFilteringLab } from "./SpatialFilteringLab.jsx";

const EXPERIMENTS = [
  { id: "fraunhofer", label: "夫朗禾费衍射", eyebrow: "远场衍射", Icon: Aperture },
  { id: "spatial-filter", label: "空间滤波", eyebrow: "4f 傅里叶光学", Icon: Funnel },
];

export function ExperimentWorkspace({ compact = false, communityApiBase = "/api/community-apertures", initialExperiment = "fraunhofer" }) {
  const [activeExperiment, setActiveExperiment] = useState(
    EXPERIMENTS.some((item) => item.id === initialExperiment) ? initialExperiment : "fraunhofer",
  );

  return (
    <div className="experiment-workspace-root">
      <header className="workspace-topbar">
        <div className="workspace-brand">
          <strong>启慧研习院 · {activeExperiment === "fraunhofer" ? "夫朗禾费衍射仿真" : "空间滤波仿真"}</strong>
          <span>波动光学实验室</span>
        </div>
        <nav className="experiment-tabs" aria-label="选择光学实验">
          {EXPERIMENTS.map(({ id, label, eyebrow, Icon }) => (
            <button key={id} type="button" className={activeExperiment === id ? "active" : ""} onClick={() => setActiveExperiment(id)}>
              <Icon size={18} weight={activeExperiment === id ? "fill" : "duotone"} />
              <span><small>{eyebrow}</small><strong>{label}</strong></span>
            </button>
          ))}
        </nav>
        <div className="workspace-series"><span>系列实验</span><strong>02</strong><small>/ 未来 03</small></div>
      </header>
      <main className="workspace-content">
        <div hidden={activeExperiment !== "fraunhofer"}>
          <FraunhoferLab compact={compact} communityApiBase={communityApiBase} embeddedInWorkspace workspaceActive={activeExperiment === "fraunhofer"} />
        </div>
        {activeExperiment === "spatial-filter" && <SpatialFilteringLab />}
      </main>
    </div>
  );
}
