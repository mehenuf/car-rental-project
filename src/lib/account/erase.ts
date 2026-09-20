/** Deleting an account is irreversible, so the person must type their own email address to confirm. */
export function eraseConfirmed(typed: string, accountEmail: string | null | undefined): boolean {
  if (!accountEmail) return false;
  return typed.trim().toLowerCase() === accountEmail.trim().toLowerCase();
}
