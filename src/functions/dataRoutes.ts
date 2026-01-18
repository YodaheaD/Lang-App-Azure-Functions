import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { wordsTable } from "../db/wordsTable";
import corsHeaders from "../utils/corsHeader";

// -> GetDataForLang - returns paginated word data for a specified language with optional filters
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
    const classParam = request.query.get("class");
    const class2Param = request.query.get("class2");

    const page = pageParam ? parseInt(pageParam, 10) : 1;
    const limit = limitParam ? parseInt(limitParam, 10) : 10;

    // Parse filter parameters
    const filters: any = {};
    if (classParam) {
      // Support comma-separated values for multiple class filters
      filters.class = classParam
        .split(",")
        .map((c) => c.trim())
        .filter((c) => c.length > 0);
    }
    if (class2Param) {
      // Support comma-separated values for multiple class2 filters
      filters.class2 = class2Param
        .split(",")
        .map((c) => c.trim())
        .filter((c) => c.length > 0);
    }

    // Use the wordsTable to get data
    const result = await wordsTable.getDataForLanguage(language, {
      page,
      limit,
      sortForJapanese: language === "japanese",
      filters: Object.keys(filters).length > 0 ? filters : undefined,
    });

    // Handle error responses
    if ("error" in result) {
      const status =
        result.error === "Invalid language"
          ? 404
          : result.error === "Page and limit must be positive numbers"
          ? 400
          : 500;

      return {
        status,
        body: JSON.stringify({ error: result.error }),
        headers: { "Content-Type": "application/json", ...corsHeaders },
      };
    }

    // Return enterprise-standard response with pagination and filter metadata
    const response = {
      data: result.data,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalFiltered: result.totalFiltered,
        hasNext: result.page * result.limit < result.totalFiltered,
        hasPrevious: result.page > 1,
      },
      filters: {
        applied: result.appliedFilters || {},
        available: result.availableFilters || { class: [], class2: [] },
      },
      language: language,
    };

    return {
      status: 200,
      body: JSON.stringify(response),
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

export async function GetFiltersForLang(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log(`Http function processed request for url "${request.url}"`);

  try {
    // Extract parameters from request
    const language = request.params.language;

    // Use the wordsTable to get data
    const result = await wordsTable.getFiltersOnly(language);

    // Handle error responses
    if ("error" in result) {
      const status =
        result.error === "Invalid language"
          ? 404
          : result.error === "Page and limit must be positive numbers"
          ? 400
          : 500;

      return {
        status,
        body: JSON.stringify({ error: result.error }),
        headers: { "Content-Type": "application/json", ...corsHeaders },
      };
    }

    // Return enterprise-standard response with pagination and filter metadata
    const response = {
      filters: {
        available: result.availableFilters || { class: [], class2: [] },
      },
      language: language,
    };

    return {
      status: 200,
      body: JSON.stringify(response),
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

// -> ReturnSizeOfData - returns the total number of entries for a specified language
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
    if (typeof result === "object" && "error" in result) {
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
app.http("GetFiltersForLang", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "data/filters/{language}",
  handler: GetFiltersForLang,
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
