import crypto from "crypto";

const FOX_DOMAIN = "https://www.foxesscloud.com";

export type FoxReportDim = "day" | "month" | "year";
type SepKind = "literal" | "crlf" | "lf";

function buildSignature(path: string, token: string, timestamp: number, kind: SepKind) {
  // Map separators to avoid multiline string issues in bundlers
  const SEPS: Record<SepKind, string> = {
    literal: "\\r\\n", // literal backslash-r backslash-n (FoxESS wymaga tego wariantu u Ciebie)
    crlf: "\r\n",      // real CRLF
    lf: "\n"           // LF
  };
  const sep = SEPS[kind];
  const plaintext = path + sep + token + sep + String(timestamp);
  return crypto.createHash("md5").update(plaintext).digest("hex");
}

// re-export everything else from your original file after replacing buildSignature
export { };
