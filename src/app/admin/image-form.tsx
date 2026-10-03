"use client";

import { useActionState, useState } from "react";

import { INITIAL_FORM_STATE, type FormState } from "@/lib/admin/types";

/**
 * Bild einer Vorlage / eines Termins (E5.3): Anzeige über signierte URL
 * (privater Bucket, F19), Hochladen (ersetzt das bisherige Bild), Entfernen.
 * Beide Formulare rufen Server Actions, die requireArea("admin") prüfen;
 * die Storage-Policies aus 0008 lassen nur network_operator schreiben.
 */

const MAX_BYTES = 5 * 1024 * 1024;

const buttonClass =
  "self-start rounded border border-neutral-900 px-4 py-2 text-sm font-medium disabled:opacity-60 dark:border-neutral-100";

type ImageAction = (prev: FormState, formData: FormData) => Promise<FormState>;

export function ImageForm({
  id,
  imageUrl,
  uploadAction,
  removeAction,
  hint,
}: {
  id: string;
  /** Signierte URL (1 h) oder null, wenn kein Bild gesetzt ist. */
  imageUrl: string | null;
  uploadAction: ImageAction;
  removeAction: ImageAction;
  hint?: string;
}) {
  const [uploadState, uploadFormAction, uploading] = useActionState(uploadAction, INITIAL_FORM_STATE);
  const [removeState, removeFormAction, removing] = useActionState(removeAction, INITIAL_FORM_STATE);
  const [tooLarge, setTooLarge] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      {imageUrl ? (
        // Signierte URL läuft ab — next/image brächte hier nichts (kein stabiler Cache-Schlüssel).
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt="Bild"
          className="max-h-64 w-auto rounded border border-neutral-200 dark:border-neutral-800"
        />
      ) : (
        <p className="text-sm text-neutral-600 dark:text-neutral-400">Noch kein Bild.</p>
      )}
      {hint && <p className="text-sm text-neutral-600 dark:text-neutral-400">{hint}</p>}

      <form action={uploadFormAction} className="flex flex-col gap-3">
        <input type="hidden" name="id" value={id} />
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">{imageUrl ? "Bild ersetzen" : "Bild hochladen"} (JPG, PNG oder WebP, max. 5 MB)</span>
          <input
            type="file"
            name="image"
            accept="image/jpeg,image/png,image/webp"
            required
            className="text-sm"
            onChange={(e) => {
              const f = e.currentTarget.files?.[0];
              setTooLarge(!!f && f.size > MAX_BYTES);
            }}
          />
        </label>
        {tooLarge && (
          <p role="alert" className="text-sm text-red-700 dark:text-red-400">
            Bild ist zu groß (max. 5 MB).
          </p>
        )}
        <Messages error={uploadState.error} ok={uploadState.ok} />
        <button type="submit" disabled={uploading || tooLarge} className={buttonClass}>
          {uploading ? "Hochladen …" : "Bild hochladen"}
        </button>
      </form>

      {imageUrl && (
        <form action={removeFormAction} className="flex flex-col gap-3">
          <input type="hidden" name="id" value={id} />
          <Messages error={removeState.error} ok={removeState.ok} />
          <button type="submit" disabled={removing} className={buttonClass}>
            {removing ? "Entfernen …" : "Bild entfernen"}
          </button>
        </form>
      )}
    </div>
  );
}

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
