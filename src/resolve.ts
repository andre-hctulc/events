import type { EventEmitter, EventEmitterOptions } from "events";
import { EventMap } from "./types.js";
import { EventEmitterPolyfill } from "./event-emitter-polyfill.js";

let Emitter: new <T extends EventMap<T> = any>(options?: EventEmitterOptions) => EventEmitter<T>;

interface Emitter<T extends EventMap<T> = any> extends EventEmitter<T> {}

// Node.js
if (typeof window === "undefined") {
    try {
        Emitter = (await import("events")).EventEmitter;
    } catch {
        console.warn("Failed to load Node.js EventEmitter, using polyfill instead");
        Emitter = EventEmitterPolyfill;
    }
}
// Other environments
else {
    Emitter = EventEmitterPolyfill;
}

export { Emitter as EventEmitter };
