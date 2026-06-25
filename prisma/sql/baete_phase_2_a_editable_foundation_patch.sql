CREATE TABLE IF NOT EXISTS baete_committees (
  id SERIAL PRIMARY KEY,
  committee_code VARCHAR(80) NOT NULL UNIQUE,
  committee_name VARCHAR(200) NOT NULL,
  description TEXT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_by_user_id INTEGER NULL,
  updated_by_user_id INTEGER NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_baete_committees_created_by
    FOREIGN KEY (created_by_user_id)
    REFERENCES users(id)
    ON DELETE SET NULL,

  CONSTRAINT fk_baete_committees_updated_by
    FOREIGN KEY (updated_by_user_id)
    REFERENCES users(id)
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS baete_workspace_modules (
  id SERIAL PRIMARY KEY,
  module_code VARCHAR(80) NOT NULL UNIQUE,
  module_title VARCHAR(200) NOT NULL,
  description TEXT NULL,
  route_path VARCHAR(250) NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS baete_roadmap_items (
  id SERIAL PRIMARY KEY,
  phase_code VARCHAR(80) NOT NULL,
  phase_title VARCHAR(200) NOT NULL,
  period_label VARCHAR(150) NULL,
  focus_area TEXT NULL,
  description TEXT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'PLANNED',
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by_user_id INTEGER NULL,
  updated_by_user_id INTEGER NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_baete_roadmap_items_created_by
    FOREIGN KEY (created_by_user_id)
    REFERENCES users(id)
    ON DELETE SET NULL,

  CONSTRAINT fk_baete_roadmap_items_updated_by
    FOREIGN KEY (updated_by_user_id)
    REFERENCES users(id)
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS baete_criteria (
  id SERIAL PRIMARY KEY,
  criterion_code VARCHAR(50) NOT NULL UNIQUE,
  title VARCHAR(250) NOT NULL,
  description TEXT NULL,
  weight DOUBLE PRECISION NOT NULL DEFAULT 0,
  minimum_acceptable_score DOUBLE PRECISION NOT NULL DEFAULT 3.6,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by_user_id INTEGER NULL,
  updated_by_user_id INTEGER NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_baete_criteria_created_by
    FOREIGN KEY (created_by_user_id)
    REFERENCES users(id)
    ON DELETE SET NULL,

  CONSTRAINT fk_baete_criteria_updated_by
    FOREIGN KEY (updated_by_user_id)
    REFERENCES users(id)
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS baete_deficiency_rules (
  id SERIAL PRIMARY KEY,
  rule_name VARCHAR(120) NOT NULL,
  severity_label VARCHAR(80) NOT NULL,
  min_score DOUBLE PRECISION NOT NULL DEFAULT 0,
  max_score DOUBLE PRECISION NOT NULL DEFAULT 5,
  color_label VARCHAR(80) NULL,
  recommended_action TEXT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by_user_id INTEGER NULL,
  updated_by_user_id INTEGER NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_baete_deficiency_rules_created_by
    FOREIGN KEY (created_by_user_id)
    REFERENCES users(id)
    ON DELETE SET NULL,

  CONSTRAINT fk_baete_deficiency_rules_updated_by
    FOREIGN KEY (updated_by_user_id)
    REFERENCES users(id)
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS baete_graduate_attributes (
  id SERIAL PRIMARY KEY,
  po_code VARCHAR(50) NOT NULL UNIQUE,
  graduate_attribute VARCHAR(250) NOT NULL,
  baete_code VARCHAR(100) NULL,
  assessment_evidence TEXT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by_user_id INTEGER NULL,
  updated_by_user_id INTEGER NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_baete_graduate_attributes_created_by
    FOREIGN KEY (created_by_user_id)
    REFERENCES users(id)
    ON DELETE SET NULL,

  CONSTRAINT fk_baete_graduate_attributes_updated_by
    FOREIGN KEY (updated_by_user_id)
    REFERENCES users(id)
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS baete_cqi_templates (
  id SERIAL PRIMARY KEY,
  criterion_id INTEGER NULL,
  criterion_label VARCHAR(250) NULL,
  title VARCHAR(250) NOT NULL,
  description TEXT NULL,
  timeline VARCHAR(150) NULL,
  resources TEXT NULL,
  success_metric TEXT NULL,
  implementation_steps TEXT NULL,
  default_status VARCHAR(60) NOT NULL DEFAULT 'Planned',
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by_user_id INTEGER NULL,
  updated_by_user_id INTEGER NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_baete_cqi_templates_criterion
    FOREIGN KEY (criterion_id)
    REFERENCES baete_criteria(id)
    ON DELETE SET NULL,

  CONSTRAINT fk_baete_cqi_templates_created_by
    FOREIGN KEY (created_by_user_id)
    REFERENCES users(id)
    ON DELETE SET NULL,

  CONSTRAINT fk_baete_cqi_templates_updated_by
    FOREIGN KEY (updated_by_user_id)
    REFERENCES users(id)
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS baete_audit_sessions (
  id SERIAL PRIMARY KEY,
  session_name VARCHAR(250) NOT NULL,
  academic_year VARCHAR(100) NULL,
  semester_name VARCHAR(100) NULL,
  department_id INTEGER NULL,
  program_id INTEGER NULL,
  coordinator_user_id INTEGER NULL,
  review_deadline DATE NULL,
  audit_scope TEXT NULL,
  status VARCHAR(60) NOT NULL DEFAULT 'DRAFT',
  overall_score DOUBLE PRECISION NOT NULL DEFAULT 0,
  overall_readiness_score DOUBLE PRECISION NOT NULL DEFAULT 0,
  remarks TEXT NULL,
  created_by_user_id INTEGER NULL,
  updated_by_user_id INTEGER NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_baete_audit_sessions_department
    FOREIGN KEY (department_id)
    REFERENCES departments(id)
    ON DELETE SET NULL,

  CONSTRAINT fk_baete_audit_sessions_program
    FOREIGN KEY (program_id)
    REFERENCES programs(id)
    ON DELETE SET NULL,

  CONSTRAINT fk_baete_audit_sessions_coordinator
    FOREIGN KEY (coordinator_user_id)
    REFERENCES users(id)
    ON DELETE SET NULL,

  CONSTRAINT fk_baete_audit_sessions_created_by
    FOREIGN KEY (created_by_user_id)
    REFERENCES users(id)
    ON DELETE SET NULL,

  CONSTRAINT fk_baete_audit_sessions_updated_by
    FOREIGN KEY (updated_by_user_id)
    REFERENCES users(id)
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS baete_task_groups (
  id SERIAL PRIMARY KEY,
  module_id INTEGER NOT NULL,
  group_code VARCHAR(100) NOT NULL,
  group_title VARCHAR(250) NOT NULL,
  description TEXT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by_user_id INTEGER NULL,
  updated_by_user_id INTEGER NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_baete_task_groups_module
    FOREIGN KEY (module_id)
    REFERENCES baete_workspace_modules(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_baete_task_groups_created_by
    FOREIGN KEY (created_by_user_id)
    REFERENCES users(id)
    ON DELETE SET NULL,

  CONSTRAINT fk_baete_task_groups_updated_by
    FOREIGN KEY (updated_by_user_id)
    REFERENCES users(id)
    ON DELETE SET NULL,

  CONSTRAINT uq_baete_task_group_module_code
    UNIQUE (module_id, group_code)
);

CREATE TABLE IF NOT EXISTS baete_tasks (
  id SERIAL PRIMARY KEY,
  task_group_id INTEGER NOT NULL,
  task_code VARCHAR(120) NULL,
  title VARCHAR(300) NOT NULL,
  description TEXT NULL,
  deliverable TEXT NULL,
  evidence_format VARCHAR(200) NULL,
  evidence_reference VARCHAR(250) NULL,
  priority VARCHAR(40) NOT NULL DEFAULT 'NORMAL',
  status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
  is_critical BOOLEAN NOT NULL DEFAULT FALSE,
  requires_checkbox BOOLEAN NOT NULL DEFAULT TRUE,
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMPTZ NULL,
  completion_note TEXT NULL,
  assigned_committee_id INTEGER NULL,
  assigned_user_id INTEGER NULL,
  start_month INTEGER NULL,
  end_month INTEGER NULL,
  start_week INTEGER NULL,
  end_week INTEGER NULL,
  due_date DATE NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by_user_id INTEGER NULL,
  updated_by_user_id INTEGER NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_baete_tasks_task_group
    FOREIGN KEY (task_group_id)
    REFERENCES baete_task_groups(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_baete_tasks_committee
    FOREIGN KEY (assigned_committee_id)
    REFERENCES baete_committees(id)
    ON DELETE SET NULL,

  CONSTRAINT fk_baete_tasks_assigned_user
    FOREIGN KEY (assigned_user_id)
    REFERENCES users(id)
    ON DELETE SET NULL,

  CONSTRAINT fk_baete_tasks_created_by
    FOREIGN KEY (created_by_user_id)
    REFERENCES users(id)
    ON DELETE SET NULL,

  CONSTRAINT fk_baete_tasks_updated_by
    FOREIGN KEY (updated_by_user_id)
    REFERENCES users(id)
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS baete_task_updates (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL,
  old_status VARCHAR(50) NULL,
  new_status VARCHAR(50) NULL,
  old_completed BOOLEAN NULL,
  new_completed BOOLEAN NULL,
  note TEXT NULL,
  updated_by_user_id INTEGER NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_baete_task_updates_task
    FOREIGN KEY (task_id)
    REFERENCES baete_tasks(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_baete_task_updates_user
    FOREIGN KEY (updated_by_user_id)
    REFERENCES users(id)
    ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS ix_baete_committees_is_active ON baete_committees(is_active);
CREATE INDEX IF NOT EXISTS ix_baete_workspace_modules_order ON baete_workspace_modules(display_order);
CREATE INDEX IF NOT EXISTS ix_baete_roadmap_items_status ON baete_roadmap_items(status);
CREATE INDEX IF NOT EXISTS ix_baete_roadmap_items_display_order ON baete_roadmap_items(display_order);
CREATE INDEX IF NOT EXISTS ix_baete_criteria_display_order ON baete_criteria(display_order);
CREATE INDEX IF NOT EXISTS ix_baete_deficiency_rules_score_range ON baete_deficiency_rules(min_score, max_score);
CREATE INDEX IF NOT EXISTS ix_baete_graduate_attributes_display_order ON baete_graduate_attributes(display_order);
CREATE INDEX IF NOT EXISTS ix_baete_cqi_templates_criterion_id ON baete_cqi_templates(criterion_id);
CREATE INDEX IF NOT EXISTS ix_baete_audit_sessions_status ON baete_audit_sessions(status);
CREATE INDEX IF NOT EXISTS ix_baete_task_groups_module_id ON baete_task_groups(module_id);
CREATE INDEX IF NOT EXISTS ix_baete_tasks_task_group_id ON baete_tasks(task_group_id);
CREATE INDEX IF NOT EXISTS ix_baete_tasks_assigned_committee_id ON baete_tasks(assigned_committee_id);
CREATE INDEX IF NOT EXISTS ix_baete_tasks_status ON baete_tasks(status);
CREATE INDEX IF NOT EXISTS ix_baete_tasks_is_completed ON baete_tasks(is_completed);
CREATE INDEX IF NOT EXISTS ix_baete_tasks_priority ON baete_tasks(priority);
CREATE INDEX IF NOT EXISTS ix_baete_tasks_week_range ON baete_tasks(start_week, end_week);
CREATE INDEX IF NOT EXISTS ix_baete_tasks_month_range ON baete_tasks(start_month, end_month);
CREATE INDEX IF NOT EXISTS ix_baete_task_updates_task_id ON baete_task_updates(task_id);

INSERT INTO baete_committees (
  committee_code,
  committee_name,
  description,
  display_order,
  is_active
)
VALUES
  ('ASC', 'Accreditation Steering Committee', 'Overall BAETE preparation steering, policy, and approval committee.', 1, TRUE),
  ('IQAC', 'IQAC / Quality System Committee', 'Quality assurance, audit readiness, CQI tracking, and evidence validation committee.', 2, TRUE),
  ('CURRICULUM', 'Curriculum Committee', 'PEO, PO, CO, curriculum map, SDG mapping, and assessment framework committee.', 3, TRUE),
  ('ASSESSMENT', 'Assessment Committee', 'Question paper, rubric, Bloom taxonomy, WP complexity, and marks evidence committee.', 4, TRUE),
  ('LAB', 'Lab Committee', 'Lab safety, equipment, open-ended experiment, and lab documentation committee.', 5, TRUE),
  ('FACULTY', 'Faculty Development Committee', 'Faculty CV, training, publication, and professional development evidence committee.', 6, TRUE),
  ('IAP', 'Industry Advisory Panel Committee', 'Industry advisory panel, employer feedback, alumni feedback, and stakeholder engagement committee.', 7, TRUE),
  ('SAR', 'SAR Writing Team', 'Self-assessment report preparation, chapter completion, and appendix indexing team.', 8, TRUE),
  ('DOCUMENTATION', 'Documentation Team', 'Document indexing, storage, checklist completion, and evidence code control team.', 9, TRUE),
  ('HOD', 'Head of Department Office', 'Department head oversight and institutional coordination.', 10, TRUE)
ON CONFLICT (committee_code) DO NOTHING;

INSERT INTO baete_workspace_modules (
  module_code,
  module_title,
  description,
  route_path,
  display_order,
  is_active
)
VALUES
  ('DASHBOARD', 'Dashboard', 'Overall accreditation readiness dashboard and ORS summary.', '/admin/accreditation', 1, TRUE),
  ('GANTT_24_MONTH', '24-Month Gantt', '24-month accreditation implementation Gantt chart and milestone timeline.', '/admin/accreditation/roadmap/gantt', 2, TRUE),
  ('WEEKLY_PLAN', 'Weekly Plan', '104-week controlled implementation plan with week-wise deliverables.', '/admin/accreditation/roadmap/weekly-plan', 3, TRUE),
  ('PREREQUISITES', 'Prerequisites', 'BAETE prerequisite checklist with completion tracking.', '/admin/accreditation/prerequisites', 4, TRUE),
  ('DOCUMENTATION', 'Documentation', 'Evidence and documentation preparation checklist.', '/admin/accreditation/documentation', 5, TRUE),
  ('MOCK_AUDIT_18_MONTH', '18-Month Mock Audit', '18-month mock audit preparation, schedule, panel, evidence, and correction plan.', '/admin/accreditation/mock-audit-18-month', 6, TRUE)
ON CONFLICT (module_code) DO NOTHING;

INSERT INTO baete_roadmap_items (
  phase_code,
  phase_title,
  period_label,
  focus_area,
  description,
  status,
  display_order,
  is_active
)
VALUES
  ('PHASE_1', 'Phase 1', 'Weeks 1-24 (M1-M6)', 'System Build & Design', 'Governance setup, PEO/PO development, CO development, CO-PO-WP-SDG mapping, assessment framework, lab restructuring, faculty training, and evidence indexing.', 'PLANNED', 1, TRUE),
  ('PHASE_2', 'Phase 2', 'Weeks 25-72 (M7-M18)', 'Full OBE Execution + CQI', 'Full OBE semester execution, CT/lab assessment, CQI cycle, industry panel, alumni feedback, SAR evidence collection, and mock audit preparation.', 'PLANNED', 2, TRUE),
  ('MOCK_AUDIT', 'Mock Audit', 'Week 72 (Month 18)', '18-Month Mock BAETE Review', 'Run simulated BAETE review, score modules, identify deficiencies, and prepare correction plan.', 'PLANNED', 3, TRUE),
  ('PHASE_3', 'Phase 3', 'Weeks 73-96 (M19-M23)', 'Stabilization & Refinement', 'Mock audit action plan, validation, curriculum refinement, lab certification, IAP feedback, pre-audit strengthening, and SAR drafting.', 'PLANNED', 4, TRUE),
  ('PHASE_4', 'Phase 4', 'Weeks 97-104 (M23-M24)', 'SAR Finalization & Submission', 'Final audit review, SAR final correction, and BAETE submission package finalization.', 'PLANNED', 5, TRUE)
ON CONFLICT DO NOTHING;

INSERT INTO baete_criteria (
  criterion_code,
  title,
  description,
  weight,
  minimum_acceptable_score,
  display_order,
  is_active
)
VALUES
  ('C1', 'Curriculum & Mapping', 'Curriculum, CO-PO-WP-SDG mapping, PEO/PO/CO alignment, and syllabus evidence.', 25, 3.6, 1, TRUE),
  ('C2', 'Assessment Quality', 'Assessment framework, CT, end-semester question quality, rubric, Bloom taxonomy, and WP complexity.', 20, 3.6, 2, TRUE),
  ('C3', 'CQI System', 'Closed-loop CQI, before/after evidence, action logs, and effectiveness tracking.', 15, 3.6, 3, TRUE),
  ('C4', 'Lab Infrastructure', 'Lab safety, equipment, open-ended experiments, software, and lab record evidence.', 15, 3.6, 4, TRUE),
  ('C5', 'Faculty Quality', 'Faculty qualification, training, publication, OBE capacity, and industry exposure.', 15, 3.6, 5, TRUE),
  ('C6', 'Stakeholders', 'IAP, alumni, employer, graduate exit survey, and stakeholder feedback action loop.', 10, 3.6, 6, TRUE)
ON CONFLICT (criterion_code) DO NOTHING;

INSERT INTO baete_deficiency_rules (
  rule_name,
  severity_label,
  min_score,
  max_score,
  color_label,
  recommended_action,
  display_order,
  is_active
)
VALUES
  ('Critical deficiency', 'Critical', 0, 1.99, 'red', 'Immediate corrective action and executive intervention required.', 1, TRUE),
  ('Major deficiency', 'Major', 2, 2.99, 'orange', 'Substantial improvement plan required with owner, deadline, and follow-up evidence.', 2, TRUE),
  ('Minor deficiency', 'Minor', 3, 3.59, 'amber', 'Minor gap closure required before final readiness review.', 3, TRUE),
  ('Healthy readiness', 'Healthy', 3.6, 5, 'green', 'Maintain evidence and continue CQI tracking.', 4, TRUE)
ON CONFLICT DO NOTHING;

INSERT INTO baete_graduate_attributes (
  po_code,
  graduate_attribute,
  baete_code,
  assessment_evidence,
  display_order,
  is_active
)
VALUES
  ('PO1', 'Engineering Knowledge', 'K1-K8', 'CT, end-semester examinations', 1, TRUE),
  ('PO2', 'Problem Analysis', 'WP1-WP7', 'Complex engineering problems', 2, TRUE),
  ('PO3', 'Design/Development of Solutions', 'EA1-EA5', 'Projects and design assignments', 3, TRUE),
  ('PO4', 'Investigation', '-', 'Lab reports and research projects', 4, TRUE),
  ('PO5', 'Modern Tool Usage', '-', 'Software-based labs', 5, TRUE),
  ('PO6', 'Engineer & Society', 'SDG linked', 'Project impact analysis', 6, TRUE),
  ('PO7', 'Environment & Sustainability', 'SDG 7,9,13', 'SDG-mapped assessments', 7, TRUE),
  ('PO8', 'Ethics', '-', 'Ethics case studies', 8, TRUE),
  ('PO9', 'Individual & Team Work', '-', 'Group project rubrics', 9, TRUE),
  ('PO10', 'Communication', '-', 'Reports and presentations', 10, TRUE),
  ('PO11', 'Project Management', '-', 'Capstone project', 11, TRUE),
  ('PO12', 'Lifelong Learning', '-', 'Portfolios and alumni feedback', 12, TRUE)
ON CONFLICT (po_code) DO NOTHING;

INSERT INTO baete_cqi_templates (
  criterion_id,
  criterion_label,
  title,
  description,
  timeline,
  resources,
  success_metric,
  implementation_steps,
  default_status,
  display_order,
  is_active
)
SELECT
  c.id,
  c.title,
  'Redesign Student Outcome Assessment Framework',
  'Implement rubric-based direct assessment across capstone and core courses.',
  '2 semesters',
  'Faculty time and assessment software',
  'At least 80 percent courses with rubric-based direct assessment.',
  '1. Form assessment committee
2. Map outcomes to courses
3. Design rubrics
4. Pilot in core courses
5. Roll out program-wide',
  'Planned',
  1,
  TRUE
FROM baete_criteria c
WHERE c.criterion_code = 'C1'
  AND NOT EXISTS (
    SELECT 1 FROM baete_cqi_templates t
    WHERE t.title = 'Redesign Student Outcome Assessment Framework'
  );

INSERT INTO baete_cqi_templates (
  criterion_id,
  criterion_label,
  title,
  description,
  timeline,
  resources,
  success_metric,
  implementation_steps,
  default_status,
  display_order,
  is_active
)
SELECT
  c.id,
  c.title,
  'Institutionalize CQI Cycle Documentation',
  'Create a closed-loop CQI workflow with documented actions, owners, evidence, and effectiveness measurements.',
  '1 year',
  'Coordinator time and document repository',
  'All deficiencies tracked and most closed within target timeline.',
  '1. Adopt CQI template
2. Train coordinators
3. Log open deficiencies
4. Quarterly review meetings
5. Effectiveness reporting',
  'Planned',
  2,
  TRUE
FROM baete_criteria c
WHERE c.criterion_code = 'C3'
  AND NOT EXISTS (
    SELECT 1 FROM baete_cqi_templates t
    WHERE t.title = 'Institutionalize CQI Cycle Documentation'
  );

INSERT INTO baete_audit_sessions (
  session_name,
  academic_year,
  semester_name,
  review_deadline,
  audit_scope,
  status,
  overall_score,
  overall_readiness_score,
  remarks
)
SELECT
  'Spring 2026 Accreditation Review',
  '2025-2026',
  'Spring 2026',
  DATE '2026-04-30',
  'Full program evaluation',
  'DRAFT',
  0,
  0,
  'Seed mock audit session created during BAETE Phase 2-A foundation.'
WHERE NOT EXISTS (
  SELECT 1 FROM baete_audit_sessions
  WHERE session_name = 'Spring 2026 Accreditation Review'
);

INSERT INTO baete_task_groups (
  module_id,
  group_code,
  group_title,
  description,
  display_order,
  is_active
)
SELECT m.id, 'GANTT_MAIN', '24-Month BAETE Accreditation Gantt Chart', 'Dynamic Gantt deliverables from month 1 to month 24.', 1, TRUE
FROM baete_workspace_modules m
WHERE m.module_code = 'GANTT_24_MONTH'
ON CONFLICT (module_id, group_code) DO NOTHING;

INSERT INTO baete_task_groups (
  module_id,
  group_code,
  group_title,
  description,
  display_order,
  is_active
)
SELECT m.id, 'WEEKLY_104', '104-Week Implementation Plan', 'Week-by-week implementation deliverables and evidence tracking.', 1, TRUE
FROM baete_workspace_modules m
WHERE m.module_code = 'WEEKLY_PLAN'
ON CONFLICT (module_id, group_code) DO NOTHING;

INSERT INTO baete_task_groups (
  module_id,
  group_code,
  group_title,
  description,
  display_order,
  is_active
)
SELECT m.id, 'PREREQ_INSTITUTIONAL', 'Institutional & Legal Requirements', 'Recognition, department establishment, program duration, batch size, affiliation, and safety approval prerequisites.', 1, TRUE
FROM baete_workspace_modules m
WHERE m.module_code = 'PREREQUISITES'
ON CONFLICT (module_id, group_code) DO NOTHING;

INSERT INTO baete_task_groups (
  module_id,
  group_code,
  group_title,
  description,
  display_order,
  is_active
)
SELECT m.id, 'PREREQ_FACULTY', 'Faculty Requirements', 'Faculty count, student-faculty ratio, PhD ratio, training, CV, publication, and leadership requirements.', 2, TRUE
FROM baete_workspace_modules m
WHERE m.module_code = 'PREREQUISITES'
ON CONFLICT (module_id, group_code) DO NOTHING;

INSERT INTO baete_task_groups (
  module_id,
  group_code,
  group_title,
  description,
  display_order,
  is_active
)
SELECT m.id, 'DOC_OBE', 'OBE Framework Documents', 'PEO, PO, CO, CO-PO, WP, SDG, lesson plan, and OBE framework documents.', 1, TRUE
FROM baete_workspace_modules m
WHERE m.module_code = 'DOCUMENTATION'
ON CONFLICT (module_id, group_code) DO NOTHING;

INSERT INTO baete_task_groups (
  module_id,
  group_code,
  group_title,
  description,
  display_order,
  is_active
)
SELECT m.id, 'DOC_ASSESSMENT', 'Assessment Documents', 'Question papers, model answers, WP examples, Bloom taxonomy, rubrics, scripts, moderation reports, and grade reports.', 2, TRUE
FROM baete_workspace_modules m
WHERE m.module_code = 'DOCUMENTATION'
ON CONFLICT (module_id, group_code) DO NOTHING;

INSERT INTO baete_task_groups (
  module_id,
  group_code,
  group_title,
  description,
  display_order,
  is_active
)
SELECT m.id, 'MOCK_AUDIT_PREP', '18-Month Mock Audit Preparation', 'Mock audit panel, 3-day schedule, evidence preparation, correction plan, and SAR checklist.', 1, TRUE
FROM baete_workspace_modules m
WHERE m.module_code = 'MOCK_AUDIT_18_MONTH'
ON CONFLICT (module_id, group_code) DO NOTHING;

INSERT INTO baete_tasks (
  task_group_id,
  task_code,
  title,
  description,
  deliverable,
  evidence_format,
  evidence_reference,
  priority,
  status,
  is_critical,
  requires_checkbox,
  is_completed,
  assigned_committee_id,
  start_month,
  end_month,
  start_week,
  end_week,
  display_order,
  is_active
)
SELECT
  g.id,
  'GANTT-001',
  'Governance Setup',
  'Create ASC, IQAC, curriculum committee and accreditation governance structure.',
  'Approved committee formation and terms of reference',
  'Committee notification and meeting minutes',
  'EEE-GOV-2025-M2',
  'CRITICAL',
  'PENDING',
  TRUE,
  TRUE,
  FALSE,
  c.id,
  1,
  2,
  1,
  8,
  1,
  TRUE
FROM baete_task_groups g
JOIN baete_workspace_modules m ON m.id = g.module_id
LEFT JOIN baete_committees c ON c.committee_code = 'ASC'
WHERE m.module_code = 'GANTT_24_MONTH'
  AND g.group_code = 'GANTT_MAIN'
  AND NOT EXISTS (SELECT 1 FROM baete_tasks t WHERE t.task_code = 'GANTT-001');

INSERT INTO baete_tasks (
  task_group_id,
  task_code,
  title,
  description,
  deliverable,
  evidence_format,
  evidence_reference,
  priority,
  status,
  is_critical,
  requires_checkbox,
  is_completed,
  assigned_committee_id,
  start_month,
  end_month,
  start_week,
  end_week,
  display_order,
  is_active
)
SELECT
  g.id,
  'GANTT-002',
  'CO-PO-WP-SDG Mapping Matrix',
  'Complete master mapping matrix for all active courses.',
  'Approved CO-PO-WP-SDG matrix',
  'Matrix document and approval note',
  'EEE-MAP-2025-M4',
  'CRITICAL',
  'PENDING',
  TRUE,
  TRUE,
  FALSE,
  c.id,
  3,
  4,
  9,
  16,
  2,
  TRUE
FROM baete_task_groups g
JOIN baete_workspace_modules m ON m.id = g.module_id
LEFT JOIN baete_committees c ON c.committee_code = 'CURRICULUM'
WHERE m.module_code = 'GANTT_24_MONTH'
  AND g.group_code = 'GANTT_MAIN'
  AND NOT EXISTS (SELECT 1 FROM baete_tasks t WHERE t.task_code = 'GANTT-002');

INSERT INTO baete_tasks (
  task_group_id,
  task_code,
  title,
  description,
  deliverable,
  evidence_format,
  evidence_reference,
  priority,
  status,
  is_critical,
  requires_checkbox,
  is_completed,
  assigned_committee_id,
  start_week,
  end_week,
  display_order,
  is_active
)
SELECT
  g.id,
  'WEEKLY-001',
  'Governance and Foundation',
  'Form committees, approve IQAC coordinator, identify accreditation coordinator, and set kickoff meeting.',
  'Committee approval and kickoff minutes',
  'Minutes and office order',
  'EEE-GOV-2025-W2',
  'CRITICAL',
  'PENDING',
  TRUE,
  TRUE,
  FALSE,
  c.id,
  1,
  2,
  1,
  TRUE
FROM baete_task_groups g
JOIN baete_workspace_modules m ON m.id = g.module_id
LEFT JOIN baete_committees c ON c.committee_code = 'ASC'
WHERE m.module_code = 'WEEKLY_PLAN'
  AND g.group_code = 'WEEKLY_104'
  AND NOT EXISTS (SELECT 1 FROM baete_tasks t WHERE t.task_code = 'WEEKLY-001');

INSERT INTO baete_tasks (
  task_group_id,
  task_code,
  title,
  description,
  deliverable,
  evidence_format,
  evidence_reference,
  priority,
  status,
  is_critical,
  requires_checkbox,
  is_completed,
  assigned_committee_id,
  start_week,
  end_week,
  display_order,
  is_active
)
SELECT
  g.id,
  'WEEKLY-002',
  'Draft PEO statement and stakeholder rationale',
  'Draft PEOs and collect stakeholder input from department and industry.',
  'Draft PEO statement',
  'PEO document with stakeholder rationale',
  'EEE-PEO-2025-W4',
  'CRITICAL',
  'PENDING',
  TRUE,
  TRUE,
  FALSE,
  c.id,
  3,
  4,
  2,
  TRUE
FROM baete_task_groups g
JOIN baete_workspace_modules m ON m.id = g.module_id
LEFT JOIN baete_committees c ON c.committee_code = 'CURRICULUM'
WHERE m.module_code = 'WEEKLY_PLAN'
  AND g.group_code = 'WEEKLY_104'
  AND NOT EXISTS (SELECT 1 FROM baete_tasks t WHERE t.task_code = 'WEEKLY-002');

INSERT INTO baete_tasks (
  task_group_id,
  task_code,
  title,
  description,
  deliverable,
  evidence_format,
  evidence_reference,
  priority,
  status,
  is_critical,
  requires_checkbox,
  is_completed,
  assigned_committee_id,
  display_order,
  is_active
)
SELECT
  g.id,
  'PREREQ-001',
  'University recognized by University Grants Commission',
  'UGC recognition must be available before BAETE expedition.',
  'UGC recognition evidence',
  'Recognition certificate or approval document',
  'EEE-UGC-REC-2025',
  'CRITICAL',
  'COMPLETED',
  TRUE,
  TRUE,
  TRUE,
  c.id,
  1,
  TRUE
FROM baete_task_groups g
JOIN baete_workspace_modules m ON m.id = g.module_id
LEFT JOIN baete_committees c ON c.committee_code = 'HOD'
WHERE m.module_code = 'PREREQUISITES'
  AND g.group_code = 'PREREQ_INSTITUTIONAL'
  AND NOT EXISTS (SELECT 1 FROM baete_tasks t WHERE t.task_code = 'PREREQ-001');

INSERT INTO baete_tasks (
  task_group_id,
  task_code,
  title,
  description,
  deliverable,
  evidence_format,
  evidence_reference,
  priority,
  status,
  is_critical,
  requires_checkbox,
  is_completed,
  assigned_committee_id,
  display_order,
  is_active
)
SELECT
  g.id,
  'PREREQ-002',
  'Minimum program duration: 4 years confirmed',
  'Program structure must meet minimum duration criteria.',
  'Approved program structure',
  'Program structure approval document',
  'EEE-PRG-DUR-2025',
  'CRITICAL',
  'PENDING',
  TRUE,
  TRUE,
  FALSE,
  c.id,
  2,
  TRUE
FROM baete_task_groups g
JOIN baete_workspace_modules m ON m.id = g.module_id
LEFT JOIN baete_committees c ON c.committee_code = 'CURRICULUM'
WHERE m.module_code = 'PREREQUISITES'
  AND g.group_code = 'PREREQ_INSTITUTIONAL'
  AND NOT EXISTS (SELECT 1 FROM baete_tasks t WHERE t.task_code = 'PREREQ-002');

INSERT INTO baete_tasks (
  task_group_id,
  task_code,
  title,
  description,
  deliverable,
  evidence_format,
  evidence_reference,
  priority,
  status,
  is_critical,
  requires_checkbox,
  is_completed,
  assigned_committee_id,
  display_order,
  is_active
)
SELECT
  g.id,
  'DOC-OBE-001',
  'PEO statement document with stakeholder rationale',
  'Formal PEO statement document must include stakeholder rationale.',
  'PEO statement final document',
  'EEE-PEO-2025-FINAL',
  'EEE-PEO-2025-FINAL',
  'CRITICAL',
  'COMPLETED',
  TRUE,
  TRUE,
  TRUE,
  c.id,
  1,
  TRUE
FROM baete_task_groups g
JOIN baete_workspace_modules m ON m.id = g.module_id
LEFT JOIN baete_committees c ON c.committee_code = 'CURRICULUM'
WHERE m.module_code = 'DOCUMENTATION'
  AND g.group_code = 'DOC_OBE'
  AND NOT EXISTS (SELECT 1 FROM baete_tasks t WHERE t.task_code = 'DOC-OBE-001');

INSERT INTO baete_tasks (
  task_group_id,
  task_code,
  title,
  description,
  deliverable,
  evidence_format,
  evidence_reference,
  priority,
  status,
  is_critical,
  requires_checkbox,
  is_completed,
  assigned_committee_id,
  display_order,
  is_active
)
SELECT
  g.id,
  'DOC-ASSMT-001',
  'All CT and CT2 question papers',
  'All CT and CT2 question papers for all courses and semesters must be indexed.',
  'Question paper archive',
  'Question papers and answer scripts',
  'EEE-CT1-CT2-[COURSE]-[YEAR]',
  'CRITICAL',
  'PENDING',
  TRUE,
  TRUE,
  FALSE,
  c.id,
  1,
  TRUE
FROM baete_task_groups g
JOIN baete_workspace_modules m ON m.id = g.module_id
LEFT JOIN baete_committees c ON c.committee_code = 'ASSESSMENT'
WHERE m.module_code = 'DOCUMENTATION'
  AND g.group_code = 'DOC_ASSESSMENT'
  AND NOT EXISTS (SELECT 1 FROM baete_tasks t WHERE t.task_code = 'DOC-ASSMT-001');

INSERT INTO baete_tasks (
  task_group_id,
  task_code,
  title,
  description,
  deliverable,
  evidence_format,
  evidence_reference,
  priority,
  status,
  is_critical,
  requires_checkbox,
  is_completed,
  assigned_committee_id,
  start_week,
  end_week,
  display_order,
  is_active
)
SELECT
  g.id,
  'MOCK-001',
  'Complete evidence audit internally',
  'All faculty submit course evidence folders and IQAC checks completeness.',
  'Internal evidence audit report',
  'Evidence folder checklist',
  'BAETE-MOCK-EVID-2026-W64',
  'CRITICAL',
  'PENDING',
  TRUE,
  TRUE,
  FALSE,
  c.id,
  64,
  65,
  1,
  TRUE
FROM baete_task_groups g
JOIN baete_workspace_modules m ON m.id = g.module_id
LEFT JOIN baete_committees c ON c.committee_code = 'IQAC'
WHERE m.module_code = 'MOCK_AUDIT_18_MONTH'
  AND g.group_code = 'MOCK_AUDIT_PREP'
  AND NOT EXISTS (SELECT 1 FROM baete_tasks t WHERE t.task_code = 'MOCK-001');

INSERT INTO baete_tasks (
  task_group_id,
  task_code,
  title,
  description,
  deliverable,
  evidence_format,
  evidence_reference,
  priority,
  status,
  is_critical,
  requires_checkbox,
  is_completed,
  assigned_committee_id,
  start_week,
  end_week,
  display_order,
  is_active
)
SELECT
  g.id,
  'MOCK-002',
  'Full 3-day simulated BAETE audit',
  'Run simulated BAETE audit with department heads and faculty on standby.',
  'Mock audit report and deficiency list',
  'Mock audit report',
  'BAETE-MOCK-2026-W72',
  'CRITICAL',
  'PENDING',
  TRUE,
  TRUE,
  FALSE,
  c.id,
  72,
  72,
  2,
  TRUE
FROM baete_task_groups g
JOIN baete_workspace_modules m ON m.id = g.module_id
LEFT JOIN baete_committees c ON c.committee_code = 'IQAC'
WHERE m.module_code = 'MOCK_AUDIT_18_MONTH'
  AND g.group_code = 'MOCK_AUDIT_PREP'
  AND NOT EXISTS (SELECT 1 FROM baete_tasks t WHERE t.task_code = 'MOCK-002');