import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { TableClient } from "@azure/data-tables";

const corsHeaders = {
  "Access-Control-Allow-Origin": "http://localhost:3000",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function GetDataForLang(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log(`Http function processed request for url "${request.url}"`);

  try {
    // Extract language from route parameters
    const language = request.params.language;

    // Get pagination parameters from query string
    const pageParam = request.query.get("page");
    const limitParam = request.query.get("limit");

    const page = pageParam ? parseInt(pageParam, 10) : 1;
    const limit = limitParam ? parseInt(limitParam, 10) : 10;

    // Validate pagination parameters
    if (page < 1 || limit < 1) {
      return {
        status: 400,
        body: JSON.stringify({
          error: "Page and limit must be positive numbers",
        }),
        headers: { "Content-Type": "application/json" },
      };
    }

    // Validate input and map to partition key
    let partitionKey: string;
    if (language === "japanese") {
      partitionKey = "ja";
    } else if (language === "spanish") {
      partitionKey = "es";
    } else {
      return {
        status: 404,
        body: JSON.stringify({ error: "invalid language" }),
        headers: { "Content-Type": "application/json" },
      };
    }

    // Get connection string from environment variables
    const connectionString = process.env.AzureWebJobsStorage;
    if (!connectionString) {
      context.log("Azure Storage connection string not found");
      return {
        status: 500,
        body: JSON.stringify({ error: "Storage configuration error" }),
        headers: { "Content-Type": "application/json", ...corsHeaders },
      };
    }

    // Create table client and query data
    const tableClient = TableClient.fromConnectionString(
      connectionString,
      "words"
    );

    // Query entities with the specified partition key
    const entities = [];
    const listResults = tableClient.listEntities({
      queryOptions: { filter: `PartitionKey eq '${partitionKey}'` },
    });
    const wantedFields = ["Word", "Definition", "Class"];
    for await (const entity of listResults) {
      entities.push(entity);
    }

    // sort by type for japanese
    if (language === "japanese") {
      // Group entities by type
      const typeGroups = new Map<string, any[]>();
      
      for (const entity of entities) {
        const type = entity.type || 'unknown';
        if (!typeGroups.has(type)) {
          typeGroups.set(type, []);
        }
        typeGroups.get(type)!.push(entity);
      }
      
      // Sort each group by word and combine back
      entities.length = 0; // Clear the original array
      
      // Sort the type groups by type name first
      const sortedTypes = Array.from(typeGroups.keys()).sort();
      
      for (const type of sortedTypes) {
        const group = typeGroups.get(type)!;
        // Sort each group by word field
        group.sort((a, b) => {
          const wordA = (a.Word || a.word || '').toString().toLowerCase();
          const wordB = (b.Word || b.word || '').toString().toLowerCase();
          return wordA.localeCompare(wordB);
        });
        // Add the sorted group back to entities
        entities.push(...group);
      }
    }
    // Apply pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedData = entities.slice(startIndex, endIndex);

    return {
      status: 200,
      body: JSON.stringify(paginatedData),
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

    // Validate input and map to partition key
    let partitionKey: string;
    if (language === "japanese") {
      partitionKey = "ja";
    } else if (language === "spanish") {
      partitionKey = "es";
    } else {
      return {
        status: 404,
        body: JSON.stringify({ error: "invalid language" }),
        headers: { "Content-Type": "application/json", ...corsHeaders },
      };
    }

    // Get connection string from environment variables
    const connectionString = process.env.AzureWebJobsStorage;
    if (!connectionString) {
      context.log("Azure Storage connection string not found");
      return {
        status: 500,
        body: JSON.stringify({ error: "Storage configuration error" }),
        headers: { "Content-Type": "application/json", ...corsHeaders },
      };
    }

    // Create table client and query data
    const tableClient = TableClient.fromConnectionString(
      connectionString,
      "words"
    );

    // Query entities with the specified partition key
    const entities = [];
    const listResults = tableClient.listEntities({
      queryOptions: { filter: `PartitionKey eq '${partitionKey}'` },
    });

    for await (const entity of listResults) {
      entities.push(entity);
    }

    return {
      status: 200,
      body: JSON.stringify(entities.length),
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
