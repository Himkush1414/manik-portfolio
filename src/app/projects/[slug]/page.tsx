import { notFound } from "next/navigation";
import ProjectDetail from "@/components/project/ProjectDetail";
import { getShowcaseProject, showcaseProjects } from "@/data/showcaseProjects";

export function generateStaticParams() {
  return showcaseProjects.map(project => ({ slug: project.slug }));
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const project = getShowcaseProject(slug);
  if (!project) notFound();

  return <ProjectDetail project={project} />;
}
