import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { PageSkeleton } from "./components/layout/PageSkeleton";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadDelay: 30,
    defaultPreloadStaleTime: 0,
    // Show a skeleton only if a page is still loading after 150ms, and keep it for at least
    // 300ms once shown, so fast loads never flash.
    defaultPendingComponent: PageSkeleton,
    defaultPendingMs: 150,
    defaultPendingMinMs: 300,
  });

  return router;
};
