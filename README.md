# Flock XR

[Flock XR](https://flockxr.com/) is a free, open-source tool for creating and exploring 3D worlds in the browser, designed for education and accessible on low-cost devices.

It enables educators, students, and families to build interactive 3D experiences without downloads or logins, making it easy to use in classrooms, clubs, and at home.

## Key features

- No login required  
- Runs entirely in the browser (including Chromebooks, tablets, and low-spec devices)  
- Designed for schools, clubs, and home learning  
- Supported by curriculum resources and ready-to-use lesson materials  

### What can you do with Flock XR?

Flock XR has been designed as a bridge between Scratch and professional 3D tools, such as Babylon JS, UEFN, Unity and Godot. 

- Build and explore interactive 3D environments  
- Create worlds using visual gizmos and block-based coding  
- Teach coding, game design, and digital storytelling through hands-on projects  
- Run engaging learning activities without installing software  

### Who is it for?

- Teachers and educators worldwide  
- Students (primary through secondary education)  
- Clubs, coding groups, and informal learning communities  
- Parents and home educators supporting creative learning 

👉 Try it now: [app.flockxr.com](https://app.flockxr.com/)
A project from: [Flip Computing](https://flipcomputing.com/).

### Supporters

The development of Flock XR is supported by grants from [Nlnet Foundation](https://nlnet.nl/project/FlockXR/), [UK Games Fund](https://www.ukgamesfund.com/funded-project/flock-xr/), and [MediaCity Immersive Technologies Innovation Hub](https://www.mediacityuk.co.uk/immersive-technologies-innovation-hub/).

We are looking for funding to take Flock XR further so please [get in touch](https://flipcomputing.com/contact/) if you can help.

### End user documentation

Please see our [documentation hub](https://hub.flockxr.com) and [free resources for clubs](https://github.com/flipcomputing/flock/blob/main/docs/docs.md).

## Development info

Full details of Flock XR versions including the latest Development version can be found at  [flockxr.com/versions/](https://flockxr.com/versions/)

You will also find full dev setup for [contirbuting to Flock XR](https://github.com/flipcomputing/flockupdate/blob/main/CONTRIBUTING.md) in our guide. 

Flock XR is licensed under the MIT License. By contributing, you agree that your contributions will be licensed under the same license.

### Project Structure

Flock XR is based on Blockly, the Babylon JS library and the Havok physics engine. Most 3D assets have been created within the project using Blender, with some audio from [Kenney.nl](https://kenney.nl/).

- JavaScript (considering TypeScript migration)
- Babylon.js - 3D rendering engine
- Google Blockly - Visual programming blocks
- Vite - Build tool
- Node.js - Development environment
- Progressive Web App features
- Mocha & Chai - Unit testing framework
- Playwright - End-to-end testing framework

### Project Statistics

[![CodeQL](https://github.com/flipcomputing/flock/actions/workflows/github-code-scanning/codeql/badge.svg)](https://github.com/flipcomputing/flock/actions/workflows/github-code-scanning/codeql)
[![Mocha tests](https://github.com/flipcomputing/flock/actions/workflows/run-mocha-tests.yml/badge.svg)](https://github.com/flipcomputing/flock/actions/workflows/run-mocha-tests.yml)

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
