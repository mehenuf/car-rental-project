# Skill availability report

Checked 2026-09-21. Paths are under `C:/Users/Mehenuf/.claude/` (user scope) unless marked project.

| Skill / plugin | Installed path | Version / date | Trigger | Purpose | Status | Action taken |
|---|---|---|---|---|---|---|
| Impeccable | `skills/impeccable` | SKILL.md dated 2026-09-01; `scripts/context.mjs`, `reference/*` present | `/impeccable <command>` | Audit, critique, polish, harden | Ready | Loaded context, audit, new-work and craft-floor references; ran `scripts/detect.mjs` |
| design-taste-frontend | user `skills/design-taste-frontend` and project `.claude/skills/design-taste-frontend` | v2 (1206 lines); user copy dated 2026-08-27; the two copies are byte-identical | `design-taste-frontend` | Core anti-slop system | Ready | Installed project-local with `npx skills add https://github.com/Leonxlnx/taste-skill --skill design-taste-frontend --agent claude-code -y`. **Only `SKILL.md` exists: no `reference/` folder.** |
| redesign-existing-projects | project `.claude/skills/redesign-existing-projects` | 178 lines | `redesign-existing-projects` | Existing-site audit | Ready | Installed the same way |
| high-end-visual-design | project `.claude/skills/high-end-visual-design` | 98 lines | `high-end-visual-design` | Premium refinement | Ready | Installed; **conflicts with this project's rules, see orchestration log** |
| full-output-enforcement | project `.claude/skills/full-output-enforcement` | 49 lines | `full-output-enforcement` | Completeness gate | Ready | Installed |
| stitch-design-taste | project `.claude/skills/stitch-design-taste` | 184 lines plus `DESIGN.md` | `stitch-design-taste` | Stitch export | Installed, not invoked | Stitch is not part of this workflow |
| industrial-brutalist-ui | project `.claude/skills/industrial-brutalist-ui` | 92 lines | `industrial-brutalist-ui` | Structural critique lens | Installed, not invoked as a style | Critique lens only |
| epic-design | none | none | none | Optional external guidance | **Unavailable** | Searched `~/.claude/skills`, `~/.claude/plugins`, the repo. Only Jira-epic workflow documents match "epic". Not installed, not used. |
| Framework / TypeScript / Code Reviewer / Architecture Designer / Spec Miner / Debugging Wizard / Test Master / Playwright Expert / Security Reviewer / DevOps Engineer / The Fool | `plugins/marketplaces/fullstack-dev-skills` | plugin | `fullstack-dev-skills:<name>` | Engineering support | Ready | Listed in the skills index; see the orchestration log for which were actually invoked |
| Monitoring Expert | none under that name | none | none | Performance measurement | Missing | Used Lighthouse, Playwright traces and `scripts/perf/*` instead |

The project-local skills live in `.claude/skills/`, which this repository ignores by design. `skills-lock.json` (committed) records their source.
