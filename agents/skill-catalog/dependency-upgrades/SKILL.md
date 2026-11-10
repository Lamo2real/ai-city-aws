---
name: dependency-upgrades
description: "Plan and do dependency upgrades safely: what's outdated or vulnerable, the risk of each, and the order to upgrade in."
---
# Dependency upgrades

- List outdated and vulnerable packages from the lock files and the ecosystem's audit tool; note runtime vs dev-only.
- Security fixes first, by severity and whether the vulnerable code is actually reachable.
- Read the changelog for every major version; list the breaking changes that touch our code.
- Upgrade in small batches on a branch: one major at a time, lock file committed, full test suite and a build each time.
- Pin exact versions where the project pins; never add a package without checking its maintainers and downloads.
- Report what was upgraded, what was held back and why, and anything to watch after release.
