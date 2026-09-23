import { notFound } from "next/navigation";
import { PrivacySandbox } from "./PrivacySandbox";

export default function PrivacySandboxPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <PrivacySandbox />;
}
