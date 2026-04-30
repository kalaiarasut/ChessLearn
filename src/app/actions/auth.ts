"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AuthFormState = {
  error?: string;
  success?: string;
  field?: "email" | "password" | "username";
};

function readValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function login(_state: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = readValue(formData, "email");
  const password = readValue(formData, "password");
  const nextPathRaw = readValue(formData, "next");
  const nextPath = nextPathRaw.startsWith("/") ? nextPathRaw : "/";

  if (!isValidEmail(email)) {
    return { error: "Please enter a valid email address.", field: "email" };
  }

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters.", field: "password" };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: error.message };
  }

  redirect(nextPath);
}

export async function signup(_state: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const username = readValue(formData, "username");
  const email = readValue(formData, "email").toLowerCase();
  const password = readValue(formData, "password");

  if (username.length < 3) {
    return { error: "Username must be at least 3 characters.", field: "username" };
  }

  if (!isValidEmail(email)) {
    return { error: "Please enter a valid email address.", field: "email" };
  }

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters.", field: "password" };
  }

  const headerStore = await headers();
  const origin = headerStore.get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const emailRedirectTo = new URL("/auth/confirm", origin).toString();

  const supabase = await createSupabaseServerClient();
  const { data: emailExists } = await supabase.rpc("auth_email_exists", {
    email_to_check: email,
  });

  if (emailExists === true) {
    return {
      error: "An account already exists for this email. Log in instead.",
      field: "email",
    };
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo,
      data: {
        username,
      },
    },
  });

  if (error) {
    return { error: error.message };
  }

  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    return {
      error: "An account already exists for this email. Log in instead.",
      field: "email",
    };
  }

  if (!data.session) {
    return {
      success: "Account created. Check your email to verify and complete sign in.",
    };
  }

  redirect("/");
}

export async function logout() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
