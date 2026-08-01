export type BaeteCriterion = {
  key: string;
  title: string;
  description: string;
  score: number;
  weight: number;
  observation: string;
  evidence: string[];
};

export type BaeteCqiAction = {
  criterion: string;
  title: string;
  description: string;
  timeline: string;
  resources: string;
  successMetric: string;
  steps: string[];
  status: string;
  progress: number;
};

export const baeteSession = {
  name: "Spring 2026 Accreditation Review",
  academicYear: "2025-2026",
  semester: "Spring 2026",
  coordinator: "Dr. R. Hossain",
  deadline: "2026-04-30",
  scope: "Full program evaluation",
  program: "Electrical & Electronic Engineering Program",
  department: "Department of EEE",
};

export const baeteCriteria: BaeteCriterion[] = [
  {
    key: "C1",
    title: "Student Outcomes",
    description: "Student learning outcomes, assessment methods, achievement rates.",
    score: 3.5,
    weight: 25,
    observation: "Rubric pilot underway in 3 core courses.",
    evidence: ["CO attainment pilot sheet", "Rubric mapping draft", "Core course assessment sample"],
  },
  {
    key: "C2",
    title: "Program Educational Objectives",
    description: "PEO alignment, clarity, measurability, communication.",
    score: 4.0,
    weight: 20,
    observation: "PEOs revised with IAB input Q3 2025.",
    evidence: ["IAB meeting minutes", "PEO revision note", "Stakeholder feedback record"],
  },
  {
    key: "C3",
    title: "Continuous Improvement",
    description: "CQI process, deficiency closure, effectiveness.",
    score: 3.0,
    weight: 15,
    observation: "CQI template adopted; tracking improving.",
    evidence: ["CQI template", "Course file sample", "Action tracking sheet"],
  },
  {
    key: "C4",
    title: "Curriculum",
    description: "Alignment with outcomes, content, sequencing, labs.",
    score: 4.0,
    weight: 15,
    observation: "Data-analytics module approved.",
    evidence: ["Curriculum map", "Syllabus matrix", "Approved meeting resolution"],
  },
  {
    key: "C5",
    title: "Faculty",
    description: "Qualifications, development, teaching effectiveness.",
    score: 4.0,
    weight: 15,
    observation: "Faculty development calendar active.",
    evidence: ["Faculty profile matrix", "Training calendar", "Teaching evaluation summary"],
  },
  {
    key: "C6",
    title: "Facilities",
    description: "Labs, equipment, technology, maintenance.",
    score: 2.8,
    weight: 10,
    observation: "Power-systems lab upgrade pending procurement.",
    evidence: ["Lab inventory report", "Procurement note", "Safety checklist draft"],
  },
  {
    key: "C7",
    title: "Institutional Support",
    description: "Commitment, administration, budget, policies.",
    score: 3.5,
    weight: 0,
    observation: "3-year budget approved.",
    evidence: ["Budget approval", "Policy support note", "Administrative meeting record"],
  },
];

export const roadmapTimeline = [
  {
    phase: "Phase 1",
    period: "Weeks 1-24 (M1-M6)",
    focus: "System Build & Design",
  },
  {
    phase: "Phase 2",
    period: "Weeks 25-72 (M7-M18)",
    focus: "Full OBE Execution + CQI",
  },
  {
    phase: "Mock Audit",
    period: "Week 72 (Month 18)",
    focus: "18-Month Mock BAETE Review",
  },
  {
    phase: "Phase 3",
    period: "Weeks 73-96 (M19-M23)",
    focus: "Stabilization & Refinement",
  },
  {
    phase: "Phase 4",
    period: "Weeks 97-104 (M23-M24)",
    focus: "SAR Finalization & Submission",
  },
];

export const deficiencyTriggers = [
  { issue: "Missing CO-PO mapping", severity: "CRITICAL" },
  { issue: "Lab safety certification absent", severity: "CRITICAL" },
  { issue: "No CQI closed loop", severity: "MAJOR" },
  { issue: "No WP complexity in assessments", severity: "MAJOR" },
  { issue: "No industry/stakeholder engagement", severity: "MAJOR" },
  { issue: "Faculty ratio non-compliant", severity: "MAJOR" },
  { issue: "Incomplete evidence indexing", severity: "MINOR" },
];

export const graduateAttributes = [
  ["PO1", "Engineering Knowledge", "K1-K8", "CT, End-sem exams"],
  ["PO2", "Problem Analysis", "WP1-WP7", "Complex engineering problems"],
  ["PO3", "Design/Development of Solutions", "EA1-EA5", "Projects, design assignments"],
  ["PO4", "Investigation", "—", "Lab reports, research projects"],
  ["PO5", "Modern Tool Usage", "—", "Software-based labs"],
  ["PO6", "Engineer & Society", "SDG linked", "Project impact analysis"],
  ["PO7", "Environment & Sustainability", "SDG 7,9,13", "SDG-mapped assessments"],
  ["PO8", "Ethics", "—", "Ethics case studies"],
  ["PO9", "Individual & Team Work", "—", "Group project rubrics"],
  ["PO10", "Communication", "—", "Reports, presentations"],
  ["PO11", "Project Management", "—", "Capstone project"],
  ["PO12", "Lifelong Learning", "—", "Portfolios, alumni feedback"],
];

export const cqiActions: BaeteCqiAction[] = [
  {
    criterion: "Student Outcomes",
    title: "Redesign Student Outcome Assessment Framework",
    description:
      "Implement rubric-based direct assessment across capstone and core courses to produce measurable student outcome data.",
    timeline: "2 semesters",
    resources: "Faculty time (40h), assessment software license",
    successMetric: "≥80% courses with rubric-based direct assessment; outcome attainment ≥70%",
    steps: [
      "Form an outcome-assessment committee",
      "Map outcomes to courses",
      "Design rubrics for direct assessment",
      "Pilot in 3 core courses",
      "Roll out program-wide",
    ],
    status: "Planned",
    progress: 0,
  },
  {
    criterion: "Continuous Improvement",
    title: "Institutionalize CQI Cycle Documentation",
    description:
      "Create a closed-loop CQI workflow with documented actions, owners, evidence, and effectiveness measurements.",
    timeline: "1 year",
    resources: "Coordinator time; document repository",
    successMetric: "100% deficiencies tracked; ≥75% closed within target timeline",
    steps: [
      "Adopt CQI template",
      "Train coordinators",
      "Log all open deficiencies",
      "Quarterly review meetings",
      "Effectiveness reporting",
    ],
    status: "Planned",
    progress: 0,
  },
  {
    criterion: "Facilities",
    title: "Laboratory Modernization Initiative",
    description:
      "Audit lab inventory, retire obsolete equipment, and procure modern instruments aligned with current curriculum.",
    timeline: "12-18 months",
    resources: "Capital budget; vendor partnerships",
    successMetric: "≥3 labs upgraded; ≥90% equipment functional",
    steps: [
      "Inventory and condition audit",
      "Identify priority labs",
      "Prepare capital request",
      "Procure equipment",
      "Train staff and students",
    ],
    status: "Planned",
    progress: 0,
  },
  {
    criterion: "Institutional Support",
    title: "Strengthen Institutional Support Mechanisms",
    description:
      "Secure formal commitment in budget, staffing, and policy frameworks for program needs.",
    timeline: "1 year",
    resources: "Executive sponsorship",
    successMetric: "Approved 3-year budget; documented policy support",
    steps: [
      "Document program resource gaps",
      "Present to senior management",
      "Negotiate multi-year budget",
      "Codify support policies",
      "Annual review",
    ],
    status: "Planned",
    progress: 0,
  },
];

export function getSeverity(score: number) {
  if (score < 2) return "Critical";
  if (score < 3) return "Major";
  if (score < 3.6) return "Minor";
  return "Healthy";
}

export function getVerdict(score: number) {
  if (score >= 4) return "Healthy";
  if (score >= 3.6) return "Ready";
  if (score >= 3) return "Minor Issues";
  if (score >= 2) return "Major Revision";
  return "Critical";
}

export function getOpenDeficiencies() {
  return baeteCriteria.filter((criterion) => criterion.score < 3.6);
}

export function calculateAverageScore() {
  const total = baeteCriteria.reduce((sum, item) => sum + item.score, 0);
  return Number((total / baeteCriteria.length).toFixed(2));
}

export function calculateWeightedOrs() {
  const weightedItems = baeteCriteria.filter((item) => item.weight > 0);
  const totalWeight = weightedItems.reduce((sum, item) => sum + item.weight, 0);
  const weightedScore = weightedItems.reduce(
    (sum, item) => sum + item.score * item.weight,
    0
  );

  return Number(((weightedScore / totalWeight) * 20).toFixed(1));
}
