export const MAX_PINNED_PROJECTS = 10;

export const BULK_UPDATE_TYPES = {
  STATUS : 1,
  DELETE : 2,
  PIN : 3,
  UNPIN : 4
}

export const HTTP_METHODS = {
  HEAD: "HEAD",
  GET: "GET",
  POST: "POST",
  PUT: "PUT",
  PATCH: "PATCH",
  DELETE: "DELETE",
  OPTIONS: "OPTIONS",
} as const;



export const STATUS_CODES = {
  "2xx": {
    200: "OK",
    201: "Created",
    202: "Accepted",
    204: "No Content",
  },
  "3xx": {
    301: "Moved Permanently",
    302: "Found",
    304: "Not Modified",
    307: "Temporary Redirect",
    308: "Permanent Redirect",
  },
  "4xx": {
    400: "Bad Request",
    401: "Unauthorized",
    403: "Forbidden",
    404: "Not Found",
    405: "Method Not Allowed",
    408: "Request Timeout",
    429: "Too Many Requests",
  },
  "5xx": {
    500: "Internal Server Error",
    501: "Not Implemented",
    502: "Bad Gateway",
    503: "Service Unavailable",
    504: "Gateway Timeout",
  },
} as const;