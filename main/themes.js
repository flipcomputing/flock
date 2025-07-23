import * as Blockly from "blockly";
import { categoryColours } from "../toolbox.js";

// Function to call when switching themes
function switchTheme(themeName) {
	console.log(`Switching to theme: ${themeName}`);

	document.body.setAttribute('data-theme', themeName);

	const workspace = Blockly.getMainWorkspace();

	if (!workspace) return;

	// Set HSV values based on theme
	if (themeName === 'light') {
		Blockly.utils.colour.setHsvSaturation(0.3);
		Blockly.utils.colour.setHsvValue(0.85);
	} else if (themeName === 'dark') {
		// For dark theme, use slightly more saturated colors
		Blockly.utils.colour.setHsvSaturation(0.45);
		Blockly.utils.colour.setHsvValue(0.65);
	} else if (themeName === 'high-contrast') {
		// High contrast uses full saturation and value
		Blockly.utils.colour.setHsvSaturation(0.99);
		Blockly.utils.colour.setHsvValue(0.99);
	}

	// Create custom theme for all themes
	const themeConfig = createThemeConfig(themeName);
	if (themeConfig) {
		const blocklyTheme = new Blockly.Theme(
			themeConfig.name,
			themeConfig.blockStyles,
			themeConfig.categoryStyles,
			themeConfig.componentStyles
		);
		workspace.setTheme(blocklyTheme);
	}

	// Optional: Save theme preference
	localStorage.setItem('blocklyTheme', themeName);
}

// Create theme configuration for all themes
function createThemeConfig(themeName) {
	const baseStyles = getThemeBaseStyles(themeName);

	return {
		'name': themeName,
		'base': Blockly.Themes.Classic,
		'blockStyles': {
			'events_blocks': baseStyles.events,
			'scene_blocks': baseStyles.scene,
			'transform_blocks': baseStyles.transform,
			'animate_blocks': baseStyles.animate,
			'materials_blocks': baseStyles.materials,
			'sound_blocks': baseStyles.sound,
			'sensing_blocks': baseStyles.sensing,
			'snippets_blocks': baseStyles.snippets,
			'control_blocks': baseStyles.control,
			'logic_blocks': baseStyles.logic,
			'variable_blocks': baseStyles.variables,
			'text_blocks': baseStyles.text,
			'list_blocks': baseStyles.lists,
			'math_blocks': baseStyles.math,
			'procedure_blocks': baseStyles.procedures
		},
		'categoryStyles': {
			'events_category': { 'colour': getColourForTheme(themeName, 'Events') },
			'scene_category': { 'colour': getColourForTheme(themeName, 'Scene') },
			'transform_category': { 'colour': getColourForTheme(themeName, 'Transform') },
			'animate_category': { 'colour': getColourForTheme(themeName, 'Animate') },
			'materials_category': { 'colour': getColourForTheme(themeName, 'Materials') },
			'sound_category': { 'colour': getColourForTheme(themeName, 'Sound') },
			'sensing_category': { 'colour': getColourForTheme(themeName, 'Sensing') },
			'snippets_category': { 'colour': getColourForTheme(themeName, 'Snippets') },
			'control_category': { 'colour': getColourForTheme(themeName, 'Control') },
			'logic_category': { 'colour': getColourForTheme(themeName, 'Logic') },
			'variables_category': { 'colour': getColourForTheme(themeName, 'Variables') },
			'text_category': { 'colour': getColourForTheme(themeName, 'Text') },
			'lists_category': { 'colour': getColourForTheme(themeName, 'Lists') },
			'math_category': { 'colour': getColourForTheme(themeName, 'Math') },
			'procedures_category': { 'colour': getColourForTheme(themeName, 'Procedures') }
		},
		'componentStyles': baseStyles.components
	};
}

// Helper function to get colors for categories based on theme
function getColourForTheme(themeName, category) {
	if (themeName === 'light') {
		return categoryColours[category] || 20; // fallback hue
	} else {
		const styles = getThemeBaseStyles(themeName);
		const blockStyle = styles[category.toLowerCase()];
		return blockStyle?.colourPrimary || categoryColours[category] || 20;
	}
}

// Get theme-specific styling 
function getThemeBaseStyles(themeName) {
	const themes = {
		light: {
			// For light theme, use consistent structure with colourPrimary
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
			lists: { colourPrimary: categoryColours.Lists || 260 },
			math: { colourPrimary: categoryColours.Math || 230 },
			procedures: { colourPrimary: categoryColours.Procedures || 290 },
			components: {
				workspaceBackgroundColour: '#f9f9f9',
				toolboxBackgroundColour: '#fff',
				toolboxForegroundColour: '#444',
				flyoutBackgroundColour: '#f9f9f9',
				flyoutForegroundColour: '#ccc',
				flyoutOpacity: 1,
				scrollbarColour: '#797979',
				insertionMarkerColour: '#000',
				insertionMarkerOpacity: 0.3
			}
		},
		dark: {
			events: { colourPrimary: '#E74C3C', colourSecondary: '#C0392B', colourTertiary: '#A93226' },
			scene: { colourPrimary: '#1ABC9C', colourSecondary: '#16A085', colourTertiary: '#138D75' },
			transform: { colourPrimary: '#3498DB', colourSecondary: '#2980B9', colourTertiary: '#2471A3' },
			animate: { colourPrimary: '#F1C40F', colourSecondary: '#D4AC0D', colourTertiary: '#B7950B' },
			materials: { colourPrimary: '#9B59B6', colourSecondary: '#8E44AD', colourTertiary: '#7D3C98' },
			sound: { colourPrimary: '#E67E22', colourSecondary: '#D35400', colourTertiary: '#BA4A00' },
			sensing: { colourPrimary: '#5DADE2', colourSecondary: '#3498DB', colourTertiary: '#2980B9' },
			snippets: { colourPrimary: '#58D68D', colourSecondary: '#27AE60', colourTertiary: '#229954' },
			control: { colourPrimary: '#FF8F00', colourSecondary: '#E65100', colourTertiary: '#BF360C' },
			logic: { colourPrimary: '#2196F3', colourSecondary: '#1976D2', colourTertiary: '#1565C0' },
			variables: { colourPrimary: '#F44336', colourSecondary: '#D32F2F', colourTertiary: '#C62828' },
			text: { colourPrimary: '#4CAF50', colourSecondary: '#388E3C', colourTertiary: '#2E7D32' },
			lists: { colourPrimary: '#9C27B0', colourSecondary: '#7B1FA2', colourTertiary: '#6A1B9A' },
			math: { colourPrimary: '#3F51B5', colourSecondary: '#303F9F', colourTertiary: '#283593' },
			procedures: { colourPrimary: '#009688', colourSecondary: '#00796B', colourTertiary: '#00695C' },
			components: {
				workspaceBackgroundColour: '#1e1e1e',
				toolboxBackgroundColour: '#333',
				toolboxForegroundColour: '#fff',
				flyoutBackgroundColour: '#252526',
				flyoutForegroundColour: '#ccc',
				flyoutOpacity: 0.95,
				scrollbarColour: '#797979',
				insertionMarkerColour: '#fff',
				insertionMarkerOpacity: 0.3,
				markerColour: '#fff',
				cursorColour: '#d0d0d0'
			}
		},
		'high-contrast': {
			events: { colourPrimary: '#FF0000', colourSecondary: '#FFFFFF', colourTertiary: '#CC0000' },
			scene: { colourPrimary: '#00FFFF', colourSecondary: '#FFFFFF', colourTertiary: '#00CCCC' },
			transform: { colourPrimary: '#0000FF', colourSecondary: '#FFFFFF', colourTertiary: '#0000CC' },
			animate: { colourPrimary: '#FFFF00', colourSecondary: '#000000', colourTertiary: '#CCCC00' },
			materials: { colourPrimary: '#FF00FF', colourSecondary: '#FFFFFF', colourTertiary: '#CC00CC' },
			sound: { colourPrimary: '#FFA500', colourSecondary: '#000000', colourTertiary: '#CC8400' },
			sensing: { colourPrimary: '#00BFFF', colourSecondary: '#FFFFFF', colourTertiary: '#0099CC' },
			snippets: { colourPrimary: '#00FF00', colourSecondary: '#000000', colourTertiary: '#00CC00' },
			control: { colourPrimary: '#FF8000', colourSecondary: '#FFFFFF', colourTertiary: '#CC6600' },
			logic: { colourPrimary: '#4080FF', colourSecondary: '#FFFFFF', colourTertiary: '#3366CC' },
			variables: { colourPrimary: '#FF4040', colourSecondary: '#FFFFFF', colourTertiary: '#CC3333' },
			text: { colourPrimary: '#40FF40', colourSecondary: '#000000', colourTertiary: '#33CC33' },
			lists: { colourPrimary: '#BF40BF', colourSecondary: '#FFFFFF', colourTertiary: '#993399' },
			math: { colourPrimary: '#4040BF', colourSecondary: '#FFFFFF', colourTertiary: '#333399' },
			procedures: { colourPrimary: '#40BFBF', colourSecondary: '#FFFFFF', colourTertiary: '#339999' },
			components: {
				workspaceBackgroundColour: '#FFFFFF',
				toolboxBackgroundColour: '#000000',
				toolboxForegroundColour: '#FFFFFF',
				flyoutBackgroundColour: '#F0F0F0',
				flyoutForegroundColour: '#000000',
				flyoutOpacity: 1,
				scrollbarColour: '#000000',
				insertionMarkerColour: '#FF0000',
				insertionMarkerOpacity: 1,
				markerColour: '#FF0000',
				cursorColour: '#FF0000'
			}
		}
	};

	return themes[themeName];
}

// Update visual indicator of active theme
function updateActiveTheme(themeName) {
	const themeLinks = document.querySelectorAll('[data-theme-target]');
	themeLinks.forEach(link => {
		link.classList.remove('active-theme');
		if (link.dataset.theme === themeName) {
			link.classList.add('active-theme');
		}
	});
}

// Initialize theme on page load
export function initializeTheme() {
	const themeLinks = document.querySelectorAll('[data-theme-target]');
	let currentTheme = 'light'; // Default to light

	// Register block styles for all themes
	registerBlockStyles();

	themeLinks.forEach(link => {
		link.addEventListener('click', (e) => {
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
	const savedTheme = localStorage.getItem('blocklyTheme') || 'light';
	switchTheme(savedTheme);
	updateActiveTheme(savedTheme);
	currentTheme = savedTheme;
}


// Register all block styles with Blockly
function registerBlockStyles() {
	const blockStyleConfigs = {
		'events_blocks': { 'hat': 'cap' },
		'scene_blocks': {},
		'transform_blocks': {},
		'animate_blocks': {},
		'materials_blocks': {},
		'sound_blocks': {},
		'sensing_blocks': {},
		'snippets_blocks': {},
		'control_blocks': {},
		'logic_blocks': {},
		'variable_blocks': {},
		'text_blocks': {},
		'list_blocks': {},
		'math_blocks': {},
		'procedure_blocks': { 'hat': 'cap' }
	};

	// Register each style - these will be overridden by theme colors
	Object.entries(blockStyleConfigs).forEach(([styleName, styleConfig]) => {
		if (!Blockly.registry.getObject('blockStyles', styleName)) {
			Blockly.registry.register('blockStyles', styleName, styleConfig);
		}
	});
}