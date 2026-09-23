// Checks the booking form before it is sent. It is deliberately small and does not use Zod: the server validates
// every request again with the full schema (CreateBookingSchema), and keeping Zod out of the browser bundle takes
// about 80 KB (gzipped) off the vehicle page's first load.

export type ContactProblem = "nameRequired" | "emailInvalid";

/** Enough to catch a typo before sending: something, an @, something, a dot, something. The server decides for real. */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateContact(input: { name: string; email: string }): { customer_name?: ContactProblem; email?: ContactProblem } {
  const problems: { customer_name?: ContactProblem; email?: ContactProblem } = {};
  if (input.name.trim().length === 0) problems.customer_name = "nameRequired";
  if (!EMAIL_SHAPE.test(input.email.trim())) problems.email = "emailInvalid";
  return problems;
}
