import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { cache, Suspense } from "react";
import { ForceError } from "@/components/layout/ForceError";
import { PageContainer } from "@/components/layout/PageContainer";
import { MatchDetailView } from "@/components/match/MatchDetailView";
import { buildMatchDetailModel, matchTitle } from "@/lib/match-detail-model";
import { isPlausibleMatchId } from "@/lib/match-detail";
import { getMatch } from "@/server/services/match-service";
import { getSettings } from "@/server/services/settings-service";

/** One database read per request, shared by generateMetadata and the page. */
const loadMatch = cache(async (id: string) => {
  if (!isPlausibleMatchId(id)) return null;
  await connection();
  const now = new Date();
  const data = await getMatch(id, now);
  return data ? { ...data, now } : null;
});

export async function generateMetadata({ params }: PageProps<"/matches/[id]">): Promise<Metadata> {
  const { id } = await params;
  const data = await loadMatch(id);
  return { title: data ? matchTitle(data.match) : "Match not found" };
}

async function MatchDetail({ params, searchParams }: PageProps<"/matches/[id]">) {
  const { id } = await params;
  const [data, query] = await Promise.all([loadMatch(id), searchParams]);
  if (!data) notFound();
  const settings = await getSettings();
  const model = buildMatchDetailModel({
    match: data.match,
    previous: data.previous,
    next: data.next,
    settings,
    now: data.now,
    from: query.from,
  });
  return (
    <>
      <h1 className="sr-only">{matchTitle(data.match)}</h1>
      <MatchDetailView m={model} />
    </>
  );
}

export default function MatchDetailPage(props: PageProps<"/matches/[id]">) {
  return (
    <PageContainer width="wide" className="space-y-6">
      <Suspense fallback={null}>
        <ForceError searchParams={props.searchParams} />
      </Suspense>
      <MatchDetail {...props} />
    </PageContainer>
  );
}
