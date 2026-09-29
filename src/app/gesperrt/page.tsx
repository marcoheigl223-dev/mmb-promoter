import Link from "next/link";

export default function BlockedPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-semibold">Konto deaktiviert</h1>
      <p className="text-neutral-600 dark:text-neutral-400">
        Dieses Konto wurde deaktiviert. Bitte wende dich an Gabo.
      </p>
      <Link href="/login" className="underline">
        Zur Anmeldung
      </Link>
    </main>
  );
}
