import { toast } from "sonner";

/**
 * The app's one way to show a toast (VerveQ ONE, P1.5). Toasts take their look
 * and position from the single themed Toaster (components/ui/sonner.tsx):
 * ink, top-center under the screen header, in the brand font. Don't pass `position`
 * or styling per call — one place decides where messages appear.
 *
 * Same API as sonner's `toast` (notify.error, notify.success, …), so tests
 * that mock "sonner" keep seeing every call.
 */
export const notify = toast;
