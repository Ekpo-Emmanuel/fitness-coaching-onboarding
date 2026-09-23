import Link from "next/link";
import { Brand } from "@/components/product/Brand";
export default function NotFound() {
  return <main className="setup-page"><Link href="/"><Brand /></Link><section className="empty-state mt-12"><p className="eyebrow">404 · Page not found</p><h1 className="font-display text-3xl mt-3">This link doesn’t lead anywhere.</h1><p className="mt-4">The page may have moved or the onboarding may no longer be available. Check the link you received.</p><Link className="button button-primary" href="/">Back to Coaching</Link></section></main>;
}
