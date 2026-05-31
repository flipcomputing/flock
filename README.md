# Flock XR

[Flock XR](https://flockxr.com/) is a free, open-source tool for creating and exploring 3D worlds in the browser, designed for education and accessible on low-cost devices.

It enables educators, students, and families to build interactive 3D experiences without downloads or logins, making it easy to use in classrooms, clubs, and at home.

## Key features

- No login required  
- Runs entirely in the browser (including Chromebooks, tablets, and low-spec devices)  
- Designed for schools, clubs, and home learning  
- Supported by curriculum resources and ready-to-use lesson materials  

### What can you do with Flock XR?

- Build and explore interactive 3D environments 
- Create worlds using visual gizmos and block-based coding  
- Teach coding, game design, and digital storytelling through hands-on projects  
- Run engaging learning activities without installing software
- Use games engine concepts such as aniamtions, particle effects and physics. 

Flock XR has been designed to start with younger children aged 7+, often using tablets. Then take them through upper primary, middle school and high school right through to professional 3D tools, such as Babylon JS, UEFN, Unity and Godot. 

### Why 3D and XR?
3D is engaging and age appropriate for young people and can lead to careers across a range of industries. Technology that originated in games is now used in many sectors. XR and spatial computing are changing how humans interact with technology, bridging the physical and digital worlds. 

- Young people love 3D games and social platforms such as Minecraft, Roblox, Fortnite and more. Flock XR brings that knowledge into the classroom.
- The real world is 3D. It turns out that some things are just easier when you don't have the complexity of having to map to 3D.
- 3D is the basis for eXtended Reality and spatial computing, the metaverse and immersive tech which are growing dramatically across industries. 

### Who is it for?

- Young people age 7-14+ (primary through secondary education, K-12)
- Teachers and educators worldwide  
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

You will also find full dev setup for [contributing to Flock XR](https://github.com/flipcomputing/flockupdate/blob/main/CONTRIBUTING.md) in our guide. 

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
