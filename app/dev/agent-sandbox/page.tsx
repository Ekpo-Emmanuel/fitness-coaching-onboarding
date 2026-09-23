import { notFound } from "next/navigation";
import { AgentSandbox } from "./AgentSandbox";

export default function AgentSandboxPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <AgentSandbox />;
}
