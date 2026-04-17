export type CatalogProgram = {
  id: string;
  departmentCode: string;
  departmentName: string;
  programCode: string;
  programTitle: string;
  programType: string;
  studyShift: "REG" | "EVE" | "ACC" | "OTH" | "NONE";
  curriculumVersion: "OLD" | "NEW" | "NONE";
  displayLabel: string;
  active: boolean;
};

export const ACADEMIC_CATALOG: CatalogProgram[] = [
  {
    id: "BSC-EEE-REG-NEW",
    departmentCode: "EEE",
    departmentName: "Department of Electrical and Electronic Engineering",
    programCode: "BSC-EEE-REG-NEW",
    programTitle: "BSc in Electrical and Electronic Engineering",
    programType: "Bachelor",
    studyShift: "REG",
    curriculumVersion: "NEW",
    displayLabel: "EEE | BSc EEE | Regular | New Curriculum",
    active: true,
  },
  {
    id: "BSC-EEE-EVE-NEW",
    departmentCode: "EEE",
    departmentName: "Department of Electrical and Electronic Engineering",
    programCode: "BSC-EEE-EVE-NEW",
    programTitle: "BSc in Electrical and Electronic Engineering",
    programType: "Bachelor",
    studyShift: "EVE",
    curriculumVersion: "NEW",
    displayLabel: "EEE | BSc EEE | Evening | New Curriculum",
    active: true,
  },
  {
    id: "BSC-EEE-REG-OLD",
    departmentCode: "EEE",
    departmentName: "Department of Electrical and Electronic Engineering",
    programCode: "BSC-EEE-REG-OLD",
    programTitle: "BSc in Electrical and Electronic Engineering",
    programType: "Bachelor",
    studyShift: "REG",
    curriculumVersion: "OLD",
    displayLabel: "EEE | BSc EEE | Regular | Old Curriculum",
    active: true,
  },
  {
    id: "BSC-EEE-EVE-OLD",
    departmentCode: "EEE",
    departmentName: "Department of Electrical and Electronic Engineering",
    programCode: "BSC-EEE-EVE-OLD",
    programTitle: "BSc in Electrical and Electronic Engineering",
    programType: "Bachelor",
    studyShift: "EVE",
    curriculumVersion: "OLD",
    displayLabel: "EEE | BSc EEE | Evening | Old Curriculum",
    active: true,
  },
  {
    id: "BSC-RAE-REG-OLD",
    departmentCode: "RAE",
    departmentName: "Department of Robotics and Automation Engineering",
    programCode: "BSC-RAE-REG-OLD",
    programTitle: "BSc in Robotics and Automation Engineering",
    programType: "Bachelor",
    studyShift: "REG",
    curriculumVersion: "OLD",
    displayLabel: "RAE | BSc RAE | Regular | Old Curriculum",
    active: true,
  },
  {
    id: "BSC-RAE-REG-NEW",
    departmentCode: "RAE",
    departmentName: "Department of Robotics and Automation Engineering",
    programCode: "BSC-RAE-REG-NEW",
    programTitle: "BSc in Robotics and Automation Engineering",
    programType: "Bachelor",
    studyShift: "REG",
    curriculumVersion: "NEW",
    displayLabel: "RAE | BSc RAE | Regular | New Curriculum",
    active: true,
  },
];

export function getCatalogProgramByCode(code: string) {
  const normalized = String(code || "").trim().toUpperCase();
  return ACADEMIC_CATALOG.find((item) => item.programCode === normalized) || null;
}

export function getCatalogDepartmentOptions() {
  const seen = new Map<string, { code: string; name: string }>();

  for (const item of ACADEMIC_CATALOG) {
    if (!seen.has(item.departmentCode)) {
      seen.set(item.departmentCode, {
        code: item.departmentCode,
        name: item.departmentName,
      });
    }
  }

  return Array.from(seen.values()).sort((a, b) => a.code.localeCompare(b.code));
}

export function getCatalogProgramOptions() {
  return ACADEMIC_CATALOG.filter((item) => item.active).sort((a, b) =>
    a.displayLabel.localeCompare(b.displayLabel)
  );
}