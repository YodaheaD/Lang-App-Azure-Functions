import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { setsTable } from "../db/setsTable";

const corsHeaders = {
  "Access-Control-Allow-Origin": "http://localhost:3000",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

type createSetRequestBody = {
  data: {
    partitionKey: string;
    setName: string;
    setFolder: string;
    description: string;
  };
};

type createSetWithTermsRequestBody = {
  data: {
    partitionKey: string;
    setName: string;
    setFolder: string;
    description: string;
    rowKeys: string[];
  };
};

type addRemoveTermsRequestBody = {
  data: {
    rowKeys: string[];
  };
};

/** Creating a Set */
export async function CreateSet(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log(`Http function processed request for url "${request.url}"`);
  
  // 🔥 REQUIRED for CORS
  if (request.method === "OPTIONS") {
    return {
      status: 204,
      headers: corsHeaders,
    };
  }

  try {
    // Parse request body
    const requestBody: createSetRequestBody = await request.json() as createSetRequestBody;
    context.log("Received Create Set Request Body:", requestBody.data);

    // Use setsTable to create the set
    const result = await setsTable.createSet(requestBody.data);
    
    if (!result.success) {
      return {
        status: 409,
        body: result.error || "Error creating set",
        headers: { "Content-Type": "text/plain", ...corsHeaders },
      };
    }

    return {
      status: 200,
      body: "Set created successfully",
      headers: { "Content-Type": "text/plain", ...corsHeaders },
    };
  } catch (error) {
    context.log("Error processing request:", error);
    return {
      status: 500,
      body: "Internal server error",
      headers: { "Content-Type": "text/plain", ...corsHeaders },
    };
  }
}

/** Creating a Set With Terms */
export async function CreateSetWTerms(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log(`Http function processed request for url "${request.url}"`);
  
  // 🔥 REQUIRED for CORS
  if (request.method === "OPTIONS") {
    return {
      status: 204,
      headers: corsHeaders,
    };
  }

  try {
    // Parse request body
    const requestBody: createSetWithTermsRequestBody = await request.json() as createSetWithTermsRequestBody;
    context.log("Received Create Set With Terms Request Body:", requestBody.data);

    // Use setsTable to create the set with terms
    const result = await setsTable.createSetWithTerms(requestBody.data);
    
    if (!result.success) {
      const status = result.error?.includes("already exists") ? 409 : 500;
      return {
        status,
        body: result.error || "Error creating set with terms",
        headers: { "Content-Type": "text/plain", ...corsHeaders },
      };
    }

    return {
      status: 200,
      body: "Set created successfully",
      headers: { "Content-Type": "text/plain", ...corsHeaders },
    };
  } catch (error) {
    context.log("Error processing request:", error);
    return {
      status: 500,
      body: "Internal server error",
      headers: { "Content-Type": "text/plain", ...corsHeaders },
    };
  }
}
/** Deleting a Set */
export async function DeleteSet(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  if (request.method === "OPTIONS") {
    return {
      status: 204,
      headers: corsHeaders,
    };
  }
  context.log(`Http function processed request for url "${request.url}"`);

  try {
    // Read the parameters
    const setRowKey = request.params.rowKey;
    const setPartitionKey = request.params.partitionKey;
    
    if (!setRowKey || !setPartitionKey) {
      return {
        status: 400,
        body: "Missing required parameters",
        headers: { "Content-Type": "text/plain", ...corsHeaders },
      };
    }

    context.log(`Deleting Set with Row Key: ${setRowKey} and Partition Key: ${setPartitionKey}`);

    // Use setsTable to delete the set
    const result = await setsTable.deleteSet(setRowKey, setPartitionKey);
    
    if (!result.success) {
      return {
        status: 500,
        body: result.error || "Error deleting set",
        headers: { "Content-Type": "text/plain", ...corsHeaders },
      };
    }

    return {
      status: 200,
      body: "Set deleted successfully",
      headers: { "Content-Type": "text/plain", ...corsHeaders },
    };
  } catch (error) {
    context.log("Error processing request:", error);
    return {
      status: 500,
      body: "Internal server error",
      headers: { "Content-Type": "text/plain", ...corsHeaders },
    };
  }
}

/** Getting Set Data */
export async function GetSet(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log(`Http function processed request for url "${request.url}"`);

  try {
    const rowKey = request.params.rowKey;
    if (!rowKey) {
      return {
        status: 400,
        body: "Missing required parameters",
        headers: { "Content-Type": "text/plain", ...corsHeaders },
      };
    }

    context.log(`Using Row Key: ${rowKey}, to collect set words`);

    // Use setsTable to get set terms
    const terms = await setsTable.getSetTerms(rowKey);
    
    if (terms.length === 0) {
      return {
        status: 404,
        body: "Set not found or no words in the set",
        headers: { "Content-Type": "text/plain", ...corsHeaders },
      };
    }

    context.log(`Fetched ${terms.length} entities from the table.`);
    return {
      status: 200,
      body: JSON.stringify(terms),
      headers: { "Content-Type": "application/json", ...corsHeaders },
    };
  } catch (err) {
    context.log("Error in GetSet:", err);
    return {
      status: 500,
      body: "Internal Server Error",
      headers: { "Content-Type": "text/plain", ...corsHeaders },
    };
  }
}

/** Getting Set Data with Name and Language */
export async function GetSetWNameandLang(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log(`Http function processed request for url "${request.url}"`);

  try {
    const setName = request.params.setName;
    const setFolder = request.params.setFolder;
    const language = request.params.language;
    
    if (!setName || !setFolder || !language) {
      return {
        status: 400,
        body: "Missing required parameters",
        headers: { "Content-Type": "text/plain", ...corsHeaders },
      };
    }

    context.log(`Set Name: ${setName}, Set Folder: ${setFolder}, Language: ${language}`);

    // Use setsTable to get set by name, folder, and language
    const set = await setsTable.getSetByNameFolderLanguage(setName, setFolder, language);
    
    if (!set) {
      return {
        status: 404,
        body: "Set not found",
        headers: { "Content-Type": "text/plain", ...corsHeaders },
      };
    }

    // Get the terms for this set
    const terms = await setsTable.getSetTerms(set.rowKey as string);
    
    return {
      status: 200,
      body: JSON.stringify({ set, terms }),
      headers: { "Content-Type": "application/json", ...corsHeaders },
    };
  } catch (err) {
    context.log("Error in GetSetWNameandLang:", err);
    return {
      status: 500,
      body: "Internal Server Error",
      headers: { "Content-Type": "text/plain", ...corsHeaders },
    };
  }
}
// Fetching Total Size of "set" table
export async function GetSize(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log(`Http function processed request for url "${request.url}"`);
  
  try {
    // Use setsTable to get count
    const result = await setsTable.getSetCount();
    
    if (typeof result === 'object' && 'error' in result) {
      return {
        status: 500,
        body: JSON.stringify({ error: result.error }),
        headers: { "Content-Type": "application/json", ...corsHeaders },
      };
    }
    
    return {
      status: 200,
      body: JSON.stringify(result),
      headers: { "Content-Type": "application/json", ...corsHeaders },
    };
  } catch (error) {
    context.log("Error in GetSize:", error);
    return {
      status: 500,
      body: JSON.stringify({ error: "Internal server error" }),
      headers: { "Content-Type": "application/json", ...corsHeaders },
    };
  }
}

/** Getting All Sets */
export async function GetAllSets(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log(`Http function processed request for url "${request.url}"`);

  try {
    // Get pagination parameters
    const pageParam = request.query.get("page");
    const limitParam = request.query.get("limit");
    const page = pageParam ? parseInt(pageParam, 10) : 1;
    const limit = limitParam ? parseInt(limitParam, 10) : 50;

    // Use setsTable to get all sets
    const result = await setsTable.getAllSets(page, limit);
    
    if ('error' in result) {
      return {
        status: 500,
        body: JSON.stringify({ error: result.error }),
        headers: { "Content-Type": "application/json", ...corsHeaders },
      };
    }

    // Format the data by grouping sets by folder and language
    const formattedData: any = {};

    result.data.forEach((row: any) => {
      const folder = row.setFolder;
      const folderLang = row.partitionKey;

      // Create a unique key combining folder and language
      const folderKey = `${folder}_${folderLang}`;

      if (!formattedData[folderKey]) {
        formattedData[folderKey] = {
          folder,
          partitionKey: folderLang,
          sets: [],
        };
      }

      formattedData[folderKey].sets.push({
        setName: row.setName,
        description: row.description,
        dateCreated: row.dateCreated,
        dateModified: row.dateModified,
        partitionKey: row.partitionKey,
        rowKey: row.rowKey,
      });
    });

    return {
      status: 200,
      body: JSON.stringify({
        data: Object.values(formattedData),
        page: result.page,
        limit: result.limit,
        total: result.total
      }),
      headers: { "Content-Type": "application/json", ...corsHeaders },
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
/** Adding Terms to Set */
export async function AddTermsToSet(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  // 🔥 REQUIRED for CORS
  if (request.method === "OPTIONS") {
    return {
      status: 204,
      headers: corsHeaders,
    };
  }
  context.log(`Http function processed request for url "${request.url}"`);

  try {
    // Validate SetRowKey parameter
    const setRowKey = request.params.SetRowKey;
    if (!setRowKey) {
      return {
        status: 400,
        body: "Missing Sets Row Key",
        headers: { "Content-Type": "text/plain", ...corsHeaders },
      };
    }

    // Parse request body
    const requestBody: addRemoveTermsRequestBody = await request.json() as addRemoveTermsRequestBody;

    if (!requestBody?.data?.rowKeys || !Array.isArray(requestBody.data.rowKeys) || requestBody.data.rowKeys.length === 0) {
      return {
        status: 400,
        body: "Missing or invalid rowKeys in request body",
        headers: { "Content-Type": "text/plain", ...corsHeaders },
      };
    }

    context.log(`Adding ${requestBody.data.rowKeys.length} terms to set with Row Key: ${setRowKey}`);

    // Use setsTable to add terms
    const result = await setsTable.addTermsToSet(setRowKey, requestBody.data.rowKeys);
    
    if (!result.success) {
      return {
        status: 500,
        body: result.error || "Error adding terms to set",
        headers: { "Content-Type": "text/plain", ...corsHeaders },
      };
    }

    return {
      status: 200,
      body: JSON.stringify("Terms added successfully"),
      headers: { "Content-Type": "application/json", ...corsHeaders },
    };
  } catch (error) {
    context.log("Error in AddTermsToSet:", error);
    return {
      status: 500,
      body: "Internal server error",
      headers: { "Content-Type": "text/plain", ...corsHeaders },
    };
  }
}
/** Removing Terms from Set */
export async function RemoveTermsFromSet(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  if (request.method === "OPTIONS") {
    return {
      status: 204,
      headers: corsHeaders,
    };
  }
  context.log(`Http function processed request for url "${request.url}"`);

  try {
    // Validate SetRowKey parameter
    const setRowKey = request.params.SetRowKey;
    if (!setRowKey) {
      return {
        status: 400,
        body: "Missing Sets Row Key",
        headers: { "Content-Type": "text/plain", ...corsHeaders },
      };
    }

    // Parse request body
    const requestBody: addRemoveTermsRequestBody = await request.json() as addRemoveTermsRequestBody;

    if (!requestBody?.data?.rowKeys || !Array.isArray(requestBody.data.rowKeys) || requestBody.data.rowKeys.length === 0) {
      return {
        status: 400,
        body: "Missing or invalid rowKeys in request body",
        headers: { "Content-Type": "text/plain", ...corsHeaders },
      };
    }

    context.log(`For Set Row Key: ${setRowKey}, Removing ${requestBody.data.rowKeys.length} Terms`);

    // Use setsTable to remove terms
    const result = await setsTable.removeTermsFromSet(setRowKey, requestBody.data.rowKeys);
    
    if (!result.success) {
      return {
        status: 500,
        body: result.error || "Error removing terms from set",
        headers: { "Content-Type": "text/plain", ...corsHeaders },
      };
    }

    return {
      status: 200,
      body: JSON.stringify("Terms removed from set successfully"),
      headers: { "Content-Type": "application/json", ...corsHeaders },
    };
  } catch (error) {
    context.log("Error in RemoveTermsFromSet:", error);
    return {
      status: 500,
      body: "Internal server error",
      headers: { "Content-Type": "text/plain", ...corsHeaders },
    };
  }
}
// Route Registrations

/** Adding Terms to Set Route */
app.http("AddTermsToSet", {
  methods: ["POST", "OPTIONS"], // ✅ REQUIRED

  authLevel: "anonymous",
  route: "sets/addTerms/{SetRowKey}",
  handler: AddTermsToSet,
});
/** Removing Terms from Set Route */
app.http("RemoveTermsFromSet", {
  methods: ["POST", "OPTIONS"], // ✅ REQUIRED
  authLevel: "anonymous",
  route: "sets/removeTerms/{SetRowKey}",
  handler: RemoveTermsFromSet,
});

/** Creating a Set Route */
app.http("CreateSet", {
  methods: ["POST", "OPTIONS"], // ✅ REQUIRED
  authLevel: "anonymous",
  route: "sets/createSet",
  handler: CreateSet,
});
/** Creating a Set Route */
app.http("CreateSetWTerms", {
  methods: ["POST", "OPTIONS"], // ✅ REQUIRED
  authLevel: "anonymous",
  route: "sets/createSetWithTerms",
  handler: CreateSetWTerms,
});
/** Delete a Set Route */
app.http("DeleteSet", {
  methods: ["DELETE", "OPTIONS"], // ✅ REQUIRED
  authLevel: "anonymous",
  route: "sets/deleteSets/{rowKey}/{partitionKey}",
  handler: DeleteSet,
});

app.http("GetSet", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "sets/getSet/{rowKey}",
  handler: GetSet,
});
app.http("GetSetWNameandLang", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "sets/getSetMore/{setName}/{setFolder}/{language}",
  handler: GetSetWNameandLang,
});
app.http("GetAllSets", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "sets/getAllSets",
  handler: GetAllSets,
});
// Fetching Size of "set" table
app.http("SetSize", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "sets/getSize",
  handler: GetSize,
});
