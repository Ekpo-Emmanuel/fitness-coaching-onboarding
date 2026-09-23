import { LoginForm } from "@/app/login/LoginForm";
import { AuthLayout } from "@/components/product/AuthLayout";
export const dynamic = "force-dynamic";
export const metadata = { title: "Sign in" };
export default function Page() { return <AuthLayout mode="signin"><LoginForm initialMode="signin" /></AuthLayout>; }
