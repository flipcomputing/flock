# Flock XR

## Overview

Flock XR is a creative coding platform designed to make 3D programming accessible through visual block-based programming. Built as a bridge between Scratch and professional 3D tools like Babylon.js, Unity, and Godot, it enables young people and beginners to create interactive 3D experiences using a drag-and-drop interface.

The platform combines Blockly visual programming with Babylon.js 3D rendering and Havok physics engine to provide a comprehensive 3D creation environment. Users can create characters, animations, scenes, interactive games, and educational simulations through an intuitive block-based interface that generates JavaScript code.

## Recent Changes

### October 2025
- **Colour Picker Internationalization**: Fully internationalized the compact colour picker component (`ui/colourpicker-compact.js`) with translations for all user-facing text including palette names, color names, UI labels, ARIA labels, and tooltips across all 7 supported languages (English, French, Spanish, Swedish, Portuguese, Polish, and German). Added approximately 80 translation keys to each locale file.
  - Fixed dynamic translation update: Added `refreshTranslations()` method to colour picker that updates all text when language changes. Integrated with `setLanguage()` function to ensure colour picker updates in real-time when users switch languages.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Visual Programming Interface**: Built on Google Blockly for drag-and-drop block programming
- **3D Rendering**: Babylon.js engine with WebGL for real-time 3D graphics
- **Physics Simulation**: Havok physics engine integration for realistic object interactions
- **UI Framework**: Babylon.js GUI for in-scene user interface elements
- **Responsive Design**: CSS-based responsive layout supporting various screen sizes

### Block System Design
- **Modular Block Categories**: Organized into logical groups (Events, Scene, Animation, Materials, Physics, etc.)
- **Custom Block Definitions**: JavaScript-based block definitions with input validation
- **Code Generation**: Real-time JavaScript code generation from visual blocks
- **Dynamic Block Behavior**: Blocks with toggleable inline/stacked modes and mutation capabilities

### 3D Engine Integration
- **Scene Management**: Centralized scene creation and management through Babylon.js
- **Asset Pipeline**: Support for GLB/GLTF 3D models with automatic loading and caching
- **Material System**: PBR materials with color, texture, and property controls
- **Animation System**: Keyframe animation support with timeline controls
- **Camera System**: Multiple camera modes including free, attached, and first-person views

### Code Execution Architecture
- **Runtime Environment**: Standalone JavaScript execution environment for generated code
- **API Layer**: Comprehensive JavaScript API wrapping Babylon.js functionality
- **Error Handling**: Graceful error handling and user-friendly error messages
- **Performance Optimization**: Geometry caching, texture reuse, and memory management

### Asset Management
- **3D Model Library**: Curated collection of CC0 3D assets from Quaternius and Kenney.nl
- **Texture System**: Automatic UV mapping and texture application
- **Sound Library**: Built-in audio assets with spatial audio support
- **Resource Loading**: Asynchronous asset loading with progress indication

### Translation System
- **Internationalization**: Multi-language support with translation keys
- **Dynamic Language Switching**: Runtime language changes without page reload
- **Extensible Translation**: Easy addition of new languages through JSON files

## External Dependencies

### Core 3D and Physics
- **Babylon.js**: Primary 3D rendering engine and scene management
- **Havok Physics**: Advanced physics simulation engine
- **earcut**: Polygon triangulation for complex shapes

### Visual Programming
- **Blockly**: Google's visual programming framework
- **Blockly Extensions**: Additional field types and plugins for enhanced functionality

### Development and Build
- **Vite**: Modern build tool and development server
- **Node.js**: Development environment and package management
- **ESLint**: Code quality and consistency enforcement

### Testing Framework
- **Playwright**: End-to-end testing with browser automation
- **Mocha**: Unit testing framework
- **Chai**: Assertion library for testing

### UI and Styling
- **CSS Custom Properties**: Theme system and responsive design
- **Asap Font**: Custom web font for consistent typography
- **Font Awesome**: Icon library for UI elements

### Asset Sources
- **Quaternius**: CC0 3D model assets
- **Kenney.nl**: Additional CC0 game assets and textures
- **Custom Assets**: Proprietary character models and textures