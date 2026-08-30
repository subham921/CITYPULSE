🚍 CITYPULSE ~ AUTHOR: SUBHAM RAY

## AI-Powered Mobile Urban Intelligence & Safety Network

> **Transforming public transport buses into intelligent mobile sensing units for safer roads, smarter traffic management, and proactive urban infrastructure maintenance.**

**Smart India Hackathon 2026 — SIH26124**

---

## 🌆 Overview

**CITYPULSE** is an AI-powered urban intelligence platform that transforms everyday public transport buses into **mobile sensing units**.

Modern buses already travel across major roads every day and are increasingly equipped with multiple cameras. Instead of using these cameras only for recording incidents, CITYPULSE uses them as a distributed sensing network.

The system combines:

* 🎥 RGB & IR camera vision
* 🌙 Night-time / low-light detection
* 📍 GPS
* 📳 IMU / accelerometer data
* 🤖 Edge AI
* 🚗 Vehicle detection & tracking
* 🔢 Automatic Number Plate Recognition
* 🗺️ GIS analytics
* 👥 Citizen reports
* 📊 Traffic analytics
* 🧠 Multi-source event fusion
* 💰 Budget-constrained optimization

The objective is not simply to **detect problems**, but to help authorities:

> **Sense → Detect → Verify → Analyze → Decide → Act → Verify Again**

---

# 🎯 Problem

Urban authorities currently depend heavily on:

* Fixed CCTV cameras
* Manual road inspections
* Citizen complaints
* Separate traffic monitoring systems
* Periodic infrastructure surveys

These approaches can result in:

* Delayed identification of road defects
* Incomplete road coverage
* Poor visibility of changing traffic conditions
* Delayed incident response
* Fragmented infrastructure data
* Inefficient maintenance prioritization
* Limited historical road intelligence

Public buses, however, continuously traverse large portions of a city.

CITYPULSE turns this existing mobility network into a **distributed urban sensing infrastructure**.

---

# 💡 Our Solution

CITYPULSE consists of two major layers.

### 🚌 1. Onboard Edge-AI System

Installed on public buses.

It processes camera and sensor data locally to detect:

* Potholes
* Damaged roads
* Missing road dividers
* Missing zebra crossings
* Damaged/missing traffic signs
* Waterlogging
* Road hazards
* Vehicles
* Traffic density
* Traffic bottlenecks
* Vulnerable pedestrians
* Near-miss situations
* Rash driving
* Hit-and-run incidents

It also captures:

* GPS coordinates
* Timestamp
* Vehicle information
* Detection confidence
* Sensor information

---

### 🏙️ 2. Centralized Urban Intelligence Platform

Aggregates observations from the entire bus fleet.

The centralized system provides:

* GIS visualization
* Road-condition maps
* Congestion heat maps
* Accident-prone zone identification
* Near-miss hotspots
* Infrastructure deficiency maps
* Traffic analytics
* Origin–destination analysis
* Route-delay estimation
* Incident management
* Maintenance prioritization
* Budget optimization
* Repair verification

---

# 🚦 Core Features

## 1. 🕳️ Road Defect Detection

CITYPULSE detects road infrastructure problems using computer vision.

### Detectable conditions

* Potholes
* Cracks
* Damaged road surfaces
* Road debris
* Road obstructions
* Other visible road hazards

Each detection can contain:

```text
Event ID
Road Segment
GPS Location
Timestamp
Detection Type
Severity
Confidence Score
Bus ID
Image / Video Evidence
```

---

# 🚧 2. Infrastructure Deficiency Detection

The system identifies missing or damaged road infrastructure.

### Examples

* Missing road dividers
* Damaged road dividers
* Missing zebra crossings
* Damaged/missing traffic signboards
* Obstructed signs

Instead of simply reporting defects, CITYPULSE builds an **infrastructure deficiency map**.

---

# 🌊 3. Waterlogging Detection

Bus cameras can identify waterlogged road sections.

The system can record:

```text
Location
Waterlogging Severity
Timestamp
Estimated Area
Duration
Number of Observations
Traffic Impact
```

Repeated observations can identify **chronic waterlogging zones**.

---

# 🚗 4. Vehicle Detection, Classification & Counting

CITYPULSE uses computer vision to identify and count vehicles.

### Vehicle classes

* Cars
* Buses
* Trucks
* Motorcycles
* Auto-rickshaws
* Other supported vehicle categories

The system calculates:

* Vehicle count
* Vehicle density
* Vehicle class distribution
* Traffic flow
* Directional movement

---

# 🚦 5. Traffic Bottleneck Detection

Instead of only counting vehicles, CITYPULSE identifies locations where traffic becomes abnormal.

The system combines:

**Vehicle Density + Movement + Location + Time**

to detect:

* Traffic bottlenecks
* Recurring congestion
* Incident-induced congestion
* Event-induced congestion

These are displayed as **GIS congestion heat maps**.

---

# 🧒 6. Vulnerable Pedestrian Detection

CITYPULSE monitors potentially dangerous interactions between vehicles and pedestrians.

Example:

> A group of school children crosses a road while vehicles approach at high speed.

The system can generate a high-risk event.

Possible applications:

* School zones
* Pedestrian crossings
* Bus stops
* Markets
* Event areas
* High-footfall roads

---

# ⚠️ 7. Near-Miss Detection

CITYPULSE goes beyond accident detection.

It attempts to identify **near-miss situations** using object trajectories and proximity.

Examples:

```text
Vehicle ↔ Pedestrian
Vehicle ↔ Motorcycle
Vehicle ↔ Vehicle
```

Potential indicators:

* Sudden braking
* Rapid deceleration
* Unsafe proximity
* Sudden lane changes
* Abrupt evasive manoeuvres

Repeated near misses can identify dangerous locations **before serious accidents occur**.

---

# 🔴 8. Accident-Prone Zone Declaration

CITYPULSE creates an **Urban Safety Risk Score**.

It can combine:

```text
Accidents
+
Near Misses
+
Rash Driving
+
Pedestrian Exposure
+
Road Defects
+
Traffic Density
+
Waterlogging
```

A location repeatedly generating high-risk events can be classified as:

* Critical
* High Risk
* Moderate Risk
* Low Risk

This produces an **Accident-Prone Zone Map**.

---

# 🚘 9. Hit-and-Run Detection

During a suspected hit-and-run event:

### Step 1

Detect the incident.

### Step 2

Identify and track the suspected vehicle.

### Step 3

Follow the vehicle across multiple frames.

### Step 4

Perform Automatic Number Plate Recognition.

### Step 5

Generate an evidence package.

Example:

```text
Vehicle: WB XX XXXX
ANPR Confidence: 94%
GPS: Recorded
Timestamp: Recorded
Bus ID: Recorded
Video Clip: Stored
Incident Type: Hit-and-Run
```

### Step 6

Send the alert securely to the centralized command system.

---

# 🔢 10. ANPR Confidence Scoring

Number plate recognition should not blindly trust OCR.

CITYPULSE records a confidence score.

Example:

```text
Detected Plate:
WB12AB1234

Confidence:
94%

Status:
High Confidence
```

Low-confidence detections can be flagged for manual verification.

---

# 🔐 11. Tamper-Evident Evidence

Incident evidence can contain:

* Video clip
* GPS
* Timestamp
* Vehicle number
* Detection metadata

CITYPULSE can generate a cryptographic hash for each evidence package.

A simplified hash chain:

```text
Evidence 01
     ↓
SHA-256
     ↓
Evidence 02
     ↓
SHA-256
     ↓
Evidence 03
```

This helps identify whether stored evidence has been modified after capture.

---

# 🌙 12. IR / Night-Time Detection

A major extension of CITYPULSE is **night-time urban sensing**.

Normal RGB cameras can suffer from:

* Low illumination
* Glare
* Shadows
* Headlight overexposure
* Poor visibility

Therefore, the system can incorporate:

### Infrared / Low-Light Camera

The IR sensing layer helps maintain detection capability after sunset.

It can support:

* Vehicle detection
* Pedestrian detection
* Hit-and-run evidence
* Rash-driving detection
* Road-hazard detection
* Waterlogging detection
* Near-miss detection

### Night-time sensor fusion

```text
RGB Camera
     +
IR Camera
     +
GPS
     +
IMU
     ↓
Event Fusion
     ↓
Confidence Score
```

This allows CITYPULSE to operate as a **24-hour urban sensing platform**.

---

# 📳 13. Camera + IMU Sensor Fusion

Camera-based detection can sometimes be affected by:

* Shadows
* Reflections
* Water
* Poor lighting
* Image blur

CITYPULSE adds another independent signal:

### IMU / Accelerometer

When a bus passes over a pothole, the vehicle may experience a characteristic vibration or shock.

The prototype can synchronize:

```text
Camera Detection
        +
IMU Shock Signature
        ↓
Cross Validation
        ↓
Higher Confidence
```

This creates a **multi-modal sensing system**, rather than relying only on computer vision.

---

# 👥 14. Citizen + Bus Event Fusion

Citizens can submit road complaints.

Instead of creating a separate complaint system, CITYPULSE integrates citizen observations into the event-fusion engine.

Example:

```text
Citizen Report
     +
Bus A Detection
     +
Bus B Detection
     ↓
Cross-Verified Event
```

If only a citizen reports an issue:

```text
Citizen Report
     ↓
Pending Verification
```

This reduces false reports while preserving citizen participation.

---

# 🚌 15. Multi-Bus Event Fusion

Multiple buses may observe the same road problem.

Instead of storing them as separate incidents:

```text
Bus A → Pothole
Bus B → Pothole
Bus C → Pothole
```

CITYPULSE can combine them into:

```text
ONE VERIFIED ROAD EVENT

Confidence: 97%
Observations: 3
Location: Same road segment
```

This reduces duplicate alerts.

---

# 🎪 16. Festival & Event Route Management

CITYPULSE can support temporary high-density events such as:

* Festivals
* Religious gatherings
* Sports events
* Concerts
* Public celebrations
* Processions

### Before the event

Analyze:

* Historical congestion
* Road capacity
* Accident-prone zones
* Pedestrian risk
* Existing road defects

### During the event

Monitor:

* Traffic density
* Pedestrian movement
* Blocked roads
* Waterlogging
* Bottlenecks
* Route delays

### After the event

Analyze:

* Actual congestion
* Route performance
* Delay patterns
* Infrastructure problems

---

# 🗺️ 17. GIS-Based Command Center

The centralized platform provides a city-wide GIS interface.

### GIS layers

* Road defects
* Potholes
* Waterlogging
* Missing infrastructure
* Traffic density
* Congestion
* Near misses
* Accident-prone zones
* Hit-and-run incidents
* Vulnerable pedestrian zones
* Bus locations
* Repair status

Authorities can select individual road segments and inspect their history.

---

# 📊 18. Origin–Destination Analysis

Aggregated bus observations can help estimate recurring movement patterns.

Example:

```text
Zone A ─────────→ Zone C
Zone B ─────────→ Zone D
Zone C ─────────→ Zone E
```

This can help understand:

* Traffic demand
* Major travel corridors
* Peak movement periods
* Bottleneck relationships
* Route planning

The system should use appropriate aggregation/anonymization rather than exposing unnecessary individual-level tracking.

---

# ⏱️ 19. Route Delay Estimation

CITYPULSE compares expected and observed journey conditions.

Example:

```text
Expected Route Time:
32 minutes

Observed:
49 minutes

Estimated Delay:
17 minutes
```

The platform can associate delays with:

* Congestion
* Road defects
* Incidents
* Events
* Waterlogging

---

# 💰 20. Budget-Constrained Repair Optimization

This is one of CITYPULSE's key innovations.

Instead of simply producing:

> “These roads are dangerous.”

CITYPULSE answers:

> **“Given the available budget, which roads should be repaired first?”**

Example:

```text
Available Budget = ₹20 lakh

Road A → ₹8L → Risk 94
Road B → ₹5L → Risk 89
Road C → ₹4L → Risk 84
Road D → ₹12L → Risk 81
Road E → ₹6L → Risk 76
```

The optimizer selects the combination that maximizes modeled impact under the budget constraint.

Possible factors:

* Safety risk
* Traffic exposure
* Deterioration rate
* Pedestrian exposure
* Repair cost
* Equity considerations

This converts CITYPULSE from a **detection platform into a decision-support platform**.

---

# ⚖️ 21. Infrastructure Equity Lens

A city should not only repair the locations that generate the most reports.

CITYPULSE can identify areas with:

* High defect density
* High risk
* Low historical repair response

This helps authorities identify **systematically underserved areas**.

---

# 🕰️ 22. Urban Memory

CITYPULSE maintains a historical record for road segments.

Example:

```text
January
Healthy

February
Minor Crack

March
Pothole

April
Severe Pothole

May
Repair

June
Condition Improving
```

This enables:

* Deterioration tracking
* Recurring-defect detection
* Repair effectiveness analysis
* Long-term infrastructure planning

---

# ✅ 23. Proof of Repair

CITYPULSE closes the loop.

### Before repair

```text
Road Health: 28/100
Risk: High
Pothole: Severe
```

### Repair

```text
Maintenance Completed
```

### After repair

Multiple buses independently observe the same location.

```text
Road Health: 86/100
Risk: Reduced
Repair Verified ✓
```

This creates a **Before → Intervention → After** lifecycle.

---

# 🤖 24. Natural-Language Command Center

Officials should not need SQL knowledge to query the platform.

Example questions:

> “Which roads in Ward 5 need urgent repair?”

> “Show near-miss hotspots this week.”

> “Why is Route 45 delayed?”

> “Which festival routes are currently congested?”

CITYPULSE converts the question into structured queries against its own event and GIS data.

---

# 🏗️ System Architecture

```text
             PUBLIC TRANSPORT BUS
                     │
       ┌─────────────┼─────────────┐
       │             │             │
    RGB Camera    IR Camera       IMU
       │             │             │
       └─────────────┼─────────────┘
                     │
                  GPS Data
                     │
                     ▼
             ┌───────────────┐
             │   EDGE AI     │
             │ Detection     │
             │ Tracking      │
             │ ANPR          │
             │ Risk Analysis │
             └───────┬───────┘
                     │
                     ▼
              EVENT FUSION
                     │
       ┌─────────────┼─────────────┐
       │             │             │
    Other Buses   Citizens      History
       │             │             │
       └─────────────┼─────────────┘
                     ▼
          CENTRAL INTELLIGENCE
                     │
       ┌─────────────┼─────────────┐
       │             │             │
      GIS         Analytics     Alerts
       │             │             │
       ├─────────────┼─────────────┤
       │             │             │
   Risk Zones    Traffic       Maintenance
                 Analytics     Optimizer
       │             │             │
       └─────────────┼─────────────┘
                     ▼
              GOVERNMENT ACTION
                     │
                     ▼
                REPAIR / RESPONSE
                     │
                     ▼
              PROOF OF REPAIR
                     │
                     ▼
               URBAN MEMORY
```

---

# 🛠️ Technology Stack

## Artificial Intelligence

* Python
* OpenCV
* YOLO / PyTorch
* Object Tracking
* OCR / ANPR
* Computer Vision
* Machine Learning

## Edge Processing

* Python / C++
* Edge inference
* Frame sampling
* Local event filtering

## Sensors

* RGB Camera
* IR / Low-Light Camera
* GPS
* IMU / Accelerometer

## Backend

* FastAPI / Node.js
* PostgreSQL
* PostGIS
* REST APIs

## Frontend

* React
* Leaflet / MapLibre
* Dashboard visualization
* GIS layers

## Analytics

* NumPy
* Pandas
* Scikit-learn
* Optimization algorithms

## Security

* SHA-256 hashing
* Hash chains
* Role-based access
* Secure communication

---

# 🧪 Prototype Demonstration

The SIH prototype can demonstrate the complete pipeline using recorded bus footage and simulated sensor data.

### Demo 1 — Road Detection

Video:

```text
Road → Pothole detected
```

Dashboard:

```text
Pothole
Severity: High
Confidence: 91%
GPS: Recorded
```

### Demo 2 — Traffic

```text
Cars: 31
Buses: 4
Motorcycles: 27

Density: HIGH
Bottleneck: Detected
```

### Demo 3 — Near Miss

```text
Pedestrian + Vehicle
        ↓
Unsafe proximity
        ↓
Near Miss
        ↓
Risk Zone Updated
```

### Demo 4 — Hit-and-Run

```text
Incident
 ↓
Vehicle Tracking
 ↓
ANPR
 ↓
Confidence Score
 ↓
GPS + Timestamp
 ↓
Evidence Package
 ↓
Central Alert
```

### Demo 5 — Night Mode

```text
IR Camera
 ↓
Low-light detection
 ↓
Vehicle / pedestrian detection
 ↓
Event fusion
```

### Demo 6 — Budget Optimizer

```text
Budget = ₹20 lakh

Input:
Road risk + exposure + deterioration + cost

Output:
Optimal repair portfolio
```

---

# 🏆 Key Innovation

CITYPULSE is not just another pothole detector.

Its innovation lies in combining:

### Mobile Sensing

Public buses become distributed sensors.

### Multi-Modal Sensing

RGB + IR + IMU + GPS.

### Multi-Source Verification

Bus + bus + citizen + historical observations.

### Predictive Safety

Near misses can identify risk before accidents occur.

### Decision Intelligence

Budget optimization determines what should actually be repaired.

### Closed-Loop Governance

The platform verifies whether interventions actually improved conditions.

---

# 🔄 The CITYPULSE Loop

```text
SENSE
  ↓
DETECT
  ↓
VERIFY
  ↓
FUSE
  ↓
ANALYZE
  ↓
DECIDE
  ↓
ACT
  ↓
VERIFY AGAIN
  ↓
URBAN MEMORY
  ↺
```

---

# 👥 Team Structure

For a six-member team:

| Member | Responsibility                  |
| ------ | ------------------------------- |
| 01     | Computer Vision & AI            |
| 02     | Edge Processing + Sensor Fusion |
| 03     | Backend + Database              |
| 04     | GIS + Frontend                  |
| 05     | Analytics + Optimization        |
| 06     | Integration + Security + Demo   |

---

# 📈 Expected Impact

CITYPULSE aims to enable:

* Faster road-defect identification
* Continuous road monitoring
* Better traffic awareness
* Early identification of dangerous locations
* Faster incident reporting
* Stronger hit-and-run evidence collection
* Better festival/event traffic planning
* Data-driven maintenance
* More efficient use of limited repair budgets
* Transparent repair verification

---

# 🚀 Future Scope

Potential future extensions include:

* Larger city-wide bus fleets
* Dedicated edge-AI hardware
* Thermal cameras
* Advanced multimodal models
* Weather-aware detection
* Predictive road deterioration
* Automated work-order generation
* Integration with municipal systems
* Real-time adaptive traffic management
* Cross-city infrastructure benchmarking

---

# ⚠️ Prototype & Deployment Considerations

CITYPULSE is designed as a **prototype decision-support system**.

For real-world deployment, additional validation would be required for:

* Detection accuracy
* ANPR reliability
* Night-time performance
* False-positive control
* Data privacy
* Secure evidence handling
* Camera calibration
* Sensor synchronization
* Government workflow integration

The prototype should use controlled/demo footage and appropriately simulated data where real operational data is unavailable.

---

# 📌 Project Summary

**CITYPULSE transforms public buses from passive recording platforms into active urban sensing units.**

By combining computer vision, IR night sensing, IMU data, GPS, fleet-wide event fusion, GIS analytics, traffic intelligence and decision optimization, CITYPULSE creates a **closed-loop urban intelligence platform**.

> ### Don't just detect what is wrong.
>
> ### Understand where it matters, decide what to do, and verify the result.

---

## ⭐ Smart India Hackathon 2026

**Problem Statement:** SIH26124
**Project:** CITYPULSE
**Domain:** Smart Transportation / Urban Intelligence / Public Safety
**Platform:** Edge AI + Centralized GIS Intelligence

---

## 📄 License

This project is developed as an academic/prototype solution for **Smart India Hackathon 2026**.

License can be added based on the team's preferred open-source or institutional requirements.


