export function setupInput(){

	// Get the canvas element
	const canvas = document.getElementById("renderCanvas");

	// For mouse events
	canvas.addEventListener("mousedown", disableSelection);
	document.addEventListener("mousedown", enableSelection);

	// For touch events (mobile)
	canvas.addEventListener("touchstart", disableSelection);
	document.addEventListener("touchstart", enableSelection);

	// Disable text selection on the body when the canvas is touched or clicked
	function disableSelection() {
		document.body.style.userSelect = "none"; // Disable text selection
	}

	// Enable text selection when touching or clicking outside the canvas
	function enableSelection(event) {
		// Check if the event target is outside the canvas
		if (!canvas.contains(event.target)) {
			document.body.style.userSelect = "auto"; // Enable text selection
		}
	}

	// Focus management and keyboard navigation
	function initializeFocusManagement() {
		// Modal focus trapping
		const modal = document.getElementById("infoModal");
		if (modal) {
			modal.addEventListener("keydown", trapFocus);
		}

		// Enhanced canvas keyboard support
		const canvas = document.getElementById("renderCanvas");
		if (canvas) {
			canvas.addEventListener("keydown", handleCanvasKeyboard);
		}

		// Set up custom tab order management
		setupTabOrder();
	}

	function setupTabOrder() {
		function getFocusableElements() {
			const elements = [];

			// Add canvas first
			const canvas = document.getElementById("renderCanvas");
			if (canvas && isElementVisible(canvas)) {
				elements.push(canvas);
			}

			// Add gizmo buttons if visible
			const gizmoButtons = document.querySelectorAll(
				"#gizmoButtons button, #gizmoButtons input",
			);
			gizmoButtons.forEach((btn) => {
				if (isElementVisible(btn) && !btn.disabled) {
					elements.push(btn);
				}
			});

			   // Add info panel summary
			const infoSummary = document.querySelector("#info-details summary");
			if (infoSummary && isElementVisible(infoSummary)) {
			elements.push(infoSummary);
			}

			// Add Flock XR logo link after gizmos if visible
			const logoLink = document.querySelector("#info-panel-link");
			if (
				logoLink &&
				isElementVisible(logoLink) &&
				!elements.includes(logoLink)
			) {
				elements.push(logoLink);
			}

			// Add search inputs if visible
			const searchInputs = document.querySelectorAll(
				'.blocklySearchInput, .blocklyTreeSearch input, input[placeholder*="Search"]',
			);
			searchInputs.forEach((input) => {
				if (isElementVisible(input) && !input.disabled) {
					elements.push(input);
				}
			});

			// Add blockly workspace
			const blocklyDiv = document.getElementById("blocklyDiv");
			if (
				blocklyDiv &&
				blocklyDiv.getAttribute("tabindex") === "0" &&
				isElementVisible(blocklyDiv)
			) {
				elements.push(blocklyDiv);
			}

			// Add main UI elements in their natural order
			const mainUISelectors = [
				"#menuBtn",
				"#runCodeButton",
				"#stopCodeButton",
				"#openButton", // The actual open button
				"#colorPickerButton", // Color picker with correct ID
				"#projectName",
				"#exportCodeButton",
				"#exampleSelect",
				"#toggleDesign",
				"#togglePlay",
				"#fullscreenToggle",
			];

			mainUISelectors.forEach((selector) => {
				const element = document.querySelector(selector);
				if (
					element &&
					isElementVisible(element) &&
					!element.disabled &&
					!elements.includes(element)
				) {
					elements.push(element);
				}
			});

			return elements;
		}

		function isElementVisible(element) {
			if (!element) return false;

			// Check if element or its parent is hidden
			let currentElement = element;
			while (currentElement) {
				const style = window.getComputedStyle(currentElement);
				if (style.display === "none" || style.visibility === "hidden") {
					return false;
				}
				currentElement = currentElement.parentElement;
			}

			// Check if element has actual dimensions
			const rect = element.getBoundingClientRect();
			return rect.width > 0 && rect.height > 0;
		}

		document.addEventListener("keydown", (e) => {
			if (e.key !== "Tab") return;

			const focusableElements = getFocusableElements();
			if (focusableElements.length === 0) return;

			const currentElement = document.activeElement;
			const currentIndex = focusableElements.indexOf(currentElement);

			// Only manage tab navigation for our tracked elements
			if (currentIndex === -1) return;

			e.preventDefault();

			// Calculate next index with wraparound
			let nextIndex;
			if (e.shiftKey) {
				nextIndex =
					currentIndex === 0
						? focusableElements.length - 1
						: currentIndex - 1;
			} else {
				nextIndex =
					currentIndex === focusableElements.length - 1
						? 0
						: currentIndex + 1;
			}

			const nextElement = focusableElements[nextIndex];
			if (nextElement) {
				// Ensure element is still focusable before focusing
				if (!nextElement.disabled && isElementVisible(nextElement)) {
					nextElement.focus();

					// Announce for screen readers
					if (nextElement.id === "renderCanvas") {
						announceToScreenReader(
							"3D canvas focused. Use arrow keys or WASD to navigate.",
						);
					} else if (nextElement.closest("#gizmoButtons")) {
						announceToScreenReader(
							`${nextElement.getAttribute("aria-label") || nextElement.title || "Design tool"} focused`,
						);
					} else if (
						nextElement.classList?.contains("blocklySearchInput") ||
						nextElement.type === "search"
					) {
						announceToScreenReader("Search toolbox focused");
					} else if (nextElement.id === "blocklyDiv") {
						announceToScreenReader("Code workspace focused");
					} else if (
						nextElement.tagName === "BUTTON" ||
						nextElement.tagName === "LABEL"
					) {
						const text =
							nextElement.getAttribute("aria-label") ||
							nextElement.title ||
							nextElement.textContent ||
							"Interactive element";
						announceToScreenReader(`${text} focused`);
					}
				}
			}
		});
	}

	function trapFocus(e) {
		if (e.key !== "Tab") return;

		const modal = e.currentTarget;
		const focusableElements = modal.querySelectorAll(
			'button, input, select, textarea, [href], [tabindex]:not([tabindex="-1"])',
		);

		const firstElement = focusableElements[0];
		const lastElement = focusableElements[focusableElements.length - 1];

		if (e.shiftKey && document.activeElement === firstElement) {
			e.preventDefault();
			lastElement.focus();
		} else if (!e.shiftKey && document.activeElement === lastElement) {
			e.preventDefault();
			firstElement.focus();
		}
	}

	function handleCanvasKeyboard(e) {
		// Announce camera movements to screen readers
		const announcements = {
			ArrowUp: "Camera moving forward",
			ArrowDown: "Camera moving backward",
			ArrowLeft: "Camera moving left",
			ArrowRight: "Camera moving right",
			w: "Moving forward",
			s: "Moving backward",
			a: "Moving left",
			d: "Moving right",
			" ": "Action triggered",
		};

		if (announcements[e.key]) {
			announceToScreenReader(announcements[e.key]);
		}

		// Tab navigation is now handled by the main setupTabOrder function
		// No need to prevent default here - let the main handler manage it
	}

	function announceToScreenReader(message) {
		const announcer = document.getElementById("announcements");
		if (announcer) {
			announcer.textContent = message;
			// Clear after announcement
			setTimeout(() => {
				announcer.textContent = "";
			}, 1000);
		}
	}

	initializeFocusManagement();

}