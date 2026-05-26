# Reasoning records

Use rationale records for architecture decisions. Do not commit private chain-of-thought or
long-form transcripts. The useful artifact is the decision, constraints, invariants, and
evidence.

## Required shape

For major module changes, include this in PR text, docs, or a concise code comment near the
boundary:

```text
Context:
Invariant:
Options considered:
Decision:
Performance impact:
Memory/lifecycle ownership:
Failure mode:
Validation:
```

## When required

Add a rationale record when changing:

- Protocol message shape.
- State ownership.
- Pure/impure boundaries.
- Transport behavior.
- Playback adapter lifecycle.
- Cache caps or queue/event caps.
- Cleanup ownership.
- Analyzer exceptions.

## Quality bar

Good records are short and testable:

- State the invariant that must not break.
- Name the owner responsible for cleanup.
- Mention memory or render impact.
- Point to tests or analyzer rules.

Bad records are vague:

- "This is cleaner."
- "Faster probably."
- "Temporary hack."
- "Trust this input."

Temporary exceptions must include a removal condition.
