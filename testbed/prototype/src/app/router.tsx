import { createHashRouter, Navigate } from "react-router-dom";
import { AppShell } from "./AppShell";
import { HomeScreen } from "@/features/home/HomeScreen";
import { SearchScreen } from "@/features/search/SearchScreen";
import { LibraryScreen } from "@/features/library/LibraryScreen";
import { DynamicPlaylistScreen } from "@/features/library/DynamicPlaylistScreen";
import { PlaylistScreen } from "@/features/playlists/PlaylistScreen";
import { AlbumScreen } from "@/features/albums/AlbumScreen";
import { ArtistScreen, MoreAlbumsScreen } from "@/features/artists/ArtistScreen";
import { BrowseScreen, ChartsScreen, MixForYouScreen, MoodScreen, MoodsScreen, NotificationScreen, PodcastScreen } from "@/features/explore/ExploreScreens";
import { AccountScreen, AppLogScreen, CreditsScreen, EqualizerScreen, SettingsScreen } from "@/features/settings/SettingsScreen";
import { AnalyticsScreen, WrappedScreen } from "@/features/analytics/AnalyticsScreens";
import { Empty, Button } from "@/components/common";

function NotFound() {
  return <Empty title="Page not found" body="This paper got lost in the post." action={<Button onClick={() => (window.location.hash = "#/")}>Go home</Button>} />;
}

export const router = createHashRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <HomeScreen /> },
      { path: "search", element: <SearchScreen /> },
      { path: "library", element: <LibraryScreen /> },
      { path: "library/:type", element: <DynamicPlaylistScreen /> },
      { path: "playlist/:id", element: <PlaylistScreen /> },
      { path: "album/:id", element: <AlbumScreen /> },
      { path: "artist/:id", element: <ArtistScreen /> },
      { path: "artist/:id/albums", element: <MoreAlbumsScreen /> },
      { path: "podcast/:id", element: <PodcastScreen /> },
      { path: "moods", element: <MoodsScreen /> },
      { path: "mood/:id", element: <MoodScreen /> },
      { path: "charts", element: <ChartsScreen /> },
      { path: "browse/:id", element: <BrowseScreen /> },
      { path: "mix", element: <MixForYouScreen /> },
      { path: "notifications", element: <NotificationScreen /> },
      { path: "analytics", element: <AnalyticsScreen /> },
      { path: "wrapped", element: <WrappedScreen /> },
      { path: "settings", element: <SettingsScreen /> },
      { path: "settings/equalizer", element: <EqualizerScreen /> },
      { path: "settings/credits", element: <CreditsScreen /> },
      { path: "settings/log", element: <AppLogScreen /> },
      { path: "account", element: <AccountScreen /> },
      { path: "home", element: <Navigate to="/" replace /> },
      { path: "*", element: <NotFound /> },
    ],
  },
]);
