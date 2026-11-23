// PROTOTYPE, throwaway. Answers ticket #13: "What does the Notification Feed
// look like in Cadence?"
//
// Three variants of the Notification Feed, switchable via `?variant=A|B|C` on
// every app route (hosted by the app layout + sidebar):
//   A: bell + popover in the sidebar header
//   B: "Notifications" sidebar row + slide-over drawer
//   C: docked right rail with category filters
//
// Data is IN-MEMORY FIXTURES shaped like Knock feed entries (seen_at / read_at),
// because no Knock keys exist in this checkout (.env missing). No vendor calls.
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  PanelRightClose,
  PanelRightOpen,
  X,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { UserRole } from "~/db/schema";

type Category = "Refunds" | "Courses" | "Community" | "Teams";
type Item = {
  id: string;
  category: Category;
  actor?: string;
  text: string;
  href: string;
  minutesAgo: number;
  seen_at: string | null;
  read_at: string | null;
};

const mk = (
  id: string,
  category: Category,
  text: string,
  href: string,
  minutesAgo: number,
  actor?: string
): Item => ({ id, category, text, href, minutesAgo, actor, seen_at: null, read_at: null });

function fixtures(role: UserRole | null, isTeamAdmin: boolean): Item[] {
  const out: Item[] = [];
  if (role === UserRole.Admin) {
    out.push(
      mk("a1", "Refunds", "requested a refund for Advanced TypeScript", "/admin/refunds", 4, "Sam Rivera"),
      mk("a2", "Refunds", "Refund for Sam Rivera failed to send. Needs attention.", "/admin/refunds", 95),
      mk("a3", "Refunds", "requested a refund for React Patterns", "/admin/refunds", 60 * 26, "Priya Shah")
    );
  } else if (role === UserRole.Instructor) {
    out.push(
      mk("i1", "Courses", "enrolled in Advanced TypeScript", "/instructor", 7, "Jo Park"),
      mk("i2", "Community", "asked a question on “Generics in depth”", "/instructor/questions", 31, "Mia Chen"),
      mk("i3", "Courses", "left the first rating on React Patterns: 5 stars", "/instructor", 60 * 5, "Lee Ortiz"),
      mk("i4", "Community", "replied to your answer on “Mapped types”", "/instructor/questions", 60 * 27, "Ana Ruiz")
    );
  } else {
    out.push(
      mk("s1", "Refunds", "Your refund for Advanced TypeScript was approved.", "/dashboard", 12),
      mk("s2", "Refunds", "Your refund of $49.00 was issued.", "/dashboard", 11),
      mk("s3", "Courses", "New lesson in React Patterns: “Compound components”", "/courses", 60 * 3),
      mk("s4", "Community", "replied to your comment on “Closures”", "/courses", 60 * 30, "Dana Wu"),
      mk("s5", "Refunds", "Your refund request for Node Basics was declined.", "/dashboard", 60 * 52)
    );
  }
  if (isTeamAdmin) {
    out.push(mk("t1", "Teams", "claimed a seat on your team", "/team", 20, "Kai Novak"));
  }
  return out.sort((a, b) => a.minutesAgo - b.minutesAgo);
}

function ago(m: number) {
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  if (m < 60 * 24) return `${Math.floor(m / 60)}h`;
  return `${Math.floor(m / 60 / 24)}d`;
}
const dayGroup = (m: number) => (m < 60 * 24 ? "Today" : "Earlier");

type Ctx = {
  items: Item[];
  unread: number;
  unseen: number;
  open: boolean;
  setOpen: (v: boolean) => void;
  markAllSeen: () => void;
  markAllRead: () => void;
  openItem: (i: Item) => void;
  variant: string;
};
const FeedCtx = createContext<Ctx | null>(null);
const useFeed = () => useContext(FeedCtx)!;

const VARIANTS = [
  { key: "A", name: "Bell popover" },
  { key: "B", name: "Sidebar row + drawer" },
  { key: "C", name: "Docked rail" },
];

export function NotificationFeedProvider({
  role,
  isTeamAdmin,
  children,
}: {
  role: UserRole | null;
  isTeamAdmin: boolean;
  children: React.ReactNode;
}) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const variant = params.get("variant") ?? "A";
  const [items, setItems] = useState<Item[]>([]);
  const [open, setOpen] = useState(false);

  // reset fixtures whenever the DevUI switcher changes the user
  useEffect(() => {
    setItems(fixtures(role, isTeamAdmin));
  }, [role, isTeamAdmin]);
  // C is docked open by default; A/B start closed
  useEffect(() => setOpen(variant === "C"), [variant]);

  const now = () => new Date().toISOString();
  const value: Ctx = useMemo(
    () => ({
      items,
      variant,
      open,
      setOpen,
      unread: items.filter((i) => !i.read_at).length,
      unseen: items.filter((i) => !i.seen_at).length,
      markAllSeen: () =>
        setItems((xs) => xs.map((i) => ({ ...i, seen_at: i.seen_at ?? now() }))),
      markAllRead: () =>
        setItems((xs) =>
          xs.map((i) => ({ ...i, seen_at: i.seen_at ?? now(), read_at: i.read_at ?? now() }))
        ),
      openItem: (it) => {
        setItems((xs) =>
          xs.map((i) =>
            i.id === it.id ? { ...i, seen_at: i.seen_at ?? now(), read_at: i.read_at ?? now() } : i
          )
        );
        if (variant !== "C") setOpen(false);
        navigate(it.href);
      },
    }),
    [items, variant, open, navigate]
  );

  return <FeedCtx.Provider value={value}>{children}</FeedCtx.Provider>;
}

function Badge({ n, className }: { n: number; className?: string }) {
  if (n === 0) return null;
  return (
    <span
      className={cn(
        "inline-flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-4 text-white",
        className
      )}
    >
      {n > 9 ? "9+" : n}
    </span>
  );
}

function Row({ item, compact }: { item: Item; compact?: boolean }) {
  const { openItem } = useFeed();
  return (
    <button
      onClick={() => openItem(item)}
      className={cn(
        "flex w-full gap-3 px-4 text-left transition-colors hover:bg-accent",
        compact ? "py-2" : "py-3",
        !item.read_at && "bg-primary/5"
      )}
    >
      <span
        className={cn(
          "mt-1.5 size-2 shrink-0 rounded-full",
          item.read_at ? "bg-transparent" : "bg-blue-500"
        )}
      />
      <span className="min-w-0 flex-1">
        <span className={cn("block text-sm", !item.read_at && "font-medium")}>
          {item.actor && <strong>{item.actor} </strong>}
          {item.text}
        </span>
        {!compact && (
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {item.category} · {ago(item.minutesAgo)} ago
          </span>
        )}
      </span>
      {compact && (
        <span className="shrink-0 text-xs text-muted-foreground">{ago(item.minutesAgo)}</span>
      )}
    </button>
  );
}

function Empty() {
  return (
    <div className="px-4 py-10 text-center text-sm text-muted-foreground">
      You're all caught up.
    </div>
  );
}

// ───────── Variant A: bell + popover, in the sidebar header ─────────
export function NotificationHeaderSlot() {
  const f = useFeed();
  if (f.variant !== "A") return null;
  return (
    <div className="relative ml-auto">
      <button
        onClick={() => {
          if (!f.open) f.markAllSeen(); // opening the feed marks everything seen
          f.setOpen(!f.open);
        }}
        className="relative rounded-md p-1.5 text-sidebar-foreground/70 hover:bg-sidebar-accent"
        title="Notifications"
      >
        <Bell className="size-4" />
        <Badge n={f.unseen} className="absolute -right-1 -top-1" />
      </button>
      {f.open && (
        <div className="fixed left-3 top-14 z-50 w-96 overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-xl">
          <div className="flex items-center justify-between border-b px-4 py-2.5">
            <span className="text-sm font-semibold">Notifications</span>
            <button onClick={f.markAllRead} className="text-xs text-muted-foreground hover:text-foreground">
              Mark all as read
            </button>
          </div>
          <div className="max-h-96 divide-y overflow-y-auto">
            {f.items.length === 0 ? <Empty /> : f.items.map((i) => <Row key={i.id} item={i} />)}
          </div>
        </div>
      )}
    </div>
  );
}

// ───────── Variant B: nav row (unread pill) + right drawer ─────────
export function NotificationNavSlot() {
  const f = useFeed();
  if (f.variant !== "B") return null;
  return (
    <button
      onClick={() => f.setOpen(!f.open)}
      className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
    >
      <Bell className="size-4" />
      Notifications
      <Badge n={f.unread} className="ml-auto bg-primary text-primary-foreground" />
    </button>
  );
}

function Drawer() {
  const f = useFeed();
  const [tab, setTab] = useState<"all" | "unread">("all");
  const shown = f.items.filter((i) => tab === "all" || !i.read_at);
  const groups = ["Today", "Earlier"].map((g) => ({
    g,
    rows: shown.filter((i) => dayGroup(i.minutesAgo) === g),
  }));
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={() => f.setOpen(false)} />
      <aside className="fixed inset-y-0 right-0 z-50 flex w-[420px] flex-col border-l bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="font-semibold">Notifications</h2>
          <button onClick={() => f.setOpen(false)}><X className="size-4" /></button>
        </div>
        <div className="flex items-center gap-2 border-b px-4 py-2">
          {(["all", "unread"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium capitalize",
                tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
              )}
            >
              {t}
            </button>
          ))}
          <button onClick={f.markAllRead} className="ml-auto text-xs text-muted-foreground hover:text-foreground">
            Mark all read
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {shown.length === 0 && <Empty />}
          {groups.map(
            ({ g, rows }) =>
              rows.length > 0 && (
                <div key={g}>
                  <div className="sticky top-0 bg-muted px-4 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {g}
                  </div>
                  <div className="divide-y">{rows.map((i) => <Row key={i.id} item={i} />)}</div>
                </div>
              )
          )}
        </div>
      </aside>
    </>
  );
}

// ───────── Variant C: docked right rail with category chips ─────────
function Rail() {
  const f = useFeed();
  const [cat, setCat] = useState<Category | "All">("All");
  const cats = ["All", ...Array.from(new Set(f.items.map((i) => i.category)))] as (Category | "All")[];
  const shown = f.items.filter((i) => cat === "All" || i.category === cat);
  if (!f.open) {
    return (
      <button
        onClick={() => { f.setOpen(true); f.markAllSeen(); }}
        className="fixed right-3 top-3 z-40 flex items-center gap-1.5 rounded-md border bg-background px-2 py-1.5 text-xs shadow"
      >
        <PanelRightOpen className="size-4" /> Feed <Badge n={f.unseen} />
      </button>
    );
  }
  return (
    <aside className="flex h-screen w-80 shrink-0 flex-col border-l bg-card">
      <div className="flex h-14 items-center justify-between border-b px-4">
        <span className="font-semibold">Feed</span>
        <div className="flex items-center gap-3">
          <button onClick={f.markAllRead} className="text-xs text-muted-foreground hover:text-foreground">
            Read all
          </button>
          <button onClick={() => f.setOpen(false)} title="Collapse"><PanelRightClose className="size-4" /></button>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5 border-b px-4 py-2">
        {cats.map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={cn(
              "rounded-md border px-2 py-0.5 text-xs",
              cat === c ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
            )}
          >
            {c}
          </button>
        ))}
      </div>
      <div className="flex-1 divide-y overflow-y-auto">
        {shown.length === 0 ? <Empty /> : shown.map((i) => <Row key={i.id} item={i} compact />)}
      </div>
    </aside>
  );
}

export function NotificationOverlay() {
  const f = useFeed();
  if (f.variant === "B" && f.open) return <Drawer />;
  if (f.variant === "C") return <Rail />;
  return null;
}

// ───────── Floating variant switcher ─────────
export function PrototypeSwitcher() {
  const [params, setParams] = useSearchParams();
  const current = params.get("variant") ?? "A";
  const idx = Math.max(0, VARIANTS.findIndex((v) => v.key === current));
  const go = (d: number) => {
    const next = VARIANTS[(idx + d + VARIANTS.length) % VARIANTS.length].key;
    setParams((p) => { p.set("variant", next); return p; }, { replace: true });
  };
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input,textarea,[contenteditable]")) return;
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });
  if (process.env.NODE_ENV === "production") return null;
  return (
    <div className="fixed bottom-4 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-3 rounded-full bg-black px-4 py-2 text-sm text-white shadow-2xl">
      <button onClick={() => go(-1)}><ChevronLeft className="size-4" /></button>
      <span className="min-w-48 text-center">
        {VARIANTS[idx].key} ({VARIANTS[idx].name})
      </span>
      <button onClick={() => go(1)}><ChevronRight className="size-4" /></button>
    </div>
  );
}
