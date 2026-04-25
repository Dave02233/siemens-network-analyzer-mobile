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
    102,   // Siemens S7 / ISO-on-TCP (sempre attivo su S7-1200/1500)
    502,   // Modbus TCP
    4840,  // OPC UA
    5900,  // VNC standard (RealVNC, UltraVNC, TightVNC)
    2308,  // Siemens HMI Transfer (RT Advanced / Comfort Panel)
    80,    // Siemens CPU web server (HTTP) 
    443,   // Siemens CPU web server (HTTPS)
    5800,  // UltraVNC Java Viewer
    5901,  // VNC display :1
    5902,  // VNC display :2
];

const INTENSIVE_PORTS = [
    ...NORMAL_PORTS,
    22,    // SSH (PC industriale, gateway)
    1033,  // Siemens HMI Transfer (Basic Panel)
    5001,  // Siemens HMI Device Manager (Comfort Panel)
    5002,  // Siemens HMI System Config (Comfort Panel)
    50523, // Siemens HMI Transfer fallback (se 2308 occupato)
    3389,  // RDP (WinCC, PC con TIA Portal)
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