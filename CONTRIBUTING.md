# Contributing to PTS

Thanks for your interest in contributing to the Phone Theft Tracking System! This document outlines how to get set up and submit changes.

## Getting Started

1. **Fork** the repository and clone your fork locally.
2. Follow the [setup instructions in the README](README.md#-getting-started) to get the backend and frontend running locally.
3. Create a new branch for your work:
```bash
   git checkout -b feature/short-description
```

## Making Changes

- Keep pull requests focused on a single feature or fix — smaller PRs are easier to review.
- Follow the existing code style in the file you're editing (the frontend uses ESLint; run 
pm run lint in rontend/ before submitting).
- Add comments for any non-obvious logic, especially around the ownership-transfer and certificate-issuance flows.
- If you change the Prisma schema, include the generated migration in your PR.

## Commit Messages

We loosely follow [Conventional Commits](https://www.conventionalcommits.org/):

feat: add vendor tier upgrade endpoint

fix: correct risk score calculation for INVESTIGATING devices

docs: update API setup instructions
## Submitting a Pull Request

1. Push your branch to your fork:
```bash
   git push origin feature/short-description
```
2. Open a Pull Request against main.
3. Describe **what** changed and **why** — link any related issue.
4. Be ready to respond to review feedback; we aim to review PRs within a few days.

## Reporting Bugs & Requesting Features

- Search existing [issues](https://github.com/Uszkido/pts-project/issues) before opening a new one.
- For bugs, include: steps to reproduce, expected vs. actual behavior, and relevant logs/screenshots.
- For feature requests, explain the use case — see [ROADMAP.md](ROADMAP.md) for planned directions, your idea might already be on there.

## Reporting Security Issues

Please **do not** open a public issue for security vulnerabilities. See [SECURITY.md](SECURITY.md) for responsible disclosure steps.

## Code of Conduct

This project follows our [Code of Conduct](CODE_OF_CONDUCT.md). Please be respectful and constructive in all interactions.

---

Thank you for helping make PTS better! 🙌
