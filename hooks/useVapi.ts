"use client";

import { useCallback, useEffect, useState } from "react";
import type { AssistantOverrides, CreateAssistantDTO } from "@vapi-ai/web/dist/api";

import { vapi } from "@/lib/vapi.sdk";

export type CallStatus = "INACTIVE" | "CONNECTING" | "ACTIVE" | "FINISHED";

export interface SavedMessage {
  role: "user" | "system" | "assistant";
  content: string;
}

type StartableAssistant = CreateAssistantDTO | string;

export const useVapi = () => {
  const [callStatus, setCallStatus] = useState<CallStatus>("INACTIVE");
  const [messages, setMessages] = useState<SavedMessage[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    const onCallStart = () => {
      setCallStatus("ACTIVE");
    };

    const onCallEnd = () => {
      setCallStatus("FINISHED");
      setIsSpeaking(false);
    };

    const onMessage = (message: Message) => {
      if (message.type === "transcript" && message.transcriptType === "final") {
        setMessages((prev) => [
          ...prev,
          {
            role: message.role as SavedMessage["role"],
            content: message.transcript,
          },
        ]);
      }
    };

    const onSpeechStart = () => {
      setIsSpeaking(true);
    };

    const onSpeechEnd = () => {
      setIsSpeaking(false);
    };

    const onError = (error: unknown) => {
      console.error("Vapi error:", error);
      setCallStatus("INACTIVE");
      setIsSpeaking(false);
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

  const startCall = useCallback(
    async (assistant: StartableAssistant, assistantOverrides?: AssistantOverrides) => {
      setMessages([]);
      setCallStatus("CONNECTING");

      const call = await vapi.start(assistant, assistantOverrides);

      if (!call) {
        setCallStatus("INACTIVE");
      }

      return call;
    },
    []
  );

  const stopCall = useCallback(() => {
    setCallStatus("FINISHED");
    setIsSpeaking(false);
    vapi.stop();
  }, []);

  return {
    callStatus,
    messages,
    isSpeaking,
    startCall,
    stopCall,
  };
};

export default useVapi;
