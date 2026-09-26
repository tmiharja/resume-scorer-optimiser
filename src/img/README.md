# Images

Static images imported by the app (`@/img/...`), following the portfolio's convention.

## Hero background (to be supplied)

Add the landing-page hero images here with these names:

| File | Used for |
|---|---|
| `hero-background-light.jpg` | Light theme |
| `hero-background-dark.jpg` | Dark theme (optional: without it, the light image gets a darkening veil) |

Requirements (see `ui-layout.md` §4.1):
- At least 2400px wide, landscape, JPG.
- Keep the subject out of the bottom third, where the image fades into the page and the headline sits.
- Your own image, or one licensed for web use.

Then wire them up in `src/img/hero.ts` (one import per image; instructions are in that file). Until then the hero shows a neutral placeholder.
