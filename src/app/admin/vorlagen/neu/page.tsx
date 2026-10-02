import Link from "next/link";

import { requireArea } from "@/lib/auth/dal";
import { effectiveCommissionCents, standardPricing } from "@/lib/admin/queries";
import { createTemplate } from "../actions";
import { TemplateForm } from "../template-form";

export default async function NewTemplatePage() {
  await requireArea("admin");
  const [standard, commission] = await Promise.all([standardPricing(), effectiveCommissionCents(null)]);

  return (
    <main className="flex flex-col gap-6">
      <div>
        <Link href="/admin/vorlagen" className="text-sm underline">
          ← Vorlagen
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Neue Eventvorlage</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Alles außer Datum und Uhrzeit. Beträge leer lassen = beim Event gilt der jeweilige
          Standard aus „Regeln“.
        </p>
      </div>
      <TemplateForm
        action={createTemplate}
        submitLabel="Vorlage anlegen"
        standardPricing={standard}
        standardCommission={commission}
      />
    </main>
  );
}
