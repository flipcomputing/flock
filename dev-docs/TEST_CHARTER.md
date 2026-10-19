# Flock XR Test Charter: Cross-Platform Testing

## 1. Purpose and scope

Flock XR is a block-based 3D and XR creative coding environment that runs in the browser. Its users are mostly learners in schools and at home, and they use a very wide range of hardware: managed Windows laptops and Chromebooks, iPads, family Android phones, low-cost devices such as the Raspberry Pi, and VR headsets.

The same project can behave differently on each of these. Browser engines (Blink, WebKit, Gecko) differ in WebGL/WebGPU support, audio policies, pointer and touch events, memory limits and WebXR support. GPUs range from integrated low-end chips to standalone headset SoCs. Input ranges from keyboard and mouse to touch, gamepad and XR controllers.

This charter sets out how we find and control those differences:

- Which devices and browsers we test on, in priority order, and why.
- How manual, automated and classroom testing divide the work, and who is responsible for each.
- What triggers testing, which builds are tested, and how results are recorded.

In scope: the Flock XR editor and runtime (block editing, code generation, the 3D scene, physics, sound, input, file save/load, XR, micro:bit), keyboard accessibility and contrast, and performance on low-end hardware.

Out of scope:

- Third-party services Flock links to.
- Hand-written JavaScript against the Flock API, which is not yet a supported way of using Flock.
- Full screen reader support, which Flock does not yet officially provide. NVDA testing is done on a best-effort basis.

## 2. Roles and responsibilities

| Role | Responsibilities |
| --- | --- |
| Maintainer | Allocates cross-platform testing across the matrix for each release; signs off cross-platform testing and the release |
| Contributors | Run the automated suites for their changes; raise an issue for any failure outside the area they are working on |
| Classroom pilot lead (Rebecca Franks) | Runs classroom pilots and identifies practical limitations in school environments (section 6) |

## 3. Approach

Testing has three complementary parts: manual cross-platform testing, automated regression testing and classroom pilot testing.

### 3.1 Test environments

| Build | Used for |
| --- | --- |
| Local build | Automated suites, run by each developer. Local environments vary between developers. |
| Development release (GitHub Pages) | Manual cross-platform testing |
| Release candidate (Cloudflare) | Final checks before release |

Manual testing uses deployed builds rather than the local dev server, because some behaviour differs on the dev server.

### 3.2 Manual cross-platform testing

Platform-specific behaviour (rendering, input, audio, performance, XR) can only be confirmed reliably on real hardware. Manual cross-platform testing is carried out for each release.

- **Physical devices:** the core team keeps a set of devices that covers the Priority 1 matrix entries (section 4) and tests on them directly.
- **BrowserStack:** mobile and tablet entries we don't own (for example, specific iPhone and Android models and OS versions) are tested on BrowserStack's remote real devices. Emulators and desktop device emulation are not a substitute: we have seen behaviour that appears only in emulation and not on the real device, and the reverse.

Manual testing follows the project's manual test checklist, with emphasis on the risk areas for the platform under test (section 5).

### 3.3 Automated regression testing

Automated suites guard behaviour that doesn't depend on platform and catch regressions early. They run headless in Chromium.

| Suite | Command | Covers |
| --- | --- | --- |
| API tests (Mocha, in browser) | `npm run test:api [suite or @tag]` | Flock API: scene, shapes, transforms, physics, materials, sound, sensing, animation, XR export, sandbox and security |
| Fast or slow subsets | `npm run test:api @notslow` / `@onlyslow` | All fast tests / all slow tests |
| Gizmos | `npm run test:gizmos` | Editing gizmos and initial transforms |
| Input | `npm run test:input` | Keyboard, gamepad, joystick, on-screen and XR input sources and bindings |
| micro:bit | `npm run test:microbit` | micro:bit integration |
| UI and end-to-end (Playwright) | `npx playwright test` | Menus, toolbox and workspace search, example loading, play-mode layout, themes, accessibility labels, visual snapshots |
| Targeted checks | `npm run test:csp-smoke`, `test:context-menu`, `test:canvas-buffer`, `test:xr-teleport`, `test:xr-diorama` | Content Security Policy, keyboard context menu, canvas buffer, XR teleport and diorama |
| Static checks | `npm run lint`, `npm run format:check` | Lint rules, link security, formatting |

CI on GitHub Actions currently runs lint, formatting and a smoke subset of the API tests on every push and pull request. The full suites are run locally by contributors (see 3.4).

See [README_TOOLS.md](../README_TOOLS.md) and [API_QUALITY_TOOLS.md](API_QUALITY_TOOLS.md) for runner options, and `npm run docs:matrix` for the API test coverage matrix.

### 3.4 Contributor expectations

- **When changing behaviour:** run the suites for the area you changed, and update or add tests in the same change so the suite keeps describing current behaviour. A failing test is investigated, never dismissed as "pre-existing". If the failure is outside the area you are working on, raise an issue.
- **Before submitting a significant change:** run the whole automated suite (API fast and slow, gizmos, input, Playwright and the targeted checks). A change is significant if it touches any of the following:
  - input handling, the camera or controls
  - rendering, materials or the scene lifecycle
  - physics
  - sound
  - XR
  - file save/load or project format
  - block definitions or code generation
  - build, dependency or Babylon.js upgrades

## 4. Test matrix

| Priority | Device / OS | Browsers | Why it's in the matrix |
| --- | --- | --- | --- |
| 1 | Windows 11 | Chrome, Edge | Most common platform in schools |
| 1 | Chromebook (ChromeOS) | Chrome | Common in schools; often low-spec hardware |
| 1 | iPad (iPadOS) | Safari, Chrome | Common in schools; all iPadOS browsers use WebKit; touch-first |
| 1 | Android phone | Chrome | Common at home; small screen, touch, varied GPUs |
| 1 | Meta Quest 3 | Meta Quest Browser | Most common standalone VR headset; main WebXR target |
| 1 | Mac (macOS) | Chrome, Safari | Lower-cost MacBook Neo makes Macs more likely in schools; Safari is WebKit on desktop |
| 2 | iPhone (current, e.g. 16/17) | Safari, Chrome | Common among educators; WebKit on a small touch screen |
| 2 | Raspberry Pi (Raspberry Pi OS) | Chromium | Low-cost device; tests performance on minimal hardware |
| 2 | Android tablet | Chrome | Common at home; tablet layout on Android |
| 3 | Endless OS | Chromium, GNOME Web | Open education OS; GNOME Web is WebKitGTK |
| 3 | Windows 11 | Firefox | Different browser engine (Gecko) |
| 3 | iPhone (older, e.g. SE/12) | Safari | Old but still common; memory and performance limits |

Priority reflects how widely each platform is used by our learners and educators, and sets the order in which platforms are covered when testing a release.

Matrix entries mean the current stable browser on a currently supported OS version, unless an entry says otherwise. The matrix is reviewed when usage data or school feedback suggests a change.

## 5. Platform risk areas

These are the main ways platforms differ, and where manual testing concentrates.

| Area | Platforms most at risk |
| --- | --- |
| Touch and pointer input | iPad, iPhone, Android, touchscreen Chromebooks |
| Keyboard input and accessibility | Windows, Mac, Chromebook |
| WebKit engine differences (rendering, audio, file handling, memory) | iPadOS, iOS, Mac Safari, GNOME Web |
| Performance on low-end hardware | Chromebook, Raspberry Pi, older iPhone, budget Android |
| GPU driver bugs on specific devices | Android phones, which use a wide range of GPUs and drivers |
| WebXR | Meta Quest headsets, Android phones |
| Screen size and layout | Phones, small Chromebooks |
| Gecko engine differences | Firefox |

## 6. Classroom pilot testing

Flock XR is piloted in classrooms to find practical limitations of school environments that device testing does not reveal. Rebecca Franks is responsible for classroom pilots and for identifying these limitations.

The usual finding is that a school's web filter must whitelist Flock's URL. Other limitations found in schools:

- **Storage:** local storage often does not persist between sessions on school devices, so autosave cannot be relied on to keep work between lessons.
- **micro:bit connection:** Bluetooth may not be available for the micro:bit HID extension (which pairs the micro:bit as a Bluetooth keyboard), and USB connection may need setting up by the school.

## 7. When to test and sign-off

- **Every change:** automated suites for the affected area.
- **Significant changes:** the whole automated suite.
- **Releases:** the whole automated suite, then manual testing of the development release across the matrix in priority order, then final checks on the release candidate.

The maintainer signs off cross-platform testing, then the release. Open test failures do not automatically block a release: the maintainer decides whether a release goes ahead with them, and any resulting limitations are noted in the release notes.

## 8. Recording results

For manual test sessions, use the cross-platform testing spreadsheet for that release. Record the device, OS and browser versions, the Flock XR version, and whether a physical device or BrowserStack was used. Notes can be added in the spreadsheet as comments. Failures are raised as GitHub issues or tracked as part of an umbrella issue for the release. Release test results are summarised in the release tracking issue, giving a record of platform coverage over time.

## 9. Risks and constraints

- **Platform variation:** there are too many combinations of OS, OS version, device and browser to test them all. The matrix covers the most widely used platforms; issues elsewhere are found through classroom pilots and user reports.
- **GPU drivers:** some rendering faults appear only with a particular device's GPU driver, so they are found only by testing on that device. For example, cross-platform testing found that on a Samsung Galaxy A14, meshes using transparency rendered black. The cause was uniform buffer handling, and uniform buffers are now disabled on all devices; the effect on performance still needs testing.
- **XR hardware:** XR testing is limited to Meta Quest headsets (tested on Quest 1, 2 and 3) and Android phones. Other headsets are not tested.
- **Automated test coverage:** the automated suites run in headless Chromium, so they don't detect differences specific to other browser engines or real hardware, and results can vary with each developer's local environment.

## 10. Known platform differences

Accepted differences that are not bugs, or are tracked separately.

| Platform | Difference | Status |
| --- | --- | --- |
| iOS, iPadOS | WebXR is not available, so VR and AR modes cannot be entered | Platform limitation |
| Firefox, Safari, all iOS and iPadOS browsers | micro:bit USB connection is unavailable because it uses WebUSB, which only Chromium-based browsers support. The Bluetooth HID extension, which acts as a keyboard, is not affected. | Platform limitation |
| Firefox, Safari, all mobile browsers | The colour picker's "pick colour from screen" eyedropper is unavailable because the browser does not support the EyeDropper API | Platform limitation; the button is hidden on mobile and shows an explanation on desktop |
| Mobile phones | The Babylon.js inspector is not available because its layout does not fit phone screens | By design |
| All | Text-to-speech voices, and which languages have a voice, depend on the OS | Platform limitation |
