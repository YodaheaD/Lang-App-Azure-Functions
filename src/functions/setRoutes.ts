import { TableClient } from "@azure/data-tables";
import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
const corsHeaders = {
  "Access-Control-Allow-Origin": "http://localhost:3000",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};
export async function CreateSet(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log(`Http function processed request for url "${request.url}"`);

  return {
    status: 200,
    body: "Hello from create set",
    headers: { "Content-Type": "text/plain" },
  };
}

export async function GetSet(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log(`Http function processed request for url "${request.url}"`);

  return {
    status: 200,
    body: "Hello from getSet",
    headers: { "Content-Type": "text/plain" },
  };
}

// Fetching Size of "set" table
export async function GetSize(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log(`Http function processed request for url "${request.url}"`);
  //Create Table Client
  const connectionString = process.env.AzureWebJobsStorage;
  // Create table client and query data
  const tableClient = TableClient.fromConnectionString(
    connectionString,
    "sets"
  );
  // Query entities with the specified partition key
  const entities = [];
  const listResults = tableClient.listEntities();
  for await (const entity of listResults) {
    entities.push(entity);
  }
  return {
    status: 200,
    body: JSON.stringify(entities.length),
    headers: { "Content-Type": "application/json", ...corsHeaders },
  };
}

export async function GetAllSets(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log(`Http function processed request for url "${request.url}"`);

  try {
    //Create Table Client
    const connectionString = process.env.AzureWebJobsStorage;
    // Create table client and query data
    const tableClient = TableClient.fromConnectionString(
      connectionString,
      "sets"
    );
    // Query entities with the specified partition key
    const entities = [];
    const listResults = tableClient.listEntities();
    for await (const entity of listResults) {
      entities.push(entity);
    }

    const formattedData: any = {};

    (entities as any[]).forEach((row) => {
      const folder = row.setFolder;
      const folderLang = row.partitionKey;

      // Create a unique key combining folder and language to handle
      // cases where the same folder name exists for multiple languages
      const folderKey = `${folder}_${folderLang}`;

      if (!formattedData[folderKey]) {
        formattedData[folderKey] = {
          folder,
          PartitionKey: folderLang,
          sets: [],
        };
      }

      formattedData[folderKey].sets.push({
        setName: row.setName,
        description: row.description,
        dateCreated: row.dateCreated,
        dateModified: row.dateModified,
        partitionKey: row.partitionKey,
      });
    });

    return {
      status: 200,
      body: JSON.stringify(Object.values(formattedData)),
      headers: { "Content-Type": "text/plain", ...corsHeaders },
    };
  } catch (error) {
    context.log("Error fetching sets:", error);
    return {
      status: 500,
      body: JSON.stringify({ error: "Error fetching sets" }),
      headers: { "Content-Type": "application/json", ...corsHeaders },
    };
  }
}

app.http("CreateSet", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "set/createSet",
  handler: CreateSet,
});

app.http("GetSet", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "set/getSet",
  handler: GetSet,
});
app.http("GetAllSets", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "set/getAllSets",
  handler: GetAllSets,
});
// Fetching Size of "set" table
app.http("SetSize", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "set/getSize",
  handler: GetSize,
});
