import Link from "next/link";

export default function PrivacyNotice() {
  return (
    <p className="mt-5 border-t border-rule pt-4 text-[13px] leading-relaxed text-muted">
      We don&apos;t store your resume. We keep anonymised stats (e.g. role type, seniority, scores)
      to improve the tool. Your resume is processed by Anthropic&apos;s Claude API and isn&apos;t
      used for training.{" "}
      <Link href="/privacy" className="link">
        Privacy details
      </Link>
    </p>
  );
}
