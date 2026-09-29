import { redirect } from "next/navigation";

import { getCurrentAuth } from "@/lib/auth/dal";
import { landingPathFor } from "@/lib/auth/access";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  // Wer schon eingeloggt ist und ein aktives Profil hat, landet direkt im Bereich.
  const { userId, profile } = await getCurrentAuth();
  if (userId && profile?.active) {
    redirect(landingPathFor(profile));
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-6">
      <h1 className="text-2xl font-semibold">mmb-promoter — Anmeldung</h1>
      <LoginForm />
    </main>
  );
}
