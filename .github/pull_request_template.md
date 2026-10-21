# Pull Request

## Description

Please include a summary of the change and which issue is fixed. Please also include relevant motivation and context. List any dependencies that are required for this change.

Fixes # (issue)

## Type of change

Please delete options that are not relevant.

- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] This change requires a documentation update

## Design checklist (VerveQ ONE)

For any change a player can see. Rules: `docs/APP_OVERVIEW.md` → Design System.

- [ ] **One brand:** ink ground, cream only as a reading card, one logo
- [ ] **Color has a job:** lime only for the one main action; green/red only for right/wrong; mode colors only on mode tiles; text on any colored fill is ink
- [ ] **Same job, same component:** exit, progress, timer, verdict, score, end screen and share use the shared primitives
- [ ] **Every game ends the same way:** score → streak/rank → share → next game
- [ ] **Readable inside Instagram (390×664):** text ≥ 12px, tap targets ≥ 44px, AA contrast, main action above the fold
- [ ] **One shell:** hub screens in HubFrame, games in StageFrame; no new v1 screens
- [ ] **Plain words:** a cold visitor understands every label; numbers carry units
- [ ] `npm run check` passes, including the design ratchet (`npm run design:baseline` after a reduction)

## How Has This Been Tested?

Please describe the tests that you ran to verify your changes. Provide instructions so we can reproduce. Please also list any relevant details for your test configuration.

- [ ] Test A
- [ ] Test B

**Test Configuration**:
* Firmware version:
* Hardware:
* Toolchain:
* SDK:

## Checklist:

- [ ] My code follows the style guidelines of this project
- [ ] I have performed a self-review of my own code
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] I have made corresponding changes to the documentation
- [ ] My changes generate no new warnings
- [ ] I have added tests that prove my fix is effective or that my feature works
- [ ] New and existing unit tests pass locally with my changes
- [ ] Any dependent changes have been merged and published in downstream modules