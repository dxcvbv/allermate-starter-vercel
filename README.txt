AllerMate Starter (Vercel + Mapbox + Chatbot)

Deploy
1) Go to https://vercel.com → New Project → "Import..." → drag-drop this folder.
2) Project → Settings → Environment Variables:
   MAPBOX_TOKEN = your Mapbox token
   OPENAI_API_KEY = your OpenAI API key
   (Apply to Development + Preview + Production)
3) Deploy. Open your *.vercel.app URL.
4) Open /search.html → Use my location → Search.

Test chatbot (basic)
- In your console you can POST to /api/chat with {messages:[{role:'user',content:'...'}], profile:{survey:{...},history:{...}}}
- You can wire a floating chat UI later, or call from your pages.
