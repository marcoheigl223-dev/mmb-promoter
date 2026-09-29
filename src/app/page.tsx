import { redirect } from "next/navigation";

import { getCurrentAuth } from "@/lib/auth/dal";
import { landingPathFor, LOGIN_PATH } from "@/lib/auth/access";

/** Startseite: nur ein Verteiler. Nicht eingeloggt → Login, sonst nach Rolle. */
export default async function Home() {
  const { userId, profile } = await getCurrentAuth();
  redirect(userId ? landingPathFor(profile) : LOGIN_PATH);
}
