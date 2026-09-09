type Entry = { id: string; distance: number };
const before = (a: Entry, b: Entry) => a.distance < b.distance || (a.distance === b.distance && a.id < b.id);

/** Dijkstra frontier with the same distance/ID tie break as sorting the whole
 * frontier, without repeating that sort for every junction on a large bus. */
export class RouteQueue {
    private entries: Entry[] = [];
    get size() { return this.entries.length; }
    push(id: string, distance: number) {
        const entry = { id, distance }, heap = this.entries;
        let index = heap.length; heap.push(entry);
        while (index > 0) {
            const parent = (index - 1) >> 1;
            if (!before(entry, heap[parent])) break;
            heap[index] = heap[parent]; index = parent;
        }
        heap[index] = entry;
    }
    pop() {
        const heap = this.entries, result = heap[0], last = heap.pop()!;
        if (!heap.length) return result;
        let index = 0;
        while (index * 2 + 1 < heap.length) {
            let child = index * 2 + 1;
            if (child + 1 < heap.length && before(heap[child + 1], heap[child])) child++;
            if (!before(heap[child], last)) break;
            heap[index] = heap[child]; index = child;
        }
        heap[index] = last; return result;
    }
}
