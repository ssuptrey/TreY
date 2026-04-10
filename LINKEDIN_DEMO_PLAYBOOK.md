# TreY - LinkedIn Demo Master Playbook

This document is your A-to-Z guide for recording, editing, and posting a high-converting software demo of TreY on LinkedIn. We are targeting enterprise buyers, CISOs, and compliance managers. The tone is professional, authoritative, and focused on solving the pain of manual compliance tracking. No emojis.

---

## Phase 1: Pre-Production & Setup (How to prepare)

1. **Clean Your Environment**
   - Use Google Chrome or Edge.
   - Hide your bookmarks bar (Ctrl+Shift+B).
   - Close all unnecessary browser tabs.
   - Set browser zoom to 100% or 110% so text is legible on mobile screens.

2. **Recording Software**
   - **Recommended:** Loom, Screen Studio (Mac), or OBS Studio (PC). 
   - Screen Studio is the absolute best for automatic, smooth zooming. If using Loom or OBS, you will need to manually zoom in on key elements during editing.
   - **Audio:** Use a dedicated microphone. Record in a quiet room. Speak slowly and confidently.

3. **Application State**
   - Ensure both frontend and backend are running (`npm start`).
   - Have the login page open (`http://localhost:3000/login`) before you hit record.

---

## Phase 2: The Script & Scene Flow (What and When to Record)

**Target Video Length:** 1.5 to 2 minutes. Keep it punchy.

### Scene 1: The Hook & The Problem (0:00 - 0:15)
* **Visual:** Start on the TreY Login screen. Type in `ciso@acme.com` / `demo123` and click Login.
* **Script:** "If you run an enterprise compliance team, you know that tracking SOC 2 and ISO 27001 across hundreds of engineers is a manual nightmare. Spreadsheets fail, evidence gets lost, and audits take months. That is why we built TreY."

### Scene 2: Executive Oversight (0:15 - 0:45)
* **Visual:** The screen transitions to the Master Admin Dashboard. Move your mouse slowly over the SLA Heatmap and the Overdue SLA notifications. 
* **Script:** "TreY is a unified compliance execution system. From the CISO dashboard, you have immediate, real-time visibility into your entire organization's risk profile. You can instantly see exactly which obligations are past their SLA, who owns them, and what the bottleneck is. No more chasing engineers in Slack."

### Scene 3: Engineering Workflow (0:45 - 1:15)
* **Visual:** Log out of the CISO account. Log back in as `seceng@acme.com` / `demo123`. Navigate to 'My Tasks' or click on a specific Obligation (like "Annual Penetration Testing").
* **Script:** "But compliance does not happen in a vacuum—it happens at the engineering level. TreY gives engineers a distraction-free workflow. They see exactly what policies they need to fulfill, when the deadline is, and they can upload cryptographically tracked evidence directly into the platform."
* **Action:** Click "Upload Evidence" or show the existing uploaded NCC Group Pentest report within the UI.

### Scene 4: Immutable Audit Trail (1:15 - 1:35)
* **Visual:** Navigate to the Evidence Wall or the Audit Log section of the obligation. Highlight the timestamps.
* **Script:** "Once evidence is uploaded, it is locked. The system automatically updates the SLA clock and appends an immutable record to the audit trail. When the external auditors arrive, you don't spend weeks gathering PDFs. You just grant them read-only access to ТреY, and your audit is done."

### Scene 5: The Call to Action (1:35 - 1:45)
* **Visual:** Zoom out to show the full dashboard one last time. 
* **Script:** "Stop managing compliance in spreadsheets. We are currently onboarding design partners for our private beta. If you want to automate your enterprise compliance from end to end, send me a direct message."

---

## Phase 3: Post-Production (Editing)

1. **Crop the Frame:** Ensure your Windows taskbar and the browser URL bar are cropped out. The viewer should only see the application UI.
2. **Add Captions:** 80% of LinkedIn users watch videos on mute. Use tools like CapCut (free) or Veed.io to auto-generate subtitles. Place them clearly at the bottom center of the video.
3. **Zoom Ins:** During Scene 3 (Engineering workflow) and Scene 4 (Audit trail), zoom the video in by 150% on the specific text rows so mobile users can read the "SOC 2" classifications and timestamps.

---

## Phase 4: Posting to LinkedIn (How to Post)

### When to Post
- **Best Days:** Tuesday, Wednesday, or Thursday.
- **Best Times:** 8:15 AM or 1:15 PM (Local Time). This catches people at the start of their workday or right after lunch.

### The LinkedIn Caption
Do not just post the video. The text above the video is crucial. Copy and paste the following structure:

```text
The biggest lie in enterprise security: "We can manage SOC 2 compliance in a spreadsheet."

When you scale past 50 engineers, spreadsheets become a liability.
- Evidence gets buried in Slack.
- Deadlines are missed.
- Audits become a 3-month stressful scramble.

We built TreY to fix this.

TreY is a Compliance Execution System built for modern security teams. In the demo below, I show how we connect CISO oversight directly to engineering workflows smoothly and securely.

Features highlighted:
1. Real-time SLA Risk Dashboard
2. Distraction-free Obligation queues for engineers
3. Immutable Audit Trails and Evidence Walls

Are you a CISO or Security Lead tired of manual compliance? We are opening up 5 spots for our private beta. 

Send me a DM or leave a comment below and I will get you set up. 

#CyberSecurity #Compliance #SOC2 #ISO27001 #InformationSecurity #B2B
```

### Engagement Strategy
1. **First 60 Minutes:** The first hour is critical for the LinkedIn algorithm. 
2. **Reply to Comments:** Reply to every single comment you receive with a thoughtful sentence (not just "Thanks"). This boosts the algorithmic reach.