/*Users 기본 정보 table
비밀번호는 저장하지 않고 Supabase Auth가 관리함*/
create table public.profiles (
  --auth.users.id와 연결되는 사용자 고유 ID
  id uuid primary key references auth.users(id) on delete cascade,
  --로그인 이메일
  email text unique not null,
  --사용자 이름
  name text,
  /*중학교, 고등학교 설정*/
  school_level text check (school_level in ('middle', 'high')),
  --계정 활성화 여부
  is_active boolean default true,
  --생성 시간
  created_at timestamp with time zone default now(),
  --수정 시간
  updated_at timestamp with time zone default now()
);

/*관리자와 일반사용자를 구분하는 table
admin -> 관리자, user -> 일반사용자*/
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  --권한을 가진 사용자
  user_id uuid not null references auth.users(id) on delete cascade,
  --권한(role) 종류
  role text not null check (role in ('admin', 'user')),
  --권한 부여 시간
  created_at timestamp with time zone default now(),

  --같은 사용자가 같은 권한(role)을 중복으로 가질 수 없게 함
  unique (user_id, role)
);

/*학기 정보를 저장하는 table
*/
create table public.semesters (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references auth.users(id) on delete cascade,

  --년도
  year integer not null,

  --1,2학기 선택
  semester_type text not null check (
    semester_type in ('semester_1', 'semester_2')
  ),

  --이름
  name text not null,

  --시작 날짜
  start_date date,
  --끝나는 날짜
  end_date date,

  --현재 학기 인지 여부
  is_current boolean default false,

  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),

  unique (user_id, year, semester_type)
);

/*사용자별 과목을 저장하는 table
*/
create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  --과목 소유자
  user_id uuid not null references auth.users(id) on delete cascade,
  --과목 해당 학기
  semester_id uuid not null references public.semesters(id) on delete cascade,
  --과목 이름
  name text not null,
  --과목 단위수
  credit numeric(4,2) check (credit > 0),
  --과목 분류
  category text,
  --그래프,캘랜더 표시 색상
  color text,
  --표시 순서
  display_order integer default 0,
  --과목 사용 여부
  is_active boolean default true,

  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),

  --같은 사용자가 같은 과목명을 중복 생성하지 못하게 함
  unique (user_id, semester_id, name)
);

/*과목별 목표 점수를 저장하는 table*/
create table public.subject_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  --과목 이름
  subject_id uuid not null references public.subjects(id) on delete cascade,
  --목표 점수
  target_score numeric(5,2) not null check (target_score >= 0 and target_score <= 100),
  --목표 날짜
  target_date date,
  --목표 관련 메모
  memo text,

  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

/*시험 단위 저장 table*/
create table public.exams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  --과목 id
  subject_id uuid not null references public.subjects(id) on delete cascade,
  --시험 학기
  exam_semester uuid not null references public.semesters(id) on delete cascade,

  --시험 제목
  title text not null,
  --시험 종류
  exam_type text not null check (
    exam_type in ('midterm', 'final', 'assignment', 'mock_exam', 'other')
  ),
  --만점
  max_score numeric(5,2) default 100 check (max_score > 0),
  --반영 비율
    weight numeric(5,2) check (
      weight >= 0 and weight <= 100
  ),
  --시험 관련 메모
  memo text,

  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

/*실제 성적 점수를 저장하는 table*/
create table public.grade_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  --연결된 시험
  exam_id uuid references public.exams(id) on delete set null,

  --실제 점수
  score numeric(5,2) not null check (score >= 0),
  --만점
  max_score numeric(5,2) not null default 100 check (max_score > 0),
  --점수가 만점보다 커지는 경우 체크
  check (score <= max_score),
  --백분율 점수
  percentage numeric(5,2) generated always as ((score / max_score) * 100) stored,

  --등급 or 성취도
  grade_level text,
  --성적 관련 메모
  memo text,

  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

/*캘랜더에 표시할 일정을 저장하는 table*/
create table public.schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  --연관된 과목(선택적)
  subject_id uuid references public.subjects(id) on delete set null,
  --연관된 시험(선택적)
  exam_id uuid references public.exams(id) on delete set null,
  --연관된 학기(선택적)
  semester_id uuid references public.semesters(id) on delete set null,

  --일정 제목
  title text not null,
  --일정 종류
  event_type text not null check (
    event_type in ('exam', 'assignment', 'mock_exam', 'study', 'school_academy', 'other')
  ),

  --시작 날짜
  start_date date not null,
  --종료 날짜
  end_date date,
  --시작 시간
  start_time time,
  --종료 시간
  end_time time,

  --일정 설명
  description text,
  --완료 여부
  is_completed boolean default false,

  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

/*공부 할 일, 과제 체크리스트를 저장하는 table*/
create table public.study_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete set null,
  schedule_id uuid references public.schedules(id) on delete set null,
  semester_id uuid references public.semesters(id) on delete set null,
  
  --할 일 제목
  title text not null,
  --할 일 종류
  task_type text check (
    task_type in ('homework', 'review', 'preview', 'problem_solving', 'memorization', 'other')
  ),

  --마감일
  due_date date,
  --우선 순위
  priority text check (priority in ('low', 'medium', 'high')),
  --완료 여부
  is_completed boolean default false,
  --완료 시간
  completed_at timestamp with time zone,

  --메모
  memo text,

  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

/*실제 공부 기록을 저장하는 table*/
create table public.study_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete set null,
  semester_id uuid references public.semesters(id) on delete set null,

  --공부 날짜
  study_date date not null,
  --공부 시간, 분 단위
  duration_minutes integer check (duration_minutes >= 0),
  --공부 내용
  content text,
  --체감 난이도
  difficulty text check (difficulty in ('easy', 'normal', 'hard')),
  --집중도 1~5
  concentration_level integer check (concentration_level between 1 and 5),

  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

/*성적 분석 결과를 저장하는 table*/
create table public.analysis_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  semester_id uuid references public.semesters(id) on delete set null,

  --분석 리포트 종류
  report_type text not null check (
    report_type in ('overall', 'subject', 'monthly', 'exam')
  ),

  subject_id uuid references public.subjects(id) on delete set null,
  exam_id uuid references public.exams(id) on delete set null,

  --리포트 제목
  title text not null,
  --요약 내용
  summary text,
  --평균 점수
  average_score numeric(5,2),
  --추세
  trend text check (trend in ('up', 'down', 'stable', 'unknown')),

  created_at timestamp with time zone default now()
);

/*취약 과목, 취약 단원, 취약 습관 등을 저장하는 table*/
create table public.weakness_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  semester_id uuid references public.semesters(id) on delete set null,

  --취약점 종류
  weakness_type text check (
    weakness_type in ('subject', 'unit', 'exam_type', 'habit', 'time_management', 'other')
  ),

  --취약점 제목
  title text not null,
  --설명
  description text,
  --심각도 1~5
  severity integer check (severity between 1 and 5),
  --판단 근거
  evidence text,

  created_at timestamp with time zone default now()
);

/*맞춤 학습 전략 저장 table*/
create table public.learning_recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete set null,
  semester_id uuid references public.semesters(id) on delete set null,
  weakness_report_id uuid references public.weakness_reports(id) on delete set null,
  
  --추천 종류
  recommendation_type text check (
    recommendation_type in ('review', 'practice', 'schedule', 'strategy', 'other')
  ),

  --추천 설명
  title text not null,
  --추천 설명
  description text not null,
  --우선순위
  priority text check (priority in ('low', 'medium', 'high')),

  created_at timestamp with time zone default now()
);

/*AI 성적 예측 결과 저장 table*/
create table public.score_predictions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  semester_id uuid references public.semesters(id) on delete set null,

  --예측 점수
  predicted_score numeric(5,2) check (
    predicted_score >= 0 and predicted_score <= 100
  ),

  --예측 대상
  prediction_target text,
  --사용한 모델 종류
  model_type text,
  --예측 신뢰도 [0, 1]
  confidence numeric(5,2) check (confidence >= 0 and confidence <= 1),

  --예측 근거
  basis text,
  created_at timestamp with time zone default now()
);

/*관리자가 일반사용자 정보 수정 시 기록 table*/
create table public.admin_logs (
  id uuid primary key default gen_random_uuid(),

  --작업한 관리자
  admin_id uuid not null references auth.users(id) on delete cascade,
  --수정 대상 사용자
  target_user_id uuid references auth.users(id) on delete set null,

  --작업 종류
  action_type text not null check (
    action_type in ('create', 'update', 'delete', 'deactivate', 'activate', 'role_change', 'other')
  ),

  --수정한 테이블명
  target_table text,
  --수정한 record id
  target_record_id uuid,
  --작업 설명
  description text,

  created_at timestamp with time zone default now()
);





/*수능 모의고사 성적 기록 table (고등학생용)*/
create table public.mock_exam_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  --시험 연도 및 월 (예: 2026년 6월 모의고사)
  exam_year int not null,
  exam_month int not null check (exam_month in (3, 4, 5, 6, 7, 9, 10, 11)),

  --과목명 (국어, 수학, 영어, 한국사, 탐구1, 탐구2, 제2외국어)
  subject text not null,

  --원점수
  raw_score int check (raw_score >= 0 and raw_score <= 100),
  --백분위
  percentile numeric(5,2) check (percentile >= 0 and percentile <= 100),
  --등급 (1~9)
  grade int check (grade >= 1 and grade <= 9),
  --목표점수
  target_score int check (target_score >= 0 and target_score <= 100),

  created_at timestamp with time zone default now(),

  unique(user_id, exam_year, exam_month, subject)
);

/*RLS에서 쓸 관리자 확인 함수
현재 로그인된 사용자의 user_roles에 admin이 있으면 true
없으면 false*/
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = auth.uid()
      and role = 'admin'
  );
$$;

/*RLS 켜기*/
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.subjects enable row level security;
alter table public.semesters enable row level security;
alter table public.subject_goals enable row level security;
alter table public.exams enable row level security;
alter table public.grade_records enable row level security;
alter table public.schedules enable row level security;
alter table public.study_tasks enable row level security;
alter table public.study_logs enable row level security;
alter table public.analysis_reports enable row level security;
alter table public.weakness_reports enable row level security;
alter table public.learning_recommendations enable row level security;
alter table public.score_predictions enable row level security;
alter table public.admin_logs enable row level security;
alter table public.mock_exam_records enable row level security;

/*기본 RLS 정책 구조
일반 사용자:
auth.uid() = user_id인 행만 접근 가능

관리자:
public.is_admin() = true 이면 접근 가능*/

/*====================================================
  profiles RLS 정책
  - 일반사용자: 자기 profile 조회/수정 가능
  - 관리자: 모든 profile 조회/수정 가능
====================================================*/

create policy "profiles_select_own_or_admin"
on public.profiles
for select
using (
  auth.uid() = id
  or public.is_admin()
);

create policy "profiles_insert_own"
on public.profiles
for insert
with check (
  auth.uid() = id
);

create policy "profiles_update_own_or_admin"
on public.profiles
for update
using (
  auth.uid() = id
  or public.is_admin()
)
with check (
  auth.uid() = id
  or public.is_admin()
);

create policy "profiles_delete_admin_only"
on public.profiles
for delete
using (
  public.is_admin()
);

/*====================================================
  user_roles RLS 정책
  - 일반사용자: 자기 role 조회 가능
  - 일반사용자: 회원가입 후 자기 role='user'만 생성 가능
  - 관리자: 모든 role 조회/생성/수정/삭제 가능
  - 일반사용자가 자기 role을 admin으로 만드는 것은 차단
====================================================*/

create policy "user_roles_select_own_or_admin"
on public.user_roles
for select
using (
  auth.uid() = user_id
  or public.is_admin()
);

create policy "user_roles_insert_own_user_or_admin"
on public.user_roles
for insert
with check (
  (
    auth.uid() = user_id
    and role = 'user'
  )
  or public.is_admin()
);

create policy "user_roles_update_admin_only"
on public.user_roles
for update
using (
  public.is_admin()
)
with check (
  public.is_admin()
);

create policy "user_roles_delete_admin_only"
on public.user_roles
for delete
using (
  public.is_admin()
);

/*====================================================
  subjects RLS 정책
====================================================*/

create policy "subjects_select_own_or_admin"
on public.subjects
for select
using (
  auth.uid() = user_id
  or public.is_admin()
);

create policy "subjects_insert_own_or_admin"
on public.subjects
for insert
with check (
  auth.uid() = user_id
  or public.is_admin()
);

create policy "subjects_update_own_or_admin"
on public.subjects
for update
using (
  auth.uid() = user_id
  or public.is_admin()
)
with check (
  auth.uid() = user_id
  or public.is_admin()
);

create policy "subjects_delete_own_or_admin"
on public.subjects
for delete
using (
  auth.uid() = user_id
  or public.is_admin()
);

/*====================================================
  semesters RLS 정책
====================================================*/
create policy "semesters_select_own_or_admin"
on public.semesters
for select
using (
  auth.uid() = user_id
  or public.is_admin()
);

create policy "semesters_insert_own_or_admin"
on public.semesters
for insert
with check (
  auth.uid() = user_id
  or public.is_admin()
);

create policy "semesters_update_own_or_admin"
on public.semesters
for update
using (
  auth.uid() = user_id
  or public.is_admin()
)
with check (
  auth.uid() = user_id
  or public.is_admin()
);

create policy "semesters_delete_own_or_admin"
on public.semesters
for delete
using (
  auth.uid() = user_id
  or public.is_admin()
);
/*====================================================
  subject_goals RLS 정책
====================================================*/

create policy "subject_goals_select_own_or_admin"
on public.subject_goals
for select
using (
  auth.uid() = user_id
  or public.is_admin()
);

create policy "subject_goals_insert_own_or_admin"
on public.subject_goals
for insert
with check (
  auth.uid() = user_id
  or public.is_admin()
);

create policy "subject_goals_update_own_or_admin"
on public.subject_goals
for update
using (
  auth.uid() = user_id
  or public.is_admin()
)
with check (
  auth.uid() = user_id
  or public.is_admin()
);

create policy "subject_goals_delete_own_or_admin"
on public.subject_goals
for delete
using (
  auth.uid() = user_id
  or public.is_admin()
);

/*====================================================
  exams RLS 정책
====================================================*/

create policy "exams_select_own_or_admin"
on public.exams
for select
using (
  auth.uid() = user_id
  or public.is_admin()
);

create policy "exams_insert_own_or_admin"
on public.exams
for insert
with check (
  auth.uid() = user_id
  or public.is_admin()
);

create policy "exams_update_own_or_admin"
on public.exams
for update
using (
  auth.uid() = user_id
  or public.is_admin()
)
with check (
  auth.uid() = user_id
  or public.is_admin()
);

create policy "exams_delete_own_or_admin"
on public.exams
for delete
using (
  auth.uid() = user_id
  or public.is_admin()
);

/*====================================================
  grade_records RLS 정책
====================================================*/

create policy "grade_records_select_own_or_admin"
on public.grade_records
for select
using (
  auth.uid() = user_id
  or public.is_admin()
);

create policy "grade_records_insert_own_or_admin"
on public.grade_records
for insert
with check (
  auth.uid() = user_id
  or public.is_admin()
);

create policy "grade_records_update_own_or_admin"
on public.grade_records
for update
using (
  auth.uid() = user_id
  or public.is_admin()
)
with check (
  auth.uid() = user_id
  or public.is_admin()
);

create policy "grade_records_delete_own_or_admin"
on public.grade_records
for delete
using (
  auth.uid() = user_id
  or public.is_admin()
);

/*====================================================
  schedules RLS 정책
====================================================*/

create policy "schedules_select_own_or_admin"
on public.schedules
for select
using (
  auth.uid() = user_id
  or public.is_admin()
);

create policy "schedules_insert_own_or_admin"
on public.schedules
for insert
with check (
  auth.uid() = user_id
  or public.is_admin()
);

create policy "schedules_update_own_or_admin"
on public.schedules
for update
using (
  auth.uid() = user_id
  or public.is_admin()
)
with check (
  auth.uid() = user_id
  or public.is_admin()
);

create policy "schedules_delete_own_or_admin"
on public.schedules
for delete
using (
  auth.uid() = user_id
  or public.is_admin()
);

/*====================================================
  study_tasks RLS 정책
====================================================*/

create policy "study_tasks_select_own_or_admin"
on public.study_tasks
for select
using (
  auth.uid() = user_id
  or public.is_admin()
);

create policy "study_tasks_insert_own_or_admin"
on public.study_tasks
for insert
with check (
  auth.uid() = user_id
  or public.is_admin()
);

create policy "study_tasks_update_own_or_admin"
on public.study_tasks
for update
using (
  auth.uid() = user_id
  or public.is_admin()
)
with check (
  auth.uid() = user_id
  or public.is_admin()
);

create policy "study_tasks_delete_own_or_admin"
on public.study_tasks
for delete
using (
  auth.uid() = user_id
  or public.is_admin()
);

/*====================================================
  study_logs RLS 정책
====================================================*/

create policy "study_logs_select_own_or_admin"
on public.study_logs
for select
using (
  auth.uid() = user_id
  or public.is_admin()
);

create policy "study_logs_insert_own_or_admin"
on public.study_logs
for insert
with check (
  auth.uid() = user_id
  or public.is_admin()
);

create policy "study_logs_update_own_or_admin"
on public.study_logs
for update
using (
  auth.uid() = user_id
  or public.is_admin()
)
with check (
  auth.uid() = user_id
  or public.is_admin()
);

create policy "study_logs_delete_own_or_admin"
on public.study_logs
for delete
using (
  auth.uid() = user_id
  or public.is_admin()
);

/*====================================================
  analysis_reports RLS 정책
====================================================*/

create policy "analysis_reports_select_own_or_admin"
on public.analysis_reports
for select
using (
  auth.uid() = user_id
  or public.is_admin()
);

create policy "analysis_reports_insert_own_or_admin"
on public.analysis_reports
for insert
with check (
  auth.uid() = user_id
  or public.is_admin()
);

create policy "analysis_reports_update_own_or_admin"
on public.analysis_reports
for update
using (
  auth.uid() = user_id
  or public.is_admin()
)
with check (
  auth.uid() = user_id
  or public.is_admin()
);

create policy "analysis_reports_delete_own_or_admin"
on public.analysis_reports
for delete
using (
  auth.uid() = user_id
  or public.is_admin()
);

/*====================================================
  weakness_reports RLS 정책
====================================================*/

create policy "weakness_reports_select_own_or_admin"
on public.weakness_reports
for select
using (
  auth.uid() = user_id
  or public.is_admin()
);

create policy "weakness_reports_insert_own_or_admin"
on public.weakness_reports
for insert
with check (
  auth.uid() = user_id
  or public.is_admin()
);

create policy "weakness_reports_update_own_or_admin"
on public.weakness_reports
for update
using (
  auth.uid() = user_id
  or public.is_admin()
)
with check (
  auth.uid() = user_id
  or public.is_admin()
);

create policy "weakness_reports_delete_own_or_admin"
on public.weakness_reports
for delete
using (
  auth.uid() = user_id
  or public.is_admin()
);

/*====================================================
  learning_recommendations RLS 정책
====================================================*/

create policy "learning_recommendations_select_own_or_admin"
on public.learning_recommendations
for select
using (
  auth.uid() = user_id
  or public.is_admin()
);

create policy "learning_recommendations_insert_own_or_admin"
on public.learning_recommendations
for insert
with check (
  auth.uid() = user_id
  or public.is_admin()
);

create policy "learning_recommendations_update_own_or_admin"
on public.learning_recommendations
for update
using (
  auth.uid() = user_id
  or public.is_admin()
)
with check (
  auth.uid() = user_id
  or public.is_admin()
);

create policy "learning_recommendations_delete_own_or_admin"
on public.learning_recommendations
for delete
using (
  auth.uid() = user_id
  or public.is_admin()
);

/*====================================================
  score_predictions RLS 정책
====================================================*/

create policy "score_predictions_select_own_or_admin"
on public.score_predictions
for select
using (
  auth.uid() = user_id
  or public.is_admin()
);

create policy "score_predictions_insert_own_or_admin"
on public.score_predictions
for insert
with check (
  auth.uid() = user_id
  or public.is_admin()
);

create policy "score_predictions_update_own_or_admin"
on public.score_predictions
for update
using (
  auth.uid() = user_id
  or public.is_admin()
)
with check (
  auth.uid() = user_id
  or public.is_admin()
);

create policy "score_predictions_delete_own_or_admin"
on public.score_predictions
for delete
using (
  auth.uid() = user_id
  or public.is_admin()
);

/*====================================================
  admin_logs RLS 정책
  - 관리자: 전체 로그 조회/생성 가능
  - 일반사용자: 자기와 관련된 로그만 조회 가능하게 할 수도 있음
====================================================*/

create policy "admin_logs_select_related_or_admin"
on public.admin_logs
for select
using (
  public.is_admin()
  or auth.uid() = target_user_id
);

create policy "admin_logs_insert_admin_only"
on public.admin_logs
for insert
with check (
  public.is_admin()
  and auth.uid() = admin_id
);

create policy "admin_logs_update_admin_only"
on public.admin_logs
for update
using (
  public.is_admin()
)
with check (
  public.is_admin()
);

create policy "admin_logs_delete_admin_only"
on public.admin_logs
for delete
using (
  public.is_admin()
);

create policy "mock_exam_records_select_own"
on public.mock_exam_records
for select
using (auth.uid() = user_id);

create policy "mock_exam_records_insert_own"
on public.mock_exam_records
for insert
with check (auth.uid() = user_id);

create policy "mock_exam_records_update_own"
on public.mock_exam_records
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "mock_exam_records_delete_own"
on public.mock_exam_records
for delete
using (auth.uid() = user_id);

/*====================================================
  GRANT 설정
  raw SQL로 테이블 생성 시 authenticated 역할에
  접근 권한을 명시적으로 부여해야 함 (RLS가 실제 행 접근을 제어)
====================================================*/
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

/*====================================================
  첫 관리자 계정 부여
  admin@example.com을 실제 관리자 이메일로 바꿔서 실행
  실제 회원가입 후 따로 실행(현재는 주석처리)
====================================================*/
/*
insert into public.user_roles (user_id, role)
select id, 'admin'
from auth.users
where email = 'admin@example.com'
on conflict (user_id, role) do nothing;
*/

/*
회원가입 시 일반사용자는 user role이 입력되어야 함

await supabase.from("user_roles").insert({
  user_id: user.id,
  role: "user",
});
*/

/*====================================================
  추가 관리자 계정 부여 방법
  1. 일반사용자로 회원가입
  2. 관리자가 해당 id의 role에 admin 추가(2번째 관리자 계정이라면 처음 임의로 만든 계정)
  3. 일반사용자 로그인/관리자 로그인 페이지를 분리
  4. 관리자 로그인 페이지에서 로그인 시 관리자 계정으로 로그인
  (5. 일반사용자 로그인 페이지에서 로그인 시 일반사용자 계정으로 로그인)
====================================================*/