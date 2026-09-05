import Link from "next/link";
import { getProjectCode, projectPersona, type ShowcaseProject } from "@/data/showcaseProjects";
import CodePanel from "./CodePanel";
import ProjectAccordion from "./ProjectAccordion";

function BackIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9.5 3.5 5 8l4.5 4.5" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M8 0C3.58 0 0 3.58 0 8a8 8 0 0 0 5.47 7.59c.4.07.55-.17.55-.38l-.01-1.49c-2.01.37-2.53-.49-2.7-.94-.28-.72-.68-.91-.68-.91-.55-.38.04-.37.04-.37.61.04.94.63.94.63.54.93 1.42.66 1.77.5.05-.4.21-.66.38-.81-1.6-.18-3.29-.8-3.29-3.56 0-.79.28-1.43.74-1.94-.07-.18-.32-.91.07-1.9 0 0 .61-.2 2 .74a6.9 6.9 0 0 1 3.64 0c1.39-.94 2-.74 2-.74.39.99.14 1.72.07 1.9.46.51.74 1.15.74 1.94 0 2.77-1.69 3.38-3.3 3.56.22.19.41.55.41 1.11l-.01 1.65c0 .21.15.46.55.38A8 8 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M3.4 2A1.4 1.4 0 1 0 3.4 4.8 1.4 1.4 0 0 0 3.4 2ZM2.2 5.9h2.4V14H2.2V5.9Zm4 0h2.3v1.1h.03c.32-.6 1.1-1.24 2.27-1.24 2.43 0 2.88 1.6 2.88 3.68V14h-2.4v-3.5c0-.84-.02-1.92-1.17-1.92-1.17 0-1.35.91-1.35 1.86V14h-2.4V5.9Z" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
      <rect x="1.5" y="3" width="13" height="10" rx="1.5" />
      <path d="m2 4 6 4.5L14 4" />
    </svg>
  );
}

// Fully custom full-screen layout for /projects/[slug], modelled on the Convex
// reference. No site nav, footer or theme switcher (see SiteChrome).
export default function ProjectDetail({ project }: { project: ShowcaseProject }) {
  const code = getProjectCode(project);

  return (
    <div className="project-detail">
      <header className="pd-topbar">
        <Link href="/projects#project-showcase" className="pd-pill pd-back">
          <BackIcon />
          Back to projects
        </Link>
        <nav className="pd-actions">
          <a className="pd-pill" href={projectPersona.links.github} target="_blank" rel="noreferrer noopener">
            <GitHubIcon />
            GitHub
          </a>
          <a className="pd-pill" href={projectPersona.links.linkedin} target="_blank" rel="noreferrer noopener">
            <LinkedInIcon />
            LinkedIn
          </a>
          <a className="pd-pill" href={projectPersona.links.email}>
            <MailIcon />
            Email
          </a>
        </nav>
      </header>

      <main className="pd-main">
        <div>
          <h1 className="pd-title">{project.name}</h1>
          <p className="pd-desc">{project.blurb}</p>
          <ProjectAccordion items={project.features} />
        </div>

        <div>
          <CodePanel files={code} />
        </div>
      </main>
    </div>
  );
}
