import { randomUUID } from "node:crypto";
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
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const INITIAL_USER_PASSWORD = "8639";

const ACTIVE_DEPARTMENTS = [
  { aliases: ["전체", "ALL"], code: "ALL", name: "전체", sortOrder: 1 },
  { aliases: ["경영관리센터", "경영관리부"], code: "MANAGEMENT_CENTER", name: "경영관리센터", sortOrder: 2 },
  { aliases: ["영업본부"], code: "SALES_HQ", name: "영업본부", sortOrder: 3 },
  { aliases: ["구매물류부", "물류부"], code: "PURCHASE_LOGISTICS", name: "구매물류부", sortOrder: 4 },
  { aliases: ["공장총괄본부", "공장총괄"], code: "FACTORY_HQ", name: "공장총괄본부", sortOrder: 5 },
];

const INITIAL_USERS = [
  {
    departmentName: "전체",
    email: "ceo@seanfood.com",
    name: "유인식",
    role: "CEO",
    title: "대표이사",
  },
  {
    departmentName: "전체",
    email: "chae.hs@seanfood.com",
    name: "채현식",
    role: "SUPER_ADMIN",
    title: "감사",
  },
  {
    departmentName: "전체",
    email: "dsbae@seanfood.com",
    name: "배두섭",
    role: "SUPER_ADMIN",
    title: "부사장",
  },
  {
    departmentName: "영업본부",
    email: "kim.dh@seanfood.com",
    name: "김대한",
    role: "SUPER_ADMIN",
    title: "차장",
  },
  {
    departmentName: "경영관리센터",
    email: "choi.yw@seanfood.com",
    name: "최영욱",
    role: "DEPARTMENT_HEAD",
    title: "센터장",
  },
  {
    departmentName: "경영관리센터",
    email: "you.gy@seanfood.com",
    name: "유가영",
    role: "STAFF",
    title: "주임",
  },
  {
    departmentName: "영업본부",
    email: "kim.dj@seanfood.com",
    name: "김도진",
    role: "DEPARTMENT_HEAD",
    title: "부장",
  },
  {
    departmentName: "영업본부",
    email: "kim.dh2@seanfood.com",
    name: "김대한",
    role: "STAFF",
    title: "차장",
  },
  {
    departmentName: "영업본부",
    email: "yoo.jy@seanfood.com",
    name: "유주영",
    role: "STAFF",
    title: "과장",
  },
  {
    departmentName: "구매물류부",
    email: "cho.ks@seanfood.com",
    name: "조광수",
    role: "DEPARTMENT_HEAD",
    title: "부장",
  },
  {
    departmentName: "구매물류부",
    email: "yoo.sh@seanfood.com",
    name: "유숙현",
    role: "STAFF",
    title: "대리",
  },
  {
    departmentName: "공장총괄본부",
    email: "kwon.os@seanfood.local",
    name: "권오성",
    role: "DEPARTMENT_HEAD",
    title: "공장장",
  },
  {
    departmentName: "공장총괄본부",
    email: "kim.jh@seanfood.local",
    name: "김진환",
    role: "STAFF",
    title: "차장",
  },
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

function normalizeDepartmentKey(value) {
  return value.trim().toLowerCase();
}

function isPasswordPolicyError(error) {
  return /password should be at least/i.test(error?.message ?? "");
}

function rememberDepartment(departmentByName, department, canonical) {
  departmentByName.set(canonical.name, department);
  departmentByName.set(normalizeDepartmentKey(canonical.name), department);

  for (const alias of canonical.aliases) {
    departmentByName.set(alias, department);
    departmentByName.set(normalizeDepartmentKey(alias), department);
  }
}

async function ensureDepartments(client) {
  const { data, error } = await client
    .from("departments")
    .select("id, code, name, is_active");

  if (error) {
    throw new Error(`부서 목록을 불러오지 못했습니다: ${error.message}`);
  }

  const existing = data ?? [];
  const departmentByName = new Map();

  for (const department of ACTIVE_DEPARTMENTS) {
    const matched =
      existing.find((item) => item.code === department.code) ??
      existing.find((item) => department.aliases.includes(item.name));

    if (matched) {
      const { error: updateError } = await client
        .from("departments")
        .update({
          code: department.code,
          is_active: true,
          name: department.name,
          sort_order: department.sortOrder,
          updated_at: new Date().toISOString(),
        })
        .eq("id", matched.id);

      if (updateError) {
        throw new Error(`${department.name} 부서를 갱신하지 못했습니다: ${updateError.message}`);
      }

      rememberDepartment(
        departmentByName,
        { ...matched, code: department.code, is_active: true, name: department.name },
        department,
      );
      continue;
    }

    const { data: inserted, error: insertError } = await client
      .from("departments")
      .insert({
        code: department.code,
        id: randomUUID(),
        is_active: true,
        name: department.name,
        sort_order: department.sortOrder,
      })
      .select("id, code, name, is_active")
      .single();

    if (insertError) {
      throw new Error(`${department.name} 부서를 생성하지 못했습니다: ${insertError.message}`);
    }

    rememberDepartment(departmentByName, inserted, department);
  }

  return departmentByName;
}

async function findAuthUserByEmail(client, email) {
  let page = 1;

  while (page <= 20) {
    const { data, error } = await client.auth.admin.listUsers({
      page,
      perPage: 1000,
    });

    if (error) {
      throw new Error(`인증 사용자 목록을 불러오지 못했습니다: ${error.message}`);
    }

    const user = data.users.find((item) => normalizeEmail(item.email ?? "") === email);

    if (user) {
      return user;
    }

    if (data.users.length < 1000) {
      return null;
    }

    page += 1;
  }

  return null;
}

async function canSignInWithInitialPassword(signInClient, email) {
  if (!signInClient) {
    return false;
  }

  const { error } = await signInClient.auth.signInWithPassword({
    email,
    password: INITIAL_USER_PASSWORD,
  });
  await signInClient.auth.signOut();

  return !error;
}

async function recreateAuthUserWithInitialPassword(client, existing, authPayload, email) {
  const { error: deleteError } = await client.auth.admin.deleteUser(existing.id);

  if (deleteError) {
    throw new Error(`${email} 기존 인증 계정을 재생성하기 위해 삭제하지 못했습니다: ${deleteError.message}`);
  }

  const { data, error } = await client.auth.admin.createUser(authPayload);

  if (error || !data.user) {
    throw new Error(`${email} 인증 계정을 재생성하지 못했습니다: ${error?.message ?? "응답 없음"}`);
  }

  console.warn(`${email} 기존 인증 계정을 초기 비밀번호로 재생성했습니다.`);
  return data.user;
}

async function upsertAuthUser(client, signInClient, user) {
  const email = normalizeEmail(user.email);
  const existing = await findAuthUserByEmail(client, email);
  const authPayload = {
    email,
    email_confirm: true,
    password: INITIAL_USER_PASSWORD,
    user_metadata: {
      force_password_change: true,
      must_change_password: true,
      "초기비밀번호변경필요": true,
    },
  };

  if (existing) {
    const { data, error } = await client.auth.admin.updateUserById(existing.id, authPayload);

    if (error && isPasswordPolicyError(error)) {
      if (!(await canSignInWithInitialPassword(signInClient, email))) {
        return recreateAuthUserWithInitialPassword(client, existing, authPayload, email);
      }

      const passwordFallbackPayload = {
        email,
        email_confirm: true,
        user_metadata: authPayload.user_metadata,
      };
      const fallback = await client.auth.admin.updateUserById(existing.id, passwordFallbackPayload);

      if (fallback.error || !fallback.data.user) {
        throw new Error(`${email} 인증 계정을 갱신하지 못했습니다: ${fallback.error?.message ?? "응답 없음"}`);
      }

      console.warn(`${email} 기존 인증 계정은 비밀번호 정책 때문에 메타데이터만 갱신했습니다.`);
      return fallback.data.user;
    }

    if (error || !data.user) {
      throw new Error(`${email} 인증 계정을 갱신하지 못했습니다: ${error?.message ?? "응답 없음"}`);
    }

    return data.user;
  }

  const { data, error } = await client.auth.admin.createUser(authPayload);

  if (error || !data.user) {
    throw new Error(`${email} 인증 계정을 생성하지 못했습니다: ${error?.message ?? "응답 없음"}`);
  }

  return data.user;
}

async function upsertPublicUser(client, user, authUser, departmentByName) {
  const departmentKey = normalizeDepartmentKey(user.departmentName ?? "전체");
  const department = departmentByName.get(departmentKey);

  if (!department) {
    throw new Error(`${user.departmentName ?? "전체"} 부서를 찾지 못했습니다.`);
  }

  const now = new Date().toISOString();
  const email = normalizeEmail(user.email);
  const { data: existingRows, error: lookupError } = await client
    .from("users")
    .select("id")
    .eq("email", email)
    .limit(1);

  if (lookupError) {
    throw new Error(`${user.email} 사용자 중복 여부를 확인하지 못했습니다: ${lookupError.message}`);
  }

  const { error } = await client
    .from("users")
    .upsert(
      {
        auth_user_id: authUser.id,
        department_id: department.id,
        email,
        id: existingRows?.[0]?.id ?? randomUUID(),
        initial_password_metadata: {
          "초기비밀번호변경필요": true,
          reason: "초기 사용자 등록",
        },
        is_active: true,
        must_change_password: true,
        name: user.name,
        profile_name: null,
        role: user.role,
        title: user.title,
        updated_at: now,
      },
      { onConflict: "email" },
    );

  if (error) {
    throw new Error(`${user.email} 사용자 정보를 저장하지 못했습니다: ${error.message}`);
  }
}

function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
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
  const signInClient = ANON_KEY
    ? createClient(SUPABASE_URL, ANON_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
    : null;

  const departmentByName = await ensureDepartments(client);
  const results = [];

  for (const user of INITIAL_USERS) {
    try {
      const authUser = await upsertAuthUser(client, signInClient, user);
      await upsertPublicUser(client, user, authUser, departmentByName);
      results.push({ email: user.email, name: user.name, status: "성공" });
      console.log(`[성공] ${user.name} ${user.email}`);
    } catch (error) {
      const reason = getErrorMessage(error);
      results.push({
        email: user.email,
        name: user.name,
        reason,
        status: "실패",
      });
      console.error(`[실패] ${user.name} ${user.email}: ${reason}`);
    }
  }

  console.table(results);

  const failed = results.filter((item) => item.status === "실패");
  const succeeded = results.filter((item) => item.status === "성공");

  console.log(`초기 사용자 등록 결과: 성공 ${succeeded.length}건, 실패 ${failed.length}건`);

  if (failed.length > 0) {
    process.exitCode = 1;
    throw new Error(`초기 사용자 등록 실패 ${failed.length}건`);
  }

  console.log("초기 사용자 등록이 완료되었습니다.");
}

main().catch((error) => {
  console.error(getErrorMessage(error));
  process.exitCode = 1;
});
