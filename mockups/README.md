# UI mockups

These are wireframes for the Resume Optimiser UI. They're drawn with the real design tokens from the [portfolio website](https://github.com/tmiharja/portfolio-website), so colours, type and spacing are close to final. The layout spec and decisions are in [`../ui-layout.md`](../ui-layout.md).

Each sheet exists as a **PNG**, for quick viewing on GitHub, and as **HTML** (`.html`), which you can open in any browser, zoom and inspect. The numbered red callouts refer to the tables in `ui-layout.md` §4.

| Sheet | What it shows |
|---|---|
| [01 · Upload (landing)](01-upload.png) · [html](01-upload.html) | Hero band with the background-image placeholder, file drop zone, optional JD, privacy notice, "How it works" / "What we score" (desktop + mobile) |
| [02 · Upload states](02-upload-states.png) · [html](02-upload-states.html) | Ready, validation error, daily limit (429), not a resume, something went wrong, partial result / empty sections |
| [03 · Live progress](03-progress.png) · [html](03-progress.html) | Stepper with the parallel JD Matcher row, elapsed timer, early hidden-text warning, cancel |
| [04 · Results](04-results.png) · [html](04-results.html) | Full results dashboard in the 760px column: warning, score ring, dimension bars, job match, feedback accordion, suggested rewrites |
| [05 · Dark mode](05-dark.png) · [html](05-dark.html) | Results (desktop) and landing with the dark hero variant (mobile) |

![Upload](01-upload.png)
![States](02-upload-states.png)
![Progress](03-progress.png)
![Results](04-results.png)
![Dark mode](05-dark.png)

## Notes

- **Hero image**: a striped placeholder until the real image arrives (light and dark variants). Once it's added, the mockups can be regenerated with it.
- **Sample content**: all resume content, company names and file names are fictional.
- **Scope**: these are wireframes. Final components will be built in Phase 4, and small visual differences are expected.

## Regenerating

`generate.mjs` builds every `NN-*.html` and renders the matching `NN-*.png` with Playwright:

```bash
# after Phase 1, @playwright/test (which bundles playwright-core) is installed
node mockups/generate.mjs            # writes into mockups/
CHROMIUM_PATH=/path/to/chrome node mockups/generate.mjs   # use a specific Chromium
```
