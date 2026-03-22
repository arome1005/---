import { GoogleGenAI } from "@google/genai";

class AIService {
  constructor() {
    this.primaryKey = import.meta.env.VITE_GEMINI_API_KEY || '';
    this.secondaryKey = import.meta.env.VITE_SECONDARY_GEMINI_API_KEY || 'AIzaSyAActcyeU1JTQafgO8QonbJpVkuUMNRxiM';
    this.currentKey = this.primaryKey || this.secondaryKey;
    this.isUsingSecondary = !this.primaryKey && !!this.secondaryKey;
  }

  async generateContent(prompt) {
    try {
      return await this._callGemini(this.currentKey, prompt);
    } catch (error) {
      console.error("Primary API call failed:", error);
      
      // If primary fails and we have a secondary key, try it
      if (!this.isUsingSecondary && this.secondaryKey) {
        console.log("Switching to secondary API key...");
        this.currentKey = this.secondaryKey;
        this.isUsingSecondary = true;
        try {
          return await this._callGemini(this.currentKey, prompt);
        } catch (secError) {
          console.error("Secondary API call also failed:", secError);
          throw secError;
        }
      }
      throw error;
    }
  }

  async _callGemini(apiKey, prompt) {
    if (!apiKey) {
      throw new Error("Missing Gemini API Key. Please configure it in the AI Studio Secrets panel.");
    }
    
    const genAI = new GoogleGenAI({ apiKey });
    const response = await genAI.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    
    return response.text;
  }
}

export const aiService = new AIService();
