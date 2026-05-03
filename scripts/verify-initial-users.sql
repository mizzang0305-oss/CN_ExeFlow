with expected_users(email, expected_name) as (
  values
    ('ceo@seanfood.com', '유인식'),
    ('chae.hs@seanfood.com', '채현식'),
    ('dsbae@seanfood.com', '배두섭'),
    ('kim.dh@seanfood.com', '김대한'),
    ('choi.yw@seanfood.com', '최영욱'),
    ('you.gy@seanfood.com', '유가영'),
    ('kim.dj@seanfood.com', '김도진'),
    ('kim.dh2@seanfood.com', '김대한'),
    ('yoo.jy@seanfood.com', '유주영'),
    ('cho.ks@seanfood.com', '조광수'),
    ('yoo.sh@seanfood.com', '유숙현'),
    ('kwon.os@seanfood.local', '권오성'),
    ('kim.jh@seanfood.local', '김진환')
)
select
  expected_users.email,
  expected_users.expected_name as "기대 이름",
  case when auth_users.id is null then '누락' else '있음' end as "인증 계정",
  case when public_users.id is null then '누락' else '있음' end as "사용자 정보",
  public_users.name as "등록 이름",
  departments.name as "부서",
  departments.code as "부서 코드",
  public_users.must_change_password as "비밀번호 변경 필요"
from expected_users
left join auth.users as auth_users
  on lower(auth_users.email) = expected_users.email
left join public.users as public_users
  on lower(public_users.email) = expected_users.email
left join public.departments as departments
  on departments.id = public_users.department_id
order by expected_users.email;

with expected_users(email) as (
  values
    ('ceo@seanfood.com'),
    ('chae.hs@seanfood.com'),
    ('dsbae@seanfood.com'),
    ('kim.dh@seanfood.com'),
    ('choi.yw@seanfood.com'),
    ('you.gy@seanfood.com'),
    ('kim.dj@seanfood.com'),
    ('kim.dh2@seanfood.com'),
    ('yoo.jy@seanfood.com'),
    ('cho.ks@seanfood.com'),
    ('yoo.sh@seanfood.com'),
    ('kwon.os@seanfood.local'),
    ('kim.jh@seanfood.local')
)
select
  count(*) as "검증 대상",
  count(auth_users.id) as "인증 계정 수",
  count(public_users.id) as "사용자 정보 수",
  count(*) filter (
    where auth_users.id is not null
      and public_users.id is not null
      and public_users.must_change_password is true
  ) as "정상 등록 수"
from expected_users
left join auth.users as auth_users
  on lower(auth_users.email) = expected_users.email
left join public.users as public_users
  on lower(public_users.email) = expected_users.email;
