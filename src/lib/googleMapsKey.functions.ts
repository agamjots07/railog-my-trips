import { createServerFn } from "@tanstack/react-start";

// Returns the Google Maps browser key. Referrer-restricted keys are safe to
// embed in the browser (that's what the Maps JS API requires).
export const getGoogleMapsKey = createServerFn({ method: "GET" }).handler(async () => {
  return { key: process.env.GOOGLE_API_KEY ?? "" };
});
