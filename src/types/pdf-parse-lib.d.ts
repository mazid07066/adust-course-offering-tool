declare module "pdf-parse/lib/pdf-parse.js" {
  type PdfParseResult = {
    text?: string;
    numpages?: number;
    info?: Record<string, unknown>;
    metadata?: unknown;
    version?: string;
  };

  type PdfParseFunction = (dataBuffer: Buffer) => Promise<PdfParseResult>;

  const pdfParse: PdfParseFunction;
  export default pdfParse;
}