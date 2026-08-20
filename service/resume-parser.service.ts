import { qstash } from "../config/qstash";
import JSZip from "jszip";
import { DOMParser } from "@xmldom/xmldom";

export type ArrayProps = {
  original_document_id: string;
  file_id: string;
  fk_user_id: string;
  key: string;
};
const delay_seconds = 0;

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

// for resume rework
export function buildResumeTailorPromptforResumeRework(
  paragraphs: { id: string; text: string }[],
  jobDescription: string,
): string {
  return `You are optimizing resume content for ATS keyword alignment with a specific job description, using MINIMAL changes.

JOB DESCRIPTION:
${jobDescription.slice(0, 3000)}

RESUME PARAGRAPHS (flat list — includes section headers, contact info, and content lines mixed together):
${JSON.stringify(paragraphs, null, 2)}

RULES (follow in strict order):
1. RETURN UNCHANGED, EXACTLY: Section headers (short standalone lines like "Experience", "Projects", "Technical Skills", "Education", "Professional Summary") — copy character-for-character, never rewrite.
2. RETURN UNCHANGED, EXACTLY: Contact info lines (name, email, phone, links) — never touch these.
3. RETURN UNCHANGED, EXACTLY: Any bullet/content line that already matches the JD well — do not rephrase for style, only for keyword alignment.
4. VARIANT FIX: If a line contains a variant of a JD keyword (e.g. "Node.js" vs "Node", "REST APIs" vs "RESTful services"), replace ONLY that phrase with the JD's exact wording. Change nothing else in that line.
5. KEYWORD INSERT: For JD keywords missing entirely from the resume, find the single most relevant existing bullet and work the keyword in with minimal edit. Skip if no bullet can naturally fit it — do not force it.
6. NEVER fabricate technologies, metrics, companies, or achievements not implied by the original text.
7. Keep each rewritten line within roughly ±20% of its original length — the output must fit the same document layout.
8. Return the EXACT SAME "id" for every paragraph — do not add, remove, merge, split, or reorder entries.
9. Return the EXACT SAME COUNT of paragraphs as given.

Return raw JSON only (no markdown, no code fences, no explanation):
{
  "paragraphs": [
    { "id": "p0", "text": "..." }
  ]
}`;
}
