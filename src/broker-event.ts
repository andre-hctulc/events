export interface BrokerEventOptions {
    /**
     * The type of the event.
     */
    type?: string;
}

/**
 * @template P The type of the event payload
 * @template C The type of the event contributions
 */
export class BrokerEvent<P = any, C = any> {
    constructor(readonly payload: P | undefined = undefined, options: BrokerEventOptions = {}) {
        this.#type = options.type || "";
    }

    #type: string;

    get type() {
        return this.#type;
    }

    // Allows the brokers to set the type of the event dynamically
    // IMP Therefor the user does not need to provide the type in the constructor!
    _setType(type: string) {
        this.#type = type;
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
}
