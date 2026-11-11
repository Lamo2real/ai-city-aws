## Engineering guidance
- Each worker gets its own branch named `vaic/<ticket>-<short-name>`. Tests come with every change.
- A deliverable passes review only with the checks it names actually run and green: tests, lint, typecheck, build.
- Integrate passing branches into one feature branch. The pull request to `main` is opened after the Orchestrator's sign-off and merged then; nothing waits for the owner.
