import TcpSocket from 'react-native-tcp-socket';
import * as Network from 'expo-network';
import { promiseLimit } from './NetworkUtils';

type PingResult = {
    ip: string,
    ok: boolean
};

type SubnetResult = PingResult[];

let localIp = "";

export async function getIpAddress() {
    localIp = await Network.getIpAddressAsync();
}

async function pingIp(ip: string, port: number, timeoutMs = 1000): Promise<PingResult> {
    return new Promise((resolve) => {
        let resolved = false;

        const fallbackTimer = setTimeout(() => done(false, 'fallback'), timeoutMs + 200);

        const done = (ok: boolean, reason: string) => {
            if (resolved) return;
            resolved = true;
            clearTimeout(fallbackTimer);
            try { if (!client.destroyed) client.destroy(); } catch {}
            resolve({ ip, ok });
        };

        const client = TcpSocket.createConnection({
            host: ip,
            port,
            localAddress: localIp, // es. '192.168.1.55'
            interface: 'wifi',           // forza l'uscita dal WiFi
        }, () => {});

        client.on('connect', () => done(true,  'connect'));
        client.setTimeout(timeoutMs);
        client.on('timeout', () => done(false, 'timeout'));
        client.on('error',   (e) => done(false, `error: ${e.message}`));
    });
}


const NORMAL_PORTS = [
    102, 502, 4840,          // Industrial core
    5900, 5901, 5902, 5800,  // VNC
    2308,                    // Siemens HMI
    80, 443, 8080, 8081,     // HTTP
    8888, 3000,              // IoT/consumer
    1883,                    // MQTT
    9100,                    // Stampanti
    21,                      // FTP
    53,                      // DNS (solo router, valuta rimozione)
];

const INTENSIVE_PORTS = [
    ...NORMAL_PORTS,
    22,                      // SSH
    1033, 5001, 5002, 50523, // Siemens HMI extra
    3389,                    // RDP
    48400,                   // OPC UA alternativo S7-1500
    7,                       // Echo
];

export async function detectDeviceNormal(ip: string, timeoutMs = 1000): Promise<PingResult> {
    // Prova le porte in batch piccoli, non tutte insieme
    return new Promise(async (resolve) => {
        for (let i = 0; i < NORMAL_PORTS.length; i += 3) {
            const batch = NORMAL_PORTS.slice(i, i + 3);
            const results = await Promise.all(
                batch.map(port => pingIp(ip, port, timeoutMs))
            );
            const found = results.find(r => r.ok);
            if (found) return resolve(found);
        }
        resolve({ ip, ok: false });
    });
};

async function detectDeviceIntensive(ip: string, timeoutMs = 1000): Promise<PingResult> {
  for (const port of INTENSIVE_PORTS) {
    const res = await pingIp(ip, port, timeoutMs);
    //console.log(`Pingando ${ip}:${port}`);
    if (res.ok) return res;
  }
  return { ip, ok: false };
};

export async function pingSubnet(
    ips: string[],
    mode: 'normal' | 'intensive',
    timeoutMs = 1000
): Promise<SubnetResult> {
    const tasks = ips.map(ip => () =>
        mode === 'normal'
            ? detectDeviceNormal(ip, timeoutMs)
            : detectDeviceIntensive(ip, timeoutMs)
    );

    // 1 IP alla volta → massimo 3 socket simultanei → no crash nativo
    return promiseLimit(tasks, 1);
}


export async function testFun (){
        // IP certi con porta già nota → test diretto
    const TEST_TARGETS: { ip: string; port: number }[] = [
    { ip: '192.168.1.51',  port: 8888 },
    { ip: '192.168.1.53',  port: 80   },
    { ip: '192.168.1.59',  port: 3000 },
    { ip: '192.168.1.71',  port: 8081 },
    { ip: '192.168.1.254', port: 53   },
    ];

    // Test ping diretto su porta nota (bypassa il loop di porte)
    const results = await Promise.all(
    TEST_TARGETS.map(({ ip, port }) => pingIp(ip, port, 1000))
    );
    console.log(results);
}

export async function debugDetect() {
    // Chiama detectDeviceNormal direttamente su .53, senza promiseLimit
    const res = await detectDeviceNormal('192.168.1.53', 1000);
    console.log('detectDeviceNormal(.53):', res);
}