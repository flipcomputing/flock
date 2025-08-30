import { translate } from "./translation.js"

(function(){
  const overlay = document.createElement('div');
  Object.assign(overlay.style, {
	position:'fixed', left:'0', bottom:'0', width:'100%', maxHeight:'45vh',
	overflowY:'auto', background:'rgba(0,0,0,.8)', color:'#0f0',
	font:'12px/1.4 monospace', padding:'8px', zIndex: 2147483647, display:'none'
  });
  document.addEventListener('touchstart', (e)=>{
	if (e.touches.length >= 3) overlay.style.display = (overlay.style.display==='none'?'block':'none');
  }, {passive:true});
  document.body.appendChild(overlay);

  const append = (tag, args) => {
	const line = document.createElement('div');
	line.textContent = `[${tag}] ` + args.map(a=>{
	  try { return typeof a==='string'?a:JSON.stringify(a); }
	  catch(_){ return String(a); }
	}).join(' ');
	overlay.appendChild(line);
	overlay.scrollTop = overlay.scrollHeight;
  };

  const orig = { log:console.log, warn:console.warn, error:console.error };
  console.log = (...a)=>{ append('log',a); orig.log.apply(console,a); };
  console.warn = (...a)=>{ append('warn',a); orig.warn.apply(console,a); };
  console.error = (...a)=>{ append('error',a); orig.error.apply(console,a); };

  window.addEventListener('error', e => append('uncaught', [e.message, e.filename+':'+e.lineno]));
  window.addEventListener('unhandledrejection', e => append('rejection', [String(e.reason)]));
})();

// Function to hide loading screen
export function hideLoadingScreen() {
	const loadingScreen = document.getElementById('loadingScreen');
	const loadingText = document.getElementById('loading-description');
	const body = document.body;

	if (loadingScreen) {
		// Announce completion to screen readers
		if (loadingText) {
			loadingText.textContent = translate("loading_success_ui");
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
