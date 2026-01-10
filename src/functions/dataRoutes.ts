import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { wordsTable } from "../db/wordsTable";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://brave-pebble-004d8cf0f.1.azurestaticapps.net",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function GetDataForLang(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log(`Http function processed request for url "${request.url}"`);

  try {
    // Extract parameters from request
    const language = request.params.language;
    const pageParam = request.query.get("page");
    const limitParam = request.query.get("limit");

    const page = pageParam ? parseInt(pageParam, 10) : 1;
    const limit = limitParam ? parseInt(limitParam, 10) : 10;

    // Use the wordsTable to get data
    const result = await wordsTable.getDataForLanguage(language, {
      page,
      limit,
      sortForJapanese: language === "japanese"
    });

    // Handle error responses
    if ('error' in result) {
      const status = result.error === "Invalid language" ? 404 : 
                    result.error === "Page and limit must be positive numbers" ? 400 : 500;
      
      return {
        status,
        body: JSON.stringify({ error: result.error }),
        headers: { "Content-Type": "application/json", ...corsHeaders },
      };
    }

    // Return successful response
    return {
      status: 200,
      body: JSON.stringify(result.data),
      headers: { "Content-Type": "application/json", ...corsHeaders },
    };
  } catch (error) {
    context.log("Error processing request:", error);
    return {
      status: 500,
      body: JSON.stringify({ error: "Internal server error" }),
      headers: { "Content-Type": "application/json", ...corsHeaders },
    };
  }
}

export async function ReturnSizeOfData(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log(`Http function processed request for url "${request.url}"`);

  try {
    // Extract language from route parameters
    const language = request.params.language;

    // Use the wordsTable to get count
    const result = await wordsTable.getCountForLanguage(language);

    // Handle error response
    if (typeof result === 'object' && 'error' in result) {
      const status = result.error === "Invalid language" ? 404 : 500;
      
      return {
        status,
        body: JSON.stringify({ error: result.error }),
        headers: { "Content-Type": "application/json", ...corsHeaders },
      };
    }

    // Return successful response
    return {
      status: 200,
      body: JSON.stringify(result),
      headers: { "Content-Type": "application/json", ...corsHeaders },
    };
  } catch (error) {
    context.log("Error processing request:", error);
    return {
      status: 500,
      body: JSON.stringify({ error: "Internal server error" }),
      headers: { "Content-Type": "application/json", ...corsHeaders },
    };
  }
}
 
app.http("GetDataForLang", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "data/fetch/{language}",
  handler: GetDataForLang,
});

// Route Function: ReturnSizeOfData
// Route Description: Returns the total number of entries available for the specified language.
// parameters: language (japanese or spanish)
app.http("ReturnSizeOfData", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "data/fetchSize/{language}",
  handler: ReturnSizeOfData,
});
