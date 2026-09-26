/** Column width for the header, main content and footer (ui-layout.md §1). */
export type PageWidth = "page" | "results";

export const widthClass: Record<PageWidth, string> = {
  page: "max-w-page",
  results: "max-w-results",
};
