import Link from "next/link";

import { logout } from "@/app/login/actions";

export default function NoAccessPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-semibold">Kein Zugang</h1>
      <p className="text-neutral-600 dark:text-neutral-400">
        Für dieses Konto ist dieser Bereich nicht freigegeben.
      </p>
      <div className="flex gap-4">
        <Link href="/" className="underline">
          Zur Startseite
        </Link>
        <form action={logout}>
          <button type="submit" className="underline">
            Abmelden
          </button>
        </form>
      </div>
    </main>
  );
}
