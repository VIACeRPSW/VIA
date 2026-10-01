import type { ProfileFieldErrors } from "@/lib/profiles/profile-contract";

export type CreateProfileActionState = {
  status: "idle" | "invalid" | "conflict" | "error" | "unauthorized";
  message?: string;
  fieldErrors?: ProfileFieldErrors;
  values?: {
    username: string;
    displayName: string;
    bio: string;
  };
};

export const initialCreateProfileState: CreateProfileActionState = {
  status: "idle",
};