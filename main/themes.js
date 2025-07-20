import * as Blockly from "blockly";
import { categoryColours } from "../toolbox.js";
// Function to call when switching themes - implement your Blockly theme logic here
function switchTheme(themeName) {
	console.log(`Switching to theme: ${themeName}`);

	// Create theme object based on your categories
	const themeConfig = createThemeConfig(themeName);
	let currentTheme;

	const workspace = Blockly.getMainWorkspace();

	// Create a proper Blockly Theme instance
	if (workspace && themeConfig) {
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
// Create theme configuration for your specific categories
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
			'events_category': { 'colour': categoryColours.Events },
			'scene_category': { 'colour': categoryColours.Scene },
			'transform_category': { 'colour': categoryColours.Transform },
			'animate_category': { 'colour': categoryColours.Animate },
			'materials_category': { 'colour': categoryColours.Materials },
			'sound_category': { 'colour': categoryColours.Sound },
			'sensing_category': { 'colour': categoryColours.Sensing },
			'snippets_category': { 'colour': categoryColours.Snippets },
			'control_category': { 'colour': categoryColours.Control },
			'logic_category': { 'colour': categoryColours.Logic },
			'variables_category': { 'colour': categoryColours.Variables },
			'text_category': { 'colour': categoryColours.Text },
			'lists_category': { 'colour': categoryColours.Lists },
			'math_category': { 'colour': categoryColours.Math },
			'procedures_category': { 'colour': categoryColours.Procedures }
		},
		'componentStyles': baseStyles.components
	};
}

// Get theme-specific styling
function getThemeBaseStyles(themeName) {
	const themes = {
		light: {
			events: { colourPrimary: '#FF6B6B', colourSecondary: '#FFE0E0', colourTertiary: '#FF4757' },
			scene: { colourPrimary: '#4ECDC4', colourSecondary: '#E0F9F7', colourTertiary: '#26D0CE' },
			transform: { colourPrimary: '#45B7D1', colourSecondary: '#E0F4FF', colourTertiary: '#2E86AB' },
			animate: { colourPrimary: '#F7DC6F', colourSecondary: '#FDF4D3', colourTertiary: '#F4D03F' },
			materials: { colourPrimary: '#BB8FCE', colourSecondary: '#F0E6FF', colourTertiary: '#A569BD' },
			sound: { colourPrimary: '#F8C471', colourSecondary: '#FFF2E0', colourTertiary: '#F5B041' },
			sensing: { colourPrimary: '#85C1E9', colourSecondary: '#E8F4FD', colourTertiary: '#5DADE2' },
			snippets: { colourPrimary: '#82E0AA', colourSecondary: '#E8F8F0', colourTertiary: '#58D68D' },
			control: { colourPrimary: '#FFA726', colourSecondary: '#FFF3E0', colourTertiary: '#FF9800' },
			logic: { colourPrimary: '#42A5F5', colourSecondary: '#E3F2FD', colourTertiary: '#2196F3' },
			variables: { colourPrimary: '#EF5350', colourSecondary: '#FFEBEE', colourTertiary: '#F44336' },
			text: { colourPrimary: '#66BB6A', colourSecondary: '#E8F5E8', colourTertiary: '#4CAF50' },
			lists: { colourPrimary: '#AB47BC', colourSecondary: '#F3E5F5', colourTertiary: '#9C27B0' },
			math: { colourPrimary: '#5C6BC0', colourSecondary: '#E8EAF6', colourTertiary: '#3F51B5' },
			procedures: { colourPrimary: '#26A69A', colourSecondary: '#E0F2F1', colourTertiary: '#009688' },
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

	return themes[themeName] || themes.light;
}

// Update visual indicator of active theme
function updateActiveTheme(themeName) {
	/*themeLinks.forEach(link => {
		link.classList.remove('active-theme');
		if (link.dataset.theme === themeName) {
			link.classList.add('active-theme');
		}
	});*/
}

// Initialize theme on page load
export function initializeTheme() {
	const savedTheme = localStorage.getItem('blocklyTheme') || 'light';
	switchTheme(savedTheme);
	updateActiveTheme(savedTheme);
	//currentTheme = savedTheme;
}

