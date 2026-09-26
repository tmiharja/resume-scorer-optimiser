# Eval fixtures

Synthetic resumes for `npm run eval` (Phase 3) and ingest regression tests. **Every person, employer, school, NRIC and number is fictional.** They are regenerated with `npm run fixtures` (see `evals/generate-fixtures.mts`).

| Fixture | Purpose | Ingest findings (deterministic) |
|---|---|---|
| `senior-strong.pdf` | Strong, quantified senior engineer resume | none |
| `junior-weak.pdf` | Vague junior resume, mixed spelling, no summary | none |
| `no-metrics.pdf` | Mid-level marketing resume with no numbers | none |
| `overlong-4p.pdf` | Verbose 4-page operations resume | `page_count_long` |
| `sg-personal-data.pdf` | Photo, NRIC, DOB/age, marital status, race, religion, expected salary | `nric_detected`, `photo_detected` + SG hints |
| `hidden-injection.pdf` | White-text prompt injection (printed by Chromium) | `hidden_white_text` |
| `hidden-injection-clean.pdf` | The same resume without the injection (score twin) | none |
| `jd-match.pdf` + `jds/jd-match.txt` | Data analyst resume with a matching JD | none |
| `jd-mismatch.pdf` + `jds/jd-mismatch.txt` | Nurse resume with a backend engineering JD | none |
| `not-a-resume.pdf` | A recipe | none (the Extractor must reject it) |
| `keyword-stuffing.pdf` | Visible keyword dump plus 1pt repeated keywords | `tiny_font`, `keyword_stuffing` |

Expected score ranges and must-flag / must-not-hallucinate assertions are added with the eval runner in Phase 3.
