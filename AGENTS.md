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

## Sandbox security

User code may only reach the Flock API. See [dev-docs/SANDBOX.md](dev-docs/SANDBOX.md).

- API functions return primitives or names/IDs, never Babylon or other host objects (the boundary drops them to `undefined`)
- Never pass user callbacks straight to Babylon observables; call them with only the values they need
- Generators put field values and other text into code with `JSON.stringify`
- Add a `@sandbox` test for any API that returns, resolves to, or calls back with non-primitive values

## Testing

- See [README_TOOLS.md](README_TOOLS.md) for instructions on running tests
- For the API, include tests in the implementation plan
- Run automated tests where possible
- If user verification is needed, describe the test to be carried out and request confirmation
- Don't introduce security issues
- Don't introduce changes that would break offline PWA behaviour
