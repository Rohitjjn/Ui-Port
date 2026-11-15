import { Button, IconButton } from "@/components/common";
import { tracksByIds } from "@/services/mockMusicService";
import { useLibraryStore } from "@/store/libraryStore";
import { usePlayerStore } from "@/store/playerStore";
import { useUiStore } from "@/store/uiStore";
import { AnimatePresence, motion } from "framer-motion";
import { Download, Heart, ListPlus, ListStart, X } from "lucide-react";

/**
 * Multi-select action bar — mirrors selection/SongSelectionTopAppBar.kt + SelectedSongsBottomSheet.kt
 * (n selected · select all · favorite · add to playlist · download · play next · exit selection).
 * Screens register the visible track ids via `window.__selectableIds` (set in TrackList containers).
 */
export function SelectionBar() {
  const selection = useUiStore((s) => s.selection);
  const exit = useUiStore((s) => s.exitSelection);
  const selectAll = useUiStore((s) => s.selectAll);
  const openSheet = useUiStore((s) => s.openSheet);
  const toast = useUiStore((s) => s.toast);
  const lib = useLibraryStore();
  const playNext = usePlayerStore((s) => s.playNext);
  if (!selection) return null;
  const tracks = tracksByIds(selection);
  const n = selection.length;
  const allLiked = n > 0 && selection.every((id) => lib.favorites.includes(id));
  return (
    <AnimatePresence>
      <motion.div initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }} className="fixed inset-x-0 top-0 z-[58] mx-auto flex max-w-3xl items-center gap-2 bg-ink px-3 py-2 text-paper shadow-lift sm:top-3 sm:rounded-full">
        <IconButton size="sm" aria-label="Exit selection" onClick={exit} className="text-paper hover:bg-paper/10"><X size={18} /></IconButton>
        <span className="shrink-0 whitespace-nowrap text-[14px] font-medium tabular">{n} selected</span>
        <span className="flex-1" />
        <Button size="sm" variant="soft" className="bg-paper/15 px-3 text-paper hover:bg-paper/25" onClick={() => selectAll(((window as unknown as { __selectableIds?: string[] }).__selectableIds) ?? selection)}><span className="hidden sm:inline">Select all</span><span className="sm:hidden">All</span></Button>
        <IconButton size="sm" aria-label={allLiked ? "Unfavorite" : "Favorite"} disabled={!n} onClick={() => { selection.forEach((id) => { if (lib.favorites.includes(id) === allLiked) lib.toggleFavorite(id); }); toast(allLiked ? `Removed ${n} from Liked songs` : `Added ${n} to Liked songs`); exit(); }} className="text-paper hover:bg-paper/10"><Heart size={18} fill={allLiked ? "currentColor" : "none"} /></IconButton>
        <IconButton size="sm" aria-label="Add to playlist" disabled={!n} onClick={() => { openSheet({ kind: "addToPlaylist", tracks }); exit(); }} className="text-paper hover:bg-paper/10"><ListPlus size={18} /></IconButton>
        <IconButton size="sm" aria-label="Download" disabled={!n} onClick={() => { lib.download(selection); toast(`Downloading ${n} songs (simulated)`); exit(); }} className="text-paper hover:bg-paper/10"><Download size={18} /></IconButton>
        <IconButton size="sm" aria-label="Play next" disabled={!n} onClick={() => { tracks.slice().reverse().forEach(playNext); toast(`${n} songs will play next`); exit(); }} className="text-paper hover:bg-paper/10"><ListStart size={18} /></IconButton>
      </motion.div>
    </AnimatePresence>
  );
}

/** Helper for screens: register the full list of selectable ids for "Select all". */
export function registerSelectable(ids: string[]) {
  (window as unknown as { __selectableIds?: string[] }).__selectableIds = ids;
}
