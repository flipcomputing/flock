# flock
**[Flock XR](https://flockxr.com/) - Creative coding in 3D**\
A project from: [Flip Computing](https://flipcomputing.com/).

Current pilot version: [app.flockxr.com](https://app.flockxr.com/)

## Project Statistics
[![CodeQL](https://github.com/flipcomputing/flock/actions/workflows/github-code-scanning/codeql/badge.svg)](https://github.com/flipcomputing/flock/actions/workflows/github-code-scanning/codeql)
[![Mocha tests](https://github.com/flipcomputing/flock/actions/workflows/run-mocha-tests.yml/badge.svg)](https://github.com/flipcomputing/flock/actions/workflows/run-mocha-tests.yml)

Flock XR is a free 3D coding and design tool to allow young people aged around 9-14+ to make interactive experiences, games, animations, VR experiences and more. Flock XR runs in a web browser with no accounts or downloads needed. 

Flock XR has been designed as a bridge between Scratch and professional 3D tools, such as Babylon JS, UEFN, Unity and Godot. Flock XR builds on our experience working in schools and clubs to create engaging resources for young people to use and personalise. 

A new version of our 3D block-based programming language is currently under development. Lots of features need more work and may change! 

We are looking for funding to take Flock XR further so please [get in touch](https://flipcomputing.com/contact/) if you can help. 

Flock XR is based on Blockly, the Babylon JS library and the Havok physics engine. Most 3D assets have been created within the project using Blender, with some use of CC0 3D assets from [Quaternius](https://quaternius.com/) and [Kenney.nl](https://kenney.nl/).

## End user documentation

Please see our [free resources for clubs](https://github.com/flipcomputing/flock/blob/main/docs/docs.md).

## Development info

View the current development version at [flipcomputing.github.io/flock/](https://flipcomputing.github.io/flock/)

### Prerequisites
- Node.js (version 18 or higher)
- Git

### Dev set up
- Fork the repo on GitHub
- Clone your fork to your local machine: `https://github.com/USERNAME/flock.git` or `git@github.com:USERNAME/flock.git`
- Navigate to the project: `cd flock`
- Install dependencies: `npm install`

### Contributing
- Create a feature branch: `git checkout -b your-feature-name`
- Make your changes
- Push to your fork: `git push origin your-feature-name`
- Create a Pull Request on GitHub

### Run locally
`npm run dev`

You should see it here: http://localhost:5173/

### Run tests

For detailed testing documentation including Playwright end-to-end tests and Mocha unit tests, see the [Testing section in CONTRIBUTING.md](CONTRIBUTING.md#testing).

**Quick start:**
- Mocha tests (browser): http://localhost:5173/tests/tests.html (with dev server running)
- Mocha tests (CLI): `npm run test:api @notslow` (automated, headless)
- Playwright tests: `npx playwright test`

### API Quality Tools

This project includes automated tools for tracking and improving API documentation and test coverage.

**📚 Documentation:**
- **[API Quality Tools Guide](docs/API_QUALITY_TOOLS.md)** ⭐ - Complete guide to using the tools
- [Getting Started](docs/GETTING_STARTED.md) - Quick start for improving API quality
- [API Strategy](docs/API_RECONCILIATION_PLAN.md) - Overall approach and goals
- [Current Status](docs/IMPLEMENTATION_STATUS.md) - Metrics and progress tracking

**🔧 Key Commands:**
```bash
# Check API documentation and test coverage
npm run docs:coverage

# Run API tests (automated, headless)
npm run test:api @notslow    # All fast tests (100 tests)
npm run test:api babylon     # Specific test suite
npm run test:api @onlyslow   # All slow tests (94 tests)
```

**📊 Current Metrics:**
- 108 total API methods
- 48% documented in API.md (52 methods)
- 49% tested (53 methods)
- 226 total tests across 15 test files

### Project Structure
This is a Vite-based project using:
- Blockly for visual programming blocks
- Babylon.js for 3D rendering
- Havok physics engine
- Mocha & Chai for testing


### Supporters

The development of Flock XR is supported by grants from [Nlnet Foundation](https://nlnet.nl/project/FlockXR/) and [UK Games Fund](https://www.ukgamesfund.com/funded-project/flock-xr/). 
