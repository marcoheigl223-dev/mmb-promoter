import Link from "next/link";

import { requireArea } from "@/lib/auth/dal";
import { listDeparturesSplit, signedImageUrls } from "@/lib/admin/queries";
import { formatMadrid } from "@/lib/admin/time";
import { STATUS_LABELS, type Departure } from "@/lib/admin/types";

/** Startseite Admin: alle Termine/Events mit Kontingent-Stand (E3.2). */
export default async function AdminPage() {
  await requireArea("admin");
  const { upcoming, past } = await listDeparturesSplit();
  // E5.3: Vorschaubilder — eine Signier-Anfrage für alle Pfade (privater Bucket)
  const imageUrls = await signedImageUrls([...upcoming, ...past].map((d) => d.image_path));

  return (
    <main className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Termine und Events</h1>
        <Link
          href="/admin/termine/neu"
          className="rounded bg-neutral-900 px-3 py-2 text-sm font-medium text-white dark:bg-neutral-100 dark:text-neutral-900"
        >
          Neuer Termin
        </Link>
      </div>

      {upcoming.length === 0 && past.length === 0 && (
        <p className="text-neutral-600 dark:text-neutral-400">
          Noch keine Termine. Lege den ersten Termin an und trage das Kontingent ein.
        </p>
      )}

      {upcoming.length > 0 && <DepartureTable title="Kommende" rows={upcoming} imageUrls={imageUrls} />}
      {past.length > 0 && <DepartureTable title="Vergangene" rows={past} imageUrls={imageUrls} />}
    </main>
  );
}

function DepartureTable({
  title,
  rows,
  imageUrls,
}: {
  title: string;
  rows: Departure[];
  imageUrls: Record<string, string>;
}) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-neutral-500">
        {title}
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-neutral-500">
            <tr>
              <th className="py-1 pr-2"></th>
              <th className="py-1 pr-4">Wann</th>
              <th className="py-1 pr-4">Titel</th>
              <th className="py-1 pr-4 text-right">Kontingent</th>
              <th className="py-1 pr-4 text-right">Gebucht</th>
              <th className="py-1 pr-4 text-right">Frei</th>
              <th className="py-1">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id} className="border-t border-neutral-200 dark:border-neutral-800">
                <td className="py-2 pr-2">
                  <Thumbnail url={d.image_path ? (imageUrls[d.image_path] ?? null) : null} />
                </td>
                <td className="py-2 pr-4 whitespace-nowrap">{formatMadrid(d.starts_at)}</td>
                <td className="py-2 pr-4">
                  <Link href={`/admin/termine/${d.id}`} className="underline">
                    {d.title}
                  </Link>
                  {d.is_internal && (
                    <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-900 dark:text-amber-100">
                      intern
                    </span>
                  )}
                </td>
                <td className="py-2 pr-4 text-right">{d.capacity_total}</td>
                <td className="py-2 pr-4 text-right">{d.seats_booked_total}</td>
                <td className="py-2 pr-4 text-right">{d.capacity_total - d.seats_booked_total}</td>
                <td className="py-2">{STATUS_LABELS[d.status]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** E5.3: Vorschaubild (signierte URL) oder Platzhalter. */
function Thumbnail({ url }: { url: string | null }) {
  if (!url) {
    return <span className="block h-10 w-14 rounded bg-neutral-100 dark:bg-neutral-800" aria-hidden="true" />;
  }
  // Signierte URL läuft ab — next/image hätte keinen stabilen Cache-Schlüssel.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" className="h-10 w-14 rounded object-cover" />;
}
