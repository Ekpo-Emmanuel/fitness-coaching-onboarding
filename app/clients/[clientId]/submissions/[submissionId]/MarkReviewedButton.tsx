"use client";

import { useRouter } from "next/navigation";
import { markReviewedAction } from "@/lib/clients/actions";

export function MarkReviewedButton({ submissionId }: { submissionId: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className="rounded-full border border-line px-4 py-2 text-sm"
      onClick={async () => {
        await markReviewedAction(submissionId);
        router.refresh();
      }}
    >
      Mark reviewed
    </button>
  );
}
