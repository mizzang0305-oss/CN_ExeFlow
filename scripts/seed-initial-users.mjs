import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const INITIAL_USER_PASSWORD = "8639";

const ACTIVE_DEPARTMENTS = [
  { aliases: ["경영관리센터", "경영관리부"], code: "MGT", name: "경영관리센터", sortOrder: 10 },
  { aliases: ["영업본부"], code: "SALES", name: "영업본부", sortOrder: 20 },
  { aliases: ["구매물류부", "물류부"], code: "LOGISTICS", name: "구매물류부", sortOrder: 30 },
  { aliases: ["공장총괄본부", "공장총괄"], code: "FACTORY", name: "공장총괄본부", sortOrder: 40 },
];

const INITIAL_USERS = [
  {
    email: "ceo@seanfood.com",
    name: "유인식",
    role: "CEO",
    title: "대표이사",
  },
  {
    email: "chae.hs@seanfood.com",
    name: "채현식",
    role: "SUPER_ADMIN",
    title: "감사",
  },
  {
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
    email: "kwon.os@seanfood.com",
    name: "권오성",
    role: "DEPARTMENT_HEAD",
    title: "공장장",
  },
  {
    departmentName: "공장총괄본부",
    email: "kim.jh@seanfood.com",
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

async function ensureDepartments(client) {
  const { data, error } = await client
    .from("departments")
    .select("id, code, name, is_active");

  if (error) {
    throw new Error(`부서 목록을 불러오지 못했습니다: ${error.message}`);
  }

  const existing = data ?? [];
  const departmentByName = new Map(existing.map((department) => [department.name, department]));

  for (const department of ACTIVE_DEPARTMENTS) {
    const matched = existing.find((item) => department.aliases.includes(item.name) || item.code === department.code);

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

      departmentByName.set(department.name, { ...matched, code: department.code, is_active: true, name: department.name });
      continue;
    }

    const { data: inserted, error: insertError } = await client
      .from("departments")
      .insert({
        code: department.code,
        id: crypto.randomUUID(),
        is_active: true,
        name: department.name,
        sort_order: department.sortOrder,
      })
      .select("id, code, name, is_active")
      .single();

    if (insertError) {
      throw new Error(`${department.name} 부서를 생성하지 못했습니다: ${insertError.message}`);
    }

    departmentByName.set(department.name, inserted);
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

async function upsertAuthUser(client, user) {
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
  const department = user.departmentName ? departmentByName.get(user.departmentName) : null;
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
        department_id: department?.id ?? null,
        email,
        id: existingRows?.[0]?.id ?? crypto.randomUUID(),
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

  const departmentByName = await ensureDepartments(client);

  for (const user of INITIAL_USERS) {
    const authUser = await upsertAuthUser(client, user);
    await upsertPublicUser(client, user, authUser, departmentByName);
  }

  console.log("초기 사용자 등록이 완료되었습니다.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
