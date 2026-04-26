# Carely AI Assistant

A beautiful healthcare AI assistant for analyzing patient calls and generating care questions.

## Setup (3 steps)

### Step 1: Add your OpenAI API Key
Open `src/App.jsx` and on **line 4**, replace:
```javascript
const OPENAI_API_KEY = 'your-openai-api-key-here';
```
with your actual API key from https://platform.openai.com/api-keys

### Step 2: Install dependencies
```bash
npm install
```

### Step 3: Run the app
```bash
npm run dev
```

Then open http://localhost:5173 in your browser!

---

## Features

📞 **Call Analysis**
- Upload patient call logs (.txt files)
- AI analyzes and summarizes the call
- Chat interface to ask follow-up questions

📋 **Care Questions**
- Upload discharge summaries (.txt files)
- AI generates personalized questions for nurses
- Organized by category (medications, symptoms, lifestyle, etc.)

---

## Sample Test Files

Create `sample_call.txt`:
```
Nurse: Good morning, this is Sarah from Carely. How are you feeling today?

Patient: I'm okay, but having trouble breathing when I climb stairs.

Nurse: On a scale of 1-10, how would you rate the shortness of breath?

Patient: About a 6 or 7 when active.

Nurse: Have you been taking your medications?

Patient: I take the morning one but sometimes forget the evening dose.

Nurse: Have you noticed any swelling in your legs?

Patient: Yes, my ankles are puffy in the evenings.
```

Create `sample_discharge.txt`:
```
DISCHARGE SUMMARY

Patient: John Smith
Date: January 2026

Diagnosis:
- Congestive Heart Failure Stage II
- Hypertension
- Type 2 Diabetes

Medications:
- Lisinopril 10mg daily
- Metoprolol 25mg twice daily
- Furosemide 40mg daily
- Metformin 500mg twice daily

Instructions:
- Daily weight monitoring
- Low sodium diet (<2000mg/day)
- Monitor for increased swelling
```

---

## Troubleshooting

**"API Key Required" error** → Add your key on line 4 of src/App.jsx

**npm install fails** → Make sure you have Node.js installed (v16+)

**Page is blank** → Check browser console for errors (F12)
