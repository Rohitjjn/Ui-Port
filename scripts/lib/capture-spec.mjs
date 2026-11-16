/**
 * Screen-spec normalization for the capture step.
 *
 * A spec answers: which routes to capture, in which states, at which viewports,
 * with which regions masked. Keeping it as data (and validating it) means the
 * capture script, the port loop and the diff step all agree on the same list
 * without re-deriving it from the prototype each time.
 */
export const STATES = ["default", "empty", "loading", "error", "overlay", "focus", "tabbed", "player"];

export function deviceTargetsFromConfig(viewports, requested) {
  const all = Object.keys(viewports?.targets ?? {});
  if (!requested || requested === "all") return all;
  const list = Array.isArray(requested) ? requested : String(requested).split(",").map((s) => s.trim());
  const unknown = list.filter((d) => !all.includes(d));
  if (unknown.length) {
    throw new Error(`unknown device target(s): ${unknown.join(", ")}. Known: ${all.join(", ")}`);
  }
  return list;
}

/**
 * Build the capture plan from a prototype scan.
 * @param {{screens: Array, routes?: Array}} scan result of scanPrototype()
 * @param {object} options {devices: string[], states: string[], screens?: string[], extra?: object}
 */
export function buildCapturePlan(scan, options = {}) {
  const devices = options.devices ?? ["phone"];
  const wantedStates = options.states ?? ["default"];
  const screenFilter = options.screens ? new Set(options.screens) : null;
  const plan = [];
  for (const screen of scan.screens ?? []) {
    if (screenFilter && !screenFilter.has(screen.id)) continue;
    if (screen.isShell) continue;
    if (screen.route === "*") continue;
    // Only capture states that the prototype can actually show.
    const available = new Set(screen.states ?? ["default"]);
    const states = wantedStates.filter((s) => s === "default" || available.has(s));
    for (const device of devices) {
      plan.push({
        id: screen.id,
        route: screen.route,
        device,
        states: states.length ? states : ["default"],
        masks: masksFor(screen, device),
        notes: screen.hasParams ? `route has parameters: the capture uses the fixture values from the prototype's own mock data` : undefined,
      });
    }
  }
  return plan;
}

export function normalizeRoute(route) {
  if (!route) return "/";
  if (route === "*") return null;
  if (route.startsWith("#")) return route;
  return route.startsWith("/") ? route : `/${route}`;
}

export function hashUrl(baseUrl, route) {
  const base = baseUrl.replace(/\/+$/, "");
  const r = normalizeRoute(route) ?? "/";
  return `${base}/#${r}`;
}

/** Regions that must never count as differences for a given device. */
export function masksFor(screen, device) {
  const masks = [];
  if (device === "desktop") masks.push({ preset: "scrollbar", edge: "right", width: 15 });
  return masks;
}

/** Merge mask rectangles declared per screen in a spec file with the defaults. */
export function mergeMasks(base = [], extra = []) {
  const out = [];
  for (const m of [...base, ...extra]) {
    if (!m) continue;
    if (m.preset === "system-bars") continue; // handled by excluding bars entirely
    out.push(m);
  }
  return out;
}

export function validateSpec(spec) {
  const errors = [];
  if (!spec || typeof spec !== "object") return { ok: false, errors: ["spec must be an object"] };
  if (!Array.isArray(spec.captures)) errors.push("spec.captures must be an array");
  else {
    for (const [i, c] of spec.captures.entries()) {
      if (!c.id) errors.push(`captures[${i}].id is required`);
      if (!c.route) errors.push(`captures[${i}].route is required`);
      if (!c.device) errors.push(`captures[${i}].device is required`);
      if (c.states && !Array.isArray(c.states)) errors.push(`captures[${i}].states must be an array`);
      for (const s of c.states ?? []) if (!STATES.includes(s)) errors.push(`captures[${i}].states has unknown state "${s}"`);
    }
  }
  return { ok: errors.length === 0, errors };
}

/** Output path for one screenshot, matching the documented artifacts layout. */
export function capturePath(uiportRoot, device, screenId, state) {
  return `${uiportRoot}/reference/${device}/${screenId}/${state}.png`;
}

/**
 * Fixture ids the prototype itself ships, read from its mock-data file.
 *
 * A route like `playlist/:id` is not capturable as written — navigating to it shows the
 * prototype's own empty state, which is not the screen anyone wants ported. The ids are
 * already in the prototype's source, so they are read from there instead of being typed
 * into a spec by hand (which would also make the reference depend on a human's memory).
 */
export function extractFixtureIds(mockDataText) {
  const ids = { playlist: null, album: null, artist: null, track: null, podcast: null, mood: null };
  const buckets = [
    ["playlist", /REMOTE_PLAYLISTS[^=]*=\s*\[([\s\S]*?)\n\];/],
    ["album", /ALBUMS[^=]*=\s*\[([\s\S]*?)\n\];/],
    ["artist", /ARTISTS[^=]*=\s*\[([\s\S]*?)\n\];/],
    ["track", /TRACKS[^=]*=\s*\[([\s\S]*?)\n\];/],
    ["podcast", /PODCASTS[^=]*=\s*\[([\s\S]*?)\n\];/],
    ["mood", /MOODS[^=]*=\s*\[([\s\S]*?)\n\];/],
  ];
  for (const [key, re] of buckets) {
    const block = mockDataText.match(re)?.[1];
    if (!block) continue;
    const first = block.match(/\{\s*id:\s*"([^"]+)"/);
    if (first) ids[key] = first[1];
  }
  return ids;
}

const PARAM_ALIASES = {
  id: null, // resolved by the route segment that precedes it
  playlistId: "playlist",
  albumId: "album",
  artistId: "artist",
  trackId: "track",
  podcastId: "podcast",
  moodId: "mood",
  type: "library",
};

/**
 * Fill `:params` with real fixture values.
 * @returns {{resolved: string|null, unresolved: string[]}}
 */
export function resolveRouteParams(route, fixtureIds = {}, overrides = {}) {
  if (!route || !route.includes(":")) return { resolved: route, unresolved: [] };
  const segments = route.split("/");
  const unresolved = [];
  const resolved = segments.map((seg, i) => {
    if (!seg.startsWith(":")) return seg;
    const name = seg.slice(1);
    if (overrides[name]) return overrides[name];
    // `playlist/:id` -> the bucket named by the previous segment.
    const parent = segments[i - 1]?.replace(/s$/, "");
    const bucket = PARAM_ALIASES[name] ?? (parent && fixtureIds[parent] !== undefined ? parent : null);
    const value = bucket ? fixtureIds[bucket] : null;
    if (!value) {
      unresolved.push(name);
      return seg;
    }
    return value;
  });
  return { resolved: unresolved.length ? null : resolved.join("/"), unresolved };
}
