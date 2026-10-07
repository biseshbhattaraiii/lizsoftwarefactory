import type { Metadata } from "next";
import { Suspense } from "react";
import { ChapterClient } from "./ChapterClient";

export const metadata: Metadata = { title: "Chapter · Stickies" };

async function Chapter({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <ChapterClient token={token} />;
}

export default function ChapterPage({ params }: PageProps<"/c/[token]">) {
  // Reading params is request-time data, so it must sit inside a Suspense boundary.
  return (
    <Suspense>
      <Chapter params={params} />
    </Suspense>
  );
}
