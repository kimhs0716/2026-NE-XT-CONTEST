"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function translateError(message: string): string {
  const map: Record<string, string> = {
    "Invalid login credentials": "이메일 또는 비밀번호가 올바르지 않습니다.",
    "User already registered": "이미 사용 중인 이메일입니다.",
    "Email not confirmed": "이메일 인증이 필요합니다. 받은 편지함을 확인해주세요.",
    "Password should be at least 6 characters": "비밀번호는 6자 이상이어야 합니다.",
    "Unable to validate email address: invalid format": "올바른 이메일 형식이 아닙니다.",
    "signup is disabled": "현재 회원가입이 비활성화되어 있습니다.",
    "email rate limit exceeded": "잠시 후 다시 시도해주세요.",
    "For security purposes": "보안을 위해 잠시 후 다시 시도해주세요.",
    "Anonymous sign-ins are disabled": "로그인 정보를 입력해주세요.",
  };

  for (const [key, value] of Object.entries(map)) {
    if (message.includes(key)) return value;
  }

  return "오류가 발생했습니다. 다시 시도해주세요.";
}

export async function login(_: unknown, formData: FormData) {
  const supabase = await createClient();
  const email = ((formData.get("email") as string | null) ?? "").trim();
  const password = (formData.get("password") as string | null) ?? "";

  await supabase.auth.signOut();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) return { error: translateError(error.message) };

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function resetSession() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  return { success: true };
}

export async function signup(_: unknown, formData: FormData) {
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const name = formData.get("name") as string;
  const school_level = formData.get("school_level") as "middle" | "high" | null;

  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) return { error: translateError(error.message) };

  // 이메일 인증 대기 중인 경우
  if (!data.session) {
    return { needsConfirmation: true };
  }

  if (data.user) {
    const { error: profileError } = await supabase.from("profiles").insert({
      id: data.user.id,
      email,
      name: name || null,
      school_level: school_level || null,
    });

    if (profileError) return { error: "계정 생성 중 오류가 발생했습니다." };

    const { error: roleError } = await supabase.from("user_roles").insert({
      user_id: data.user.id,
      role: "user",
    });

    if (roleError) return { error: "권한 설정 중 오류가 발생했습니다." };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
