import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAuth } from '../auth';
import { colors, radius } from '../theme';

// signup / signin, then the password reset path: forgot -> code -> newpassword
type Mode = 'signup' | 'signin' | 'forgot' | 'code' | 'newpassword';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;

const COPY: Record<Mode, { title: string; body: string }> = {
  signup: {
    title: 'Back up your streak',
    body: 'Create a free account to keep your streak, alarms and settings if you change phones. Photos are never uploaded.',
  },
  signin: { title: 'Welcome back', body: 'Sign in to get your streak, alarms and settings back.' },
  forgot: { title: 'Reset your password', body: "Enter your email and we'll send you a code to set a new password." },
  code: { title: 'Check your email', body: 'Enter the code we sent you. It can take a minute to arrive, so check your spam folder too.' },
  newpassword: { title: 'Choose a new password', body: 'Pick a new password for your account.' },
};

/** Create an account, sign in, or reset a password. `onClose` leaves (or finishes). */
export function AuthScreen({ onClose, intro }: { onClose: () => void; intro?: boolean }) {
  const auth = useAuth();
  const [mode, setMode] = useState<Mode>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const go = (next: Mode, message: string | null = null) => {
    setMode(next);
    setError(null);
    setNotice(message);
    setPassword('');
    if (next !== 'code') setCode('');
  };

  const checkEmail = () => {
    if (EMAIL.test(email.trim())) return true;
    setError('Enter a valid email address.');
    return false;
  };
  const checkPassword = () => {
    if (password.length >= MIN_PASSWORD) return true;
    setError(`Use a password with at least ${MIN_PASSWORD} characters.`);
    return false;
  };

  const submit = async () => {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      if (mode === 'signup') {
        if (!checkEmail() || !checkPassword()) return;
        const res = await auth.signUp(email, password);
        if (res.error) return setError(res.error);
        if (res.needsConfirmation) {
          return go('signin', 'Almost there: check your email and tap the confirmation link, then sign in here.');
        }
        onClose(); // signed in straight away
      } else if (mode === 'signin') {
        if (!checkEmail() || !checkPassword()) return;
        const res = await auth.signIn(email, password);
        if (res.error) return setError(res.error);
        onClose();
      } else if (mode === 'forgot') {
        if (!checkEmail()) return;
        const res = await auth.requestPasswordReset(email);
        // Same message either way, so the screen never reveals which emails have accounts.
        if (res.error && /rate|limit|seconds/i.test(res.error)) return setError(res.error);
        go('code', 'If that email has an account, a code is on its way.');
      } else if (mode === 'code') {
        const digits = code.replace(/\s/g, '');
        if (!/^\d{6,10}$/.test(digits)) return setError('Enter the numeric code from the email.');
        const res = await auth.verifyResetCode(email, digits);
        if (res.error) return setError('That code is wrong or has expired. Check it, or request a new one.');
        go('newpassword');
      } else {
        if (!checkPassword()) return;
        const res = await auth.setNewPassword(password);
        if (res.error) return setError(res.error);
        onClose(); // signed in with the new password
      }
    } finally {
      setBusy(false);
    }
  };

  const copy = COPY[mode];
  const showEmail = mode === 'signup' || mode === 'signin' || mode === 'forgot';
  const showPassword = mode === 'signup' || mode === 'signin' || mode === 'newpassword';
  const newPassword = mode === 'signup' || mode === 'newpassword';
  const buttonLabel = {
    signup: 'Create account',
    signin: 'Sign in',
    forgot: 'Send code',
    code: 'Continue',
    newpassword: 'Save password',
  }[mode];

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.emoji}>{mode === 'signup' || mode === 'signin' ? '🦷' : '🔑'}</Text>
        <Text style={styles.title}>{copy.title}</Text>
        <Text style={styles.body}>{copy.body}</Text>

        {showEmail && (
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            value={email}
            onChangeText={setEmail}
          />
        )}
        {mode === 'code' && (
          <TextInput
            style={[styles.input, styles.codeInput]}
            placeholder="Code"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoComplete="one-time-code"
            autoCorrect={false}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            maxLength={10}
            value={code}
            onChangeText={setCode}
            onSubmitEditing={submit}
          />
        )}
        {showPassword && (
          <TextInput
            style={styles.input}
            placeholder={newPassword ? `${mode === 'newpassword' ? 'New password' : 'Password'} (${MIN_PASSWORD}+ characters)` : 'Password'}
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoComplete={newPassword ? 'new-password' : 'current-password'}
            secureTextEntry
            textContentType={newPassword ? 'newPassword' : 'password'}
            value={password}
            onChangeText={setPassword}
            onSubmitEditing={submit}
          />
        )}

        {error && <Text style={styles.error}>{error}</Text>}
        {notice && <Text style={styles.notice}>{notice}</Text>}

        <Pressable style={[styles.button, busy && styles.disabled]} onPress={submit} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{buttonLabel}</Text>}
        </Pressable>

        {mode === 'signin' && (
          <Pressable onPress={() => go('forgot')}>
            <Text style={styles.link}>Forgot password?</Text>
          </Pressable>
        )}
        {mode === 'code' && (
          <Pressable onPress={() => go('forgot')}>
            <Text style={styles.link}>Send a new code</Text>
          </Pressable>
        )}
        {(mode === 'signup' || mode === 'signin') && (
          <Pressable onPress={() => go(mode === 'signup' ? 'signin' : 'signup')}>
            <Text style={styles.link}>{mode === 'signup' ? 'I already have an account' : 'Create a new account'}</Text>
          </Pressable>
        )}
        {(mode === 'forgot' || mode === 'code') && (
          <Pressable onPress={() => go('signin')}>
            <Text style={styles.link}>Back to sign in</Text>
          </Pressable>
        )}

        <Pressable onPress={onClose} style={styles.skip}>
          <Text style={styles.skipText}>{intro && mode === 'signup' ? 'Maybe later' : 'Cancel'}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  container: { flexGrow: 1, justifyContent: 'center', padding: 28, gap: 14 },
  emoji: { fontSize: 64, textAlign: 'center' },
  title: { fontSize: 28, fontWeight: '800', textAlign: 'center', color: colors.text },
  body: { fontSize: 15, color: colors.muted, textAlign: 'center', lineHeight: 21, marginBottom: 6 },
  input: {
    backgroundColor: '#fff',
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: colors.text,
  },
  codeInput: { textAlign: 'center', fontSize: 28, letterSpacing: 6, fontWeight: '700' },
  error: { color: colors.danger, textAlign: 'center' },
  notice: { color: colors.primaryDark, textAlign: 'center', lineHeight: 20 },
  button: { backgroundColor: colors.primary, paddingVertical: 16, borderRadius: radius.button, alignItems: 'center' },
  disabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  link: { color: colors.primary, fontSize: 15, fontWeight: '600', textAlign: 'center' },
  skip: { alignItems: 'center', padding: 10 },
  skipText: { color: colors.muted, fontSize: 15 },
});
