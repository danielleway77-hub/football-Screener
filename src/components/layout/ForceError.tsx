import { throwIfForced } from "@/lib/dev-error";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** Dev-only test hook (see lib/dev-error.ts). Render inside <Suspense>; renders nothing. */
export async function ForceError({ searchParams }: Props) {
  await throwIfForced(searchParams);
  return null;
}
