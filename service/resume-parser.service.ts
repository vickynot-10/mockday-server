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