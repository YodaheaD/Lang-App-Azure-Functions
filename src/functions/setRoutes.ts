import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";

export async function CreateSet(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log(`Http function processed request for url "${request.url}"`);

  return {
    status: 200,
    body: "Hello from create set",
    headers: { "Content-Type": "text/plain" }
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
    headers: { "Content-Type": "text/plain" }
  };
}

app.http("CreateSet", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "set/createSet",
  handler: CreateSet,
});

app.http("GetSet", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "set/getSet",
  handler: GetSet,
});
