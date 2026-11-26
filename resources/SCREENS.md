# CareConnect — screen inventory

133 screens across 5 products. Every screen PNG is in `screens/<product>/`, and every screen is clickable in the matching file in `prototypes/`.

## Step 1 · Clinic / doctor web dashboard

Prototype: `prototypes/1-Clinic-Doctor-Dashboard.html`  
Desktop web (1440 px). Used by doctors, junior doctors and clinic owners at Shifa Family Clinic.

| # | Screen | File | What it shows / key interactions |
|---|---|---|---|
| 1 | Dashboard | `screens/1-clinic-dashboard/01-dashboard.png` | KPIs, high-acuity alerts (home devices, missed doses), app booking requests (accept/decline), today’s queue, tasks, charts. "Customize widgets" opens widget picker. |
| 2 | Patients list | `screens/1-clinic-dashboard/02-patients-list.png` | Search by name/MRN/CNIC/phone, status tabs, filters, risk chips; row opens the patient record. "Add patient" modal. |
| 3 | Patient record - Overview | `screens/1-clinic-dashboard/03-patient-record-overview.png` | Header with allergies/conditions/insurance, care team, family links, summary cards, problem list. |
| 4 | Patient record - Timeline | `screens/1-clinic-dashboard/04-patient-record-timeline.png` | All events in date order: visits, labs, prescriptions, messages, device readings. |
| 5 | Patient record - Vitals | `screens/1-clinic-dashboard/05-patient-record-vitals.png` | BP / glucose / weight / SpO2 trends with thresholds; readings from clinic and home devices. |
| 6 | Patient record - Medications | `screens/1-clinic-dashboard/06-patient-record-medications.png` | Active meds, adherence, add/stop medication (search, dose, frequency, days). |
| 7 | Patient record - Pain map | `screens/1-clinic-dashboard/07-patient-record-pain-map.png` | Body map to mark pain points with intensity; history of pain scores. |
| 8 | Patient record - Documents | `screens/1-clinic-dashboard/08-patient-record-documents.png` | Uploaded reports, scans, consent forms; filter and upload. |
| 9 | Patient record - Visit history | `screens/1-clinic-dashboard/09-patient-record-visit-history.png` | Past encounters with diagnosis, doctor and notes. |
| 10 | Patient record - Exam notes | `screens/1-clinic-dashboard/10-patient-record-exam-notes.png` | SOAP-style notes (HPI, exam), favourites/templates. |
| 11 | Schedule | `screens/1-clinic-dashboard/11-schedule.png` | Day/week calendar by doctor, in-clinic vs video, new appointment and reschedule. |
| 12 | Video consult - Patient | `screens/1-clinic-dashboard/12-video-consult-patient.png` | Live video call with controls (mic, camera, screen share, captions, Urdu ⇄ English translation) and patient side panel. |
| 13 | Video consult - Labs | `screens/1-clinic-dashboard/13-video-consult-labs.png` | Lab results visible during the call. |
| 14 | Video consult - AI notes | `screens/1-clinic-dashboard/14-video-consult-ai-notes.png` | AI-drafted consultation notes for the doctor to review and edit. |
| 15 | Video consult - Prescription | `screens/1-clinic-dashboard/15-video-consult-prescription.png` | E-prescription builder during the call; ends with visit summary. |
| 16 | Care plans - Care plan | `screens/1-clinic-dashboard/16-care-plans-care-plan.png` | Patient care plan: goals, tasks, assigned team, progress. |
| 17 | Care plans - Journey builder | `screens/1-clinic-dashboard/17-care-plans-journey-builder.png` | Visual follow-up journey (steps, waits, conditions) for programmes such as diabetes or antenatal care. |
| 18 | Messages - Inbox | `screens/1-clinic-dashboard/18-messages-inbox.png` | Secure patient/staff threads with attachments and quick replies. |
| 19 | Messages - CareBot monitoring | `screens/1-clinic-dashboard/19-messages-carebot-monitoring.png` | CareBot conversations, escalations to staff. |
| 20 | Messages - Scheduled emails & SMS | `screens/1-clinic-dashboard/20-messages-scheduled-emails-sms.png` | Queued reminders and messages, edit/cancel. |
| 21 | Outreach - Campaigns | `screens/1-clinic-dashboard/21-outreach-campaigns.png` | SMS/WhatsApp/email campaigns with audience, stats; "New campaign" modal. |
| 22 | Outreach - Surveys & forms | `screens/1-clinic-dashboard/22-outreach-surveys-forms.png` | Pre-visit forms and satisfaction surveys with response rates. |
| 23 | Outreach - Follow-up flows | `screens/1-clinic-dashboard/23-outreach-follow-up-flows.png` | Automated follow-up flows after visits/discharge. |
| 24 | Analytics | `screens/1-clinic-dashboard/24-analytics.png` | Clinic analytics: visits, revenue, no-shows, outcomes; widget picker. |
| 25 | Team - Team members | `screens/1-clinic-dashboard/25-team-team-members.png` | Staff list, roles, status; invite member modal. |
| 26 | Team - Roles & permissions | `screens/1-clinic-dashboard/26-team-roles-permissions.png` | Permission matrix: owner doctor grants access to junior doctors and receptionists. |
| 27 | Team - Audit trail | `screens/1-clinic-dashboard/27-team-audit-trail.png` | Who viewed/changed which record and when. |
| 28 | Team - Security & integrations | `screens/1-clinic-dashboard/28-team-security-integrations.png` | 2-step sign-in, sessions, connected services (labs, payments, SMS). |
| 29 | Modal - Customise dashboard widgets | `screens/1-clinic-dashboard/29-modal-customise-dashboard-widgets.png` | Toggle and reorder dashboard widgets. |
| 30 | Modal - Add patient | `screens/1-clinic-dashboard/30-modal-add-patient.png` | New patient form incl. CNIC/B-Form, phone, guardian, insurance. |
| 31 | Modal - Add medication | `screens/1-clinic-dashboard/31-modal-add-medication.png` | Search medicine, dose, frequency, duration, instructions. |
| 32 | Modal - New appointment | `screens/1-clinic-dashboard/32-modal-new-appointment.png` | Patient, doctor, type, date/slot picker. |
| 33 | Modal - Reschedule appointment | `screens/1-clinic-dashboard/33-modal-reschedule-appointment.png` | Pick a new slot; patient is notified. |
| 34 | Modal - Visit summary | `screens/1-clinic-dashboard/34-modal-visit-summary.png` | End-of-consult summary sent to patient app. |
| 35 | Modal - New campaign | `screens/1-clinic-dashboard/35-modal-new-campaign.png` | Audience, channel, message, schedule. |
| 36 | Modal - Analytics widgets | `screens/1-clinic-dashboard/36-modal-analytics-widgets.png` | Choose analytics widgets. |
| 37 | Modal - Invite team member | `screens/1-clinic-dashboard/37-modal-invite-team-member.png` | Name, phone/email, role, permissions. |

## Step 2 · Patient mobile app

Prototype: `prototypes/2-Patient-Mobile-App.html`  
Mobile (390 × 844 phone frame). The left panel is a demo-only screen jumper and is not part of the app.

| # | Screen | File | What it shows / key interactions |
|---|---|---|---|
| 1 | Login | `screens/2-patient-app/01-login.png` | Phone-number login, English/Urdu toggle. |
| 2 | OTP verification | `screens/2-patient-app/02-otp-verification.png` | 5-digit OTP entry with resend timer. |
| 3 | Home | `screens/2-patient-app/03-home.png` | Greeting, family member switcher, next appointment, quick actions, today’s medicines (Take), vitals, emergency button. |
| 4 | Find a doctor | `screens/2-patient-app/04-find-a-doctor.png` | Search, specialty chips, list/map view, filters (gender, Sehat Card, video), sort. |
| 5 | Doctor profile & booking | `screens/2-patient-app/05-doctor-profile-booking.png` | Doctor details, PMDC verified badge, fees, clinic vs video, day and slot picker, book. |
| 6 | Pre-visit questionnaire | `screens/2-patient-app/06-pre-visit-questionnaire.png` | Multi-step symptoms form sent to the doctor before the visit. |
| 7 | Booking confirmed | `screens/2-patient-app/07-booking-confirmed.png` | Confirmation with add-to-calendar, directions, pre-visit form. |
| 8 | Appointments | `screens/2-patient-app/08-appointments.png` | Upcoming/past tabs, join video, reschedule, cancel. |
| 9 | Video call | `screens/2-patient-app/09-video-call.png` | Full-screen video consultation with live captions/translation. |
| 10 | Health records | `screens/2-patient-app/10-health-records.png` | Records by date or type, share records. |
| 11 | Lab reports | `screens/2-patient-app/11-lab-reports.png` | All lab reports for the selected family member. |
| 12 | Lab report detail | `screens/2-patient-app/12-lab-report-detail.png` | Result groups with normal ranges, flags and simple explanation; print/download. |
| 13 | Vitals | `screens/2-patient-app/13-vitals.png` | BP, glucose, weight charts; add a reading. |
| 14 | Medicines | `screens/2-patient-app/14-medicines.png` | Today’s doses, adherence, refill reminders. |
| 15 | Add medicine | `screens/2-patient-app/15-add-medicine.png` | Manual add with dose and schedule. |
| 16 | Upload prescription photo | `screens/2-patient-app/16-upload-prescription-photo.png` | Photograph a paper prescription. |
| 17 | Order from pharmacy | `screens/2-patient-app/17-order-from-pharmacy.png` | Send prescription to a partner pharmacy, delivery or pickup. |
| 18 | Bills | `screens/2-patient-app/18-bills.png` | Family bills, paid/unpaid, pay all. |
| 19 | Pay a bill | `screens/2-patient-app/19-pay-a-bill.png` | JazzCash, Easypaisa, card, Sehat Card; slide to pay; receipt. |
| 20 | Messages | `screens/2-patient-app/20-messages.png` | Threads with doctors and clinic. |
| 21 | Chat with doctor | `screens/2-patient-app/21-chat-with-doctor.png` | Secure chat with attachments. |
| 22 | CareBot assistant | `screens/2-patient-app/22-carebot-assistant.png` | Chatbot for FAQs, booking and reminders (English/Urdu). |
| 23 | Exercises & pain tracker | `screens/2-patient-app/23-exercises-pain-tracker.png` | Prescribed exercises with videos and daily pain check-in. |
| 24 | Family members | `screens/2-patient-app/24-family-members.png` | Linked family members (children, parents) and their access. |
| 25 | Notifications | `screens/2-patient-app/25-notifications.png` | Reminders, results ready, messages. |
| 26 | Health library | `screens/2-patient-app/26-health-library.png` | Articles and videos in English/Urdu. |
| 27 | Profile & settings | `screens/2-patient-app/27-profile-settings.png` | Personal details, CNIC, insurance, language, privacy. |
| 28 | Sheet - Switch family member | `screens/2-patient-app/28-sheet-switch-family-member.png` | Bottom sheet to act on behalf of a family member. |
| 29 | Sheet - Emergency (Rescue 1122 / Edhi) | `screens/2-patient-app/29-sheet-emergency-rescue-1122-edhi.png` | One-tap call to Rescue 1122 / Edhi 115 and emergency contacts; share location. |
| 30 | Sheet - Doctor filters | `screens/2-patient-app/30-sheet-doctor-filters.png` | Filter doctors by gender, Sehat Card, video, fee. |
| 31 | Sheet - Add a vital reading | `screens/2-patient-app/31-sheet-add-a-vital-reading.png` | Enter BP / glucose / weight. |
| 32 | Sheet - Add medicine options | `screens/2-patient-app/32-sheet-add-medicine-options.png` | Add manually, scan, or from prescription photo. |
| 33 | Sheet - Add family member | `screens/2-patient-app/33-sheet-add-family-member.png` | Add child (B-Form) or adult (CNIC), relationship. |
| 34 | Sheet - Share records | `screens/2-patient-app/34-sheet-share-records.png` | Share selected records with a doctor via link. |
| 35 | Sheet - Pain check-in | `screens/2-patient-app/35-sheet-pain-check-in.png` | Pain score slider and location. |
| 36 | Sheet - Reschedule appointment | `screens/2-patient-app/36-sheet-reschedule-appointment.png` | Pick a new time for an existing booking. |

## Step 3 · Front desk / reception

Prototype: `prototypes/3-Front-Desk-Reception.html`  
Tablet / desktop web. Used by the receptionist: queue, check-in, tokens, billing and closing the day.

| # | Screen | File | What it shows / key interactions |
|---|---|---|---|
| 1 | Queue board | `screens/3-front-desk/01-queue-board.png` | Kanban: arriving soon, waiting & vitals, ready, in consult, done; tokens per doctor, wait timers, urgent flags; rooms with "Call". |
| 2 | Appointments | `screens/3-front-desk/02-appointments.png` | Day list with filters; phone booking. |
| 3 | Doctors status | `screens/3-front-desk/03-doctors-status.png` | Doctor availability, running late, call next, notify patients of delay. |
| 4 | Billing | `screens/3-front-desk/04-billing.png` | Unpaid visits, invoice with discounts, payer cover (Sehat Card/insurance), payment method, receipt. |
| 5 | Waiting room TV display | `screens/3-front-desk/05-waiting-room-tv-display.png` | Big-screen "now serving" tokens in Urdu and English. |
| 6 | Closing & cash drawer | `screens/3-front-desk/06-closing-cash-drawer.png` | Cash count vs expected, pending claims, close shift. |
| 7 | Modal - Check-in step 1 find patient | `screens/3-front-desk/07-modal-check-in-step-1-find-patient.png` | Search existing patient or register new. |
| 8 | Modal - Check-in step 2 visit details | `screens/3-front-desk/08-modal-check-in-step-2-visit-details.png` | Doctor, reason, urgent triage. |
| 9 | Modal - Check-in step 3 payment | `screens/3-front-desk/09-modal-check-in-step-3-payment.png` | Payer (self, Sehat Card, insurance), eligibility check, pay now or later. |
| 10 | Modal - Check-in step 4 token issued | `screens/3-front-desk/10-modal-check-in-step-4-token-issued.png` | Token slip (Urdu/English), patients ahead, print or SMS. |
| 11 | Modal - Phone booking | `screens/3-front-desk/11-modal-phone-booking.png` | Book for a caller: find patient, doctor, day, slot. |
| 12 | Modal - Receipt | `screens/3-front-desk/12-modal-receipt.png` | Payment receipt with print/SMS/WhatsApp. |
| 13 | Modal - Close shift | `screens/3-front-desk/13-modal-close-shift.png` | Confirm cash handover and close the day. |
| 14 | Lock screen | `screens/3-front-desk/14-lock-screen.png` | PIN lock when the receptionist steps away. |

## Step 4 · Platform admin panel

Prototype: `prototypes/4-Platform-Admin-Panel.html`  
Desktop web. For the CareConnect owner and team: clinics, PMDC verification, billing, payouts, support, compliance.

| # | Screen | File | What it shows / key interactions |
|---|---|---|---|
| 1 | Overview | `screens/4-admin-panel/01-overview.png` | Platform KPIs (clinics, verified doctors, patients, consults, MRR), growth chart, items needing attention, service health, newest clinics, consults by city. |
| 2 | Clinics | `screens/4-admin-panel/02-clinics.png` | All clinics with status tabs, filters, plan, health score, billing state. |
| 3 | Clinic profile drawer | `screens/4-admin-panel/03-clinic-profile-drawer.png` | Clinic details, plan change, usage vs limits, invoices, view-as-clinic (needs approval), extend trial, suspend/reactivate. |
| 4 | Onboarding pipeline | `screens/4-admin-panel/04-onboarding-pipeline.png` | Drag-and-drop stages Applied → Documents → Verification → Training → Live; go-live blocked until doctors are verified. |
| 5 | Doctor verification | `screens/4-admin-panel/05-doctor-verification.png` | PMDC verification queue with documents (CNIC, PMDC certificate, degree) and reviewer checklist. |
| 6 | Doctor verification - PMDC checked | `screens/4-admin-panel/06-doctor-verification-pmdc-checked.png` | PMDC register result example (expired licence) — approve stays disabled. |
| 7 | Plans | `screens/4-admin-panel/07-plans.png` | Free / Starter / Pro / Enterprise with feature matrix; edit price. |
| 8 | Invoices | `screens/4-admin-panel/08-invoices.png` | All subscription invoices. |
| 9 | Failed payments | `screens/4-admin-panel/09-failed-payments.png` | Failed invoices with retry / send pay link; auto-suspension rule. |
| 10 | Payouts - ready to approve | `screens/4-admin-panel/10-payouts-ready-to-approve.png` | Weekly payout batch: gross, commission, gateway fee, net per clinic; IBAN missing on hold; two-person approval with OTP. |
| 11 | Payouts - history | `screens/4-admin-panel/11-payouts-history.png` | Past payout batches. |
| 12 | Support tickets | `screens/4-admin-panel/12-support-tickets.png` | Ticket list with SLA timers; detail with assign, priority, JazzCash TID lookup, quick replies, internal notes, resolve. |
| 13 | Analytics | `screens/4-admin-panel/13-analytics.png` | Clinic analytics: visits, revenue, no-shows, outcomes; widget picker. |
| 14 | Compliance - data requests | `screens/4-admin-panel/14-compliance-data-requests.png` | Patient export/delete/correct requests with deadlines. |
| 15 | Compliance - support access | `screens/4-admin-panel/15-compliance-support-access.png` | Two-person approval for staff to open a clinic account; auto-expiry. |
| 16 | Compliance - audit log | `screens/4-admin-panel/16-compliance-audit-log.png` | Read-only log of admin actions. |
| 17 | Compliance - policies | `screens/4-admin-panel/17-compliance-policies.png` | Data storage, admin roles, sign-in security, agreements (placeholder text). |
| 18 | System | `screens/4-admin-panel/18-system.png` | Service status (SMS, WhatsApp, JazzCash, Easypaisa, Sehat Card, video, lab API), feature flags with % rollout, minimum app versions. |
| 19 | Modal - Announcement | `screens/4-admin-panel/19-modal-announcement.png` | Send announcement to clinics/doctors/patients via app, SMS, email with reach and SMS cost. |
| 20 | Modal - Suspend clinic | `screens/4-admin-panel/20-modal-suspend-clinic.png` | Reason and internal note. |
| 21 | Modal - Add clinic | `screens/4-admin-panel/21-modal-add-clinic.png` | Create onboarding application manually. |
| 22 | Modal - Approve payout | `screens/4-admin-panel/22-modal-approve-payout.png` | OTP confirmation for payout batch. |
| 23 | Modal - Edit plan price | `screens/4-admin-panel/23-modal-edit-plan-price.png` | Change monthly price; grandfather existing clinics. |
| 24 | Modal - Reject doctor | `screens/4-admin-panel/24-modal-reject-doctor.png` | Rejection reason sent to clinic. |
| 25 | Modal - Delete patient account | `screens/4-admin-panel/25-modal-delete-patient-account.png` | What gets deleted vs kept by clinics (legal duty). |

## Step 5 · Lab & pharmacy partner portal

Prototype: `prototypes/5-Lab-Pharmacy-Partner-Portal.html`  
Desktop web. One portal with two partner types; the Lab / Pharmacy switch in the sidebar is for the demo only.

| # | Screen | File | What it shows / key interactions |
|---|---|---|---|
| 1 | Lab - Overview | `screens/5-partner-portal/01-lab-overview.png` | Today’s KPIs, critical result banner, today’s work list, weekly chart, ratings. |
| 2 | Lab - Test orders (new) | `screens/5-partner-portal/02-lab-test-orders-new.png` | Orders from doctors: tests, price, fasting instructions, doctor note; accept/decline. |
| 3 | Lab - Test orders (in progress) | `screens/5-partner-portal/03-lab-test-orders-in-progress.png` | Status stepper; next action (collect, scan in, enter results). |
| 4 | Lab - Test orders (completed) | `screens/5-partner-portal/04-lab-test-orders-completed.png` | Published reports; view/resend. |
| 5 | Lab - Home collection | `screens/5-partner-portal/05-lab-home-collection.png` | Phlebotomist cards, map, pick-up steps (Assigned → On the way → Collected → At lab); female-phlebotomist rule. |
| 6 | Lab - Results entry (critical) | `screens/5-partner-portal/06-lab-results-entry-critical.png` | Result entry with live High/Low/Critical flags; critical value requires logged doctor call. |
| 7 | Lab - Results pathologist check | `screens/5-partner-portal/07-lab-results-pathologist-check.png` | Pathologist preview, re-run or sign & send. |
| 8 | Lab - Tests & prices | `screens/5-partner-portal/08-lab-tests-prices.png` | Price, turnaround, home collection and offered toggles per test. |
| 9 | Lab - Payouts | `screens/5-partner-portal/09-lab-payouts.png` | Weekly settlement, commission, gateway fee, bank account, history. |
| 10 | Lab modal - Report preview | `screens/5-partner-portal/10-lab-modal-report-preview.png` | Patient-facing report with flags and simple English/Urdu summary, digital signature. |
| 11 | Lab modal - Critical value call log | `screens/5-partner-portal/11-lab-modal-critical-value-call-log.png` | Who was called, time, read-back confirmation. |
| 12 | Lab modal - Decline order | `screens/5-partner-portal/12-lab-modal-decline-order.png` | Reason sent to doctor and patient. |
| 13 | Pharmacy - Overview | `screens/5-partner-portal/13-pharmacy-overview.png` | KPIs, prescription queue, low stock, expiring soon. |
| 14 | Pharmacy - New prescription | `screens/5-partner-portal/14-pharmacy-new-prescription.png` | E-prescription with doctor PMDC, items, stock, price, generic offer, send quote. |
| 15 | Pharmacy - Out of stock & generic | `screens/5-partner-portal/15-pharmacy-out-of-stock-generic.png` | Out-of-stock brand replaced by generic with saving shown. |
| 16 | Pharmacy - Packing checklist | `screens/5-partner-portal/16-pharmacy-packing-checklist.png` | Checklist incl. cold-chain insulin; mark packed updates stock. |
| 17 | Pharmacy - Dispatch (controlled) | `screens/5-partner-portal/17-pharmacy-dispatch-controlled.png` | Controlled medicine warning (CNIC check at handover). |
| 18 | Pharmacy - Deliveries | `screens/5-partner-portal/18-pharmacy-deliveries.png` | Riders, cash on delivery per rider, dispatch, 4-digit delivery code confirmation. |
| 19 | Pharmacy - Inventory | `screens/5-partner-portal/19-pharmacy-inventory.png` | Stock, reorder level, expiry, batch, cold/controlled filters, receive stock, reorder. |
| 20 | Pharmacy - Payouts | `screens/5-partner-portal/20-pharmacy-payouts.png` | Weekly settlement incl. cash-on-delivery commission. |
| 21 | Pharmacy modal - Receive stock | `screens/5-partner-portal/21-pharmacy-modal-receive-stock.png` | Quantity, batch, expiry. |
