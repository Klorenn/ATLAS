# Contributing to ATLAS

Thanks for taking the time. ATLAS is an open observatory for the Stellar ecosystem, and it gets better when more people check its data and its code.

## Ways to contribute

- **Report a bug.** Open an issue with the [bug report template](.github/ISSUE_TEMPLATE/bug_report.yml).
- **Propose a change.** Open an issue with the [feature request template](.github/ISSUE_TEMPLATE/feature_request.yml). Describe the problem before the solution.
- **Correct the data.** If a repository is attributed to the wrong builder, project or program, open an issue and include the evidence (a link to the source that proves it). Data corrections are the most valuable kind of contribution here.
- **Send code.** See below.

For anything larger than a fix, open an issue first. It is cheaper to agree on the approach than to rewrite a pull request.

## Setting up

```bash
git clone https://github.com/<your-username>/ATLAS.git
cd ATLAS/web
npm install
npm run dev
```

Requires Node.js `^18.0.0 || >=20.0.0` and npm. No environment variables are needed: the catalog snapshot in `web/public/data/catalog.json` is committed.

Only `npm run passport` needs one, and only to refresh the Passport snapshot that is already committed. Put `PASSPORT_API_KEY=pk_...` in a `.env` at the repository root. Never commit it, and never move it into `src/`: `pk_...` is an organization bearer, and anything under `src/` ends up in the bundle.

`@supabase/supabase-js` is installed but not imported anywhere yet. It is reserved for a planned edge function that will refresh the catalog automatically. Leave it in `package.json`.

The React app under `web/` is the primary experience. The files at the repository root are the standalone vanilla explorer and need no build step.

## Working on a change

1. Branch from the default branch: `git checkout -b fix/short-description`.
2. Keep the change focused. One concern per pull request.
3. Follow the surrounding code: TypeScript with `strict` on, Tailwind utility classes, the `@/` alias for imports from `src/`.
4. Respect the data contract. When the source does not publish a value, it stays `null`, never `0`, `false` or a guess. Filtering, sorting and pagination belong in `src/lib/catalog.ts`, not in components.
5. Run the only automated check there is:

   ```bash
   npm run build
   ```

   It runs `tsc --noEmit` before bundling, so type errors fail it. There is no linter, formatter or test suite configured yet.

6. Check the result in the browser, in both a narrow and a wide viewport.

## Adding a repository

`/add` prepares an entry for `web/data/curated-additions.json`; it does not write to the repository. Copy the generated block there, run `npm run data`, and commit both files.

The rules that make a curated entry trustworthy:

- **Separate what the source says from what you infer.** A category derived from repository topics is a suggestion and the page labels it as one. Correct it if the topic lies, and correct the topic if the label is right.
- **A blank field is not `false`.** Unchecked boxes are left out entirely. `null` means unknown; `false` is a claim.
- **An organization is not a person.** GitHub owners are frequently org accounts. If you do not know who writes the code, leave `builderName` empty and let attribution fall back to the owner.
- **Curated values add, they do not overwrite.** `curatedPrograms`, `curatedCountries` and `curatedCategory` sit on top of what the source already contributed. A repository curated as an InstaWards entry keeps its hackathon badge.
- **Say where it came from.** Use the note field for the event name or the link that justifies the entry. An entry that cannot be traced back to something does not belong in the catalog.

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```text
fix(explorer): keep the page in range after clearing filters
feat(catalog): add country filter
docs(readme): document the data regeneration script
```

## Opening a pull request

- Fill in the pull request template: summary, changes, and how you verified them.
- Link the issue it resolves, if there is one.
- Mention anything you could not verify, rather than leaving it implied.
- If the change is visual, include a before/after screenshot.

Review is a conversation, not a gate. Expect questions about the data contract in particular.
