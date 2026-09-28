import Analyzer from "@/components/analyzer/analyzer";
import Hero from "@/components/hero";
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

// Display only; the server enforces the real limit (src/env.ts). 0 = no limit.
const configuredLimit = Number(process.env.RATE_LIMIT_PER_DAY ?? "5");
const DAILY_LIMIT =
  process.env.RATE_LIMIT_PER_DAY && Number.isInteger(configuredLimit) && configuredLimit >= 0
    ? configuredLimit
    : 5;

function Landing() {
  return (
    <>
      <section id="how-it-works" aria-labelledby="how-heading" className="mt-24 scroll-mt-24">
        <Reveal>
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
        </Reveal>
      </section>
      <section aria-labelledby="score-heading" className="mt-20">
        <Reveal>
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
        </Reveal>
      </section>
    </>
  );
}

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="flex-1 pb-24">
        <Analyzer
          dailyLimit={DAILY_LIMIT}
          hero={
            <Hero>
              <Reveal>
                <h1 id="hero-heading" className="text-4xl font-medium tracking-tight sm:text-5xl">
                  Get your resume ready for Singapore recruiters.
                </h1>
                <p className="mt-4 max-w-[560px] text-[17px] leading-relaxed text-muted">
                  Upload a PDF. In about a minute you&apos;ll get a score, specific feedback and
                  stronger bullet points. Free, no sign-up.
                </p>
              </Reveal>
            </Hero>
          }
          landing={<Landing />}
        />
      </main>
      <SiteFooter />
    </>
  );
}
