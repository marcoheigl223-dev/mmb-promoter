"use client";

import { useActionState } from "react";

import { INITIAL_FORM_STATE, type FormState } from "@/lib/admin/types";
import { PASSWORD_MIN, type ManagedRole } from "@/lib/admin/accounts";
import { createAccount, setAccountActive, setAccountPassword, updateAccountName } from "./actions";

const inputClass =
  "rounded border border-neutral-300 px-3 py-2 text-base dark:border-neutral-700 dark:bg-neutral-900";
const buttonClass =
  "self-start rounded border border-neutral-900 px-4 py-2 text-sm font-medium disabled:opacity-60 dark:border-neutral-100";

function Messages({ error, ok }: FormState) {
  return (
    <>
      {error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
      {ok && (
        <p role="status" className="text-sm text-green-700 dark:text-green-400">
          {ok}
        </p>
      )}
    </>
  );
}

const ROLE_NOUN: Record<ManagedRole, string> = { promoter: "Promoter", guide: "Guide" };

/** Neues Konto — je Rolle ein eigenes Formular (Promoter und Guides getrennt). */
export function CreateAccountForm({ role }: { role: ManagedRole }) {
  const [state, formAction, pending] = useActionState(createAccount, INITIAL_FORM_STATE);
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="role" value={role} />
      <label className="flex flex-col gap-1 text-sm">
        Name
        <input name="display_name" type="text" required maxLength={200} className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        E-Mail (Login)
        <input
          name="email"
          type="email"
          required
          autoComplete="off"
          maxLength={254}
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Start-Passwort (mindestens {PASSWORD_MIN} Zeichen)
        <input
          name="password"
          type="text"
          required
          minLength={PASSWORD_MIN}
          autoComplete="off"
          className={inputClass}
        />
      </label>
      <Messages error={state.error} ok={state.ok} />
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Anlegen …" : `${ROLE_NOUN[role]} anlegen`}
      </button>
    </form>
  );
}

export function AccountActiveForm({ id, active }: { id: string; active: boolean }) {
  const [state, formAction, pending] = useActionState(setAccountActive, INITIAL_FORM_STATE);
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="active" value={active ? "false" : "true"} />
      <Messages error={state.error} ok={state.ok} />
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Speichern …" : active ? "Konto deaktivieren" : "Konto wieder aktivieren"}
      </button>
    </form>
  );
}

export function AccountNameForm({ id, displayName }: { id: string; displayName: string }) {
  const [state, formAction, pending] = useActionState(updateAccountName, INITIAL_FORM_STATE);
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={id} />
      <label className="flex flex-col gap-1 text-sm">
        Name
        <input
          name="display_name"
          type="text"
          required
          maxLength={200}
          defaultValue={displayName}
          className={inputClass}
        />
      </label>
      <Messages error={state.error} ok={state.ok} />
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Speichern …" : "Name speichern"}
      </button>
    </form>
  );
}

export function AccountPasswordForm({ id }: { id: string }) {
  const [state, formAction, pending] = useActionState(setAccountPassword, INITIAL_FORM_STATE);
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={id} />
      <label className="flex flex-col gap-1 text-sm">
        Neues Passwort (mindestens {PASSWORD_MIN} Zeichen)
        <input
          name="password"
          type="text"
          required
          minLength={PASSWORD_MIN}
          autoComplete="off"
          className={inputClass}
        />
      </label>
      <Messages error={state.error} ok={state.ok} />
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Speichern …" : "Passwort setzen"}
      </button>
    </form>
  );
}
