import { generateText } from "ai";
// import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";

import { db } from "@/firebase/admin";
import { getRandomInterviewCover } from "@/lib/utils";
import { google } from "@ai-sdk/google";

type GenerateArgs = {
  type?: unknown;
  role?: unknown;
  techstack?: unknown;
  level?: unknown;
  amount?: unknown;
  userid?: unknown;
};

type VapiToolCall = {
  id?: string;
  name?: string;
  arguments?: unknown;
  parameters?: unknown;
  function?: {
    name?: string;
    arguments?: unknown;
    parameters?: unknown;
  };
};

function parseArguments(rawArgs: unknown): Record<string, unknown> {
  if (!rawArgs) return {};

  if (typeof rawArgs === "string") {
    try {
      return JSON.parse(rawArgs);
    } catch {
      return {};
    }
  }

  if (typeof rawArgs === "object") {
    return rawArgs as Record<string, unknown>;
  }

  return {};
}

function findToolCall(body: any): VapiToolCall | undefined {
  const toolCalls =
    body?.message?.toolCallList ??
    body?.message?.toolCalls ??
    body?.messages?.toolCallList ??
    body?.messages?.toolCalls ??
    body?.toolCallList ??
    body?.toolCalls;

  if (Array.isArray(toolCalls)) {
    return (
      toolCalls.find(
        (call: VapiToolCall) =>
          call.name === "generate" || call.function?.name === "generate"
      ) ?? toolCalls[0]
    );
  }

  return undefined;
}

function getVariableValues(body: any): Record<string, unknown> {
  return (
    body?.message?.call?.assistantOverrides?.variableValues ??
    body?.message?.assistantOverrides?.variableValues ??
    body?.call?.assistantOverrides?.variableValues ??
    body?.assistantOverrides?.variableValues ??
    {}
  );
}

function parseQuestions(text: string): string[] {
  let parsed: unknown;

  try {
    parsed = JSON.parse(text.trim());
  } catch {
    const jsonMatch = text.match(/\[[\s\S]*\]/);

    if (!jsonMatch) {
      throw new Error("The model did not return a JSON array.");
    }

    parsed = JSON.parse(jsonMatch[0]);
  }

  if (
    !Array.isArray(parsed) ||
    parsed.some((item) => typeof item !== "string")
  ) {
    throw new Error("The generated questions were not a string array.");
  }

  return parsed;
}

function vapiToolResponse(toolCallId: string, result: string, status = 200) {
  return Response.json(
    {
      results: [
        {
          toolCallId,
          result,
        },
      ],
    },
    { status }
  );
}

function getErrorDetails(error: unknown) {
  const errorRecord =
    error && typeof error === "object"
      ? (error as Record<string, unknown>)
      : undefined;
  const cause =
    errorRecord?.cause && typeof errorRecord.cause === "object"
      ? (errorRecord.cause as Record<string, unknown>)
      : undefined;

  const statusCode =
    typeof errorRecord?.statusCode === "number"
      ? errorRecord.statusCode
      : typeof cause?.statusCode === "number"
        ? cause.statusCode
        : undefined;

  const message =
    error instanceof Error ? error.message : "Failed to generate interview.";

  if (!process.env.OPENAI_API_KEY) {
    return "OpenAI API key is missing on the server.";
  }

  if (statusCode === 401 || statusCode === 403) {
    return "OpenAI rejected the API key or model access.";
  }

  if (statusCode === 429) {
    return "OpenAI quota or rate limit was exceeded.";
  }

  if (statusCode && statusCode >= 500) {
    return "OpenAI is temporarily unavailable.";
  }

  if (message.includes("maxRetriesExceeded")) {
    return "OpenAI request failed after retries. Check API key, quota, and model access.";
  }

  return message;
}

export async function POST(request: Request) {
  const body = await request.json();
  const toolCall = findToolCall(body);
  const toolCallId = toolCall?.id;

  const rawArgs =
    toolCall?.function?.arguments ??
    toolCall?.function?.parameters ??
    toolCall?.arguments ??
    toolCall?.parameters ??
    body;

  const args = parseArguments(rawArgs) as GenerateArgs;
  const variableValues = getVariableValues(body);

  const type = String(args.type ?? "").trim();
  const role = String(args.role ?? "").trim();
  const techstack = String(args.techstack ?? "").trim();
  const level = String(args.level ?? "").trim();
  const amount = Number(args.amount ?? 5);
  const useridFromArgs = String(args.userid ?? "").trim();
  const useridFromVariables = String(variableValues.userid ?? "").trim();
  const userid = useridFromArgs || useridFromVariables;

  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OpenAI API key is missing on the server.");
    }

    if (!type || !role || !techstack || !level || !userid || !amount) {
      throw new Error(
        "Missing required fields: role, type, level, techstack, amount, or userid."
      );
    }

    const safeQuestions = amount > 0 && amount <= 20 ? amount : 5;

    const { text } = await generateText({
      model: openai("gpt-4o-mini"),
      prompt: `
Generate ${safeQuestions} interview questions.

Role:
${role}

Experience Level:
${level}

Interview Type:
${type}

Tech Stack:
${techstack}

Rules:
- Return ONLY a valid JSON array
- Do not include markdown
- Do not include explanations
- Do not include numbering
- Do not include code blocks
- Keep questions concise and natural
- Questions will be read by a voice assistant
- Avoid special characters like "*" or "/"
- Return the questions formatted like this: ["Question 1", "Question 2", "Question 3"]
      `,
    });

    const questions = parseQuestions(text);
    const dbInstance = await db;

    const interview = {
      role,
      type,
      level,
      techstack: techstack
        .split(",")
        .map((tech) => tech.trim())
        .filter(Boolean),
      questions,
      userId: userid,
      finalized: true,
      coverImage: getRandomInterviewCover(),
      createdAt: new Date().toISOString(),
    };

    const interviewRef = await dbInstance
      .collection("interviews")
      .add(interview);
    const result = `Interview generated and saved successfully. Interview ID: ${interviewRef.id}`;

    if (toolCallId) {
      return vapiToolResponse(toolCallId, result);
    }

    return Response.json(
      { success: true, interviewId: interviewRef.id, interview },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error generating interview:", error);
    const message = getErrorDetails(error);

    if (toolCallId) {
      return vapiToolResponse(
        toolCallId,
        `Interview generation failed: ${message}`
      );
    }

    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

export async function GET() {
  return Response.json({
    success: true,
    data: "Vapi generate endpoint is ready.",
  });
}
