export interface Project {
  title: string;
  description: string;
  tags: string[];
  href?: string;
  repo?: string;
}

export interface NavLink {
  label: string;
  href: string;
}

export const profile = {
  name: "Manik",
  fullName: "Manik Rana",
  role: "Software Engineer",
  tagline:
    "I design and build thoughtful, well-crafted software — from idea to production.",
  about:
    "I'm a software engineer who enjoys turning ideas into polished, functional products. I care about clean structure, good design, and building things that feel good to use — this site itself adapts its look to the time of day, just to prove the point.",
  email: "manikrana831@gmail.com",
  socials: {
    github: "https://github.com/Himkush1414",
  },
};

export const navLinks: NavLink[] = [
  { label: "Home", href: "/" },
  { label: "Projects", href: "/projects" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
];

export const projects: Project[] = [
  {
    title: "Time-Zone Adaptive Portfolio",
    description:
      "This very site — a portfolio that shifts its entire visual identity across four time-of-day themes while keeping the content constant.",
    tags: ["Next.js", "TypeScript", "Tailwind CSS", "WebGL"],
    repo: "https://github.com/Himkush1414/manik-portfolio",
  },
  {
    title: "Project Two",
    description: "A short description of a second project goes here.",
    tags: ["React", "Node.js"],
  },
  {
    title: "Project Three",
    description: "A short description of a third project goes here.",
    tags: ["Supabase", "PostgreSQL"],
  },
];
