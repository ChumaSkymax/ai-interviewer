"use client";

import type { AssistantOverrides, CreateAssistantDTO } from "@vapi-ai/web/dist/api";
import { useState, useEffect } from "react";
import { vapi } from "@/lib/vapi.sdk";

export type CallStatus = "INACTIVE" | "CONNECTING" | "ACTIVE" | "FINISHED";

interface SavedMessage {
  role: "user" | "system" | "assistant";
  content: string;
}

export const useVapi = () => {
  const [callStatus, setCallStatus] = useState<CallStatus>("INACTIVE");
  const [messages, setMessages] = useState<SavedMessage[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    const onCallStart = () => setCallStatus("ACTIVE");

    const onCallEnd = () => setCallStatus("FINISHED");

    const onMessage = (message: any) => {
      if (message.type === "transcript" && message.transcriptType === "final") {
        setMessages((prev) => [
          ...prev,
          {
            role: message.role,
            content: message.transcript,
          },
        ]);
      }
    };

    const onSpeechStart = () => setIsSpeaking(true);
    const onSpeechEnd = () => setIsSpeaking(false);

    const onError = (error: unknown) => {
      console.log("Vapi Error:", error);

      try {
        console.log("Vapi Error Details:", JSON.stringify(error, null, 2));
      } catch {
        console.log("Could not stringify Vapi error");
      }

      setCallStatus("FINISHED");
    };

    vapi.on("call-start", onCallStart);
    vapi.on("call-end", onCallEnd);
    vapi.on("message", onMessage);
    vapi.on("speech-start", onSpeechStart);
    vapi.on("speech-end", onSpeechEnd);
    vapi.on("error", onError);

    return () => {
      vapi.off("call-start", onCallStart);
      vapi.off("call-end", onCallEnd);
      vapi.off("message", onMessage);
      vapi.off("speech-start", onSpeechStart);
      vapi.off("speech-end", onSpeechEnd);
      vapi.off("error", onError);
    };
  }, []);

  const startCall = async (
    assistant: string | CreateAssistantDTO,
    assistantOverrides?: AssistantOverrides
  ) => {
    setCallStatus("CONNECTING");
    await vapi.start(assistant, assistantOverrides);
  };

  const stopCall = () => {
    setCallStatus("FINISHED");
    vapi.stop();
  };

  return {
    callStatus,
    messages,
    isSpeaking,
    startCall,
    stopCall,
  };
};
