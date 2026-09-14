import { z } from "zod";

/** Shape of the browser's PushSubscription.toJSON() output. */
export const pushSubscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});
export type PushSubscribeInput = z.infer<typeof pushSubscribeSchema>;

export const pushUnsubscribeSchema = z.object({
  endpoint: z.string().url(),
});
export type PushUnsubscribeInput = z.infer<typeof pushUnsubscribeSchema>;

/** Expo push tokens look like "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]". */
export const expoPushRegisterSchema = z.object({
  token: z.string().min(1),
});
export type ExpoPushRegisterInput = z.infer<typeof expoPushRegisterSchema>;

export const expoPushUnregisterSchema = z.object({
  token: z.string().min(1),
});
export type ExpoPushUnregisterInput = z.infer<typeof expoPushUnregisterSchema>;
