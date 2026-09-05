import Link from "next/link";
import { Reveal } from "@/components/ui/Reveal";
import { showcaseProjects } from "@/data/showcaseProjects";

// Project-showcase section, styled with the scoped Convex design system
// (`.convex-system` in globals.css). Sits between the Ciridae section's
// "Explore the system" button and the site footer.
export default function MorningProjectShowcase() {
  return (
    <section className="convex-system w-full">
      <div className="mx-auto w-full max-w-[1200px] px-[24px] py-[80px] sm:px-[36px] sm:py-[128px]">
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

        <div className="mt-[48px] grid gap-x-[24px] gap-y-[36px] sm:grid-cols-2">
          {showcaseProjects.map((project, index) => (
            <Reveal key={project.slug} delay={index * 80}>
              <div className="flex flex-col gap-[16px]">
                <article className="cvx-card">
                  <div className="cvx-thumb">{project.thumbLabel}</div>
                  <h3 className="cvx-heading">{project.name}</h3>
                  <p className="cvx-body">{project.blurb}</p>
                  <div className="flex flex-wrap gap-[8px]">
                    {project.tags.map(tag => (
                      <span key={tag} className="cvx-tag">
                        {tag}
                      </span>
                    ))}
                  </div>
                </article>

                <Link href={`/projects/${project.slug}`} className="cvx-btn w-fit">
                  View Full Project
                  <span aria-hidden className="cvx-btn__arrow">
                    →
                  </span>
                </Link>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
