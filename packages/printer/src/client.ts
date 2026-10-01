import { EPOS_NS, PrintDocument } from "./document.ts";

/**
 * Talks to an Epson printer's built-in ePOS-Print service over HTTP.
 * Jobs go through a single queue: one at a time, with at least
 * `minIntervalMs` between the end of one print and the start of the next, so
 * a person has time to tear each ticket off.
 */

export interface PrinterOptions {
  /** IP or hostname of the printer. */
  host: string;
  /** Use https (the printer has a self-signed certificate). Default false. */
  https?: boolean;
  /** ePOS device id; `local_printer` unless you've renamed it in the printer's web config. */
  deviceId?: string;
  /** How long the printer may wait (e.g. for paper) before giving up on a job. Default 10s. */
  timeoutMs?: number;
  /** Minimum gap between prints. Default 3s. Status checks skip the gap. */
  minIntervalMs?: number;
  /** For tests. */
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

/** Decoded ASB status bits (Epson "automatic status back"). */
export interface PrinterStatus {
  offline: boolean;
  coverOpen: boolean;
  paperEnd: boolean;
  paperNearEnd: boolean;
  /** Mechanical, autocutter or unrecoverable error. */
  error: boolean;
}

export interface PrintResult {
  success: boolean;
  /** ePOS result code, e.g. `EPTR_REC_EMPTY`; `UNREACHABLE` if the printer didn't answer over HTTP. */
  code: string;
  /** Raw ASB status bitfield (0 if unknown). */
  raw: number;
  status: PrinterStatus;
  /** One short human sentence, suitable for a bar screen. */
  message: string;
  /** Underlying network error when `code` is UNREACHABLE, for logs. */
  detail?: string;
}

const ASB = {
  NO_RESPONSE: 0x1,
  PRINT_SUCCESS: 0x2,
  OFF_LINE: 0x8,
  COVER_OPEN: 0x20,
  MECHANICAL_ERR: 0x400,
  AUTOCUTTER_ERR: 0x800,
  UNRECOVER_ERR: 0x2000,
  RECEIPT_NEAR_END: 0x20000,
  RECEIPT_END: 0x80000,
} as const;

export function decodeStatus(raw: number): PrinterStatus {
  return {
    offline: (raw & (ASB.OFF_LINE | ASB.NO_RESPONSE)) !== 0,
    coverOpen: (raw & ASB.COVER_OPEN) !== 0,
    paperEnd: (raw & ASB.RECEIPT_END) !== 0,
    paperNearEnd: (raw & ASB.RECEIPT_NEAR_END) !== 0,
    error: (raw & (ASB.MECHANICAL_ERR | ASB.AUTOCUTTER_ERR | ASB.UNRECOVER_ERR)) !== 0,
  };
}

const CODE_MESSAGES: Record<string, string> = {
  EPTR_COVER_OPEN: "Printer cover is open.",
  EPTR_REC_EMPTY: "Printer is out of paper.",
  EPTR_MECHANICAL: "Printer mechanical error. Power-cycle it.",
  EPTR_AUTOCUTTER: "Printer cutter is jammed. Open the cover and clear it.",
  EPTR_UNRECOVERABLE: "Printer hit an unrecoverable error. Power-cycle it.",
  EPTR_BLACKMARK_ERROR: "Printer paper-feed error.",
  EX_TIMEOUT: "Printer timed out. Is it out of paper or open?",
  DeviceNotFound: "Printer service can't find the device id.",
  SchemaError: "Printer rejected the job (bad XML). That's a bug.",
  PrintSystemError: "Printer service error.",
  UNREACHABLE: "Can't reach the printer on the network.",
};

export function describe(code: string, status: PrinterStatus, success: boolean): string {
  if (success) return status.paperNearEnd ? "Printed. Paper is running low." : "Printed.";
  if (status.paperEnd) return CODE_MESSAGES.EPTR_REC_EMPTY!;
  if (status.coverOpen) return CODE_MESSAGES.EPTR_COVER_OPEN!;
  return CODE_MESSAGES[code] ?? `Printer error${code ? ` (${code})` : ""}.`;
}

/** Pull the <response .../> attributes out of the printer's SOAP reply. */
export function parseResponse(xml: string): { success: boolean; code: string; raw: number } | null {
  const m = /<response\b([^>]*)>/.exec(xml);
  if (!m) return null;
  const attr = (name: string) => new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`).exec(m[1]!)?.[1];
  return {
    success: /^(1|true)$/.test(attr("success") ?? ""),
    code: attr("code") ?? "",
    raw: Number(attr("status") ?? 0) || 0,
  };
}

export function soapEnvelope(body: string, jobId?: string): string {
  const header = jobId
    ? `<s:Header><parameter xmlns="${EPOS_NS}"><printjobid>${jobId.replace(/[^\w-]/g, "")}</printjobid></parameter></s:Header>`
    : "";
  return `<?xml version="1.0" encoding="utf-8"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">${header}<s:Body>${body}</s:Body></s:Envelope>`;
}

export class EposPrinter {
  readonly host: string;
  readonly url: string;
  private readonly timeoutMs: number;
  private readonly minIntervalMs: number;
  private readonly fetch: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly now: () => number;
  /** Tail of the job chain; each job waits for the one before. */
  private tail: Promise<unknown> = Promise.resolve();
  private lastPrintEnded = -Infinity;
  private pending = 0;

  constructor(opts: PrinterOptions) {
    this.host = opts.host;
    const scheme = opts.https ? "https" : "http";
    const devid = encodeURIComponent(opts.deviceId ?? "local_printer");
    this.timeoutMs = opts.timeoutMs ?? 10_000;
    this.minIntervalMs = opts.minIntervalMs ?? 3_000;
    this.url = `${scheme}://${opts.host}/cgi-bin/epos/service.cgi?devid=${devid}&timeout=${this.timeoutMs}`;
    this.fetch = opts.fetch ?? globalThis.fetch.bind(globalThis);
    this.sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.now = opts.now ?? Date.now;
  }

  /** Jobs waiting or printing. */
  get queued(): number {
    return this.pending;
  }

  /** Queue a job. Resolves once it has printed (or failed); never rejects for printer problems. */
  print(doc: PrintDocument | string, jobId?: string): Promise<PrintResult> {
    const xml = typeof doc === "string" ? doc : doc.toXml();
    return this.enqueue(async () => {
      const wait = this.lastPrintEnded + this.minIntervalMs - this.now();
      if (wait > 0) await this.sleep(wait);
      try {
        return await this.send(xml, jobId);
      } finally {
        this.lastPrintEnded = this.now();
      }
    });
  }

  /** Ask the printer how it is without printing anything. Queued, but ignores the print gap. */
  status(): Promise<PrintResult> {
    return this.enqueue(() => this.send(`<epos-print xmlns="${EPOS_NS}"/>`));
  }

  private enqueue<T>(job: () => Promise<T>): Promise<T> {
    this.pending++;
    const run = this.tail.then(job).finally(() => this.pending--);
    this.tail = run.catch(() => {});
    return run;
  }

  private async send(body: string, jobId?: string): Promise<PrintResult> {
    let text: string;
    try {
      const res = await this.fetch(this.url, {
        method: "POST",
        headers: { "Content-Type": "text/xml; charset=utf-8", SOAPAction: '""' },
        body: soapEnvelope(body, jobId),
        // The printer holds the request open for up to timeoutMs itself; give it a margin.
        signal: AbortSignal.timeout(this.timeoutMs + 5_000),
      });
      text = await res.text();
    } catch (e) {
      const err = e as Error & { cause?: { code?: string; message?: string } };
      return { ...result(false, "UNREACHABLE", ASB.NO_RESPONSE), detail: err.cause?.code ?? err.cause?.message ?? err.message };
    }
    const parsed = parseResponse(text);
    if (!parsed) return result(false, "PrintSystemError", 0);
    return result(parsed.success, parsed.code, parsed.raw);
  }
}

function result(success: boolean, code: string, raw: number): PrintResult {
  const status = decodeStatus(raw);
  return { success, code, raw, status, message: describe(code, status, success) };
}
