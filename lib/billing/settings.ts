import { safeAiText } from "@/lib/ai/safety";
import type { AiPreferences, Plan } from "./domain";
const common = [
  "name",
  "icon",
  "personality",
  "style",
  "specialties",
  "activity",
];
const pro = [
  "profile",
  "sliders",
  "politeness",
  "length",
  "emoji",
  "jargon",
  "questions",
  "inactivity",
  "deadline",
  "ideas",
  "meeting",
  "finalEdit",
  "instructions",
];
const choices: Record<string, string[]> = {
  icon: ["spark", "leaf", "pen", "star", "compass", "book"],
  personality: [
    "balanced",
    "idea",
    "editor",
    "facilitator",
    "listener",
    "logical",
  ],
  style: ["friendly", "polite", "concise"],
  inactivity: ["6", "12", "24", "off"],
};
for (const k of [
  "activity",
  "politeness",
  "length",
  "emoji",
  "jargon",
  "questions",
  "ideas",
  "meeting",
  "finalEdit",
])
  choices[k] = ["low", "medium", "high"];
export function validatePreferences(
  raw: unknown,
  plan: Plan = "pro",
): AiPreferences {
  if (
    !raw ||
    typeof raw !== "object" ||
    Array.isArray(raw) ||
    JSON.stringify(raw).length > 4000
  )
    throw Error("INVALID_PREFERENCES");
  const s = raw as Record<string, unknown>,
    allowed = plan === "pro" ? [...common, ...pro] : common;
  for (const [k, v] of Object.entries(s)) {
    if (!allowed.includes(k)) throw Error("INVALID_PREFERENCES");
    if (k === "name" || k === "profile" || k === "instructions") {
      if (!safeAiText(v, k === "name" ? 40 : k === "profile" ? 300 : 500))
        throw Error("INVALID_PREFERENCES");
    } else if (k === "specialties") {
      if (
        !Array.isArray(v) ||
        v.length > (plan === "pro" ? 5 : 1) ||
        v.some(
          (x) =>
            ![
              "story",
              "characters",
              "world",
              "editing",
              "planning",
              "visual",
              "music",
            ].includes(x),
        )
      )
        throw Error("INVALID_PREFERENCES");
    } else if (k === "sliders") {
      if (
        !Array.isArray(v) ||
        v.length !== 5 ||
        v.some((x) => !Number.isInteger(x) || x < 0 || x > 4)
      )
        throw Error("INVALID_PREFERENCES");
    } else if (k === "deadline") {
      if (typeof v !== "boolean") throw Error("INVALID_PREFERENCES");
    } else if (typeof v !== "string" || !choices[k]?.includes(v))
      throw Error("INVALID_PREFERENCES");
  }
  return { ...s } as AiPreferences;
}
