import TcpSocket from 'react-native-tcp-socket';

type PingResult = {
    ip: string,
    ok: boolean
};

type SubnetResult = PingResult[];

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