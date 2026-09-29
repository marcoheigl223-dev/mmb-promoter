"use client";

import { useActionState } from "react";

import { login, type LoginState } from "./actions";

const initialState: LoginState = { error: null };

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        E-Mail
        <input
          name="email"
          type="email"
          autoComplete="username"
          required
          className="rounded border border-neutral-300 px-3 py-2 text-base dark:border-neutral-700 dark:bg-neutral-900"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Passwort
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          minLength={12}
          className="rounded border border-neutral-300 px-3 py-2 text-base dark:border-neutral-700 dark:bg-neutral-900"
        />
      </label>
      {state.error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-neutral-900 px-4 py-2 font-medium text-white disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-900"
      >
        {pending ? "Anmelden …" : "Anmelden"}
      </button>
    </form>
  );
}
