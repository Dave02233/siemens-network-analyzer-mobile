# Siemens Network Analyzer

Applicazione mobile sviluppata con Expo e React Native per attività di scan rete industriale, identificazione device e diagnostica rapida sul campo di dispositivi Siemens come PLC, HMI, switch e inverter.

## Obiettivo

L'app nasce per l'uso on-site, senza dipendere da un PC, e punta a fornire una vista rapida della rete e un dettaglio tecnico per ogni device raggiungibile via IP.
Il focus iniziale e' su impianti Siemens gia' indirizzati, con discovery di rete e diagnostica device-oriented.

## Funzionalita' previste

- Scan della sottorete per individuare i dispositivi raggiungibili via IP.
- Identificazione dei nodi tramite protocolli di rete compatibili con mobile, come SNMP.
- Ricostruzione della topologia tramite LLDP quando disponibile sui dispositivi di rete Siemens.
- Pagina di dettaglio per singolo device con informazioni tecniche e stato diagnostico.
- Supporto a Siemens Web API per i PLC compatibili, tramite JSON-RPC su HTTPS.
- Supporto OPC UA come opzione piu' standard e interoperabile per browsing, lettura variabili e monitoraggio dati.

## Stack tecnologico

- Expo
- React Native
- TypeScript
- Expo Router
- Moduli TCP/UDP dove necessari per discovery e protocolli industriali.

Expo e' stato scelto per mantenere uno sviluppo semplice lato React Native, ma per usare librerie con codice nativo serve una development build e non basta Expo Go.
Expo Go puo' usare solo le librerie gia' incluse nell'app precompilata, mentre i moduli nativi aggiuntivi richiedono una build personalizzata.

## Architettura

L'app e' organizzata in due blocchi principali.

### 1. Discovery rete

Questo livello si occupa di:
- scansione IP della rete locale;
- identificazione dei device trovati;
- raccolta metadati di rete;
- ricostruzione dei collegamenti logici o fisici quando il device espone informazioni LLDP/SNMP.

### 2. Dettaglio device

Una volta selezionato un nodo, l'app mostra una schermata di dettaglio con informazioni specifiche per il dispositivo.

Per i PLC Siemens recenti, il canale preferenziale puo' essere la Web API del web server integrato, basata su JSON-RPC via HTTPS.
In alternativa, OPC UA rappresenta il canale piu' standard e portabile, con focus su interoperabilita', scambio dati efficiente e subscriptions.

## Casi d'uso

- Trovare rapidamente PLC, HMI, switch e altri device Siemens presenti in una rete di impianto.
- Aprire il dettaglio di un PLC per leggere stato, informazioni diagnostiche e dati utili al troubleshooting.
- Usare Web API quando il device Siemens le supporta e serve una via semplice e leggera lato mobile.
- Usare OPC UA quando serve uno standard aperto o quando il progetto dovra' evolvere verso dispositivi multi-vendor.

## Struttura prevista del progetto

```text
app/
  (tabs)/
    index.tsx
    network.tsx
    devices.tsx
  device/
    [id].tsx
components/
services/
  discovery/
  snmp/
  opcua/
  siemens-webapi/
types/
utils/
```

La struttura separa discovery, protocolli e UI cosi' da mantenere il codice leggibile e facilmente estendibile.

## Requisiti

- Node.js
- npm oppure pnpm
- ambiente Expo
- dispositivo Android o iOS per i test
- development build Expo se vengono usati moduli nativi per socket TCP/UDP.

## Avvio progetto

```bash
npm install
npx expo start
```

Se il progetto usa librerie native non supportate da Expo Go, va usata una development build invece dell'app Expo Go standard.

Esempi:

```bash
npx expo run:android
npx expo run:ios
```

Oppure con EAS:

```bash
eas build --profile development --platform android
eas build --profile development --platform ios
```

Le development build permettono di includere librerie con codice nativo e di personalizzare completamente il lato nativo dell'app.

## Note tecniche

L'app non punta alla configurazione Profinet layer 2 in stile PRONETA puro, ma a discovery e diagnostica su dispositivi gia' raggiungibili via IP.
Questa scelta e' coerente con i limiti pratici del mobile e con l'obiettivo di avere uno strumento realmente usabile sul campo.

La Web API Siemens e' utile soprattutto per manutenzione e diagnostica di PLC compatibili.
OPC UA resta invece la scelta piu' solida se il progetto dovra' crescere verso un'app piu' universale.

## Roadmap

- Discovery IP base
- Identificazione device via SNMP
- Lettura topologia via LLDP
- Schermata dettaglio PLC Siemens
- Integrazione Siemens Web API
- Integrazione OPC UA
- Watch list variabili
- Diagnostica device e storico sessione locale

## Stato progetto

Nemmeno iniziato.
MVP focalizzato su scan rete e dettaglio device Siemens.
