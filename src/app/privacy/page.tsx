import type { Metadata } from "next";
import SiteFooter from "@/components/site-footer";
import SiteHeader from "@/components/site-header";

export const metadata: Metadata = { title: "Privacy · Resume Optimiser" };

// Stub for the Phase 1 scaffold; the full notice (PDPA transfer disclosure,
// analytics columns, retention) is written in Phase 5.
export default function Privacy() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="page-col flex-1 pt-36 pb-24 sm:pt-44">
        <h1 className="text-3xl font-medium tracking-tight">Privacy</h1>
        <div className="mt-8 space-y-5 text-[17px] leading-relaxed">
          <p>
            We don&apos;t store your resume. We keep anonymised stats (e.g. role type, seniority,
            scores) to improve the tool.
          </p>
          <p className="text-muted">
            Your resume is processed by Anthropic&apos;s Claude API and isn&apos;t used for
            training. A full privacy notice will be published before launch.
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
