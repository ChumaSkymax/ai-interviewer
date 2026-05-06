"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, PhoneCall, PhoneOff, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";
import { createFeedback } from "@/lib/actions/general.action";
import { useVapi } from "@/hooks/useVapi";

const Agent = ({
  userName,
  userId,
  interviewId,
  feedbackId,
  type,
  questions,
}: AgentProps) => {
  const router = useRouter();
  const { callStatus, messages, isSpeaking, startCall, stopCall } = useVapi();
  const [lastMessage, setLastMessage] = useState("");

  useEffect(() => {
    if (messages.length > 0) {
      setLastMessage(messages[messages.length - 1].content);
    }
  }, [messages]);

  useEffect(() => {
    if (callStatus !== "FINISHED") return;

    if (type === "generate") {
      router.push("/");
      return;
    }

    const handleFeedback = async () => {
      const { success, feedbackId: id } = await createFeedback({
        interviewId: interviewId!,
        userId: userId!,
        transcript: messages,
        feedbackId,
      });

      if (success && id) {
        router.push(`/interview/${interviewId}/feedback`);
      } else {
        console.log("Error saving feedback");
        router.push("/");
      }
    };

    handleFeedback();
  }, [messages, callStatus, feedbackId, interviewId, router, type, userId]);

  const handleCall = async () => {
    if (type === "generate") {
      const assistantId = process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID;

      if (!assistantId) {
        console.error("Missing NEXT_PUBLIC_VAPI_ASSISTANT_ID");
        return;
      }

      await startCall(assistantId, {
        variableValues: {
          username: userName,
          userid: userId,
        },
      });

      return;
    }

    const assistantId = process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID;

    if (!assistantId) {
      console.error("Missing NEXT_PUBLIC_VAPI_ASSISTANT_ID");
      return;
    }

    const formattedQuestions = questions
      ?.map((question) => `- ${question}`)
      .join("\n");

    await startCall(assistantId, {
      variableValues: {
        questions: formattedQuestions,
      },
    });
  };

  const handleDisconnect = () => {
    stopCall();
  };

  return (
    <>
      <div className="call-view">
        {/* AI Interviewer Card */}
        <div className="card-interviewer">
          <div className="avatar">
            <Image
              src="/ai-avatar.png"
              alt="profile-image"
              width={65}
              height={54}
              className="object-cover"
            />
            {isSpeaking && <span className="animate-speak" />}
          </div>
          <h3>AI Interviewer</h3>
        </div>

        {/* User Profile Card */}
        <div className="card-border">
          <div className="card-content">
            <Image
              src="/user-avatar.png"
              alt="profile-image"
              width={539}
              height={539}
              className="rounded-full object-cover size-[120px]"
            />
            <h3>{userName}</h3>
          </div>
        </div>
      </div>

      {messages.length > 0 && (
        <div className="transcript-border">
          <div className="transcript">
            <p
              key={lastMessage}
              className={cn(
                "transition-opacity duration-500 opacity-0",
                "animate-fadeIn opacity-100"
              )}
            >
              {lastMessage}
            </p>
          </div>
        </div>
      )}

      <div className="w-full flex justify-center">
        {callStatus !== "ACTIVE" ? (
          <button
            className="group relative btn-call gap-2.5 bg-gradient-to-r from-success-100 via-primary-200 to-success-100 text-dark-100 shadow-[0_0_28px_rgba(202,197,254,0.34)] hover:shadow-[0_0_34px_rgba(73,222,80,0.34)] disabled:cursor-not-allowed disabled:opacity-80"
            onClick={() => handleCall()}
            disabled={callStatus === "CONNECTING"}
          >
            <span
              className={cn(
                "absolute inset-0 animate-ping rounded-full bg-primary-200/40",
                callStatus !== "CONNECTING" && "hidden"
              )}
            />

            <span className="relative flex items-center gap-2">
              {callStatus === "CONNECTING" ? (
                <LoaderCircle
                  className="size-4 animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <Sparkles
                  className="size-4 transition-transform group-hover:scale-110"
                  aria-hidden="true"
                />
              )}
              {callStatus === "INACTIVE" || callStatus === "FINISHED"
                ? "Start a Call"
                : "Connecting"}
              {callStatus !== "CONNECTING" && (
                <PhoneCall className="size-4" aria-hidden="true" />
              )}
            </span>
          </button>
        ) : (
          <button
            className="btn-disconnect gap-2.5 shadow-[0_0_26px_rgba(247,83,83,0.26)]"
            onClick={() => handleDisconnect()}
          >
            <span>End</span>
            <PhoneOff className="size-4" aria-hidden="true" />
          </button>
        )}
      </div>
    </>
  );
};

export default Agent;
