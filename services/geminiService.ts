import { GoogleGenAI, Type, Schema, Modality } from "@google/genai";
import { WorkoutLog, CoachPersona } from '../types';

// Lazily initialize the GoogleGenAI client so importing this module in the
// browser without an API key doesn't throw at module evaluation time.
let _ai: any | null = null;
function getAi() {
  if (_ai) return _ai;

  // Prefer Vite env var prefix for client-side usage, then fallback to Node env.
  const apiKey = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_KEY)
    || process.env.API_KEY;

  if (!apiKey) {
    // Provide a safe stub that rejects with a clear error when used.
    _ai = {
      models: {
        generateContent: async () => {
          throw new Error('No API key configured for GoogleGenAI. Set VITE_API_KEY in .env or provide a server-side proxy.');
        }
      }
    };
    return _ai;
  }

  _ai = new GoogleGenAI({ apiKey });
  return _ai;
}

// ---------------------------------------------------------
// 1. Front Desk Agent
// ---------------------------------------------------------
export const classifyIntent = async (text: string): Promise<'LOG' | 'ADVICE' | 'UNKNOWN'> => {
  try {
    const response = await getAi().models.generateContent({
      model: 'gemini-2.5-flash',
      contents: text,
      config: {
        systemInstruction: `
          You are the "Front Desk" agent for a fitness app. 
          Your ONLY job is to classify the user's input into one of two categories:
          1. "LOG": The user is describing a workout they just did (e.g., "I did 3 sets of bench press", "Ran 5 miles").
          2. "ADVICE": The user is asking for help, planning, or feedback (e.g., "What should I do today?", "Is my volume too high?", "Tell me a joke").
          
          Return ONLY the string "LOG" or "ADVICE". If it is completely unrelated, return "UNKNOWN".
        `,
        temperature: 0.1,
      }
    });
    
    const classification = response.text?.trim().toUpperCase();
    if (classification === 'LOG' || classification === 'ADVICE') {
      return classification;
    }
    return 'UNKNOWN';
  } catch (error) {
    console.error("Front Desk Error:", error);
    return 'UNKNOWN';
  }
};

// ---------------------------------------------------------
// 2. Workout Logger Agent
// ---------------------------------------------------------
const workoutLogSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    exercises: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          sets: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                set_number: { type: Type.INTEGER },
                reps: { type: Type.INTEGER },
                weight: { type: Type.STRING, nullable: true },
                reps_in_reserve: { type: Type.INTEGER, nullable: true },
                notes: { type: Type.STRING, nullable: true }
              },
              required: ["set_number", "reps"]
            }
          }
        },
        required: ["name", "sets"]
      }
    },
    workout_type: { type: Type.STRING, enum: ["strength", "cardio", "mixed", "other"] },
    duration: { type: Type.STRING, nullable: true },
    date: { type: Type.STRING, nullable: true },
    notes: { type: Type.STRING, nullable: true }
  },
  required: ["exercises", "workout_type"]
};

export const parseWorkoutLog = async (text: string, audioBase64?: string, mimeType?: string): Promise<WorkoutLog> => {
  try {
    const parts: any[] = [];
    
    if (audioBase64) {
      parts.push({
        inlineData: {
          mimeType: mimeType || "audio/webm", 
          data: audioBase64
        }
      });
      parts.push({ text: "Please extract the workout details from this audio recording." });
    } else {
      parts.push({ text });
    }

    const todayContext = new Date().toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });

    const response = await getAi().models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts },
      config: {
        systemInstruction: `
          You are the "Workout Logger" agent. 
          Current Date Context: ${todayContext}.
          
          Extract structured workout data from the user's input. 
          
          Date Rules:
          - If the user explicitly mentions a date (e.g. "Yesterday", "Last Friday", "October 5th"), calculate the date as YYYY-MM-DD based on the Current Date Context.
          - If no date is mentioned, return null for the date field (the system will use today).
          
          General Rules:
          - Standardize exercise names (e.g., "bench" -> "Bench Press").
          - Infer workout_type if not explicit.
          - **RIR/RPE Logic**: If the user says "to failure", "failure", "maxed out", or "0 RIR", set 'reps_in_reserve' to 0.
        `,
        responseMimeType: "application/json",
        responseSchema: workoutLogSchema,
        temperature: 0.1
      }
    });

    const jsonText = response.text;
    if (!jsonText) throw new Error("No data returned from logger");
    
    return JSON.parse(jsonText) as WorkoutLog;
  } catch (error) {
    console.error("Logger Agent Error:", error);
    throw error;
  }
};

// ---------------------------------------------------------
// 3. Workout Coach Agent
// ---------------------------------------------------------
export const getCoachingAdvice = async (userQuery: string, history: WorkoutLog[], persona: CoachPersona): Promise<string> => {
  try {
    const recentHistory = history.slice(0, 10).map(log => JSON.stringify(log)).join('\n---\n');
    
    const response = await getAi().models.generateContent({
      model: 'gemini-3-pro-preview', 
      contents: `User Query: ${userQuery}\n\nRecent Workout History:\n${recentHistory}`,
      config: {
        systemInstruction: `
          ${persona.systemPromptModifier}
          
          General Guidelines:
          - Identify trends in their volume or intensity if relevant.
          - If they ask for a workout, base it on what they haven't trained recently or their split.
          - Keep answers concise and actionable (under 3 sentences preferably, unless asked for details) to make it suitable for speech.
        `,
        temperature: 0.7
      }
    });

    return response.text || "I couldn't generate advice at this moment.";
  } catch (error) {
    console.error("Coach Agent Error:", error);
    return "Sorry, I'm having trouble accessing your coaching data right now.";
  }
};

// ---------------------------------------------------------
// 4. Text to Speech
// ---------------------------------------------------------
export const generateSpeech = async (text: string, voiceName: string): Promise<string | null> => {
    try {
        const response = await getAi().models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: { parts: [{ text }] },
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName }
                    }
                }
            }
        });

        // Extract base64 audio
        const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        return audioData || null;

    } catch (e) {
        console.error("TTS generation error:", e);
        return null;
    }
}

// ---------------------------------------------------------
// Helper: Transcribe Only
// ---------------------------------------------------------
export const transcribeAudio = async (audioBase64: string, mimeType?: string): Promise<string> => {
    try {
        const response = await getAi().models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
                parts: [
                    {
                        inlineData: {
                            mimeType: mimeType || "audio/webm",
                            data: audioBase64
                        }
                    },
                    { text: "Transcribe exactly what is said in this audio." }
                ]
            }
        });
        return response.text || "";
    } catch (e) {
        console.error("Transcription error", e);
        return "";
    }
}