import { redirect } from 'next/navigation';

export default function Home() {
    // Redirect to auth page - the protected layout will handle redirecting to dashboard if logged in
    redirect('/auth');
}