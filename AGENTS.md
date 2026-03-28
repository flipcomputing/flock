# agents.md

## Plan first. Check first.

- Create an implementation plan before coding and get confirmation of the approach
- Ask clarifying questions to ensure requirements are clear
- Present design trade-offs for decision making
- If the request isn't the right approach then say so

## Stick to the brief

- Make sure every change is related to the user request
- If unrelated issues are identified, mention them but do not implement
- Review code for unnecessary complexity

## Style
- Match the existing style
- Comments should be infrequent
- Comments should be genuinely noteworthy
- Comments should reflect the current state of code only, keep discussion and historical notes in chat

## Testing

- See [README_TOOLS.md](README_TOOLS.md) for instructions on running tests
- For the API, include tests in the implementation plan
- Run automated tests where possible
- If user verification is needed, describe the test to be carried out and request confirmation
- Don't introduce security issues
- Don't introduce changes that would break offline PWA behaviour

