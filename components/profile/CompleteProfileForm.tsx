"use client";

import { useActionState } from "react";
import { createProfileAction } from "@/actions/profiles";
import {
  BIO_MAX_LENGTH,
  DISPLAY_NAME_MAX_LENGTH,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
} from "@/lib/profiles/profile-contract";
import { initialCreateProfileState } from "@/lib/profiles/profile-action-state";

type CompleteProfileFormProps = {
  initialDisplayName: string;
};

export function CompleteProfileForm({
  initialDisplayName,
}: CompleteProfileFormProps) {
  const [state, formAction, pending] = useActionState(
    createProfileAction,
    initialCreateProfileState,
  );
  const usernameError = state.fieldErrors?.username?.[0];
  const displayNameError = state.fieldErrors?.displayName?.[0];
  const bioError = state.fieldErrors?.bio?.[0];

  return (
    <form className="profile-form" action={formAction} noValidate>
      <div className="form-field">
        <label htmlFor="username">Nombre de usuario</label>
        <input
          aria-describedby={usernameError ? "username-help username-error" : "username-help"}
          aria-invalid={Boolean(usernameError)}
          autoComplete="username"
          defaultValue={state.values?.username}
          id="username"
          maxLength={USERNAME_MAX_LENGTH}
          minLength={USERNAME_MIN_LENGTH}
          name="username"
          pattern="[a-z0-9_]+"
          required
          type="text"
        />
        <p className="field-help" id="username-help">
          Entre 3 y 30 letras minúsculas, números o guiones bajos.
        </p>
        {usernameError && (
          <p className="field-error" id="username-error">
            {usernameError}
          </p>
        )}
      </div>

      <div className="form-field">
        <label htmlFor="displayName">Nombre visible</label>
        <input
          aria-describedby={displayNameError ? "display-name-error" : undefined}
          aria-invalid={Boolean(displayNameError)}
          defaultValue={state.values?.displayName ?? initialDisplayName}
          id="displayName"
          maxLength={DISPLAY_NAME_MAX_LENGTH}
          name="displayName"
          required
          type="text"
        />
        {displayNameError && (
          <p className="field-error" id="display-name-error">
            {displayNameError}
          </p>
        )}
      </div>

      <div className="form-field">
        <label htmlFor="bio">Biografía</label>
        <textarea
          aria-describedby={bioError ? "bio-help bio-error" : "bio-help"}
          aria-invalid={Boolean(bioError)}
          defaultValue={state.values?.bio}
          id="bio"
          maxLength={BIO_MAX_LENGTH}
          name="bio"
          rows={5}
        />
        <p className="field-help" id="bio-help">
          Opcional, hasta 300 caracteres.
        </p>
        {bioError && (
          <p className="field-error" id="bio-error">
            {bioError}
          </p>
        )}
      </div>

      {state.message && (
        <p className="form-status" role="status">
          {state.message}
        </p>
      )}

      <button className="button button-primary" disabled={pending} type="submit">
        {pending ? "Creando perfil…" : "Crear perfil"}
      </button>
    </form>
  );
}