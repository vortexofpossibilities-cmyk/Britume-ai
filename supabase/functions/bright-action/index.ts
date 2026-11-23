import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
};

function reply(data: unknown, status = 200) {
  return new Response(
    data === null ? null : JSON.stringify(data),
    {
      status,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    },
  );
}

function error(message: string, status = 400) {
  return reply({ error: message }, status);
}

async function askProvider(
  baseUrl: string,
  apiKey: string,
  model: string,
  messages: { role: string; content: string }[],
) {
  const response = await fetch(
    `${baseUrl.replace(/\/+$/, "")}/chat/completions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: 1200,
        temperature: 0.7,
      }),
      signal: AbortSignal.timeout(45000),
    },
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      `Provider error ${response.status}: ${
        data?.error?.message || "Unknown provider error"
      }`,
    );
  }

  const answer = data?.choices?.[0]?.message?.content;

  if (typeof answer !== "string" || !answer.trim()) {
    throw new Error("The AI provider returned an empty response.");
  }

  return answer.trim();
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !anonKey) {
      return error("Supabase configuration is missing.", 500);
    }

    const authorization = req.headers.get("Authorization") || "";
    const token = authorization.startsWith("Bearer ")
      ? authorization.slice(7).trim()
      : "";

    if (!token) {
      return error("Please sign in to use BRITUME.", 401);
    }

    const authClient = createClient(supabaseUrl, anonKey);
    const { data: authData, error: authError } =
      await authClient.auth.getUser(token);

    if (authError || !authData.user) {
      return error(
        "Your session is invalid or expired. Please sign in again.",
        401,
      );
    }

    const user = authData.user;

    const db = createClient(supabaseUrl, anonKey, {
      global: {
        headers: { Authorization: `Bearer ${token}` },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

    const url = new URL(req.url);
    const path = url.pathname.replace(/\/+$/, "");

    // Health check
    if (path.endsWith("/health") && req.method === "GET") {
      return reply({
        status: "ok",
        service: "BRITUME",
        version: "2.1",
      });
    }

    // Load conversation history
    if (path.endsWith("/conversations") && req.method === "GET") {
      const { data, error: dbError } = await db
        .from("conversations")
        .select("id,title,created_at,updated_at")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(100);

      if (dbError) {
        console.error("History error:", dbError.message);
        return error("Could not load your conversation history.", 500);
      }

      return reply({ conversations: data || [] });
    }

    // Create a conversation
    if (path.endsWith("/conversations") && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const title = typeof body.title === "string"
        ? body.title.trim().slice(0, 80)
        : "New conversation";

      const { data, error: dbError } = await db
        .from("conversations")
        .insert({
          user_id: user.id,
          title: title || "New conversation",
        })
        .select("id,title,created_at,updated_at")
        .single();

      if (dbError || !data) {
        console.error("Create conversation error:", dbError?.message);
        return error("Could not create a conversation.", 500);
      }

      return reply({ conversation: data }, 201);
    }

    // Load messages from a conversation
    const messagesMatch = path.match(
      /\/conversations\/([0-9a-f-]{36})\/messages$/i,
    );

    if (messagesMatch && req.method === "GET") {
      const conversationId = messagesMatch[1];

      const { data, error: dbError } = await db
        .from("messages")
        .select("id,role,content,created_at")
        .eq("conversation_id", conversationId)
        .eq("user_id", user.id)
        .order("created_at", { ascending: true })
        .limit(500);

      if (dbError) {
        console.error("Load messages error:", dbError.message);
        return error("Could not load this conversation.", 500);
      }

      return reply({
        messages: (data || []).map((message) => ({
          ...message,
          text: message.content,
        })),
      });
    }

    // Delete a conversation
    const conversationMatch = path.match(
      /\/conversations\/([0-9a-f-]{36})$/i,
    );

    if (conversationMatch && req.method === "DELETE") {
      const conversationId = conversationMatch[1];

      const { error: dbError } = await db
        .from("conversations")
        .delete()
        .eq("id", conversationId)
        .eq("user_id", user.id);

      if (dbError) {
        console.error("Delete conversation error:", dbError.message);
        return error("Could not delete this conversation.", 500);
      }

      return reply(null, 204);
    }

    // AI chat
    if (path.endsWith("/chat") && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const incoming = body.messages;
      const conversationId = body.conversationId;

      if (
        !Array.isArray(incoming) ||
        incoming.length < 1 ||
        incoming.length > 30
      ) {
        return error("Send between 1 and 30 messages.");
      }

      if (
        typeof conversationId !== "string" ||
        !/^[0-9a-f-]{36}$/i.test(conversationId)
      ) {
        return error("A valid conversationId is required.");
      }

      const messages: { role: string; content: string }[] = [];

      for (const item of incoming) {
        if (
          !item ||
          !["user", "assistant"].includes(item.role) ||
          typeof item.content !== "string"
        ) {
          return error("A message has an invalid format.");
        }

        const content = item.content.trim();

        if (!content || content.length > 12000) {
          return error("Messages must contain 1–12,000 characters.");
        }

        messages.push({
          role: item.role,
          content,
        });
      }

      const latest = messages[messages.length - 1];

      if (latest.role !== "user") {
        return error("The latest message must be from you.");
      }

      // Verify conversation ownership
      const { data: conversation, error: ownershipError } = await db
        .from("conversations")
        .select("id,title")
        .eq("id", conversationId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (ownershipError || !conversation) {
        return error("Conversation not found.", 404);
      }

      const systemPrompt = [
        "You are BRITUME, a highly capable and helpful AI assistant.",
        "Your name represents Brilliance of Possibilities.",
        "Give thoughtful, useful, accurate and detailed answers.",
        "Adapt your answer length to the user's question.",
        "Explain difficult subjects clearly.",
        "Be strong at writing, reasoning, mathematics and coding.",
        "Never invent facts or claim to have performed actions you have not performed.",
        "Be honest when uncertain.",
      ].join(" ");

      const aiMessages = [
        { role: "system", content: systemPrompt },
        ...messages,
      ];

      let answer = "";
      let provider = "";
      let usedModel = "";

      // PRIMARY PROVIDER: OPENAI
      const openAIKey = Deno.env.get("OPENAI_API_KEY");
      const openAIModel = Deno.env.get("OPENAI_MODEL") || "gpt-4o-mini";

      if (openAIKey) {
        try {
          answer = await askProvider(
            "https://api.openai.com/v1",
            openAIKey,
            openAIModel,
            aiMessages,
          );

          provider = "OpenAI";
          usedModel = openAIModel;
        } catch (err) {
          console.error("OpenAI failed; trying Groq:", err);
        }
      }

      // BACKUP PROVIDER: GROQ
      if (!answer) {
        const groqKey = Deno.env.get("GROQ_API_KEY") ||
          Deno.env.get("AI_API_KEY");

        const groqModel = Deno.env.get("GROQ_MODEL") ||
          Deno.env.get("AI_MODEL") ||
          "openai/gpt-oss-120b";

        if (groqKey) {
          try {
            answer = await askProvider(
              "https://api.groq.com/openai/v1",
              groqKey,
              groqModel,
              aiMessages,
            );

            provider = "Groq";
            usedModel = groqModel;
          } catch (err) {
            console.error("Groq failed:", err);
          }
        }
      }

      if (!answer) {
        return error(
          "BRITUME's AI providers are unavailable right now. Please try again shortly.",
          503,
        );
      }

      // Save the user message
      const { error: saveUserError } = await db
        .from("messages")
        .insert({
          conversation_id: conversationId,
          user_id: user.id,
          role: "user",
          content: latest.content,
        });

      if (saveUserError) {
        console.error("Save user message error:", saveUserError.message);
        return error("Could not save your message.", 500);
      }

      // Set the conversation title from its first message
      if (conversation.title === "New conversation") {
        await db
          .from("conversations")
          .update({ title: latest.content.slice(0, 60) })
          .eq("id", conversationId)
          .eq("user_id", user.id);
      }

      // Save the AI response
      const { error: saveAssistantError } = await db
        .from("messages")
        .insert({
          conversation_id: conversationId,
          user_id: user.id,
          role: "assistant",
          content: answer,
        });

      if (saveAssistantError) {
        console.error(
          "Save assistant message error:",
          saveAssistantError.message,
        );
        return error(
          "BRITUME replied but could not save its response.",
          500,
        );
      }

      return reply({
        reply: answer,
        provider,
        model: usedModel,
      });
    }

    return error("BRITUME endpoint not found.", 404);
  } catch (err) {
    console.error("BRITUME function error:", err);
    return error(
      "BRITUME is temporarily unable to complete this request.",
      500,
    );
  }
});
