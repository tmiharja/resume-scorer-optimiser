import type { Metadata } from "next";
import type { ReactNode } from "react";
import SiteFooter from "@/components/site-footer";
import SiteHeader from "@/components/site-header";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy · Resume Optimiser",
  description: "What happens to your resume when you use Resume Optimiser, and what we keep.",
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-12">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <div className="mt-3 space-y-4 text-[16px] leading-relaxed">{children}</div>
    </section>
  );
}

export default function Privacy() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="page-col flex-1 pt-36 pb-24 sm:pt-44">
        <h1 className="text-3xl font-medium tracking-tight sm:text-4xl">Privacy</h1>
        <p className="mt-4 text-[17px] leading-relaxed text-muted">
          The short version: we don&apos;t store your resume. We keep anonymised stats (e.g. role
          type, seniority, scores) to improve the tool.
        </p>

        <Section title="What happens to your resume">
          <p>
            Your PDF is read in memory on our server to extract its text and check it for hidden
            content. It is never written to disk, file storage, our database or our logs, and
            it&apos;s discarded when the analysis finishes.
          </p>
          <p>
            To produce the feedback, the resume text (and the job description, if you add one) is
            sent to Anthropic&apos;s Claude API, which processes it in the United States. Anthropic
            doesn&apos;t use API data to train its models and keeps it only for a limited period
            under its commercial terms. See{" "}
            <a
              href="https://www.anthropic.com/legal/privacy"
              className="link"
              target="_blank"
              rel="noopener noreferrer"
            >
              Anthropic&apos;s privacy policy
            </a>
            .
          </p>
          <p>
          </p>
        </Section>

        <Section title="What we keep">
          <p>For each analysis we store one anonymised record containing only:</p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              broad categories chosen from fixed lists: role type, seniority, industry and a
              years-of-experience band;
            </li>
            <li>the page count, the scores, and whether a job description was used;</li>
            <li>whether hidden text or AI-directed instructions were found;</li>
            <li>the models used, token counts, cost and how long the analysis took.</li>
          </ul>
          <p>
            We don&apos;t store your name, contact details, employers, schools, the resume text or
            the job description, and the record can&apos;t be linked back to you. We use these stats
            to improve the scoring and to keep the tool within its running budget.
          </p>
        </Section>

        <Section title="Usage limits">
          <p>
            To keep the tool free, each visitor can run a limited number of analyses a day. To
            enforce this we keep a one-way, salted hash of your IP address for up to 24 hours. We
            never store your IP address itself.
          </p>
        </Section>

        <Section title="Cookies">
          <p>
            We don&apos;t use tracking or advertising cookies. Your light/dark theme choice is saved
            in your browser&apos;s local storage and never sent to us.
          </p>
        </Section>

        <Section title="Questions">
          <p>
            {site.name} is a personal, non-commercial project built by{" "}
            {site.portfolioUrl ? (
              <a
                href={site.portfolioUrl}
                className="link"
                target="_blank"
                rel="noopener noreferrer"
              >
                {site.credit}
              </a>
            ) : (
              site.credit
            )}
            . If you have a question about your data, get in touch through the portfolio site.
          </p>
          <p className="text-[14px] text-muted">Last updated 26 September 2026.</p>
        </Section>
      </main>
      <SiteFooter />
    </>
  );
}
