# GOV View — Agent Board (lead: agent 1)

North star: approved public records with a working official apply link + real Apply clicks.
Source count, registry size and phase notes are NOT progress.

## Baseline (2026-09-27, tag `baseline-2026-09-27` — PENDING, Phase 0 in progress)

| Metric | Baseline |
|---|---|
| Approved public records (IN / GB / FR) | 0 / 0 / 0 (verified: 0 approval markers in published cycles) |
| Collected (unapproved) FR / GB / IN | 12,581 / 6,175 / 4 |
| Registry sources (enabled) | 282 (6: in-upsc, in-ssc, gb-teaching-vacancies, fr-choisir-service-public, us-usajobs, jp-jinji) |
| Review queue files (`data/review/*.json`) | 82 (draft-cycle count TBD) |
| Baseline tree health | typecheck PASS, tests 364/364 PASS |
| Uncommitted at Phase 0 start | 58 modified + 2,138 untracked (data/ 274MB, phases/ 575 files) |
| Secret scan | PASS (2026-09-27). 2,197 changed files: 1,605 clean, 575 phases pre-verified clean, 0 real secrets. 9 hits all cleared: 3× public Boomerang RUM keys + 3× expired Liferay CSRF tokens + 1× route-label string in saved third-party evidence HTML/JS (not ours, already public); 1× fake canary fixture in secure-export.test.mjs (by design). 8 files unreadable (iCloud) — excluded, see below. |
| Baseline exclusions | None — the 8 iCloud-stalled files from the first scan all read fine on retry and are included. |
| iCloud anomaly (2026-09-27) | scripts/secure-export.test.mjs returned 3 different byte contents across reads ~40 min apart (no AKIA → AKIA+EXAMPLE → AKIA+ABCDEF) with stable mtime (Sep 25) and size (1556). Agent 2 confirms zero writes. Attributed to iCloud read inconsistency. All variants are obvious fakes, never secrets. Mitigation: post-commit hash verification (git objects vs worktree) before push. |

## Team status

| Agent | Role | Status | Notes |
|---|---|---|---|
| 1 | Lead / integration / audit | Phase 0: secret scan running, then commit+tag | Owns merges, board, spec |
| 2 | Release & Health | Holding for GO | Shared-checkout protocol acked; goal auto-parked, resumes on GO |
| 3 | Review Tool | Holding for GO | CONTRACT sent to agent 2 for `review:ui` script (cc lead); goal auto-parked |
| 4 | Data & Connectors | Holding for GO + beta IDs | Recon done (UPSC robots failure point, scoping); stays on main |
| 5 | Product UX & Research | Holding for GO | Recon done, 8-item worklist ready; needs decision on 2 cross-path files |

## Blockers

- Team blocked on lead GO (waiting on secret scan → baseline commit → tag). Nothing needed from human yet.
- Human decisions queued: (1) iCloud repo move yes/no, (2) beta amendment ratification, (3) analytics choice, deploy, source acceptance (later).

## Decisions (lead rulings)

1. Shared checkout: nobody creates/switches branches or runs git writes. All agents stay on main, edit only owned paths, leave changes uncommitted. Lead does all branching/merging. (agent 4's `agent/a4-data` ref pointer may stay; agent 5 deleted its pointer.)
2. Agent 3 must NOT edit package.json (agent 2's path). `review:ui` script via CONTRACT to agent 2; run via raw node until landed.
3. Status channel is direct messages only. No `docs/agents/*.md` (outside owned paths); lead mirrors status here.
4. Agent 4: collects stay `--source`-scoped; flag any new file over 50MB before writing (push limits).
5. Beta scope works as "assumed" until the human ratifies. Lead never marks ratified.
6. `.constitutionignore` holds 20 proven-false-positive entries (documented in-file with evidence): public third-party RUM/search/browser keys, expired JWTs, third-party lib strings in saved evidence HTML/JS, and fake fixtures in secure-export.test.mjs. This uses the guard's own documented FP control; the guard still scans everything else. Lead re-verifies remaining groups with hook-equivalent patterns before each baseline commit.

## Message log (key items)

- All agents STATUS: online, holding for GO. Agent 2/3/4 BLOCKERs: awaiting GO (+ beta IDs for 3/4).
- Agent 3 → agent 2 CONTRACT (cc lead): add `review:ui` npm script.
- Agent 5 worklist + cross-path needs (`lib/format.ts` timezone wording, `lib/coverage-labels.ts`): decision at GO.
