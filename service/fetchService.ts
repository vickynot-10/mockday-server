const TIMEOUT_MILLISECONDS: Record<number, number> = {
  5: 5000,
  10: 10000,
  15: 15000,
  20: 20000,
  25: 25000,
  30: 30000,
  35: 35000,
  40: 40000,
  45: 45000,
  50: 50000,
  55: 55000,
  60: 60000,
};

type HeaderItem = {
  key: string;
  value: string;
};

type FetchServiceOptions = {
  url: string;
  method?: string;
  headers?: HeaderItem[];
  body?: string;
  timeout?: number;
  send_as_json?: boolean;
  status_codes?: number[];
  expected_response?: string;
};

type FetchServiceResult = {
  ok: boolean;
  status_code: number | null;
  latency_ms: number | null;
  response_text: string | null;
  error: string | null;
  json: any | null;
};

export async function fetchService(
  config: FetchServiceOptions,
): Promise<FetchServiceResult> {
  const start = Date.now();

  try {
    const {
      headers: headerList = [],
      url,
      method = "GET",
      body,
      timeout = 5,
      send_as_json = false,
      status_codes = [200, 201, 202, 204],
      expected_response = "",
    } = config;

    const TIMEOUT: number =
      TIMEOUT_MILLISECONDS[timeout] ?? TIMEOUT_MILLISECONDS[5];

    const requestHeaders: Record<string, string> = {};

    for (const h of headerList) {
      requestHeaders[h.key] = h.value;
    }

    if (send_as_json && body) {
      requestHeaders["Content-Type"] = "application/json";
    }

    const res = await fetch(url, {
      method,
      headers: requestHeaders,
      body: ["GET", "HEAD"].includes(method) ? undefined : body,
      signal: AbortSignal.timeout(TIMEOUT),
    });

    const latency_ms = Date.now() - start;
    const response_text = await res.text();
    let parsed_json: unknown = null;
    try {
      parsed_json = JSON.parse(response_text);
    } catch {}

    const statusOk = status_codes.includes(res.status);
    const bodyOk = expected_response
      ? response_text.includes(expected_response)
      : true;

    return {
      ok: statusOk && bodyOk,
      status_code: res.status,
      latency_ms,
      response_text,
      error: null,
      json: parsed_json,
    };
  } catch (err) {
    const latency_ms = Date.now() - start;
    const isTimeout =
      err instanceof Error &&
      (err.name === "TimeoutError" || err.name === "AbortError");

    console.log(err);

    return {
      ok: false,
      status_code: null,
      latency_ms,
      response_text: null,
      error: isTimeout
        ? "Request timed out"
        : err instanceof Error
          ? err.message
          : "Unknown error",
      json: null,
    };
  }
}
