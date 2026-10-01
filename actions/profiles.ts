"use server";

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { createProfile } from "@/lib/profiles/create-profile";
import {
  profileInputFromFormData,
  type ProfileInput,
} from "@/lib/profiles/profile-contract";
import type { CreateProfileActionState } from "@/lib/profiles/profile-action-state";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function createProfileAction(
  _previousState: CreateProfileActionState,
  formData: FormData,
): Promise<CreateProfileActionState> {
  const { isAuthenticated, userId } = await auth();
  const values = profileInputFromFormData(formData);

  if (!isAuthenticated || !userId) {
    return {
      status: "unauthorized",
      message: "Tu sesión no está disponible. Vuelve a iniciar sesión.",
      values,
    };
  }

  let supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;

  try {
    supabase = await createServerSupabaseClient();
  } catch (error) {
    console.error("Profile client could not start", {
      errorType: error instanceof Error ? error.name : "UnknownError",
    });
    return {
      status: "error",
      message: "No pudimos crear tu perfil. Inténtalo de nuevo.",
      values,
    };
  }

  const result = await createProfile(values, {
    async findCurrent() {
      const query = await supabase
        .from("profiles")
        .select("id")
        .eq("clerk_user_id", userId)
        .maybeSingle();

      return {
        data: query.data,
        errorCode: query.error?.code,
      };
    },
    async insert(profile: ProfileInput) {
      const query = await supabase.from("profiles").insert({
        clerk_user_id: userId,
        username: profile.username,
        display_name: profile.displayName,
        bio: profile.bio,
      });

      return {
        errorCode: query.error?.code,
        status: query.status,
      };
    },
  });

  switch (result.status) {
    case "created":
    case "existing":
      redirect("/perfil");
    case "invalid":
      return {
        status: result.status,
        fieldErrors: result.fieldErrors,
        values,
      };
    case "conflict":
    case "error":
      return {
        status: result.status,
        message: result.message,
        values,
      };
  }
}