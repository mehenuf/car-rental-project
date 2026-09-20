import type { Metadata } from "next";
import type { ReactNode } from "react";

// `absolute` opts out of the root layout's "%s | BestCar" template — this
// route sits outside the admin/(protected) layout (which defines its own
// "%s | BestCar Admin" template), so without this the root template would
// wrap the string below into "... | BestCar Admin | BestCar".
export const metadata: Metadata = { title: { absolute: "Sign In | BestCar Admin" } };

export default function AdminLoginLayout({ children }: { children: ReactNode }) {
  return children;
}
