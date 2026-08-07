import pdfParse from "pdf-parse";

export type ParsedTranscriptCourse = {
  semester: string;
  code: string;
  comparableCode: string;
  comparableTitle: string;
  title: string;
  credits: number;
  grade: string;
};

export type ParsedRegistrationCourse = {
  code: string;
  comparableCode: string;
  comparableTitle: string;
  title: string;
  credits: number;
  section: string | null;
};

export type ParsedStudentIdentity = {
  studentId: string | null;
  batchCode: string | null;
  suffix: string | null;
};

function normalizeInline(value: string) {
  return String(value || "")
    .replace(/[ï¿¾ï¿½]/g, " ")
    .replace(/\u00A0/g, " ")
    .replace(/[^\S\r\n]+/g, " ")
    .trim();
}

function normalizeMultiline(value: string) {
  return String(value || "")
    .replace(/[ï¿¾ï¿½]/g, " ")
    .replace(/\u00A0/g, " ")
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => normalizeInline(line))
    .join("\n");
}

function safeDecodeURIComponent(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function collapseText(value: string) {
  return normalizeMultiline(value)
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Registration PDFs sometimes concatenate timetable text directly
 * onto the course title, for example:
 *
 *   Automation LabTH-12:00-13:00TH-MU104
 *
 * There may be no whitespace before TH-, SU-, MO-, etc.
 *
 * Strip the timetable portion while preserving the real course title.
 */
function cleanRegistrationTitle(
  value: string
) {
  let cleaned =
    normalizeInline(value);

  cleaned = cleaned.replace(
    /\s*(?:SU|SA|TH|MO|FR|WE|TU)-\d{1,2}:\d{2}(?:-\d{1,2}:\d{2})?.*$/i,
    ""
  );

  cleaned = cleaned.replace(
    /\s+[A-Z]{2,6}\d{2,}.*$/i,
    (match) => {
      return /\b(?:MU|WE|EE|CE|ME|LAB|ROOM)\b/i.test(
        match
      )
        ? ""
        : match;
    }
  );

  return normalizeInline(
    cleaned
  );
}

export function normalizeComparableCourseCode(
  value:
    | string
    | null
    | undefined
) {
  return String(value || "")
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9]/g, "");
}

export function normalizeComparableTitle(
  value: string
) {
  return cleanRegistrationTitle(
    value
  )
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(
      /\b(the|course|lab\s*course)\b/g,
      " "
    )
    .replace(/\s+/g, " ")
    .trim();
}

async function extractPdfTextWithPdfParse(
  buffer: Buffer
): Promise<string> {
  const parsed =
    await pdfParse(buffer, {
      version:
        "v1.10.100",
    });

  return normalizeMultiline(
    parsed?.text || ""
  );
}

async function extractPdfTextWithPdf2Json(
  buffer: Buffer
): Promise<string> {
  const PDFParserModule =
    await import(
      "pdf2json"
    );

  const PDFParser =
    PDFParserModule.default;

  const text =
    await new Promise<string>(
      (
        resolve,
        reject
      ) => {
        const parser =
          new PDFParser(
            undefined,
            true
          );

        parser.on(
          "pdfParser_dataError",
          (
            errMsg:
              | Error
              | {
                  parserError:
                    Error;
                }
          ) => {
            const actualError =
              errMsg instanceof
              Error
                ? errMsg
                : errMsg.parserError;

            reject(
              actualError
            );
          }
        );

        parser.on(
          "pdfParser_dataReady",
          (pdfData: any) => {
            try {
              const pages =
                pdfData?.Pages ||
                [];

              const pageTexts:
                string[] = [];

              for (
                const page of
                pages
              ) {
                const rows =
                  new Map<
                    string,
                    string[]
                  >();

                for (
                  const textItem of
                  page.Texts ||
                  []
                ) {
                  const yKey =
                    Number(
                      textItem.y ||
                        0
                    ).toFixed(
                      2
                    );

                  const raw =
                    (
                      textItem.R ||
                      []
                    )
                      .map(
                        (
                          run: {
                            T?: string;
                          }
                        ) =>
                          safeDecodeURIComponent(
                            run.T ||
                              ""
                          )
                      )
                      .join(
                        " "
                      );

                  const cleaned =
                    normalizeInline(
                      raw
                    );

                  if (
                    !cleaned
                  ) {
                    continue;
                  }

                  if (
                    !rows.has(
                      yKey
                    )
                  ) {
                    rows.set(
                      yKey,
                      []
                    );
                  }

                  rows
                    .get(
                      yKey
                    )!
                    .push(
                      cleaned
                    );
                }

                const sortedLines =
                  Array.from(
                    rows.entries()
                  )
                    .sort(
                      (
                        a,
                        b
                      ) =>
                        Number(
                          a[0]
                        ) -
                        Number(
                          b[0]
                        )
                    )
                    .map(
                      (
                        [
                          ,
                          items,
                        ]
                      ) =>
                        normalizeInline(
                          items.join(
                            " "
                          )
                        )
                    )
                    .filter(
                      Boolean
                    );

                pageTexts.push(
                  sortedLines.join(
                    "\n"
                  )
                );
              }

              resolve(
                normalizeMultiline(
                  pageTexts.join(
                    "\n"
                  )
                )
              );
            } catch (
              error
            ) {
              reject(
                error
              );
            }
          }
        );

        parser.parseBuffer(
          buffer
        );
      }
    );

  return normalizeMultiline(
    text
  );
}

export async function extractPdfText(
  buffer: Buffer
): Promise<string> {
  try {
    return await extractPdfTextWithPdfParse(
      buffer
    );
  } catch {
    return await extractPdfTextWithPdf2Json(
      buffer
    );
  }
}

export async function extractPdfTextVariants(
  buffer: Buffer
): Promise<{
  primary: string;
  alternate: string;
}> {
  let primary = "";
  let alternate = "";

  try {
    primary =
      await extractPdfTextWithPdfParse(
        buffer
      );
  } catch {
    primary = "";
  }

  try {
    alternate =
      await extractPdfTextWithPdf2Json(
        buffer
      );
  } catch {
    alternate = "";
  }

  if (
    !primary &&
    !alternate
  ) {
    throw new Error(
      "Failed to extract PDF text by both parsers."
    );
  }

  return {
    primary:
      primary ||
      alternate,

    alternate:
      alternate ||
      primary,
  };
}

export function parseStudentIdentity(
  text: string
): ParsedStudentIdentity {
  const match =
    text.match(
      /\b(\d{2,3}-\d{4}-\d{3})\b/
    );

  if (!match) {
    return {
      studentId:
        null,

      batchCode:
        null,

      suffix:
        null,
    };
  }

  const studentId =
    match[1];

  const [
    batchCode,
    ,
    suffix,
  ] =
    studentId.split(
      "-"
    );

  return {
    studentId,

    batchCode:
      batchCode ||
      null,

    suffix:
      suffix ||
      null,
  };
}

function sanitizeTranscriptMultiline(
  text: string
) {
  let clean =
    normalizeMultiline(
      text
    );

  clean = clean
    .replace(
      /Semester\s*Code\s*Description\s*Credits\s*Grade/gi,
      ""
    )
    .replace(
      /SemesterCodeDescriptionCreditsGrade/gi,
      ""
    )
    .replace(
      /StudentID:/gi,
      "Student ID:"
    )
    .replace(
      /Printedon:/gi,
      "Printed on:"
    )
    .replace(
      /CreditsEarned/gi,
      "Credits Earned"
    )
    .replace(
      /TransferedCredits/gi,
      "Transfered Credits"
    )
    .replace(
      /[ \t]+/g,
      " "
    );

  const lines =
    clean
      .split("\n")
      .map(
        (line) =>
          normalizeInline(
            line
          )
      )
      .filter(
        Boolean
      );

  const output:
    string[] = [];

  for (
    const rawLine of
    lines
  ) {
    let line =
      rawLine;

    if (
      /^\*\*\s*Printed:/i.test(
        line
      )
    ) {
      continue;
    }

    if (
      /^Printed on:/i.test(
        line
      )
    ) {
      continue;
    }

    if (
      /^Student ID:/i.test(
        line
      )
    ) {
      continue;
    }

    if (
      /^Page\s+\d+\s+of\s+\d+/i.test(
        line
      )
    ) {
      continue;
    }

    line =
      line.replace(
        /\s+(?=(SPRING|SUMMER|FALL)\s+\d{4}\s+[A-Z]{2,6}\d{3,4}\b)/gi,
        "\n"
      );

    line =
      line.replace(
        /\s+\*\*\s*Printed:.*$/i,
        ""
      );

    line =
      line.replace(
        /\s+Page\s+\d+\s+of\s+\d+.*$/i,
        ""
      );

    const splitAgain =
      line
        .split(
          "\n"
        )
        .map(
          (part) =>
            normalizeInline(
              part
            )
        )
        .filter(
          Boolean
        );

    for (
      const item of
      splitAgain
    ) {
      output.push(
        item
      );
    }
  }

  return output.join(
    "\n"
  );
}

function sanitizeTranscriptCollapsed(
  text: string
) {
  return sanitizeTranscriptMultiline(
    text
  )
    .replace(
      /\n+/g,
      " "
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
}

function dedupeTranscriptRows(
  rows:
    ParsedTranscriptCourse[]
) {
  const seen =
    new Set<string>();

  const output:
    ParsedTranscriptCourse[] =
    [];

  for (
    const row of
    rows
  ) {
    const key = [
      row.semester,
      row.code,
      row.title.toLowerCase(),
      row.credits.toFixed(
        2
      ),
      row.grade,
    ].join("|");

    if (
      seen.has(
        key
      )
    ) {
      continue;
    }

    seen.add(
      key
    );

    output.push(
      row
    );
  }

  return output;
}

function parseTranscriptLine(
  line: string
):
  | ParsedTranscriptCourse
  | null {
  const match =
    line.match(
      /^(SPRING|SUMMER|FALL)\s+(\d{4})\s+([A-Z]{2,6}\d{3,4})\s+(.+?)\s+(\d+(?:\.\d+)?)\s+([A-F][+-]?|I|W)$/i
    );

  if (!match) {
    return null;
  }

  const semester =
    `${String(
      match[1]
    ).toUpperCase()} ${match[2]}`;

  const code =
    normalizeInline(
      match[3]
    ).toUpperCase();

  const title =
    normalizeInline(
      match[4]
    );

  const credits =
    Number(
      match[5]
    );

  const grade =
    normalizeInline(
      match[6]
    ).toUpperCase();

  if (
    !code ||
    !title ||
    Number.isNaN(
      credits
    ) ||
    !grade
  ) {
    return null;
  }

  return {
    semester,

    code,

    comparableCode:
      normalizeComparableCourseCode(
        code
      ),

    comparableTitle:
      normalizeComparableTitle(
        title
      ),

    title,

    credits,

    grade,
  };
}

function parseTranscriptCoursesByLines(
  text: string
):
  ParsedTranscriptCourse[] {
  const clean =
    sanitizeTranscriptMultiline(
      text
    );

  const lines =
    clean
      .split("\n")
      .map(
        (line) =>
          normalizeInline(
            line
          )
      )
      .filter(
        Boolean
      );

  const rows:
    ParsedTranscriptCourse[] =
    [];

  for (
    const line of
    lines
  ) {
    if (
      /^Credits Earned\s*:/i.test(
        line
      )
    ) {
      continue;
    }

    if (
      /^Transfered Credits\s*:/i.test(
        line
      )
    ) {
      continue;
    }

    if (
      /^GPA\s*:/i.test(
        line
      )
    ) {
      continue;
    }

    const parsed =
      parseTranscriptLine(
        line
      );

    if (parsed) {
      rows.push(
        parsed
      );
    }
  }

  return dedupeTranscriptRows(
    rows
  );
}

function parseTranscriptCoursesGlobalFallback(
  text: string
):
  ParsedTranscriptCourse[] {
  const clean =
    sanitizeTranscriptCollapsed(
      text
    );

  const rows:
    ParsedTranscriptCourse[] =
    [];

  const fullRegex =
    /(SPRING|SUMMER|FALL)\s*(\d{4})\s*([A-Z]{2,6}\d{3,4})\s+([\s\S]*?)\s+(\d+(?:\.\d+)?)\s+([A-F][+-]?|I|W)(?=\s+(?:SPRING|SUMMER|FALL)\s*\d{4}\s*[A-Z]{2,6}\d{3,4}|\s+Credits\s*Earned\b|\s+Transfered\s*Credits\b|\s+GPA\s*:|$)/gi;

  for (
    const match of
    clean.matchAll(
      fullRegex
    )
  ) {
    const semester =
      `${String(
        match[1]
      ).toUpperCase()} ${match[2]}`;

    const code =
      normalizeInline(
        match[3]
      ).toUpperCase();

    const title =
      normalizeInline(
        match[4]
      );

    const credits =
      Number(
        match[5]
      );

    const grade =
      normalizeInline(
        match[6]
      ).toUpperCase();

    if (
      !code ||
      !title ||
      Number.isNaN(
        credits
      ) ||
      !grade
    ) {
      continue;
    }

    rows.push({
      semester,

      code,

      comparableCode:
        normalizeComparableCourseCode(
          code
        ),

      comparableTitle:
        normalizeComparableTitle(
          title
        ),

      title,

      credits,

      grade,
    });
  }

  return dedupeTranscriptRows(
    rows
  );
}

export function parseTranscriptCourses(
  text: string
):
  ParsedTranscriptCourse[] {
  const lineRows =
    parseTranscriptCoursesByLines(
      text
    );

  if (
    lineRows.length >
    0
  ) {
    return lineRows;
  }

  return parseTranscriptCoursesGlobalFallback(
    text
  );
}

export function parseTranscriptEarnedCredits(
  text: string
):
  | number
  | null {
  const clean =
    sanitizeTranscriptCollapsed(
      text
    );

  const match =
    clean.match(
      /Credits\s*Earned\s*:\s*(\d+(?:\.\d+)?)/i
    );

  if (!match) {
    return null;
  }

  const value =
    Number(
      match[1]
    );

  return Number.isNaN(
    value
  )
    ? null
    : value;
}

export function parseRegistrationSemester(
  text: string
):
  | string
  | null {
  const match =
    text.match(
      /Registration\s+(Spring|Summer|Fall),?\s+(\d{4})/i
    );

  if (!match) {
    return null;
  }

  return `${match[1].toUpperCase()} ${match[2]}`;
}

export function parseRegistrationCourses(
  text: string
):
  ParsedRegistrationCourse[] {
  const clean =
    collapseText(
      text
    );

  const segments =
    clean.match(
      /A-[A-Z]{2,6}\d{3,4}CR:\d+(?:\.\d+)?Sec:\d+\s+.*?(?=A-[A-Z]{2,6}\d{3,4}CR:|Developed by:|Office Copy|Bank Copy|University Management Information System|$)/gi
    ) || [];

  const rows:
    ParsedRegistrationCourse[] =
    [];

  for (
    const segment of
    segments
  ) {
    /**
     * Important:
     *
     * The timetable marker may be separated from the title:
     *
     *   Automation Lab TH-12:00-13:00
     *
     * or concatenated directly:
     *
     *   Automation LabTH-12:00-13:00
     *
     * Therefore the look-ahead deliberately uses \s*
     * rather than requiring whitespace.
     */
    const match =
      normalizeInline(
        segment
      ).match(
        /^A-([A-Z]{2,6}\d{3,4})CR:(\d+(?:\.\d+)?)Sec:(\d+)\s+(.+?)(?=\s*(?:SU|SA|TH|MO|FR|WE|TU)-\d{1,2}:\d{2}|$)/i
      );

    if (!match) {
      continue;
    }

    const code =
      normalizeInline(
        match[1]
      ).toUpperCase();

    const title =
      cleanRegistrationTitle(
        match[4]
      );

    if (
      !code ||
      !title
    ) {
      continue;
    }

    rows.push({
      code,

      comparableCode:
        normalizeComparableCourseCode(
          code
        ),

      comparableTitle:
        normalizeComparableTitle(
          title
        ),

      credits:
        Number(
          match[2]
        ),

      section:
        normalizeInline(
          match[3]
        ) ||
        null,

      title,
    });
  }

  return rows;
}

const TERM_ORDER = [
  "SPRING",
  "SUMMER",
  "FALL",
];

export function compareTerms(
  a: string,
  b: string
) {
  const [
    aTerm,
    aYearText,
  ] =
    a.split(" ");

  const [
    bTerm,
    bYearText,
  ] =
    b.split(" ");

  const aYear =
    Number(
      aYearText
    );

  const bYear =
    Number(
      bYearText
    );

  if (
    aYear !== bYear
  ) {
    return (
      aYear -
      bYear
    );
  }

  return (
    TERM_ORDER.indexOf(
      aTerm
    ) -
    TERM_ORDER.indexOf(
      bTerm
    )
  );
}

export function getLatestTerm(
  terms: string[]
):
  | string
  | null {
  if (
    !terms.length
  ) {
    return null;
  }

  return (
    [...terms]
      .sort(
        compareTerms
      )
      .at(-1) ||
    null
  );
}

export function getNextTerm(
  term:
    | string
    | null
):
  | string
  | null {
  if (!term) {
    return null;
  }

  const [
    season,
    yearText,
  ] =
    term.split(" ");

  const year =
    Number(
      yearText
    );

  if (
    season ===
    "SPRING"
  ) {
    return `SUMMER ${year}`;
  }

  if (
    season ===
    "SUMMER"
  ) {
    return `FALL ${year}`;
  }

  if (
    season ===
    "FALL"
  ) {
    return `SPRING ${year + 1}`;
  }

  return null;
}

export function getCompletedCourseMap(
  courses:
    ParsedTranscriptCourse[]
) {
  const map =
    new Map<
      string,
      {
        code: string;
        comparableCode: string;
        comparableTitle: string;
        title: string;
        semester: string;
        credits: number;
        grade: string;
      }
    >();

  for (
    const row of
    courses
  ) {
    const isPassing =
      row.grade !==
        "F" &&
      row.grade !==
        "I" &&
      row.grade !==
        "W" &&
      row.credits >
        0;

    if (
      !isPassing
    ) {
      continue;
    }

    const existing =
      map.get(
        row.comparableCode
      );

    if (
      !existing ||
      compareTerms(
        existing.semester,
        row.semester
      ) <
        0
    ) {
      map.set(
        row.comparableCode,
        {
          code:
            row.code,

          comparableCode:
            row.comparableCode,

          comparableTitle:
            row.comparableTitle,

          title:
            row.title,

          semester:
            row.semester,

          credits:
            row.credits,

          grade:
            row.grade,
        }
      );
    }
  }

  return map;
}

export function getFailedOnlyCodes(
  courses:
    ParsedTranscriptCourse[]
) {
  const passed =
    new Set(
      courses
        .filter(
          (row) =>
            row.grade !==
              "F" &&
            row.grade !==
              "I" &&
            row.grade !==
              "W" &&
            row.credits >
              0
        )
        .map(
          (row) =>
            row.comparableCode
        )
    );

  const failed =
    new Set(
      courses
        .filter(
          (row) =>
            row.grade ===
              "F" ||
            row.grade ===
              "I" ||
            row.grade ===
              "W" ||
            row.credits <=
              0
        )
        .map(
          (row) =>
            row.comparableCode
        )
    );

  return [
    ...failed,
  ].filter(
    (code) =>
      !passed.has(
        code
      )
  );
}

export function sumCourseCredits(
  items:
    Array<{
      credits: number;
    }>
) {
  const total =
    items.reduce(
      (
        sum,
        item
      ) => {
        const numeric =
          Number(
            item.credits ||
              0
          );

        return (
          sum +
          (
            Number.isNaN(
              numeric
            )
              ? 0
              : numeric
          )
        );
      },
      0
    );

  return Number(
    total.toFixed(
      2
    )
  );
}

export function makeDebugTextSample(
  text: string,
  maxLength = 1500
) {
  return collapseText(
    text
  ).slice(
    0,
    maxLength
  );
}