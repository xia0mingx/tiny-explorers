# Working in this repo

## Workflow default

After making a change: commit, push, open a PR, merge it to `master`, and
confirm the deploy — do all of this by default, without asking first.
`master` auto-deploys to GitHub Pages via `.github/workflows/pages.yml` on
every push, so a merge to `master` is the deploy.
