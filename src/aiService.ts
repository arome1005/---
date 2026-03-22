import { GoogleGenAI } from "@google/genai";

const PRIMARY_KEY = process.env.GEMINI_API_KEY || "";
const SECONDARY_KEY = "AIzaSyAActcyeU1JTQafgO8QonbJpVkuUMNRxiM"; // User provided fallback

class AIService {
  private currentKey: string;
  private isUsingSecondary: boolean = false;

  constructor() {
    this.currentKey = PRIMARY_KEY || SECONDARY_KEY;
    this.isUsingSecondary = !PRIMARY_KEY;
  }

  async generateContent(prompt: string, systemInstruction?: string) {
    try {
      return await this._callGemini(this.currentKey, prompt, systemInstruction);
    } catch (error: any) {
      console.error("Primary Gemini API call failed:", error);
      
      // If primary fails (e.g. quota exhausted) and we haven't switched yet
      if (!this.isUsingSecondary && SECONDARY_KEY) {
        console.warn("Switching to secondary Gemini API key...");
        this.currentKey = SECONDARY_KEY;
        this.isUsingSecondary = true;
        try {
          return await this._callGemini(this.currentKey, prompt, systemInstruction);
        } catch (secError) {
          console.error("Secondary Gemini API call also failed:", secError);
          throw secError;
        }
      }
      throw error;
    }
  }

  private async _callGemini(apiKey: string, prompt: string, systemInstruction?: string) {
    if (!apiKey) {
      throw new Error("No Gemini API key configured.");
    }

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: systemInstruction ? { systemInstruction } : undefined,
    });

    return response.text;
  }

  // For pronunciation scoring
  async evaluatePronunciation(originalText: string, audioBase64: string) {
    const prompt = `
      Evaluate the pronunciation of the following text: "${originalText}".
      The user has provided an audio recording.
      Compare the audio to the original text and provide:
      1. An overall score (0-100).
      2. Feedback on specific words that were mispronounced.
      3. Suggestions for improvement.
      Return the result in JSON format with fields: score, feedback, suggestions.
    `;

    const ai = new GoogleGenAI({ apiKey: this.currentKey });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        { text: prompt },
        {
          inlineData: {
            mimeType: "audio/wav",
            data: audioBase64
          }
        }
      ],
      config: { responseMimeType: "application/json" }
    });

    return JSON.parse(response.text);
  }
}

export const aiService = new AIService();
