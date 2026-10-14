"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { updateProfileAction } from "@/actions/profiles";
import {
  BIO_MAX_LENGTH,
  DISPLAY_NAME_MAX_LENGTH,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  type ProfileInput,
} from "@/lib/profiles/profile-contract";
import { initialUpdateProfileState } from "@/lib/profiles/profile-action-state";

export function EditProfileForm({ initialValues }: { initialValues: ProfileInput }) {
  const [values, setValues] = useState(initialValues);
  const formRef = useRef<HTMLFormElement>(null);
  const statusRef = useRef<HTMLParagraphElement>(null);
  const [state, formAction, pending] = useActionState(
    async (previousState: typeof initialUpdateProfileState, formData: FormData) => {
      const result = await updateProfileAction(previousState, formData);
      if (result.values) setValues(result.values);
      return result;
    },
    initialUpdateProfileState,
  );
  const usernameError = state.fieldErrors?.username?.[0];
  const displayNameError = state.fieldErrors?.displayName?.[0];
  const bioError = state.fieldErrors?.bio?.[0];

  useEffect(() => {
    if (state.status === "idle") return;
    const invalidField = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
    if (invalidField) invalidField.focus();
    else statusRef.current?.focus();
  }, [state]);

  function change(field: keyof ProfileInput, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  return (
    <form className="profile-form" action={formAction} aria-busy={pending} noValidate ref={formRef}>
      <div className="form-field">
        <label htmlFor="username">Nombre de usuario</label>
        <input
          aria-describedby={usernameError ? "username-help username-error" : "username-help"}
          aria-invalid={Boolean(usernameError)}
          autoComplete="username"
          disabled={pending}
          id="username"
          maxLength={USERNAME_MAX_LENGTH}
          minLength={USERNAME_MIN_LENGTH}
          name="username"
          onChange={(event) => change("username", event.target.value)}
          pattern="[a-z0-9_]+"
          required
          type="text"
          value={values.username}
        />
        <p className="field-help" id="username-help">
          Entre 3 y 30 letras minúsculas, números o guiones bajos. Cambiarlo cambia tu dirección pública.
        </p>
        {usernameError && <p className="field-error" id="username-error">{usernameError}</p>}
      </div>
      <div className="form-field">
        <label htmlFor="displayName">Nombre visible</label>
        <input
          aria-describedby={displayNameError ? "display-name-error" : undefined}
          aria-invalid={Boolean(displayNameError)}
          disabled={pending}
          id="displayName"
          maxLength={DISPLAY_NAME_MAX_LENGTH}
          name="displayName"
          onChange={(event) => change("displayName", event.target.value)}
          required
          type="text"
          value={values.displayName}
        />
        {displayNameError && <p className="field-error" id="display-name-error">{displayNameError}</p>}
      </div>
      <div className="form-field">
        <label htmlFor="bio">Biografía</label>
        <textarea
          aria-describedby={bioError ? "bio-help bio-count bio-error" : "bio-help bio-count"}
          aria-invalid={Boolean(bioError)}
          disabled={pending}
          id="bio"
          maxLength={BIO_MAX_LENGTH}
          name="bio"
          onChange={(event) => change("bio", event.target.value)}
          rows={5}
          value={values.bio}
        />
        <p className="field-help" id="bio-help">Opcional, hasta 300 caracteres.</p>
        <p className="field-help" id="bio-count">
          {values.bio.length} de {BIO_MAX_LENGTH} caracteres.
        </p>
        {bioError && <p className="field-error" id="bio-error">{bioError}</p>}
      </div>
      {(pending || state.message) && (
        <p className="form-status" ref={statusRef} role="status" tabIndex={-1}>
          {pending ? "Guardando cambios..." : state.message}
        </p>
      )}
      {state.status === "unauthorized" && (
        <Link href="/sign-in">Volver a iniciar sesión</Link>
      )}
      <div className="profile-actions">
        <button className="button button-primary" disabled={pending} type="submit">
          {pending ? "Guardando..." : "Guardar cambios"}
        </button>
        <Link className="button button-secondary" href="/perfil">Volver a mi perfil</Link>
      </div>
    </form>
  );
}
