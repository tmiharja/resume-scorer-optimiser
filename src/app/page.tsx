import Reveal from "@/components/reveal";
import SiteFooter from "@/components/site-footer";
import SiteHeader from "@/components/site-header";

const STEPS = [
  ["Upload", "Your PDF is read in memory and checked for hidden text."],
  ["Review", "AI reviewers score it against Singapore hiring conventions."],
  ["Improve", "Get prioritised fixes and rewritten bullet points to copy."],
] as const;

const DIMENSIONS = [
  ["Impact", "Results and numbers, not just duties"],
  ["Clarity", "Concise, specific, easy to scan"],
  ["Structure", "Layout, length and section order"],
  ["ATS readiness", "Parses cleanly in applicant tracking systems"],
  ["SG conventions", "No photo, NRIC, age or salary; consistent British spelling"],
] as const;

// Phase 1 scaffold: the landing shell with static content. The hero image,
// upload form and analysis flow arrive in Phase 4 (see ui-layout.md §4.1).
export default function Home() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto w-full max-w-page flex-1 px-6 pt-36 pb-24 sm:pt-44">
        <Reveal>
          <h1 className="text-4xl font-medium tracking-tight sm:text-5xl">
            Get your resume ready for Singapore recruiters.
          </h1>
          <p className="mt-4 max-w-[560px] text-[17px] leading-relaxed text-muted">
            Upload a PDF. In about a minute you&apos;ll get a score, specific feedback and stronger
            bullet points. Free, no sign-up.
          </p>
        </Reveal>

        <Reveal delay={0.05}>
          <p
            role="status"
            className="mt-10 rounded-r-lg border-l-2 border-accent bg-accent-soft px-4 py-3.5 text-sm"
          >
            The analyser is being built. Uploads open soon.
          </p>
        </Reveal>

        <section id="how-it-works" aria-labelledby="how-heading" className="mt-24 scroll-mt-24">
          <h2 id="how-heading" className="mb-6 text-2xl font-semibold tracking-tight">
            How it works
          </h2>
          <ol className="divide-y divide-rule border-y border-rule">
            {STEPS.map(([title, body], i) => (
              <li key={title} className="grid gap-1 py-4 sm:grid-cols-[140px_1fr] sm:gap-6">
                <span className="text-sm text-muted tabular-nums">0{i + 1}</span>
                <div>
                  <p className="font-medium">{title}</p>
                  <p className="text-[15px] text-muted">{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="score-heading" className="mt-20">
          <h2 id="score-heading" className="mb-6 text-2xl font-semibold tracking-tight">
            What we score
          </h2>
          <ul className="divide-y divide-rule border-y border-rule">
            {DIMENSIONS.map(([title, body]) => (
              <li key={title} className="grid gap-1 py-4 sm:grid-cols-[140px_1fr] sm:gap-6">
                <span className="font-medium">{title}</span>
                <span className="text-[15px] text-muted">{body}</span>
              </li>
            ))}
          </ul>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
