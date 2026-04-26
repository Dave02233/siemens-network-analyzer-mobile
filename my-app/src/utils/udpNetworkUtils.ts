import dgram from 'react-native-udp';
import { Buffer } from 'buffer';
import type _UdpSocket from 'react-native-udp/lib/types/UdpSocket';
import type { EventEmitter } from 'events';
import { promiseLimit } from './NetworkUtils';

type UdpSocket = _UdpSocket & EventEmitter;

const SnmpTag: Record<string, number> = {
    INTEGER: 0x02,
    OCTET_STRING: 0x04,
    NULL: 0x05,
    OID: 0x06,
    SEQUENCE: 0x30,
    GET_REQUEST: 0xa0
} as const;


// Da usare solo per numeri interi > 255
function numberToByteArr (value: number): number[] {
    if (value === 0) return [0]

    const res = []
    let n = value;
    
    while (n > 0) {
        res.push(n % 256);
        n = Math.floor(n / 256);
    }

    res.reverse();

    return res;
}

/* TEST
console.log(numberToByteArr(0));    // → [0]
console.log(numberToByteArr(1));    // → [1]
console.log(numberToByteArr(255));  // → [255]
console.log(numberToByteArr(256));  // → [1, 0]
console.log(numberToByteArr(1000)); // → [3, 232]
*/

function stringToByteArr (value: string): number[] {
    const res = [];

    for (let i = 0; i < value.length; i++) {
        res.push(value.charCodeAt(i));
    }

    return res;
}

/* TEST
console.log(stringToByteArr("public"));
*/


function oidToByteArr (oid: string): number[] {

    const oidSplitStr = oid.split(".");

    if (oidSplitStr.length < 2) throw new Error("Wrong OID format");

    const oidSplitNum = oidSplitStr.map(v => Number(v));
    let res = []; 

    res.push(oidSplitNum[0] * 40 + oidSplitNum[1]);

    for (let i = 2; i < oidSplitNum.length; i++) {
        const num = oidSplitNum[i];

        if (num < 128) {

            res.push(num);

        } else { // Secondo la codidifica BER degli OID l'ottavo byte indica una continuazione del numero, quindi un numero >= 128 va spezzato in due byte

            let n = num;
            const tempRes = []

            while (n > 0) {

                tempRes.push(n % 128);
                n = Math.floor(n / 128);

            }

            tempRes.reverse()

            for (let i = 0; i < tempRes.length - 1; i++) {
                tempRes[i] = tempRes[i] | 0x80
            }

            res = [...res, ...tempRes]
        }
    }

    return res;
}

/* TEST
console.log(oidToByteArr("1.3.6.1.2.1.1.5.0"));
// → [43, 6, 1, 2, 1, 1, 5, 0]

console.log(oidToByteArr("1.3.6.1.2.1.1.1.0"));
// → [43, 6, 1, 2, 1, 1, 1, 0]
*/


// In input prendo gli hex dei tipi dati e il valore (già convertito in array di byte)
function tlv (tag: number, value: number[]): number[] {
    return [tag, value.length, ...value];
}

/* TEST
// 1. INTEGER con valore 0
const intZero = tlv(SnmpTag.INTEGER, [0x00]);

// 2. OCTET STRING "public"
const strBytes = Array.from(Buffer.from("public", "ascii"));
const community = tlv(SnmpTag.OCTET_STRING, strBytes);

// 3. SEQUENCE che contiene i due precedenti
const seq = tlv(SnmpTag.SEQUENCE, [...intZero, ...community]);

console.log(intZero);   // → [2, 1, 0]
console.log(community); // → [4, 6, 112, 117, 98, 108, 105, 99]
console.log(seq);       // → [48, 11, 2, 1, 0, 4, 6, 112, 117, 98, 108, 105, 99]
*/


function buildSnmpGetReq (oids: string[], community = "public"): number[] {

    const { INTEGER, OCTET_STRING, NULL, OID, SEQUENCE, GET_REQUEST } = SnmpTag;

    /*
    SEQUENCE
    ├── INTEGER 0          (version: SNMPv1)
    ├── OCTET STRING "public"   (community)
    └── GetRequest-PDU (0xa0)
        ├── INTEGER 1      (request-id)
        ├── INTEGER 0      (error-status)
        ├── INTEGER 0      (error-index)
        └── SEQUENCE       (VarBindList)
            └── SEQUENCE   (VarBind, uno per ogni OID)
                ├── OID
                └── NULL
    */

    const varBinds: number[] = [];
    for (const oid of oids) {
        const oidBytes = tlv(OID, oidToByteArr(oid));
        const nullBytes = tlv(NULL, [])
        const varBind = tlv(SEQUENCE, [...oidBytes, ...nullBytes]);

        varBinds.push(...varBind);
    }

    // OID, NULL in SEQUENCE

    const varBindList = tlv(SEQUENCE, varBinds)
    // SEQUENCE in SEQUENCE

    const req_id: number = 1; //Diventerà una variabile di input probabilmente
    const error_status: number = 0;
    const error_index: number = 0;

    const PDU: number[] = tlv(GET_REQUEST, [
        ...tlv(INTEGER, [req_id]),
        ...tlv(INTEGER, [error_status]),
        ...tlv(INTEGER, [error_index]),
        ...varBindList,
    ]);
    // GetRequest-PDU

    const snmpVer = 0 //SNMPv1
    const req: number[] = tlv(SEQUENCE, [
        ...tlv(INTEGER, [snmpVer]),
        ...tlv(OCTET_STRING, stringToByteArr(community)),
        ...PDU
    ])
    // Final Sequence

    return req;
}

/* TEST
    console.log(testFn(["1.3.6.1.2.1.1.5.0"]));
    48  38  → SEQUENCE, 38 byte totali
    2   1   0     → INTEGER 0 (version SNMPv1) ✅
    4   6   112 117 98 108 105 99  → OCTET STRING "public" ✅
    160 25  → GET_REQUEST PDU, 25 byte
        2   1   1  → INTEGER 1 (request-id) ✅
        2   1   0  → INTEGER 0 (error-status) ✅
        2   1   0  → INTEGER 0 (error-index) ✅
        48  14  → SEQUENCE (VarBindList)
        48  12  → SEQUENCE (VarBind)
            6   8   43 6 1 2 1 1 5 0  → OID 1.3.6.1.2.1.1.5.0 ✅
            5   0   → NULL ✅
*/

type tlvRead = {
    tag: number,
    length: number, 
    value: number[],
    nextOffset: number,
};

function readTLV (bytes: number[], offset: number) :tlvRead {

    const tag = bytes[offset];

    const lengthForm = bytes[offset + 1] >> 7 === 1; // false = short form 1 byte, true = long form N byte


    let length: number = 0;
    let value: number[] = []
    let nextOffset: number = 0

    if (lengthForm) { // long form

        const lengthOfLength = bytes[offset + 1] & 0x7F;
        const lengthArr = bytes.slice(offset + 2, offset + 2 + lengthOfLength);
        length = lengthArr.reduce((acc, byte) => acc * 256 + byte, 0);
        value = bytes.slice(offset + 2 + lengthOfLength, offset + 2 + lengthOfLength + length);
        nextOffset = offset + 2 + lengthOfLength + length;

    } else { // short form

        length = bytes[offset + 1];
        value = bytes.slice(offset + 2, offset + 2 + length);
        nextOffset = offset + 2 + length;

    }


    return { tag, length, value, nextOffset};
}

/* TEST
const reqBytes = buildSnmpGetReq(["1.3.6.1.2.1.1.5.0"]);

// Il pacchetto inizia con SEQUENCE (0x30)
const outer = readTLV(reqBytes, 0);
console.log(outer.tag);    // → 48 (0x30 = SEQUENCE) ✅
console.log(outer.length); // → 38
console.log(outer.nextOffset); // → 40 (2 + 38)

// Dentro outer.value: primo figlio è INTEGER versione
const version = readTLV(outer.value, 0);
console.log(version.tag);    // → 2 (0x02 = INTEGER) ✅
console.log(version.value);  // → [0] (SNMPv1) ✅

// Secondo figlio: OCTET STRING community
const community = readTLV(outer.value, version.nextOffset);
console.log(community.tag);   // → 4 (0x04 = OCTET_STRING) ✅
console.log(String.fromCharCode(...community.value)); // → "public" ✅

// Terzo figlio: GetRequest PDU (0xa0)
const pdu = readTLV(outer.value, community.nextOffset);
console.log(pdu.tag); // → 160 (0xa0 = GET_REQUEST) ✅
*/

const snmpResponseErrors: Record<number, string> = {
    1: "tooBig",
    2: "noSuchName",
    3: "badValue",
    4: "readOnly",
    5: "genErr"
} as const;

type VarBind = {
    oid: string, 
    value: string
}

function byteArrToOid(bytes: number[]): string {
    const res: number[] = [];

    res.push(Math.floor(bytes[0] / 40));
    res.push(bytes[0] % 40);

    for (let i = 1; i < bytes.length; i++) {

        if (bytes[i] < 0x80) {
            res.push(bytes[i]);

        } else {
            // Accumula byte in continuazione finché bit 7 = 1
            let acc = 0;
            while (bytes[i] >= 0x80) {
                acc = acc * 128 + (bytes[i] & 0x7F);
                i++;
            }
            acc = acc * 128 + bytes[i]; // ultimo byte del gruppo
            res.push(acc);
        }
    }

    return res.join(".");
}

function parseSnmpRes (res: number[]): VarBind[] { 

    // Livello 1: SEQUENCE esterno
    const outer = readTLV(res, 0);
    
    // Livello 2: version, community, pdu
    const version = readTLV(outer.value, 0);
    const community = readTLV(outer.value, version.nextOffset);
    const pdu = readTLV(outer.value, community.nextOffset);

    // Livello 3: request-id, error-status, error-index, varBindList
    const requestId = readTLV(pdu.value, 0);
    const errorStatus = readTLV(pdu.value, requestId.nextOffset);

    if (errorStatus.value[0] !== 0) throw new Error(`SNMP error: ${snmpResponseErrors[errorStatus.value[0]] ?? "unknown"}`);

    const errorIndex = readTLV(pdu.value, errorStatus.nextOffset);
    const varBindList = readTLV(pdu.value, errorIndex.nextOffset);

    // Livello 4: sequenza di varBind di risposta
    const varBind: VarBind[] = [];
    let offset = 0;

    while (offset < varBindList.value.length) {

        const bind = readTLV(varBindList.value, offset);
        const oid = readTLV(bind.value, 0);
        const value = readTLV(bind.value, oid.nextOffset)

        if (value.tag !== SnmpTag.OCTET_STRING && value.tag !== SnmpTag.INTEGER) throw new Error("Tipo di risposta sconosciuta");

        const oidStr = byteArrToOid(oid.value)
        let valueStr: string = "";

        if (value.tag === SnmpTag.OCTET_STRING) {
            valueStr = String.fromCharCode(...value.value);
        } else if (value.tag === SnmpTag.INTEGER) {
            valueStr = String(value.value.reduce((acc, val) => acc * 256 + val, 0)); // * 256 significa spostare di 8 posizioni verso sinistra, << esegue operazioni a 32 bit quindi per non andare in negativo moltiplico e non shifto
        }

        varBind.push({ oid: oidStr, value: valueStr });

        offset = bind.nextOffset;

    }

    return varBind;
}

/* TEST

// Test 1: parsing della richiesta (i VarBind avranno NULL come valore)
// Serve solo per verificare che la struttura venga navigata senza crash
const reqBytes = buildSnmpGetReq(["1.3.6.1.2.1.1.5.0"]);
const idx = reqBytes.indexOf(0xa0);
reqBytes[idx] = 0xa2; // trasforma GetRequest in GetResponse
// Questo lancerà "Tipo di risposta sconosciuta" perché il value è NULL (0x05)
// È corretto — aggiungilo ai tag accettati se vuoi gestirlo
try {
    console.log(parseSnmpRes(reqBytes));
} catch (e) {
    console.log("Errore atteso (NULL):", e.message);
}


// Test 2: byteArrToOid (questo puoi testarlo in isolamento)
console.log(byteArrToOid([43, 6, 1, 2, 1, 1, 5, 0]));
// → "1.3.6.1.2.1.1.5.0" ✅


// Test 3: readTLV su una risposta completa con valore reale
// Costruisci manualmente un VarBind con OCTET_STRING = "MyRouter"
const fakeOidBytes  = [0x06, 0x08, 43, 6, 1, 2, 1, 1, 5, 0];
const fakeValBytes  = [0x04, 0x08, ...stringToByteArr("MyRouter")];
const fakeVarBind   = [0x30, fakeOidBytes.length + fakeValBytes.length, ...fakeOidBytes, ...fakeValBytes];
const fakeVarBindList = [0x30, fakeVarBind.length, ...fakeVarBind];
const fakePDU       = [0xa2, fakeVarBindList.length + 9,
    0x02, 0x01, 0x01, // request-id = 1
    0x02, 0x01, 0x00, // error-status = 0
    0x02, 0x01, 0x00, // error-index = 0
    ...fakeVarBindList
];
const fakePacket    = [0x30, fakePDU.length + 11,
    0x02, 0x01, 0x00,                              // version = 0
    0x04, 0x06, ...stringToByteArr("public"),      // community = "public"
    ...fakePDU
];

console.log(parseSnmpRes(fakePacket));
// → [{ oid: "1.3.6.1.2.1.1.5.0", value: "MyRouter" }] ✅
*/

export type SnmpResult = { oid: string; value: string };

export function snmpGet (IPv4: string, oids: string[]): Promise<SnmpResult[]> {
    return new Promise((res, rej) => {

        let settled = false; // serve a impedire call una volta che la promise è già stata risolta, forse inutile ma vediamo

        const timeout = setTimeout(() => {

            closeSocket();
            rej(new Error("Timeout connessione"));

        }, 10000);
        
        const socket = dgram.createSocket({ type: 'udp4' }) as unknown as UdpSocket;

        const closeSocket = () => {

            if (settled) return;
            settled = true;

            try {
                socket.close();
            } catch (_) {
                ;
            } finally {
                clearTimeout(timeout);
            }
        }
 
        socket.on("error", (err: Error) => {

            closeSocket();
            rej(err);

        });

        socket.once("message", (msg: Buffer) => {

            try {

                const response = parseSnmpRes([...msg]);
                res(response);

            } catch (e) {

                rej(e);

            } finally {

                closeSocket();
            
            }

        });

        /*
        socket.once('listening', () => {

            const packet = buildSnmpGetReq(oids);
            const buf = Buffer.from(packet);

            socket.send(buf, 0, buf.length, 161, IPv4, (err) => {
                if (err) {
                    closeSocket();
                    rej(err);
                }
            })

        });
        */

        socket.bind(0, () => { // Bind su porta random
            const packet = buildSnmpGetReq(oids);
            const buf = Buffer.from(packet);

            socket.send(buf, 0, buf.length, 161, IPv4, (err) => {
                if (err) {
                    //console.log("Send error:", err);
                    closeSocket();
                    rej(err);
                } else {
                    //console.log("Pacchetto inviato, aspetto risposta...");
                }
            });
        });

    })
};


type UdpProbeResult = {
    ip: string;
    ok: boolean;
    protocol?: 'snmp' | 'ssdp';
};

// SNMP v1 GetRequest → sysName OID 1.3.6.1.2.1.1.5.0, community 'public'
const SNMP_PROBE = Buffer.from([
    0x30, 0x26,
    0x02, 0x01, 0x00,
    0x04, 0x06, 0x70, 0x75, 0x62, 0x6c, 0x69, 0x63,
    0xa0, 0x19,
    0x02, 0x04, 0x00, 0x00, 0x00, 0x01,
    0x02, 0x01, 0x00,
    0x02, 0x01, 0x00,
    0x30, 0x0b,
    0x30, 0x09,
    0x06, 0x05, 0x2b, 0x06, 0x01, 0x02, 0x01,
    0x05, 0x00,
    0x05, 0x00,
]);

const SSDP_PROBE = Buffer.from(
    'M-SEARCH * HTTP/1.1\r\n' +
    'HOST: 239.255.255.250:1900\r\n' +
    'MAN: "ssdp:discover"\r\n' +
    'MX: 1\r\n' +
    'ST: ssdp:all\r\n\r\n'
);

function udpProbeIp(
    ip: string,
    port: number,
    payload: Buffer,
    protocol: 'snmp' | 'ssdp',
    timeoutMs = 2000
): Promise<UdpProbeResult> {
    return new Promise((resolve) => {
        const socket = dgram.createSocket({ type: 'udp4' });
        let resolved = false;

        const done = (ok: boolean) => {
            if (resolved) return;
            resolved = true;
            socket.close();
            resolve({ ip, ok, protocol: ok ? protocol : undefined });
        };

        const timer = setTimeout(() => done(false), timeoutMs);

        socket.bind(0, () => {
            socket.send(payload, 0, payload.length, port, ip, (err) => {
                if (err) { clearTimeout(timer); done(false); }
            });
        });

        socket.on('message', () => {
            clearTimeout(timer);
            done(true);
        });

        socket.on('error', () => {
            clearTimeout(timer);
            done(false);
        });
    });
}

async function probeUdpDevice(ip: string, timeoutMs = 2000): Promise<UdpProbeResult> {
    // Prima SNMP, poi SSDP
    const snmp = await udpProbeIp(ip, 161, SNMP_PROBE, 'snmp', timeoutMs);
    if (snmp.ok) return snmp;

    const ssdp = await udpProbeIp(ip, 1900, SSDP_PROBE, 'ssdp', timeoutMs);
    return ssdp;
}

export async function udpScanSubnet(
    ips: string[],
    timeoutMs = 2000,
    concurrency = 5
): Promise<UdpProbeResult[]> {
    const tasks = ips.map(ip => () => probeUdpDevice(ip, timeoutMs));
    return promiseLimit(tasks, concurrency);
}
