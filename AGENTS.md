# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

## Durable design decisions

- The Fraunhofer simulator uses the original dark indigo visual direction as its source of truth: immersive optical bench, central experiment, and a slim right inspector.
- Keep the simulator shell focused on the experiment. Do not restore fake navigation, login/profile content, streaks, or placeholder product areas. The top title is “启慧研习院 · 夫朗禾费衍射仿真”.
- Keep the physical Fraunhofer apparatus diagram above the simulator, in this order: source, collimating convex lens, aperture screen, Fourier convex lens, observation screen.
- Do not merge the separate pale-blue “引力场” dashboard direction into this simulator. That visual direction is reserved for a different product surface.
- Keep the scientific canvas genuinely interactive and computation-backed; do not substitute pre-rendered diffraction imagery for the FFT result.
- Keep community uploads behind same-origin EdgeOne Functions. Never expose the Supabase Secret/Service Role key or raw client IP in frontend code or stored rows.
- Exported observation-screen PNGs are fixed at 1024×1024 pixels and must embed the exact label “夫朗禾费衍射仿真 (c)2026, Qi Hui Academy” in their pixels, positioned away from the central diffraction pattern. Render it as modest but clearly visible frameless text in an elegant Times-style italic serif font with suitable CJK serif fallbacks.
- First-time visitors get a concise seven-step, per-IP onboarding tour. Its visual guide is a white optical light point with a cyan/blue/violet/gold dispersion trail orbiting the active control.
- Keep public upload capacity visually quiet: expose upload positions through a compact dropdown, without advertising the total limit in tabs, headings, or helper copy.
- The main webpage is an extensible wave-optics workspace: Fraunhofer diffraction, 4f spatial filtering, and Fresnel diffraction are peer tabs. Keep each experiment's scientific controls and state independent.
- The Fresnel experiment uses a genuinely computed paraxial transfer-function propagation with zero-padded FFT sampling. Keep wavelength, free-space propagation distance, and physical aperture-plane width adjustable, and preserve the continuous near-field evolution rather than substituting far-field imagery.
- Keep calibrated physical coordinates visible across all three experiments: Fraunhofer input calibration and observation-plane millimetres, spatial-filter object/image millimetres and Fourier-plane reciprocal millimetres, and Fresnel input/output millimetres tied to the adjustable plane width.
- Spatial-filtering and Fresnel pages include compact, instrument-like apparatus diagrams above their work areas. Apparatus rays and spots must track the actual selected monochromatic wavelength in real time.
- Wavelength selection is performed directly on the rainbow spectrum strip with one enlarged white marker; do not restore a second redundant range track beneath it.
- The spatial-filtering experiment uses the same dark indigo visual system, but its core layout is a distinct three-stage object plane → Fourier/filter plane → image plane workflow.
- Spatial filtering reuses the Fraunhofer aperture editor's 256×256 anti-aliased drawing model for its object plane. Its Fourier-plane editor deliberately stays smaller: pencil, circle, eraser, fully blocked, and fully open, while preserving the scientific filter presets.
- Treat the spatial-filter editor as a visible central window into a larger padded FFT plane. Drawn masks affect that visible window while outside high frequencies retain their transmission; the sole “fully blocked” action must instead block the entire infinite Fourier plane so the image plane is exactly dark.
- In spatial filtering, the object-plane and Fourier-plane canvases must share the same top-left offset vector from their respective drawing toolbars. Keep both canvases clear of the tools and module edges; the Fourier pencil, circle, and eraser form a vertical tool strip.
- The spatial-filter preset panel belongs directly below the Fourier-plane editor. Keep only spectrum visibility and undo in the upper utility row, with a separate orderly preset grid below for all filters, including fully open and fully blocked across the infinite plane. “Fully open” must have only one entry, and do not restore a separate “block visible window” action.
- In the Fraunhofer editor's bottom utility row, keep “常用库 / 创意中心 / 本地存取” grouped on the left and “撤销 / 清空画布” grouped on the far right. The first two are discovery entrances and should use an inviting warm-gold visual language rather than cold-color gradients. Common-library entries always load as editable screen functions.
- Loading any Fraunhofer common-library screen function resumes live diffraction automatically. Automatic pausing is reserved exclusively for a user's manual change inside the screen-function textarea; opening or loading libraries/storage/community content must never trigger it.
- The onboarding tour is single-use through both the server-side hashed-IP claim and a browser-local seen marker. If the local marker says the site was already visited, do not request or show onboarding again.
- Every physical or Fourier plane uses one calibrated annotation system: KaTeX-rendered axis symbols, units, and tick values stay outside the image frame; the scale bar stays inside. Axis labels use the same compact type size as tick labels. Use an exact `1 mm` scale on real-space planes and an unambiguous `1 (mm^{-1})` scale on reciprocal-space planes.
