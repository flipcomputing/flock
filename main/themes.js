import * as Blockly from "blockly";

export const categoryColours = {
        Events: 5,
        Scene: 85,
        Transform: 65,
        Animate: 45,
        Materials: 280,
        Sound: 25,
        Sensing: 180,
        Snippets: 200,
        Control: "%{BKY_LOOPS_HUE}",
        Logic: "%{BKY_LOGIC_HUE}",
        Variables: "%{BKY_VARIABLES_HUE}",
        Text: "%{BKY_TEXTS_HUE}",
        Lists: "%{BKY_LISTS_HUE}",
        Math: "%{BKY_MATH_HUE}",
        Procedures: "%{BKY_PROCEDURES_HUE}",
};

// Original AAA palette (Zishan Rahman)
export const contrastCategoryColoursAAA = {
        Events: "#734a4e",
        Scene: "#0d5c00",
        Transform: "#343ddb",
        Animate: "#a71c4e",
        Materials: "#7211b6",
        Sound: "#ab0046",
        Sensing: "#4e5a00",
        Snippets: "#1c457f",
        Control: "#970097",
        Logic: "#0000ff",
        Variables: "#002c2b",
        Text: "#5545be",
        Lists: "%{BKY_VARIABLES_HUE}",
        Math: "#3f0000",
        Procedures: "#8a24a5",
};

// Becky's AA palette (Rebecca Franks)
export const contrastCategoryColoursAA = {
        Events: "#913a34",
        Scene: "#5e7b33",
        Transform: "#77792e",
        Animate: "#8b7234",
        Materials: "#793298",
        Sound: "#995f3a",
        Sensing: "#2d787c",
        Snippets: "#387091",
        Control: "#308332",
        Logic: "#0000ff",
        Variables: "#963065",
        Text: "#30826b",
        Lists: "%{BKY_VARIABLES_HUE}",
        Math: "#2e3987",
        Procedures: "#83398f",
};

// Revised Becky's palette to also pass AAA tests (Rebecca Franks, Zishan Rahman)
export const contrastCategoryColours = {
        Events: "#913a34",
        Scene: "#315f3a",
        Transform: "#8b4700",
        Animate: "#734a4e",
        Materials: "#793298",
        Sound: "#99303a",
        Sensing: "#2d5896",
        Snippets: "#385891",
        Control: "#135f17",
        Logic: "#18387b",
        Variables: "#963065",
        Text: "#5545be",
        Lists: "%{BKY_VARIABLES_HUE}",
        Math: "#2e3987",
        Procedures: "#83398f",
};

function setLogos(themeName) {
        const bird = document.getElementById("logo");
        const inlineLogo = document.getElementById("flocklogo");
        switch (themeName) {
                case "dark-contrast":
                        inlineLogo.src = "./images/inline-flock-xr-dark1.svg";
                        bird.src = "./images/flock-bird-mascot-2colours-dark1.svg";
                        break;

                case "dark":
                        inlineLogo.src = "./images/inline-flock-xr-dark2.svg";
                        bird.src = "./images/flock-bird-mascot-2colours-dark2.svg";
                        break;

                case "contrast":
                        inlineLogo.src = "./images/inline-flock-xr-white.svg";
                        bird.src = "./images/flock-bird-mascot-2colours.svg";
                        break;

                default:
                        inlineLogo.src = "./images/inline-flock-xr.svg";
                        bird.src = "./images/flock-bird-mascot.svg";
                        break;
        };
}

// Function to call when switching themes
function switchTheme(themeName) {
        console.log(`Switching to theme: ${themeName}`);

        document.body.setAttribute("data-theme", themeName);

        const workspace = Blockly.getMainWorkspace();

        if (!workspace) return;

        Blockly.utils.colour.setHsvSaturation(0.3);
        Blockly.utils.colour.setHsvValue(0.85);

        // // Set HSV values based on theme
        // if (["light", "dark"].includes(themeName)) {
        //         // For dark theme, use same saturation/value as light theme
        //         Blockly.utils.colour.setHsvSaturation(0.3);
        //         Blockly.utils.colour.setHsvValue(0.85);
        // } else if (["contrast", "dark-contrast"].includes(themeName)) {
        //         // Contrast theme now uses more saturated colors like the old dark theme
        //         Blockly.utils.colour.setHsvSaturation(0.525);
        //         Blockly.utils.colour.setHsvValue(0.65);
        // }

        setLogos(themeName);

        // Create custom theme for all themes
        const themeConfig = createThemeConfig(themeName);
        if (themeConfig) {
                const blocklyTheme = new Blockly.Theme(
                        themeConfig.name,
                        themeConfig.blockStyles,
                        themeConfig.categoryStyles,
                        themeConfig.componentStyles,
                );
                workspace.setTheme(blocklyTheme);
        }

        workspace.updateToolbox(workspace.options.languageTree);
        // Optional: Save theme preference
        localStorage.setItem("blocklyTheme", themeName);
}

// Create theme configuration for all themes
export function createThemeConfig(themeName) {
        const baseStyles = getThemeBaseStyles(themeName);

        return {
                name: themeName,
                base: Blockly.Themes.Classic,
                blockStyles: {
                        events_blocks: baseStyles.events,
                        scene_blocks: baseStyles.scene,
                        transform_blocks: baseStyles.transform,
                        animate_blocks: baseStyles.animate,
                        materials_blocks: baseStyles.materials,
                        sound_blocks: baseStyles.sound,
                        sensing_blocks: baseStyles.sensing,
                        snippets_blocks: baseStyles.snippets,
                        control_blocks: baseStyles.control,
                        logic_blocks: baseStyles.logic,
                        variable_blocks: baseStyles.variables,
                        text_blocks: baseStyles.text,
                        list_blocks: baseStyles.variables,
                        math_blocks: baseStyles.math,
                        procedure_blocks: baseStyles.procedures,
                },
                categoryStyles: {
                        events_category: { colour: baseStyles.events.colourPrimary },
                        scene_category: { colour: baseStyles.scene.colourPrimary },
                        transform_category: { colour: baseStyles.transform.colourPrimary },
                        animate_category: { colour: baseStyles.animate.colourPrimary },
                        materials_category: { colour: baseStyles.materials.colourPrimary },
                        sound_category: { colour: baseStyles.sound.colourPrimary },
                        sensing_category: { colour: baseStyles.sensing.colourPrimary },
                        snippets_category: { colour: baseStyles.snippets.colourPrimary },
                        control_category: { colour: baseStyles.control.colourPrimary },
                        logic_category: { colour: baseStyles.logic.colourPrimary },
                        variables_category: { colour: baseStyles.variables.colourPrimary },
                        text_category: { colour: baseStyles.text.colourPrimary },
                        lists_category: { colour: baseStyles.lists.colourPrimary },
                        math_category: { colour: baseStyles.math.colourPrimary },
                        procedures_category: {
                                colour: baseStyles.procedures.colourPrimary,
                        },
                },
                componentStyles: baseStyles.components,
        };
}

// Get theme-specific styling
function getThemeBaseStyles(themeName) {
        const themes = {
                light: {
                        // For light theme, use consistent structure with colourPrimary
                        events: { colourPrimary: categoryColours.Events || 20,  colourText: "#000000" },
                        scene: { colourPrimary: categoryColours.Scene || 160, colourText: "#000000" },
                        transform: { colourPrimary: categoryColours.Transform || 210 },
                        animate: { colourPrimary: categoryColours.Animate || 60 },
                        materials: { colourPrimary: categoryColours.Materials || 290 },
                        sound: { colourPrimary: categoryColours.Sound || 30 },
                        sensing: { colourPrimary: categoryColours.Sensing || 200 },
                        snippets: { colourPrimary: categoryColours.Snippets || 120 },
                        control: { colourPrimary: categoryColours.Control || 25 },
                        logic: { colourPrimary: categoryColours.Logic || 210 },
                        variables: { colourPrimary: categoryColours.Variables || 330 },
                        text: { colourPrimary: categoryColours.Text || 160 },
                        lists: { colourPrimary: categoryColours.Variables || 330 },
                        math: { colourPrimary: categoryColours.Math || 230 },
                        procedures: { colourPrimary: categoryColours.Procedures || 290 },
                        components: {
                                workspaceBackgroundColour: "#f9f9f9",
                                toolboxBackgroundColour: "#fff",
                                toolboxForegroundColour: "#444",
                                flyoutBackgroundColour: "#f9f9f9",
                                flyoutForegroundColour: "#ccc",
                                flyoutOpacity: 1,
                                scrollbarColour: "#797979",
                                insertionMarkerColour: "#000",
                                insertionMarkerOpacity: 0.3,
                        },
                },
                dark: {
                        // Dark theme now uses the same block colors as light theme
                        events: { colourPrimary: categoryColours.Events || 20 },
                        scene: { colourPrimary: categoryColours.Scene || 160 },
                        transform: { colourPrimary: categoryColours.Transform || 210 },
                        animate: { colourPrimary: categoryColours.Animate || 60 },
                        materials: { colourPrimary: categoryColours.Materials || 290 },
                        sound: { colourPrimary: categoryColours.Sound || 30 },
                        sensing: { colourPrimary: categoryColours.Sensing || 200 },
                        snippets: { colourPrimary: categoryColours.Snippets || 120 },
                        control: { colourPrimary: categoryColours.Control || 25 },
                        logic: { colourPrimary: categoryColours.Logic || 210 },
                        variables: { colourPrimary: categoryColours.Variables || 330 },
                        text: { colourPrimary: categoryColours.Text || 160 },
                        lists: { colourPrimary: categoryColours.Variables || 330 },
                        math: { colourPrimary: categoryColours.Math || 230 },
                        procedures: { colourPrimary: categoryColours.Procedures || 290 },
                        components: {
                                workspaceBackgroundColour: "#1e1e1e",
                                toolboxBackgroundColour: "#333",
                                toolboxForegroundColour: "#fff",
                                flyoutBackgroundColour: "#252526",
                                flyoutForegroundColour: "#ccc",
                                flyoutOpacity: 0.95,
                                scrollbarColour: "#797979",
                                insertionMarkerColour: "#fff",
                                insertionMarkerOpacity: 0.3,
                                markerColour: "#fff",
                                cursorColour: "#d0d0d0",
                                fieldColour: "#1e1e1e",
                                fieldTextColour: "#000000",
                        },
                },
                contrast: {
                        // High contrast theme now uses the same block colors as default light theme
                        events: { colourPrimary: contrastCategoryColours.Events },
                        scene: { colourPrimary: contrastCategoryColours.Scene },
                        transform: { colourPrimary: contrastCategoryColours.Transform },
                        animate: { colourPrimary: contrastCategoryColours.Animate },
                        materials: { colourPrimary: contrastCategoryColours.Materials },
                        sound: { colourPrimary: contrastCategoryColours.Sound },
                        sensing: { colourPrimary: contrastCategoryColours.Sensing },
                        snippets: { colourPrimary: contrastCategoryColours.Snippets },
                        control: { colourPrimary: contrastCategoryColours.Control },
                        logic: { colourPrimary: contrastCategoryColours.Logic },
                        variables: { colourPrimary: contrastCategoryColours.Variables },
                        text: { colourPrimary: contrastCategoryColours.Text },
                        lists: { colourPrimary: contrastCategoryColours.Lists },
                        math: { colourPrimary: contrastCategoryColours.Math },
                        procedures: { colourPrimary: contrastCategoryColours.Procedures },
                        components: {
                                workspaceBackgroundColour: "#FFFFFF",
                                toolboxBackgroundColour: "#000000",
                                toolboxForegroundColour: "#FFFFFF",
                                flyoutBackgroundColour: "#F0F0F0",
                                flyoutForegroundColour: "#000000",
                                flyoutOpacity: 1,
                                scrollbarColour: "#000000",
                                insertionMarkerColour: "#FF0000",
                                insertionMarkerOpacity: 1,
                                markerColour: "#FF0000",
                                cursorColour: "#FF0000",
                        },
                },
                "dark-contrast": {
                        // High contrast dark theme now uses the same block colors as default light theme
                        events: { colourPrimary: contrastCategoryColours.Events },
                        scene: { colourPrimary: contrastCategoryColours.Scene },
                        transform: { colourPrimary: contrastCategoryColours.Transform },
                        animate: { colourPrimary: contrastCategoryColours.Animate },
                        materials: { colourPrimary: contrastCategoryColours.Materials },
                        sound: { colourPrimary: contrastCategoryColours.Sound },
                        sensing: { colourPrimary: contrastCategoryColours.Sensing },
                        snippets: { colourPrimary: contrastCategoryColours.Snippets },
                        control: { colourPrimary: contrastCategoryColours.Control },
                        logic: { colourPrimary: contrastCategoryColours.Logic },
                        variables: { colourPrimary: contrastCategoryColours.Variables },
                        text: { colourPrimary: contrastCategoryColours.Text },
                        lists: { colourPrimary: contrastCategoryColours.Lists },
                        math: { colourPrimary: contrastCategoryColours.Math },
                        procedures: { colourPrimary: contrastCategoryColours.Procedures },
                        components: {
                                workspaceBackgroundColour: "#FFFFFF",
                                toolboxBackgroundColour: "#000000",
                                toolboxForegroundColour: "#FFFFFF",
                                flyoutBackgroundColour: "#F0F0F0",
                                flyoutForegroundColour: "#000000",
                                flyoutOpacity: 1,
                                scrollbarColour: "#000000",
                                insertionMarkerColour: "#FF0000",
                                insertionMarkerOpacity: 1,
                                markerColour: "#FF0000",
                                cursorColour: "#FF0000",
                        },
                },
        };

        return themes[themeName];
}

// Update visual indicator of active theme
function updateActiveTheme(themeName) {
        const themeLinks = document.querySelectorAll("[data-theme-target]");
        themeLinks.forEach((link) => {
                link.classList.remove("active-theme");
                if (link.dataset.themeTarget === themeName) {
                        link.classList.add("active-theme");
                }
        });
}

// Initialize theme on page load
export function initializeTheme() {
        const themeLinks = document.querySelectorAll("[data-theme-target]");
        let currentTheme = "light"; // Default to light

        themeLinks.forEach((link) => {
                link.addEventListener("click", (e) => {
                        e.preventDefault();
                        const newTheme = link.dataset.themeTarget;

                        if (newTheme !== currentTheme) {
                                switchTheme(newTheme);
                                updateActiveTheme(newTheme);
                                currentTheme = newTheme;
                        }
                });
        });

        // Load saved theme or default to light
        const savedTheme = localStorage.getItem("blocklyTheme") || "light";
        switchTheme(savedTheme);
        updateActiveTheme(savedTheme);
        currentTheme = savedTheme;
}

// Register category styles with Blockly before workspace creation
function registerCategoryStyles() {
        // Use light theme as default for initial registration
        const lightStyles = getThemeBaseStyles("light");

        const categoryStyles = {
                events_category: { colour: lightStyles.events.colourPrimary },
                scene_category: { colour: lightStyles.scene.colourPrimary },
                transform_category: { colour: lightStyles.transform.colourPrimary },
                animate_category: { colour: lightStyles.animate.colourPrimary },
                materials_category: { colour: lightStyles.materials.colourPrimary },
                sound_category: { colour: lightStyles.sound.colourPrimary },
                sensing_category: { colour: lightStyles.sensing.colourPrimary },
                snippets_category: { colour: lightStyles.snippets.colourPrimary },
                control_category: { colour: lightStyles.control.colourPrimary },
                logic_category: { colour: lightStyles.logic.colourPrimary },
                variables_category: { colour: lightStyles.variables.colourPrimary },
                text_category: { colour: lightStyles.text.colourPrimary },
                lists_category: { colour: lightStyles.lists.colourPrimary },
                math_category: { colour: lightStyles.math.colourPrimary },
                procedures_category: { colour: lightStyles.procedures.colourPrimary },
        };

        // Register each category style
        Object.entries(categoryStyles).forEach(([styleName, styleConfig]) => {
                try {
                        // Just register directly without checking if it exists
                        Blockly.registry.register("categoryStyles", styleName, styleConfig);
                } catch (error) {
                        // Only warn if it's not an "already exists" error
                        if (!error.message.includes("already registered")) {
                                console.warn(
                                        `Failed to register category style ${styleName}:`,
                                        error,
                                );
                        }
                }
        });
}

registerCategoryStyles();
