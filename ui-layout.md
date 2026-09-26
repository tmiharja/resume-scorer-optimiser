# UI layout: Agentic Resume Optimiser

Status: **draft for review.** This covers screen layout, content and states for Phase 4 (UI). The visual style follows [`PLAN.md` §13](PLAN.md#13-look-and-feel-requirement): minimal, matching the [portfolio website](https://github.com/tmiharja/portfolio-website).

The wireframes in `docs/ui/` are rendered with the real design tokens, so colours, type and spacing are close to final. Copy is a first draft. Sample resume content is fictional.

---

## 1. Design principles

1. **One column, lots of air.** Every screen uses the portfolio's centred 680px column with generous spacing between sections. There are no sidebars or multi-column dashboards.
2. **Rules, not cards.** Sections are separated by whitespace, and lists by 1px hairlines. There are no shadows, gradients or decorative images.
3. **One accent colour.** Navy `#1f4e79` (light) / `#8fb4dc` (dark) marks everything interactive and all data: buttons, links, score ring, bars, matched keywords.
   - Amber is only for warnings and red only for errors.
   - Meaning is always carried by a text label as well as colour.
4. **Typography does the work.** The hierarchy is: a large, medium-weight headline, 24px section headings, 15–17px body, and muted grey for secondary text.
5. **Calm, honest states.** Every loading, empty, error and limit state gets a plain-English message and a single clear next action.

## 2. Design tokens

| Token | Light | Dark | Use |
|---|---|---|---|
| `--background` | `#fbfbf9` | `#131416` | page |
| `--foreground` | `#1a1a1a` | `#e8e6e1` | body text, headings |
| `--muted` | `#5f5f5f` | `#9a9a94` | secondary text, labels, meta |
| `--rule` | `#e6e4df` | `#2a2c30` | hairlines, input borders, bar tracks |
| `--accent` | `#1f4e79` | `#8fb4dc` | buttons, links, ring, bars, matched chips |
| `--accent-soft` | `#eef3f8` | `#1b2733` | chip/placeholder fills, info notice, hover |
| `--warn` / `--warn-soft` | `#8a5a00` / `#faf3e3` | `#e0b25c` / `#2a2418` | hidden-text warning, partial result, MEDIUM severity |
| `--danger` / `--danger-soft` | `#9b2c2c` / `#fbeeee` | `#e38b8b` / `#2c1c1c` | validation errors, HIGH severity |

The first six tokens are copied verbatim from the portfolio. `warn` and `danger` are new. Every text/background pair above meets WCAG AA: the lowest is warn on warn-soft at 5.4:1.

**Type scale** (Helvetica stack, no web fonts):

| Element | Size and weight |
|---|---|
| Hero h1 | 40px (mobile) → 48px (≥ 640px), medium |
| Page h1 | 30–32px |
| Section h2 | 24px semibold |
| Body | 15px |
| Lead | 17px |
| Meta | 13px |
| Micro-labels | 11–13px uppercase, letter-spaced |

**Spacing**:
- Column `max-width: 680px`, 24px side padding.
- About 72px between sections.
- About 16px vertical padding inside list rows.

**Radius**: 6–10px on inputs, buttons and notices. Chips are pills.

---

## 3. Site shell

The header and footer are the same on every screen.

- **Header** (mirrors the portfolio):
  - Left: the "Resume Optimiser" wordmark, which is also the home link.
  - Right: "How it works" (hidden below 640px), "Privacy" and the theme toggle.
  - It starts transparent. Once the page scrolls it gets a frosted background and a hairline bottom rule.
  - It includes a skip link to `#main`.
- **Footer**: a hairline rule, then "Privacy", "Built by Toni Miharja" (links to the portfolio) and "© 2026" in 13px muted text.
- **Routes**:
  - `/`: the whole app flow. Upload, progress and results are **states of one page**, not separate routes.
  - `/privacy`: a plain long-form text page in the same column.

## 4. Screens

### 4.1 Upload (landing)

![Upload screen](docs/ui/01-upload.png)

| # | Element | Spec |
|---|---|---|
| 1 | Header | As in §3. |
| 2 | Hero | h1 "Get your resume ready for Singapore recruiters." Lead (muted): "Upload a PDF. In about a minute you'll get a score, specific feedback and stronger bullet points. Free, no sign-up." No hero image. |
| 3 | File drop zone | Dashed hairline box, about 140px tall. "Drop your resume here, or **browse files**". Helper: "PDF only · up to 4 MB · up to 4 pages". The whole zone is a `<button>` that opens a hidden `<input type="file" accept="application/pdf">`, and it also accepts drag-and-drop. Once a file is chosen it turns into a file row (icon, name, size, "Remove"). |
| 4 | Job description | Label "Job description (optional)". Textarea, about 6 rows, placeholder "Paste the job ad here". Helper on the left ("Adds a match score and tailors the rewrites"); live counter on the right ("0 / 8,000"). The counter turns red over the limit. |
| 5 | Primary action | "Analyse resume" in a solid accent button. Full width on mobile, auto width on desktop. Disabled until a valid file is chosen. "5 free analyses a day" sits next to it in muted text. |
| 6 | Privacy notice | Below a hairline, 13px muted: "We don't store your resume. We keep anonymised stats (e.g. role type, seniority, scores) to improve the tool. Your resume is processed by Anthropic's Claude API and isn't used for training. **Privacy details**" (links to `/privacy`). |
| 7 | How it works / What we score | Two short sections using the portfolio's two-column list pattern: a 140px label column plus text on desktop, stacked on mobile. They explain the three steps and the five scored dimensions. |

### 4.2 Upload states

![Upload states](docs/ui/02-upload-states.png)

| State | Trigger | Treatment |
|---|---|---|
| **A · Ready** | Valid file, optional JD | File row replaces the drop zone. Button enabled. |
| **B · Validation error** | Client check, or a server 413/415/422 | Drop zone border turns red. Inline message below it, with `role="alert"`, in plain words and with a fix. See the message table in §6. |
| **C · Daily limit (429)** | Rate limit hit | An info notice (accent-soft background) *replaces* the form's top: "You've used today's 5 free analyses. You can analyse again after **3:42 pm** (in 5 h 12 min)." The time comes from `resetAt` and is shown in the user's local time. The drop zone and button are dimmed and disabled. |
| **D · Not a resume** | Extractor `isResume=false` | Page h1 "This doesn't look like a resume", a one-line reason, and a "Try another file" button. |
| **E · Something went wrong** | Critical step failed, timeout or network drop | h1 "We couldn't finish the analysis", a line saying it's on our side, then "Try again" (primary) and "Start over" (link). |
| **F · Partial result / empty sections** | Non-critical step failed, or no JD | Amber notice at the top of the results: "Some parts couldn't be completed…". Affected sections show a one-line muted empty state instead of disappearing. |

The monthly-budget 503 uses the same layout as C: "We've reached this month's capacity. The tool will be back on 1 October."

### 4.3 Live progress

![Progress screen](docs/ui/03-progress.png)

| # | Element | Spec |
|---|---|---|
| 1 | Meta row | Muted "resume-2026.pdf · 2 pages · with job description" on the left. Elapsed timer on the right ("0:27", tabular numbers, ticking every second). |
| — | Heading | h1 "Analysing your resume", with the muted line "Usually about a minute. Keep this tab open." |
| 2 | Early warning | If the ingest heuristics flagged hidden text, the amber notice appears **here, straight away**, before the LLM steps finish. |
| 3 | Stepper | A vertical list of hairline rows. Each row has a status marker, a label, a muted sub-line and the step's duration on the right. Steps: **Parsing** → **Critiquing** → **Matching job description** (only with a JD; indented with a dashed guide and "Running in parallel") → **Rewriting bullet points** → **Verifying rewrites**. |
| 4 | Cancel | Link "Cancel", followed by muted "· cancelling still uses one of today's analyses". Aborts the fetch and returns to the upload screen with the file still selected. |

**Step markers**:

| State | Marker |
|---|---|
| Pending | Hollow hairline circle; label in muted text |
| Active | Accent ring with a softly pulsing dot (static under reduced motion) |
| Done | Filled accent circle with ✓ |
| Skipped | Hollow circle with "–"; sub-line "Skipped: no job description" |
| Error | Red "!" marker; sub-line "Couldn't complete. Continuing without it." for non-critical steps |

Parsing covers two SSE steps, `parse` and `extract`. The stepper is an `aria-live="polite"` region that announces step changes, not timer ticks.

### 4.4 Results dashboard

![Results dashboard](docs/ui/04-results.png)

Results replace the progress view in the same column. Focus moves to the results heading. Sections fade in one after another.

| # | Section | Spec |
|---|---|---|
| — | Meta row | Muted "Results · resume-2026.pdf" on the left. "Analyse another" link on the right. |
| 1 | Red-flag notice | Only shown when needed. Amber left-rule notice: "Your PDF contains hidden text". It quotes the first finding (truncated to about 80 characters) and explains that ATS and recruiters flag this, so the user should remove it, and that scores ignore it. "Show all N findings" expands the list. Extractor instruction-like findings (`injectionSuspected`) are shown the same way. |
| 2 | Score overview | A 132px **score ring**: accent arc on a rule-coloured track, big number in the middle, "out of 100" beneath. Next to it (stacked on mobile) is a one-line verdict h1 and a muted sentence naming the strongest dimension and the biggest opportunity. |
| 3 | Dimension bars | Five hairline rows. Desktop: label (200px), 6px bar, score on the right. Mobile: label and score on one line, bar below. Rows follow the rubric order, so they stay in the same place across runs. |
| 4 | Job match | Only shown with a JD. A large "64%" with a one-line summary, then four parts:<br>• **Matched · N**: accent-soft pills.<br>• **Missing · N**: dashed outline pills in muted text.<br>• **Top priorities**: numbered list of 3.<br>• **Experience gaps**: bullet list.<br>Without a JD, this becomes a muted line: "Add a job description next time to see how well you match a specific role." |
| 5 | Feedback | Accordion built on `<details>`, one row per dimension: chevron, name, "4 issues · 2 high", score. **The lowest-scoring dimension is open by default.** Items are sorted HIGH → MEDIUM → LOW. Each item shows:<br>• a severity micro-label (coloured dot + text);<br>• the issue (medium weight);<br>• the fix (muted);<br>• a citation block with a left rule: section · role, company · bullet N, plus the quoted original bullet.<br>A dimension with no items shows "Nothing to fix here." |
| 6 | Suggested rewrites | A muted intro: "Replace placeholders like [X%] with your real numbers. We never add facts that aren't in your resume." Then one hairline row per rewrite:<br>• ORIGINAL micro-label and muted text;<br>• SUGGESTED micro-label (accent) and the text, with placeholders shown as accent-soft tokens;<br>• a **Copy** button that copies the plain text and changes to "✓ Copied" for 2 s (plus a polite live-region announcement).<br>If the Verifier failed, an amber "Unverified" badge sits next to the section heading. If every rewrite was dropped, the section shows "No rewrites passed our fact check this time." |
| — | End | Secondary outline button "Analyse another resume". Footer. |

The verdict line comes from score bands defined in code, not the LLM:

| Score | Verdict |
|---|---|
| 0–49 | "Needs work" |
| 50–69 | "Fair" |
| 70–84 | "Good" |
| 85–100 | "Strong" |

### 4.5 Dark mode

![Dark mode](docs/ui/05-dark.png)

Dark mode uses the same layout with the portfolio's dark tokens. It follows `prefers-color-scheme` by default. The header toggle overrides this and saves the choice in `localStorage`, and an inline script in `<head>` prevents a flash of the wrong theme.

---

## 5. Responsive behaviour

| Breakpoint | Behaviour |
|---|---|
| < 640px (mobile, designed first) | Everything stacked. Full-width primary buttons. Score ring above the verdict. Dimension score beside the label, with the bar underneath. Rewrite copy button below the suggestion. "How it works" hidden from the header. |
| ≥ 640px | Two-column list rows (140px label column). Ring beside the verdict. Dimension rows are label · bar · score. Auto-width buttons. The copy button sits to the right of the suggestion. |
| ≥ 1024px | Nothing changes. The column stays at 680px (a deliberate choice for minimalism). |

## 6. Copy for validation messages

| Case | Message |
|---|---|
| Not a PDF | "That's a .docx file. Please upload a PDF: most editors can export one via File → Save as PDF." |
| Too large | "That file is 6.2 MB. The limit is 4 MB. Try exporting it again with smaller images." |
| Too many pages | "Your resume is 5 pages. We accept up to 4. Most Singapore resumes are 1–2 pages." |
| Encrypted | "This PDF is password-protected. Remove the password and upload it again." |
| Image-only / scanned | "We couldn't find any text. It looks like a scanned image. Please upload a PDF exported from your editor." |
| JD too long | "The job description is over 8,000 characters. Trim it to the role summary and requirements." |

## 7. Accessibility

- All inputs have visible `<label>`s. Helper and error text are linked through `aria-describedby`.
- The drop zone is a real button, so it's keyboard-operable (Enter/Space opens the file picker).
- Focus handling:
  - Visible focus ring everywhere: 2px accent outline, 3px offset, as on the portfolio.
  - Focus moves to the results `h1` when results arrive, and to the message when an error happens.
- `aria-live="polite"` on the stepper, the copy confirmation and the rate-limit notice. `role="alert"` on validation errors.
- The ring and bars have `role="img"` plus an `aria-label` ("Overall score 70 out of 100"). Every score is also printed as text.
- Severity and match state use text as well as colour: HIGH/MEDIUM/LOW labels, and "Matched"/"Missing" group headings.
- Contrast is AA or better for all text on both themes. Muted `#5f5f5f` on `#fbfbf9` is 6.2:1, and the lowest pair (warn on warn-soft) is 5.4:1.
- `prefers-reduced-motion` turns off the fade-ins, the pulse and smooth scrolling.

## 8. Motion

Motion stays subtle, as on the portfolio:
- Sections fade up 12px over 0.35 s ease-out, staggered by 50 ms.
- The active step marker pulses gently.
- Bars and the ring fill once, over 0.6 s, on first render.

There is nothing else: no page transitions and no confetti.

## 9. Component map

| UI element | Component (`src/components/`) | Notes |
|---|---|---|
| Header / footer / theme toggle | `site-header.tsx`, `site-footer.tsx`, `theme-toggle.tsx` | Ported from the portfolio pattern |
| Drop zone + JD + button | `upload-form.tsx` | shadcn `Button`, `Textarea`, `Label` restyled |
| Privacy text | `privacy-notice.tsx` | |
| Stepper | `progress-stepper.tsx` | Driven by the `use-analysis` state machine |
| Notices (warn / info / error) | `notice.tsx` | One component with `tone` = `warn` \| `info` \| `danger` |
| Score ring | `score-ring.tsx` | Plain SVG, no chart library |
| Dimension bars | `dimension-bars.tsx` | Plain HTML/CSS |
| Job match | `jd-match.tsx` | Chips are plain spans |
| Feedback accordion | `feedback-list.tsx` | Native `<details>`/`<summary>` or shadcn `Collapsible` |
| Rewrites | `rewrites-list.tsx` | Clipboard API with a fallback |
| 429 / 503 / error screens | `rate-limit-notice.tsx`, `error-state.tsx` | |

## 10. Open questions for review

1. **Product name / wordmark**: "Resume Optimiser" is a placeholder. Do you have a preferred name? Should the header use your portfolio logo, or a text wordmark only?
2. **Link back to the portfolio**: ★ a "Built by Toni Miharja" link in the footer. Or would you rather not link them?
3. **Column width**: ★ keep 680px on every screen, as on the portfolio. The alternative is 760px for results only, which gives the bars a little more room.
4. **Dimension chart**: ★ horizontal bars. They're easier to read and more minimal than a radar chart, which the brief also allowed.
5. **Hero**: ★ typographic only. The alternative is a subtle background image like the portfolio's hero, which is heavier and less minimal.
6. **Motion library**: ★ CSS-only animations (no `framer-motion`) to keep the bundle small. Or reuse the portfolio's `Reveal` component with `framer-motion` for exact parity?
7. **Verdict wording**: are the band labels ("Needs work / Fair / Good / Strong") and the playful "A few fixes from strong." tone OK?
