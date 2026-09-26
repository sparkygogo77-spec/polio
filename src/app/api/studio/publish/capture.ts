/*
 * POLIO NEVER WRITES TO A CAPTURE REPOSITORY, AND NEVER CONNECTS ONE. THE
 * OWNER'S RULING, in the one place both Publish and Go live read it.
 *
 * A capture repository holds the capturer's code and the capture of the site
 * being recreated (sink is one), and it is kept. The mark of one is a
 * `site/capture/` folder. Looked for on the default branch and on the branch
 * named. Not there (404), or nothing there at all (409, an empty repository)
 * is clean. Anything else is not assumed clean: it throws `CaptureUnknown`
 * with GitHub's status, and the caller refuses in words.
 *
 * `GITHUB_API` is unset everywhere but a test run, where it points at a stub.
 */
const API = process.env.GITHUB_API?.replace(/\/$/, "") || "https://api.github.com";

export class CaptureUnknown extends Error {
  constructor(public status: number | null, message: string) { super(message); }
}

export async function holdsCapture(token: string, repo: string, branch: string): Promise<boolean> {
  for (const ref of [null, branch]) {
    let status: number;
    try {
      const res = await fetch(`${API}/repos/${repo}/contents/site/capture${ref ? `?ref=${encodeURIComponent(ref)}` : ""}`, {
        headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28" },
        cache: "no-store",
      });
      status = res.status;
    } catch {
      throw new CaptureUnknown(null, "GitHub could not be reached");
    }
    if (status >= 200 && status < 300) return true;
    if (status !== 404 && status !== 409) throw new CaptureUnknown(status, `GitHub answered ${status}`);
  }
  return false;
}

/**
 * The repository among `sources` that `repo` is, if any: a site here was
 * brought in from it, and neither Publish nor Go live goes there. Only
 * `owner/name` entries count.
 */
export function sourceAmong(repo: string, sources: unknown): string | null {
  const list = Array.isArray(sources) ? sources.filter((r): r is string => typeof r === "string" && /^[\w.-]+\/[\w.-]+$/.test(r.trim())).map((r) => r.trim()) : [];
  return list.find((r) => r.toLowerCase() === repo.toLowerCase()) ?? null;
}
