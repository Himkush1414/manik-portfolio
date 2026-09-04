"use client";

import { Reveal } from "@/components/ui/Reveal";
import { projects } from "@/data/content";
import { morningBodyFont, morningHeadingFont } from "./fonts";

export default function MorningProjects() {
  return (
    <section id="projects" className="flex flex-col gap-10">
      <Reveal>
        <h2 className={`${morningHeadingFont.className} text-3xl font-semibold text-[#2E2A45] sm:text-4xl`}>
          Projects
        </h2>
      </Reveal>
      <div className="grid gap-6 sm:grid-cols-2">
        {projects.map((project, index) => (
          <Reveal key={project.title} delay={index * 100}>
            <a
              href={project.href ?? project.repo ?? "#"}
              target={project.href || project.repo ? "_blank" : undefined}
              rel="noopener noreferrer"
              className="group flex h-full flex-col gap-3 rounded-3xl border border-white/50 bg-white/40 p-6 shadow-[0_8px_30px_rgba(255,159,104,0.12)] backdrop-blur-xl transition-transform hover:-translate-y-1"
            >
              <h3 className={`${morningHeadingFont.className} text-xl font-semibold text-[#2E2A45]`}>
                {project.title}
              </h3>
              <p className={`${morningBodyFont.className} text-sm text-[#2E2A45]/75`}>{project.description}</p>
              <div className="mt-auto flex flex-wrap gap-2 pt-2">
                {project.tags.map(tag => (
                  <span
                    key={tag}
                    className="rounded-full bg-[#FF7A59]/15 px-3 py-1 text-xs font-medium text-[#C1502E]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </a>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
