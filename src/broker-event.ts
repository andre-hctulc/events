/**
 * @template P The type of the event payload
 * @template C The type of the event contributions
 */
export class BrokerEvent<P = any, C = any> {
    constructor(readonly type: string, readonly payload: P | undefined = undefined) {}

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
