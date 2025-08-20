# flock
**[Flock XR](https://flockxr.com/) - Creative coding in 3D**\
A project from: [Flip Computing](https://flipcomputing.com/).

Current version: [app.flockxr.com](https://app.flockxr.com/)

Our prototype 3D block-based programming language is currently a proof of concept and is under development. Lots of features need more work and may change! We're looking for funding to continue with the work - let us know if you can help or have suggestions. 

Flock XR has been designed as a bridge between Scratch and professional 3D tools, such as Babylon JS, UEFN, Unity and Godot. Flock XR builds on our experience working in schools and clubs to create engaging resources for young people to use and personalise. We are looking for funding to take Flock XR further so please [get in touch](https://flipcomputing.com/contact/) if you can help. 

Flock XR is based on Blockly, the Babylon JS library and the Havok physics engine. It uses CC0 3D assets from [Quaternius](https://quaternius.com/) and [Kenney.nl](https://kenney.nl/) as well as our own assets created in Blender.

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
You can find the tests in the codebase here: `tests/tests.html`

With your npm server running go to: http://localhost:5173/tests/tests.html

Select the tests you want to run from the dropdown and 'Run Tests'.

You should see the tests run.

### Project Structure
This is a Vite-based project using:
- Blockly for visual programming blocks
- Babylon.js for 3D rendering
- Havok physics engine
- Mocha & Chai for testing


### Supporters

The development of Flock XR is supported by grants from [Nlnet Foundation](https://nlnet.nl/project/FlockXR/) and [UK Games Fund](https://www.ukgamesfund.com/funded-project/flock-xr/). 
