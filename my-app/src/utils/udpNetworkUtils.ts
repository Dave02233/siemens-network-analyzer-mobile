import { Buffer } from 'buffer';

type SnmpResult = {
    ip: string, 
    reachable: boolean,
    sysName?: string,
    sysDescr?: string 
}

const SnmpTag = {
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

/*
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

/*
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

/*
console.log(oidToByteArr("1.3.6.1.2.1.1.5.0"));
// → [43, 6, 1, 2, 1, 1, 5, 0]

console.log(oidToByteArr("1.3.6.1.2.1.1.1.0"));
// → [43, 6, 1, 2, 1, 1, 1, 0]
*/


// In input prendo gli hex dei tipi dati e il valore (già convertito in array di byte)
function tlv (tag: number, value: number[]): number[] {
    return [tag, value.length, ...value];
}

/*
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

/*
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
    value: number[]
};

function readTLV (bytes: number[], offset: number) :tlvRead {

    const tag = bytes[offset];

    const lengthForm = bytes[offset + 1] >> 7 === 1; // 0 = short (little endian), 1 = long (big endian, byte più significativo come primo byte)


    let length = 0;
    if (lengthForm) { // long form

        const lengthOfLength = bytes[offset + 1] & 0x7F
        const lengthArr = bytes.slice(offset + 2, offset + 2 + lengthOfLength);
        length = lengthArr.reduce((acc, byte) => acc * 256 + byte, 0);

    } else { // short form

        length = bytes[offset + 1];
    
    }

    const value = bytes.slice(offset + 2, offset + 2 + length); TODO big endian

    return { tag, length, value};
}

readTLV([10, 20, 30], 0);

function parseSnmpRes (res: number[]) { 
    

}