import { qstash } from "../config/qstash";

export type ArrayProps = {
  file_id: string;
  fk_user_id: string;
  key: string;
};

export async function CreateResumeParser(items: ArrayProps[]) {
  const delay_seconds = 0;
  await qstash().publishJSON({
    url: `${process.env.API_BASE_URL}/api/webhooks/parse-resume`,
    body: { items },
    delay: delay_seconds,
  });
}
