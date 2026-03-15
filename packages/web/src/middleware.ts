import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const isProtected = createRouteMatcher([
  '/dashboard(.*)',
  '/onboarding(.*)',
  '/oauth/authorize(.*)',
]);

const isAuthPage = createRouteMatcher(['/login(.*)', '/register(.*)']);

export default clerkMiddleware(async (auth, req) => {
  if (isProtected(req)) {
    await auth.protect();
    return;
  }

  // Redirect logged-in users away from landing / auth pages
  const { userId } = await auth();
  if (userId) {
    const url = req.nextUrl;
    if (url.pathname === '/' || isAuthPage(req)) {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }
  }
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
