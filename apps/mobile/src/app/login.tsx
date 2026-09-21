import { useState } from "react";
import { router } from "expo-router";

import { supabase } from "@/lib/supabase";
import { Screen } from "@/components/ui/screen";
import { ThemedText } from "@/components/themed-text";
import { TextField } from "@/components/ui/text-field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Spacing } from "@/constants/theme";

/**
 * Same two-step phone-OTP flow as apps/web's login page — Supabase Auth
 * handles the OTP directly (signInWithOtp/verifyOtp), not the NestJS API.
 * Session persists to AsyncStorage on success; the root layout's
 * Stack.Protected guard notices and swaps this screen out on its own, so
 * there's no explicit "redirect to home" here beyond going back if this
 * was reached as a modal push.
 */
// Temporarily off, same reason and same flip-back-to-true fix as apps/web's
// PHONE_LOGIN_ENABLED — phone OTP has no reliable SMS delivery right now.
// Mobile has no alternative sign-in method yet (unlike web's email option),
// so this shows a clear "unavailable" state rather than a form that can
// never succeed.
const PHONE_LOGIN_ENABLED = false;

export default function LoginScreen() {
  if (!PHONE_LOGIN_ENABLED) {
    return (
      <Screen>
        <Card>
          <ThemedText type="title" color="onSurface">
            Sign-in unavailable
          </ThemedText>
          <ThemedText color="onSurfaceMuted" style={{ marginTop: Spacing.two }}>
            Phone sign-in is temporarily unavailable. Please check back soon.
          </ThemedText>
        </Card>
      </Screen>
    );
  }

  return <LoginScreenPhoneFlow />;
}

function LoginScreenPhoneFlow() {
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function sendCode() {
    setError(null);
    setPending(true);
    const { error: sendError } = await supabase.auth.signInWithOtp({ phone });
    setPending(false);
    if (sendError) {
      setError("Couldn't send a code to that number. Check it's in +92... format and try again.");
      return;
    }
    setStep("otp");
  }

  async function verify() {
    setError(null);
    setPending(true);
    const { error: verifyError } = await supabase.auth.verifyOtp({
      phone,
      token: code,
      type: "sms",
    });
    setPending(false);
    if (verifyError) {
      setError("That code didn't match. Try again.");
      return;
    }
    if (router.canGoBack()) {
      router.back();
    }
  }

  return (
    <Screen>
      <Card>
        <ThemedText type="title" color="onSurface">
          Log in
        </ThemedText>

        {error && (
          <ThemedText color="seal" style={{ marginTop: Spacing.two }}>
            {error}
          </ThemedText>
        )}

        {step === "phone" ? (
          <>
            <TextField
              label="Phone number"
              keyboardType="phone-pad"
              autoComplete="tel"
              placeholder="+923001234567"
              value={phone}
              onChangeText={setPhone}
              style={{ marginTop: Spacing.three }}
            />
            <Button
              label="Send code"
              onPress={sendCode}
              loading={pending}
              disabled={!phone}
              style={{ marginTop: Spacing.three }}
            />
          </>
        ) : (
          <>
            <ThemedText color="onSurfaceMuted" style={{ marginTop: Spacing.two }}>
              We sent a code to {phone}
            </ThemedText>
            <TextField
              label="6-digit code"
              keyboardType="number-pad"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChangeText={setCode}
              style={{ marginTop: Spacing.three }}
            />
            <Button
              label="Verify"
              onPress={verify}
              loading={pending}
              disabled={code.length !== 6}
              style={{ marginTop: Spacing.three }}
            />
            <Button
              label="Use a different number"
              variant="ghost"
              onPress={() => setStep("phone")}
              style={{ marginTop: Spacing.two }}
            />
          </>
        )}
      </Card>
    </Screen>
  );
}
