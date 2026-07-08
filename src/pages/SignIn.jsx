import React, { useState } from 'react';
import HuddlMark from '@/components/HuddlMark';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/AuthContext';
import { ALLOWED_AUTH_EMAIL_DOMAIN, BLOCKED_AUTH_EMAIL_DOMAIN } from '@/lib/authPolicy';

const domainHint = BLOCKED_AUTH_EMAIL_DOMAIN
  ? 'any Google account'
  : `your @${ALLOWED_AUTH_EMAIL_DOMAIN} Google account`;

const GoogleIcon = () => (
  <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" aria-hidden>
    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);

export default function SignIn() {
  const { signInWithGoogle, signInWithEmailPassword, signUpWithEmailPassword, sendPasswordReset } = useAuth();

  const [mode, setMode] = useState('signin'); // 'signin' | 'register' | 'forgot'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleEmailSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === 'forgot') {
        await sendPasswordReset(email);
        setMode('signin');
      } else if (mode === 'register') {
        await signUpWithEmailPassword(email, password);
      } else {
        await signInWithEmailPassword(email, password);
      }
    } finally {
      setLoading(false);
    }
  }

  const title = mode === 'register' ? 'Create your account' : mode === 'forgot' ? 'Reset your password' : 'Sign in to Huddl';
  const submitLabel = mode === 'register' ? 'Create account' : mode === 'forgot' ? 'Send reset link' : 'Sign in';

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background">
      <div className="w-full max-w-md rounded-2xl border border-border/60 bg-card p-8 shadow-lg space-y-6">
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <HuddlMark className="w-16 h-16 rounded-2xl shadow-sm" />
          </div>
          <div>
            <h1 className="font-heading text-2xl font-bold tracking-tight">{title}</h1>
            {mode === 'signin' && (
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                Use <span className="text-foreground font-medium">{domainHint}</span>.
                Your Huddl Boards and Circles stay in sync across devices.
              </p>
            )}
            {mode === 'forgot' && (
              <p className="text-sm text-muted-foreground mt-2">
                Enter your email and we'll send a link to reset your password.
              </p>
            )}
          </div>
        </div>

        {mode !== 'forgot' && (
          <>
            <Button
              type="button"
              variant="outline"
              className="w-full rounded-xl h-11 text-base"
              onClick={() => signInWithGoogle()}
              disabled={loading}
            >
              <GoogleIcon />
              Continue with Google
            </Button>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground">or</span>
              <div className="flex-1 h-px bg-border" />
            </div>
          </>
        )}

        <form onSubmit={handleEmailSubmit} className="space-y-3">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full h-11 rounded-xl border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          {mode !== 'forgot' && (
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full h-11 rounded-xl border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          )}
          {mode === 'signin' && (
            <div className="text-right">
              <button
                type="button"
                onClick={() => setMode('forgot')}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Forgot password?
              </button>
            </div>
          )}
          <Button type="submit" className="w-full rounded-xl h-11 text-base" disabled={loading}>
            {loading ? 'Please wait…' : submitLabel}
          </Button>
        </form>

        <div className="text-center text-sm text-muted-foreground">
          {mode === 'signin' && (
            <>
              Don't have an account?{' '}
              <button onClick={() => setMode('register')} className="text-foreground font-medium hover:underline">
                Create one
              </button>
            </>
          )}
          {mode === 'register' && (
            <>
              Already have an account?{' '}
              <button onClick={() => setMode('signin')} className="text-foreground font-medium hover:underline">
                Sign in
              </button>
            </>
          )}
          {mode === 'forgot' && (
            <button onClick={() => setMode('signin')} className="text-foreground font-medium hover:underline">
              Back to sign in
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
