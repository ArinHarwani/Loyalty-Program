import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Skip middleware for public routes completely to prevent unnecessary edge execution
  if (
    pathname === '/' ||
    pathname.startsWith('/scan') ||
    pathname.startsWith('/progress') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/merchant/login') ||
    pathname.startsWith('/merchant/onboarding') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon')
  ) {
    return NextResponse.next();
  }

  // 2. We are now in a protected route context (/merchant/* or /admin/*)
  // Check if env vars are present before creating the Supabase client
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    // Missing env vars, redirect to home to avoid 500 error
    console.error('Missing Supabase environment variables in Vercel');
    return NextResponse.redirect(new URL('/', request.url));
  }

  try {
    let supabaseResponse = NextResponse.next({
      request: {
        headers: request.headers,
      },
    });

    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value }) => {
              request.cookies.set(name, value);
            });
          } catch (e) {
            // Edge runtime may throw when mutating request cookies. This is a known Next.js quirk.
            // We can safely ignore it because we're setting it on the response below.
          }
          
          supabaseResponse = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    });

    // 3. Verify user authentication
    const { data: { user } } = await supabase.auth.getUser();

    // 4. Handle Routing logic
    if (pathname.startsWith('/admin')) {
      if (!user || user.email !== process.env.ADMIN_EMAIL) {
        return NextResponse.redirect(new URL('/', request.url));
      }
    } else if (pathname.startsWith('/merchant')) {
      if (!user) {
        return NextResponse.redirect(new URL('/merchant/login', request.url));
      }
    }

    return supabaseResponse;
  } catch (error) {
    console.error('Middleware execution error:', error);
    // Graceful fallback
    return NextResponse.redirect(new URL('/', request.url));
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
