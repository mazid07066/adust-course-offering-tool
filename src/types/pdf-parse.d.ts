declare module "pdf-parse" {
  interface PDFParseOptions {
    pagerender?: (pageData: unknown) => string;
    max?: number;
    version?: string;
  }

  function pdfParse(
    dataBuffer: Buffer,
    options?: PDFParseOptions
  ): Promise<{ text: string }>;

  export default pdfParse;
}