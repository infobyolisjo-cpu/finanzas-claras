'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Icons } from '@/components/icons';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { AlertTriangle } from 'lucide-react';
import { auth, firestore } from '@/firebase'; // Use the singleton instances
import { useToast } from '@/hooks/use-toast';

const AuthSchema = z.object({
  email: z.string().email({ message: 'Por favor, introduce un correo válido.' }),
  password: z.string().min(6, { message: 'La contraseña debe tener al menos 6 caracteres.' }),
});

type AuthFormValues = z.infer<typeof AuthSchema>;

export function AuthForm({ type }: { type: 'login' | 'signup' }) {
  const router = useRouter();
  const { toast } = useToast();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<AuthFormValues>({
    resolver: zodResolver(AuthSchema),
  });

  const title = type === 'login' ? 'Iniciar Sesión' : 'Crear una cuenta';
  const description = type === 'login' ? 'Bienvenido de nuevo.' : 'Introduce tus datos para empezar.';
  const buttonText = type === 'login' ? 'Iniciar Sesión' : 'Crear cuenta';
  const linkText = type === 'login' ? '¿No tienes una cuenta? Regístrate' : '¿Ya tienes una cuenta? Inicia sesión';
  const linkHref = type === 'login' ? '/signup' : '/login';

  const onSubmit = async (data: AuthFormValues) => {
    setIsSubmitting(true);
    setError(null);
    const { email, password } = data;

    try {
      if (type === 'signup') {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Create user profile in Firestore
        const userDocRef = doc(firestore, 'users', user.uid);
        await setDoc(userDocRef, {
            id: user.uid,
            email: user.email,
            createdAt: serverTimestamp(),
        });

        toast({ title: '¡Cuenta creada!', description: 'Has sido registrado exitosamente.' });
        router.push('/dashboard');

      } else {
        await signInWithEmailAndPassword(auth, email, password);
        toast({ title: '¡Bienvenido!', description: 'Has iniciado sesión correctamente.' });
        router.push('/dashboard');
      }
    } catch (error: any) {
      console.error("Authentication Error:", error.code, error.message);
      let errorMessage = 'Ocurrió un error. Por favor, inténtalo de nuevo.';
      if (error.code) {
        switch (error.code) {
          case 'auth/email-already-in-use':
            errorMessage = 'Este correo electrónico ya está en uso.';
            break;
          case 'auth/user-not-found':
          case 'auth/wrong-password':
          case 'auth/invalid-credential':
            errorMessage = 'Correo electrónico o contraseña incorrectos.';
            break;
          case 'auth/weak-password':
              errorMessage = 'La contraseña es demasiado débil.';
              break;
          default:
            errorMessage = `Error de autenticación: ${error.message}`;
        }
      }
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-full max-w-sm">
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <CardHeader className="text-center">
            <div className="flex justify-center items-center gap-2 mb-4">
                <Icons.logo className="h-8 w-8 text-primary" />
                <CardTitle className="text-3xl font-headline">Finanzas Claras</CardTitle>
            </div>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Correo Electrónico</Label>
            <Input id="email" type="email" placeholder="tu@email.com" {...form.register('email')} />
            {form.formState.errors.email && <p className="text-sm font-medium text-destructive">{form.formState.errors.email.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input id="password" type="password" placeholder="••••••••" {...form.register('password')} />
            {form.formState.errors.password && <p className="text-sm font-medium text-destructive">{form.formState.errors.password.message}</p>}
          </div>
          {error && (
             <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? <Icons.spinner className="mr-2 h-4 w-4 animate-spin" /> : null}
              {buttonText}
            </Button>
          <Button variant="link" asChild className="text-sm font-bold text-foreground no-underline hover:underline">
            <Link href={linkHref}>{linkText}</Link>
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
