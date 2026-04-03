import { Bell, CheckCheck } from "lucide-react";
import { List, type RowComponentProps } from "react-window";
import { useMemo, useState } from "react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useNotificationCenter } from "@/hooks/useGrowthFeatures";

const ROW_HEIGHT = 88;

const NotificationRow = ({
  index,
  style,
  items,
  onRead,
}: RowComponentProps<{
  items: ReturnType<typeof useNotificationCenter>["data"];
  onRead: (id: string) => void;
}>) => {
  const item = items?.[index];
  if (!item) return null;
  return (
    <button
      type="button"
      style={style}
      onClick={() => onRead(item.id)}
      className={`w-full border-b border-white/6 px-3 py-3 text-left ${item.read ? "bg-transparent" : "bg-cyan-500/8"}`}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-white">{item.title}</p>
        {!item.read ? <span className="h-2.5 w-2.5 rounded-full bg-cyan-300" /> : null}
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-300/78">{item.message}</p>
    </button>
  );
};

const NotificationBell = () => {
  const [open, setOpen] = useState(false);
  const { data, unreadCount, markRead, isLoading } = useNotificationCenter();
  const height = useMemo(() => Math.min(352, Math.max(ROW_HEIGHT, (data?.length || 1) * ROW_HEIGHT)), [data]);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="relative inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-slate-100 transition hover:border-cyan-300/28 hover:bg-cyan-500/8"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          {unreadCount ? (
            <span className="absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-cyan-400 px-1 text-[10px] font-bold text-slate-950">
              {unreadCount}
            </span>
          ) : null}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[22rem] border-[var(--border)] bg-[rgba(10,10,15,0.97)] p-0 text-[var(--text)] backdrop-blur-xl">
        <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
          <div>
            <p className="terminal-font text-[11px] uppercase tracking-[0.22em] text-slate-500">Notifications</p>
            <p className="mt-1 text-sm text-slate-200">{unreadCount} unread</p>
          </div>
          <CheckCheck className="h-4 w-4 text-cyan-200/80" />
        </div>
        {isLoading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 3 }, (_, index) => (
              <div key={index} className="h-16 animate-pulse rounded-2xl bg-white/[0.04]" />
            ))}
          </div>
        ) : data?.length ? (
          <List
            defaultHeight={height}
            rowCount={data.length}
            rowHeight={ROW_HEIGHT}
            rowComponent={NotificationRow}
            rowProps={{ items: data, onRead: markRead }}
            style={{ height, width: 352 }}
          />
        ) : (
          <div className="p-4 text-sm text-slate-400">No notifications yet. Reward events, streak nudges, and referral updates appear here.</div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default NotificationBell;
