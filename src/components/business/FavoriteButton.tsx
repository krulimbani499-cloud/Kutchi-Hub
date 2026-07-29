import { Heart, Loader2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

interface FavoriteButtonProps {
  businessId: string;
  className?: string;
  size?: "sm" | "md";
}

export function FavoriteButton({ businessId, className, size = "md" }: FavoriteButtonProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const favoriteKey = ["favorite", businessId, user?.id ?? "anon"] as const;

  const { data: isFavorite = false } = useQuery({
    queryKey: favoriteKey,
    enabled: !!user,
    queryFn: async () => {
      if (!user) return false;
      const { data, error } = await supabase
        .from("business_favorites")
        .select("id")
        .eq("user_id", user.id)
        .eq("business_id", businessId)
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
  });

  const mutation = useMutation({
    mutationFn: async (nextFavorite: boolean) => {
      if (!user) throw new Error("Not signed in");
      if (nextFavorite) {
        const { error } = await supabase
          .from("business_favorites")
          .insert({ user_id: user.id, business_id: businessId });
        if (error && !error.message.includes("duplicate")) throw error;
      } else {
        const { error } = await supabase
          .from("business_favorites")
          .delete()
          .eq("user_id", user.id)
          .eq("business_id", businessId);
        if (error) throw error;
      }
      return nextFavorite;
    },
    onSuccess: (nextFavorite) => {
      queryClient.setQueryData(favoriteKey, nextFavorite);
      queryClient.invalidateQueries({ queryKey: ["my-favorites"] });
    },
  });

  const dim = size === "sm" ? "h-8 w-8" : "h-9 w-9";
  const iconDim = size === "sm" ? "h-4 w-4" : "h-5 w-5";

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      navigate({ to: "/auth" });
      return;
    }
    mutation.mutate(!isFavorite);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
      aria-pressed={isFavorite}
      disabled={mutation.isPending}
      className={cn(
        "inline-flex items-center justify-center rounded-full bg-white/90 text-foreground shadow-sm ring-1 ring-border backdrop-blur transition hover:bg-white",
        dim,
        className,
      )}
    >
      {mutation.isPending ? (
        <Loader2 className={cn(iconDim, "animate-spin")} />
      ) : (
        <Heart
          className={cn(
            iconDim,
            isFavorite ? "fill-[#ff2d55] text-[#ff2d55]" : "text-muted-foreground",
          )}
        />
      )}
    </button>
  );
}