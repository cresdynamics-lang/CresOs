"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../auth-context";

type Project = {
  id: string;
  name: string;
  status: string;
  startDate?: string | null;
  endDate?: string | null;
};

export default function ProjectsPage() {
  const { apiFetch } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const res = await apiFetch("/projects");
        if (!res.ok) return;
        const data = (await res.json()) as any[];
        setProjects(
          data.map((p) => ({
            id: p.id,
            name: p.name,
            status: p.status,
            startDate: p.startDate,
            endDate: p.endDate
          }))
        );
      } catch {
        // ignore
      }
    }
    load();
  }, [apiFetch]);

  return (
    <section className="flex flex-col gap-4">
      <div className="shell">
        <h2 className="mb-2 text-lg font-semibold text-slate-50">Projects</h2>
        <p className="text-sm text-slate-300">
          Track projects, milestones, and tasks so delivery stays in lockstep
          with your pipeline.
        </p>
      </div>
      <div className="shell">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
          Active projects
        </p>
        <ul className="space-y-2 text-sm">
          {projects.map((project) => (
            <li
              key={project.id}
              className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2"
            >
              <div>
                <p className="text-slate-100">{project.name}</p>
                <p className="text-xs text-slate-400">
                  {project.startDate
                    ? `Started ${new Date(project.startDate).toLocaleDateString()}`
                    : "No start date"}
                </p>
              </div>
              <span className="text-xs text-sky-400 capitalize">
                {project.status}
              </span>
            </li>
          ))}
          {projects.length === 0 && (
            <li className="text-sm text-slate-400">No projects yet.</li>
          )}
        </ul>
      </div>
    </section>
  );
}

