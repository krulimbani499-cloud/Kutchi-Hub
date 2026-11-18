import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth";
import { blockReviewUser, listReviewBlocks, unblockReviewUser } from "@/lib/review-moderation.functions";

/**
 * "Hide reviews from this user" for the signed-in viewer. The business page data is public and cached, so the hiding is applied
 * in the browser: the page still receives every review, this list says which authors to leave out. Signed-out visitors: empty.
 */
export function useReviewBlocks() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const listFn = useServerFn(listReviewBlocks);
  const blockFn = useServerFn(blockReviewUser);
  const unblockFn = useServerFn(unblockReviewUser);
  const key = useMemo(() => ["review-blocks", user?.id ?? null], [user?.id]);

  const { data } = useQuery({
    queryKey: key,
    queryFn: () => listFn(),
    enabled: !!user,
    staleTime: 5 * 60_000,
  });
  const blocked = useMemo(() => new Set<string>(data ?? []), [data]);

  const block = useCallback(
    async (userId: string) => {
      await blockFn({ data: { userId } });
      qc.setQueryData<string[]>(key, (old) => [...new Set([...(old ?? []), userId])]);
    },
    [blockFn, qc, key],
  );
  const unblock = useCallback(
    async (userId: string) => {
      await unblockFn({ data: { userId } });
      qc.setQueryData<string[]>(key, (old) => (old ?? []).filter((id) => id !== userId));
    },
    [unblockFn, qc, key],
  );

  return { blocked, block, unblock };
}
