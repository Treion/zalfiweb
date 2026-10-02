import type { Metadata } from "next";
import { Finder } from "@/components/finder/Finder";
import { getFragrances } from "@/db/queries";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Find your world",
  description:
    "Three questions, answered on instinct. Find the ZALFI eau de parfum whose world is already yours.",
  alternates: { canonical: "/find" },
  openGraph: { title: "Find your world | ZALFI" },
};

export default async function FindPage() {
  return <Finder fragrances={await getFragrances()} />;
}
