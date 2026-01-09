
import { GoogleGenAI } from "@google/genai";

export const generateAIContent = async (prompt: string, systemInstruction?: string): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        systemInstruction: systemInstruction || "You are a helpful assistant specialized in prompt engineering and creative writing. Provide clear, high-quality responses.",
        temperature: 0.7,
      },
    });

    return response.text || "AI failed to generate content.";
  } catch (error) {
    console.error("Gemini AI Error:", error);
    throw new Error("AI generation failed. Please check your connection or API key.");
  }
};
