import { notFound } from "next/navigation";

/**
 * Any URL under a valid language that matches no page. Without this the request falls through to the root 404,
 * which has no language, title or site chrome. Calling notFound() here renders `(site)/not-found.tsx` inside the
 * language layout instead: translated, with the header and footer, and a 404 status.
 */
export default function UnmatchedPath() {
  notFound();
}
