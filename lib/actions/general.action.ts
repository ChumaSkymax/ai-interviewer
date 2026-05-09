"use server";

import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";

import { db } from "@/firebase/admin";
import type { QueryDocumentSnapshot } from "firebase-admin/firestore";
import { feedbackSchema } from "@/constants";

export async function createFeedback(params: CreateFeedbackParams) {
  const { interviewId, userId, transcript, feedbackId } = params;
  const dbInstance = await db;

  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OpenAI API key is missing on the server.");
    }

    const formattedTranscript = transcript
      .map(
        (sentence: { role: string; content: string }) =>
          `- ${sentence.role}: ${sentence.content}\n`
      )
      .join("");

    const { object } = await generateObject({
      model: openai("gpt-4o-mini"),
      schema: feedbackSchema,
      prompt: `
        You are an AI interviewer analyzing a mock interview. Your task is to evaluate the candidate based on structured categories. Be thorough and detailed in your analysis. Don't be lenient with the candidate. If there are mistakes or areas for improvement, point them out.
        Transcript:
        ${formattedTranscript}

        Please score the candidate from 0 to 100 in the following areas. Do not add categories other than the ones provided:
        - **Communication Skills**: Clarity, articulation, structured responses.
        - **Technical Knowledge**: Understanding of key concepts for the role.
        - **Problem-Solving**: Ability to analyze problems and propose solutions.
        - **Cultural & Role Fit**: Alignment with company values and job role.
        - **Confidence & Clarity**: Confidence in responses, engagement, and clarity.
        `,
      system:
        "You are a professional interviewer analyzing a mock interview. Your task is to evaluate the candidate based on structured categories",
    });

    const feedback = {
      interviewId: interviewId,
      userId: userId,
      totalScore: object.totalScore,
      categoryScores: object.categoryScores,
      strengths: object.strengths,
      areasForImprovement: object.areasForImprovement,
      finalAssessment: object.finalAssessment,
      createdAt: new Date().toISOString(),
    };

    let feedbackRef;

    if (feedbackId) {
      feedbackRef = dbInstance.collection("feedback").doc(feedbackId);
    } else {
      feedbackRef = dbInstance.collection("feedback").doc();
    }

    await feedbackRef.set(feedback);

    return { success: true, feedbackId: feedbackRef.id };
  } catch (error) {
    console.error("Error saving feedback:", error);
    return { success: false };
  }
}

export async function getInterviewById(id: string): Promise<Interview | null> {
  const dbInstance = await db;
  const interview = await dbInstance.collection("interviews").doc(id).get();

  return interview.data() as Interview | null;
}

export async function getFeedbackByInterviewId(
  params: GetFeedbackByInterviewIdParams
): Promise<Feedback | null> {
  const { interviewId, userId } = params;

  const dbInstance = await db;

  const querySnapshot = await dbInstance
    .collection("feedback")
    .where("interviewId", "==", interviewId)
    .where("userId", "==", userId)
    .limit(1)
    .get();

  if (querySnapshot.empty) return null;

  const feedbackDoc = querySnapshot.docs[0];
  return { id: feedbackDoc.id, ...feedbackDoc.data() } as Feedback;
}

export async function getLatestInterviews(
  params: GetLatestInterviewsParams
): Promise<Interview[] | null> {
  const { userId, limit = 20 } = params;

  const dbInstance = await db;
  // Firestore requires a composite index for queries that mix `!=` inequalities
  // with `orderBy`. The error you saw is Firestore telling you an index is needed.
  // Two options:
  // 1) Create the composite index in Firebase Console (recommended for large datasets),
  // 2) Avoid the `!=` query and filter client/server-side after fetching by createdAt.
  // We'll take option 2 here to avoid requiring an index.

  const queryLimit = Math.max(limit * 3, limit + 10);
  const snapshot = await dbInstance
    .collection("interviews")
    .where("finalized", "==", true)
    .limit(queryLimit)
    .get();

  const all = snapshot.docs.map((doc: QueryDocumentSnapshot<Interview>) => {
    const data = doc.data() as Interview;
    const item: Interview = {
      ...(data as Omit<Interview, "id">),
      id: doc.id,
    };
    return item;
  });

  // Sort in code by `createdAt` (descending) to avoid requiring a composite
  // Firestore index for this query. `createdAt` is stored as an ISO string.
  all.sort(
    (a: Interview, b: Interview) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const filtered = userId
    ? all.filter((i: Interview) => i.userId !== userId)
    : all;

  return filtered.slice(0, limit) as Interview[];
}

export async function getInterviewsByUserId(
  userId: string
): Promise<Interview[] | null> {
  const dbInstance = await db;

  // Avoid requiring a composite index: fetch user's interviews and sort in code
  const snapshot = await dbInstance
    .collection("interviews")
    .where("userId", "==", userId)
    .get();

  const results = snapshot.docs.map((doc: QueryDocumentSnapshot<Interview>) => {
    const data = doc.data() as Interview;
    const item: Interview = {
      ...(data as Omit<Interview, "id">),
      id: doc.id,
    };
    return item;
  });

  // createdAt is stored as ISO string; sort descending by timestamp
  results.sort(
    (a: Interview, b: Interview) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return results as Interview[];
}
