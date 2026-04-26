export type ipRange = {
    initial: string, 
    final: string
};

export type addressList = string[];

export type ElapsedTime = {
    initialMs: number, 
    actualMs: number
}

export function ipToInt (ip: string): number {
    const parts = ip.split(".").map(Number);

    if (parts.length !== 4 || parts.some( p => isNaN(p) || p < 0 || p > 255)) {
        throw new Error(`Indirizzo IP non valido: ${ip}`);
    }

    return (
        (parts[0] << 24) + 
        (parts[1] << 16) + 
        (parts[2] << 8) + 
        parts[3]
    )
};

export function intToIp (num: number): string {
    // A >> x = xxxxxxxx xxxxxxxx xxxxxxxx AAAAAAAA & 00000000 00000000 00000000 11111111 = 00000000 00000000 00000000 AAAAAAAA
    const p1 = (num >> 24) & 255;
    const p2 = (num >> 16) & 255;
    const p3 = (num >> 8) & 255;
    const p4 = num & 255;

    return `${p1}.${p2}.${p3}.${p4}`
};

export function getIpRange (range: ipRange): string[] {
    const start = ipToInt(range.initial);
    const end = ipToInt(range.final);

    if (start > end) {
        throw new Error("IP finale maggiore dell'iniziale");
    }

    const res: string[] = []

    for(let curr = start; curr <= end; curr++) {
        res.push(intToIp(curr));
    }

    return res;
}

export async function promiseLimit<T>(
    tasks: (() => Promise<T>)[],
    concurrency: number
): Promise<T[]> {
    const results: T[] = [];
    let i = 0;

    async function worker() {
        while (i < tasks.length) {
            const idx = i++;
            results[idx] = await tasks[idx]();
        }
    }

    await Promise.all(
        Array.from({ length: concurrency }, worker)
    );
    return results;
}

