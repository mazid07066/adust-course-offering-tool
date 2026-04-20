const BASE_URL = "http://localhost:3000";

// ==========================
// SET THESE BEFORE RUNNING
// ==========================
const CONFIG = {
  draftId: 1,                 // offering id shown on UI
  offeredCourseId: 1,         // primary offered course id under that offering
  courseId: 1,                // a master course id to test add-course
  batchId: 1,                 // current batch id
  roomId: 1,                  // active room id
  programCode: "RAE-REG-NEW", // example
  batchCode: "252",           // example
};

// unique values to avoid duplicate conflicts during repeated testing
function nowTag() {
  return String(Date.now()).slice(-6);
}

async function postJson(path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  let json = null;
  try {
    json = await res.json();
  } catch {
    json = { parseError: true };
  }

  return {
    ok: res.ok,
    status: res.status,
    json,
  };
}

function printResult(name, result, expectedMode) {
  const actual = result.ok ? "ALLOWED" : "BLOCKED";
  const expected = expectedMode === "allow" ? "ALLOWED" : "BLOCKED";
  const pass = actual === expected;

  console.log(`\n[${pass ? "PASS" : "FAIL"}] ${name}`);
  console.log(`Expected: ${expected}`);
  console.log(`Actual  : ${actual}`);
  console.log(`HTTP    : ${result.status}`);
  console.log(`Body    :`, result.json);

  return pass;
}

async function moveStatus(targetStatus) {
  return postJson("/api/offerings/status-transition", {
    offeringId: CONFIG.draftId,
    targetStatus,
  });
}

async function testAddSlot() {
  const tag = nowTag();
  const hourBase = 8 + Number(tag[0] || 0);
  const startHour = String(Math.min(hourBase, 16)).padStart(2, "0");
  const endHour = String(Math.min(Number(startHour) + 1, 17)).padStart(2, "0");

  return postJson("/api/offerings/drafts/slots/add", {
    offeredCourseId: CONFIG.offeredCourseId,
    dayOfWeek: "SUNDAY",
    startTime: `${startHour}:00`,
    endTime: `${endHour}:00`,
    roomId: CONFIG.roomId,
  });
}

async function testAttachBatch() {
  return postJson("/api/offerings/drafts/attach-batches", {
    offeredCourseId: CONFIG.offeredCourseId,
    programCode: CONFIG.programCode,
    batchCode: CONFIG.batchCode,
  });
}

async function testAddCourse() {
  const section = `9${String(Date.now()).slice(-2)}`;

  return postJson("/api/offerings/drafts/add-course", {
    draftId: CONFIG.draftId,
    courseId: CONFIG.courseId,
    section,
    batchIds: [CONFIG.batchId],
  });
}

async function runStage(stageName, expectedStructureMode, expectedSlotMode, expectedCourseMode = null) {
  console.log(`\n==============================`);
  console.log(`TESTING STAGE: ${stageName}`);
  console.log(`==============================`);

  const slotResult = await testAddSlot();
  const slotPass = printResult(
    `${stageName} :: Add slot`,
    slotResult,
    expectedSlotMode
  );

  const batchResult = await testAttachBatch();
  const batchPass = printResult(
    `${stageName} :: Attach batch`,
    batchResult,
    expectedStructureMode
  );

  let coursePass = true;
  if (expectedCourseMode) {
    const courseResult = await testAddCourse();
    coursePass = printResult(
      `${stageName} :: Add course`,
      courseResult,
      expectedCourseMode
    );
  }

  return slotPass && batchPass && coursePass;
}

async function main() {
  console.log("Starting lifecycle smoke test...");

  console.log("\n1) Move to DRAFT");
  console.log(await moveStatus("DRAFT"));

  const draftPass = await runStage(
    "DRAFT",
    "allow",
    "allow",
    "allow"
  );

  console.log("\n2) Move to BUFFER_READY");
  console.log(await moveStatus("BUFFER_READY"));

  const bufferPass = await runStage(
    "BUFFER_READY",
    "allow",
    "allow",
    "allow"
  );

  console.log("\n3) Move to FACULTY_CHOICE_BUFFER");
  console.log(await moveStatus("FACULTY_CHOICE_BUFFER"));

  const facultyBufferPass = await runStage(
    "FACULTY_CHOICE_BUFFER",
    "block",
    "block",
    "block"
  );

  console.log("\n4) Move to CONFIRMED");
  console.log(await moveStatus("CONFIRMED"));

  const confirmedPass = await runStage(
    "CONFIRMED",
    "block",
    "block",
    "block"
  );

  console.log(`\n==============================`);
  console.log(`FINAL SUMMARY`);
  console.log(`==============================`);
  console.log("DRAFT                 :", draftPass ? "PASS" : "FAIL");
  console.log("BUFFER_READY          :", bufferPass ? "PASS" : "FAIL");
  console.log("FACULTY_CHOICE_BUFFER :", facultyBufferPass ? "PASS" : "FAIL");
  console.log("CONFIRMED             :", confirmedPass ? "PASS" : "FAIL");

  const allPass = draftPass && bufferPass && facultyBufferPass && confirmedPass;
  console.log("\nOVERALL:", allPass ? "PASS" : "FAIL");
}

main().catch((err) => {
  console.error("\nTest script crashed:");
  console.error(err);
  process.exit(1);
});