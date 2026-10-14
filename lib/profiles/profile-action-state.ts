import type { ProfileFieldErrors, ProfileInput } from "@/lib/profiles/profile-contract";

export type CreateProfileActionState = {
  status: "idle" | "invalid" | "conflict" | "error" | "unauthorized";
  message?: string;
  fieldErrors?: ProfileFieldErrors;
  values?: ProfileInput;
};

export const initialCreateProfileState: CreateProfileActionState = {
  status: "idle",
};

export type UpdateProfileActionState = Omit<CreateProfileActionState, "status"> & {
  status: CreateProfileActionState["status"] | "success";
};

export const initialUpdateProfileState: UpdateProfileActionState = {
  status: "idle",
};