import { blockHandlerRegistry } from '../../blocks/blocks.js';

// Empties the shared handler registry so a test sees only its own blocks'
// handlers. Returns a function that puts the previous handlers back.
export function setAsideBlockHandlers() {
  const setAside = [...blockHandlerRegistry].map(([id, handler]) => [
    id,
    handler,
    blockHandlerRegistry.wantsAllEvents(id),
  ]);
  blockHandlerRegistry.clear();
  return () => {
    blockHandlerRegistry.clear();
    for (const [id, handler, allEvents] of setAside) {
      blockHandlerRegistry.set(id, handler);
      blockHandlerRegistry.setWantsAllEvents(id, allEvents);
    }
  };
}
