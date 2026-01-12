import { GoogleGenAI } from "@google/genai";

export const generateEventDescription = async (title: string, location: string, date: string): Promise<string> => {
  // Graceful fallback if no API key is present in environment
  if (!process.env.API_KEY) {
    console.warn("No API_KEY found in environment variables.");
    return "歡迎參加這個精彩的校友活動！";
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const prompt = `
      請為一個校友活動撰寫一段吸引人、專業且熱情的繁體中文活動說明。
      活動名稱: ${title}
      地點: ${location}
      日期: ${date}
      
      請保持在 60 字以內。語氣要溫暖並鼓勵大家報名參加。
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    return response.text || "無法生成說明。";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "生成說明時發生錯誤，請手動輸入。";
  }
};