import "server-only";

import { randomUUID } from "node:crypto";

import { createClient } from "@/lib/supabase/server";
import { dbErrorMessage } from "./errors";

/**
 * Event-Bilder (E5.3, Migration 0008): Upload, Optimierung und Ablage im
 * PRIVATEN Storage-Bucket „event-images" (F19). Alles läuft über den
 * RLS-Client des Nutzers — die Storage-Policies aus 0008 (nur network_operator
 * schreibt, aktive Profile lesen) sind die zweite Schranke, nie service_role.
 *
 * Ablauf: Datei prüfen (Typ, Größe) → mit sharp verkleinern (max. 1600 px
 * Kante, WebP, Metadaten weg) → unter <kind>/<owner-id>/<uuid>.webp hochladen
 * → Pfad in der Zeile speichern → altes Objekt entfernen, wenn es sonst
 * niemand mehr referenziert (ein Event aus einer Vorlage trägt denselben Pfad).
 */

export const IMAGE_BUCKET = "event-images";
/** Marco: „Größenlimit ~5 MB" — gilt für die hochgeladene Datei; der Bucket hat dasselbe Limit. */
export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const IMAGE_ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
/** Längste Kante nach der Optimierung (Admin-Ansicht + Promoter-Dashboard brauchen nicht mehr). */
export const IMAGE_MAX_EDGE = 1600;
/** Gültigkeit signierter URLs — eine Seitenansicht, kein Dauerlink. */
export const IMAGE_SIGNED_URL_SECONDS = 3600;

export type ImageKind = "templates" | "departures";
export type ImageTable = "event_templates" | "tour_departures";

export function validateImageFile(value: FormDataEntryValue | null): { file: File } | { error: string } {
  if (!(value instanceof File) || value.size === 0) {
    return { error: "Bitte eine Bilddatei auswählen." };
  }
  if (value.size > IMAGE_MAX_BYTES) {
    return { error: "Bild ist zu groß (max. 5 MB)." };
  }
  if (!(IMAGE_ALLOWED_TYPES as readonly string[]).includes(value.type)) {
    return { error: "Nur JPG, PNG oder WebP." };
  }
  return { file: value };
}

/**
 * Web-optimiert: Ausrichtung aus EXIF anwenden, auf max. 1600 px verkleinern
 * (nie vergrößern), als WebP speichern. sharp entfernt dabei Metadaten (EXIF,
 * GPS) — Kundenfotos vom Strand tragen sonst Standortdaten.
 */
export async function optimizeImage(input: ArrayBuffer): Promise<{ buffer: Buffer } | { error: string }> {
  const { default: sharp } = await import("sharp");
  const source = sharp(Buffer.from(input));
  let format: string | undefined;
  try {
    format = (await source.metadata()).format;
  } catch {
    return { error: "Datei ist kein lesbares Bild." };
  }
  if (format !== "jpeg" && format !== "png" && format !== "webp") {
    return { error: "Datei ist kein JPG/PNG/WebP." };
  }
  const buffer = await source
    .rotate()
    .resize({ width: IMAGE_MAX_EDGE, height: IMAGE_MAX_EDGE, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();
  return { buffer };
}

/** Optimiert und lädt hoch; liefert den Objekt-Pfad im Bucket. */
export async function storeImage(
  kind: ImageKind,
  ownerId: string,
  file: File,
): Promise<{ path: string } | { error: string }> {
  const optimized = await optimizeImage(await file.arrayBuffer());
  if ("error" in optimized) return optimized;

  const path = `${kind}/${ownerId}/${randomUUID()}.webp`;
  const supabase = await createClient();
  const { error } = await supabase.storage
    .from(IMAGE_BUCKET)
    .upload(path, optimized.buffer, { contentType: "image/webp", upsert: false });
  if (error) {
    return { error: `Upload fehlgeschlagen: ${error.message}` };
  }
  return { path };
}

/** Setzt image_path auf der Zeile (null = Bild entfernen) und liefert den vorherigen Pfad. */
export async function setImageOnRow(
  table: ImageTable,
  id: string,
  newPath: string | null,
): Promise<{ oldPath: string | null } | { error: string }> {
  const supabase = await createClient();
  const current = await supabase.from(table).select("image_path").eq("id", id).maybeSingle();
  if (current.error) return { error: dbErrorMessage(current.error) };
  if (!current.data) return { error: "Datensatz nicht gefunden." };

  const { data, error } = await supabase.from(table).update({ image_path: newPath }).eq("id", id).select("id");
  if (error) return { error: dbErrorMessage(error) };
  if (!data || data.length === 0) return { error: "Datensatz nicht gefunden." };
  return { oldPath: (current.data as { image_path: string | null }).image_path };
}

/**
 * Entfernt ein Objekt aus dem Bucket, wenn keine Vorlage und kein Termin es
 * mehr referenziert. Fehler beim Aufräumen werden geschluckt — die Zeile ist
 * bereits gespeichert; ein verwaistes Objekt ist nur Speicherplatz.
 */
export async function removeStoredImageIfUnreferenced(path: string | null): Promise<void> {
  if (!path) return;
  const supabase = await createClient();
  const [templates, departures] = await Promise.all([
    supabase.from("event_templates").select("id").eq("image_path", path).limit(1),
    supabase.from("tour_departures").select("id").eq("image_path", path).limit(1),
  ]);
  if (templates.error || departures.error) return;
  if ((templates.data?.length ?? 0) > 0 || (departures.data?.length ?? 0) > 0) return;
  await supabase.storage.from(IMAGE_BUCKET).remove([path]);
}

/** Verwirft ein gerade hochgeladenes Objekt, wenn das Speichern der Zeile scheiterte. */
export async function discardUploadedImage(path: string): Promise<void> {
  const supabase = await createClient();
  await supabase.storage.from(IMAGE_BUCKET).remove([path]);
}
