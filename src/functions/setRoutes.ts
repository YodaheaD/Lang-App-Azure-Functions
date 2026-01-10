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

type wordEntity = {
  PartitionKey: string;
  RowKey: string;
  word: string;
  definition: string;
  class: string;
  language: string;
  createdAt: string;
  type: string;
  reading: string;
};

type setWordEntity = {
  PartitionKey: string;
  RowKey: string;
  Timestamp: string;
  setName: string;
  language: string;
  addedAt: string;
  word: string;
  definition: string;
  type: string;
  class: string;
  reading: string;
  createdAt: string;
};
import { randomUUID } from "crypto";

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
  /**
   * Incoming JSON Structure
   * {"data":{"partitionKey":"es","setName":"Testing Set 1","setFolder":"CreatingNewFolder","description":"This is to test Folder Creation"}}
   */
  type createSetRequestBody = {
    data: {
      partitionKey: string;
      setName: string;
      setFolder: string;
      description: string;
    };
  };
  // Collect and log the incoming data
  const requestBody: createSetRequestBody =
    (await request.json()) as createSetRequestBody;
  console.log("Received Create Set Request Body:");
  console.log(requestBody.data);

  // Make sure a combination of the setName, setFolder, and  partitionKey does not already exist
  // Note: a setName can exist in different languages (partitionKeys)
  const connectionString = process.env.AzureWebJobsStorage;
  const tableClient = TableClient.fromConnectionString(
    connectionString,
    "sets"
  );
  const filter = `setName eq '${requestBody.data.setName}' and setFolder eq '${requestBody.data.setFolder}' and partitionKey eq '${requestBody.data.partitionKey}'`;
  console.log(
    ` Checking For SetName: ${requestBody.data.setName}  in Folder: ${requestBody.data.setFolder} for Language: ${requestBody.data.partitionKey}`
  );
  const entities = [];
  const listResults = tableClient.listEntities({
    queryOptions: { filter: filter },
  });
  for await (const entity of listResults) {
    entities.push(entity);
  }
  if (entities.length > 0) {
    console.log(
      ` Set with Name: ${requestBody.data.setName} already exists for Language: ${requestBody.data.partitionKey}`
    );
    return {
      status: 409,
      body: `Set with Name: ${requestBody.data.setName} already exists for Language: ${requestBody.data.partitionKey}`,
      headers: { "Content-Type": "text/plain", ...corsHeaders },
    };
  }

  // Lastly, create the set
  /**
   * Required Fields:
   * PartitionKey
    RowKey
    Timestamp
    setName
    setFolder
    description
    dateCreated
    dateModified
    createdAt
   */
  const newSetEntity = {
    partitionKey: requestBody.data.partitionKey,
    rowKey: randomUUID(),
    setName: requestBody.data.setName,
    setFolder: requestBody.data.setFolder,
    description: requestBody.data.description,
    dateCreated: new Date().toISOString(),
    dateModified: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };

  console.log(" Creating New Set Entity:");
  console.log(newSetEntity);
  try {
    await tableClient.createEntity(newSetEntity);
  } catch (err) {
    console.log(" Error creating new set entity:", err);
    return {
      status: 500,
      body: "Error creating new set",
      headers: { "Content-Type": "text/plain", ...corsHeaders },
    };
  }

  return {
    status: 200,
    body: "Hello from create set",
    headers: { "Content-Type": "text/plain", ...corsHeaders },
  };
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
  /**
   * Incoming JSON Structure
{
    "data": {
        "partitionKey": "ja",
        "setName": "01-09-2026,19-20-34",
        "setFolder": "Mistakes",
        "description": "Mistake set created on 1/9/2026, 7:20:34 PM",
        "rowKeys": [
            "f0b67d7f-5343-449f-8e9a-5522bacf3fa1",
            "af386857-6a30-42cb-8424-c6bbb88f3180"
        ]
    }
}   */
  type createSetRequestBody = {
    data: {
      partitionKey: string;
      setName: string;
      setFolder: string;
      description: string;
      rowKeys: string[];
    };
  };
  // Collect and log the incoming data
  const requestBody: createSetRequestBody =
    (await request.json()) as createSetRequestBody;
  console.log("Received Create Set Request Body:");
  console.log(requestBody.data);

  //DUPLICATE SET CHECK - Make sure a combination of the setName, setFolder, and  partitionKey does not already exist
  // Note: a setName can exist in different languages (partitionKeys)
  const connectionString = process.env.AzureWebJobsStorage;
  const tableClient = TableClient.fromConnectionString(
    connectionString,
    "sets"
  );
  const filter = `setName eq '${requestBody.data.setName}' and setFolder eq '${requestBody.data.setFolder}' and partitionKey eq '${requestBody.data.partitionKey}'`;
  console.log(
    ` Checking For SetName: ${requestBody.data.setName}  in Folder: ${requestBody.data.setFolder} for Language: ${requestBody.data.partitionKey}`
  );
  const entities = [];
  const listResults = tableClient.listEntities({
    queryOptions: { filter: filter },
  });
  for await (const entity of listResults) {
    entities.push(entity);
  }
  if (entities.length > 0) {
    console.log(
      ` Set with Name: ${requestBody.data.setName} already exists for Language: ${requestBody.data.partitionKey}`
    );
    return {
      status: 409,
      body: `Set with Name: ${requestBody.data.setName} already exists for Language: ${requestBody.data.partitionKey}`,
      headers: { "Content-Type": "text/plain", ...corsHeaders },
    };
  }
  // END OF DUPLICATE SET CHECK

  // Lastly, create the set
  /**
   * Required Fields:
   * PartitionKey
    RowKey
    Timestamp
    setName
    setFolder
    description
    dateCreated
    dateModified
    createdAt
   */
  const newSetEntityRowKey = randomUUID();
  const newSetEntity = {
    partitionKey: requestBody.data.partitionKey,
    rowKey: newSetEntityRowKey,
    setName: requestBody.data.setName,
    setFolder: requestBody.data.setFolder,
    description: requestBody.data.description,
    dateCreated: new Date().toISOString(),
    dateModified: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };

  try {
    console.log(" Creating New Set With Terms Entity:");
    console.log(newSetEntity);
    await tableClient.createEntity(newSetEntity);
  } catch (err) {
    console.log(" Error creating new set entity:", err);
    return {
      status: 500,
      body: "Error creating new set",
      headers: { "Content-Type": "text/plain", ...corsHeaders },
    };
  }

  // 2) Using the rowKeys in the requestBody.data.rowKeys array, fetch each word from the "words" table and insert into the "setwords" table with PartitionKey as newSetEntityRowKey
  const wordsTableClient = TableClient.fromConnectionString(
    connectionString,
    "words"
  );
  const setWordsTableClient = TableClient.fromConnectionString(
    connectionString,
    "setwords"
  );
  for (const rowKey of requestBody.data.rowKeys) {
    try {
      // Fetch word entity from "words" table
      const filter = `RowKey eq '${rowKey}'`;
      const listResults = wordsTableClient.listEntities({
        queryOptions: { filter: filter },
      });
      let wordEntity: any;
      for await (const entity of listResults) {
        wordEntity = entity;
      }
      if (wordEntity) {
        // Create new entity for "setwords" table
        // -> Word
        // PartitionKey:string
        // RowKey:string
        // word:string
        // definition:string
        // class:string
        // language:string
        // createdAt:string
        // type:string
        // reading:string
        /** */
        // Set words Entity Fields
        // PartitionKey:string
        // RowKey:string;
        // Timestamp:string
        // setName:string
        // language:string
        // addedAt:string
        // word:string
        // definition:string
        // type:string
        // class:string
        // reading:string
        // createdAt:string
        const setWordEntity = {
          partitionKey: newSetEntityRowKey,
          rowKey: wordEntity.rowKey,
          setName: newSetEntity.setName,
          language: wordEntity.partitionKey,
          addedAt: new Date().toISOString(),
          word: wordEntity.word,
          definition: wordEntity.definition,
          type: wordEntity.type,
          class: wordEntity.class,
          reading: wordEntity.reading || "",
          createdAt: wordEntity.createdAt,
        };
        console.log(` Inserting into setwords table:`);
        console.log(setWordEntity);
        // Insert into "setwords" table
        await setWordsTableClient.createEntity(setWordEntity);
      }
    } catch (err) {
      console.log(` Error processing word with RowKey ${rowKey} :`, err);
    }
  }

  return {
    status: 200,
    body: "Set created successfully",
    headers: { "Content-Type": "text/plain", ...corsHeaders },
  };
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

  // Read the parameters
  const SetrowKey = request.params.rowKey;
  const SetpartitionKey = request.params.partitionKey;
  if (!SetrowKey || !SetpartitionKey) {
    return {
      status: 400,
      body: "Missing required parameters",
      headers: { "Content-Type": "text/plain", ...corsHeaders },
    };
  }
  console.log(
    ` Deleting Set with Row Key: ${SetrowKey} and Partition Key: ${SetpartitionKey}`
  );

  // 1) QUery partitionKey field of table "setwords" to delete all entries with matching partitionKey
  const connectionString = process.env.AzureWebJobsStorage;
  const setWordsTableClient = TableClient.fromConnectionString(
    connectionString,
    "setwords"
  );
  const entitiesToDelete = [];
  const listResults = setWordsTableClient.listEntities({
    queryOptions: { filter: `PartitionKey eq '${SetrowKey}'` },
  });
  for await (const entity of listResults) {
    entitiesToDelete.push(entity);
  }
  for (const entity of entitiesToDelete) {
    try {
      await setWordsTableClient.deleteEntity(
        entity.partitionKey,
        entity.rowKey
      );
      console.log(
        ` Deleted word with Row Key: ${entity.rowKey} from Set: ${entity.partitionKey}`
      );
    } catch (err) {
      console.log(
        ` Error deleting word with Row Key: ${entity.rowKey} from Set: ${entity.partitionKey}`,
        err
      );
    }
  }
  // 2) Query rowKey and partitionKey field of table "sets" to delete the set entry
  const setsTableClient = TableClient.fromConnectionString(
    connectionString,
    "sets"
  );
  try {
    await setsTableClient.deleteEntity(SetpartitionKey, SetrowKey);
    console.log(
      ` Deleted Set with Row Key: ${SetrowKey} and Partition Key: ${SetpartitionKey}`
    );
  } catch (err) {
    console.log(
      ` Error deleting Set with Row Key: ${SetrowKey} and Partition Key: ${SetpartitionKey}`,
      err
    );
  }

  return {
    status: 200,
    body: "Hello from create set",
    headers: { "Content-Type": "text/plain", ...corsHeaders },
  };
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
    context.log(
      ` Using Row Key: ${rowKey} , to collect set words with matching value in their PartitionKey`
    );
    const connectionString = process.env.AzureWebJobsStorage;
    const tableClient = TableClient.fromConnectionString(
      connectionString,
      "setwords"
    );
    // use queryParameters to filter based on setName, setFolder, language
    const filter = `PartitionKey eq '${rowKey}'`;
    const entities = [];
    const listResults = tableClient.listEntities({
      queryOptions: { filter: filter },
    });
    for await (const entity of listResults) {
      entities.push(entity);
    }
    if (entities.length === 0) {
      return {
        status: 404,
        body: "Set not found Or no words in the set",
        headers: { "Content-Type": "text/plain", ...corsHeaders },
      };
    }
    console.log(`Fetched ${entities.length} entities from the table.`);
    return {
      status: 200,
      body: JSON.stringify(entities),
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
    context.log(
      `Set Name: ${setName}, Set Folder: ${setFolder}, Language: ${language}`
    );
    const connectionString = process.env.AzureWebJobsStorage;
    const tableClient = TableClient.fromConnectionString(
      connectionString,
      "setwords"
    );
    // use queryParameters to filter based on setName, setFolder, language
    const filter = `setName eq '${setName}' and language eq '${language}'`;
    const entities = [];
    const listResults = tableClient.listEntities({
      queryOptions: { filter: filter },
    });
    for await (const entity of listResults) {
      entities.push(entity);
    }
    if (entities.length === 0) {
      return {
        status: 404,
        body: "Set not found Or no words in the set",
        headers: { "Content-Type": "text/plain", ...corsHeaders },
      };
    }
    console.log(`Fetched ${entities.length} entities from the table.`);
    return {
      status: 200,
      body: JSON.stringify(entities),
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
// Fetching Total Size of "set" table
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

/** Getting All Sets */
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

  // Step 1) Check for Param Validatity
  // Step 2) Use the Set ID to query table "sets", if found create the SetData object
  // Step 3) Parse the request body to get the termRowKeys array
  // Step 4) For each Row Key in termRowKeys, query the "words" table to get the corresponding word entity
  // Step 5) Insert each fetched word entity into the "setwords" table with PartitionKey as SetRowKey

  try {
    // Step 1: Validate SetRowKey parameter
    const SetRowKey = request.params.SetRowKey;
    if (!SetRowKey) {
      return {
        status: 400,
        body: "Missing Sets Row Key",
        headers: { "Content-Type": "text/plain", ...corsHeaders },
      };
    }

    // Parse request body and extract termRowKeys
    const requestBody = (await request.json()) as { termRowKeys?: string[] };

    if (!requestBody || !requestBody.termRowKeys) {
      return {
        status: 400,
        body: "Missing termRowKeys in request body",
        headers: { "Content-Type": "text/plain", ...corsHeaders },
      };
    }

    const termRowKeys: string[] = requestBody.termRowKeys;

    if (!Array.isArray(termRowKeys) || termRowKeys.length === 0) {
      return {
        status: 400,
        body: "termRowKeys must be a non-empty array",
        headers: { "Content-Type": "text/plain", ...corsHeaders },
      };
    }

    // Step 2: Fetch Set Data from "sets" table
    const connectionString = process.env.AzureWebJobsStorage;
    const setsTableClient = TableClient.fromConnectionString(
      connectionString,
      "sets"
    );
    let SetData: any;
    try {
      const SetFilter = `RowKey eq '${SetRowKey}'`;
      const listResults = setsTableClient.listEntities({
        queryOptions: { filter: SetFilter },
      });
      let getSetResponse: any;
      for await (const entity of listResults) {
        getSetResponse = entity;
      }
      SetData = getSetResponse;
    } catch (error) {
      context.log(`Set with RowKey ${SetRowKey} not found:`, error);
      return {
        status: 404,
        body: `Set with RowKey ${SetRowKey} not found`,
        headers: { "Content-Type": "text/plain", ...corsHeaders },
      };
    }
    console.log(`Fetched Set Data:`, SetData);

    // Step 3: Parse the request body to get the termRowKeys array

    // Query the "words" table to get the terms with the provided Row Keys
    const wordsTableClient = TableClient.fromConnectionString(
      connectionString,
      "words"
    );

    // Fetch all word entities matching the provided row keys
    const wordEntities = [];
    for (const rowKey of termRowKeys) {
      try {
        // Create filter for each rowKey
        const filter = `RowKey eq '${rowKey}'`;
        const listResults = wordsTableClient.listEntities({
          queryOptions: { filter: filter },
        });

        for await (const entity of listResults) {
          wordEntities.push(entity);
        }
      } catch (error) {
        context.log(`Error fetching word with RowKey ${rowKey}:`, error);
      }
    }
    console.log(wordEntities);

    if (wordEntities.length === 0) {
      return {
        status: 404,
        body: "No matching words found for the provided row keys",
        headers: { "Content-Type": "text/plain", ...corsHeaders },
      };
    }

    console.log(
      `\n Adding ${termRowKeys.length} terms to set with Row Key: ${SetRowKey}`
    );

    // Now insert these word entities into the "setwords" table but with the partition key as SetRowKey
    const setWordsTableClient = TableClient.fromConnectionString(
      connectionString,
      "setwords"
    );
    for (const wordEntity of wordEntities) {
      // PartitionKey
      // RowKey
      // Timestamp
      // setName
      // language
      // addedAt
      // word
      // definition
      // type
      // class
      // reading
      // createdAt
      const setWordEntity = {
        partitionKey: SetRowKey,
        rowKey: wordEntity.rowKey,
        setName: SetData.setName,
        language: wordEntity.partitionKey,
        addedAt: new Date().toISOString(),
        word: wordEntity.word,
        definition: wordEntity.definition,
        type: wordEntity.type,
        class: wordEntity.class,
        reading: wordEntity.reading || "",
        createdAt: wordEntity.createdAt,
      };

      try {
        await setWordsTableClient.createEntity(setWordEntity);
        console.log(`\n Added word ${wordEntity.word} to set ${SetRowKey}`);
        console.log(setWordEntity);
      } catch (err) {
        console.log(
          `\n Error adding word with RowKey ${wordEntity.rowKey} to set:`,
          err
        );
      }
    }

    console.log(`\n Term Row Keys: ${termRowKeys}`);

    return {
      status: 200,
      body: JSON.stringify("Terms added successfully"),
      headers: { "Content-Type": "application/json", ...corsHeaders },
    };
  } catch (err) {
    context.log("Error in AddTermsToSet:", err);
    return {
      status: 500,
      body: "Internal Server Error",
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
  // 🔥 REQUIRED for CORS

  // Step 1) Check for Param Validatity
  // Step 2) Check for body validity
  // Step 3) IN "setwords" The partition key is the SetRowKey in the parameter and the terms rowKeys are in the body
  // --- use them to delete the entities from the "setwords" table
  // Step 1: Validate SetRowKey parameter
  try {
    const SetRowKey = request.params.SetRowKey;
    if (!SetRowKey) {
      return {
        status: 400,
        body: "Missing Sets Row Key",
        headers: { "Content-Type": "text/plain", ...corsHeaders },
      };
    }

    // Parse request body and extract termRowKeys
    const requestBody = (await request.json()) as { termRowKeys?: string[] };

    if (!requestBody || !requestBody.termRowKeys) {
      return {
        status: 400,
        body: "Missing termRowKeys in request body",
        headers: { "Content-Type": "text/plain", ...corsHeaders },
      };
    }

    console.log(` For Set Row Key: ${SetRowKey} , Removing Terms`);
    console.log(requestBody.termRowKeys);

    // Cycle through termRowKeys and delete from "setwords" table
    const connectionString = process.env.AzureWebJobsStorage;
    const setWordsTableClient = TableClient.fromConnectionString(
      connectionString,
      "setwords"
    );
    for (const rowKey of requestBody.termRowKeys) {
      try {
        await setWordsTableClient.deleteEntity(SetRowKey, rowKey);
        console.log(
          ` Deleted word with Row Key: ${rowKey} from Set: ${SetRowKey}`
        );
      } catch (err) {
        console.log(
          ` Error deleting word with Row Key: ${rowKey} from Set: ${SetRowKey}`,
          err
        );
      }
    }
  } catch (err) {
    context.log("Error in RemoveTermsFromSet:", err);
    return {
      status: 500,
      body: "Internal Server Error",
      headers: { "Content-Type": "text/plain", ...corsHeaders },
    };
  }

  return {
    status: 200,
    body: JSON.stringify("Terms removed successfully"),
    headers: { "Content-Type": "application/json", ...corsHeaders },
  };
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
