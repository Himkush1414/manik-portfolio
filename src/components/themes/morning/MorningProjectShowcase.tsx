import Link from "next/link";
import { Reveal } from "@/components/ui/Reveal";
import { showcaseProjects } from "@/data/showcaseProjects";

// Project-showcase section. Sits on the single page black (#000) shared with
// the NIGHTMARE and Ciridae sections — `.convex-system` supplies only the
// GT America typography and the glass-card / rectangular-button treatment.
export default function MorningProjectShowcase() {
  return (
    <section className="convex-system w-full">
      <div className="mx-auto w-full max-w-[1400px] px-[24px] py-[80px] sm:px-[36px] sm:py-[128px]">
        <Reveal>
          <header className="flex flex-col gap-[12px]">
            <p className="cvx-caption">[ Selected work · 004 ]</p>
            <h2 className="cvx-heading-lg max-w-[16ch]">Project showcase</h2>
            <p className="cvx-body-lg max-w-[52ch]">
              A demo layout for the case-study grid — placeholder projects for now, so the
              structure and navigation can be checked end to end.
            </p>
          </header>
        </Reveal>

        {/* four long glass cards in a single row on desktop */}
        <div className="mt-[48px] grid grid-cols-1 gap-[16px] min-[640px]:grid-cols-2 xl:grid-cols-4">
          {showcaseProjects.map((project, index) => (
            <Reveal key={project.slug} delay={index * 80} className="h-full">
              <article className="cvx-card h-full">
                <div className="cvx-thumb">{project.thumbLabel.split("—")[0].trim()}</div>
                <div className="cvx-card__body">
                  <h3 className="cvx-card__title">{project.name}</h3>
                  <p className="cvx-body line-clamp-2 text-[12px]">{project.blurb}</p>
                  <p className="cvx-card__meta">{project.tags.join(" · ")}</p>
                  <Link href={`/projects/${project.slug}`} className="cvx-btn">
                    View Full Project
                    <span aria-hidden className="cvx-btn__arrow">
                      →
                    </span>
                  </Link>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
