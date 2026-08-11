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
- Exported observation-screen PNGs must embed the small but clearly visible label “启慧研习院-夫朗禾费衍射仿真” in their pixels, positioned away from the central diffraction pattern.
