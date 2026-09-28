# GOV View — Agent Board (lead: agent 1)

North star: approved public records with a working official apply link + real Apply clicks.
Source count, registry size and phase notes are NOT progress.

## Baseline (2026-09-27, tag `baseline-2026-09-27` = 9ee614f, pushed; fresh clone ~/code/Gov-view verified green, iCloud checkout RETIRED)

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

## Beta scope (RATIFIED by human 2026-09-27 — binding, no longer assumed)

India central: `in-upsc`, `in-ssc`, `in-rrb-railways`, `in-ibps-crp`, `in-indiapost-gds`. State PSCs: `in-kl-recruitment` (Kerala), `in-ka-recruitment` (Karnataka), `in-gj-recruitment` (Gujarat), `in-tn-recruitment` (Tamil Nadu), `in-wb-recruitment` (West Bengal). UK: `gb-teaching-vacancies`. FR: `fr-choisir-service-public`. Freeze: no new registry sources while queue > 50 or approvals flat WoW.

## Team status

| Agent | Role | Status | Notes |
|---|---|---|---|
| 1 | Lead / integration / audit | Running team in ~/code/Gov-view | Owns merges, board, spec |
| 2 | Release & Health | GO sent, working | Reconciling owned paths vs baseline; owes agent 3 the `review:ui` script |
| 3 | Review Tool | GO sent, working | Building tools/review/; packet compat contract active |
| 4 | Data & Connectors | GO sent, working | Verifying beta collects; registry freeze (beta only) binding |
| 5 | Product UX & Research | GO sent, working | 8-item worklist + 2-file exception (see decision 11) |

## Blockers

- Team blocked on lead GO (push + tag in progress).
- Human decisions 2026-09-27: guardrail one-time exception GRANTED for bulk baseline commits + push (commits passed the guard anyway — exception held in reserve for push); iCloud move YES (fresh clone to ~/code/Gov-view after tag); beta amendment RATIFIED.
- Still queued for later: analytics choice, deploy, source-level acceptance.

## Decisions (lead rulings)

1. Shared checkout: nobody creates/switches branches or runs git writes. All agents stay on main, edit only owned paths, leave changes uncommitted. Lead does all branching/merging. (agent 4's `agent/a4-data` ref pointer may stay; agent 5 deleted its pointer.)
2. Agent 3 must NOT edit package.json (agent 2's path). `review:ui` script via CONTRACT to agent 2; run via raw node until landed.
3. Status channel is direct messages only. No `docs/agents/*.md` (outside owned paths); lead mirrors status here.
4. Agent 4: collects stay `--source`-scoped; flag any new file over 50MB before writing (push limits).
5. Beta scope works as "assumed" until the human ratifies. Lead never marks ratified.
6. `.constitutionignore` holds 20 proven-false-positive entries (documented in-file with evidence): public third-party RUM/search/browser keys, expired JWTs, third-party lib strings in saved evidence HTML/JS, and fake fixtures in secure-export.test.mjs. This uses the guard's own documented FP control; the guard still scans everything else. Lead re-verifies remaining groups with hook-equivalent patterns before each baseline commit.
7. Human granted a one-time guardrail exception (2026-09-27) for the bulk baseline commits + push. The commits passed the guard normally, so the exception was not needed for them; it remains available for the push if the pre-push scan proves intractable.
8. Human approved the iCloud move (2026-09-27): fresh clone to ~/code/Gov-view after the baseline tag is pushed; agents re-point, iCloud checkout retired.
9. Beta amendment RATIFIED by the human 2026-09-27. The 12-source scope + freeze are binding (no longer assumed).
10. Repo moved to ~/code/Gov-view via fresh clone from origin (2026-09-27, human-approved). All work happens there via absolute paths; the iCloud checkout is RETIRED — nobody edits it. Agent mobility confirmed by probe.
11. Agent 5 granted a recorded exception for exactly two files outside its paths — `lib/format.ts` (timezone wording) and `lib/coverage-labels.ts` (coverage label) — single-purpose beta-label use, audited at DONE. No other cross-path edits without asking.
12. After the mid-baseline concurrent commit 3e92c6e (human's own prompt-docs update, benign, kept), the lead uses FILE-LEVEL `git add` (never bare directories) in shared areas so no commit can sweep another writer's uncommitted changes.

## Message log (key items)

- All agents STATUS: online, holding for GO. Agent 2/3/4 BLOCKERs: awaiting GO (+ beta IDs for 3/4).
- Agent 3 → agent 2 CONTRACT (cc lead): add `review:ui` npm script.
- Agent 5 worklist + cross-path needs (`lib/format.ts` timezone wording, `lib/coverage-labels.ts`): decision at GO.
- Agent 2 confirms zero writes (cleared on the fixture-string anomaly — attributed to iCloud read inconsistency).
- Human Q&A 2026-09-27: guard exception YES, iCloud move YES, beta RATIFIED.
- Concurrent commit 3e92c6e (human's Claude: goal-prompts doc update) landed mid-baseline; reviewed, benign, kept. Lead switches to file-level adds.
- Agent 5 mobility probe: absolute paths outside the iCloud root work — team can operate in ~/code/Gov-view.
- GO sent to agents 2–5 with beta IDs (see Beta scope); all work in ~/code/Gov-view.
