import { describe, expect, it } from "vitest";
import { detectSgPersonalData, findNrics, isValidNric, maskNric } from "@/ingest/sg-pii";

// Synthetic numbers with valid check letters (S1234567D is the standard textbook example).
describe("isValidNric", () => {
  it.each(["S1234567D", "T1234567J", "F1234567N", "G1234567X"])("accepts %s", (nric) => {
    expect(isValidNric(nric)).toBe(true);
  });

  it.each(["S1234567A", "T1234567D", "X1234567D", "S123456D", "S12345678D"])(
    "rejects %s",
    (nric) => {
      expect(isValidNric(nric)).toBe(false);
    },
  );
});

describe("findNrics", () => {
  it("returns masked numbers with a valid checksum only", () => {
    const text = "NRIC: S1234567D. Order ref S1234567A. Case s1234567d again.";
    expect(findNrics(text)).toEqual(["S••••567D"]);
  });

  it("masks to the prefix and last four characters", () => {
    expect(maskNric("S1234567D")).toBe("S••••567D");
  });
});

describe("detectSgPersonalData", () => {
  it("finds fields the SG rubric says to leave out", () => {
    const hints = detectSgPersonalData(
      [
        "Date of Birth: 01/02/1990",
        "Marital Status: Married",
        "Race: Chinese",
        "Religion: Buddhist",
        "Nationality: Singaporean",
        "Expected salary: S$8,000",
        "Singapore PR",
        "NRIC S1234567D",
      ].join("\n"),
    );
    expect(hints).toEqual({
      nric: true,
      dateOfBirthOrAge: true,
      maritalStatus: true,
      race: true,
      religion: true,
      nationality: true,
      expectedSalary: true,
      workAuthorisation: true,
    });
  });

  it("stays quiet on an ordinary resume", () => {
    const hints = detectSgPersonalData(
      "Led a race-condition fix in the payments service. Managed a team of 5. Salary benchmarking project for HR.",
    );
    expect(Object.values(hints).every((v) => v === false)).toBe(true);
  });

  it("accepts a dash-with-space label separator", () => {
    expect(detectSgPersonalData("Race – Malay").race).toBe(true);
    expect(detectSgPersonalData("Religion - Hindu").religion).toBe(true);
  });

  it("catches an age written out", () => {
    expect(detectSgPersonalData("Age: 34").dateOfBirthOrAge).toBe(true);
    expect(detectSgPersonalData("34 years old").dateOfBirthOrAge).toBe(true);
  });
});
