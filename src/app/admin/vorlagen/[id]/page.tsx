import Link from "next/link";
import { notFound } from "next/navigation";

import { requireArea } from "@/lib/auth/dal";
import {
  effectiveCommissionCents,
  getTemplate,
  listDeparturesFromTemplate,
  signedImageUrl,
  standardPricing,
} from "@/lib/admin/queries";
import { formatMadrid } from "@/lib/admin/time";
import { STATUS_LABELS } from "@/lib/admin/types";
import { ImageForm } from "../../image-form";
import { removeTemplateImage, updateTemplate, uploadTemplateImage } from "../actions";
import { TemplateActiveForm, TemplateForm } from "../template-form";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function TemplatePage(props: PageProps<"/admin/vorlagen/[id]">) {
  await requireArea("admin");
  const { id } = await props.params;
  if (!UUID_RE.test(id)) notFound();

  const template = await getTemplate(id);
  if (!template) notFound();

  const [standard, commission, departures, imageUrl] = await Promise.all([
    standardPricing(),
    effectiveCommissionCents(null),
    listDeparturesFromTemplate(id),
    // E5.3: privater Bucket → signierte URL (1 h), null ohne Bild
    signedImageUrl(template.image_path),
  ]);

  return (
    <main className="flex flex-col gap-8">
      <div>
        <Link href="/admin/vorlagen" className="text-sm underline">
          ← Vorlagen
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">
          {template.name}
          {!template.active && (
            <span className="ml-2 rounded bg-neutral-200 px-2 py-0.5 align-middle text-xs font-medium text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
              deaktiviert
            </span>
          )}
        </h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Event-Titel „{template.title}“ · Kontingent {template.capacity_total} · zuletzt geändert{" "}
          {formatMadrid(template.updated_at)}
        </p>
        {template.active && (
          <p className="mt-3">
            <Link
              href={`/admin/termine/neu?vorlage=${template.id}`}
              className="rounded bg-neutral-900 px-3 py-2 text-sm font-medium text-white dark:bg-neutral-100 dark:text-neutral-900"
            >
              Event aus dieser Vorlage anlegen
            </Link>
          </p>
        )}
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Vorlage bearbeiten</h2>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Änderungen gelten nur für Events, die du danach aus der Vorlage anlegst. Bereits
          angelegte Events behalten ihre Werte.
        </p>
        <TemplateForm
          action={updateTemplate}
          initial={template}
          submitLabel="Speichern"
          standardPricing={standard}
          standardCommission={commission}
        />
      </section>

      <section className="flex flex-col gap-3 border-t border-neutral-200 pt-6 dark:border-neutral-800">
        <h2 className="text-lg font-semibold">Bild</h2>
        <ImageForm
          id={template.id}
          imageUrl={imageUrl}
          uploadAction={uploadTemplateImage}
          removeAction={removeTemplateImage}
          hint="Wird beim Anlegen eines Events aus dieser Vorlage übernommen; bestehende Events bleiben unverändert."
        />
      </section>

      <section className="flex flex-col gap-3 border-t border-neutral-200 pt-6 dark:border-neutral-800">
        <h2 className="text-lg font-semibold">Aktiv / deaktiviert</h2>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Vorlagen werden nicht gelöscht, damit die Herkunft bestehender Events nachvollziehbar
          bleibt. Aus einer deaktivierten Vorlage lassen sich keine neuen Events anlegen.
        </p>
        <TemplateActiveForm template={template} />
      </section>

      <section className="flex flex-col gap-3 border-t border-neutral-200 pt-6 dark:border-neutral-800">
        <h2 className="text-lg font-semibold">Events aus dieser Vorlage</h2>
        {departures.length === 0 ? (
          <p className="text-sm text-neutral-500">Noch kein Event aus dieser Vorlage angelegt.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="mt-2 w-full text-sm">
              <thead className="text-left text-xs uppercase text-neutral-500">
                <tr>
                  <th className="py-1 pr-4">Wann</th>
                  <th className="py-1 pr-4">Titel</th>
                  <th className="py-1 pr-4 text-right">Kontingent</th>
                  <th className="py-1 pr-4 text-right">Gebucht</th>
                  <th className="py-1">Status</th>
                </tr>
              </thead>
              <tbody>
                {departures.map((d) => (
                  <tr key={d.id} className="border-t border-neutral-200 dark:border-neutral-800">
                    <td className="py-1 pr-4 whitespace-nowrap">{formatMadrid(d.starts_at)}</td>
                    <td className="py-1 pr-4">
                      <Link href={`/admin/termine/${d.id}`} className="underline">
                        {d.title}
                      </Link>
                    </td>
                    <td className="py-1 pr-4 text-right">{d.capacity_total}</td>
                    <td className="py-1 pr-4 text-right">{d.seats_booked_total}</td>
                    <td className="py-1">{STATUS_LABELS[d.status]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
