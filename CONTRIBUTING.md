# Contributing to Flock XR

Hey there! We welcome community contributions to Flock XR. This could be **code**, **documentation**, **reporting bugs**, **suggesting accessibility features**, **adding translations**, or something else!

## 🚀 Quick Start for First-Time Contributors

### What is Flock XR?
Flock XR is a creative coding platform for 3D development using Blockly and Babylon.js. It's designed as a bridge between Scratch and professional 3D tools, making 3D programming accessible to young people and beginners.

### Ways to Contribute
- 🐛 **Report bugs** - Found something broken? Let us know!
- 📝 **Improve documentation** - Help make our docs clearer
- ✨ **Add features** - Implement new blocks, effects, or tools
- 🧪 **Write tests** - Help us improve stability
- ♿ **Accessibility improvements** - Make Flock more inclusive
- 🌍 **Translations** - Help us reach more users worldwide
- 🎨 **UI/UX improvements** - Make the interface better

Before starting, we suggest you [get in touch](https://flipcomputing.com/contact/).

## 🛠️ Development Setup

### Prerequisites
- Node.js (version 18 or higher)
- Git
- A modern web browser

### Getting Started
1. **Fork the repo** on GitHub
2. **Clone your fork** to your local machine:
   ```bash
   git clone git@github.com:YOUR_USERNAME/flock.git
   ```
3. **Navigate to the project**:
   ```bash
   cd flock
   ```
4. **Install dependencies**:
   ```bash
   npm install
   ```
5. **Start the development server**:
   ```bash
   npm run dev
   ```
6. **Open your browser** to http://localhost:5173/

### Making Changes
1. **Create a feature branch**:
   ```bash
   git checkout -b your-feature-name
   ```
2. **Make your changes** (see project structure below).
3. **Test your changes** including running the automated tests, details of how to do so follow below.
4. **Commit your changes**:
   ```bash
   git add .
   git commit -m "Add your descriptive commit message"
   ```
5. **Push to your fork**:
   ```bash
   git push origin your-feature-name
   ```
6. **Create a Pull Request** on GitHub

For more specific developer-facing documentation, please see [dev-docs.md](dev-docs/dev-docs.md).

## 📁 Project Structure

Understanding the codebase – key files:
- **`index.html`** - Main HTML file that defines the application structure, UI layout (menu, canvas, code panel), and loads all necessary scripts and stylesheets
- **`main/main.js`** - Main application entry point that initializes Blockly workspace, handles code execution, manages UI views (canvas/blocks/split), and controls file operations
- **`flock.js`** - Main Flock engine
- **`ui/designview.js`** - Visual design interface enabling direct 3D object manipulation with gizmos, synchronizing 3D changes with Blockly blocks
- **`blocks.js`** - Block definitions
- **`generators.js`** - Blockly JavaScript generators for blocks
- **`toolbox.js`** - Blockly toolbox configuration

Directories:
- **`api/`** - Core Flock XR API functions (scene, animation, physics, etc.)
- **`blocks/`** - Additional Blockly block definitions
- **`docs/`** - Getting started documentation
- **`examples/`** - Example project JSON files including those featured in the Demo dropdown
- **`fonts/`** - Fonts used in UI and 3D text generation
- **`images/`** - Images used in UI
- **`locale/`** - localisation / translation
- **`main/`** - application file to support flock engine
- **`models/`** - 3D models (.glb files)
- **`textures/`** - Texture files for materials
- **`sounds/`** - Audio files
- **`tests/`** - Test files (please add tests for new features!)
- **`ui/`** – UI files

## 🧪 Testing

We use Mocha and Chai for testing, plus Playwright for end-to-end testing. Always test your changes:

### Unit/Integration Tests (Mocha & Chai)
**Add new tests** for any features you create

#### Run tests
1. **Run the development server**: `npm run dev`, which starts a local webserver.
1. **Visit the test page**: http://localhost:5173/tests/tests.html
1. **Select tests** from the dropdown and click _Run Tests_.


#### Filtering tests and test results
* **Get fast feedback** by using the _Run all except @slow_ option
* **Run only your newest tests** by tagging those tets with @new and picking _Run tests tagged @new_
* **Focus on results** with the _failures_ / _passes_ links in report
* **Show the test code** by clicking on test name in the report
* **Tag slow tests with @slow** so that they can be run separately if needed.
* **Tag new tests with @new** so that you can fiter on those new tests. Remove tag when they're no longer new.

#### Tagging tests
To add a tag, change the `describe` or `it` text in unit tests to add a tag. 

#### Adding new unit test files / adding new tags to test runner
* Array `testSuiteDefinitions` corresponds to the test selection dropdown. Eaxh test file, and each selectable tag, need a definition.
* Modify `testSuiteDefinitions` in `tests/tests.html` to pick up the test file. Each test file needs an entry.
* Modify `testSuiteDefinitions` in `tests/tests.html` to add tags or names to focus. Each tag needs an entry.
* Note that some test suites are selected/filtered on a name (the name from the top `describe` if there's only one) and others on tag (added to all top-level describes if several).


### End-to-End Tests (Playwright)

Playwright tests are located in `tests/playwright/`. These are automated end-to-end tests that verify the UI loads correctly, blocks function properly, and the overall user experience works as expected.

#### Install Playwright browsers

Before running tests, ensure Playwright browsers are installed:

```bash
npx playwright install
```

#### Verify browsers are installed

Check that browsers are properly installed:

```bash
npx playwright install --dry-run
```

#### Run Playwright tests

Run all tests:
```bash
npx playwright test
```

Run a specific test file:
```bash
npx playwright test tests/playwright/flock.spec.js
```

The tests will automatically start the dev server (http://localhost:5173) before running.

#### View test results

View the HTML test report:
```bash
npx playwright show-report
```

#### Generate or update visual snapshots

Some tests use visual regression testing by comparing screenshots against baseline images. When running these tests for the first time or when intentional visual changes are made, you need to generate/update the snapshots:

```bash
npx playwright test --update-snapshots
```

After generating snapshots:
1. Review the generated images in `tests/playwright/*-snapshots/` to ensure they look correct
2. Run the tests again without the flag to verify they pass
3. Commit the snapshot images to version control

Update specific snapshots only:
```bash
npx playwright test blocks.spec.js --update-snapshots
```

### Test Artifacts

Several files and directories are generated during testing and should **not** be checked into git:

- `test-results/` - Playwright test results
- `playwright-report/` - Generated test reports  
- `.last-run.json` - Runtime state from last test execution

These are already included in `.gitignore`. If you create new test artifacts, make sure to add them to `.gitignore` as well.

## 📋 Current Priorities

1. **Stability** - Bug fixes and reliability improvements
2. **Testing** - More comprehensive test coverage
3. **Accessibility** - Making Flock usable for everyone
4. **UX improvements** - Better user experience
5. **Documentation** - Clearer guides and API docs

## 🐛 Reporting Issues

When reporting bugs, please include:
- Steps to reproduce the issue
- Expected vs actual behavior
- Browser and operating system
- Screenshots or screen recordings if helpful
- Any console errors

## 💡 Suggesting Features

Before suggesting new features:
1. Check existing issues to avoid duplicates
2. Think about how beginners would use it
3. Consider performance
4. Provide use cases and examples

## 📝 Documentation

Help us improve documentation by:
- Fixing typos or unclear explanations
- Adding examples to the [API documentation](API.md)
- Creating tutorials for new features
- Improving code comments

## 🎨 Design Guidelines

When contributing UI/UX improvements:
- Keep accessibility in mind
- Maintain consistency with existing design
- Consider the target audience (young people and beginners)
- Test on different screen sizes

## 🌍 Accessibility

We're committed to making Flock accessible. We'll be working on:
- WCAG guidelines
- Color contrast
- Language translations
- Clear, simple language
- Keyboard navigation
- Screen reader compatibility

## 💬 Getting Help

- **Discord**: Contact us via [Get in touch](https://flockxr.com/flock-xr-community/) for Discord invite
- **Issues**: Use GitHub issues for bugs and feature requests
- **Discussions**: Use GitHub discussions for questions

## 📜 Code of Conduct

We follow the [p5.js Web Editor Code of Conduct](https://github.com/processing/p5.js-web-editor/blob/develop/.github/CODE_OF_CONDUCT.md). Please be respectful and inclusive.

## 🏷️ Tech Stack

- **JavaScript** (considering TypeScript migration)
- **Babylon.js** - 3D rendering engine
- **Google Blockly** - Visual programming blocks
- **Vite** - Build tool
- **Node.js** - Development environment
- **Progressive Web App** features
- **Mocha & Chai** - Unit testing framework
- **Playwright** - End-to-end testing framework

## 📄 License

Flock XR is licensed under the MIT License. By contributing, you agree that your contributions will be licensed under the same license.

## 🙏 Thank You!

Every contribution helps make 3D programming more accessible to young people worldwide. Thank you for being part of the Flock XR community!

---

**New to open source?** Check out these guides:
- [GitHub's Hello World tutorial](https://guides.github.com/activities/hello-world/)
- [How to fork a repository](https://guides.github.com/activities/forking/)
- [How to create a pull request](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request)
