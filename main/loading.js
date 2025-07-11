// Function to hide loading screen
export function hideLoadingScreen() {
	const loadingScreen = document.getElementById('loadingScreen');
	const loadingText = document.getElementById('loading-description');
	const body = document.body;

	if (loadingScreen) {
		// Announce completion to screen readers
		if (loadingText) {
			loadingText.textContent = 'Flock XR loaded successfully';
		}

		// First fade out loading screen
		loadingScreen.classList.add('fade-out');

		// Then show main content after a brief delay
		setTimeout(() => {
			body.classList.remove('loading');
		}, 250);

		// Remove loading screen from DOM after transition
		setTimeout(() => {
			if (loadingScreen.parentNode) {
				loadingScreen.parentNode.removeChild(loadingScreen);
			}
		}, 500);
	}
}