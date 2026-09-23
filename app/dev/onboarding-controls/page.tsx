import { notFound } from "next/navigation";
import { ControlsPreview } from "./preview";
export default function ControlsPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <ControlsPreview />;
}
