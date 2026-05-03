import fs from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

function loadEnvFile(fileName) {
  const filePath = path.join(process.cwd(), fileName);

  if (!fs.existsSync(filePath)) {
    return;
  }

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");

    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const EXPECTED_DEPARTMENTS = [
  { code: "ALL", name: "전체" },
  { code: "MANAGEMENT_CENTER", name: "경영관리센터" },
  { code: "SALES_HQ", name: "영업본부" },
  { code: "PURCHASE_LOGISTICS", name: "구매물류부" },
  { code: "FACTORY_HQ", name: "공장총괄본부" },
];

const EXPECTED_USERS = [
  { departmentName: "전체", email: "ceo@seanfood.com", name: "유인식" },
  { departmentName: "전체", email: "chae.hs@seanfood.com", name: "채현식" },
  { departmentName: "전체", email: "dsbae@seanfood.com", name: "배두섭" },
  { departmentName: "영업본부", email: "kim.dh@seanfood.com", name: "김대한" },
  { departmentName: "경영관리센터", email: "choi.yw@seanfood.com", name: "최영욱" },
  { departmentName: "경영관리센터", email: "you.gy@seanfood.com", name: "유가영" },
  { departmentName: "영업본부", email: "kim.dj@seanfood.com", name: "김도진" },
  { departmentName: "영업본부", email: "kim.dh2@seanfood.com", name: "김대한" },
  { departmentName: "영업본부", email: "yoo.jy@seanfood.com", name: "유주영" },
  { departmentName: "구매물류부", email: "cho.ks@seanfood.com", name: "조광수" },
  { departmentName: "구매물류부", email: "yoo.sh@seanfood.com", name: "유숙현" },
  { departmentName: "공장총괄본부", email: "kwon.os@seanfood.local", name: "권오성" },
  { departmentName: "공장총괄본부", email: "kim.jh@seanfood.local", name: "김진환" },
];

function requireEnv(value, name) {
  if (!value) {
    throw new Error(`${name} 환경 변수가 필요합니다.`);
  }

  return value;
}

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function addFailure(failures, condition, message) {
  if (!condition) {
    failures.push(message);
  }
}

async function listAuthUsersByEmail(client) {
  const authByEmail = new Map();
  let page = 1;

  while (page <= 20) {
    const { data, error } = await client.auth.admin.listUsers({
      page,
      perPage: 1000,
    });

    if (error) {
      throw new Error(`인증 사용자 목록을 불러오지 못했습니다: ${error.message}`);
    }

    for (const user of data.users) {
      const email = user.email ? normalizeEmail(user.email) : null;

      if (email) {
        authByEmail.set(email, user);
      }
    }

    if (data.users.length < 1000) {
      break;
    }

    page += 1;
  }

  return authByEmail;
}

async function loadDepartments(client) {
  const { data, error } = await client
    .from("departments")
    .select("id, code, name, is_active");

  if (error) {
    throw new Error(`부서 목록을 불러오지 못했습니다: ${error.message}`);
  }

  return data ?? [];
}

async function loadPublicUsers(client) {
  const expectedEmails = EXPECTED_USERS.map((user) => user.email);
  const { data, error } = await client
    .from("users")
    .select("id, email, name, auth_user_id, is_active, department_id")
    .in("email", expectedEmails);

  if (error) {
    throw new Error(`사용자 목록을 불러오지 못했습니다: ${error.message}`);
  }

  return data ?? [];
}

async function main() {
  const client = createClient(
    requireEnv(SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv(SERVICE_ROLE_KEY, "SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );

  const [authByEmail, departments, publicUsers] = await Promise.all([
    listAuthUsersByEmail(client),
    loadDepartments(client),
    loadPublicUsers(client),
  ]);

  const departmentById = new Map(departments.map((department) => [department.id, department]));
  const departmentByCode = new Map(departments.map((department) => [department.code, department]));
  const publicUserRowsByEmail = new Map();

  for (const user of publicUsers) {
    const email = user.email ? normalizeEmail(user.email) : null;

    if (!email) {
      continue;
    }

    const rows = publicUserRowsByEmail.get(email) ?? [];
    rows.push(user);
    publicUserRowsByEmail.set(email, rows);
  }

  const departmentResults = EXPECTED_DEPARTMENTS.map((expected) => {
    const department = departmentByCode.get(expected.code);
    const failures = [];

    addFailure(failures, Boolean(department), "부서 없음");
    addFailure(failures, department?.name === expected.name, "부서명 불일치");
    addFailure(failures, department?.is_active === true, "비활성 부서");

    return {
      "구분": "부서",
      "대상": expected.name,
      "상태": failures.length === 0 ? "정상" : "확인 필요",
      "확인 내용": failures.join(", ") || "정상",
    };
  });

  const userResults = EXPECTED_USERS.map((expected) => {
    const email = normalizeEmail(expected.email);
    const authUser = authByEmail.get(email);
    const publicUserRows = publicUserRowsByEmail.get(email) ?? [];
    const publicUser = publicUserRows[0] ?? null;
    const department = publicUser ? departmentById.get(publicUser.department_id) : null;
    const failures = [];

    addFailure(failures, Boolean(authUser), "인증 계정 없음");
    addFailure(failures, publicUserRows.length === 1, publicUserRows.length === 0 ? "사용자 정보 없음" : "사용자 중복");
    addFailure(failures, Boolean(publicUser?.auth_user_id), "인증 연결 없음");
    addFailure(failures, !authUser || publicUser?.auth_user_id === authUser.id, "인증 연결 불일치");
    addFailure(failures, publicUser?.is_active === true, "비활성 사용자");
    addFailure(failures, publicUser?.name === expected.name, "이름 불일치");
    addFailure(failures, department?.name === expected.departmentName, "부서 불일치");

    if (expected.email.endsWith(".local")) {
      addFailure(failures, email.endsWith("@seanfood.local"), "로컬 계정 형식 불일치");
    }

    return {
      "구분": "사용자",
      "대상": `${expected.name} / ${expected.email}`,
      "상태": failures.length === 0 ? "정상" : "확인 필요",
      "확인 내용": failures.join(", ") || "정상",
    };
  });

  const results = [...departmentResults, ...userResults];
  console.table(results);

  const failed = results.filter((item) => item["상태"] !== "정상");
  console.log(`초기 사용자 검증 결과: 정상 ${results.length - failed.length}건, 확인 필요 ${failed.length}건`);

  if (EXPECTED_USERS.length !== 13) {
    throw new Error("초기 사용자 검증 대상은 13명이어야 합니다.");
  }

  if (EXPECTED_DEPARTMENTS.length !== 5) {
    throw new Error("활성 부서 검증 대상은 5개여야 합니다.");
  }

  if (failed.length > 0) {
    process.exitCode = 1;
    throw new Error(`초기 사용자 검증 실패 ${failed.length}건`);
  }

  console.log("초기 사용자 검증이 완료되었습니다.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
