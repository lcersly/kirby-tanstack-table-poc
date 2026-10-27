# Issue tracker: GitHub

Issues and specs for this repo live as GitHub issues. Use the `gh` CLI for all operations.

## Conventions

- Create: `gh issue create --title "..." --body "..."`.
- Read: `gh issue view <number> --json number,title,body,labels,comments`.
- List: `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'`, with suitable filters.
- Comment: `gh issue comment <number> --body "..."`.
- Apply or remove labels: `gh issue edit <number> --add-label "..."` or `--remove-label "..."`.
- Close: `gh issue close <number> --comment "..."`.
- Infer the repo from `git remote -v`; `gh` does this automatically inside a clone.

## Pull requests as a triage surface

**PRs as a request surface: no.** Set to `yes` only if this repo later treats external PRs as feature requests.

## Wayfinding operations

- Map: one issue labelled `wayfinder:map`, with Notes, Decisions-so-far, and Fog sections.
- Child tickets: issues linked as sub-issues when supported. Otherwise, add them to the map task list and put `Part of #<map>` in each body. Use `wayfinder:<type>` labels.
- Blocking: use native GitHub issue dependencies. If unavailable, record `Blocked by: #<n>` in the issue body.
- Frontier: choose the first open child with no open blockers and no assignee.
- Claim: assign the child issue with `gh issue edit <n> --add-assignee @me` before doing work.
- Resolve: comment with the answer, close the issue, then append a brief linked pointer to the map's Decisions-so-far.
