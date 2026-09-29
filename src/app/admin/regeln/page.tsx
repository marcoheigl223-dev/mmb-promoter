import Link from "next/link";

import { requireArea } from "@/lib/auth/dal";
import {
  effectiveCommissionCents,
  effectiveGroupRule,
  listCommissionRules,
  listGroupRules,
} from "@/lib/admin/queries";
import { centsToInputValue, formatCents } from "@/lib/admin/money";
import { formatMadrid } from "@/lib/admin/time";
import { GroupRuleForm, StandardCommissionForm } from "./rules-forms";

export default async function RulesPage() {
  await requireArea("admin");
  const [standardNow, standardHistory, groupNow, groupHistory] = await Promise.all([
    effectiveCommissionCents(null),
    listCommissionRules(null),
    effectiveGroupRule(),
    listGroupRules(),
  ]);

  return (
    <main className="flex flex-col gap-8">
      <div>
        <Link href="/admin" className="text-sm underline">
          ← Termine
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Regeln</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Jede Änderung wird als neue Regel mit Gültig-ab gespeichert. Alte Regeln bleiben
          stehen — Verkäufe werden später mit dem Wert abgerechnet, der beim Verkauf galt.
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Provision pro Ticket (Standard)</h2>
        <p className="text-sm">
          Jetzt gültig:{" "}
          <strong>{standardNow === null ? "keine Regel" : formatCents(standardNow)}</strong>
          <span className="text-neutral-500">
            {" "}
            — Ausnahmen für einzelne Termine/Events setzt du auf der jeweiligen Terminseite.
          </span>
        </p>
        <StandardCommissionForm
          currentInput={standardNow === null ? "" : centsToInputValue(standardNow)}
        />
        <History
          rows={standardHistory.map((r) => ({
            id: r.id,
            validFrom: r.valid_from,
            value: r.commission_cents === null ? "—" : formatCents(r.commission_cents),
            createdAt: r.created_at,
          }))}
          valueLabel="Provision"
        />
      </section>

      <section className="flex flex-col gap-3 border-t border-neutral-200 pt-6 dark:border-neutral-800">
        <h2 className="text-lg font-semibold">Gruppenregel (10+1)</h2>
        <p className="text-sm">
          Jetzt gültig:{" "}
          <strong>
            {groupNow === null
              ? "keine Regel"
              : `ab ${groupNow.threshold_persons} Personen ${groupNow.free_persons} gratis`}
          </strong>
          <span className="text-neutral-500">
            {" "}
            — Gratisplätze belegen Kontingent; bezahlt und provisioniert wird der Rest.
          </span>
        </p>
        <GroupRuleForm
          currentThreshold={groupNow?.threshold_persons ?? null}
          currentFree={groupNow?.free_persons ?? null}
        />
        <History
          rows={groupHistory.map((r) => ({
            id: r.id,
            validFrom: r.valid_from,
            value: `ab ${r.threshold_persons} Personen ${r.free_persons} gratis`,
            createdAt: r.created_at,
          }))}
          valueLabel="Regel"
        />
      </section>
    </main>
  );
}

function History({
  rows,
  valueLabel,
}: {
  rows: { id: string; validFrom: string; value: string; createdAt: string }[];
  valueLabel: string;
}) {
  if (rows.length === 0) return null;
  return (
    <div className="overflow-x-auto">
      <table className="mt-2 w-full text-sm">
        <thead className="text-left text-xs uppercase text-neutral-500">
          <tr>
            <th className="py-1 pr-4">Gültig ab</th>
            <th className="py-1 pr-4">{valueLabel}</th>
            <th className="py-1">Angelegt</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-neutral-200 dark:border-neutral-800">
              <td className="py-1 pr-4">{formatMadrid(r.validFrom)}</td>
              <td className="py-1 pr-4">{r.value}</td>
              <td className="py-1 text-neutral-500">{formatMadrid(r.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
