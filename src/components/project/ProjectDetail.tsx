import Link from "next/link";
import { Reveal } from "@/components/ui/Reveal";
import MorningNav from "@/components/themes/morning/MorningNav";
import type { ShowcaseProject } from "@/data/showcaseProjects";

// Page-level look for every individual project page: the shared fixed nav on
// top, everything else in the scoped Convex design system (`.convex-system`).
export default function ProjectDetail({ project }: { project: ShowcaseProject }) {
  return (
    <div className="convex-system min-h-screen w-full">
      <MorningNav />

      <main className="mx-auto w-full max-w-[1200px] px-[24px] pb-[80px] pt-[128px] sm:px-[36px] sm:pt-[160px]">
        <Reveal>
          <div className="flex flex-col gap-[16px]">
            <p className="cvx-caption">{project.tags.join("  ·  ")}</p>
            <h1 className="cvx-display max-w-[14ch]">{project.name}</h1>
            <p className="cvx-body-lg max-w-[56ch]">{project.blurb}</p>
          </div>
        </Reveal>

        <Reveal delay={80}>
          <dl className="mt-[36px] grid gap-[24px] border-t border-[var(--color-mist-divider)] pt-[24px] sm:grid-cols-3">
            <div className="flex flex-col gap-[6px]">
              <dt className="cvx-caption">Year</dt>
              <dd className="cvx-body">{project.year}</dd>
            </div>
            <div className="flex flex-col gap-[6px]">
              <dt className="cvx-caption">Role</dt>
              <dd className="cvx-body">{project.role}</dd>
            </div>
            <div className="flex flex-col gap-[6px]">
              <dt className="cvx-caption">Stack</dt>
              <dd className="cvx-body">{project.stack.join(", ")}</dd>
            </div>
          </dl>
        </Reveal>

        <Reveal delay={120}>
          <div className="cvx-thumb cvx-thumb--hero mt-[36px]">Hero image placeholder</div>
        </Reveal>

        <Reveal delay={80}>
          <div className="mt-[48px] flex max-w-[64ch] flex-col gap-[20px]">
            <h2 className="cvx-subheading">Overview</h2>
            {project.overview.map((paragraph, i) => (
              <p key={i} className="cvx-body-lg">
                {paragraph}
              </p>
            ))}
          </div>
        </Reveal>

        <Reveal delay={80}>
          <div className="mt-[48px] grid gap-[24px] sm:grid-cols-2">
            <div className="cvx-thumb">Detail image A</div>
            <div className="cvx-thumb">Detail image B</div>
          </div>
        </Reveal>

        <hr className="cvx-divider mt-[48px]" />

        <div className="mt-[32px]">
          <Link href="/projects" className="cvx-btn cvx-btn--ghost w-fit">
            <span aria-hidden className="cvx-btn__arrow inline-block rotate-180">
              →
            </span>
            Back to projects
          </Link>
        </div>
      </main>
    </div>
  );
}
