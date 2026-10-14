"use server";

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createProfile } from "@/lib/profiles/create-profile";
import { updateProfile } from "@/lib/profiles/update-profile";
import {
  profileInputFromFormData,
  type ProfileInput,
} from "@/lib/profiles/profile-contract";
import type {
  CreateProfileActionState,
  UpdateProfileActionState,
} from "@/lib/profiles/profile-action-state";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSafeCaughtErrorContext } from "@/lib/supabase/profile-status";

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

export async function updateProfileAction(
  _previousState: UpdateProfileActionState,
  formData: FormData,
): Promise<UpdateProfileActionState> {
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
    console.error("Profile update client could not start", getSafeCaughtErrorContext(error));
    return {
      status: "error",
      message: "No pudimos actualizar tu perfil. Inténtalo de nuevo.",
      values,
    };
  }

  const result = await updateProfile(values, {
    async findCurrent() {
      const query = await supabase.from("profiles")
        .select("id, username")
        .eq("clerk_user_id", userId)
        .maybeSingle();
      return {
        data: query.data,
        errorCode: query.error ? query.error.code || "SUPABASE_QUERY_ERROR" : undefined,
        status: query.status,
      };
    },
    async update(id, profile) {
      const query = await supabase.from("profiles")
        .update({
          username: profile.username,
          display_name: profile.displayName,
          bio: profile.bio,
        })
        .eq("id", id)
        .eq("clerk_user_id", userId)
        .select("id")
        .maybeSingle();
      return {
        data: query.data,
        errorCode: query.error ? query.error.code || "SUPABASE_QUERY_ERROR" : undefined,
        status: query.status,
      };
    },
  });

  switch (result.status) {
    case "updated":
      for (const path of new Set([
        "/perfil",
        "/perfil/editar",
        `/usuario/${result.previousUsername}`,
        `/usuario/${result.values.username}`,
      ])) {
        revalidatePath(path);
      }
      return { status: "success", message: "Perfil actualizado.", values: result.values };
    case "invalid":
      return { status: result.status, fieldErrors: result.fieldErrors, values };
    case "conflict":
      return {
        status: result.status,
        message: result.message,
        fieldErrors: { username: [result.message] },
        values,
      };
    case "error":
    case "unauthorized":
      return { status: result.status, message: result.message, values };
  }
}