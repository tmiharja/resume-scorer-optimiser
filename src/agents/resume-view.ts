import type { StructuredResume } from "@/schemas/resume";

/** Compact JSON view of the resume for downstream prompts (IDs kept for citations). */
export function resumeForPrompt(resume: StructuredResume) {
  return JSON.stringify({
    summary: resume.summary,
    experience: resume.experience.map((r) => ({
      id: r.id,
      role: r.role,
      company: r.company,
      start: r.start,
      end: r.end,
      bullets: r.bullets.map((b) => ({ id: b.id, text: b.text })),
    })),
    education: resume.education,
    skills: resume.skills,
    certifications: resume.certifications,
  });
}

export function bulletIndex(resume: StructuredResume) {
  const index = new Map<
    string,
    { text: string; role: string; company: string; position: number }
  >();
  for (const role of resume.experience) {
    role.bullets.forEach((b, i) =>
      index.set(b.id, { text: b.text, role: role.role, company: role.company, position: i + 1 }),
    );
  }
  return index;
}
