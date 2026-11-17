import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
export class ContentError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export async function contentResult(run: () => Promise<Response>) {
  try {
    return await run();
  } catch (error) {
    if (error instanceof ContentError)
      return Response.json({ error: error.message }, { status: error.status });
    if (error instanceof ZodError)
      return Response.json(
        {
          error: error.issues
            .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
            .join("; "),
        },
        { status: 400 },
      );
    if (error instanceof SyntaxError)
      return Response.json({ error: "Invalid JSON" }, { status: 400 });
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025")
        return Response.json({ error: "Record not found" }, { status: 404 });
      if (["P2002", "P2003", "P2004"].includes(error.code))
        return Response.json(
          {
            error:
              "This URL is already taken, a related record is invalid, or a database constraint failed",
          },
          { status: 409 },
        );
    }
    throw error;
  }
}
