// Placeholder / demo project data for the Convex-themed showcase on /projects
// and the individual /projects/[slug] detail pages. Real content comes later.

export interface ProjectFeature {
  title: string;
  detail: string;
}

export interface CodeFile {
  name: string;
  code: string;
}

export interface ShowcaseProject {
  slug: string;
  name: string;
  /** One-line description shown on the showcase card. */
  blurb: string;
  tags: string[];
  year: string;
  role: string;
  stack: string[];
  /** Placeholder body paragraphs for the detail page. */
  overview: string[];
  /** Short mono label rendered inside the thumbnail placeholder. */
  thumbLabel: string;
  /** Accordion rows on the detail page (one open at a time). */
  features: ProjectFeature[];
}

/** Placeholder persona for the individual project pages. */
export const projectPersona = {
  name: "Maya",
  links: {
    github: "https://github.com/maya",
    linkedin: "https://www.linkedin.com/in/maya",
    email: "mailto:maya@example.com",
  },
};

/** Demo code snippets for the detail page's editor panel — not real source. */
export function getProjectCode(project: ShowcaseProject): CodeFile[] {
  return [
    {
      name: `${project.slug}/sync.ts`,
      code: `import { defineModule, query, mutation } from "./_runtime";
import { schema } from "./schema";

// Demo snippet for ${project.name} — placeholder, not the real source.
export const state = query(schema, async (ctx) => {
  const rows = await ctx.table("events").take(50);
  return rows.map(summarise);
});

export const push = mutation(async (ctx, event) => {
  await ctx.table("events").insert({ ...event, at: Date.now() });
  ctx.publish("state");
});

function summarise(e) {
  return { id: e.id, label: e.label, ok: e.status === "ok" };
}`,
    },
    {
      name: `${project.slug}/schema.ts`,
      code: `import { table, string, number, boolean } from "./_runtime";

export const schema = {
  events: table({
    label: string(),
    status: string(),
    weight: number(),
    pinned: boolean(),
  }),
};`,
    },
  ];
}

export const showcaseProjects: ShowcaseProject[] = [
  {
    slug: "harbor-analytics",
    name: "Harbor Analytics",
    blurb:
      "A real-time operations dashboard that turns noisy event streams into a handful of numbers a team can actually act on.",
    tags: ["Product", "Dashboard", "Data viz"],
    year: "2024",
    role: "Design & front-end",
    stack: ["Next.js", "TypeScript", "WebSockets", "SQLite"],
    thumbLabel: "01 — Dashboard",
    overview: [
      "Harbor Analytics began as an internal tool for a logistics team that was tracking everything in spreadsheets and Slack messages. The goal was modest: one screen that answers \"is anything on fire right now?\" without a single chart that needs a legend to read.",
      "The interface is built from a small set of primitives — a metric tile, a sparkline, a status row — arranged on a strict grid. Colour is used sparingly and only ever means one thing. Everything else is type, spacing and hairline rules.",
      "Under the hood, events land over a socket, get folded into rolling windows in the browser, and are written to a local store so a refresh never shows an empty page. The whole thing is a single deploy target with no backend to babysit.",
    ],
    features: [
      {
        title: "Live by default",
        detail:
          "Every tile is wired straight to the event socket. Numbers move the moment the underlying data does, so there is no refresh button because there is nothing to refresh.",
      },
      {
        title: "One colour, one meaning",
        detail:
          "Colour is spent carefully. Green is healthy, amber is watch, red is act, and nothing on the screen is tinted for decoration.",
      },
      {
        title: "Survives a reload",
        detail:
          "State is mirrored to a local store, so reopening the tab paints the last known picture instantly while fresh data streams in behind it.",
      },
    ],
  },
  {
    slug: "ledger-mono",
    name: "Ledger Mono",
    blurb:
      "A keyboard-first personal finance ledger for people who would rather type than click through a bank's website.",
    tags: ["Tool", "Finance", "Offline-first"],
    year: "2023",
    role: "Solo — design & build",
    stack: ["React", "IndexedDB", "Web Workers"],
    thumbLabel: "02 — Ledger",
    overview: [
      "Ledger Mono is a plain-text-feeling ledger with a real data model behind it. You add a transaction the way you would write a line in a notebook, and the app takes care of double-entry bookkeeping quietly in the background.",
      "Every view is reachable from the keyboard, and the command palette is the primary way to move around. The mouse works, but it is never the fast path.",
      "All data stays on the device. Sync is opt-in and end-to-end, so the app is useful on a plane and still useful when you get home.",
    ],
    features: [
      {
        title: "Type, don't click",
        detail:
          "Every action has a keystroke and the command palette is the front door. The pointer works but it is never the quick path.",
      },
      {
        title: "Real books underneath",
        detail:
          "Entries feel like notebook lines but compile to proper double-entry records, so the totals are always defensible.",
      },
      {
        title: "Yours, on the device",
        detail:
          "Data lives locally first. Sync is opt-in, end-to-end, and the app stays fully usable with the network switched off.",
      },
    ],
  },
  {
    slug: "atlas-field-notes",
    name: "Atlas Field Notes",
    blurb:
      "A note-taking app for fieldwork: fast capture, generous offline support, and a map that stitches entries together by place.",
    tags: ["Mobile", "Maps", "Notes"],
    year: "2024",
    role: "Front-end & interaction",
    stack: ["Expo", "React Native", "SQLite", "MapLibre"],
    thumbLabel: "03 — Field notes",
    overview: [
      "Atlas Field Notes is designed for the first thirty seconds after something happens — a photo, a voice memo, a couple of tags, and back to whatever you were doing. Organising can wait until you are somewhere with a chair and a connection.",
      "Entries are pinned to where they were made, so the map becomes a second index into your notes. Zoom out and a trip is a shape; zoom in and it is a list.",
      "The sync layer is conflict-tolerant by design: two phones editing the same note offline will both keep their edits and merge sensibly when they meet again.",
    ],
    features: [
      {
        title: "Capture in seconds",
        detail:
          "A photo, a voice memo, a couple of tags, then back to what you were doing. Sorting can wait for a chair and a signal.",
      },
      {
        title: "Pinned to place",
        detail:
          "Every note remembers where it was made, so the map becomes a second index: zoom out for the shape of a trip, in for the list.",
      },
      {
        title: "Merges, doesn't clobber",
        detail:
          "Two phones editing the same note offline both keep their edits and reconcile sensibly the next time they meet.",
      },
    ],
  },
  {
    slug: "prism-design-tokens",
    name: "Prism",
    blurb:
      "A design-token pipeline that keeps a component library, the docs site, and three apps in visual agreement.",
    tags: ["Infra", "Design systems", "CLI"],
    year: "2022",
    role: "Systems & tooling",
    stack: ["Node.js", "Style Dictionary", "GitHub Actions"],
    thumbLabel: "04 — Tokens",
    overview: [
      "Prism is the boring layer that makes a design system trustworthy: one source of truth for colour, type and spacing, compiled out to every platform that needs it, checked on every pull request.",
      "Designers edit tokens in one file. A CLI turns that file into CSS variables, a Swift enum, and a JSON payload, and a bot opens the PRs. Nobody hand-copies a hex value.",
      "The interesting part was the diffing: a visual report on every change that shows exactly which components shift, so a one-line token edit never ships a surprise.",
    ],
    features: [
      {
        title: "One source of truth",
        detail:
          "Colour, type and spacing live in a single file. A CLI compiles them to CSS, Swift and JSON, so nobody hand-copies a hex value.",
      },
      {
        title: "Checked on every PR",
        detail:
          "A bot opens the downstream changes and a visual diff shows exactly which components shift before anything merges.",
      },
      {
        title: "Boring on purpose",
        detail:
          "The pipeline has no opinions and no surprises. Its whole job is to make the interesting layer above it trustworthy.",
      },
    ],
  },
];

export function getShowcaseProject(slug: string): ShowcaseProject | undefined {
  return showcaseProjects.find(project => project.slug === slug);
}
