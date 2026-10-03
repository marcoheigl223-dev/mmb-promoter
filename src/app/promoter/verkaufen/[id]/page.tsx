import Link from "next/link";
import { notFound } from "next/navigation";

import { requireArea } from "@/lib/auth/dal";
import { signedImageUrl } from "@/lib/admin/queries";
import { formatMadrid } from "@/lib/admin/time";
import { getSaleDeparture } from "@/lib/promoter/queries";
import { SaleForm } from "./sale-form";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** E5.4: Tickets für ein Event an einen Kunden verkaufen. */
export default async function SellPage(props: PageProps<"/promoter/verkaufen/[id]">) {
  await requireArea("promoter");
  const { id } = await props.params;
  if (!UUID_RE.test(id)) notFound();

  const departure = await getSaleDeparture(id);
  if (!departure) notFound();

  const free = Math.max(departure.capacity_total - departure.seats_booked_total, 0);
  const sellable = departure.status === "open" && free > 0 && new Date(departure.starts_at) > new Date();
  const imageUrl = await signedImageUrl(departure.image_path);

  return (
    <main className="flex flex-col gap-5">
      <Link href="/promoter" className="text-sm underline">
        ← Alle Events
      </Link>

      {imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- signierte URL aus privatem Bucket, kein Image-Optimizer
        <img src={imageUrl} alt="" className="aspect-[2/1] w-full rounded object-cover" />
      )}

      <div>
        <h1 className="text-xl font-semibold">
          {departure.title}
          {departure.is_internal && (
            <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 align-middle text-xs font-medium text-amber-900 dark:bg-amber-900 dark:text-amber-100">
              intern
            </span>
          )}
        </h1>
        <p className="text-neutral-600 dark:text-neutral-400">{formatMadrid(departure.starts_at)}</p>
        <p className="mt-1 text-sm">
          <span className="font-medium">{free}</span> von {departure.capacity_total} Plätzen frei
        </p>
      </div>

      {sellable ? (
        <SaleForm departureId={departure.id} />
      ) : (
        <p role="alert" className="rounded bg-neutral-100 p-3 text-sm dark:bg-neutral-900">
          Dieses Event ist nicht (mehr) verkaufbar — ausverkauft, geschlossen oder bereits vorbei.
        </p>
      )}
    </main>
  );
}
