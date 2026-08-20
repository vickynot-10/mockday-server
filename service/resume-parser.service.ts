import { qstash } from "../config/qstash";

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
