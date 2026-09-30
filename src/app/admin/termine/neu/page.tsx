import Link from "next/link";

import { requireArea } from "@/lib/auth/dal";
import { standardPricing } from "@/lib/admin/queries";
import { createDeparture } from "../actions";
import { DepartureForm } from "../departure-form";

export default async function NewDeparturePage() {
  await requireArea("admin");
  const standard = await standardPricing();

  return (
    <main className="flex flex-col gap-6">
      <div>
        <Link href="/admin" className="text-sm underline">
          ← Termine
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Neuer Termin / Event</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Das Kontingent ist die Zahl der Plätze, die das Promoter-Netzwerk für diesen
          Termin verkaufen darf. Die Sperre auf der Boots-Seite bleibt ein manueller Schritt.
          Preis und Anzahlung pro Person gelten nach Standard, solange du hier nichts einträgst.
        </p>
      </div>
      <DepartureForm
        action={createDeparture}
        submitLabel="Termin anlegen"
        standardPricing={standard}
      />
    </main>
  );
}
