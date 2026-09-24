# Reviewer corrections

Some official sources only publish key facts inside PDFs, for example Japan's exam guides and the SSC and UPSC notifications. A reviewer who has read the notice can add the missing facts here. The collector applies them on every run, on top of what it collected.

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

Always quote the notice in `evidence`. The eligibility checker shows these quotes to people, so they can see where each rule comes from.
