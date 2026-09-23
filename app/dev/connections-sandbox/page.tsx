import { notFound } from "next/navigation";
import { ConnectionsSandbox } from "./ConnectionsSandbox";

export default function ConnectionsSandboxPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <ConnectionsSandbox />;
}
