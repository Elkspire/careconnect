import { useState } from "react";
import { router } from "expo-router";
import { normalizePhone } from "@careconnect/validation";

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
export default function LoginScreen() {
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function sendCode() {
    setError(null);
    // Same normalization as web's login, so "0300 1234567" works and the
    // verify step uses the exact number the code was sent to.
    const normalized = normalizePhone(phone);
    setPhone(normalized);
    setPending(true);
    const { error: sendError } = await supabase.auth.signInWithOtp({ phone: normalized });
    setPending(false);
    if (sendError) {
      setError("Couldn't send a code to that number. Check it and try again (03... or +92...).");
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
              placeholder="0300 1234567"
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
