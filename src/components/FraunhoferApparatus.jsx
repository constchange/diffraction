export function FraunhoferApparatus() {
  return (
    <section className="apparatus-section" aria-labelledby="apparatus-title">
      <h2 id="apparatus-title" className="visually-hidden">夫朗禾费衍射实验装置</h2>
      <svg
        className="apparatus-diagram"
        viewBox="0 0 1080 156"
        role="img"
        aria-label="光源发出的光经第一片凸透镜变为平行光，照射衍射屏，再经第二片凸透镜汇聚到光屏"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient id="apparatus-lens" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#234f8f" stopOpacity="0.34" />
            <stop offset="0.48" stopColor="#8eeaff" stopOpacity="0.56" />
            <stop offset="1" stopColor="#326ab5" stopOpacity="0.36" />
          </linearGradient>
          <linearGradient id="apparatus-screen" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#14315d" />
            <stop offset="1" stopColor="#0a1730" />
          </linearGradient>
          <radialGradient id="apparatus-source-glow">
            <stop offset="0" stopColor="#fff7c8" stopOpacity="1" />
            <stop offset="0.28" stopColor="#ffd05e" stopOpacity="0.82" />
            <stop offset="1" stopColor="#ffb23f" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="apparatus-spot-glow">
            <stop offset="0" stopColor="#eaffff" />
            <stop offset="0.28" stopColor="#68eaff" stopOpacity="0.95" />
            <stop offset="1" stopColor="#2f8fff" stopOpacity="0" />
          </radialGradient>
          <filter id="apparatus-soft-glow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="4" />
          </filter>
          <marker id="apparatus-ray-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill="#44dcff" />
          </marker>
        </defs>

        <line className="apparatus-axis" x1="44" y1="67" x2="1032" y2="67" />
        <line className="apparatus-rail" x1="48" y1="119" x2="1030" y2="119" />

        <g className="apparatus-source">
          <rect x="48" y="51" width="57" height="32" rx="7" fill="#0d2346" stroke="#315b94" />
          <path d="M58 51V44H87V51" fill="none" stroke="#315b94" />
          <rect x="99" y="57" width="13" height="20" rx="3" fill="#193b6c" stroke="#4c82c9" />
          <circle cx="112" cy="67" r="21" fill="url(#apparatus-source-glow)" filter="url(#apparatus-soft-glow)" />
          <circle cx="112" cy="67" r="3.6" fill="#fff0a3" />
          <line x1="77" y1="83" x2="77" y2="111" stroke="#315b94" strokeWidth="3" />
          <path d="M58 119H96L91 111H63Z" fill="#112b51" stroke="#315b94" />
        </g>

        <g className="apparatus-lens apparatus-lens-one">
          <path d="M268 23C290 44 290 90 268 111C246 90 246 44 268 23Z" fill="url(#apparatus-lens)" stroke="#5da9ff" strokeWidth="2" />
          <path d="M243 30V20H293V30M243 104V114H293V104" fill="none" stroke="#294f82" strokeWidth="3" />
          <line x1="268" y1="111" x2="268" y2="119" stroke="#315b94" strokeWidth="3" />
        </g>

        <g className="apparatus-aperture">
          <rect x="473" y="24" width="15" height="86" rx="2" fill="url(#apparatus-screen)" stroke="#4478ba" />
          <rect x="472" y="58" width="17" height="18" rx="4" fill="#d8fbff" stroke="#60dcff" />
          <line x1="480.5" y1="110" x2="480.5" y2="119" stroke="#315b94" strokeWidth="3" />
          <path d="M462 119H499" stroke="#315b94" strokeWidth="3" />
        </g>

        <g className="apparatus-lens apparatus-lens-two">
          <path d="M704 23C726 44 726 90 704 111C682 90 682 44 704 23Z" fill="url(#apparatus-lens)" stroke="#5da9ff" strokeWidth="2" />
          <path d="M679 30V20H729V30M679 104V114H729V104" fill="none" stroke="#294f82" strokeWidth="3" />
          <line x1="704" y1="111" x2="704" y2="119" stroke="#315b94" strokeWidth="3" />
        </g>

        <g className="apparatus-output-screen">
          <path d="M927 25L949 34V103L927 110Z" fill="url(#apparatus-screen)" stroke="#5da9ff" strokeWidth="2" />
          <line x1="938" y1="107" x2="938" y2="119" stroke="#315b94" strokeWidth="3" />
          <path d="M918 119H958" stroke="#315b94" strokeWidth="3" />
          <ellipse cx="934" cy="67" rx="15" ry="25" fill="url(#apparatus-spot-glow)" filter="url(#apparatus-soft-glow)" opacity="0.82" />
          <ellipse cx="934" cy="67" rx="3.6" ry="8" fill="#b9f8ff" />
          <ellipse cx="934" cy="50" rx="1.6" ry="4" fill="#58dfff" opacity="0.78" />
          <ellipse cx="934" cy="84" rx="1.6" ry="4" fill="#58dfff" opacity="0.78" />
        </g>

        <g className="apparatus-rays apparatus-rays-source">
          <path d="M115 67L267 38" />
          <path d="M115 67L267 67" />
          <path d="M115 67L267 96" />
        </g>
        <g className="apparatus-rays apparatus-rays-parallel">
          <path d="M270 38H473" />
          <path d="M270 67H473" />
          <path d="M270 96H473" />
        </g>
        <g className="apparatus-rays apparatus-rays-diffracted">
          <path d="M489 67L703 35L928 51" />
          <path d="M489 67H928" />
          <path d="M489 67L703 99L928 83" />
        </g>

        <g className="apparatus-labels">
          <text x="80" y="145">光源</text>
          <text x="268" y="145">凸透镜 L₁</text>
          <text x="480" y="145">衍射屏</text>
          <text x="704" y="145">凸透镜 L₂</text>
          <text x="938" y="145">光屏</text>
        </g>
      </svg>
    </section>
  );
}
