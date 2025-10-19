# Network Diagram Viewer - Plan de travail

> Mémoire à long terme du projet - Suivi détaillé de l'implémentation

## 📋 Vue d'ensemble

Réimplémentation d'un visualiseur de diagramme réseau (inspiré de kossolax/netflow) avec ReactFlow.
Permet d'uploader des fichiers Packet Tracer (.pkt/.pka), de les parser et de les afficher avec possibilité d'édition.

## 🏗️ Architecture (Séparation des responsabilités)

```
┌─────────────────────────────────────────────────────────────┐
│  COMPONENT LAYER (src/features/network-diagram/)            │
│  ↓ Uniquement UI - Pas de logique métier                    │
│  ↓ Utilise ShadCN components                                │
└──────────────────────┬──────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────┐
│  HOOK LAYER (src/features/network-diagram/hooks/)           │
│  ↓ État React + intégration                                 │
│  ↓ Pont entre Logic Layer et Components                     │
└──────────────────────┬──────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────┐
│  LOGIC LAYER (src/lib/network-simulator/)                   │
│  ↓ Classes métier - Pas de dépendance React                 │
│  ↓ Export types et logique pure                             │
└─────────────────────────────────────────────────────────────┘
```

## ✅ Checklist d'implémentation

### Phase 1: Setup & Infrastructure ✅ TERMINÉ

- [x] Créer TODO.md pour suivi long terme
- [x] Installer @xyflow/react (ReactFlow v12)
- [x] Installer fast-xml-parser (parsing XML PKT)
- [x] Installer @types/pako (types TypeScript)
- [x] Copier icônes PNG de netflow → `/public/network-icons/`
  - [x] router.png, switch.png, pc.png, server.png
  - [x] laptop.png, printer.png, cloud.png, hub.png, bridge.png, cable.png

### Phase 2: Logic Layer (`/src/lib/network-simulator/`) ✅ TERMINÉ

- [x] `types.ts` - Types réseau (Device, Link, NetworkTopology)
  - [x] Interface Device (type, name, x, y, guid, interfaces)
  - [x] Interface Link (source, target, cable type)
  - [x] Type NetworkTopology (nodes, links)

- [x] `parser.ts` - Parser PKT → NetworkTopology
  - [x] parsePacketTracerXML(xml: string): NetworkTopology
  - [x] Gérer DEVICE (type, position, interfaces)
  - [x] Gérer LINK/CABLE (connexions)
  - [x] Mapping types PT → icônes
  - [x] Gérer interfaces/ports des devices

- [x] `devices.ts` - Catalogue équipements
  - [x] DeviceCatalog avec types disponibles
  - [x] Fonction createDevice(type): Device
  - [x] Fonction mapPacketTracerType(ptType): DeviceType

### Phase 3: Hook Layer ✅ TERMINÉ

- [x] `hooks/useNetworkFile.ts` - Upload + parsing
  - [x] État: file, loading, error, topology
  - [x] handleFileUpload(file: File)
  - [x] Déchiffrer avec /lib/pkt-parser
  - [x] Parser XML → NetworkTopology
  - [x] clearTopology()

- [x] `hooks/useNetworkEditor.ts` - État diagramme
  - [x] État: nodes (ReactFlow), edges (ReactFlow)
  - [x] loadTopology(topology: NetworkTopology)
  - [x] addDevice(device: Device)
  - [x] onConnect (création edges)
  - [x] clearDiagram()
  - [x] Gestion useNodesState/useEdgesState

### Phase 4: Component Layer ✅ TERMINÉ

- [x] `/src/features/network-diagram/NetworkDiagram.tsx` (page principale)
  - [x] Layout avec toolbar en bas (style Packet Tracer)
  - [x] Breadcrumb navigation
  - [x] Boutons Clear et Export (préparé)

- [x] `components/FileUploader.tsx`
  - [x] Zone upload drag & drop
  - [x] Accepte .pkt, .pka
  - [x] Affiche nom fichier uploadé
  - [x] État loading

- [x] `components/DeviceToolbar.tsx`
  - [x] Toolbar horizontal en bas
  - [x] Boutons équipements (PC, Router, Switch, Server, etc.)
  - [x] Icônes PNG + label
  - [x] onClick → mode "adding device"

- [x] `components/NetworkCanvas.tsx`
  - [x] ReactFlow wrapper
  - [x] Custom nodeTypes (CustomNode)
  - [x] Custom edgeTypes (CustomEdge)
  - [x] Controls (zoom, pan)
  - [x] Background grid
  - [x] Click sur canvas pour placer device
  - [x] Accessibility (keyboard support)

- [x] `components/nodes/CustomNode.tsx`
  - [x] Affiche icône PNG + label
  - [x] Handles pour connexions (4 directions)
  - [x] Style cohérent avec theme
  - [x] Ring de sélection

- [x] `components/edges/CustomEdge.tsx`
  - [x] Ligne de connexion
  - [x] Label avec ports source/target
  - [x] Style cohérent avec theme

### Phase 5: Routing & Navigation ✅ TERMINÉ

- [x] Ajouter route `/network-diagram` dans `App.tsx`
- [x] Lazy load du composant
- [x] Ajouter lien dans sidebar (`app-sidebar.tsx`)
  - [x] Section Development
  - [x] Icône: Workflow
  - [x] Titre: "Network Diagram"

### Phase 6: Tests & Validation ✅ TERMINÉ

- [x] Build TypeScript réussi
- [x] Linting ESLint réussi
- [x] Architecture respectée (séparation responsabilités)
- [x] Layout adapté (devices en bas comme Packet Tracer)
- [ ] Tests fonctionnels manuels (à faire au runtime)

## 📝 Notes d'implémentation

### ReactFlow - Bonnes pratiques

```typescript
// Structure de base pour les nodes
const nodes: Node[] = [{
  id: 'device-1',
  type: 'customNode', // Utiliser custom node
  position: { x: 100, y: 100 },
  data: {
    label: 'Router-1',
    deviceType: 'router',
    icon: '/network-icons/router.png',
  },
}];

// Structure de base pour les edges
const edges: Edge[] = [{
  id: 'e1-2',
  source: 'device-1',
  target: 'device-2',
  type: 'customEdge',
}];
```

### Parsing PKT - Structure XML

```xml
<PACKETTRACER5>
  <NETWORK>
    <DEVICES>
      <DEVICE>
        <ENGINE>
          <TYPE>#text: "PC"</TYPE>
          <SAVE_REF_ID>guid</SAVE_REF_ID>
        </ENGINE>
        <WORKSPACE>
          <LOGICAL>
            <X>100</X>
            <Y>200</Y>
          </LOGICAL>
        </WORKSPACE>
      </DEVICE>
    </DEVICES>
    <LINKS>
      <LINK>
        <CABLE>
          <FROM>guid1</FROM>
          <TO>guid2</TO>
        </CABLE>
      </LINK>
    </LINKS>
  </NETWORK>
</PACKETTRACER5>
```

### Mapping types Packet Tracer

| PT Type | Icon | Display Name |
|---------|------|--------------|
| pc | pc.png | PC |
| laptop | laptop.png | Laptop |
| server | server.png | Server |
| router | router.png | Router |
| switch | switch.png | Switch |
| hub | hub.png | Hub |
| printer | printer.png | Printer |
| cloud | cloud.png | Cloud |

## 💡 Astuces & Tips

### ReactFlow
- Utiliser `useNodesState` et `useEdgesState` pour la gestion d'état
- `onNodesChange` pour drag & drop automatique
- `connectionMode="loose"` pour faciliter les connexions
- Ajouter `<Background />` et `<Controls />` pour meilleure UX

### Fast-xml-parser
```typescript
import { XMLParser } from 'fast-xml-parser';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
});
const jsonObj = parser.parse(xmlString);
```

### Déchiffrement PKT
```typescript
import { decryptPacketTracerFile } from '@/lib/pkt-parser';

const arrayBuffer = await file.arrayBuffer();
const uint8Array = new Uint8Array(arrayBuffer);
const xmlString = decryptPacketTracerFile(uint8Array);
```

## 🐛 Bugs connus / À surveiller

- [ ] PKT v5 vs v7+ - tester les deux formats
- [ ] Positions négatives dans XML - normaliser si nécessaire
- [ ] Gestion erreurs upload (fichier corrompu, mauvais format)
- [ ] Performance avec gros diagrammes (>50 nodes)

## 🔄 Statut des fichiers

### Créés ✅

- [x] TODO.md

### En cours 🚧

(aucun pour le moment)

### À créer 📝

**Logic Layer:**
- [ ] src/lib/network-simulator/types.ts
- [ ] src/lib/network-simulator/parser.ts
- [ ] src/lib/network-simulator/devices.ts

**Hook Layer:**
- [ ] src/features/network-diagram/hooks/useNetworkFile.ts
- [ ] src/features/network-diagram/hooks/useNetworkEditor.ts

**Component Layer:**
- [ ] src/features/network-diagram/NetworkDiagram.tsx
- [ ] src/features/network-diagram/components/FileUploader.tsx
- [ ] src/features/network-diagram/components/DeviceToolbar.tsx
- [ ] src/features/network-diagram/components/NetworkCanvas.tsx
- [ ] src/features/network-diagram/components/nodes/CustomNode.tsx
- [ ] src/features/network-diagram/components/edges/CustomEdge.tsx

**Assets:**
- [ ] public/network-icons/*.png (8 icônes)

**Routing:**
- [ ] Modifier src/App.tsx
- [ ] Modifier src/components/app-sidebar.tsx

## 📚 Références

- [ReactFlow Documentation](https://reactflow.dev/learn)
- [ancien projet kossolax/netflow](./netflow/)
- [PKT Parser local](./src/lib/pkt-parser/)
- [Fast XML Parser](https://github.com/NaturalIntelligence/fast-xml-parser)

## 🎉 Résumé de l'implémentation

### ✅ Ce qui a été fait

L'intégralité du Network Diagram Viewer a été implémenté avec succès:

1. **Architecture propre** respectant la séparation des responsabilités:
   - Logic Layer: Types et parsing PKT sans dépendance React
   - Hook Layer: Hooks pour gestion état
   - Component Layer: UI avec ReactFlow

2. **Fonctionnalités implémentées:**
   - Upload de fichiers .pkt/.pka avec drag & drop
   - Déchiffrement automatique (PT5 et PT7+)
   - Parsing XML vers diagramme ReactFlow
   - Affichage des devices avec icônes PNG
   - Toolbar de devices en bas (style Packet Tracer)
   - Ajout de devices par clic
   - Création de connexions entre devices
   - Suppression (touche Delete)
   - Zoom/Pan avec ReactFlow

3. **Qualité du code:**
   - ✅ Build TypeScript réussi
   - ✅ Linting ESLint réussi
   - ✅ Types strictement définis
   - ✅ Code documenté

### 🚀 Prochaines étapes possibles (non implémentées)

- [ ] **Configuration des devices** - Dialogs pour configurer IP, routes, VLANs
- [ ] **Simulation réseau** - Exécution des protocoles (ARP, ICMP, routing)
- [ ] **CLI intégré** - Terminal pour configurer devices (style Cisco IOS)
- [ ] **Export de fichiers** - Sauvegarder le diagramme modifié
- [ ] **Undo/Redo** - Historique des modifications
- [ ] **Validation de topologie** - Détection erreurs configuration
- [ ] **Animation des paquets** - Visualiser flux réseau en temps réel
- [ ] **Tests unitaires** - Vitest pour composants et hooks

## 🔄 Améliorations post-implémentation

### ✅ Full-width avec React Router `handle` (2025-10-19)

**Problème résolu:** Page network-diagram limitée par `max-w-6xl` du Layout

**Solution implémentée:** Option 4 - React Router `handle`
- Route avec `handle={{ fullWidth: true }}` dans App.tsx
- Layout utilise `useMatches()` pour détecter le handle
- Rendu conditionnel du wrapper max-w-6xl
- DeviceToolbar repositionné à gauche (vertical)
- Layout NetworkDiagram en flex-row

**Avantages:**
- ✅ Déclaratif - Configuration dans les routes
- ✅ Extensible - Facile d'ajouter d'autres pages full-width
- ✅ Type-safe - Interface Handle typable
- ✅ React Router idiomatique
- ✅ Aucun couplage hardcodé

**Fichiers modifiés:**
- src/App.tsx (handle ajouté)
- src/layout/sidebar.tsx (useMatches + condition)
- src/features/network-diagram/NetworkDiagram.tsx (flex-row)
- src/features/network-diagram/components/DeviceToolbar.tsx (vertical)

---

**Dernière mise à jour:** 2025-10-19 (Full-width implémenté)
**Statut global:** 🟢 Phase 1 terminée + Améliorations UX - Prêt pour tests runtime
