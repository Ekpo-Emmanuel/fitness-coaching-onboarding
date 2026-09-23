"use client";
import Link from "next/link";
import { Brand } from "@/components/product/Brand";
export default function ErrorPage({ retry }: { retry: () => void }) {
  return <main className="setup-page"><Brand /><section className="empty-state mt-12"><p className="eyebrow">Something interrupted this page</p><h1 className="font-display text-3xl mt-3">We couldn’t load this view.</h1><p className="mt-4">Try again to reconnect. If the problem continues, return to your workspace.</p><div className="flex justify-center gap-3"><button className="button button-primary" onClick={retry}>Try again</button><Link className="button" href="/dashboard">Go to dashboard</Link></div></section></main>;
}
