import { qstash } from "../config/qstash";
import JSZip from "jszip";
import { DOMParser } from "@xmldom/xmldom";
import { AI_COMMANDS } from "../constants";

export type ArrayProps = {
  original_document_id: string;
  file_id: string;
  fk_user_id: string;
  key: string;
};
const delay_seconds = 0;
const RESUME_REWORK_RULES = `RESUME REWORK RULES (produce "resume_rework"):
1. RETURN UNCHANGED, EXACTLY: Section headers (short standalone lines like "Experience", "Projects", "Technical Skills", "Education", "Professional Summary") — copy character-for-character, never rewrite.
2. RETURN UNCHANGED, EXACTLY: Contact info lines (name, email, phone, links) — never touch these.
3. RETURN UNCHANGED, EXACTLY: Any bullet/content line that already matches the JD well — do not rephrase for style, only for keyword alignment.
4. VARIANT FIX: If a line contains a variant of a JD keyword (e.g. "Node.js" vs "Node", "REST APIs" vs "RESTful services"), replace ONLY that phrase with the JD's exact wording. Change nothing else in that line.
5. KEYWORD INSERT: For JD keywords missing entirely from the resume, find the single most relevant existing bullet and work the keyword in with minimal edit. Skip if no bullet can naturally fit it — do not force it.
6. NEVER fabricate technologies, metrics, companies, or achievements not implied by the original text or the candidate profile.
7. Keep each rewritten line within roughly ±20% of its original length — the output must fit the same document layout.
8. Return the EXACT SAME "id" for every paragraph — do not add, remove, merge, split, or reorder entries.
9. Return the EXACT SAME COUNT of paragraphs as given.
10. If the job description text is missing, garbled, or clearly not a job description, return all paragraphs unchanged and set "error" to a short explanation.`;

const COVER_LETTER_RULES = `COVER LETTER RULES (produce "cover_letter"):
1. Write 3-4 short paragraphs: an opening naming the role, 1-2 paragraphs connecting specific resume experience to the JD's requirements, a brief confident closing.
2. NEVER fabricate experience, companies, metrics, titles, or skills not present in the resume content or profile.
3. Avoid generic filler phrases ("I am writing to express my interest", "I believe I would be a great fit") — open with something specific to the role instead.
4. Reference at most 2-3 of the candidate's most relevant achievements — do not summarize the entire resume.
5. Match tone to the seniority implied by the JD — confident, not overstated.
6. Keep total length under 300 words.
7. If the candidate's resume/profile shows no relevant experience for this role, still write the letter honestly — do not invent a connection that isn't there.
8. If the job description text is missing, garbled, or clearly not a job description, return an empty "cover_letter" and set "error" to a short explanation.`;

const JOB_MATCH_RULES = `JOB MATCH RULES (produce "job_match"):
1. Score 0-100. Be honest and realistic — do not default to a flattering score. A resume with little overlap should score below 40. A strong, closely aligned match should score 80+.
2. Base the score on: hard skills/tools overlap (highest weight), relevant work experience alignment, seniority/years-of-experience match, and domain/industry relevance.
3. Do NOT count generic soft skills (communication, teamwork, leadership) toward the score — only hard, verifiable requirements.
4. Use BOTH resume content and candidate profile to judge fit — if the profile shows a skill or experience the resume text doesn't mention, still credit it, but note it separately.
5. "matched_keywords": hard skills/requirements from the JD that clearly appear in the resume or profile.
6. "missing_keywords": important JD requirements not evidenced anywhere in the resume or profile — max 10, ranked by importance.
7. "strengths": 2-3 short bullet points on what makes this candidate a genuinely good fit, if any.
8. "gaps": 2-3 short bullet points on real gaps or mismatches — do not soften these into vague positivity.
9. "summary": one honest paragraph (2-4 sentences) giving an overall verdict on fit.
10. If the job description text is missing, garbled, or clearly not a job description, return an error field instead of guessing.`;
export async function CreateResumeParser(items: ArrayProps[]) {
  await qstash().publishJSON({
    url: `${process.env.API_BASE_URL}/api/webhooks/parse-resume`,
    body: { items },
    delay: delay_seconds,
  });
}

export async function DeleteResumesService(items: string[]) {
  await qstash().publishJSON({
    url: `${process.env.API_BASE_URL}/api/webhooks/delete-resume`,
    body: { items },
    delay: delay_seconds,
  });
}

export async function extractParagraphsFromDocx(buffer: Buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const xmlContent = await zip.file("word/document.xml")!.async("string");

  const doc = new DOMParser().parseFromString(xmlContent, "text/xml");
  const paragraphs = doc.getElementsByTagName("w:p");

  const result: { id: string; text: string }[] = [];

  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i];
    const textNodes = p.getElementsByTagName("w:t");
    let text = "";
    for (let j = 0; j < textNodes.length; j++) {
      text += textNodes[j].textContent ?? "";
    }
    if (text.trim()) {
      result.push({ id: `p${i}`, text });
    }
  }

  return result;
}

export function extractCommandsAndContent(message: string) {
  let trimmed = message.trim();
  const commands: string[] = [];

  let matched = true;
  while (matched) {
    matched = false;
    for (const cmd of AI_COMMANDS.COMMADS_ARRAY) {
      if (trimmed.startsWith(cmd)) {
        commands.push(cmd);
        trimmed = trimmed.slice(cmd.length).trim();
        matched = true;
        break;
      }
    }
  }

  return { commands, content: trimmed };
}

export function buildBatchPrompt(
  commands: string[],
  paragraphs: { id: string; text: string }[],
  user_details: any,
  jobDescription: string,
): string {
  const sections: string[] = [];
  const outputShape: Record<string, any> = {};

  if (commands.includes(AI_COMMANDS.COMMANDS.RESUME_REWORK)) {
    sections.push(RESUME_REWORK_RULES);
    outputShape.resume_rework = {
      paragraphs: [{ id: "p0", text: "..." }],
      error: null,
    };
  }
  if (commands.includes(AI_COMMANDS.COMMANDS.COVER_LETTER)) {
    sections.push(COVER_LETTER_RULES);
    outputShape.cover_letter = { cover_letter: "...", error: null };
  }
  if (commands.includes(AI_COMMANDS.COMMANDS.JOB_MATCH)) {
    sections.push(JOB_MATCH_RULES);
    outputShape.job_match = {
      match_score: 0,
      matched_keywords: ["..."],
      missing_keywords: ["..."],
      strengths: ["..."],
      gaps: ["..."],
      summary: "...",
      error: null,
    };
  }

  return `You are handling multiple resume tasks for ONE job description in a single response.

JOB DESCRIPTION:
${jobDescription.slice(0, 3000)}

RESUME PARAGRAPHS:
${JSON.stringify(paragraphs, null, 2)}

CANDIDATE PROFILE:
${JSON.stringify(user_details ?? {}, null, 2)}

TASKS REQUESTED: ${commands.join(", ")}

${sections.join("\n\n")}

If the job description is missing, garbled, or not a job description, set "error" inside every requested task's object instead of guessing.

Return raw JSON only (no markdown, no code fences, no explanation), with EXACTLY this shape, only the keys for requested tasks:
${JSON.stringify(outputShape, null, 2)}`;
}

// for plainchat
export function buildPlainChatPrompt(
  message: string,
  user_details: any,
): string {
  return `You are a concise resume/job-application assistant chat. Keep replies short and natural, like a real chat message — no headers, no bullet lists of "things I can do", no ASCII art, no markdown structure unless the user's question actually needs code or a list.

If the user greets you or sends small talk, reply briefly and naturally, and if relevant, mention you can help with resume rework, cover letters, or job match scoring (only briefly, one line, not a menu).

CANDIDATE PROFILE (for context if relevant):
${JSON.stringify(user_details ?? {}, null, 2)}

USER MESSAGE:
${message}`;
}


export function generateTitleFromMessage(message: string): string {
  const cleaned = message.replace(/\s+/g, " ").trim();
  return cleaned.length > 60 ? cleaned.slice(0, 60).trim() + "…" : cleaned;
}