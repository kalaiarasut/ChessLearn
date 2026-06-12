"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function createProfile(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const username = formData.get("username") as string;
  const experience = formData.get("experience") as string;

  let initialRating = 1200;
  if (experience === "beginner") initialRating = 800;
  if (experience === "advanced") initialRating = 1600;

  const { error } = await supabase.from("profiles").insert({
    id: user.id,
    username: username || user.email?.split("@")[0] || "Player",
    rating: initialRating,
    rd: 350.0,
    volatility: 0.06
  });

  if (error) {
    console.error("Error creating profile:", error);
    // You could return an error object here if you want to show it in the UI
    throw new Error("Failed to create profile. Username might be taken.");
  }

  redirect("/");
}

export async function getProfile() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return profile;
}
