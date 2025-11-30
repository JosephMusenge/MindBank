// src/lib/audioService.js
const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;

export const playAiAudio = async (text, voice = 'alloy') => {
  if (!OPENAI_API_KEY) {
    throw new Error("Missing OpenAI API Key");
  }

  try {
    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "tts-1", // The standard, fast model
        input: text,
        voice: voice, // Options: alloy, echo, fable, onyx, nova, shimmer
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("OpenAI Audio Error:", errorData);
      throw new Error("Failed to generate audio");
    }

    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);
    
    await audio.play();
    return audio;

  } catch (error) {
    console.error("Audio Service Error:", error);
    throw error;
  }
};