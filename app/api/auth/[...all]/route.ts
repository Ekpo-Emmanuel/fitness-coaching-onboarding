import { getAuth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

const { GET, POST } = toNextJsHandler((request) => getAuth().handler(request));

export { GET, POST };
