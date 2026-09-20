import { RegisterForm } from "@/components/site/register-form";

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const { type } = await searchParams;
  const initialType = type === "individual" || type === "company" ? type : "renter";
  return <RegisterForm initialType={initialType} />;
}
