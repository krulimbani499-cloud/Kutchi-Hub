import { Bell } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "@/lib/notifications.functions";

export function NotificationsBell() {
  const fetchList = useServerFn(listNotifications);
  const markRead = useServerFn(markNotificationRead);
  const markAll = useServerFn(markAllNotificationsRead);
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => fetchList(),
    refetchInterval: 60_000,
  });

  const notifications = data?.notifications ?? [];
  const unread = data?.unreadCount ?? 0;

  const handleClick = async (id: string) => {
    await markRead({ data: { id } }).catch(() => {});
    qc.invalidateQueries({ queryKey: ["notifications"] });
  };

  const handleMarkAll = async () => {
    await markAll().catch(() => {});
    qc.invalidateQueries({ queryKey: ["notifications"] });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#ff6a00] px-1 text-[10px] font-bold text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-semibold">Notifications</span>
          {unread > 0 && (
            <button
              onClick={handleMarkAll}
              className="text-xs text-primary hover:underline"
            >
              Mark all read
            </button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              No notifications yet.
            </p>
          ) : (
            notifications.map((n) => {
              const inner = (
                <div
                  className={`border-b px-3 py-2 text-sm last:border-0 ${
                    !n.read ? "bg-muted/40" : ""
                  }`}
                >
                  <div className="font-medium text-foreground">{n.title}</div>
                  {n.body && (
                    <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                      {n.body}
                    </div>
                  )}
                  <div className="mt-1 text-[10px] text-muted-foreground">
                    {new Date(n.created_at).toLocaleString()}
                  </div>
                </div>
              );
              return n.link_url ? (
                <a
                  key={n.id}
                  href={n.link_url}
                  onClick={() => handleClick(n.id)}
                  className="block hover:bg-accent"
                >
                  {inner}
                </a>
              ) : (
                <button
                  key={n.id}
                  onClick={() => handleClick(n.id)}
                  className="block w-full text-left hover:bg-accent"
                >
                  {inner}
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
