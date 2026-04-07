# Disaggregated Azure Local — Analysis & Implementation Plan

## Connectivity-First Approach

> **Reference**: 64-Node-Network-Design-Guide.docx (V0.20, Azure Local 2604)
> **Date**: March 31, 2026
> **Branch**: Disaggregated (local only — do NOT publish to GitHub)

---

## Architecture Overview

The Disaggregated architecture is a **new second-level option** for Azure Local 2604+, fundamentally different from Hyperconverged. It replaces S2D (Storage Spaces Direct — Windows software-defined storage that pools local disks across cluster nodes into a shared virtual disk) with external SAN (Storage Area Network — a dedicated high-speed network and infrastructure purpose-built for block-level storage access) and replaces the HSRP VIP (Hot Standby Router Protocol Virtual IP — a shared gateway IP address where one router is active and one is standby; if the active router fails, the standby takes over the VIP, providing transparent gateway redundancy for all hosts on the subnet) TOR (Top-of-Rack — a network switch physically mounted at the top of a server rack that aggregates all server connections in that rack) pair with a Clos (leaf-spine fabric — a non-blocking multi-tier switch architecture where every leaf connects to every spine, ensuring equal-hop latency) topology.

| Aspect | Hyperconverged (existing) | Disaggregated (new) |
|---|---|---|
| Scale | 1–16 nodes, single rack | 1–64 nodes, multi-rack |
| Network topology | 2-switch HSRP (Hot Standby Router Protocol — active/standby gateway redundancy) pair | Leaf-spine Clos fabric |
| Storage | S2D (Storage Spaces Direct) with local RDMA (Remote Direct Memory Access — a technology that allows NIC (Network Interface Card) hardware to move data directly between server memory without involving the CPU (Central Processing Unit), reducing latency and CPU overhead) | External: FC (Fibre Channel — a dedicated high-speed serial protocol designed specifically for lossless storage networking, typically running at 16/32/64 Gbps (Gigabits per second)) SAN or iSCSI (Internet Small Computer Systems Interface — a protocol that carries SCSI (Small Computer System Interface — standard for storage device communication) block storage commands over standard IP (Internet Protocol) networks) SAN |
| Gateway model | HSRP VIP (Hot Standby Router Protocol Virtual IP — active/standby shared gateway) | Anycast Gateway (a distributed gateway model where the same IP and MAC (Media Access Control — unique hardware address of a network interface) address are simultaneously active on all leaf switches, so hosts always reach a local gateway) |
| SDN (Software Defined Networking — centralized programmatic control of network behavior decoupled from the physical forwarding hardware) | Microsoft SDN (cluster-scoped) | External SDN |
| Overlay | None (flat L2 — Layer 2, the data link layer of the OSI (Open Systems Interconnection — 7-layer networking reference model) model, responsible for Ethernet frame switching within a single broadcast domain) | VXLAN (Virtual Extensible LAN — a tunneling protocol that encapsulates L2 Ethernet frames inside L3 (Layer 3 — the network layer responsible for IP routing between subnets) UDP (User Datagram Protocol — a lightweight transport protocol) packets, enabling up to 16 million logical segments) EVPN (Ethernet VPN — a BGP (Border Gateway Protocol)-based control plane that distributes MAC/IP reachability information across the fabric so switches know where every endpoint lives) with VRF (Virtual Routing and Forwarding — a technology that creates isolated routing tables within a single physical router, providing network segmentation similar to VLANs (Virtual Local Area Networks) but at Layer 3) |
| DC (Data Center) core peering | TOR direct to core | Service leaf pair only |
| Connectivity modes | Connected or Disconnected | Connected or Disconnected |

---

## New Step 1 Flow: Connectivity-First

### Step 1a: Deployment Mode (top-level, replaces current Step 1)

| Option | Description | Maps to `state.scenario` |
|---|---|---|
| **Connected** | Standard cloud-connected deployment | `'connected'` (was `'hyperconverged'`) |
| **Disconnected** | Air-Gapped or Limited Connectivity deployment | `'disconnected'` (unchanged) |
| **Rack Scale** | Multi-rack reference (info-only link to Microsoft) | `'rackscale'` (was `'multirack'`) |
| **M365 (Microsoft 365) Local** | Microsoft 365 Local workload deployment | `'m365local'` (unchanged) |

### Step 1b: Architecture (shown for Connected + Disconnected only)

| Option | Description | New `state.architecture` value |
|---|---|---|
| **Hyperconverged** | S2D (Storage Spaces Direct) storage, 2-switch TOR, up to 16 nodes/rack | `'hyperconverged'` |
| **Disaggregated** | External SAN, Clos leaf-spine fabric, up to 64 nodes across multiple racks | `'disaggregated'` |

### Full Wizard Sequences

**Connected + Hyperconverged** (existing flow, renamed entry):
```
1a: Connected → 1b: Hyperconverged → 2: Cloud → 3: Region → 4: Scale → 5: Nodes → ... → 9: Summary
```

**Disconnected + Hyperconverged** (existing flow, zero change to Disconnected logic):
```
1a: Disconnected → D1: Cluster Role → D2: FQDN → D3: Appliance IPs → 1b: Hyperconverged → 2: Cloud → 3: Region → ... → 9: Summary
```

**Connected + Disaggregated** (new):
```
1a: Connected → 1b: Disaggregated → DA1: Storage Type → DA2: Backup → DA3: Scale → DA4: Spines → DA5: VLANs → DA6: QoS → DA7: IP Planning → DA8: Switch Config
```

**Disconnected + Disaggregated** (new):
```
1a: Disconnected → D1: Cluster Role → D2: FQDN → D3: Appliance IPs → 1b: Disaggregated → DA1: Storage Type → DA2: Backup → DA3: Scale → ... → DA8: Switch Config
```

---

## Three Storage Options + Optional Backup Network

All three options share the same **base NIC (Network Interface Card — a hardware adapter that provides Ethernet connectivity) layout**:

| Slot | Function | Speed | Teaming | Connects To |
|---|---|---|---|---|
| OCP (Open Compute Project — an industry-standard mezzanine NIC form factor built into the server motherboard) (2-port) | Compute + Management | 25 GbE (Gigabit Ethernet — Ethernet standard at 25 billion bits per second) | SET (Switch Embedded Teaming — a Windows feature that bonds multiple NICs into a single virtual switch for redundancy and load balancing) trunk | Port 1 → Leaf-A, Port 2 → Leaf-B |
| PCIe1 (Peripheral Component Interconnect Express — a high-speed serial bus standard for connecting expansion cards like NICs and HBAs to the motherboard) (2-port) | Cluster (heartbeat, CSV (Cluster Shared Volumes — a Windows feature that allows all cluster nodes to simultaneously read/write to the same NTFS (New Technology File System) volume), live migration) | 25 GbE | Access VLAN (Virtual Local Area Network — a logical broadcast domain created by switch configuration, identified by a numeric ID) per port | Port 1 → Leaf-A (VLAN 711), Port 2 → Leaf-B (VLAN 712) |
| BMC (Baseboard Management Controller — an embedded microcontroller on the server motherboard that provides out-of-band hardware management, including power control, temperature monitoring, and remote console) (1-port) | OOB (Out-of-Band — management traffic carried on a physically separate network from production data) management | 1 GbE | — | BMC switch (separate from Leaf) |

### Option 1: FC (Fibre Channel) SAN

Storage handled by dedicated FC HBA (Host Bus Adapter — a specialized PCIe card that connects a server to a Fibre Channel storage fabric, offloading protocol processing from the CPU) — **separate from the Ethernet leaf switches**. FC traffic never touches the leaf.

| Additional Slot | Function | Speed | Notes |
|---|---|---|---|
| FC HBA (2-port) | SAN storage | 16G/32G/64G FC | Port A → FC Switch A, Port B → FC Switch B via MPIO (Multipath I/O — a Windows and storage framework that maintains multiple redundant paths between server and storage so that if one path fails, traffic automatically routes through the surviving path, also enabling load balancing) |

**Leaf port allocation per rack (per leaf switch):**

| Port Range | Function | Notes |
|---|---|---|
| 1–16 | Mgmt/Compute (OCP NIC1/NIC2) | SET trunk, VLAN 7 native + tenant VLANs |
| 17–32 | CSV/Live Migration (PCIe1 NIC3/NIC4) | Access port, VLAN 711/712 |
| 33–48 | Reserved / Backup (optional) | Available for Backup intent |

**Max nodes/rack: 16 without Backup, ~16 with Backup** (ports 33–48 absorb backup NICs)

### Option 2: iSCSI (Internet Small Computer Systems Interface) SAN 4-NIC (shared CSV/LM + iSCSI on PCIe1)

CSV (Cluster Shared Volumes) / LM (Live Migration — the process of moving a running VM (Virtual Machine) from one host to another with zero downtime) and iSCSI share the PCIe1 ports via trunk with tagged VLANs.

| Additional Slot | Function | Notes |
|---|---|---|
| (none — PCIe1 carries both cluster + iSCSI) | iSCSI + CSV/LM | Trunk port with VLAN 300 (CSV/LM) + VLAN 500 (iSCSI) |

**Leaf port allocation per rack (per leaf switch):**

| Port Range | Function | Notes |
|---|---|---|
| 1–16 | Compute/Mgmt (OCP) | SET trunk |
| 17–32 | CSV/LM + iSCSI (PCIe1) | Trunk, tagged VLANs |
| 33–48 | Reserved / Backup (optional) | Available for Backup intent |

**Max nodes/rack: 16 without Backup, ~16 with Backup**

### Option 3: iSCSI SAN 6-NIC (dedicated iSCSI on PCIe2)

Dedicated iSCSI NICs on a separate PCIe2 slot, consuming leaf ports 33–48.

| Additional Slot | Function | Speed | Notes |
|---|---|---|---|
| PCIe2 (2-port) | iSCSI | 25 GbE | NIC5 → Leaf-A (ports 33–48, VLAN 500), NIC6 → Leaf-B (ports 33–48, VLAN 600) via MPIO |

**Leaf port allocation per rack (per leaf switch):**

| Port Range | Function | Notes |
|---|---|---|
| 1–16 | Compute/Mgmt (OCP) | SET trunk |
| 17–32 | CSV/LM (PCIe1) | Access port, VLAN 711/712 |
| 33–48 | iSCSI (PCIe2) | Access port, VLAN 500/600, MTU (Maximum Transmission Unit — the largest packet size in bytes that a network interface can transmit without fragmentation; 9216 = jumbo frames for storage efficiency) 9216 |

**Max nodes/rack: 13–15 without Backup** — **With Backup: port conflict** (ports 33–48 already consumed by iSCSI; backup NICs require shared trunk on existing ports or reduced max nodes)

### Optional: Backup Network Intent (applies to all 3 options)

2 additional ports per node for in-VM (Virtual Machine — a software-emulated computer running on a physical host)/guest backup traffic over the network. This is an **optional additional compute intent**.

| Additional Slot | Function | Speed | Teaming | Connects To |
|---|---|---|---|---|
| PCIe-Backup (2-port) | Backup (in-guest VM backup) | 25 GbE | SET trunk or dedicated | Port 1 → Leaf-A, Port 2 → Leaf-B |

**Impact on leaf port allocation:**
- **FC SAN + Backup**: Ports 33–48 used for Backup NICs — max ~16 nodes/rack
- **iSCSI 4-NIC + Backup**: Ports 33–48 used for Backup NICs — max ~16 nodes/rack
- **iSCSI 6-NIC + Backup**: **Conflict** — ports 33–48 already consumed by iSCSI. Wizard must warn and constrain

**Backup requires a dedicated VLAN** (e.g., VLAN 800) and corresponding VNI (VXLAN Network Identifier — a 24-bit unique segment ID within the VXLAN overlay, mapped to each VLAN to extend it across the fabric) mapping, plus a QoS (Quality of Service — a set of technologies and policies that prioritize, schedule, and allocate bandwidth to different types of network traffic to meet performance requirements) class.

---

## VLAN-to-VNI Mapping

| VLAN | Name | VNI | Purpose |
|---|---|---|---|
| 7 | Infra | 10007 | Management (Native VLAN — the VLAN that carries untagged traffic on a trunk port) |
| 6 | Tenant1 | 10006 | Tenant VM traffic |
| 200 | Tenant2 | 10200 | Tenant VM traffic |
| 301 | Tenant3 | 10301 | Tenant VM traffic |
| 400 | Tenant4 | 10400 | Tenant VM traffic |
| 711 | Cluster | 10711 | CSV/Live Migration |
| 712 | Cluster2 | 10712 | CSV/Live Migration |
| 800* | Backup* | 10800* | *Optional — in-guest backup traffic* |

---

## Switch Inventory

| Role | Make/Model | Count | ASN (Autonomous System Number — a unique 16-bit or 32-bit number assigned to a BGP routing domain, identifying it as a distinct entity in inter-domain routing) | Location |
|---|---|---|---|---|
| Spine | Cisco Nexus N9K-9336C-FX2 (NX-OS (Nexus Operating System — Cisco's data center switch operating system) 10.6) | 2–4 | 64841 | Spine rack |
| Leaf | Cisco Nexus N9K-C93180YC-FX3 | 2 per rack | 64789+ (unique per rack) | Each compute rack |
| Service Leaf | (same model as Leaf) | 2 (dedicated pair) | 65005 | DC (Data Center) core integration |
| BMC Switch | Cisco Nexus 9348GC-FXP | 1 per rack | — | OOB (Out-of-Band) management |

---

## QoS (Quality of Service) Policy — applies to iSCSI scenarios

Uses WRR (Weighted Round Robin — a scheduling algorithm that distributes available bandwidth among traffic classes according to assigned weights, so higher-weight classes get proportionally more bandwidth) with 802.1p (a IEEE (Institute of Electrical and Electronics Engineers) standard that defines CoS (Class of Service — a 3-bit priority field in the Ethernet frame header, values 0–7, used to classify and prioritize traffic at Layer 2)) marking. **No PFC (Priority Flow Control — an IEEE 802.1Qbb mechanism that sends per-priority pause frames to prevent packet loss on specific traffic classes, required for RDMA/RoCE (RDMA over Converged Ethernet) but not for iSCSI) required** — iSCSI is loss-tolerant unlike RDMA.

| Priority (802.1p) | Description | PFC | ETS (Enhanced Transmission Selection — an IEEE 802.1Qaz standard that allocates guaranteed minimum bandwidth percentages to each traffic class) Bandwidth |
|---|---|---|---|
| 0 | Default Traffic | No | 29% |
| 3 | CSV/Live Migration | No | 20% |
| 4 | iSCSI | No | 50% |
| 7 | Cluster Heartbeat | No | 1% |
| TBD (To Be Determined)* | *Backup (optional)* | No | *Needs allocation* |

---

## BGP (Border Gateway Protocol) Design

- **Underlay**: eBGP (External BGP — BGP sessions between routers in different ASNs, used here between leaf and spine switches because each leaf pair has its own ASN) unnumbered (RFC (Request for Comments — an IETF (Internet Engineering Task Force) standards document) 5549 — a technique that uses IPv6 (Internet Protocol version 6 — the 128-bit successor to IPv4) link-local addresses to advertise IPv4 (Internet Protocol version 4 — the 32-bit addressing standard) routes, eliminating the need for /30 or /31 point-to-point subnets on every inter-switch link)
- **Overlay**: MP-BGP (Multiprotocol BGP — extensions to BGP defined in RFC 4760 that allow it to carry multiple address families, including L2VPN (Layer 2 Virtual Private Network) EVPN for MAC and IP route advertisement)
- **BFD (Bidirectional Forwarding Detection — a lightweight protocol defined in RFC 5880 that provides sub-second failure detection between two forwarding engines, much faster than relying on BGP hold timers)** for fast failover
- **ECMP (Equal-Cost Multi-Path — a routing technique that load-balances traffic across multiple routes of equal cost, distributing flows using a hash of packet headers)**: min 16-way, recommended 64-way
- **iBGP (Internal BGP — BGP sessions between routers within the same ASN; here used between Leaf-A and Leaf-B in the same rack to synchronize routing tables)**: Port 49, syncs routes between Leaf-A and Leaf-B per rack

---

## Implementation Plan

### Phase 1: Restructure Step 1 (Connectivity-First)

**Goal**: Split current Step 1 into Step 1a (Deployment Mode) and Step 1b (Architecture).

| Task | Detail |
|---|---|
| 1.1 | Rename `state.scenario` values: `'hyperconverged'` → `'connected'`, `'multirack'` → `'rackscale'` (~5 places in script.js where scenario is assigned) |
| 1.2 | Add `state.architecture` property: `'hyperconverged'` \| `'disaggregated'` |
| 1.3 | Update Step 1 HTML (HyperText Markup Language — the standard markup language for web pages) cards: Connected \| Disconnected \| Rack Scale \| M365 Local |
| 1.4 | Add Step 1b HTML section: Hyperconverged \| Disaggregated cards |
| 1.5 | Update `selectOption()` in script.js to handle Step 1b |
| 1.6 | Update `updateUI()` to show/hide Step 1b based on Step 1a selection |
| 1.7 | Guard existing HCI (Hyper-Converged Infrastructure — an architecture that combines compute, storage, and networking in each node)-specific steps with `state.architecture === 'hyperconverged'` |
| 1.8 | **Zero changes to disconnected.js** — `state.scenario === 'disconnected'` still works |

**Refactoring impact**: ~5 renames + ~10 architecture guards. Disconnected logic untouched.

### Phase 2: Disaggregated Wizard Steps (DA1–DA10) + Shared Steps

#### Disaggregated-Specific Steps

| Step | Purpose | Key Inputs |
|---|---|---|
| **DA1: Storage Type** | FC (Fibre Channel) SAN, iSCSI (Internet Small Computer Systems Interface) 4-NIC, or iSCSI 6-NIC | Radio selection |
| **DA2: Backup Network** | Optional toggle — "Enable in-guest VM Backup network?" | When enabled: adds 2 ports/node, Backup VLAN/VNI, QoS class. **For iSCSI 6-NIC, warn about port conflict.** |
| **DA3: Scale** | Number of racks (1–4), nodes per rack (dynamically constrained by DA1+DA2), total (up to 64) | Auto-calculates max nodes/rack based on leaf port budget. Syncs `state.nodes` for shared steps. |
| **DA4: Spine Count** | 2 or 4 spines | Driven by rack count (≤2 racks → 2 spines, >2 → recommend 4) |
| **DA5: VLANs, VNI (VXLAN Network Identifier) & VRF (Virtual Routing and Forwarding)** | VLAN IDs, VNI mappings, VRF name, tenant VLANs | Pre-populated defaults, editable. Includes Backup VLAN if DA2 enabled |
| **DA6: QoS (Quality of Service) Policy** | Auto-derived from DA1+DA2. FC → no iSCSI QoS. iSCSI → full QoS. Backup → additional class | Summary with customizable ETS (Enhanced Transmission Selection) bandwidth percentages |
| **DA7: IP (Internet Protocol) Planning** | Loopback IPs, management subnets, iSCSI target IPs, static routes, ASN (Autonomous System Number) per rack | Auto-generated from scale inputs |
| **DA8: Summary & Rack Layout** | Review configuration, rack layout diagram | SVG diagram with download |
| **DA9: Node Configuration** | Node names per rack (NetBIOS-compatible, max 15 chars, unique) | Node names grouped by rack, auto-populated with defaults (Node1, Node2, etc.) |
| **DA10: Network Adapter Configuration** | NIC adapter names per function, standalone NIC subnets | NIC names for OCP, Cluster, iSCSI, Backup, BMC; subnets for each standalone VLAN |

#### Shared Steps (reused from HCI flow)

After DA10, the disaggregated flow continues with these existing shared steps:

| Shared Step | Section ID | What it collects | Notes for Disaggregated |
|---|---|---|---|
| **Azure Cloud** | `step-cloud` | Cloud type (Azure Global, Azure Government, Azure China) | Same as HCI |
| **Azure Region** | `step-local-region` | Azure Local instance region | Same as HCI |
| **Outbound Connectivity** | `step-7` | Direct, proxy, or firewall | Same as HCI |
| **Arc Gateway** | `step-8` | Arc Gateway enabled/disabled | Same as HCI |
| **Proxy Configuration** | `step-9` | Proxy URL, bypass list | Same as HCI |
| **Private Endpoints** | `step-9b` | PE services (keyvault, storage, etc.) | Same as HCI |
| **Management Connectivity** | `step-10` | Static/DHCP, node names + IPs, gateway | Node count driven by DA3 (`state.nodes` synced) |
| **Infrastructure VLAN** | `step-11` | Default or custom VLAN ID | May align with DA5 mgmt VLAN |
| **Infrastructure Network** | `step-12` | CIDR, IP pool, gateway | Same as HCI |
| **Active Directory** | `step-13` | AD / Local Identity, domain, DNS, NTP | Same as HCI |
| **Security Configuration** | `step-13-5` | Recommended or customized security | Same as HCI |

#### Steps Hidden for Disaggregated (HCI-only)

| HCI Step | Section ID | Why hidden |
|---|---|---|
| Scale (Cluster Config) | `step-2` | Disaggregated uses DA3 instead |
| Cluster Size | `step-3` | Node count comes from DA3 (racks × nodes) |
| Local Availability Zones | `step-3-5` | Clos fabric replaces rack-aware zones |
| Storage Connectivity | `step-4` | External SAN replaces S2D switched/switchless |
| Network Adapter Ports | `step-5` | DA10 handles disaggregated NIC layout |
| Network Traffic Intents | `step-6` | Only OCP uses SET intent; rest are standalone |
| Storage Pool Config | `step-5-5` | S2D concept, not for external SAN |
| SDN | `step-14` | Clos fabric provides SDN at network layer |

#### Complete Disaggregated Wizard Sequence

**Connected + Disaggregated:**
```
1a: Connected → 1b: Disaggregated → DA1 → DA2 → DA3 → DA4 → DA5 → DA6 → DA7 → DA8 → DA9 → DA10 →
Cloud → Region → Outbound → Arc GW → Proxy → PE → Mgmt Connectivity → Infra VLAN → Infra Network → AD → Security → Report
```

**Disconnected + Disaggregated:**
```
1a: Disconnected → D1 → D2 → D3 → 1b: Disaggregated → DA1 → DA2 → DA3 → DA4 → DA5 → DA6 → DA7 → DA8 → DA9 → DA10 →
Cloud → Region → Outbound → Arc GW → Proxy → PE → Mgmt Connectivity → Infra VLAN → Infra Network → AD → Security → Report
```

### Phase 3: Output Artifacts

- **Network topology diagram** (multi-rack Clos visualization)
- **Per-rack wire map** (leaf port assignments per storage type + backup)
- **NIC (Network Interface Card) layout summary** (per-node, all slots for chosen config)
- **Host networking diagram** (disaggregated-specific: SET intent for OCP + standalone NICs)
- **Cisco NX-OS reference configs** (QoS, interfaces, BGP, VXLAN EVPN, VRF)
- **Host NIC configuration commands** (SET (Switch Embedded Teaming) teams, VLAN assignments)
- **iSCSI static route commands** (when applicable)
- **VLAN-to-VNI mapping table** (including Backup VNI if enabled)
- **QoS policy output** (with Backup class if enabled)
- **ARM template** (disaggregated variant)
- **Configuration report** (full deployment summary)

### Phase 4: Code Structure

| File | Action | Detail |
|---|---|---|
| `index.html` | Edit | Restructure Step 1 cards, add Step 1b, add DA1–DA10 HTML sections |
| `js/script.js` | Edit | Rename scenario values, add `state.architecture`, extend `selectOption()` + `updateUI()`, add disagg state properties, update `getReportReadiness()` |
| `js/disaggregated.js` | **New** | Wizard logic for DA1–DA10, port budget calculator, NIC layout, node config, rack diagram generator |
| `js/nav.js` | Edit | Add Step 1b + DA step navigation |
| `js/validation.js` | Edit | Disaggregated validation rules |
| `js/disconnected.js` | **No change** | `state.scenario === 'disconnected'` still works |
| `report/report.js` | Edit | Add disaggregated report section, host networking diagram, ARM template variant |
| `switch-config/templates/` | **New files** | Clos topology templates (leaf, spine, service leaf) |
| `css/style.css` | Edit | CSS (Cascading Style Sheets — the language that defines visual presentation of HTML elements) styles for new DA steps and Clos diagram |

### Key Design Decisions

1. **Connectivity-first Step 1** — Deployment Mode (connected/disconnected) is the top-level decision; Architecture (hyperconverged/disaggregated) is the second-level decision
2. **Disconnected logic untouched** — `state.scenario === 'disconnected'` remains the trigger for all ~30 existing disconnected checks
3. **DA1–DA10 + shared steps** — Disaggregated has 10 unique steps (DA1–DA10) followed by 11 shared steps from the HCI flow, for a total of 21 steps. HCI-only steps (scale, cluster size, ports, intents, storage pool, SDN) are hidden.
4. **`state.nodes` synced from DA3** — The shared step-10 uses `state.nodes` for node name/IP row generation. DA3 syncs `state.nodes = String(rackCount × nodesPerRack)` so shared steps work without modification.
5. **Dynamic port budget calculator** — max nodes/rack changes based on storage type + backup toggle
6. **iSCSI 6-NIC + Backup conflict handling** — wizard warns and constrains
7. **Backup is opt-in early** — DA2 before Scale because it affects all downstream calculations

---

## Standalone NICs vs. Intents: The Disaggregated Networking Model

### The Problem: Existing HCI Intent System Does Not Apply

In Hyperconverged mode, Odin uses Azure Local's **Network ATC (Adaptive Traffic Control — Windows feature that automates NIC teaming, QoS, and VLAN configuration) intent system**. The user selects one of four intent patterns:

| Intent | NICs Grouped Into | SET Teaming |
|---|---|---|
| `all_traffic` | Single group: Management + Compute + Storage | All NICs in one SET team |
| `mgmt_compute` | Group 1: Management + Compute (SET) / Group 2: Storage | Mixed |
| `compute_storage` | Group 1: Management (SET) / Group 2: Compute + Storage | Mixed |
| `custom` | User-defined grouping per NIC | User-defined |

This is tracked by `state.intent`, `state.customIntents`, `state.intentOverrides`, `state.adapterMapping`, and produces ARM (Azure Resource Manager — Azure's deployment and management layer) template output via `getIntentNicGroups()`, `getStorageNicIndicesForIntent()`, `getStorageVlans()`, etc.

**In Disaggregated mode, this model does not work because:**

1. **Only the OCP (2-port) NIC uses a SET team** — for Compute + Management on a trunk port (VLAN 7 native + tenant VLANs)
2. **Cluster NICs (PCIe1, 2-port) are standalone** — each NIC connects independently to a different leaf on a dedicated access VLAN (NIC3 → Leaf-A VLAN 711, NIC4 → Leaf-B VLAN 712). No SET teaming, no intent grouping
3. **iSCSI NICs (PCIe2, 2-port in 6-NIC option) are standalone** — each NIC connects independently to a different leaf on a dedicated access VLAN (NIC5 → Leaf-A VLAN 500, NIC6 → Leaf-B VLAN 600). MPIO (Multipath I/O) for multipathing, no SET teaming
4. **iSCSI NICs (4-NIC option) share PCIe1 trunk** — CSV/LM + iSCSI on the same physical NIC but tagged VLANs (300 for CSV/LM, 500 for iSCSI). This is a trunk port, not SET-teamed
5. **FC HBAs (Fibre Channel) are completely outside Ethernet** — no leaf port, no VLAN, no intent. Connected to dedicated FC switches with MPIO
6. **Backup NICs (optional, 2-port) can be SET or standalone** — connected to leaf ports 33–48 on a dedicated VLAN (e.g., 800)

### Key Difference: Intents vs. Standalone NIC Assignment

| Aspect | HCI (Hyperconverged) | Disaggregated |
|---|---|---|
| NIC grouping model | Network ATC intents (SET teams + traffic types) | Fixed NIC-to-function mapping per slot |
| User choice | Which traffic types to group (4 patterns) | Which storage type (determines NIC count + layout) |
| Storage NIC config | Intent-driven (Storage VLAN per intent group) | Standalone: each NIC on its own access VLAN, separate subnet |
| Cluster NIC config | Part of intent (grouped with Compute or Storage) | Always standalone: NIC3 = VLAN 711, NIC4 = VLAN 712 |
| RDMA requirement | Required for S2D storage NICs | Not required — iSCSI is loss-tolerant, FC is separate fabric |
| Subnet assignment | `storageAutoIp` or `customStorageSubnets` per intent | Each standalone NIC needs its own subnet + VLAN + (optional) gateway |
| ARM template output | `intentList` + `storageNetworkList` | Different ARM structure — standalone adapters + VRF + VXLAN config |

### What Odin Must Capture for Disaggregated

For each standalone NIC function, Odin needs to collect **VLAN ID + Subnet + IP assignment** per NIC per node. This is fundamentally different from the HCI model where VLANs/subnets are captured per intent group.

#### Per-NIC Network Configuration Required

| NIC Function | VLAN | Subnet | IP Assignment | Gateway | Notes |
|---|---|---|---|---|---|
| **OCP (Compute + Mgmt)** | VLAN 7 (native) + tenant VLANs (trunk) | Infra subnet (e.g., 10.0.7.0/24) | Per-node static or DHCP (Dynamic Host Configuration Protocol) | Yes — Anycast GW | Only NIC with a default gateway |
| **PCIe1 NIC3 (Cluster → Leaf-A)** | VLAN 711 (access) | Cluster-A subnet (e.g., 10.71.1.0/24) | Per-node static | No default GW | Standalone, no SET |
| **PCIe1 NIC4 (Cluster → Leaf-B)** | VLAN 712 (access) | Cluster-B subnet (e.g., 10.71.2.0/24) | Per-node static | No default GW | Standalone, no SET |
| **PCIe2 NIC5 (iSCSI → Leaf-A)** | VLAN 500 (access) | iSCSI-A subnet (e.g., 10.50.1.0/24) | Per-node static | No default GW | 6-NIC option only, MTU 9216 |
| **PCIe2 NIC6 (iSCSI → Leaf-B)** | VLAN 600 (access) | iSCSI-B subnet (e.g., 10.60.1.0/24) | Per-node static | No default GW | 6-NIC option only, MTU 9216 |
| **iSCSI shared on PCIe1 (4-NIC)** | VLAN 500 (tagged on trunk) | iSCSI subnet (e.g., 10.50.0.0/24) | Per-node static | No default GW | Shares PCIe1 with Cluster |
| **Backup NIC7 (→ Leaf-A)** | VLAN 800 (access or trunk) | Backup subnet (e.g., 10.80.0.0/24) | Per-node static | No default GW | Optional |
| **Backup NIC8 (→ Leaf-B)** | VLAN 801 or shared 800 | Backup-B subnet | Per-node static | No default GW | Optional |

#### iSCSI Host Static Routes (Required for iSCSI Options)

When iSCSI targets are on a different subnet (one or more L3 hops away), each host needs persistent static routes:

```
# Example: iSCSI target at 172.16.50.10/32
New-NetRoute -DestinationPrefix "172.16.50.10/32" -InterfaceAlias "NIC5-iSCSI-A" -NextHop "10.50.1.1"
New-NetRoute -DestinationPrefix "172.16.50.10/32" -InterfaceAlias "NIC6-iSCSI-B" -NextHop "10.60.1.1"
```

Odin must generate these static route commands based on user-provided iSCSI target IPs.

### State Object: New Disaggregated Networking Properties

```javascript
// Disaggregated NIC/Network configuration
state.disaggStorageType       // 'fc_san' | 'iscsi_4nic' | 'iscsi_6nic'
state.disaggBackupEnabled     // true | false

// Per-function VLAN IDs (defaults from guide, user-editable)
state.disaggVlans = {
    mgmt: 7,           // OCP — Management (native)
    compute: [6, 200, 301, 400],  // OCP — Tenant VLANs (trunk, array for multiple tenants)
    clusterA: 711,      // PCIe1 NIC3 — Cluster Leaf-A (access)
    clusterB: 712,      // PCIe1 NIC4 — Cluster Leaf-B (access)
    iscsiA: 500,        // PCIe2 NIC5 — iSCSI Leaf-A (access) — 6-NIC only
    iscsiB: 600,        // PCIe2 NIC6 — iSCSI Leaf-B (access) — 6-NIC only
    iscsiShared: 500,   // PCIe1 — iSCSI (tagged on trunk) — 4-NIC only
    backupA: 800,       // Backup NIC7 — optional
    backupB: 801        // Backup NIC8 — optional
};

// Per-function subnets (one per standalone NIC function)
state.disaggSubnets = {
    mgmt: '10.0.7.0/24',
    clusterA: '10.71.1.0/24',
    clusterB: '10.71.2.0/24',
    iscsiA: '10.50.1.0/24',      // 6-NIC only
    iscsiB: '10.60.1.0/24',      // 6-NIC only
    iscsiShared: '10.50.0.0/24', // 4-NIC only
    backupA: '10.80.0.0/24',     // optional
    backupB: '10.80.1.0/24'      // optional
};

// Per-function gateway IPs (Anycast GW on each leaf, same IP active everywhere)
state.disaggGateways = {
    mgmt: '10.0.7.1',
    clusterA: null,      // No default GW — standalone
    clusterB: null,      // No default GW — standalone
    iscsiA: '10.50.1.1', // Next-hop for static routes only
    iscsiB: '10.60.1.1'  // Next-hop for static routes only
};

// iSCSI target IPs for static route generation
state.disaggIscsiTargets = []; // e.g., ['172.16.50.10', '172.16.50.11']

// VNI mapping (auto-calculated from VLANs: VNI = 10000 + VLAN ID)
state.disaggVnis = {};  // auto-derived

// Per-node IP assignments (generated from subnets + node count)
state.disaggNodeIps = []; // Array of per-node objects with IPs for each NIC function
```

### Impact on Existing Odin Logic

| Existing Code | Impact | Action |
|---|---|---|
| `state.intent` / `getIntentNicGroups()` | Not applicable to disaggregated | Guard with `state.architecture === 'hyperconverged'` |
| `state.ports` / `state.portConfig` | Disaggregated has fixed NIC layout per storage type | Replace with `state.disaggStorageType` → derived NIC count |
| `state.storage` (switched/switchless) | Disaggregated has no S2D | Guard with `state.architecture === 'hyperconverged'` |
| `state.storageAutoIp` / `state.customStorageSubnets` | Disaggregated uses per-function subnets | New `state.disaggSubnets` for each standalone NIC |
| `getStorageVlans()` | Returns VLANs from intent overrides | Disaggregated VLANs come from `state.disaggVlans` directly |
| `storageNetworkList` (ARM output) | ARM-specific storage VLAN + adapter mapping | Disaggregated needs different ARM output for standalone adapters |
| RDMA validation | Checks RDMA per NIC for S2D | Skip RDMA validation when `state.architecture === 'disaggregated'` |
| Step 6 (Intent/Traffic) | Shows intent picker and NIC assignment | Replace with disaggregated NIC layout summary when architecture is disaggregated |
| Step 7 (Network settings) | Infra VLAN, storage VLANs, subnets | Extend to show all disaggregated VLANs/subnets per standalone NIC |

### How This Fits in the Wizard

The disaggregated wizard step **DA5: VLANs, VNI & VRF** is where all this configuration is captured. It replaces the HCI model of "pick an intent → configure storage VLANs" with:

1. **Show the NIC layout** derived from DA1 (storage type) + DA2 (backup) — clearly show which NICs are SET-teamed and which are standalone
2. **For each standalone NIC function**, show editable fields for:
   - VLAN ID (pre-populated from guide defaults)
   - Subnet (CIDR notation, pre-populated)
   - Gateway (only for management; others show "No default GW — standalone")
3. **For SET-teamed OCP NICs**, show:
   - Native VLAN (management)
   - Trunk VLANs (tenant list, editable)
4. **VNI auto-calculation**: VNI = 10000 + VLAN ID, shown read-only
5. **VRF name**: editable, default "AZLOCAL"

The existing HCI intent logic (`state.intent`, `getIntentNicGroups`, etc.) is **completely bypassed** when `state.architecture === 'disaggregated'`. Every reference to these functions in the codebase must be guarded.

---

## Dynamic Rack Layout Diagram Builder

### Overview

The rack layout diagrams for Disaggregated are built as **pure inline SVG (Scalable Vector Graphics)**, generated by JavaScript string concatenation — no external libraries required. This follows the same pattern as the existing HCI rack diagram in `report/rack-svg.js`.

### Reference Examples (in repository)

| File | Scenario | Purpose |
|---|---|---|
| `Disaggregated/disaggregated-rack-example.html` | 4 racks × 16 nodes, single cluster, FC SAN, 2 spines | Base single-cluster reference |
| `Disaggregated/multi-cluster-rack-layout.html` | 8 racks × 16 nodes, 2 clusters (VRF A/B), shared spines | Multi-cluster reference |
| `Disaggregated/8rack-8node-rack-layout.html` | 8 racks × 8 nodes, single cluster, power-constrained | Reduced node count reference |

### SVG Construction Pattern

The diagram is built from a configuration object and a set of drawing helper functions:

```javascript
// Input configuration (driven by wizard state)
const config = {
    storageType: 'fc_san',        // 'fc_san' | 'iscsi_4nic' | 'iscsi_6nic'
    backupEnabled: false,          // true | false
    rackCount: 4,                  // 1–8
    nodesPerRack: [16, 16, 16, 16], // array of node counts per rack
    spineCount: 2,                 // 2 | 4
    clusterCount: 1,               // 1 | 2 (for multi-cluster)
    racksPerCluster: [4],          // array: how many racks per cluster
    clusterNames: ['VRF A'],       // cluster labels
    baseAsn: 64789                 // starting ASN for first rack leaf pair
};
```

### Coordinate System & Constants

```javascript
const RACK_W = 210;     // Rack width in SVG units
const RACK_GAP = 30;    // Gap between racks
const U_H = 14;         // Height of 1 rack unit (1U)
const TOTAL_U = 42;     // Standard 42U rack
const HEADER_H = 160;   // Space above racks for spines + service leafs
const FOOTER_H = 120;   // Space below racks for SAN arrays + legend
```

Total SVG width = `RACK_GAP + (rackCount × (RACK_W + RACK_GAP))`
Total SVG height = `HEADER_H + (TOTAL_U × U_H) + FOOTER_H`

### Color Palette

```javascript
const C = {
    SERVER:       '#555555',  // Server nodes
    LEAF_SWITCH:  '#888888',  // Leaf switches (Leaf-A, Leaf-B)
    BMC_SWITCH:   '#e0e0e0',  // BMC switch (light grey, isLight: true)
    FC_SWITCH:    '#7c3aed',  // FC switches (purple)
    SPINE_SWITCH: '#1a6fc4',  // Spine switches (blue)
    SERVICE_LEAF: '#14b8a6',  // Service leaf pair (teal)
    SAN_STORAGE:  '#9333ea',  // SAN storage arrays (deep purple)
    CLUSTER_A:    '#1a6fc4',  // Cluster 1 accent (blue)
    CLUSTER_B:    '#14b8a6',  // Cluster 2 accent (teal)
};
```

### Drawing Helper Functions

#### `drawDevice(label, ox, oy, uStart, heightU, color, options)`
Draws a single device (switch, BMC) inside a rack at a specific U position.

- `ox, oy` = rack top-left corner
- `uStart` = starting U position (42 = top of rack, 1 = bottom)
- `heightU` = height in rack units (1U or 2U)
- `color` = fill color
- `options.isLight` = use dark text if background is light
- `options.statusColor` = color of status LED dots (green, amber, red)

**Positioning formula** (fixed for multi-U devices):
```javascript
const innerH = TOTAL_U * U_H;   // 588px for 42U
const dy = oy + 6 + innerH - uStart * U_H + 1;
// Device rect: dy to dy + (heightU * U_H - 2)
```

#### `drawServer(label, ox, oy, uStart, color)`
Draws a 2U server node with:
- Colored rect (2U height)
- 6 drive bay indicators (small rectangles at left)
- 2 status LEDs (green dots)
- Semi-transparent dark overlay for depth effect

Uses same positioning formula as `drawDevice` for consistency.

#### `drawRack(rackIndex, ox, oy, config)`
Draws a complete rack with all devices stacked:
- U42: Leaf-A
- U41: Leaf-B
- U40: BMC switch (1U)
- U39 down: Server nodes (2U each, starting from top)
- U2–U1 (bottom): FC switches (if FC SAN option selected)

Rack background: dark grey rect (`#1a1a2e`) with subtle border.

#### `drawSpineLayer(totalWidth, config)`
Draws the spine + service leaf layer above the racks:
- Spine switches centered at top (blue, rounded rect with LED indicators)
- Service leaf pair below spines (teal, rounded rect)
- ASN labels inside each switch

#### `drawSanLayer(y, totalWidth, config)`
Draws the SAN storage arrays below the racks:
- 2 arrays: Fabric A (left half) + Fabric B (right half)
- Purple rounded rects with FC speed label

#### Connector Lines

All connectors use **dashed lines** (SVG `stroke-dasharray`) with light colors at 0.25 opacity:

| Connection | Color | Dash Pattern |
|---|---|---|
| Spine ↔ Leaf | `#7dd3fc` (light sky blue) | `4,3` |
| Spine ↔ Service Leaf | `#5eead4` (light teal) | `4,3` |
| FC Switch ↔ SAN Array | `#c4b5fd` (light purple) | `6,4` |

### Dynamic Generation Logic

The generator function takes the config object and:

1. **Calculates dimensions** based on rack count + cluster count
2. **Draws background + title** with subtitle showing configuration summary
3. **Draws spine layer** (spines + service leafs)
4. **Iterates racks**: for each rack, calls `drawRack()` which stacks devices top-to-bottom
5. **Draws inter-rack connectors**: spine-to-leaf lines, FC-to-SAN lines
6. **Draws SAN layer** at bottom (FC SAN only) or iSCSI target indicators
7. **Draws cluster dividers** (multi-cluster: dashed vertical line between groups)
8. **Draws legend + summary** (device color key, U count, node count, rack count)
9. **Returns complete `<svg>` string** that can be inserted into DOM or downloaded

### Conditional Elements by Storage Type

| Element | FC SAN | iSCSI 4-NIC | iSCSI 6-NIC |
|---|---|---|---|
| FC switches in rack | Yes (U2, U1) | No | No |
| SAN arrays below racks | Yes (Fabric A/B) | iSCSI target indicator | iSCSI target indicator |
| FC→SAN connector lines | Yes | No | No |
| Port range labels on leaves | P33-48: Reserved/Backup | P33-48: Reserved/Backup | P33-48: iSCSI |
| Server NIC label | OCP + PCIe1 + FC | OCP + PCIe1 (shared) | OCP + PCIe1 + PCIe2 |

### Multi-Cluster Layout

When `clusterCount > 1`:
- Racks are grouped by `racksPerCluster[i]`
- Each cluster group gets a colored accent strip on the rack headers (Cluster A = blue, Cluster B = teal)
- A dashed vertical divider line separates cluster groups
- Cluster label appears above each group (e.g., "Cluster 1 — VRF A (64 Nodes)")
- Each cluster can have its own FC SAN fabric pair at the bottom

### Responsive Behavior

- For rack counts ≤ 4: standard horizontal layout
- For rack counts 5–8: single row still works but racks are narrower (reduce `RACK_W`)
- The SVG `viewBox` allows scaling to any container size while maintaining aspect ratio

---

## SDN (Software Defined Networking) in Disaggregated vs. Hyperconverged

### What the Reference Document Says

The guide draws a clear and explicit line between SDN in the two architectures:

> **"Microsoft SDN for hyperconverged clusters (up to 16 nodes) and external SDN for disaggregated clusters from 1 to 64 nodes"**

#### Hyperconverged SDN (Existing in Odin — Step 19)

Microsoft SDN managed by Azure Arc only (legacy SDN removed):
- **Scope**: Cluster-scoped — each cluster runs its own Network Controller (NC)
- **Scale limit**: Up to 16 nodes within a single rack
- **Management**: Arc-managed only — legacy on-premises managed SDN (with VNET, SLB, Gateway VMs) is no longer supported
- **Features**: LNET (Logical Networks), NSG (Network Security Groups) — VNET (Virtual Networks) and SLB (Software Load Balancer) have been removed as they are legacy components
- **Key constraint**: Network Controllers do NOT coordinate policies, address space, or operations across clusters — prevents centralized multi-rack/multi-cluster SDN management
- **In Odin**: `state.sdnEnabled` (yes/no) → LNET + NSG feature selection → management auto-set to `'arc_managed'` (no user choice needed since Arc is the only option)

#### Disaggregated SDN (New — External / Fabric-Level)

The Clos fabric itself provides the SDN functions that Microsoft SDN handles in HCI:

| Microsoft SDN Function (HCI) | Clos Fabric Equivalent (Disaggregated) | Who Manages It |
|---|---|---|
| Network virtualization (VNET) | VXLAN (Virtual Extensible LAN) EVPN (Ethernet VPN) overlay — each cluster is a VRF (Virtual Routing and Forwarding) with VLAN-to-VNI (VXLAN Network Identifier) mapping | External network controller / switch config |
| Network Security Groups (NSG) | Fabric ACLs (Access Control Lists — rules that permit or deny traffic), policy enforcement at service leaf | External network controller / switch config |
| Logical Networks (LNET) | VRF-based L3 (Layer 3) routing + anycast gateway on all leaves | Switch config (built into Clos design) |
| Software Load Balancer (SLB) | External load balancer pair connected at service leaf layer | 3rd party LB appliance |
| Gateway (GW) | Service leaf pair handles DC core peering + route leaking between VRFs | Switch config |

**The key insight**: In disaggregated, there is **no Microsoft SDN Network Controller**. The Clos fabric (VXLAN EVPN + VRF + anycast gateway + service leaf) replaces it entirely. SDN capabilities are delivered by the **switch infrastructure**, not by Windows VMs.

### Impact on Odin Logic

#### Current SDN Step (Step 19) — HCI Only

The existing SDN step in Odin captures:
1. `state.sdnEnabled` — 'yes' or 'no'
2. `state.sdnFeatures[]` — array of ['lnet', 'nsg', 'vnet', 'slb']
3. `state.sdnManagement` — 'arc_managed' or 'onprem_managed'

This step and its validation logic **must be hidden/skipped when `state.architecture === 'disaggregated'`** because:
- Microsoft SDN is explicitly NOT supported for disaggregated (guide states this directly)
- The VXLAN EVPN overlay IS the SDN — it's configured in the switch config, not in Windows
- There are no Network Controller VMs to deploy
- Network security = fabric ACLs at service leaf, not Windows NSGs

#### What Disaggregated Needs Instead

Instead of the HCI SDN step, disaggregated needs **fabric-level SDN configuration** captured across DA5 (VLANs/VNI/VRF) and DA8 (Switch Config Generation):

| Odin Captures (existing DA steps) | Maps to SDN Function |
|---|---|
| DA5: VLAN IDs + VNI mappings | Network virtualization (replaces VNET) |
| DA5: VRF name per cluster | Tenant isolation (replaces LNET) |
| DA5: Tenant VLANs | VM network segments |
| DA8: Service leaf config (route leaking, DC core peering) | Gateway function (replaces SDN Gateway) |
| DA8: Leaf anycast gateway SVIs (Switched Virtual Interfaces — L3 interfaces on a VLAN) | Default gateway for all hosts (replaces HSRP VIP) |
| DA8: Fabric ACL templates (optional) | Traffic filtering (replaces NSG) |

#### New State Properties for Disaggregated SDN

```javascript
// These already exist in DA5/DA8 — no separate SDN step needed
state.disaggVlans         // VLAN IDs per function (mgmt, cluster, tenant, iSCSI, backup)
state.disaggVnis          // VNI mappings per VLAN
state.disaggVrfName       // VRF name for the cluster (e.g., 'AZLOCAL')
state.disaggTenantVlans   // Array of tenant VLAN objects [{id, name, vni, subnet, gateway}]

// Optional: external service integration (connected at service leaf)
state.disaggExternalLB    // true/false — has external load balancer pair
state.disaggExternalFW    // true/false — has external firewall pair
state.disaggFabricController // '3rd_party' | 'manual' — who manages the Clos switches
```

#### Service Leaf Integration Points (New Information for DA8)

The guide describes the service leaf as the integration boundary for external SDN appliances:

| Appliance | Connection Point | Purpose |
|---|---|---|
| **3rd Party Network Controller** | Service leaf (or management network) | Fabric automation & policy management for all Clos switches |
| **Load Balancer Pair** | Service leaf (LB-1 Active / LB-2 Standby with HA sync) | Traffic distribution for north-south application traffic |
| **Firewall Pair** | Service leaf (FW-1 Active / FW-2 Standby with HA sync) | Security and traffic inspection for north-south traffic |
| **ALDO (Azure Local Distributed Orchestrator)** | Service leaf / management network | Orchestrator and lifecycle management |

These are **optional** and should be captured in the wizard when `state.architecture === 'disaggregated'`:

| DA Step | New Question | Impact |
|---|---|---|
| DA8 (or new DA9) | "Will you use a 3rd party network controller?" | Affects service leaf port allocation + config output |
| DA8 (or new DA9) | "Will you deploy external load balancers?" | Adds LB pair to service leaf config + diagram |
| DA8 (or new DA9) | "Will you deploy external firewalls?" | Adds FW pair to service leaf config + diagram |

### Code Changes Required

| File | Change |
|---|---|
| `index.html` | Hide Step 19 (SDN) when `state.architecture === 'disaggregated'` |
| `js/script.js` | Guard SDN validation with `state.architecture === 'hyperconverged'` |
| `js/script.js` | Guard SDN reset with architecture check |
| `js/script.js` | Guard SDN summary output with architecture check |
| `js/nav.js` | Skip Step 19 in breadcrumb/navigation when disaggregated |
| `js/disaggregated.js` | DA5 captures VLAN/VNI/VRF (replaces SDN VNET/LNET) |
| `js/disaggregated.js` | DA8 generates service leaf config with ACLs (replaces NSG) |
| `js/disaggregated.js` | DA8/DA9 captures external appliance choices (LB, FW, controller) |

### Summary: SDN Responsibility Matrix

| Responsibility | Hyperconverged (HCI) | Disaggregated |
|---|---|---|
| Who provides SDN? | Microsoft SDN (Network Controller VMs) | Clos fabric (VXLAN EVPN + VRF) |
| Who manages SDN? | Azure Arc (only supported option) | External network controller or manual switch config |
| Network virtualization | LNET (Logical Networks, Arc-managed) | VXLAN EVPN overlay (switch-native) |
| Security groups | NSG (Network Security Groups, Arc-managed) | Fabric ACLs at service leaf (switch-enforced) |
| Load balancing | Not supported (legacy SLB removed) | External LB appliance at service leaf |
| Gateway | Not supported (legacy SDN Gateway removed) | Service leaf handles route leaking + DC core peering |
| Odin captures it in... | Step 19 (SDN) | DA5 (VLANs/VNI/VRF) + DA8 (Switch Config) + DA9 (External Appliances) |
| `state.sdnEnabled` used? | Yes | **No — skip entirely** |

---

## Storage-Type-Specific Rack Layout Diagrams

The dynamic rack layout SVG generator must produce visually distinct diagrams based on the selected storage type. Each SAN option changes what appears **inside each rack** and what appears **below the racks**.

### Visual Differences by Storage Type

| Element | FC SAN | iSCSI 4-NIC | iSCSI 6-NIC |
|---|---|---|---|
| **FC switches in rack** | Yes (U1 + U2: FC Switch A/B, purple `#7c3aed`) | **No** — removed entirely | **No** — removed entirely |
| **Storage below racks** | SAN Storage Array Fabric A/B (purple `#6d28d9`) | iSCSI Storage Array Target A/B (**orange** `#c2410c`) | iSCSI Storage Array Target A/B (**orange** `#c2410c`) |
| **Connector lines (rack → storage)** | FC-A → SAN-A, FC-B → SAN-B (purple dashed `#c4b5fd`) | Leaf-A → iSCSI-A, Leaf-B → iSCSI-B (**orange** dashed `#fdba74`) | Leaf-A → iSCSI-A, Leaf-B → iSCSI-B (**orange** dashed `#fdba74`) |
| **Storage sublabel** | "FC 32G / Connected to FC Switch A in each rack" | "iSCSI over Ethernet / Leaf Ports 17–32 (shared with CSV/LM)" | "iSCSI over Ethernet / Dedicated Leaf Ports 33–48, VLAN 500/600" |
| **Info note** | (none) | Orange-bordered note: "iSCSI 4-NIC: Storage + CSV/LM share PCIe1 ports..." | Orange-bordered note with **red warning**: "⚠ Ports 33–48 consumed by iSCSI — Backup requires shared trunk" |
| **Rack U usage** | 5 switches (2 Leaf + 1 BMC + 2 FC) = 5U | 3 switches (2 Leaf + 1 BMC) = 3U | 3 switches (2 Leaf + 1 BMC) = 3U |
| **Empty rack space** | U3–U7 gap between last node and FC switches | U1–U7 all empty (more free space) | U1–U7 all empty (more free space) |
| **Legend items** | Server, Leaf, BMC, **FC Switch**, Spine, Service Leaf, **SAN Storage** | Server, Leaf, BMC, Spine, Service Leaf, **iSCSI Storage** | Server, Leaf, BMC, Spine, Service Leaf, **iSCSI Storage** |

### Color Palette by Storage Type

```
FC SAN:
  FC Switch:     #7c3aed (purple)     — rack devices at U1/U2
  SAN Array:     #6d28d9 (deep purple) — below racks
  Connectors:    #c4b5fd (light purple) — FC-to-SAN dashed lines

iSCSI (both 4-NIC and 6-NIC):
  iSCSI Storage: #c2410c (burnt orange) — below racks
  Connectors:    #fdba74 (light orange) — leaf-to-storage dashed lines
  Note border:   #ea580c (orange)
  Warning text:  #f87171 (red, 6-NIC only)
```

### Dynamic Generator Logic

The `generateClosSvg(config)` function handles SAN type via a single `config.storageType` parameter:

```javascript
// Pseudo-code for SAN-specific rendering
if (config.storageType === 'fc_san') {
    // Draw FC Switch A at U2, FC Switch B at U1 inside each rack
    drawSwitch(ox, oy, 2, 'FC Switch ' + (r+1) + 'A', C.FC_SWITCH);
    drawSwitch(ox, oy, 1, 'FC Switch ' + (r+1) + 'B', C.FC_SWITCH);
    switchesPerRack = 5; // 2 Leaf + 1 BMC + 2 FC

    // SAN Arrays below racks (purple)
    drawStandaloneBox(..., C.SAN_ARRAY, 'SAN Storage Array — Fabric A', 'FC 32G...');
    drawStandaloneBox(..., C.SAN_ARRAY, 'SAN Storage Array — Fabric B', 'FC 32G...');

    // FC→SAN connector lines (purple dashed)
    drawConnector(fcSwitchBottom, sanArrayTop, '#c4b5fd');

} else { // iscsi_4nic or iscsi_6nic

---

## Edge Case: iSCSI 6-NIC + In-Guest Backup Compute Intent (vNIC Mode)

> **Date**: April 7, 2026
> **Status**: Implementation in progress
> **Trigger**: `state.disaggStorageType === 'iscsi_6nic' && state.disaggBackupEnabled === true`
> **Derived flag**: `state.disaggIscsiVnicMode = true`

### Problem Statement

The iSCSI 6-NIC topology normally uses 6 physical ports: OCP(2) + Cluster(2) + iSCSI dedicated PCIe2(2). Adding a backup network would require 8 physical ports: OCP(2) + Cluster(2) + iSCSI PCIe2(2) + Backup(2). However, TOR leaf switches cannot accommodate 8 network ports per node. The solution is to consolidate iSCSI and backup traffic onto the same physical ports using virtual NICs.

### Architecture

**6 physical ports per node:**

| Port | Physical NIC | Intent | Leaf Connection |
|---|---|---|---|
| OCP_P1 | OCP-NIC1 | Management + Compute Intent (SET) | Leaf-A |
| OCP_P2 | OCP-NIC2 | Management + Compute Intent (SET) | Leaf-B |
| PCIe1_P1 | PCIe1-NIC3 | Cluster 1 (Standalone) | Leaf-A |
| PCIe1_P2 | PCIe1-NIC4 | Cluster 2 (Standalone) | Leaf-B |
| PCIe2_P1 | PCIe2-NIC5 | **Backup Compute Intent (SET)** | Leaf-A |
| PCIe2_P2 | PCIe2-NIC6 | **Backup Compute Intent (SET)** | Leaf-B |

**iSCSI vNICs on the Backup Compute Intent SET:**

| vNIC | NIC Team Mapping | VLAN | 802.1p Priority | Target |
|---|---|---|---|---|
| iSCSI-A | pinned → PCIe2-NIC5 (PCIe2_P1) | iSCSI VLAN A (e.g., 500) | 3 (lossless) | iSCSI Target A via Leaf-A |
| iSCSI-B | pinned → PCIe2-NIC6 (PCIe2_P2) | iSCSI VLAN B (e.g., 600) | 3 (lossless) | iSCSI Target B via Leaf-B |

NIC team mapping (pinning) ensures deterministic pathing: iSCSI-A always routes through PCIe2_P1 → Leaf-A → Target A, and iSCSI-B through PCIe2_P2 → Leaf-B → Target B.

### Comparison: iSCSI 6-NIC With vs Without Backup

| Aspect | Without Backup | With Backup (vNIC mode) |
|---|---|---|
| Physical ports | 6 | 6 |
| PCIe2 slot role | iSCSI dedicated (standalone) | Backup SET team |
| iSCSI NIC type | Physical (standalone) | Virtual (vNIC on SET) |
| iSCSI path control | Direct physical → Leaf | NIC team mapping (pinned) → Leaf |
| DCB/QoS required on PCIe2 | No (single traffic type) | **Yes** (shared link) |
| Post-deployment steps | None | vNIC creation, team mapping, DCB/QoS |

### DCB / QoS Configuration Requirements

When iSCSI and backup traffic share the same physical ports, DCB (Data Center Bridging) and QoS (Quality of Service) are critical to prevent iSCSI storage starvation.

#### Traffic Classes

| Traffic Class | Priority | Traffic Type | Min Bandwidth | PFC (Priority Flow Control) |
|---|---|---|---|---|
| TC 0 | 0-2, 4-7 | Backup / Default | 40% | Disabled (lossy) |
| TC 3 | 3 | iSCSI Storage | 60% | **Enabled (lossless)** |

#### Why Lossless iSCSI

- iSCSI carries block storage I/O — packet drops cause SCSI retries, latency spikes, and potential cluster CSV heartbeat failures
- Backup traffic is TCP-based and tolerates drops (retransmit handles it)
- Without PFC on priority 3, a backup storm can drop iSCSI frames and destabilize the cluster

#### VLAN 802.1p Priority Tagging

| vNIC / Traffic | VLAN | 802.1p Priority |
|---|---|---|
| iSCSI-A vNIC | iSCSI VLAN A (e.g., 500) | 3 |
| iSCSI-B vNIC | iSCSI VLAN B (e.g., 600) | 3 |
| Backup traffic | Backup VLAN (e.g., 800) | 0 (default) |

#### Switch-Side Requirements (Leaf-A & Leaf-B ports connected to PCIe2)

- DCB: Enabled
- PFC: Priority 3 = Enabled, all others = Disabled
- ETS: Priority 3 = 60% minimum, Default = 40%
- Trust mode: dot1p (802.1p)
- VLANs: Trunk allowing iSCSI VLAN A, iSCSI VLAN B, Backup VLAN

### Post-Deployment PowerShell Commands

#### Step 1: Create iSCSI vNICs

```powershell
# Run on EACH node in the cluster
$BackupSwitchName = "BackupCompute"  # Verify via Get-VMSwitch

Add-VMNetworkAdapter -ManagementOS -SwitchName $BackupSwitchName -Name "iSCSI-A"
Add-VMNetworkAdapter -ManagementOS -SwitchName $BackupSwitchName -Name "iSCSI-B"
```

#### Step 2: Set VLAN Access Mode

```powershell
Set-VMNetworkAdapterVlan -ManagementOS -VMNetworkAdapterName "iSCSI-A" -Access -VlanId 500
Set-VMNetworkAdapterVlan -ManagementOS -VMNetworkAdapterName "iSCSI-B" -Access -VlanId 600
```

#### Step 3: Pin Each vNIC to a Specific Physical NIC (NIC Team Mapping)

```powershell
Set-VMNetworkAdapterTeamMapping -ManagementOS `
    -VMNetworkAdapterName "iSCSI-A" `
    -PhysicalNetAdapterName "PCIe2-NIC5"

Set-VMNetworkAdapterTeamMapping -ManagementOS `
    -VMNetworkAdapterName "iSCSI-B" `
    -PhysicalNetAdapterName "PCIe2-NIC6"
```

#### Step 4: Assign IP Addresses

```powershell
# Replace X with node-specific host octet
New-NetIPAddress -InterfaceAlias "vEthernet (iSCSI-A)" -IPAddress "10.50.1.X" -PrefixLength 24
New-NetIPAddress -InterfaceAlias "vEthernet (iSCSI-B)" -IPAddress "10.60.1.X" -PrefixLength 24
```

#### Step 5: Configure DCB / QoS

```powershell
Enable-NetAdapterQos -Name "PCIe2-NIC5"
Enable-NetAdapterQos -Name "PCIe2-NIC6"

New-NetQosPolicy -Name "iSCSI" -NetworkDirect -PriorityValue8021Action 3
New-NetQosTrafficClass -Name "iSCSI" -Priority 3 -BandwidthPercentage 60 -Algorithm ETS

Enable-NetQosFlowControl -Priority 3
Disable-NetQosFlowControl -Priority 0,1,2,4,5,6,7
```

#### Step 6: Verify Configuration

```powershell
Get-VMNetworkAdapter -ManagementOS | Where-Object Name -like "iSCSI*" |
    Select-Object Name, SwitchName, Status
Get-VMNetworkAdapterVlan -ManagementOS | Where-Object ParentAdapter -like "*iSCSI*"
Get-VMNetworkAdapterTeamMapping -ManagementOS |
    Where-Object NetAdapterName -like "*iSCSI*"
Get-NetQosPolicy | Where-Object Name -eq "iSCSI"
Get-NetQosTrafficClass | Where-Object Name -eq "iSCSI"
Get-NetQosFlowControl | Format-Table Priority, Enabled
```

### Implementation Plan — Wizard (js/disaggregated.js)

1. **DA10 port count**: iSCSI 6-NIC + backup = 6 ports only. Show 8-port greyed out with reason: "TOR port limit — iSCSI uses vNICs on Backup Compute Intent with NIC team mapping"
2. **Port list (`getDisaggPortList`)**: When `iscsi_6nic + backup`, PCIe2 slots become backup NICs (not iSCSI). No iSCSI physical ports in the list.
3. **DA10 info banner**: Callout explaining vNIC mode with team mapping details
4. **Overrides section**: iSCSI VLAN/Subnet overrides still shown, labeled as "iSCSI vNIC A" / "iSCSI vNIC B"

### Implementation Plan — Report Host Networking Diagram (report/report.js)

**SVG diagram (`renderDisaggregatedHostNetworkingDiagram`) when vNIC mode:**

- Backup group box (orange) contains 2 physical NIC cards (top) + 2 iSCSI vNIC cards (below)
- Physical NIC cards: solid orange fill/stroke, orange dashed lines UP to Leaf-A/B
- iSCSI vNIC cards: dashed/dotted border, purple tint, smaller size
  - Line 1: "iSCSI-A vNIC" (bold)
  - Line 2: "VLAN 500 · Priority 3"
  - Line 3: "mapped → PCIe2-NIC5" (italic, smaller)
- Purple dashed lines from vNICs DOWN to iSCSI Target A/B shapes
- Node box and Backup box grow taller to fit
- Note below diagram explains vNIC approach

**Draw.io export (`generateDisaggregatedHostNetworkingDrawio`):**
- Same layout mirrored in mxGraph XML

**Report summary table additions:**
- iSCSI Mode: vNIC on Backup Compute Intent
- iSCSI-A vNIC: VLAN 500 · mapped → PCIe2-NIC5 → Leaf-A
- iSCSI-B vNIC: VLAN 600 · mapped → PCIe2-NIC6 → Leaf-B
- iSCSI 802.1p Priority: 3 (lossless, PFC enabled)
- ETS Bandwidth: iSCSI 60% / Backup 40%

**Dedicated report section: "iSCSI vNIC Configuration (Post-Deployment)":**
- Full PowerShell commands (Steps 1-6 above)
- Switch-side DCB requirements
- Warning callout about storage stability
    // No FC switches in rack
    switchesPerRack = 3; // 2 Leaf + 1 BMC

    // iSCSI Storage Targets below racks (orange)
    var sublabelA, sublabelB;
    if (config.storageType === 'iscsi_4nic') {
        sublabelA = 'iSCSI over Ethernet / Leaf Ports 17-32 (shared with CSV/LM)';
        sublabelB = 'iSCSI over Ethernet / MPIO via Leaf-A and Leaf-B';
    } else { // iscsi_6nic
        sublabelA = 'iSCSI over Ethernet / Dedicated Leaf Ports 33-48, VLAN 500';
        sublabelB = 'iSCSI over Ethernet / Dedicated Leaf Ports 33-48, VLAN 600';
    }
    drawStandaloneBox(..., C.ISCSI_STORAGE, 'iSCSI Storage Array — Target A', sublabelA);
    drawStandaloneBox(..., C.ISCSI_STORAGE, 'iSCSI Storage Array — Target B', sublabelB);

    // Leaf→iSCSI connector lines (orange dashed, from rack bottom)
    drawConnector(rackBottom, iscsiArrayTop, '#fdba74');

    // Info/warning note
    if (config.storageType === 'iscsi_6nic') {
        drawWarningNote('⚠ Ports 33-48 consumed by iSCSI...');
    }
}
```

### Reference Example Files

| File | Storage Type | Description |
|---|---|---|
| `Disaggregated/disaggregated-rack-example.html` | FC SAN | 4 racks × 16 nodes, FC switches at U1/U2, purple SAN arrays |
| `Disaggregated/iscsi-4nic-rack-example.html` | iSCSI 4-NIC | 4 racks × 16 nodes, no FC switches, orange iSCSI targets, shared ports note |
| `Disaggregated/iscsi-6nic-rack-example.html` | iSCSI 6-NIC | 4 racks × 16 nodes, no FC switches, orange iSCSI targets, port conflict warning |
| `Disaggregated/multi-cluster-rack-layout.html` | FC SAN | 8 racks × 16 nodes, 2 clusters, shared spines |
| `Disaggregated/8rack-8node-rack-layout.html` | FC SAN | 8 racks × 8 nodes, power-constrained |

### Backup Network Impact on Diagrams

When `config.backupEnabled === true`, the diagram adds:
- **FC SAN + Backup**: Ports 33–48 annotation changes from "Reserved" to "Backup (VLAN 800)" — no visual rack change (FC switches stay at U1/U2)
- **iSCSI 4-NIC + Backup**: Ports 33–48 annotation shows "Backup (VLAN 800)" — no rack change
- **iSCSI 6-NIC + Backup**: **Red warning** in the note area — ports 33–48 already consumed by iSCSI, backup must share trunk or reduce max nodes

---

## Host Networking Diagrams for Disaggregated

### Current HCI (Hyperconverged Infrastructure) Host Networking Diagrams

The existing Odin report generates per-node host networking diagrams that show:

1. **ToR (Top-of-Rack) switches** at the top (1 or 2, with MLAG (Multi-Chassis Link Aggregation Group — a protocol that allows two physical switches to appear as one logical switch for link bundling) link between them)
2. **Node boxes** below, each containing:
   - **Intent group boxes** (dashed outlines) — "Management + Compute" (blue), "Storage" (purple), "Compute + Storage" (purple), etc.
   - **NIC port tiles** inside each intent group — colored by function, labeled with custom port names
3. **Uplink lines** from each NIC port tile up to the appropriate ToR switch (alternating ToR-1/ToR-2 for redundancy)
4. **Switchless mesh** (for switchless storage) — colored subnet lines at the bottom connecting storage ports directly between nodes

The diagram is generated by three main functions in `report/report.js`:
- `renderSwitchedIntentDiagram(state)` — SVG diagram for switched storage + single-node topologies (lines 3014–3615)
- `renderRackAwareTorArchitectureDiagram(state)` — SVG diagram for rack-aware with Zone1/Zone2 rooms, dual-TOR pairs, SMB trunks (lines 3616–4600+)
- `generateHostNetworkingDrawio(s)` — draw.io XML export version of the same layout (lines 1804–2260)

All three use the same data sources:
- `state.intent` — determines intent grouping (all_traffic, mgmt_compute, compute_storage, custom)
- `state.adapterMapping` — confirmed per-NIC assignment overrides
- `state.portConfig` — custom port names
- `state.torSwitchCount` — single or dual ToR
- `state.storage` — switched or switchless
- `state.storageAutoIp` — IP assignment mode
- `state.customIntents` — per-port custom intent assignments

### Why Disaggregated Needs a Different Diagram

The HCI diagrams assume:
1. **All NICs participate in Network ATC (Adaptive Traffic Control) intents** — SET teams, automatic traffic classification
2. **ToR switches use MLAG/HSRP** — active/standby pair with LAG link
3. **Storage NICs use RDMA** over the same Ethernet fabric
4. **1–2 ToR switches per room/zone**

**None of these apply to disaggregated:**

| Element | HCI Diagram | Disaggregated Diagram |
|---|---|---|
| Top switches | 1–2 ToR (MLAG/HSRP) | 2 Leaf switches (iBGP (Internal BGP — peering within same ASN) P49 link) per rack |
| Intent groups | All NICs inside intent boxes | Only OCP (Open Compute Project) NIC1/NIC2 in a SET intent; all other NICs are **standalone** |
| Storage ports | Inside "Storage" intent (RDMA) | **Standalone**: Cluster NICs on dedicated access VLANs, iSCSI on separate VLANs, FC on separate fabric |
| Uplink pattern | NIC → ToR (alternating) | OCP NIC1 → Leaf-A, OCP NIC2 → Leaf-B (SET); Cluster NIC3 → Leaf-A, NIC4 → Leaf-B (standalone); iSCSI NIC5 → Leaf-A, NIC6 → Leaf-B (standalone) |
| VLAN labeling | Implicit (ATC manages) | Explicit per-port VLAN ID shown on each NIC and leaf port |
| Additional fabric | None | FC switches + SAN (FC option), or iSCSI targets via Leaf (iSCSI options) |
| Backup | Not shown | Optional: 2 additional ports with dedicated VLAN |

### Proposed Disaggregated Host Networking Diagram

#### Visual Layout (per node, FC SAN example)

```
                Leaf-A                    Leaf-B
              (ASN 64789)              (ASN 64789)
            ┌──────────┐  iBGP P49  ┌──────────┐
            │          │◄──────────►│          │
            └──┬──┬──┬─┘            └─┬──┬──┬──┘
               │  │  │                │  │  │
    ┌──────────┼──┼──┼────────────────┼──┼──┼────────────┐
    │  Node 1  │  │  │                │  │  │             │
    │          │  │  │                │  │  │             │
    │  ┌── Compute + Mgmt (SET) ──┐  │  │  │             │
    │  │ ┌──────┐      ┌──────┐   │  │  │  │             │
    │  │ │OCP   │      │OCP   │   │  │  │  │             │
    │  │ │NIC 1 │──────│NIC 2 │───│──┘  │  │             │
    │  │ │VLAN 7│  │   │VLAN 7│   │     │  │             │
    │  │ └──────┘  │   └──────┘   │     │  │             │
    │  └───────────┼──────────────┘     │  │             │
    │              │                     │  │             │
    │  ┌─Cluster (Standalone)──┐        │  │             │
    │  │ ┌──────┐   ┌──────┐  │        │  │             │
    │  │ │PCIe1 │   │PCIe1 │  │        │  │             │
    │  │ │NIC 3 │───│NIC 4 │──│────────┘  │             │
    │  │ │V 711 │   │V 712 │  │           │             │
    │  │ └──────┘   └──────┘  │           │             │
    │  └──────────────────────┘           │             │
    │                                      │             │
    │  ┌─Backup (Standalone, opt)─┐       │             │
    │  │ ┌──────┐   ┌──────┐     │       │             │
    │  │ │Bkup  │   │Bkup  │     │       │             │
    │  │ │NIC 7 │───│NIC 8 │─────│───────┘             │
    │  │ │V 800 │   │V 800 │     │                     │
    │  │ └──────┘   └──────┘     │                     │
    │  └──────────────────────────┘                     │
    │                                                    │
    │  ┌─FC SAN (Separate Fabric)─────────┐             │
    │  │ ┌──────┐         ┌──────┐        │             │
    │  │ │FC HBA│ ─ ─ ─ ─ │FC HBA│        │ (not on    │
    │  │ │Port A│         │Port B│        │  Leaf)      │
    │  │ └──────┘         └──────┘        │             │
    │  └──────────────────────────────────┘             │
    └────────────────────────────────────────────────────┘
```

#### Three Variants by Storage Type

**1. FC SAN Host Networking:**
- SET intent box (blue, dashed): OCP NIC1 + NIC2 → Leaf-A/Leaf-B (VLAN 7 native + tenant VLANs)
- Standalone box (yellow/amber, dashed): Cluster NIC3 → Leaf-A (VLAN 711), NIC4 → Leaf-B (VLAN 712)
- Standalone box (orange, dashed, optional): Backup NIC7 → Leaf-A (VLAN 800), NIC8 → Leaf-B (VLAN 800)
- Separate fabric box (purple, solid): FC HBA Port A → FC Switch A, Port B → FC Switch B — **separate from Leaf, shown with dashed purple lines to FC icon below**
- FC switches shown as separate elements below the node (not connected to Leaf)

**2. iSCSI 4-NIC Host Networking:**
- SET intent box (blue): OCP NIC1 + NIC2 → Leaf-A/Leaf-B
- Standalone box (yellow/amber): Cluster + iSCSI shared: NIC3 → Leaf-A (trunk VLAN 300+500), NIC4 → Leaf-B (trunk VLAN 300+500)
- Standalone box (orange, optional): Backup NIC5 → Leaf-A (VLAN 800), NIC6 → Leaf-B (VLAN 800)
- **No FC switches** — iSCSI targets shown below as Ethernet-connected storage via Leaf
- Note: "iSCSI 4-NIC: Cluster + iSCSI share PCIe1 trunk (VLANs 300, 500)"

**3. iSCSI 6-NIC Host Networking:**
- SET intent box (blue): OCP NIC1 + NIC2 → Leaf-A/Leaf-B
- Standalone box (yellow/amber): Cluster NIC3 → Leaf-A (VLAN 711), NIC4 → Leaf-B (VLAN 712)
- Standalone box (green, dashed): iSCSI NIC5 → Leaf-A (VLAN 500), NIC6 → Leaf-B (VLAN 600) — with MTU 9216 label
- Standalone box (orange, optional): Backup NIC7/NIC8 — **with warning if ports 33–48 conflict**
- Note: "iSCSI 6-NIC: Dedicated iSCSI on PCIe2 (Leaf Ports 33–48)"

#### Color Palette for NIC Groups

| NIC Group | Box Fill | Box Stroke | Port Fill | Port Stroke | Uplink Color |
|---|---|---|---|---|---|
| Compute + Mgmt (SET intent) | `rgba(0,120,212,0.07)` | `rgba(0,120,212,0.45)` | `rgba(0,120,212,0.20)` | `rgba(0,120,212,0.55)` | Blue `#0078D4` |
| Cluster (standalone) | `rgba(245,158,11,0.07)` | `rgba(245,158,11,0.45)` | `rgba(245,158,11,0.20)` | `rgba(245,158,11,0.55)` | Amber `#F59E0B` |
| iSCSI (standalone, 6-NIC only) | `rgba(16,185,129,0.07)` | `rgba(16,185,129,0.45)` | `rgba(16,185,129,0.20)` | `rgba(16,185,129,0.55)` | Green `#10B981` |
| Backup (standalone, optional) | `rgba(249,115,22,0.07)` | `rgba(249,115,22,0.45)` | `rgba(249,115,22,0.20)` | `rgba(249,115,22,0.55)` | Orange `#F97316` |
| FC SAN (separate fabric) | `rgba(139,92,246,0.07)` | `rgba(139,92,246,0.45)` | `rgba(139,92,246,0.25)` | `rgba(139,92,246,0.65)` | Purple `#7C3AED` |

#### Key Differences from HCI Diagram Implementation

| Aspect | HCI Implementation | Disaggregated Implementation |
|---|---|---|
| Switch label | "ToR Switch 1/2" | "Leaf-A / Leaf-B" + ASN label |
| Inter-switch link | "MLAG" (orange LAG box) | "iBGP P49" (yellow dashed link) |
| NIC-to-switch routing | Alternating by posInGroup (NIC 1→ToR1, NIC 2→ToR2) | Fixed: odd NICs → Leaf-A, even NICs → Leaf-B (matching the guide's wiring) |
| Intent group labels | "Management + Compute", "Storage" | "Compute + Mgmt (SET)", "Cluster (Standalone)", "iSCSI (Standalone)", "Backup (Standalone)", "FC SAN (Separate Fabric)" |
| VLAN labels | Not shown (ATC manages) | **Shown on each NIC port tile**: "VLAN 7", "VLAN 711", "VLAN 500", "VLAN 800" |
| Subnet labels | Shown on switchless mesh lines | Shown below Leaf-A/Leaf-B: per-function subnet |
| Storage connection | NIC → ToR (same uplink style) | FC: dashed purple to FC switch icon; iSCSI: through Leaf (same uplink style) |
| Data source | `state.intent`, `state.adapterMapping`, `state.portConfig` | `state.disaggStorageType`, `state.disaggBackupEnabled`, `state.disaggVlans`, `state.disaggSubnets` |

#### Implementation: New Function

A new `renderDisaggregatedHostNetworkingDiagram(state)` function in `report/report.js` (or in the new `js/disaggregated.js`), following the same SVG inline pattern as `renderSwitchedIntentDiagram()`:

```javascript
function renderDisaggregatedHostNetworkingDiagram(state) {
    // Guard: only for disaggregated architecture
    if (!state || state.architecture !== 'disaggregated') return '';
    
    var storageType = state.disaggStorageType; // 'fc_san' | 'iscsi_4nic' | 'iscsi_6nic'
    var backupEnabled = state.disaggBackupEnabled;
    var vlans = state.disaggVlans; // { mgmt: 7, cluster1: 711, cluster2: 712, iscsi1: 500, iscsi2: 600, backup: 800 }
    
    // Calculate port count based on storage type + backup
    var nicGroups = buildDisaggNicGroups(storageType, backupEnabled, vlans);
    
    // Layout: Leaf-A and Leaf-B at top with iBGP link
    // Node box below with NIC groups
    // FC switches or iSCSI targets below node (storage-type dependent)
    
    // ... SVG construction following same pattern as renderSwitchedIntentDiagram() ...
}
```

#### Integration Point in Report

In the report generation flow (around line 5640 of `report/report.js`), add a conditional branch:

```javascript
// Existing: HCI diagrams
if (s.architecture === 'hyperconverged' || !s.architecture) {
    if (s.storage === 'switchless') {
        sections.push(block('Switchless Storage Connectivity (Diagram)', renderSwitchlessStorageDiagram(s)));
    }
    // ... existing switched/rack-aware diagrams
}

// New: Disaggregated diagrams
if (s.architecture === 'disaggregated') {
    sections.push(block('Disaggregated Host Networking (Diagram)', renderDisaggregatedHostNetworkingDiagram(s)));
}
```

#### draw.io Export

A new `generateDisaggregatedHostNetworkingDrawio(state)` function following the same draw.io XML cell pattern as `generateHostNetworkingDrawio()`, producing exportable `.drawio` files with the disaggregated NIC layout.

---

## Implementation Status — Completed Work

> **Last Updated**: April 8, 2026
> **Branch**: Disaggregated (local only)
> **Best version as of**: Commit `65ff2fb`

### Phase 1: Restructure Step 1 — COMPLETED

All Phase 1 tasks were completed in earlier sessions:

| Task | Status | Notes |
|---|---|---|
| 1.1 Rename scenario values | ✅ Done | `'connected'`, `'disconnected'`, `'rackscale'`, `'m365local'` |
| 1.2 Add `state.architecture` | ✅ Done | `'hyperconverged'` or `'disaggregated'` |
| 1.3 Update Step 1 HTML cards | ✅ Done | Connected, Disconnected, Rack Scale, M365 Local |
| 1.4 Add Step 1b architecture selection | ✅ Done | Shown for Connected + Disconnected |
| 1.5 Update `selectOption()` | ✅ Done | Handles architecture selection and downstream resets |
| 1.6 Update `updateUI()` visibility | ✅ Done | DA steps shown/hidden based on architecture |
| 1.7 Guard HCI-only steps | ✅ Done | Steps 2-6, 5-5, 14 hidden for disaggregated |
| 1.8 Disconnected logic untouched | ✅ Done | `state.scenario === 'disconnected'` unchanged |

### Phase 2: Disaggregated Wizard Steps — IN PROGRESS

#### DA1: Storage Type — COMPLETED

- Three option cards: FC SAN, iSCSI 4-NIC, iSCSI 6-NIC
- Explanation text per selection
- Resets all downstream state on change
- Breadcrumb label: "Arch"

#### DA2: Backup Network — COMPLETED

- Toggle: Enable / Disable backup network
- Warning for iSCSI 6-NIC + backup (vNIC mode explained)
- Resets downstream state on change

#### DA3: Scale (Racks + Nodes) — COMPLETED

- Rack count selection (1-8 racks)
- Nodes per rack slider (dynamic max based on storage type + backup)
- Total node count display
- Syncs `state.nodes` for shared steps

#### DA4: Spine Count — COMPLETED

- 2 or 4 spine selection with explanation
- Visual card selection

#### DA5: VLANs, VNI & VRF — COMPLETED

All DA5 features implemented across multiple commits:

| Feature | Commit | Description |
|---|---|---|
| Title + concept cards | `6cfa143` | "Network Switches — VLANs, VNI & VRF" with 3-card explainer grid (VLAN, VNI, VRF concepts) |
| Switch port VLAN modes | `8e27081` | Purple callout explaining Cluster VLANs (access) and Management VLAN (access or trunk) |
| VLAN/VNI grid | `107fce6` | Editable grid: Management, Cluster A/B, iSCSI A/B (conditional), Backup (conditional). Each row: VLAN ID + VNI |
| Workload VLANs | `107fce6` | Add/remove workload VLANs with Name, VLAN, VNI fields |
| Confirm/Edit buttons | `107fce6` | Confirm locks all inputs; Edit unlocks. State: `disaggVlanConfigConfirmed` |
| VRF name | `107fce6` | Editable VRF name input (default: "AZLOCAL") |
| Per-tenant VRF field | `4dee7e2` | Each workload VLAN now has its own VRF name (TENANT1, TENANT2, etc.) in two-row card layout |
| VLAN mode labels | `567a906` | Infrastructure VLANs show "(Access)", workload VLANs show "(Trunk)" in purple text |
| Mgmt VLAN mode toggle | `65ff2fb` | Management VLAN has Access/Trunk dropdown. Trunk mode is for customers who require tagged management traffic. Choice auto-configures Step 14 (Infrastructure VLAN) |

**State properties for DA5:**
- `state.disaggVlans` — `{ mgmt: 7, cluster1: 711, cluster2: 712, iscsiA: 500, iscsiB: 600, backup: 800 }`
- `state.disaggVnis` — `{ mgmt: 10007, cluster1: 10711, cluster2: 10712, iscsiA: 10500, iscsiB: 10600, backup: 10800 }`
- `state.disaggVrfName` — `'AZLOCAL'`
- `state.disaggWorkloadVlans` — Array of `{ name, vlan, vni, vrf }`
- `state.disaggVlanConfigConfirmed` — Boolean
- `state.disaggMgmtVlanMode` — `'access'` or `'trunk'` (default: `'access'`)

**DA5 → Step 14 integration (`65ff2fb`):**
- Access mode on DA5 → Step 14 auto-selects "Default VLAN", greys out "Custom VLAN", shows native VLAN ID from DA5
- Trunk mode on DA5 → Step 14 auto-selects "Custom VLAN" with VLAN ID pre-filled from DA5, greys out "Default VLAN"
- Purple notice banner on Step 14 explains the pre-configured setting
- VLAN ID input on Step 14 is read-only when disaggregated (value set from DA5)
- Mode resets to 'access' when storage type or architecture changes

#### DA6: QoS Policy — COMPLETED

| Feature | Commit | Description |
|---|---|---|
| QoS summary table | Earlier session | Auto-derived from storage type: iSCSI → full QoS table, FC → QoS for CSV/LM |
| FC SAN QoS fix | `8cc0a83` | Reference design guide confirmed FC SAN needs 802.1p + ETS for CSV/Live Migration. Removed "no QoS required" early return. Shows QoS table: default (79%), CSV/LM (20%), heartbeat (1%) |

#### DA7: IP Routing Configuration — COMPLETED

| Feature | Commit | Description |
|---|---|---|
| Title rename | `4bb945d` | "Leaf & Spine Network Switches — IP Routing Configuration" |
| Clos topology diagram | `f11768b` | SVG showing spines (blue), service leafs (teal), rack leafs (gray) with BGP peering lines and ASN labels |
| Confirm/Edit buttons | `f11768b` | State: `disaggIpConfigConfirmed` |
| Diagram centering | `a673cf7` | `text-align: center` on diagram container |

#### DA8: Rack Layout Diagram — COMPLETED

| Feature | Commit | Description |
|---|---|---|
| Dynamic rack SVG | Earlier session | Multi-rack Clos layout with FC/iSCSI variants. Spine, service leaf, rack leaf, BMC, server nodes, FC switches (FC SAN only) |
| SVG download button | `bbfe1cf` | `report-action-button` styled export |
| Diagram centering | `a673cf7` | Centered container |

#### DA9: Node Configuration — IN PROGRESS

- Node names per rack, auto-populated defaults
- Not fully implemented yet

#### DA10: Network Adapter Configuration — COMPLETED

| Feature | Notes |
|---|---|
| Host networking preview SVG | Leaf-A/B at top, node box with NIC groups, FC/iSCSI targets below |
| NIC adapter name customization | OCP, Cluster, iSCSI, Backup, BMC NIC names |
| Intent overrides | RDMA, Jumbo, SR-IOV for Mgmt+Compute and Backup |
| Confirm/Edit buttons | State: `disaggOverridesConfirmed` |
| SVG + Draw.io export | Download buttons for both formats |
| Diagram centering | `28c6371` — inline-block SVG wrapper, centered buttons |
| iSCSI 6-NIC + Backup vNIC mode | Full vNIC on SET implementation |

### Breadcrumb Navigation — COMPLETED

| Feature | Commit | Description |
|---|---|---|
| DA breadcrumb nav | `ff66de6` | Step progress breadcrumbs for DA1-DA10 |
| Fix auto-completion | `ee84f05` | DA5→`disaggVlanConfigConfirmed`, DA7→`disaggIpConfigConfirmed`, DA6/DA8→`disaggOverridesConfirmed` |
| DA1 label rename | `ee84f05` | DA1 renamed from "Storage" to "Arch" |
| Switch Config group | `9cff5b1` | DA4-DA7 wrapped in `.breadcrumb-group` with purple-tinted border and "Switch Config" label |

### Visual/UX Improvements — COMPLETED

| Feature | Commit | Description |
|---|---|---|
| SVG button styling | `bbfe1cf` | Rack diagram download uses `report-action-button` class |
| Center DA7/DA8/DA10 | `a673cf7` | `text-align: center` on all three diagram containers |
| Center DA10 preview | `28c6371` | inline-block SVG wrapper, centered button row |

### Phase 3: Output Artifacts — PARTIALLY COMPLETED

| Artifact | Status |
|---|---|
| Rack layout SVG (DA8) | ✅ Done — dynamic multi-rack Clos with FC/iSCSI variants |
| Host networking preview SVG (DA10) | ✅ Done — per-node NIC layout with Leaf switches |
| Host networking Draw.io export | ✅ Done |
| Clos topology diagram (DA7) | ✅ Done — spine/leaf/service-leaf with BGP peering |
| QoS summary table (DA6) | ✅ Done — with FC SAN fix |
| VLAN/VNI mapping table (DA5) | ✅ Done |
| Cisco NX-OS reference configs | ❌ Not started |
| ARM template (disaggregated) | ❌ Not started |
| Full configuration report | ❌ Not started |

### Phase 4: Code Structure — STATUS

| File | Status | Notes |
|---|---|---|
| `index.html` | ✅ Modified | DA1-DA10 HTML sections, breadcrumb nav, Step 14 DA notice |
| `js/script.js` | ✅ Modified | State properties, `selectOption()`, `updateUI()`, breadcrumb logic, DA5→Step 14 integration |
| `js/disaggregated.js` | ✅ Created | ~2400+ lines — all DA step logic, VLAN grid, QoS, topology, NIC config, host networking preview |
| `css/style.css` | ✅ Modified | `.breadcrumb-group` styles |
| `js/nav.js` | ✅ Modified | DA step navigation |
| `report/report.js` | ❌ Pending | Disaggregated report section |
| `switch-config/templates/` | ❌ Pending | Clos topology switch config templates |
| `js/disconnected.js` | ✅ No change needed | Works as-is with scenario/architecture split |

### Commit Log (Disaggregated branch, this session)

```
65ff2fb Add Access/Trunk mode toggle for Management VLAN on DA5
567a906 Add VLAN mode labels (Access/Trunk) to DA5 VLAN cards
28c6371 Center DA10 host networking preview SVG and buttons
a673cf7 Center DA7, DA8, and DA10 diagrams when narrower than container
4dee7e2 Add per-workload VRF field to workload VLANs
8cc0a83 Fix DA6: Show QoS for FC SAN per reference design guide
f11768b Add Clos topology diagram and confirm button to DA7
4bb945d Rename DA7 title to Leaf & Spine IP Routing Configuration
107fce6 Add workload VLANs and confirm button to DA5
8e27081 Add switch port VLAN mode guidance to DA5
6cfa143 Update DA5 title and add VLAN/VNI/VRF concept explanations
9cff5b1 Group DA4-DA7 breadcrumb steps as Switch Config
bbfe1cf Match rack diagram SVG button style to host networking preview
ee84f05 Fix DA breadcrumb auto-completion and rename DA1 label
ff66de6 Add step progress breadcrumb navigation for disaggregated wizard flow
```

### Key State Properties Summary

```javascript
// DA flow state (added to state object in script.js)
state.architecture              // 'hyperconverged' | 'disaggregated'
state.disaggStorageType          // 'fc_san' | 'iscsi_4nic' | 'iscsi_6nic'
state.disaggBackupEnabled        // true | false
state.disaggPortCount            // derived from storage type + backup
state.disaggRackCount            // 1-8
state.disaggNodesPerRack         // dynamic max per storage type
state.disaggSpineCount           // 2 | 4
state.disaggVlans                // { mgmt, cluster1, cluster2, iscsiA, iscsiB, backup }
state.disaggVnis                 // { mgmt, cluster1, cluster2, iscsiA, iscsiB, backup }
state.disaggMgmtVlanMode         // 'access' | 'trunk' (default: 'access')
state.disaggVrfName              // 'AZLOCAL'
state.disaggWorkloadVlans        // [{ name, vlan, vni, vrf }]
state.disaggVlanConfigConfirmed  // boolean
state.disaggIpConfigConfirmed    // boolean
state.disaggOverridesConfirmed   // boolean
state.disaggPortSpeeds           // { ocp, pcie1, pcie2, backup, bmc }
state.disaggIntentMapping        // { mgmt_compute: ['ocp_p1', 'ocp_p2'] }
state.disaggClusterPortMapping   // { pcie1_p1: '711', pcie1_p2: '712', ... }
state.disaggNicNames             // { ocp1, ocp2, cluster1, cluster2, iscsi1, iscsi2, backup1, backup2, bmc }
state.disaggNicNamesConfirmed    // boolean
state.disaggNicConfigConfirmed   // boolean
state.disaggPortConfig           // per-port config
state.disaggAdapterMapping       // adapter mapping
state.disaggIntentOverrides      // RDMA, Jumbo, SR-IOV overrides
state.disaggSubnets              // per-function subnets
state.disaggIscsiTargets         // iSCSI target IPs for static routes
```

### Remaining Work

1. **DA9: Node Configuration** — Node names per rack (partially implemented)
2. **Report generation** — Disaggregated-specific report section in report.js
3. **Switch config templates** — Cisco NX-OS configs for Clos topology
4. **ARM template** — Disaggregated variant
5. **Validation** — Complete validation rules for all DA steps
6. **State persistence** — Verify localStorage save/restore for all new state properties
7. **Service leaf integration** — External LB, FW, network controller options (DA8 or new step)
