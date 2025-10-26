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

		  // Helper: add once if visible & enabled
		  const pushUnique = (el) => {
			if (!el) return;
			const disabled = 'disabled' in el && el.disabled;
			if (isElementVisible(el) && !disabled && !elements.includes(el)) {
			  elements.push(el);
			}
		  };

		  // 1) Canvas
		  pushUnique(document.getElementById('renderCanvas'));

		  // 2) Gizmo buttons
		  document
			.querySelectorAll('#gizmoButtons button, #gizmoButtons input')
			.forEach(pushUnique);

		  // 3) Info panel
		  pushUnique(document.querySelector('#info-details summary'));
		  const infoDetails = document.getElementById('info-details');
		  if (infoDetails && infoDetails.open) {
			pushUnique(infoDetails.querySelector('.content'));
		  }

		  // 4) Logo link + resizer
		  pushUnique(document.querySelector('#info-panel-link'));
		  pushUnique(document.querySelector('#resizer'));

		  // 5) Search inputs (toolbox flyout etc.)
		  document
			.querySelectorAll(
			  '.blocklySearchInput, .blocklyTreeSearch input, input[placeholder*="Search"]'
			)
			.forEach(pushUnique);

			// Find the *visible* search flyout
			  const flyout = Array.from(
				document.querySelectorAll('svg.blocklyToolboxFlyout')
			  ).find(svg => {
				const r = svg.getBoundingClientRect();
				return r.width > 0 && r.height > 0;
			  });

			  if (flyout) {
				// Prefer the inner workspace <g>, fall back to the svg
				const ws = flyout.querySelector('g.blocklyWorkspace');
				const target = ws || flyout;

				// Ensure it can receive focus
				if (!target.hasAttribute('tabindex') || target.tabIndex < 0) {
				  target.setAttribute('tabindex', '0');
				}
				target.setAttribute('focusable', 'true');
				target.setAttribute('role', 'group');
				if (!target.getAttribute('aria-label')) {
				  target.setAttribute('aria-label', 'Toolbox search results');
				}

				// Return just the flyout target (you can merge this into your larger list)
				elements.push(target);
			  }


		  // 6) Blockly MAIN WORKSPACE (one level above blocks)
		  // Your DOM shows:
		  // <svg class="blocklySvg"> <g class="blocklyWorkspace" tabindex="0"> ... <g class="blocklyBlockCanvas">...</g> ... </g> </svg>
		  // We want the g.blocklyWorkspace INSIDE a blocklySvg, but NOT inside any svg.blocklyFlyout.
		  const workspaceGroup = Array.from(
			document.querySelectorAll('svg.blocklySvg g.blocklyWorkspace')
		  )
			.filter((ws) => !ws.closest('svg.blocklyFlyout')) // exclude flyout workspaces
			// If there are multiple, prefer the one that actually contains the block canvas
			.sort((a, b) => {
			  const aHasCanvas = !!a.querySelector('g.blocklyBlockCanvas');
			  const bHasCanvas = !!b.querySelector('g.blocklyBlockCanvas');
			  return Number(bHasCanvas) - Number(aHasCanvas);
			})[0];

		  if (workspaceGroup && isElementVisible(workspaceGroup)) {
			if (workspaceGroup.getAttribute('tabindex') !== '0') {
			  workspaceGroup.setAttribute('tabindex', '0');
			}
			workspaceGroup.setAttribute('role', 'group');      // lets AT know it's an interactive region
			workspaceGroup.setAttribute('aria-label', 'Blocks workspace');
			workspaceGroup.setAttribute('focusable', 'true');  // helpful for SVG focus on some browsers
			pushUnique(workspaceGroup);
		  }

		  // 7) Main UI controls (in natural order)
		  [
			'#menuBtn',
			'#runCodeButton',
			'#stopCodeButton',
			'#openButton',
			'#colorPickerButton',
			'#projectName',
			'#exportCodeButton',
			'#exampleSelect',
			'#toggleDesign',
			'#togglePlay',
			'#fullscreenToggle',
		  ].forEach((sel) => pushUnique(document.querySelector(sel)));

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
			if (document.activeElement.id === "resizer" && 
				["ArrowLeft", "ArrowRight", "Home"].includes(e.key)) {
				
				return; // Don't prevent default, let resizer handle it
			}

			if (e.key !== "Tab") return;
			const activeElement = document.activeElement;

			// Special handling for details navigation
			const detailsElement = document.getElementById("info-details");

			// If we're on the summary and details is closed, use custom management
			if (activeElement.matches("#info-details summary") && !detailsElement.open) {
				// Let custom management handle this - will go to next UI element
			}
			// If we're on the summary and details is open, let browser handle the Tab into content
			else if (activeElement.matches("#info-details summary") && detailsElement.open) {
				return; // Let browser handle tab into details content
			}
			// If we're anywhere inside open details content, let browser handle it
			else if (activeElement.closest("#info-details") && detailsElement.open) {
				return; // Let browser handle navigation within details
			}

			const focusableElements = getFocusableElements();
			if (focusableElements.length === 0) return;

			const currentElement = document.activeElement;
			const currentIndex = focusableElements.indexOf(currentElement);

			// Only manage tab navigation for our tracked elements
			if (currentIndex === -1 || currentElement.closest("details[open]")) return;

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
					else if (nextElement.id === "resizer") {
						announceToScreenReader("Panel resizer focused. Use arrow keys to resize panels, Home to reset.");
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
		// Handle Ctrl+Z for undo when canvas is focused
		if (e.ctrlKey && e.key.toLowerCase() === 'z' && !e.shiftKey) {
			e.preventDefault();
			const workspace = window.mainWorkspace || Blockly.getMainWorkspace();
			if (workspace) {
				workspace.undo(false);
				announceToScreenReader("Undo performed");
			}
			return;
		}

		// Handle Ctrl+Shift+Z or Ctrl+Y for redo when canvas is focused
		if ((e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'z') || 
			(e.ctrlKey && e.key.toLowerCase() === 'y')) {
			e.preventDefault();
			const workspace = window.mainWorkspace || Blockly.getMainWorkspace();
			if (workspace) {
				workspace.undo(true);
				announceToScreenReader("Redo performed");
			}
			return;
		}

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