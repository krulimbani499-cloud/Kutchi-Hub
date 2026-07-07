import { createFileRoute } from "@tanstack/react-router";
import { BUSINESS_PHOTOS_BUCKET } from "@/lib/business-photos";
import { createServerSupabaseClient } from "@/lib/businesses.server";

const imageTypes: Record<string, string> = {
  avif: "image/avif",
  gif: "image/gif",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

function isValidStorageKey(key: string) {
  return /^[a-f0-9-]{36}\/[a-zA-Z0-9._-]+$/.test(key) && !key.includes("..");
}

function getContentType(key: string, fallback: string) {
  const ext = key.split(".").pop()?.toLowerCase() ?? "";
  return imageTypes[ext] ?? (fallback || "application/octet-stream");
}

export const Route = createFileRoute("/api/public/business-photo" as never)({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const key = new URL(request.url).searchParams.get("key") ?? "";
        if (!isValidStorageKey(key)) {
          return new Response("Not found", { status: 404 });
        }

        const supabase = createServerSupabaseClient();
        const { data, error } = await supabase.storage.from(BUSINESS_PHOTOS_BUCKET).download(key);

        if (error || !data) {
          return new Response("Not found", { status: 404 });
        }

        return new Response(data, {
          headers: {
            "Cache-Control": "public, max-age=3600",
            "Content-Type": getContentType(key, data.type),
          },
        });
      },
    },
  },
});