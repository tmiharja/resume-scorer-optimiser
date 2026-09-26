import Link from "next/link";
import { site } from "@/lib/site";
import { cn } from "@/lib/utils";
import { type PageWidth, widthClass } from "./layout-width";

export default function SiteFooter({ width = "page" }: { width?: PageWidth }) {
  return (
    <footer className={cn("mx-auto w-full px-6 pb-12", widthClass[width])}>
      <div className="flex flex-wrap gap-x-6 gap-y-2 border-t border-rule pt-8 text-[13px] text-muted">
        <Link href="/privacy" className="link">
          Privacy
        </Link>
        <span>
          Built by{" "}
          {site.portfolioUrl ? (
            <a href={site.portfolioUrl} className="link" target="_blank" rel="noopener noreferrer">
              {site.credit}
            </a>
          ) : (
            site.credit
          )}
        </span>
        <span>©&nbsp;{new Date().getFullYear()}</span>
      </div>
    </footer>
  );
}
