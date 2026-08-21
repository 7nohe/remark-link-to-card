---
name: release
description: Cut and publish a release of remark-link-to-card to npm. Use this whenever the user wants to release, publish, ship, cut a version, bump the version, tag a release, or get a change onto npm — including phrasings like "release a patch", "publish this", "get this out", "0.1.0 を出したい", or "リリースして". Also use it when a release has gone wrong and needs diagnosing: a tag that did not publish, a failed publish job, or a version stuck unpublished.
---

# Releasing remark-link-to-card

## How releasing works here

Publishing is done by CI, not from a laptop. Pushing a `v*` tag runs
`.github/workflows/release.yml`, which publishes to npm and then creates the
GitHub release.

There is no npm token anywhere. npm mints a short-lived publish credential from
the workflow's OIDC token — this is npm's *trusted publishing*, configured on
npmjs.com against this repository and the workflow filename `release.yml`. A
side effect worth knowing: npm attaches a provenance attestation, so the
package page shows which commit and workflow run built it.

This matters for the whole procedure: **the tag is the trigger and the tag is
the input.** Everything else follows from getting the tag right.

## Before releasing

Check these, because npm releases cannot be taken back — `npm unpublish` is
only allowed within 72 hours and is refused outright once a package has
dependents. A wrong version number is permanent.

- `main` is green. The publish job runs the tests, but finding out at publish
  time wastes a version number if the tag has already been pushed.
- You are on `main` and up to date with the remote.
- The working tree is clean.
- Everything intended for this release is merged. There is no way to add to a
  version after the fact.

## Releasing

```bash
pnpm release
```

That is `bumpp`, which prompts for the new version and then — by default —
updates `package.json`, commits, tags `vX.Y.Z`, and pushes both the commit and
the tag. The push of the tag is what starts the release.

Then watch it:

```bash
gh run watch "$(gh run list --workflow=release.yml --limit 1 --json databaseId -q '.[0].databaseId')"
```

The workflow does, in order:

1. **Tag/version guard** — refuses to continue if the tag does not match
   `package.json`'s version. This runs before anything is uploaded, so a
   mismatch costs nothing.
2. **Tests**.
3. **`pnpm publish --access public --provenance --no-git-checks`**.
   `prepublishOnly` builds `dist/` as part of this.
4. **Changelog** — a separate job that waits on the publish job, so a GitHub
   release only appears for a version that actually reached npm.

## Verifying

```bash
npm view remark-link-to-card version          # the new version
gh release view "v$(node -p 'require("./package.json").version')"
```

Also worth a look on the first release after any change to publishing: the npm
package page should show a provenance badge linking back to the workflow run.
Its absence means the publish fell back to something other than trusted
publishing, which is worth understanding before the next release.

To see exactly what would ship without publishing:

```bash
pnpm pack --pack-destination /tmp && tar -tzf /tmp/remark-link-to-card-*.tgz
```

Expect `dist/` and `styles/` (the `files` field) plus `package.json` and
`README.md`, which npm always includes. Anything else means `files` needs
looking at.

## When it goes wrong

**The tag pushed but no workflow ran.** The trigger is `tags: ['v*']`. A tag
without the `v` prefix does nothing.

**Publish fails with a 404 or an authentication error.** This is almost always
the trusted publisher configuration on npmjs.com disagreeing with reality. It
must name owner `7nohe`, repository `remark-link-to-card`, workflow filename
`release.yml` — filename only, not a path — and the environment field must be
empty, because the publish job declares no `environment:`. If a job-level
`environment:` is ever added to the workflow, npm's config has to gain the same
name in the same change or publishing breaks.

**Publish fails saying the version already exists.** npm never allows a version
to be republished, even after unpublishing. Bump to the next patch and release
again; do not try to reuse the number.

**The guard rejected the tag.** The tag and `package.json` disagree, usually
from a hand-made tag. Delete the tag locally and remotely, then use
`pnpm release` rather than tagging by hand.

**Tests failed in the publish job.** Nothing was published — the job fails
before the publish step. Fix on `main`, then release a new version. The tag for
the failed attempt is already used, so do not retag it.

## What not to do

**Do not run `npm publish` or `pnpm publish` locally.** Trusted publishing
means there is no token on your machine to publish with, so it will either fail
or, if you still hold a legacy token, succeed *without* provenance and race the
tag build. The release path is the tag.

**Do not move or reuse a version tag.** The tag is the audit trail the
provenance attestation points at.
