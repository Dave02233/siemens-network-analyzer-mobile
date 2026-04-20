import TcpSocket from 'react-native-tcp-socket';

type PingResult = {
    ip: string,
    ok: boolean
};

type SubnetResult = PingResult[];

export type addressList = string[];

export type ipRange = {
    initial: string, 
    final: string
};

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

function pingIp (ip: string, port: number, timeoutMs = 1000): Promise<PingResult> {
    return new Promise((resolve) => {

        const timer = setTimeout(() => {
            client.destroy();
            resolve({ ip, ok: false});
        }, timeoutMs)

        const client = TcpSocket.createConnection(
            {host: ip, port},
            () => {
                client.destroy();
                clearTimeout(timer);
                resolve({ ip, ok: true });
            }
        );

        client.on("error", () => {
            client.destroy();
            clearTimeout(timer);
            resolve({ ip, ok: false });
        })

        client.on("close", () => {
            // Questa non la so, in teoria si chiude già prima appena si connette o va in errore
        })

    })
}


const NORMAL_PORTS = [
  80,    // HTTP
  443,   // HTTPS
  8080,  // UI router/NAS
  102,   // Siemens S7
  502,   // Modbus TCP
  4840,  // OPC UA
];

const INTENSIVE_PORTS = [
  ...NORMAL_PORTS,
  22,    // SSH
  3389,  // RDP
  5900,  // VNC
  445,   // SMB
  139,   // NetBIOS
  32400, // Plex
  8000,
  8009,
  8200,
  1900,
];

async function detectDeviceNormal(ip: string, timeoutMs = 1000): Promise<PingResult> {
  for (const port of NORMAL_PORTS) {
    const res = await pingIp(ip, port, timeoutMs);
    if (res.ok) return res;
  }
  return { ip, ok: false };
}

async function detectDeviceIntensive(ip: string, timeoutMs = 1000): Promise<PingResult> {
  for (const port of INTENSIVE_PORTS) {
    const res = await pingIp(ip, port, timeoutMs);
    if (res.ok) return res;
  }
  return { ip, ok: false };
}

export async function pingSubnet(
  ips: string[],
  mode: 'normal' | 'intensive',
  timeoutMs = 1000
): Promise<SubnetResult> {
  const results: SubnetResult = [];

  for (const ip of ips) {
    const res =
      mode === 'normal'
        ? await detectDeviceNormal(ip, timeoutMs)
        : await detectDeviceIntensive(ip, timeoutMs);

    results.push(res);


    console.log(`${res.ip}: ${res.ok}`);
  }

  return results;
}