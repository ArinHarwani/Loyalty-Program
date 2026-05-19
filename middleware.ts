// ============================================================
// LoyaltyQR — Middleware (Auth Protection)
// ============================================================

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes — no auth needed
  if (
    pathname === '/' ||
    pathname.startsWith('/scan') ||
    pathname.startsWith('/progress') ||
    pathname.startsWith('/api/whatsapp') ||
    pathname.startsWith('/api/cron') ||
    pathname.startsWith('/merchant/login') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon')
  ) {
    return NextResponse.next();
  }

  // Create Supabase client with cookie-based auth
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.error('Middleware Error: Supabase env vars are missing.');
    // If we're missing env vars, just redirect away from protected routes to avoid 500 errors
    if (pathname.startsWith('/merchant') || pathname.startsWith('/admin')) {
      return NextResponse.redirect(new URL('/', request.url));
    }
    return response;
  }

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value)
            );
            response = NextResponse.next({
              request: { headers: request.headers },
            });
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Protect /merchant/* routes
    if (pathname.startsWith('/merchant') && !user) {
      return NextResponse.redirect(new URL('/merchant/login', request.url));
    }

    // Protect /admin/* routes
    if (pathname.startsWith('/admin')) {
      if (!user) {
        return NextResponse.redirect(new URL('/merchant/login', request.url));
      }
      if (user.email !== process.env.ADMIN_EMAIL) {
        return NextResponse.redirect(new URL('/', request.url));
      }
    }

    return response;
  } catch (error) {
    console.error('Middleware execution error:', error);
    // If the middleware crashes (e.g., Supabase error), fail gracefully
    if (pathname.startsWith('/merchant') || pathname.startsWith('/admin')) {
      return NextResponse.redirect(new URL('/', request.url));
    }
    return response;
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
