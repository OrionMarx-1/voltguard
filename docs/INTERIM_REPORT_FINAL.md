# VoltGuard AI — Interim Progress Report

**Team**: 1023 / LadyBanana, Hong Kong Baptist University (HKBU)  
**Date**: 4 October 2026  
**Event**: Hack for SDGs 2026, Track 1 — Green Transport & Smart Mobility  
**Project**: VoltGuard AI — A GenAI-Powered EV Battery Thermal Safety Monitoring & Emergency Response System  

---

## Executive Summary

VoltGuard AI targets a safety gap in Hong Kong's growing EV infrastructure. **184,000 EVs** are now registered in Hong Kong, and **68.6%** of new car registrations are electric. These vehicles park daily in **800,000+ underground spaces** that were not designed for battery thermal runaway risks.

Our solution uses a **two-tier safety system**. Tier 1 is a deterministic rule engine that evaluates battery temperatures in under 10 milliseconds. Tier 2 is an optional GenAI Copilot that provides bilingual diagnostic support. The prototype runs on **real NASA laboratory data** (636 discharge cycles, ~228,000 samples) and includes a responsive dashboard, offline-capable PWA, and structured incident handover workflows.

This report answers all 23 interim progress questions. It covers our research, technical achievements, team structure, and roadmap to the Final Pitch Day on 24 October 2026.

---

## SDG Alignment

| SDG | Target | How VoltGuard Contributes |
|-----|--------|--------------------------|
| **SDG 7** Affordable & Clean Energy | 7.3 Double improvement in energy efficiency | EV battery health monitoring extends battery life, reducing replacement waste |
| **SDG 9** Industry & Innovation | 9.1 Develop sustainable infrastructure | Predictive safety infrastructure for EV charging facilities |
| **SDG 11** Sustainable Cities | 11.2 Safe, affordable, accessible transport | Underground parking safety for EVs in high-density urban environments |
| **SDG 13** Climate Action | 13.1 Strengthen resilience to climate hazards | Early thermal detection prevents battery fires, reducing toxic emissions |

---

## Question Mapping

| Question | Section | Status |
|----------|---------|--------|
| Q1 Specific pain point | Problem and Scope — Q1 | Answered with HK data |
| Q2 Research & data | Problem and Scope — Q2 | Answered with NASA + HK gov data |
| Q3 Significance & affected groups | Problem and Scope — Q3 | Answered |
| Q4 Existing solutions & gaps | Problem and Scope — Q4 | Answered |
| Q5 Primary objectives | Proposed Solution — Q5 | Answered |
| Q6 Project boundaries | Proposed Solution — Q6 | Answered |
| Q7 Assumptions | Proposed Solution — Q7 | Answered |
| Q8 Target audience | Proposed Solution — Q8 | Answered |
| Q9 Client | Proposed Solution — Q9 | Answered |
| Q10 Needs gathering & testing | Proposed Solution — Q10 | Answered with protocol details |
| Q11 Team structure & roles | Teamwork — Q11 | Answered with full member details |
| Q12 Communication strategies | Teamwork — Q12 | Answered |
| Q13 Achievements so far | Progress — Q13 | Answered with feature list |
| Q14 Current work | Progress — Q14 | Answered |
| Q15 Immediate next steps | Progress — Q15 | Answered with timeline |
| Q16 Success evaluation | Progress — Q16 | Answered with KPIs |
| Q17 Challenges encountered | Challenges — Q17 | Answered |
| Q18 Upcoming challenges | Challenges — Q18 | Answered |
| Q19 Resources utilised | Resources — Q19 | Answered |
| Q20 Missing resources | Resources — Q20 | Answered |
| Q21 Learnings | Learnings — Q21 | Answered |
| Q22 Evolution of understanding | Learnings — Q22 | Answered |
| Q23 Other comments | Learnings — Q23 | Answered |

---

## Part 1: Problem and Scope

### Q1. What specific problem or pain point is your project addressing?

Hong Kong's EV adoption is accelerating. Its high-density underground parking infrastructure was not designed for lithium-ion battery thermal runaway risks. The core problem is a **visibility gap**: every EV has a built-in Battery Management System (BMS) that monitors cell temperatures, but this data stays inside the vehicle. When 50+ EVs park in a B3 basement, the facility manager cannot see battery thermal states across the fleet.

The specific problems we address are:

1. **No facility-level thermal visibility**: OEM BMS systems are vehicle-centric. A car park operator cannot see which vehicles have elevated battery temperatures across the entire facility.

2. **Reactive rather than proactive response**: Current systems only alert after a fire has started. There is no early-warning layer that identifies thermal anomalies before they escalate.

3. **Confusing data for non-technical staff**: BMS data is designed for automotive engineers, not frontline security guards or facility managers who need clear guidance during emergencies.

4. **Fragmented emergency coordination**: When an EV fire occurs, firefighters arrive without pre-generated thermal timelines or severity assessments to guide their response.

Our project does not claim that every EV fire is preventable, nor do we assert that EVs have a higher fire rate than conventional vehicles. Rather, we address the **information gap** that prevents facility operators from making informed safety decisions.

### Q2. What research have you conducted to understand the problem better?

Our research spans three domains: real-world battery data, Hong Kong regulatory context, and local EV market trends.

**A. Real Battery Data — NASA Ames PCoE Repository**

We extracted and processed four real laboratory lithium-ion cells from the NASA Ames Prognostics Center of Excellence (PCoE) public dataset:

| Cell ID | Chemistry | Discharge Cycles | Data Points |
|---------|-----------|-----------------|-------------|
| B0005 | 18650 Li-ion | 168 cycles | ~60,000 samples |
| B0006 | 18650 Li-ion | 168 cycles | ~60,000 samples |
| B0007 | 18650 Li-ion | 168 cycles | ~60,000 samples |
| B0018 | 18650 Li-ion | 132 cycles | ~48,000 samples |
| **Total** | | **636 cycles** | **~228,000 samples** |

These data include time-series measurements of temperature, voltage, current, and capacity degradation under controlled laboratory conditions. We use these records to validate our data processing pipeline, rule engine, and visualisation components. See Figure 2 for dataset statistics.

**B. Hong Kong EV Market Data**

According to the Hong Kong Environmental Protection Department (EPD), as of end-August 2026:
- Approximately **184,000 EVs** were registered in Hong Kong
- This represents approximately **19.9%** of all registered vehicles
- The Transport Department reported **18,356 new EV registrations** in H1 2025, representing **68.6%** of all new private car registrations

This rapid growth means more EVs are parking in Hong Kong's 800,000+ underground parking spaces every day. See Figure 3 for EV registration trends.

**C. Hong Kong EV Fire Incidents**

A documented EV fire incident in Hong Kong illustrates the urgency of our problem:
- **30 October 2025**: A BYD EV caught fire at Laguna City Phase 4 Car Park, Kwun Tong (reported by HK01 News, 31 Oct 2025). The vehicle had just been parked and was **not charging**. Fire Services deployed the newly introduced "EV Fire Blanket". The incident required significant firefighting resources and caused facility disruption.

This case demonstrates that thermal runaway can occur during parking — not just during charging — making facility-level monitoring essential.

**D. Regulatory & Safety Research**

We reviewed the following official documents:
- **HKFSD Circular 3/2025**: Fire Safety Requirements for Battery Rooms and EV Charging Facilities
- **HKFSD EV Fire Blanket Protocol**: Introduced in 2025 for covering burning EVs to smother fire and prevent toxic gas spread
- **Buildings Department Fire Safety Code 2011**: Underground car park ventilation and egress requirements
- **PCPD Data Protection Principles**: Privacy requirements under the Personal Data (Privacy) Ordinance (PDPO)

**E. Academic References**

Our thermal threshold design is informed by:
- UL 9540A thermal runaway test standards
- NFPA 855 battery energy storage safety standards
- Bernardi et al. (1985) thermal modeling of lithium-ion batteries, *J. Electrochemical Society*

**F. User Research Preparation**

We have designed a structured user-test protocol for consent-based task observation with two participant roles (facility administrator and trained frontline staff), comprising six tasks covering record location, thermal status interpretation, 3D inspection, handover workflows, frontline mode usage, and offline state verification. Testing is scheduled for the coming week.

### Q3. Why is this problem significant? Who does it affect?

This problem is significant for four reasons:

**1. High population density amplifies risk**: Hong Kong has one of the highest urban population densities in the world. An EV fire in an underground car park can threaten hundreds of residents and vehicles simultaneously.

**2. Thermal runaway is extremely fast**: Once initiated, lithium-ion thermal runaway can escalate from smoke to full blaze in seconds to minutes, with internal temperatures exceeding 800°C. Early detection provides the only viable window for preventive action.

**3. Underground facilities complicate evacuation**: Multi-level basement car parks (B2/B3/B4) have limited egress routes. Smoke and toxic gases from battery fires spread rapidly through ventilation systems, making evacuation difficult.

**4. EV adoption is accelerating**: With 68.6% of new car registrations now being EVs, the number of vehicles with lithium-ion batteries in underground facilities is growing exponentially.

**Affected stakeholders** (see Figure 1 for impact assessment):

| Stakeholder | How They Are Affected | Estimated Scale (HK) |
|-------------|----------------------|---------------------|
| **EV Drivers/Passengers** | Park vehicles without knowing if neighbouring vehicles have thermal issues | ~184,000 EV owners |
| **Car Park Facility Managers** | Bear legal and operational responsibility for facility safety without thermal visibility tools | ~500 commercial car parks |
| **Frontline Security Guards** | First responders who lack technical training to interpret BMS data during incidents | ~2,000+ guards in commercial facilities |
| **Fire Services (HKFSD)** | Arrive at incidents without pre-generated thermal timelines or severity assessments | All HKFSD operational units |
| **Fleet Operators** | Cannot monitor battery health across multiple sites or vehicles simultaneously | ~50+ EV fleets (taxi/minibus/corporate) |
| **Insurance Underwriters** | Lack data to assess EV parking risk accurately | All major property insurers |
| **Nearby Residents** | Live above or adjacent to underground facilities with limited fire safety information | Thousands in high-rise estates |

### Q4. What existing solutions are available and how do they fall short?

We analysed four categories of existing solutions:

| Solution Category | What It Does | Limitation | VoltGuard Advantage |
|-------------------|-------------|------------|---------------------|
| **OEM BMS** | Monitors individual vehicle battery cells; triggers vehicle-level warnings | Vehicle-centric: facility operators cannot see thermal states across parked fleet | Facility-level fleet visibility with spatial heatmaps |
| **Charging Management Systems** | Manages charging power, schedules, billing | Focus on energy delivery, not battery safety monitoring | Dedicated thermal safety monitoring independent of charging state |
| **Building Fire Systems** | Smoke detectors, sprinklers, alarms | Reactive: only trigger after fire/smoke is present; no battery-specific early warning | Proactive thermal anomaly detection before smoke/fire |
| **Thermal Imaging Cameras** | Visual temperature measurement via infrared | Expensive hardware; cannot see inside battery packs; impractical for large facilities | Uses existing BMS sensors at zero hardware cost |

**The critical gap**: No existing solution provides **facility-level battery thermal visibility** that translates discrete BMS sensor readings into actionable, spatial heatmaps with integrated emergency guidance. VoltGuard fills this gap by creating a cross-role observation and handover layer — not replacing existing systems, but augmenting them with facility-wide intelligence.

**Competitive Differentiation**:

| Feature | OEM BMS (e.g. Tesla, BYD) | Charging Systems (e.g. ChargePoint) | VoltGuard AI |
|---------|---------------------------|-----------------------------------|--------------|
| Data source | Vehicle-internal | Charging station only | Facility-wide aggregation |
| Visualisation | Numeric tables | Power charts | Real-time 3D/2D heatmaps |
| Alert speed | Seconds-minutes | Minutes | <10ms (Tier 1) |
| AI assistance | None | None | GPT-4o Vision + HKFSD RAG |
| Offline capability | None | None | Service Worker cached |
| Multi-language | Varies by brand | Usually English only | Chinese + English built-in |
| Emergency handover | Manual | None | Structured workflow + PDF export |

---

## Part 2: Proposed Solution

### Q5. Describe the primary objectives of your project.

VoltGuard AI has five primary objectives:

**Objective 1 — Thermal Visibility**: Transform discrete BMS temperature sensor readings into intuitive, real-time spatial heatmaps that facility operators can understand at a glance.

**Objective 2 — Early Warning**: Build a deterministic rule engine (Tier 1) that evaluates temperature and rate-of-rise against physics-based thresholds to flag anomalies before they become critical.

**Objective 3 — AI-Assisted Diagnosis**: Provide an optional GenAI Copilot (Tier 2) that analyses thermal patterns and generates bilingual diagnostic reports. Tier 2 stays outside the safety-critical decision path. See Figure 4 for architecture.

**Objective 4 — Emergency Handover**: Create a structured operations workspace that guides frontline staff through evidence review, acknowledgement, and incident handover with exportable reports.

**Objective 5 — Accessible Deployment**: Deliver the solution through responsive web interfaces and a Progressive Web App (PWA) with offline capability, ensuring usability across devices and network conditions.

### Q6. What are the boundaries of your project (what will the project not address)?

We have defined clear boundaries to ensure the project remains feasible and honest:

**What VoltGuard does NOT do**:
- **No automatic vehicle control**: We do not trigger braking, battery disconnection, charging shutoff, or fire suppression. Final safety decisions remain with trained human operators.
- **No certified fire detection**: Our prototype rules are for demonstration and algorithm validation, not certified fire-safety equipment.
- **No guaranteed early warning**: We do not claim 100% detection sensitivity. Some battery failures may not produce detectable surface temperature changes.
- **No fabricated data**: We do not invent vehicle incidents, sensor readings, or user testimonials. All demonstration data is either real NASA measurements or physics-based simulation with clear labelling.
- **No hardware manufacturing**: We do not produce BMS sensors, cameras, or other physical devices. We work with existing vehicle NTC thermistor data.
- **No cloud incident service**: The public demonstration site uses static hosting with local browser processing. It is not a durable cloud incident management platform.

### Q7. What assumptions are you making about the problem/pain point and its context?

Our key assumptions include:

1. **OEM data access**: Future deployment assumes authorised access to OEM BMS or telematics interfaces. We do not bypass vehicle security systems.

2. **Sensor reliability**: We assume BMS temperature sensors and system clocks are functioning correctly. The system flags missing or stale data rather than making assumptions.

3. **No personal data in telemetry**: Hardware aliases and telemetry payloads are stripped of VINs, license plates, and driver personal information at ingestion, in compliance with PDPO.

4. **Operator training**: We assume facility staff have a site emergency plan and basic training. VoltGuard provides decision support, not replacement for emergency protocols.

5. **Surface temperature correlation**: We assume that surface temperature measurements (from NTC thermistors) correlate with internal cell states. We acknowledge that some internal faults may not produce surface temperature signatures.

### Q8. Who is your target audience or user base?

Our target users span six roles, each with distinct needs:

| User Role | Primary Need | How VoltGuard Helps |
|-----------|-------------|---------------------|
| **Car Park Facility Manager** | Facility-wide thermal oversight; liability mitigation | Real-time heatmap dashboard; automated alerts; incident documentation |
| **Frontline Security Guard** | Clear, actionable guidance during incidents | PWA with large-button UI; bilingual voice alerts; step-by-step response guide |
| **Fire Services (HKFSD)** | Pre-incident thermal timeline and severity data | Pre-generated incident reports with thermal history and HKFSD protocol alignment |
| **Fleet Operator** | Multi-site, multi-vehicle battery health monitoring | Fleet overview dashboard; cross-site alerting; maintenance scheduling support |
| **Insurance Underwriter** | Data-driven EV parking risk assessment | Risk scoring based on thermal history; incident documentation for claims |
| **Nearby Residents** | Peace of mind about parking facility safety | Public-facing status indicators (where operators choose to share) |

Accessibility considerations:
- Bilingual interface (Traditional Chinese + English)
- Large touch-friendly controls for mobile devices
- Optional browser-based text-to-speech guidance
- High-contrast visual design with colour-blind-friendly status indicators
- Offline capability for basement environments with poor connectivity

### Q9. Who is your client (the group paying for the solution)?

Our proposed paying clients are:

**Primary: Commercial Car Park Operators**
- Shopping mall parking operators
- Office building facility management companies
- Residential estate management firms
- Estimated addressable market: ~500 commercial car parks in Hong Kong

**Secondary: Fleet Operators**
- Taxi and minibus fleet operators transitioning to EVs
- Corporate vehicle fleets
- Government vehicle pools

**Tertiary: Insurance Partners**
- Property insurers seeking EV parking risk data
- Vehicle insurers interested in battery health analytics

**Business Model**: B2B SaaS subscription with tiered pricing:
- **Basic** (HK$800-1,500/bay/month): Per-parking-bay thermal monitoring. Pricing benchmarked against existing parking management systems (HK$500-2,000/bay/month for basic IoT monitoring).
- **Professional** (HK$2,000-3,500/bay/month): Includes Copilot diagnostics and automated reporting. Premium reflects AI-assisted features and HKFSD protocol integration.
- **Enterprise** (Custom pricing): Multi-site fleet management and custom integrations.

Revenue projection (Year 1, conservative assumptions):
- Target: 50 commercial car parks (10% of ~500 addressable market)
- Average: 200 bays per car park
- Average revenue per bay: HK$1,200/month (mid-tier blended rate)
- Calculation: 50 × 200 × HK$1,200 × 12 months = **HK$12M annually**

No paying client, signed pilot, or procurement agreement has been confirmed at this stage. Customer validation is part of our post-hackathon roadmap.

### Q10. How did you gather information about the needs and preferences of your target audience? (Including testing your solution)

**Requirements Gathering**:
- Analysis of the project brief and Track 1 scope (Green Transport & Smart Mobility)
- Review of HKFSD Circular 3/2025 and related regulatory requirements
- Iterative feedback from our team lead (Year-3 BCDA student with technical leadership experience)
- Desk research on EV safety monitoring industry practices
- Review of 2025 Hack4SDGs winning projects to understand evaluation criteria and successful patterns

**Software Quality Assurance**:
We conducted systematic automated testing using Playwright/Edge covering:
- English and Chinese language switching
- Mobile responsive layout validation
- Genuine NASA data export/import workflows
- Event action state transitions (Open → Acknowledged → Closed)
- Offline behaviour with Service Worker caching
- 3D/2D thermal visualisation rendering
- Cross-browser compatibility (Edge, Chrome, Safari)

**User Testing Protocol** (prepared, scheduled for execution):

A structured consent-based user-test protocol has been designed for two participant roles:

| Task ID | Task Description | Success Criteria | Time Budget |
|---------|-----------------|------------------|-------------|
| T1 | Locate and select a NASA battery record from the dataset | Correct cell ID selected within 30 seconds | 2 min |
| T2 | Interpret thermal status vs. maintenance status | Correctly identify NORMAL/WARNING/DANGER vs. capacity review | 3 min |
| T3 | Inspect 3D model and identify measured vs. unmeasured regions | Correctly explain grey = unmeasured, coloured = measured | 3 min |
| T4 | Complete a handover workflow and export incident report | Successfully export JSON/PDF with all required fields | 4 min |
| T5 | Use frontline mode and follow voice guidance | Activate frontline mode, play voice checklist | 2 min |
| T6 | Verify system behaviour in offline/unconfigured states | Confirm offline indicator and Copilot "unconfigured" state | 1 min |

The protocol includes six tasks per session, designed for approximately 15 minutes each, with anonymised recording. Testing is scheduled for 13 October 2026 with at least two participants.

---

## Part 3: Teamwork

### Q11. How is your team structured, and what roles does each member play?

**Team 1023 / LadyBanana, HKBU**

| Member | Programme | Year | Primary Role | Key Responsibilities |
|--------|-----------|------|-------------|---------------------|
| **ZHAO Yuzhou** | BCDA | 3 | Team Lead / Full-Stack Engineer | System architecture; AI integration (Copilot endpoint); safety rule engine implementation; project coordination; technical decision-making |
| **WANG Shuqi** | BCDA | 1 | Frontend & UX Engineer | UI/UX design; 3D/2D thermal visualisation (Three.js + Canvas); bilingual interface implementation; mobile responsiveness; user research support |
| **TU Chengxi** | BCDA | 1 | Backend & Integration Engineer | REST API development; SQLite persistence layer; WebSocket real-time implementation; gateway authentication; data pipeline architecture |
| **JIA Jingxuan** | BCDA | 1 | Business Strategy & Pitch Lead | Pitch deck preparation; demo script writing; Q&A research and preparation; market analysis; presentation delivery |

All members are from the BCDA (Big Data Computing and Analytics) programme, bringing combined skills in Python, SQL, data visualisation, web development, and business analytics. ZHAO's Year-3 experience provides technical leadership, while the three Year-1 members contribute fresh perspectives in their respective specialisations.

**Role Assignment Rationale**: Roles were assigned based on individual strengths and interests identified during the Launch Day team formation. Regular check-ins ensure alignment and workload distribution.

**Q&A Assignment for Final Pitch**:
| Question Type | Primary Responder | Backup |
|---------------|-------------------|--------|
| Technical architecture | ZHAO Yuzhou | TU Chengxi |
| BMS / Battery physics | ZHAO Yuzhou | WANG Shuqi |
| GenAI / LLM integration | ZHAO Yuzhou | JIA Jingxuan |
| Business model / Market | JIA Jingxuan | ZHAO Yuzhou |
| Social impact / SDGs | JIA Jingxuan | WANG Shuqi |
| Ethics / Privacy / PDPO | TU Chengxi | ZHAO Yuzhou |

### Q12. What communication strategies are you using to ensure effective collaboration?

We use both real-time and async communication tools. Documentation is central to our workflow:

**1. Daily Stand-ups**
Brief progress updates via messaging group to maintain alignment across the four-person team. Each member shares: (a) what was completed yesterday, (b) what is planned today, (c) any blockers.

**2. Version Control & Code Review**
- Git is used for all source code version control
- All implementation decisions are captured in code comments, README files, and API documentation (`API.md`)
- Automated tests run before merging changes

**3. AI-Assisted Collaboration**
- WorkBuddy AI has been used to accelerate documentation drafting, code review, and gap analysis
- A portable `voltguard-evidence-review` skill was created as a reusable asset for structured evidence analysis
- AI-generated content is always reviewed and validated by team members before inclusion

**4. Safety Wording Review Protocol**
Any text related to thresholds, fire safety, or regulatory claims requires explicit team sign-off before inclusion in deliverables. This prevents overstatement of capabilities and ensures regulatory accuracy.

**5. Milestone Reviews**
Short reviews at the end of each development phase to verify deliverables against the five judging criteria (Problem Framing, Prototype/Demo, Technical Component, Feasibility/Impact, Sustainability/Ethics).

**6. Documentation-First Culture**
We write documentation as we build, not after. Every major component has inline code comments, a README, and integration notes.

---

## Part 4: Progress

### Q13. What have you achieved so far?

We have built a functional, demo-ready prototype with the following completed components:

**A. Frontend Dashboard**
- Interactive 3D/2D thermal visualisation using Three.js and HTML5 Canvas
- Real NASA battery data integration (B0005/06/07/18, 636 cycles)
- Time-series playback with play/pause, scrubbing, and cycle navigation
- Bilingual interface (Traditional Chinese + English) with one-click switching
- Mobile-responsive design with touch-friendly controls
- Fleet overview dashboard showing all monitored cells

**B. Safety Rule Engine (Tier 1)**
- Deterministic threshold evaluation: 60°C/80°C temperature + 1°C/s/2°C/s rate-of-rise
- Sub-10ms response time for safety-critical operations
- Zero LLM dependency in the decision path
- Separate thermal and capacity degradation assessments to prevent false fire alarms

**C. Operations Workspace**
- Structured handover workflow: Select Record → Review Evidence → Prepare Handover
- Event state management: Open → Acknowledged → Closed with audit trail
- JSON export and browser PDF printing for incident documentation
- Source provenance tracking for every data point

**D. Backend Services**
- Node.js HTTP server with SQLite persistence
- WebSocket real-time telemetry push with reconnection handling
- Gateway token authentication, origin validation, and CSRF protection
- Event transition audit logging

**E. Advanced Features**
- Service Worker offline caching for core functionality
- Browser text-to-speech voice guidance (bilingual)
- Frontline mode with large-button emergency UI
- PWA capability for mobile installation
- Automated Playwright/Edge QA across languages and viewports

**F. Documentation & Pitch Preparation**
- 16-slide editable pitch deck
- 300-second demo script
- Twenty anticipated Q&A answers
- User-test protocol document
- Portable WorkBuddy skill for evidence review

**Feature Completion Status**:

| Component | Status | Completion |
|-----------|--------|------------|
| 3D/2D Thermal Visualisation | Implemented & Tested | Core features working; NASA data renders correctly |
| NASA Data Integration | Implemented & Tested | 636 cycles loaded; export/import verified |
| Tier 1 Rule Engine | Implemented & Tested | <10ms response validated; thresholds confirmed |
| Bilingual Interface | Implemented & Tested | EN/ZH toggle working; all labels translated |
| Operations Workspace | Implemented & Tested | Handover workflow functional; audit trail working |
| SQLite Persistence | Implemented & Tested | Event storage verified; survives restart |
| WebSocket Real-time | Implemented & Tested | Push alerts working; reconnection tested |
| Service Worker Offline | Implemented & Tested | Core alerts work offline; caching verified in browser |
| Mobile Responsiveness | Implemented & Tested | Layout adapts to 320px+; touch controls tested |
| Report Export (JSON/PDF) | Implemented & Tested | JSON export validated; PDF printing tested |
| Voice Guidance | Implemented & Tested | Browser TTS works in EN/ZH; tested on Edge/Chrome |
| Frontline Mode | Implemented & Tested | Large-button UI works; mode switching functional |
| GenAI Copilot (Tier 2) | In Progress | 80% (endpoint ready, awaiting API key) |
| Physics Simulation | In Progress | 70% (scenarios designed, implementation ongoing) |
| RAG Knowledge Base | In Progress | 60% (curated guidelines, keyword matching ready) |
| Pitch Deck | In Progress | 50% (framework complete, content being refined) |

### Q14. What part of your project are you currently working on?

Our current focus areas are:

**1. GenAI Copilot Integration (Tier 2)** — *In Progress*
The backend endpoint (`/api/copilot/diagnose`) for GPT-4o Vision-based thermal analysis is implemented, including:
- Structured JSON output with bilingual diagnosis
- Consent controls and output guards
- Bilingual failure UI

The endpoint awaits configuration of an approved OpenAI API key for real-world evaluation. We have designed the system so that Tier 1 deterministic rules operate independently — GenAI is an enhancement layer, not a dependency.

**2. Physics-Based Simulation Scenarios** — *In Progress*
We are implementing three demonstration scenarios (Normal / Warning / Danger) using physics-based thermal models (Arrhenius equation for reaction rate estimation) to enable compelling demo storytelling. The NASA dataset does not contain thermal runaway events, so simulation is necessary for demonstrating the system's full alerting capability.

**3. RAG Knowledge Base (Simplified)** — *In Progress*
A curated keyword-matching retrieval system for HKFSD guidelines is implemented using two verified FSD source pages. This provides contextual protocol references for the Copilot without requiring full vector retrieval infrastructure.

**4. Pitch Deck & Demo Preparation** — *Ongoing*
Daily 30-minute sessions to refine the pitch narrative, incorporate new screenshots, and rehearse the 5-minute presentation.

### Q15. What are your immediate next steps or milestones?

| Milestone | Target Date | Deliverable | Owner |
|-----------|-------------|-------------|-------|
| **M1**: OpenAI API key configuration & Copilot evaluation | 8 Oct 2026 | Real GPT-4o calls validated; latency measured; bilingual output verified | ZHAO |
| **M2**: Physics simulation scenarios complete | 10 Oct 2026 | Normal/Warning/Danger buttons functional with smooth transitions | WANG |
| **M3**: User testing execution | 13 Oct 2026 | 2 participants × 15 min; feedback collected; UI adjustments made | JIA |
| **M4**: Pitch Deck submission | 18 Oct 2026 | Final 16-slide deck submitted to organisers | JIA |
| **M5**: Final rehearsal & offline backup | 23 Oct 2026 | 5+ timed rehearsals; offline demo prepared; Q&A roles confirmed | ALL |
| **M6**: Final Pitch Day | 24 Oct 2026 | 5-minute live presentation + demo at City University of Hong Kong | ALL |

See Figure 5 for the visual milestone timeline.

### Q16. How will you evaluate the success of your project as it progresses?

We have defined four categories of success metrics:

**Technical Metrics**:
- Tier 1 rule engine response time: < 10ms (already achieved)
- Copilot API response time: < 3 seconds (target)
- System uptime during demo: 100% (target)
- Offline functionality: Core alerts work without network (already achieved)

**Safety Metrics**:
- Deterministic results reproducible from identical measurements (already achieved)
- No fabricated or hallucinated data in any output (already achieved)
- Missing/stale evidence cannot be misclassified as "normal" (already achieved)
- All incident reports retain full provenance (already achieved)

**User Experience Metrics** (to be measured during user testing):
- Task completion rate for 6 protocol tasks: target > 80%
- Time to locate and interpret a thermal alert: target < 30 seconds
- User confidence in understanding system limitations: target > 70%

**Business Metrics** (post-hackathon):
- Number of pilot facility expressions of interest
- Pitch feedback scores from judges
- Demo scenario coverage (Normal/Warning/Danger all demonstrable)

**Hackathon Judging Criteria Alignment**:

| Criteria (20% each) | How We Address It | Evidence |
|---------------------|-------------------|----------|
| **Problem Framing** | HK EV fire case + 184K EVs + 800K parking spaces | News reports, government data |
| **Prototype/Demo** | Working dashboard + 3D heatmap + PWA + offline mode | Live demo with 3 scenarios |
| **Technical Component** | Two-tier architecture + GPT-4o Vision + RAG | Architecture diagram, code |
| **Feasibility/Impact** | B2B SaaS model + 500-car-park market + revenue projection | Business model canvas |
| **Sustainability/Ethics** | PDPO compliance + offline fallback + honest AI limitations | Data flow diagram, ethics statement |

---

## Part 5: Challenges

### Q17. What challenges or obstacles have you encountered so far? How did you address these challenges?

| Challenge | Impact | Our Response |
|-----------|--------|--------------|
| **Large historical records increased loading cost** | Slow initial page load | Split data into indices and per-cycle files with retry logic and browser caching |
| **NASA data has only one temperature point per cell** | Cannot demonstrate spatial heatmaps with real data | Built interactive 3D model showing one measured point honestly; unmeasured regions are grey, never invented |
| **Capacity loss could be confused with fire risk** | Users might misinterpret maintenance alerts as thermal emergencies | Implemented separate thermal and maintenance output streams with distinct visual treatments |
| **No positive fire events in NASA data** | Cannot validate rule engine against real thermal runaway | Using physics-based simulation (Arrhenius model) for demonstration; thresholds based on UL 9540A standards |
| **Source dates have no explicit timezone** | Risk of incorrect timestamp interpretation | Lab dates remain unlabelled rather than falsely converted to UTC |
| **Static hosting has no running backend** | Public demo cannot show full backend features | Clearly distinguish public (static) vs. local (full backend) capabilities; local setup documented |
| **GenAI latency concerns** | Judges may question real-time viability | Designed Tier 1 to run entirely independently; GenAI is optional enhancement with skeleton-screen UX |
| **API key procurement delay** | Cannot test Copilot with real LLM calls | Endpoint fully implemented; awaiting approved key; fallback UI handles unconfigured state gracefully |

### Q18. Do you foresee any potential challenges in the upcoming stages of your project? How do you intend to overcome these challenges?

| Upcoming Challenge | Likelihood | Mitigation Strategy |
|-------------------|------------|---------------------|
| **OEM data access restrictions** | High | Design system around standard BMS telemetry formats; plan for authorised adapter partnerships |
| **Inconsistent sensor signals across EV brands** | High | Implement source-specific validation and sensor-health checks; avoid universal calibration claims |
| **Poor clock synchronisation in distributed systems** | Medium | Use server-receive timestamps; flag stale data explicitly |
| **Sparse sensor layouts in older EVs** | Medium | Graceful degradation: fewer sensors = larger spatial uncertainty, clearly communicated |
| **Demo day network instability** | Medium | Local Node.js server + Service Worker offline cache + pre-recorded video backup |
| **Legal/security responsibility questions** | Medium | Explicit "decision support, not autonomous control" positioning; liability remains with facility operator |
| **Judge scepticism about GenAI necessity** | Medium | Prepared FAQ: "Why GenAI over traditional ML?" — few-shot reasoning, spatial pattern recognition, Hong Kong's limited labelled incident data |
| **Pitch time overruns** | Medium | Strict 300-second script; rehearsed 5+ times; optional "skip pages" identified |

---

## Part 6: Resources

### Q19. What resources (tools, data, libraries, etc.) have you utilised so far in your project? How have these resources contributed to your progress?

| Category | Resource | Contribution |
|----------|----------|-------------|
| **Data** | NASA Ames PCoE Battery Dataset (B0005/06/07/18) | Real laboratory data for pipeline validation, visualisation testing, and rule engine verification |
| **Data** | HK EPD EV Registration Statistics | Market sizing and problem significance evidence |
| **Data** | HKFSD Circular 3/2025 | Regulatory requirements for fire safety design |
| **Frontend** | HTML5, CSS3, JavaScript (ES2022) | Core dashboard implementation |
| **Frontend** | Three.js 0.180.0 (locally vendored) | 3D illustrative cell model with measured-point rendering |
| **Frontend** | HTML5 Canvas API | 2D thermal chart rendering and trend visualisation |
| **Backend** | Node.js 24 with native `node:sqlite` | HTTP server, database persistence, crypto functions |
| **Backend** | WebSocket (native) | Real-time telemetry push to connected clients |
| **Testing** | Playwright with Edge browser | Automated QA covering UI, data flows, offline behaviour |
| **AI** | OpenAI GPT-4o documentation | Informed Copilot endpoint design (awaiting API key for live testing) |
| **Hosting** | WorkBuddy Sites static hosting | Public demo deployment |
| **Collaboration** | WorkBuddy AI | Documentation drafting, code review, gap analysis; portable skill created |
| **Design** | Artifact Tool | Editable evidence slides and visual assets |

### Q20. Are there any resources (hardware, software, data, expertise) that you need but currently lack?

| Missing Resource | Why Needed | Plan to Acquire |
|------------------|-----------|----------------|
| **Authorised real vehicle/BMS gateway** | To validate integration with actual EV telemetry | Approach OEMs and fleet operators for pilot partnerships post-hackathon |
| **Real multi-sensor battery layouts** | NASA data has one point; real packs have 16-64 sensors | Partner with battery research labs or EV manufacturers |
| **Labelled thermal runaway incidents** | To validate detection sensitivity and false-positive rates | Collaborate with fire safety researchers; use physics simulation as interim |
| **Qualified battery/fire-safety expert review** | To validate threshold design and safety claims | Seek academic advisor or industry mentor |
| **Real-user test participants** | To validate UX assumptions | Execute prepared protocol with recruited participants |
| **Approved cloud security audit** | For production deployment data governance | Post-hackathon: engage cybersecurity consultant |
| **OpenAI API credentials** | To test Copilot with real LLM calls | Apply for academic/research access or team-funded account |

---

## Part 7: Learnings

### Q21. What have you learned so far, either about the problem you're addressing, the technologies you're using, or working as a team?

**About the Problem**:
- **Honest uncertainty builds trust**: In safety-critical systems, stating what you do not know earns more credibility than overclaiming. Our source labels and uncertainty annotations are now core design principles.
- **Laboratory aging ≠ real-world failure**: NASA capacity degradation data is excellent for testing data workflows, but it cannot validate fire prediction. We learned to separate "maintenance review" from "thermal alert" to prevent confusion.
- **Surface temperature has limits**: A single surface measurement may not catch every internal fault. We explicitly communicate this limitation rather than hiding it.

**About Technology**:
- **Tiered architecture matters for AI safety**: Separating deterministic rules (Tier 1) from AI enhancement (Tier 2) lets us be clear about GenAI's role while keeping safety-critical functions independent.
- **Offline-first design matters**: Basement car parks often have poor connectivity. Service Worker caching ensures core safety features work regardless of network state.
- **Bilingual UX is not translation**: Chinese and English interfaces require different information density, typography, and cultural context. We designed both from the ground up, not as afterthoughts.

**About Teamwork**:
- **Documentation is a first-class deliverable**: In a compressed timeline, clear documentation prevents knowledge silos and enables parallel work.
- **Specialisation + overlap works**: Each member owns a domain, but cross-training ensures no single point of failure.
- **AI as accelerator, not replacement**: WorkBuddy AI helped us draft faster, but every output was reviewed, corrected, and validated by human team members.

### Q22. How has your understanding of the problem or solution evolved since you started working on it?

**Evolution of Scope**:
- **Initial concept**: A car-park observation tool focused on static parking scenarios
- **Current scope**: A comprehensive monitoring system covering driving, parked, and charging contexts, with distinct thermal and maintenance assessment streams

**Evolution of Technical Approach**:
- **Initial plan**: Python/FastAPI backend with Next.js frontend (as documented in early planning)
- **Current implementation**: Node.js + native SQLite backend with vanilla JavaScript frontend — chosen for faster iteration, simpler deployment, and hackathon-appropriate complexity

**Evolution of AI Role**:
- **Initial concept**: GenAI as primary diagnostic engine
- **Current design**: GenAI as optional, opt-in enhancement layer that enhances but never replaces deterministic safety rules. This directly responds to the hackathon tip: "Don't overpromise on GenAI's capabilities."

**Evolution of Data Honesty**:
- **Initial approach**: Considered generating synthetic spatial heatmaps to make NASA data look more impressive
- **Current approach**: Show one honest measurement point; grey out unmeasured regions; use clearly labelled physics simulation for demonstration scenarios

### Q23. What other issues or comments does your team want to raise?

**1. Commitment to Honest Reporting**
We did not simulate fire incidents or fabricate vehicle data for this report. Every claim is backed by implemented code, tested functionality, or documented protocols. We do not claim regulatory compliance, signed customers, completed user studies, fire-detection accuracy, or verified OEM integration without independent evidence.

**2. Regulatory Context**
Our system is designed with Hong Kong's regulatory framework in mind:
- **PDPO compliance**: PII stripped at ingestion; no VINs or license plates stored
- **Electronic Transactions Ordinance**: All incident reports include cryptographic signatures and audit trails
- **HKFSD alignment**: Copilot references real FSD guidelines where applicable

**3. GenAI Limitations Acknowledgement**
We are fully transparent about GenAI limitations:
- GPT-4o Vision processing takes 1-3 seconds — not suitable for real-time safety decisions
- AI may misinterpret sensor noise as anomaly patterns
- Diagnostic outputs include explicit confidence scores and limitations statements
- The system is designed as **decision support**, not autonomous safety control

**4. Future Vision**
Beyond the hackathon, we envision VoltGuard as a platform that:
- Partners with Hong Kong car park operators for pilot deployments
- Integrates with existing building management systems
- Expands to cover the Greater Bay Area's growing EV infrastructure
- Contributes to SDG 11 (Sustainable Cities), SDG 13 (Climate Action), SDG 7 (Clean Energy), and SDG 9 (Industry & Innovation)

**5. WorkBuddy Special Prize Application**
We are applying for the 2026 WorkBuddy Special Prize with the following evidence:
- **Purposeful Human-AI Collaboration**: Tier 1 (human-verifiable deterministic rules) + Tier 2 (AI enhancement) demonstrates intentional human-AI task allocation
- **Reusable Skills**: The `voltguard-evidence-review` portable skill has passed structural validation and can be reused across projects
- **Quality of Outcomes**: AI-assisted documentation and code review accelerated our development without compromising accuracy
- **Responsible Use and Validation**: All AI-generated content is human-reviewed; Copilot outputs include explicit limitations
- **Precision and Efficiency**: Structured prompts with JSON schema output ensure consistent, machine-readable results

---

*End of Interim Progress Report*

*All data sources, code implementations, and test results referenced in this report are available for verification upon request.*

*Report compiled by Team 1023 / LadyBanana, HKBU | 4 October 2026*
