"use client";
import { ExternalLink } from "lucide-react";

/**
 * The two pages a publish made: Vercel's deployment and GitHub's commit.
 * Both open in a new tab. Shown in the top bar after Update live site and
 * on the site's card on Builds, from what the publish returned.
 */
export function PublishLinks({ deployment, commit, className }: { deployment?: string | null; commit?: string | null; className?: string }) {
  if (!deployment && !commit) return null;
  const link = "inline-flex shrink-0 items-center gap-0.5 text-small text-fg-muted underline-offset-2 hover:text-fg hover:underline";
  return (
    <span data-publish-links="" className={`flex shrink-0 items-center gap-2 ${className ?? ""}`}>
      {deployment ? (
        <a data-publish-deployment="" href={deployment} target="_blank" rel="noopener noreferrer" className={link} title="Vercel's page for this deployment, in a new tab">
          Vercel deployment <ExternalLink className="size-2.5" />
        </a>
      ) : null}
      {commit ? (
        <a data-publish-commit="" href={commit} target="_blank" rel="noopener noreferrer" className={link} title="The commit this publish made on GitHub, in a new tab">
          GitHub commit <ExternalLink className="size-2.5" />
        </a>
      ) : null}
    </span>
  );
}
