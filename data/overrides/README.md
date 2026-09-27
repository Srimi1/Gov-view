# Reviewer corrections and approvals

Official sources sometimes publish key facts only inside PDFs. Enter corrections here after reading the exact official notice. Collector stages candidates in `data/review/<source-id>.json`; a staged candidate does not publish until a human records an approval for its current evidence and record revisions.

Use one file per opportunity, named after its id (`<id>.json`), containing only the fields to set:

```json
{
  "status": "open",
  "applicationWindow": { "opensOn": "2027-02-19", "closesOn": "2027-03-23", "precision": "date" },
  "rules": {
    "asOn": "2027-04-01",
    "age": { "min": 21, "max": 30, "evidence": "受験案内 p.2: 1997年4月2日～2006年4月1日生まれの者" },
    "nationality": { "allowed": ["JP"], "evidence": "受験案内: 日本の国籍を有しない者は受験できません" }
  }
}
```

Always quote the notice in `evidence`. The eligibility checker shows these quotes to people, so they can see where each rule comes from. Never infer eligibility or application dates from a tentative exam calendar.

After reviewing a staged candidate, find its `approvalRevisions` entry in `data/review/<source-id>.json`. Run this command with the exact hashes and your actual review details:

```sh
node --experimental-strip-types scripts/approve-review.ts approve \
  --source in-kl-recruitment \
  --id kerala-psc-2026-123 \
  --reviewer "Reviewer name" \
  --minutes 7 \
  --reason "Checked application window and eligibility against notice" \
  --evidence-summary "Official notice PDF and gazette page checked" \
  --evidence-revision "<64-character hash from review packet>" \
  --record-revision "<64-character hash from review packet>"
```

Only a person who checked the cited evidence should run the approval command. It refuses changed revisions, missing exact-byte evidence, empty review notes, and zero review time. Fetched text bodies are retained as deduplicated `.txt.gz` files under `data/evidence/bodies/<source-id>/`; PDF bytes use `.bin`. The command verifies retained bytes against the recorded SHA-256 hash. It preserves existing corrections and writes a timestamped decision to this directory; it does not publish immediately. For disabled adapters, record connector acceptance and enable the source before publication. Then re-run collection and review the resulting pull request. The enabled collector keeps the latest exact approved cycle in `data/approved/cycles/<country-code>.json` before updating mutable source records. Pending revisions cannot replace that snapshot; a later material change or evidence revision returns the candidate to review while the previous approved version remains available with its older review date.
