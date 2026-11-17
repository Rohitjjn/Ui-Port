import { Button, Empty, Loading } from "@/components/common";
import { useSettingsStore } from "@/store/settingsStore";
import { useUiStore } from "@/store/uiStore";
import type { Track } from "@/types";
import { cn } from "@/utils/cn";
import { CornerDownRight, Heart, Send, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

interface Comment {
  id: string;
  author: string;
  text: string;
  time: string;
  likes: number;
  liked?: boolean;
  replies: Comment[];
}

const NAMES = ["paperbird", "lena.k", "quietroom", "tapehiss", "m.okada", "olive_and_ink", "nightferry", "r.marlowe"];
const TEXTS = [
  "The pedal steel in the second verse is unreal.",
  "Been listening to this every morning for a month now.",
  "That drum fill at 2:14 — chef's kiss.",
  "Reminds me of long train rides in winter.",
  "Who's here from the Paper Mornings playlist?",
  "The lyrics hit different after a breakup.",
  "Saw this live last year, even better in person.",
  "Volume up, lights off. That's the way.",
];

function seedComments(track: Track): Comment[] {
  const n = 4 + (track.duration % 4);
  return Array.from({ length: n }, (_, i) => {
    const k = (track.palette * 3 + i) % NAMES.length;
    return {
      id: `${track.id}-c${i}`,
      author: NAMES[k],
      text: TEXTS[(k + i) % TEXTS.length],
      time: `${1 + ((i * 7) % 11)} ${i % 2 ? "days" : "hours"} ago`,
      likes: 3 + ((track.duration * (i + 1)) % 340),
      replies: i % 3 === 0 ? [{ id: `${track.id}-c${i}-r`, author: NAMES[(k + 2) % NAMES.length], text: "Same here!", time: "1 hour ago", likes: 2, replies: [] }] : [],
    };
  });
}

function CommentRow({ c, onLike, onReply, depth = 0 }: { c: Comment; onLike: (id: string) => void; onReply: (c: Comment) => void; depth?: number }) {
  return (
    <div className={cn("py-3", depth && "ml-10 border-l border-line pl-3")}>
      <div className="flex items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sage/20 font-serif text-[14px] text-sage">{c.author[0].toUpperCase()}</span>
        <div className="min-w-0 flex-1">
          <div className="text-[12px] text-mute">@{c.author} · {c.time}</div>
          <p className="mt-0.5 text-[14px] leading-snug">{c.text}</p>
          <div className="mt-1.5 flex items-center gap-4 text-[12px] text-mute">
            <button type="button" onClick={() => onLike(c.id)} className={cn("flex items-center gap-1", c.liked && "text-rose")}><Heart size={14} fill={c.liked ? "currentColor" : "none"} /> {c.likes}</button>
            {depth === 0 && <button type="button" onClick={() => onReply(c)} className="flex items-center gap-1 hover:text-ink"><CornerDownRight size={14} /> Reply</button>}
          </div>
        </div>
      </div>
      {c.replies.map((r) => <CommentRow key={r.id} c={r} onLike={onLike} onReply={onReply} depth={1} />)}
    </div>
  );
}

export function CommentsSheet({ track }: { track: Track }) {
  const signedIn = useSettingsStore((s) => !!s.accounts.youtube);
  const close = useUiStore((s) => s.closeSheet);
  const toast = useUiStore((s) => s.toast);
  const nav = useNavigate();
  const [state, setState] = useState<"loading" | "error" | "off" | "ok">("loading");
  const [comments, setComments] = useState<Comment[]>([]);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<Comment | null>(null);

  useEffect(() => {
    setState("loading");
    const t = setTimeout(() => {
      if (track.id === "t24") setState("off"); // comments turned off on one track
      else { setComments(seedComments(track)); setState("ok"); }
    }, 600);
    return () => clearTimeout(t);
  }, [track.id]);

  const like = (id: string) => {
    const walk = (list: Comment[]): Comment[] => list.map((c) => (c.id === id ? { ...c, liked: !c.liked, likes: c.likes + (c.liked ? -1 : 1) } : { ...c, replies: walk(c.replies) }));
    setComments((c) => walk(c));
  };
  const submit = () => {
    if (!draft.trim()) return;
    const mine: Comment = { id: `me-${Date.now()}`, author: "you", text: draft.trim(), time: "just now", likes: 0, replies: [] };
    if (replyTo) setComments((c) => c.map((x) => (x.id === replyTo.id ? { ...x, replies: [...x.replies, mine] } : x)));
    else setComments((c) => [mine, ...c]);
    setDraft(""); setReplyTo(null);
    toast("Comment posted (simulated)");
  };

  return (
    <div className="flex max-h-[70dvh] flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        {state === "loading" && <Loading label="Loading comments" />}
        {state === "error" && <Empty title="Couldn't load comments" action={<Button size="sm" onClick={() => setState("loading")}>Retry</Button>} />}
        {state === "off" && <Empty title="Comments are turned off" body="The uploader has disabled comments for this video." />}
        {state === "ok" && <div className="divide-y divide-line">{comments.map((c) => <CommentRow key={c.id} c={c} onLike={like} onReply={setReplyTo} />)}</div>}
      </div>
      <div className="border-t border-line pt-3">
        {signedIn ? (
          <>
            {replyTo && <div className="mb-1 flex items-center gap-2 text-[12px] text-mute">Replying to @{replyTo.author}<button type="button" aria-label="Cancel reply" onClick={() => setReplyTo(null)}><X size={12} /></button></div>}
            <div className="flex items-center gap-2">
              <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} placeholder="Add a comment…" className="h-11 flex-1 rounded-full bg-ivory px-4 text-[14px] outline-none ring-sage focus:ring-2" />
              <button type="button" aria-label="Send" disabled={!draft.trim()} onClick={submit} className="flex h-11 w-11 items-center justify-center rounded-full bg-ink text-paper disabled:opacity-40"><Send size={16} /></button>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-between gap-3 rounded-md bg-ivory p-3">
            <p className="text-[13px] text-charcoal">Log in to YouTube to like and post comments.</p>
            <Button size="sm" onClick={() => { close(); nav("/account"); }}>Log in</Button>
          </div>
        )}
      </div>
    </div>
  );
}
