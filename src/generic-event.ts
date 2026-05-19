export interface GenericEventOptions {
    /**
     * Event name
     */
    name?: string;
}

/**
 * @template P The type of the event payload
 * @template C The type of the event contributions
 */
export class GenericEvent<P = any, C = any> {
    constructor(
        readonly payload: P,
        options: GenericEventOptions = {},
    ) {
        this.#name = options.name || "";
    }

    #name: string;

    get name() {
        return this.#name;
    }

    #defaultPrevented = false;

    preventDefault() {
        this.#defaultPrevented = true;
    }

    get defaultPrevented() {
        return this.#defaultPrevented;
    }

    #contributions: { data: C; contributor: any }[] = [];

    contribute(data: C, contributor: any = undefined) {
        this.#contributions.push({ data, contributor });
    }

    getContributions() {
        return this.#contributions.map((c) => ({ ...c }));
    }

    requirePayload() {
        if (this.payload === undefined) {
            throw new Error("Event payload is undefined but required");
        }
        return this.payload;
    }
}
