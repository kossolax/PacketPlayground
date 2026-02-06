@AGENT.md

# Network Simulator Knowledge Base

## Architecture Overview

The project is a **network protocol simulator** built with React + TypeScript. Two distinct simulation systems coexist:

1. **Network Diagram Simulator** (`src/features/network-diagram/`) — Interactive topology builder with ReactFlow. Devices are placed on a canvas, linked, and protocols run in real-time with animated packet visualization. This is the main simulator.
2. **Standalone Protocol Demos** (`src/features/transport/`, `src/features/network/`, `src/features/datalink/`) — Isolated educational simulations (TCP handshake, sliding windows, fragmentation, switch learning) that each extend a base `Simulation<TState>` class. These are NOT connected to the network diagram.

### Network Diagram — Core Engine

- **`Network`** class (`lib/network-simulator/network.ts`) — Container for all nodes + links. Parses Packet Tracer XML files (.pkt/.pka) via `fast-xml-parser`.
- **Event-driven, NOT tick-based** — Uses RxJS `Subject` + `concatMap` for sequential packet delivery on each link. No main loop.
- **`Scheduler`** singleton (`lib/scheduler/scheduler.ts`) — Controls simulation speed. Modes: `FASTER` (100,000x), `REAL_TIME` (1x), `SLOWER` (1/1,000,000x), `PAUSED`. Adjusts speed-of-light multiplier and transmission multiplier.
- **Listener chain pattern** (`protocols/base.ts`) — `handleChain()` iterates listeners returning `ActionHandle` (Continue=0, Handled=1, Stop=2). Used at every layer for protocol processing.
- **`LinkLayerSpy`** — Global observer on all links, broadcasts `PacketTransmission` events to `usePacketAnimation` hook for UI animation.

### Device Hierarchy

```
GenericNode (abstract) — guid, name, type, x, y, interfaces, listeners
└── Node<T extends Interface>
    ├── NetworkHost (abstract) — IP-capable devices
    │   ├── L4Host (abstract)
    │   │   ├── ServerHost — has services.dhcp (DhcpServer)
    │   │   └── ComputerHost — PC/Laptop, DHCP client capable
    │   └── RouterHost — routing table, LPM forwarding, DHCP server
    └── SwitchHost — MAC table, STP service, VLAN-aware flooding
```

Hub type exists in device catalog but **has NO dedicated HubHost class** — uses SwitchHost behavior.

### Interface Hierarchy

```
Interface (abstract) — name, link, speed, fullDuplex, listeners
└── HardwareInterface — MAC address, receiveBits/sendBits
    └── EthernetInterface — autoneg support, speed/duplex config
        └── Dot1QInterface — VLANs[], VlanMode (Access/Trunk), NativeVlan
            └── NetworkInterface — IP addresses[], ARP, DHCP client
                └── IPInterface — IPv4Protocol + ICMPProtocol listeners
```

### Message Hierarchy

```
Message (abstract) — payload, length
├── PhysicalMessage — raw bits on wire
├── DatalinkMessage — macSrc, macDst
│   ├── EthernetMessage — FCS checksum
│   └── Dot1QMessage — vlanId
└── NetworkMessage — netSrc, netDst
    └── IPv4Message — version, TOS, TTL, flags, fragmentOffset, protocol, checksum
        ├── ICMPMessage — type (EchoRequest=8, EchoReply=0, DestUnreach=3, TimeExceeded=11), code
        └── DhcpMessage — op, xid, ciaddr, yiaddr, siaddr, giaddr, chaddr, options
```

### Hooks Architecture

| Hook | Purpose |
|------|---------|
| `useSimulationNetwork` | Loads Network, connects spy, brings up interfaces |
| `useNetworkEditor` | ReactFlow state (nodes/edges), device add, cable select, ping mode |
| `useNetworkLinks` | Tracks interface states, updates LED colors |
| `usePacketAnimation` | Subscribes to spy, animates packets on edges |
| `useSimulation` | Scheduler state, timer display, speed control |
| `usePing` | Executes ICMP ping between devices via UI |

### UI Components

- `NetworkDiagram` → wraps in `ReactFlowProvider` + `NetworkSimulationProvider` + `NetworkEditorProvider`
- `NetworkCanvas` — ReactFlow canvas, handles placement/connection/ping
- `CustomNode` — Device icon + interface list
- `CustomEdge` — Cable visualization + LED indicators (black=error, red=down, orange=STP-blocking, green=up) + PacketDot animation
- `DeviceConfigDialog` — Tabs: Config (IPs), Services (DHCP/STP), Terminal (CLI)

### Cable Types (`cables.ts`)

Auto-detected by device category:
- **Straight-through** (blue solid) — Different categories (PC↔Switch, PC↔Router)
- **Crossover** (orange dashed) — Same category (Switch↔Switch, PC↔PC)
- Categories: end devices (PC/Laptop/Server), network devices (Switch/Hub), routing devices (Router)

### Examples (`examples/index.ts`)

6 built-in: autonegotiation, arp-discovery, ping-network, vlan-trunk, stp-loop, dhcp-setup. Loadable via URL param.

---

## L1 — Physical Layer

**File:** `layers/physical.ts`

- **Link model:** `AbstractLink` with `speed` (Mbps), `length` (meters), `guid`
- **Propagation delay:** `length / (SPEED_OF_LIGHT * 2/3)` where `SPEED_OF_LIGHT = 299792458 m/s`
- **Transmission delay:** `bytes / (speed * 10^6) / transmission_multiplier`
- **Duplex:** Half-duplex uses single queue (`queue1`), full-duplex uses two queues (`queue1`+`queue2`). RxJS `concatMap` ensures sequential delivery.
- **No CSMA/CD** — Collisions prevented by design (queueing), not detected.
- **No signal encoding** — No NRZ, Manchester, PAM. Messages are abstract data units.
- **Auto-negotiation** (`protocols/autonegotiation.ts`) — IEEE 802.3. Negotiates 10/100/1000 Mbps + half/full duplex. Page 0 (FastEthernet) + Page 1 (Gigabit). Triggered on `up()`.

---

## L2 — Data Link Layer

**Files:** `layers/datalink.ts`, `protocols/ethernet.ts`, `protocols/arp.ts`, `nodes/switch.ts`, `services/spanningtree.ts`

### Ethernet
- `EthernetMessage` — MAC src/dst, FCS checksum, builder pattern
- `Dot1QMessage` — Extends Ethernet with `vlanId`
- `VlanMode`: Access (single VLAN) or Trunk (multi-VLAN, 802.1Q tagged)

### Switch Forwarding (`SwitchHost`)
- **MAC/CAM table:** `Map<string, MACTableEntry[]>` with `lastSeen` timestamp
- **Learning:** `learnMAC(src, from)` on every received frame
- **Aging:** 300s (5 min), cleanup every 10 scheduler time units
- **Forwarding logic:**
  1. STP blocking check → drop if blocked
  2. Learn source MAC
  3. Lookup destination: known → unicast; unknown/broadcast → flood all ports in VLAN (except ingress)
  4. VLAN tag conversion: trunk→add Dot1Q tag, access→strip Dot1Q tag

### ARP (`protocols/arp.ts`)
- `ArpMessage` payload: type (request/reply), request IP, response MAC
- ARP cache with TTL (300s aging)
- Queue for pending packets awaiting resolution
- Broadcast request → unicast reply → flush queue

### Spanning Tree Protocol (`services/spanningtree.ts` — 1198 lines)
- **Variants supported:** None, STP (802.1D), PVST (per-VLAN). RPVST and MSTP are **stubs (throw not-implemented)**.
- **BPDU fields:** protocolId, version, rootId (priority+MAC), rootPathCost, bridgeId, portId, messageAge, maxAge(20), helloTime(2), forwardDelay(15)
- **Port roles:** Disabled, Root, Designated, Blocked, Alternate, Backup
- **Port states:** Disabled → Blocking → Listening → Learning → Forwarding
- **Root election:** Lowest priority+MAC wins. LPM on cost for root port selection.
- **PVST:** `Map<vlanId, STPService>` — One independent STP instance per VLAN. VLAN discovery from host.knownVlan + interface configs.
- **Multicast address:** `01:80:C2:00:00:00`

---

## L3 — Network Layer

**Files:** `layers/network.ts`, `protocols/ipv4.ts`, `protocols/icmp.ts`, `protocols/arp.ts`, `nodes/router.ts`, `services/dhcp.ts`

### IP Addressing (`address.ts`)
- `IPAddress` class — Validation, CIDR, subnet ops (`getNetworkIP`, `getBroadcastIP`, `InSameNetwork`), class-based auto-mask (A/B/C), IP arithmetic (add/subtract)
- `MacAddress` class — Validation, generation, broadcast detection (`FF:FF:FF:FF:FF:FF`)

### IPv4 (`protocols/ipv4.ts`)
- Full header: version, headerLength, TOS, totalLength, identification, flags (DF, MF), fragmentOffset, TTL (default 30), protocol, checksum
- **Fragmentation/reassembly:** 8-byte aligned, reassembly queue keyed by `iface_src_identification`, 5-min timeout cleanup
- Builder pattern for packet construction

### ICMP (`protocols/icmp.ts`)
- Types: EchoRequest(8), EchoReply(0), DestinationUnreachable(3), TimeExceeded(11)
- Auto-generates replies. `sendIcmpRequest()` returns Observable (RxJS `race` with timeout).
- **Note:** TTL decrement is stored but NOT actually decremented during forwarding. TimeExceeded is defined but not generated on TTL=0.

### Routing (`nodes/router.ts`)
- `RoutingTableEntry`: network, mask, gateway
- **Longest Prefix Match (LPM):** Iterates table, `InSameNetwork` check, selects highest CIDR. Falls back to directly connected.
- `receivePacket()`: checks local delivery → LPM lookup → forward out matching interface
- Static routes only. **No dynamic routing (RIP/OSPF/BGP).**

### DHCP (`services/dhcp.ts` — 609 lines)
- **DhcpPool:** gateway, netmask, start/end IP, lease tracking, otherServices (DNS/TFTP/WLC IPs — stored but not functional)
- **DhcpServer:** Extends `NetworkServices`. Handles DISCOVER→OFFER→REQUEST→ACK. Lease: 20s offer, 86400s (1 day) ACK. Supports relay via `forwarder`.
- **DhcpClient:** Promise-based `negociate(timeout)`. Auto-configures interface IP.
- **Simplification:** Uses protocol=1 (ICMP field) instead of proper UDP encapsulation.

### NetworkInterface (`layers/network.ts`)
- Multiple IPs per interface. `AutoNegociateAddress` flag triggers DHCP client.
- Reception: filters by dest MAC (unicast/broadcast) → extracts network payload → listener chain
- Transmission: routing decision → ARP resolution → encapsulate in DatalinkMessage

---

## L4 — Transport Layer (Standalone demos only, NOT in network diagram)

**Location:** `src/features/transport/lib/`

These are **isolated educational simulations**, NOT integrated into the network diagram packet flow.

### TCP 3-Way Handshake (`tcpsyn-sim.ts` — 449 lines)
- States: CLOSED → LISTEN → SYN_SENT → SYN_RCVD → ESTABLISHED
- Flags: SYN, ACK, RST (as booleans, not bitfields)
- **SYN Cookies:** Firewall mode with cookie generation/validation for SYN flood defense

### TCP Connection Termination (`tcpfin-sim.ts` — 378 lines)
- States: ESTABLISHED → FIN_WAIT_1 → FIN_WAIT_2 → TIME_WAIT → CLOSE_WAIT → LAST_ACK → CLOSED
- Supports client-closes-first and server-closes-first variants
- Configurable TIME_WAIT duration (default 4000ms)

### Go-Back-N (`gobackn-sim.ts` — 442 lines)
- Cumulative ACKs, window-based transmission
- Timeout + fast retransmit (3 duplicate ACKs)
- Configurable: window size, loss rate, speed, timeout duration

### Selective Repeat (`selectiverepeat-sim.ts` — 503 lines)
- Individual ACKs, per-packet timers, out-of-order buffering
- Selective retransmission of lost packets only
- Receiver buffer tracks individual packets

### NOT implemented at L4
- No UDP. No port-based multiplexing. No socket abstraction. No congestion control (cwnd/slow start). No actual data transfer (control packets only).

---

## L7 — Application Layer

### Implemented
- **DHCP** — Full server/client (see L3 section). Only real L7 protocol.
- **ICMP Ping** — User-triggered via terminal (`ping <IP>`) or UI click mode. Technically L3 but acts as application.
- **Terminal CLI** (`lib/network-simulator/terminal/`) — Commands: `ping`, `enable`, `config`, `interface`, `show`. Supports autocomplete, negation pattern.

### Planned but NOT implemented (UI placeholders only)
- **DNS** — ServiceTab shows placeholder. DHCP can store DNS server IP but no resolution.
- **HTTP** — ServiceTab shows placeholder (port, docroot, vhosts). No implementation.

### Not present at all
- No TCP/UDP transport in network diagram (DHCP bypasses transport layer)
- No TFTP, FTP, SSH, SNMP, email protocols
- No TLS/encryption

---

## Key File Map

| Path (relative to `src/features/network-diagram/lib/network-simulator/`) | Lines | Purpose |
|---|---|---|
| `network.ts` | ~208 | Network container, PKT/PKA parser |
| `address.ts` | ~200 | IPAddress + MacAddress classes |
| `message.ts` | ~200 | Message hierarchy (Physical/Datalink/Network) |
| `devices.ts` | ~50 | Device type catalog |
| `cables.ts` | ~50 | Cable type auto-detection |
| **layers/** | | |
| `physical.ts` | ~200 | Link/cable, delay calc, RxJS queues |
| `datalink.ts` | ~300 | HardwareInterface → EthernetInterface → Dot1QInterface |
| `network.ts` | ~200 | NetworkInterface, IP mgmt, DHCP client integration |
| **protocols/** | | |
| `base.ts` | ~250 | Listener chain, ActionHandle, spy |
| `ethernet.ts` | ~200 | EthernetMessage, Dot1QMessage, VLAN filtering |
| `arp.ts` | ~200 | ARP request/reply, cache, queue |
| `ipv4.ts` | ~300 | IPv4Message, fragmentation/reassembly |
| `icmp.ts` | ~183 | ICMPMessage, echo req/reply, ping |
| `autonegotiation.ts` | ~200 | IEEE 802.3 speed/duplex negotiation |
| **services/** | | |
| `dhcp.ts` | 609 | DhcpPool, DhcpClient, DhcpServer |
| `spanningtree.ts` | 1198 | STP/PVST service, BPDU, port roles/states |
| **nodes/** | | |
| `generic.ts` | ~150 | Abstract node hierarchy |
| `router.ts` | ~200 | RouterHost, routing table, LPM |
| `switch.ts` | ~250 | SwitchHost, MAC table, VLAN-aware flooding |
| `server.ts` | ~100 | ServerHost + ComputerHost |
| **Standalone demos** | | |
| `src/features/transport/lib/tcpsyn-sim.ts` | 449 | TCP 3-way handshake |
| `src/features/transport/lib/tcpfin-sim.ts` | 378 | TCP connection termination |
| `src/features/transport/lib/gobackn-sim.ts` | 442 | Go-Back-N sliding window |
| `src/features/transport/lib/selectiverepeat-sim.ts` | 503 | Selective Repeat |
| `src/features/network/lib/fragmentation-sim.ts` | ~200 | IPv4/IPv6 fragmentation demo |
| `src/features/network/lib/router-sim.ts` | ~200 | Router queuing simulation |
| `src/features/datalink/lib/switch-learning-sim.ts` | ~200 | MAC learning + flooding demo |

---

## Global Gaps / Not Implemented

- **No HubHost** — Hub in device catalog but uses SwitchHost (no true L1 repeat-to-all-ports)
- **No CSMA/CD** — Collisions prevented by queueing, not detected
- **No TTL decrement** — Stored but not decremented on forwarding, no ICMP TimeExceeded generation
- **No dynamic routing** — Static only, no RIP/OSPF/BGP
- **No NAT, no IPv6, no VRF, no policy routing**
- **No UDP, no TCP ports** — DHCP bypasses transport (uses protocol=1)
- **No DNS/HTTP** — UI placeholders only
- **RPVST/MSTP** — Enum values exist but throw not-implemented
- **No congestion control** — Standalone demos have windowing but no cwnd/slow-start in network diagram

---

## Project Vision & Design Intent

### Target Audience
**Advanced networking students** (Master/certifications like CCNA). Protocols must be **RFC-compliant**, not simplified. Observable behavior should match real equipment.

### Two Simulation Systems — Intentionally Separate
- **Network Diagram** = main interactive simulator. This is where protocol implementations live.
- **Standalone Demos** (transport/, network/, datalink/) = isolated pedagogical tools. They will **stay separate** forever. Do NOT try to merge them into the network diagram.

### Packet Tracer Compatibility
- PKT/PKA file import is a **key feature**. Users will import real Packet Tracer files.
- Current parser depth (topology + addressing + VLANs + routes) is sufficient. No need to parse running-config text.

### Protocol Implementation Philosophy
- **RFC strict compliance** — Implementations must follow RFCs closely (fields, timers, state machines).
- **Gaps are bugs** — TTL not decrementing, DHCP without UDP, no real Hub = bugs to fix, not acceptable simplifications.
- **No roadmap** — Features are added opportunistically. No fixed priority order.
- **Service vs Listener pattern:**
  - **Services** (`extends NetworkServices`) for daemon-like processes (DHCP server, STP, future DNS/HTTP servers)
  - **Listeners** (`implements NetworkListener/DatalinkListener`) for inline protocol processing (ICMP, ARP, IPv4, Ethernet)

### CLI — Cisco IOS Compatible
- Terminal aims for **maximum Cisco IOS compatibility**. Same commands, same syntax.
- Depth: as many `show` commands as the implemented protocols permit (show ip route, show mac-address-table, show spanning-tree, show arp, show vlan, show ip interface brief, etc.)
- **Sub-interfaces are planned** (e.g., `GigabitEthernet0/0.10` for VLAN 10) — needed for router-on-a-stick inter-VLAN routing.

### UI Features — Planned
- **Wireshark-like packet capture panel** — Global view by default + filterable per interface/device. Shows all packet headers layer by layer.
- **Packet drop visualization** — Animation (red/explosion effect on link) + log entry in capture panel. Drops include: TTL=0, no route, STP blocking, VLAN mismatch.
- **Current config UI is sufficient** — Will extend naturally as protocols are added.

### Deployment
- **Already deployed publicly** — Students use it online.
- **100% frontend** — No backend. The Python/FastAPI stack in AGENT.md does NOT apply to this project.

### Naming Conventions
- **Keep existing names** even if unconventional: `trame` (not "frame"), `Negociate` (not "Negotiate"), `receiveTrame`, `sendTrame`. Consistency with existing code > English correctness.
- Do NOT rename existing methods/variables to "fix" spelling.

### Anti-Patterns — What Claude Must NOT Do
- **No unnecessary generics** — Don't write `Protocol<T extends Message, U extends Interface>` when a concrete type works.
- **No premature abstractions** — No factories, registries, or DI containers for simple cases. If there's only one implementation, don't create an interface "for the future".
- **No excessive validation** — Don't add try/catch everywhere or check impossible invariants. Trust internal code.
- **Be autonomous** — Don't ask for confirmation on obvious implementation choices. Just do it. Ask only for genuine ambiguities.

### Scheduler
- Singleton is intentional. Only one simulation runs at a time. Standalone demos don't share it.
