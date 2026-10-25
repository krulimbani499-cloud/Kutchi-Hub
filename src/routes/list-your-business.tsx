import { createFileRoute, redirect } from "@tanstack/react-router";

// There is no info page any more: "List your business" goes straight to the form. The URL stays so old links and ads still work.
// (Signed-out visitors are sent on to sign in and then come back to /business/new.)
export const Route = createFileRoute("/list-your-business")({
  beforeLoad: () => {
    throw redirect({ to: "/business/new" });
  },
});
