const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;

// memory cache to store downloaded audio
// Key = "text-voice", Value = "blobUrl"
const audioCache = new Map();

export const playAiAudio = async (text, voice = 'alloy') => {
  if (!OPENAI_API_KEY) {
    throw new Error("Missing OpenAI API Key");
  }

  // generate a unique key for this specific request
  const cacheKey = `${voice}-${text.trim()}`;

  // check cache: If we have it, play immediately
  if (audioCache.has(cacheKey)) {
    console.log("Playing from cache (Instant)");
    const audioUrl = audioCache.get(cacheKey);
    const audio = new Audio(audioUrl);
    await audio.play();
    return audio;
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
        voice: voice, 
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("OpenAI Audio Error:", errorData);
      throw new Error("Failed to generate audio");
    }

    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);
    // save to cache for next time
    audioCache.set(cacheKey, audioUrl);
    const audio = new Audio(audioUrl);
    await audio.play();
    return audio;

  } catch (error) {
    console.error("Audio Service Error:", error);
    throw error;
  }
};