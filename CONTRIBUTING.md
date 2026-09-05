# Contributing to sliced-bread-architecture

Thanks for your interest. Contributions of all sizes are welcome — a
typo fix is just as useful as a feature. This document describes how
to get from "I want to help" to "my change is merged".

## Filing issues

- Search [open issues](https://github.com/paulnsorensen/sliced-bread-architecture/issues)
  before opening a new one.
- Use the bug-report or feature-request template.
- For security vulnerabilities, do **not** open a public issue — see
  [`SECURITY.md`](./SECURITY.md).

## Validate locally

For a fresh checkout, this sequence installs the pinned site dependencies and
runs the same formatting, Markdown, contract, and generated-site behavior
checks as CI:

```sh
git clone https://github.com/paulnsorensen/sliced-bread-architecture.git
cd sliced-bread-architecture
npm --prefix site ci
npm exec --prefix site -- prettier --check .
npx markdownlint-cli2@0.23.2
node scripts/check-contracts.mjs
node --test tests/check-contracts.test.mjs
node --test tests/audit-boundaries.test.mjs
node --test tests/site-404.test.mjs
```

The site behavior test builds an isolated fixture and verifies the generated 404 page. A bare site build is not equivalent because it does not assert the rendered heading, explanatory copy, and documentation link.

To run the documentation site during development:

```sh
npm --prefix site run dev
```

Run the validation sequence before opening a PR.

## Submitting a pull request

1. Fork the repo and create a topic branch from `main`.
2. Make your change. Keep commits focused; one concern per commit is
   easier to review than a kitchen-sink commit.
3. Use [Conventional Commits](https://www.conventionalcommits.org)
   for the PR title (e.g. `feat: add X`, `fix: handle Y`,
   `docs: explain Z`). Squash-merge will use the PR title as the
   commit subject.
4. Fill out the PR template — the "why" matters more than the "what".
5. Wait for CI to go green and address review feedback.

## Code of Conduct

Participation in this project is governed by the
[Contributor Covenant](./CODE_OF_CONDUCT.md). By contributing you
agree to abide by it.

## Licensing

By submitting a contribution you agree that it will be licensed under
the same terms as the project itself (see [`LICENSE`](./LICENSE)).
