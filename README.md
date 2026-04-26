# Siemens Network Analyzer

Applicazione mobile sviluppata con Expo e React Native per attività di scansione di rete industriale, identificazione device e diagnostica rapida sul campo di dispositivi Siemens come PLC, HMI, switch e inverter.

## Stato del progetto

Progetto abbandonato.

Il motivo principale non è la parte protocollare, ma l'inaffidabilità riscontrata nella scansione TCP concorrente su più indirizzi IP in ambiente Expo/React Native con moduli socket nativi. L'applicazione riusciva a gestire correttamente la parte SNMP, mentre falliva nella fase di probing TCP multi-host, anche con un numero molto basso di connessioni simultanee.

## Obiettivo iniziale

L'obiettivo era creare uno strumento mobile utilizzabile direttamente on-site, senza dipendere da un PC, per ottenere una vista rapida della rete e un dettaglio tecnico per ogni device raggiungibile via IP.

Il focus era sugli impianti Siemens già indirizzati, con discovery di rete e diagnostica device-oriented.

## Cosa funzionava

La parte SNMP era stata implementata manualmente e funzionava correttamente:

- costruzione del buffer SNMP a basso livello;
- encoding dei messaggi;
- parsing del buffer di risposta;
- gestione delle richieste e delle risposte ai device raggiungibili.

Questa parte del progetto ha validato la fattibilità del layer applicativo e protocollare su mobile.

## Problema tecnico principale

Il blocco reale del progetto è nato nella discovery TCP concorrente durante la scansione della subnet.

In particolare:

- il probing TCP di più IP in simultanea risultava instabile;
- anche con concorrenza molto bassa, circa 8 socket TCP paralleli, il comportamento diventava inaffidabile;
- i device non venivano più rilevati correttamente;
- il problema persisteva anche provando strategie come `localAddress`;
- il tempo speso in debug si è concentrato quasi interamente sulla gestione concorrente dei socket TCP.

Di fatto, il limite non era il parsing SNMP né la logica applicativa, ma il layer di trasporto TCP in ambiente React Native con moduli nativi integrati in Expo development build.

## Conclusione tecnica

Il progetto è stato interrotto perché Expo/React Native non si è rivelato un ambiente adatto per un'app di network discovery industriale basata su scansione TCP concorrente della rete locale.

Per questo tipo di strumento, il collo di bottiglia non era la UI né il codice TypeScript, ma l'affidabilità del networking low-level su mobile in questo stack.

## Funzionalità previste nella fase iniziale

Le funzionalità considerate nel perimetro del progetto erano:

- scansione della sottorete per individuare i dispositivi raggiungibili via IP;
- identificazione dei nodi tramite protocolli compatibili con mobile, in particolare SNMP;
- ricostruzione della topologia tramite LLDP quando disponibile;
- pagina di dettaglio per singolo device con informazioni tecniche e stato diagnostico.

Le integrazioni future ipotizzate inizialmente non fanno più parte del progetto attivo, essendo il lavoro stato sospeso prima del superamento del problema infrastrutturale sul TCP.

## Stack usato

- Expo
- React Native
- TypeScript
- Expo Router
- moduli TCP/UDP nativi dove necessari per discovery e protocolli industriali

Expo era stato scelto per semplificare lo sviluppo lato React Native, ma l'uso di librerie con codice nativo richiedeva una development build e non era compatibile con il solo Expo Go.

## Architettura pensata

L'app era organizzata in due blocchi principali.

### Discovery rete

Questo livello si occupava di:

- scansione IP della rete locale;
- identificazione dei device trovati;
- raccolta metadati di rete;
- ricostruzione dei collegamenti logici o fisici quando il device esponeva informazioni LLDP o SNMP.

### Dettaglio device

Una volta selezionato un nodo, l'app mostrava una schermata di dettaglio con informazioni specifiche per il dispositivo rilevato.

## Requisiti di sviluppo

- Node.js
- npm oppure pnpm
- ambiente Expo
- dispositivo Android o iOS per i test
- development build Expo se venivano usati moduli nativi per socket TCP/UDP

## Avvio progetto

```bash
npm install
npx expo start --dev-client
```

In presenza di librerie native non supportate da Expo Go, era necessario usare una development build.

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

## Nota finale

Questo repository documenta un tentativo concreto di costruire uno scanner di rete industriale mobile focalizzato su dispositivi Siemens.

La parte SNMP è risultata valida e funzionante. La parte di scansione TCP concorrente, invece, ha reso il progetto non sostenibile nello stack scelto, portando all'abbandono del lavoro.

## Build di riferimento

- https://expo.dev/accounts/dave02233/projects/my-app/builds/f749f1da-8ea7-4211-a4ed-9f55d907ed8d
