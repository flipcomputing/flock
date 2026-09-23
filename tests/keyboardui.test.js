import { expect } from 'chai';
import {
  GizmoMenuManager,
  InfoPanel,
  ShortcutsPanel,
  HowToPanel,
  AreaManager,
} from '../accessibility/keyboardui.js';
import { KeyboardDispatcher } from '../main/keyboardDispatcher.js';

export function runKeyboardUiTests(flock) {
  describe('accessibility/keyboardui @keyboardui', function () {
    before(function () {
      // tests/tests.html doesn't load the app's style.css, so the `.hidden`
      // class AreaManager/GizmoMenuManager toggle never actually maps to
      // `display: none` here — which breaks ContextManager's OVERLAY
      // detection (it checks getComputedStyle().display). Inject the one
      // rule these tests actually depend on, matching style.css's own rule.
      if (!document.getElementById('keyboardui-test-hidden-rule')) {
        const style = document.createElement('style');
        style.id = 'keyboardui-test-hidden-rule';
        style.textContent = '.hidden { display: none !important; }';
        document.head.appendChild(style);
      }
    });

    describe('module init sanity', function () {
      it('GizmoMenuManager overlay already exists (init() ran on import)', function () {
        expect(document.getElementById('gizmo-menu-overlay')).to.exist;
      });

      it('AreaManager overlay already exists (init() ran on import)', function () {
        expect(document.getElementById('area-menu-overlay')).to.exist;
      });

      it('InfoPanel/ShortcutsPanel did not auto-init (no #info-panel-tabs in this harness)', function () {
        expect(InfoPanel._tablist).to.not.exist;
        expect(ShortcutsPanel.panel).to.equal(null);
      });
    });

    describe('GizmoMenuManager', function () {
      let created;

      function addButton(id, { disabled = false } = {}) {
        const btn = document.createElement('button');
        btn.id = id;
        btn.disabled = disabled;
        document.body.appendChild(btn);
        created.push(btn);
        return btn;
      }

      beforeEach(function () {
        created = [];
        GizmoMenuManager.toggle(false);
      });

      afterEach(function () {
        GizmoMenuManager.toggle(false);
        created.forEach((el) => el.remove());
        created = [];
      });

      it('isOpen() reflects the hidden class', function () {
        expect(GizmoMenuManager.isOpen()).to.equal(false);
        GizmoMenuManager.toggle(true);
        expect(GizmoMenuManager.isOpen()).to.equal(true);
      });

      it('toggle(true) focuses showShapesButton when nothing is already focused inside #gizmoButtons', function () {
        addButton('showShapesButton');
        GizmoMenuManager.toggle(true);
        expect(document.activeElement.id).to.equal('showShapesButton');
      });

      it('toggle(true) does not steal focus from something already focused inside #gizmoButtons', function () {
        const container = document.createElement('div');
        container.id = 'gizmoButtons';
        document.body.appendChild(container);
        created.push(container);
        const btn = document.createElement('button');
        btn.id = 'positionButton';
        container.appendChild(btn);
        btn.focus();
        addButton('showShapesButton');
        GizmoMenuManager.toggle(true);
        expect(document.activeElement).to.equal(btn);
      });

      it('registerCloseHook fires when the menu opens', function () {
        let called = false;
        GizmoMenuManager.registerCloseHook(() => (called = true));
        GizmoMenuManager.toggle(true);
        expect(called).to.equal(true);
      });

      it('a close hook that throws does not prevent the menu opening', function () {
        GizmoMenuManager.registerCloseHook(() => {
          throw new Error('boom');
        });
        expect(() => GizmoMenuManager.toggle(true)).to.not.throw();
        expect(GizmoMenuManager.isOpen()).to.equal(true);
      });

      it('activateButton focuses and clicks an enabled button', function () {
        let clicked = false;
        const btn = addButton('positionButton');
        btn.addEventListener('click', () => (clicked = true));
        GizmoMenuManager.activateButton({ id: 'positionButton', label: '3' });
        expect(document.activeElement).to.equal(btn);
        expect(clicked).to.equal(true);
      });

      it('activateButton does not click a disabled button', function () {
        // A real disabled <button> already suppresses the "click" *event* at
        // the browser level regardless of what the JS does, so listening for
        // the event can't tell whether activateButton's own `!el.disabled`
        // guard is doing anything. Spy on the `.click()` *method call*
        // itself instead, which isolates the JS guard from that native
        // behaviour.
        let clickCalled = false;
        const btn = addButton('positionButton', { disabled: true });
        btn.click = () => (clickCalled = true);
        GizmoMenuManager.activateButton({ id: 'positionButton', label: '3' });
        expect(clickCalled).to.equal(false);
      });

      it('activateButton is a safe no-op when the button does not exist', function () {
        expect(() => GizmoMenuManager.activateButton({ id: 'nope', label: '1' })).to.not.throw();
      });

      describe('Digit-key activation (via KeyboardDispatcher registry)', function () {
        it('does nothing while the menu is closed', function () {
          let clicked = false;
          const btn = addButton('positionButton');
          btn.addEventListener('click', () => (clicked = true));
          KeyboardDispatcher._registry['*:Digit3']();
          expect(clicked).to.equal(false);
        });

        it('activates the matching button while the menu is open', function () {
          addButton('showShapesButton');
          let clicked = false;
          const btn = addButton('positionButton');
          btn.addEventListener('click', () => (clicked = true));
          GizmoMenuManager.toggle(true);
          KeyboardDispatcher._registry['*:Digit3']();
          expect(clicked).to.equal(true);
        });
      });

      describe('Mod+KeyG handler', function () {
        it('opens the menu when the current context allows it', function () {
          const event = { preventDefault() {}, stopPropagation() {} };
          KeyboardDispatcher._registry['*:Mod+KeyG'](event);
          expect(GizmoMenuManager.isOpen()).to.equal(true);
        });

        it('does nothing while focus is in a text input (TYPING context)', function () {
          const input = document.createElement('input');
          document.body.appendChild(input);
          created.push(input);
          input.focus();
          const event = { preventDefault() {}, stopPropagation() {} };
          KeyboardDispatcher._registry['*:Mod+KeyG'](event);
          expect(GizmoMenuManager.isOpen()).to.equal(false);
        });

        it('does nothing while the area menu overlay is open (OVERLAY context)', function () {
          AreaManager.toggle(true);
          const event = { preventDefault() {}, stopPropagation() {} };
          KeyboardDispatcher._registry['*:Mod+KeyG'](event);
          expect(GizmoMenuManager.isOpen()).to.equal(false);
          AreaManager.toggle(false);
        });
      });
    });

    describe('AreaManager', function () {
      afterEach(function () {
        AreaManager.toggle(false);
        GizmoMenuManager.toggle(false);
      });

      it('toggle(true)/toggle(false) show and hide the overlay', function () {
        AreaManager.toggle(true);
        expect(AreaManager.overlay.classList.contains('hidden')).to.equal(false);
        AreaManager.toggle(false);
        expect(AreaManager.overlay.classList.contains('hidden')).to.equal(true);
      });

      it('opening closes the gizmo menu if it was open', function () {
        GizmoMenuManager.toggle(true);
        AreaManager.toggle(true);
        expect(GizmoMenuManager.isOpen()).to.equal(false);
      });

      it('Mod+KeyB (via KeyboardDispatcher) toggles the overlay open and closed', function () {
        const event = { preventDefault() {}, stopPropagation() {} };
        KeyboardDispatcher._registry['*:Mod+KeyB'](event);
        expect(AreaManager.overlay.classList.contains('hidden')).to.equal(false);
        KeyboardDispatcher._registry['*:Mod+KeyB'](event);
        expect(AreaManager.overlay.classList.contains('hidden')).to.equal(true);
      });

      it('Escape (via KeyboardDispatcher) closes the overlay', function () {
        AreaManager.toggle(true);
        KeyboardDispatcher._registry['OVERLAY:Escape']();
        expect(AreaManager.overlay.classList.contains('hidden')).to.equal(true);
      });

      it('Digit3 (the Canvas area) focuses the render canvas and closes the overlay', function () {
        AreaManager.toggle(true);
        const event = { preventDefault() {} };
        KeyboardDispatcher._registry['OVERLAY:Digit3'](event);
        expect(document.activeElement).to.equal(flock.canvas);
        expect(AreaManager.overlay.classList.contains('hidden')).to.equal(true);
      });

      it('Digit8 (Code editor) focuses the workspace surface, not a stray tabbable child (e.g. trashcan)', function () {
        // Trashcan sits before the workspace group in the SVG; focus must still
        // land on the workspace surface.
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class', 'blocklySvg');
        const trash = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        trash.setAttribute('class', 'blocklyTrash');
        trash.setAttribute('tabindex', '0');
        const surface = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        surface.setAttribute('class', 'blocklyWorkspace');
        surface.setAttribute('tabindex', '0');
        svg.append(trash, surface);
        document.body.appendChild(svg);

        let trashFocused = false;
        let surfaceFocused = false;
        trash.focus = () => (trashFocused = true);
        surface.focus = () => (surfaceFocused = true);

        try {
          AreaManager.toggle(true);
          KeyboardDispatcher._registry['OVERLAY:Digit8']({ preventDefault() {} });
          expect(surfaceFocused, 'workspace surface focused').to.equal(true);
          expect(trashFocused, 'trashcan not focused').to.equal(false);
          expect(AreaManager.overlay.classList.contains('hidden')).to.equal(true);
        } finally {
          svg.remove();
        }
      });

      describe('effectiveAreas', function () {
        afterEach(function () {
          document.getElementById('info-panel-tabs')?.remove();
        });

        it('swaps area 5 for the view-toggle pill when #info-panel-tabs is not on screen', function () {
          const el = document.createElement('div');
          el.id = 'info-panel-tabs';
          el.style.display = 'none';
          document.body.appendChild(el);
          const area5 = AreaManager.effectiveAreas.find((a) => a.label === '5');
          expect(area5.selector).to.equal('#viewToggle');
        });

        it('swaps area 5 for the view-toggle pill when #info-panel-tabs does not exist', function () {
          const area5 = AreaManager.effectiveAreas.find((a) => a.label === '5');
          expect(area5.selector).to.equal('#viewToggle');
        });

        it('focuses the help button for area 5 when the info panel tabs are visible', function () {
          const tabs = document.createElement('div');
          tabs.id = 'info-panel-tabs';
          Object.defineProperty(tabs, 'offsetWidth', { value: 100 });
          document.body.appendChild(tabs);

          const area5 = AreaManager.effectiveAreas.find((a) => a.label === '5');
          expect(area5.focusSelector).to.equal('#info-tab-btn-help');
        });

        it('swaps area 9 for the reload button when one is connected to the DOM', function () {
          const reload = document.createElement('button');
          reload.id = 'reload-btn';
          document.body.appendChild(reload);
          try {
            const area9 = AreaManager.effectiveAreas.find((a) => a.label === '9');
            expect(area9.selector).to.equal('#reload-btn');
          } finally {
            reload.remove();
          }
        });
      });
    });

    describe('InfoPanel + ShortcutsPanel', function () {
      let panelRoot;

      before(function () {
        // Neither auto-initialized in this harness (no #info-panel-tabs at
        // import time) — build the DOM skeleton index.html normally provides
        // and initialize them here, the same way main.js's bootstrap does.
        panelRoot = document.createElement('div');
        panelRoot.innerHTML =
          '<div id="info-panel"><div id="info-panel-tabs">' +
          '<div id="info-panel-tablist" role="tablist"></div></div>' +
          '<div id="info-panel-body"></div></div>';
        document.body.appendChild(panelRoot);
        InfoPanel.init();
        ShortcutsPanel.init();
      });

      after(function () {
        panelRoot.remove();
      });

      describe('InfoPanel', function () {
        afterEach(function () {
          if (InfoPanel._activeId) InfoPanel.deactivate(InfoPanel._activeId);
        });

        it('register() creates a tab button and panel wired together via aria attributes', function () {
          const panel = InfoPanel.register('mytab', 'My Tab');
          const btn = document.getElementById('info-tab-btn-mytab');
          expect(btn.textContent).to.equal('My Tab');
          expect(btn.getAttribute('aria-controls')).to.equal('info-tab-panel-mytab');
          expect(panel.getAttribute('aria-labelledby')).to.equal('info-tab-btn-mytab');
          expect(panel.classList.contains('hidden')).to.equal(true);
        });

        it('activate() shows the panel and marks the tab selected', function () {
          InfoPanel.register('mytab2', 'Tab 2');
          InfoPanel.activate('mytab2');
          expect(
            document.getElementById('info-tab-btn-mytab2').getAttribute('aria-selected')
          ).to.equal('true');
          expect(
            document.getElementById('info-tab-panel-mytab2').classList.contains('hidden')
          ).to.equal(false);
        });

        it('activating a second tab deactivates the first', function () {
          InfoPanel.register('tabA', 'A');
          InfoPanel.register('tabB', 'B');
          InfoPanel.activate('tabA');
          InfoPanel.activate('tabB');
          expect(
            document.getElementById('info-tab-btn-tabA').classList.contains('active')
          ).to.equal(false);
          expect(
            document.getElementById('info-tab-panel-tabA').classList.contains('hidden')
          ).to.equal(true);
          expect(
            document.getElementById('info-tab-btn-tabB').classList.contains('active')
          ).to.equal(true);
        });

        it('deactivate() hides the panel and clears the active id', function () {
          InfoPanel.register('tabC', 'C');
          InfoPanel.activate('tabC');
          InfoPanel.deactivate('tabC');
          expect(
            document.getElementById('info-tab-btn-tabC').classList.contains('active')
          ).to.equal(false);
          expect(InfoPanel._activeId).to.equal(null);
        });

        it('toggle() flips between activate and deactivate', function () {
          InfoPanel.register('tabD', 'D');
          InfoPanel.toggle('tabD');
          expect(InfoPanel._activeId).to.equal('tabD');
          InfoPanel.toggle('tabD');
          expect(InfoPanel._activeId).to.equal(null);
        });

        it('activate/deactivate/toggle on an unknown id are safe no-ops', function () {
          expect(() => InfoPanel.activate('nope')).to.not.throw();
          expect(() => InfoPanel.deactivate('nope')).to.not.throw();
          expect(() => InfoPanel.toggle('nope')).to.not.throw();
        });
      });

      describe('ShortcutsPanel show/hide/toggle', function () {
        afterEach(function () {
          ShortcutsPanel.hide();
        });

        it('show() activates the shortcuts tab', function () {
          ShortcutsPanel.show();
          expect(InfoPanel._activeId).to.equal('shortcuts');
        });

        it('hide() deactivates it', function () {
          ShortcutsPanel.show();
          ShortcutsPanel.hide();
          expect(InfoPanel._activeId).to.not.equal('shortcuts');
        });

        it('toggle() flips between show and hide', function () {
          ShortcutsPanel.toggle();
          expect(InfoPanel._activeId).to.equal('shortcuts');
          ShortcutsPanel.toggle();
          expect(InfoPanel._activeId).to.not.equal('shortcuts');
        });

        it('renders shortcuts grouped by category with <kbd>-wrapped keys', function () {
          ShortcutsPanel.show();
          const list = ShortcutsPanel.panel.querySelector('#shortcuts-list');
          expect(list.querySelectorAll('.shortcuts-category').length).to.be.above(0);
          expect(list.querySelectorAll('kbd').length).to.be.above(0);
        });

        it('documents fly and orbit camera keys under a Camera category', function () {
          ShortcutsPanel.show();
          const text = ShortcutsPanel.panel.querySelector('#shortcuts-list').textContent;
          expect(text).to.include('Camera');
          expect(text).to.include('Fly camera');
          expect(text).to.include('Orbit camera');
        });
      });

      describe('adjustFontSize', function () {
        afterEach(function () {
          ShortcutsPanel.hide();
        });

        it('increases the font size and clamps at the top of the scale', function () {
          ShortcutsPanel.show();
          const savedSize = ShortcutsPanel.fontSize;
          const savedStorage = localStorage.getItem('flock-shortcuts-font-size');
          try {
            ShortcutsPanel.fontSize = 1.2;
            ShortcutsPanel.adjustFontSize(1);
            expect(ShortcutsPanel.fontSize).to.be.above(1.2);
            expect(localStorage.getItem('flock-shortcuts-font-size')).to.equal(
              String(ShortcutsPanel.fontSize)
            );
            for (let i = 0; i < 10; i++) ShortcutsPanel.adjustFontSize(1);
            const maxed = ShortcutsPanel.fontSize;
            ShortcutsPanel.adjustFontSize(1);
            expect(ShortcutsPanel.fontSize).to.equal(maxed);
            expect(ShortcutsPanel.panel.querySelector('.font-increase-btn').disabled).to.equal(
              true
            );
          } finally {
            ShortcutsPanel.fontSize = savedSize;
            if (savedStorage === null) localStorage.removeItem('flock-shortcuts-font-size');
            else localStorage.setItem('flock-shortcuts-font-size', savedStorage);
          }
        });

        it('decreases the font size and clamps at the bottom of the scale', function () {
          ShortcutsPanel.show();
          const savedSize = ShortcutsPanel.fontSize;
          const savedStorage = localStorage.getItem('flock-shortcuts-font-size');
          try {
            ShortcutsPanel.fontSize = 1.2;
            for (let i = 0; i < 10; i++) ShortcutsPanel.adjustFontSize(-1);
            const minned = ShortcutsPanel.fontSize;
            ShortcutsPanel.adjustFontSize(-1);
            expect(ShortcutsPanel.fontSize).to.equal(minned);
            expect(ShortcutsPanel.panel.querySelector('.font-decrease-btn').disabled).to.equal(
              true
            );
          } finally {
            ShortcutsPanel.fontSize = savedSize;
            if (savedStorage === null) localStorage.removeItem('flock-shortcuts-font-size');
            else localStorage.setItem('flock-shortcuts-font-size', savedStorage);
          }
        });
      });

      describe('enterModal / exitModal', function () {
        afterEach(function () {
          ShortcutsPanel.exitModal();
          ShortcutsPanel.hide();
        });

        it('reparents the panel to <body> and marks it a modal dialog', function () {
          ShortcutsPanel.show();
          ShortcutsPanel.enterModal();
          expect(ShortcutsPanel.panel.parentNode).to.equal(document.body);
          expect(ShortcutsPanel.panel.classList.contains('shortcuts-modal')).to.equal(true);
          expect(ShortcutsPanel.panel.getAttribute('aria-modal')).to.equal('true');
        });

        it('adds a visible close button that hides the panel when clicked', function () {
          ShortcutsPanel.show();
          ShortcutsPanel.enterModal();
          const closeBtn = ShortcutsPanel.panel.querySelector('.shortcuts-modal-close');
          expect(closeBtn).to.exist;
          closeBtn.click();
          expect(InfoPanel._activeId).to.not.equal('shortcuts');
        });

        it('is idempotent (a second call does not add a second backdrop)', function () {
          ShortcutsPanel.show();
          ShortcutsPanel.enterModal();
          ShortcutsPanel.enterModal();
          expect(document.querySelectorAll('.shortcuts-modal-backdrop').length).to.equal(1);
        });

        it('exitModal restores the panel to its docked location and removes modal attributes', function () {
          ShortcutsPanel.show();
          const dockedParent = ShortcutsPanel.panel.parentNode;
          ShortcutsPanel.enterModal();
          ShortcutsPanel.exitModal();
          expect(ShortcutsPanel.panel.parentNode).to.equal(dockedParent);
          expect(ShortcutsPanel.panel.classList.contains('shortcuts-modal')).to.equal(false);
          expect(ShortcutsPanel.panel.hasAttribute('aria-modal')).to.equal(false);
          expect(document.querySelector('.shortcuts-modal-backdrop')).to.not.exist;
        });
      });

      describe('resize-triggered modal switching', function () {
        afterEach(function () {
          ShortcutsPanel.exitModal();
          ShortcutsPanel.hide();
        });

        it('enters modal mode on resize when the layout becomes narrow+landscape', function () {
          ShortcutsPanel.show();
          expect(ShortcutsPanel._modalActive).to.not.equal(true);
          const saved = window.matchMedia;
          window.matchMedia = () => ({ matches: true });
          try {
            window.dispatchEvent(new Event('resize'));
            expect(ShortcutsPanel._modalActive).to.equal(true);
          } finally {
            window.matchMedia = saved;
          }
        });

        it('exits modal mode and restores focus on resize when the layout leaves narrow+landscape', function () {
          const saved = window.matchMedia;
          window.matchMedia = () => ({ matches: true });
          try {
            ShortcutsPanel.show();
            window.dispatchEvent(new Event('resize'));
          } finally {
            window.matchMedia = saved;
          }
          expect(ShortcutsPanel._modalActive).to.equal(true);
          const closeBtn = ShortcutsPanel.panel.querySelector('.shortcuts-modal-close');
          closeBtn.focus();
          expect(document.activeElement).to.equal(closeBtn);
          const expectedFocus = ShortcutsPanel.previousFocus;

          window.matchMedia = () => ({ matches: false });
          try {
            window.dispatchEvent(new Event('resize'));
          } finally {
            window.matchMedia = saved;
          }
          expect(ShortcutsPanel._modalActive).to.equal(false);
          expect(document.activeElement).to.equal(expectedFocus);
          expect(ShortcutsPanel.previousFocus).to.equal(null);
        });

        it('leaves focus on a surviving control when exiting modal on resize', function () {
          const saved = window.matchMedia;
          window.matchMedia = () => ({ matches: true });
          try {
            ShortcutsPanel.show();
            window.dispatchEvent(new Event('resize'));
          } finally {
            window.matchMedia = saved;
          }
          expect(ShortcutsPanel._modalActive).to.equal(true);
          const increaseBtn = ShortcutsPanel.panel.querySelector('.font-increase-btn');
          increaseBtn.focus();
          expect(document.activeElement).to.equal(increaseBtn);

          window.matchMedia = () => ({ matches: false });
          try {
            window.dispatchEvent(new Event('resize'));
          } finally {
            window.matchMedia = saved;
          }
          expect(ShortcutsPanel._modalActive).to.equal(false);
          expect(document.activeElement).to.equal(increaseBtn);
        });
      });

      describe('trapFocus', function () {
        afterEach(function () {
          ShortcutsPanel.exitModal();
          ShortcutsPanel.hide();
        });

        it('Tab on the last focusable element wraps to the first', function () {
          ShortcutsPanel.show();
          ShortcutsPanel.enterModal();
          const focusables = ShortcutsPanel.focusableElements();
          focusables[focusables.length - 1].focus();
          const event = { key: 'Tab', shiftKey: false, preventDefault() {}, stopPropagation() {} };
          ShortcutsPanel.trapFocus(event);
          expect(document.activeElement).to.equal(focusables[0]);
        });

        it('Shift+Tab on the first focusable element wraps to the last', function () {
          ShortcutsPanel.show();
          ShortcutsPanel.enterModal();
          const focusables = ShortcutsPanel.focusableElements();
          focusables[0].focus();
          const event = { key: 'Tab', shiftKey: true, preventDefault() {}, stopPropagation() {} };
          ShortcutsPanel.trapFocus(event);
          expect(document.activeElement).to.equal(focusables[focusables.length - 1]);
        });

        it('ignores non-Tab keys', function () {
          ShortcutsPanel.show();
          ShortcutsPanel.enterModal();
          let prevented = false;
          ShortcutsPanel.trapFocus({ key: 'a', preventDefault: () => (prevented = true) });
          expect(prevented).to.equal(false);
        });
      });

      describe('panel keydown handling (Escape / arrow scroll)', function () {
        afterEach(function () {
          ShortcutsPanel.hide();
        });

        it('Escape hides the panel', function () {
          ShortcutsPanel.show();
          ShortcutsPanel.panel.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
          );
          expect(InfoPanel._activeId).to.not.equal('shortcuts');
        });

        it('ArrowUp/ArrowDown scroll without throwing', function () {
          ShortcutsPanel.show();
          expect(() => {
            ShortcutsPanel.panel.dispatchEvent(
              new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true })
            );
            ShortcutsPanel.panel.dispatchEvent(
              new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })
            );
          }).to.not.throw();
        });
      });
    });

    // Font-size, modal enter/exit, focus trap and keydown handling all come
    // from the same ModalPanelBehaviour mixin already exercised in depth
    // above via ShortcutsPanel — no need to re-test that generic behaviour
    // here. This covers what's actually specific to HowToPanel: the card
    // grid, the grid<->article swap, and resetting to the grid on hide().
    describe('HowToPanel', function () {
      let panelRoot;

      before(function () {
        panelRoot = document.createElement('div');
        panelRoot.innerHTML =
          '<div id="info-panel"><div id="info-panel-tabs">' +
          '<div id="info-panel-tablist" role="tablist"></div></div>' +
          '<div id="info-panel-body"></div></div>';
        document.body.appendChild(panelRoot);
        InfoPanel.init();
        HowToPanel.init();
      });

      after(function () {
        HowToPanel.hide();
        panelRoot.remove();
      });

      afterEach(function () {
        HowToPanel.hide();
      });

      it('show() activates the how-to tab and renders a card for each how-to', function () {
        HowToPanel.show();
        expect(InfoPanel._activeId).to.equal('howto');
        const tiles = HowToPanel.panel.querySelectorAll('.howto-grid .howto-tile');
        expect(tiles.length).to.equal(12);
      });

      it("clicking a card swaps the grid for that how-to's article, with a back button", function () {
        HowToPanel.show();
        HowToPanel.panel.querySelector('.howto-tile').click();
        expect(HowToPanel.panel.querySelector('.howto-grid')).to.equal(null);
        expect(HowToPanel.panel.querySelector('.howto-back')).to.exist;
        expect(HowToPanel.panel.querySelector('.howto-article-title').textContent).to.not.equal('');
      });

      it('the back button returns to the card grid', function () {
        HowToPanel.show();
        HowToPanel.panel.querySelector('.howto-tile').click();
        expect(HowToPanel.panel.querySelectorAll('.howto-back').length).to.equal(2);
        HowToPanel.panel.querySelector('.howto-back').click();
        expect(HowToPanel.panel.querySelector('.howto-grid')).to.exist;
        expect(HowToPanel.panel.querySelector('.howto-back')).to.equal(null);
      });

      it('hide() resets to the grid, so reopening does not strand the reader mid-article', function () {
        HowToPanel.show();
        HowToPanel.panel.querySelector('.howto-tile').click();
        HowToPanel.hide();
        HowToPanel.show();
        expect(HowToPanel.panel.querySelector('.howto-grid')).to.exist;
      });

      it('a <link-to target="howto:…"> opens that how-to', function () {
        HowToPanel.show();
        const tiles = HowToPanel.panel.querySelectorAll('.howto-tile');
        const targetName = tiles[4].querySelector('.howto-tile-name').textContent;
        tiles[1].click();
        const link = [...HowToPanel.panel.querySelectorAll('.howto-article button.help-link')].find(
          (b) => b.textContent.includes('Explore')
        );
        expect(link).to.exist;
        link.click();
        expect(HowToPanel.panel.querySelector('.howto-grid')).to.equal(null);
        expect(HowToPanel.panel.querySelector('.howto-article-title').textContent).to.equal(
          targetName
        );
      });

      it('a <link-to> in the article is upgraded to a working help-link button', function () {
        HowToPanel.show();
        HowToPanel.panel.querySelector('.howto-tile').click();
        const article = HowToPanel.panel.querySelector('.howto-article');
        expect(article.querySelector('link-to')).to.equal(null);
        expect(article.querySelector('button.help-link')).to.exist;
      });

      it('a <ui-button> renders its label with an icon and no underlined gap', function () {
        HowToPanel.show();
        const tile = [...HowToPanel.panel.querySelectorAll('.howto-tile')].find((t) =>
          t.textContent.includes('Add objects')
        );
        expect(tile).to.exist;
        tile.click();
        const article = HowToPanel.panel.querySelector('.howto-article');
        expect(article.querySelector('ui-button')).to.equal(null);
        const btn = [...article.querySelectorAll('button.help-link')].find((b) =>
          b.textContent.includes('Add')
        );
        expect(btn).to.exist;
        expect(btn.querySelector('svg.howto-icon')).to.exist;
        expect(btn.classList.contains('howto-ui-button')).to.equal(true);
        // The label-icon gap is CSS margin, not a whitespace text node, so no
        // underline paints between them.
        const gaps = [...btn.childNodes].filter(
          (n) => n.nodeType === Node.TEXT_NODE && !n.textContent.trim()
        );
        expect(gaps.length).to.equal(0);
        expect(btn.lastChild.nodeName).to.equal('svg');
      });

      it('shows a filter chip for All plus one per topic tag', function () {
        HowToPanel.show();
        const chips = [...HowToPanel.panel.querySelectorAll('.howto-filter-chip')];
        expect(chips.map((c) => c.textContent)).to.deep.equal([
          'All',
          'Scene',
          'Gizmo',
          'Camera',
          'Character',
        ]);
      });

      it('each card shows its topic tag as a pill', function () {
        HowToPanel.show();
        const tiles = HowToPanel.panel.querySelectorAll('.howto-grid .howto-tile');
        expect(tiles.length).to.equal(12);
        tiles.forEach((t) => expect(t.querySelector('.howto-tag')).to.exist);
      });

      it('filtering by Gizmo shows only the gizmo cards, All restores the grid', function () {
        HowToPanel.show();
        const chipByLabel = () =>
          new Map(
            [...HowToPanel.panel.querySelectorAll('.howto-filter-chip')].map((c) => [
              c.textContent,
              c,
            ])
          );
        chipByLabel().get('Gizmo').click();
        expect(HowToPanel.panel.querySelectorAll('.howto-grid .howto-tile').length).to.equal(8);
        expect(chipByLabel().get('Gizmo').getAttribute('aria-pressed')).to.equal('true');
        chipByLabel().get('All').click();
        expect(HowToPanel.panel.querySelectorAll('.howto-grid .howto-tile').length).to.equal(12);
      });

      it('the Duplicate an object article teaches the gizmo, not block duplication', function () {
        HowToPanel.show();
        const tile = [...HowToPanel.panel.querySelectorAll('.howto-tile')].find((t) =>
          t.textContent.includes('Duplicate an object')
        );
        expect(tile).to.exist;
        tile.click();
        const text = HowToPanel.panel.querySelector('.howto-article').textContent;
        expect(text).to.include('Duplicate');
        expect(text).to.include('copy');
        expect(text).to.not.include('Right-click');
      });
    });
  });
}
