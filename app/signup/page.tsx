import { LoginForm } from "@/app/login/LoginForm";
import { AuthLayout } from "@/components/product/AuthLayout";
export const dynamic = "force-dynamic";
export const metadata = { title: "Create account" };
export default function Page() { return <AuthLayout mode="signup"><LoginForm initialMode="signup" /></AuthLayout>; }
