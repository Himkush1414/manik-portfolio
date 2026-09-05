"use client";

import { useState } from "react";
import type { ProjectFeature } from "@/data/showcaseProjects";

// Expand/collapse list — only one row open at a time, matching the reference.
export default function ProjectAccordion({ items }: { items: ProjectFeature[] }) {
  const [open, setOpen] = useState(0);

  return (
    <div className="pd-accordion">
      {items.map((item, i) => {
        const isOpen = open === i;
        return (
          <div key={item.title} className="pd-acc-item" data-open={isOpen}>
            <h3>
              <button
                type="button"
                className="pd-acc-trigger"
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? -1 : i)}
              >
                {item.title}
                <span aria-hidden className="pd-acc-sign" />
              </button>
            </h3>
            <div className="pd-acc-panel" role="region">
              <div>
                <p className="pd-acc-body">
                  {item.detail}
                  <span className="pd-acc-index">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
