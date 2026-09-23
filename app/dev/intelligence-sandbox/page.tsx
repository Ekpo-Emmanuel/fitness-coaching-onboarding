import { notFound } from "next/navigation";
import { IntelligenceSandbox } from "./IntelligenceSandbox";

export default function IntelligenceSandboxPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <IntelligenceSandbox />;
}
