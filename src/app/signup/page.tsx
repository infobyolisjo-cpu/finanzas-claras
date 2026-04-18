import { AuthForm } from '@/components/auth/auth-form';

export default function SignupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <AuthForm type="signup" />
    </div>
  );
}
