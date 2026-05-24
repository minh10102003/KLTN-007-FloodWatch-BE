# Huong dan xem Class Diagram

Cursor / Markdown **khong render** khoi `@startuml` trong chat. Can mo bang cong cu PlantUML.

## File

| File | Noi dung |
|------|----------|
| `docs/be-class-diagram-hcm.puml` | Tong quan MVC + MQTT + Routing + Python (layout goc vuong) |
| `docs/be-class-diagram-repositories.puml` | 19 Repository: **4 quan he UML** + Generalization, luoi 3 cot |

## Cach xem (chon 1)

### 1. VS Code / Cursor

Cai extension **PlantUML** (jebbs.plantuml), them **Java** hoac dung PlantUML server.

Mo file `.puml` -> `Alt+D` preview.

### 2. Trang web

1. Mo https://www.plantuml.com/plantuml/uml/
2. Copy toan bo noi dung file `.puml` -> dan vao o trai -> Submit.

### 3. Lenh (can Java)

```bash
java -jar plantuml.jar docs/be-class-diagram-hcm.puml
```

Hoac:

```bash
npx -y node-plantuml docs/be-class-diagram-hcm.puml -o docs/diagrams
```

## Bon quan he trong bang mau (slide)

| Quan he | Ky hieu | PlantUML | Co trong du an? |
|---------|---------|----------|-----------------|
| **Dependency** | Net dut + mui ten rong | `A ..> B` | Co — vd `UserModel ..> TokenService`, `MqttService ..> FloodRepository` |
| **Realization** | Net dut + tam giac rong | `A ..|> I` | Co (khai niem) — `RoutingService ..|> ISafePathFinder`, Python engine cung realize interface tim duong |
| **Aggregation** | Net lien + kim cuong **rong** | `A o-- B` | Co — vd `GraphSnapshot o-- Edge`, `SensorRepository o-- FloodRepository` |
| **Composition** | Net lien + kim cuong **dac** | `A *-- B` | Co — vd `GraphCache *-- GraphSnapshot` (snapshot song chet theo cache) |

**Them** (khong nam trong bang 4 dong nhung can trong so do):

| Quan he | PlantUML | Vi du |
|---------|----------|-------|
| Association | `A --> B` hoac `A -- B` | `AuthController --> UserModel` |
| Generalization (ke thua) | `Base <|-- Child` | `BaseRepository <|-- FloodRepository` |

**Luu y:** Code Node.js **khong co** `interface` Java; Realization tren so do la **hop dong kien truc** (ISafePathFinder), khong phai keyword trong source.

## Ky hieu khac (giong mau Order)

| Ky hieu PlantUML | UML |
|------------------|-----|
| `A "1" -- "0..*" B` | Association + multiplicity |
| `A "1" --> "1" B` | Directed association |

## Layout

- `skinparam linetype ortho` — duong chi thang va goc vuong.
- `-[hidden]down-` / `-[hidden]right-` — chi sap xep, khong ve them quan he.
