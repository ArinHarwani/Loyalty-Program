import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { checkRateLimit } from './lib/rateLimit';

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Enforce server-side rate limits on API endpoints
  if (path.startsWith('/api/')) {
    // Exclude webhook (Meta verified signature) and cron triggers (secret verified token)
    if (
      !path.startsWith('/api/whatsapp/webhook') &&
      !path.startsWith('/api/cron/')
    ) {
      const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || (request as NextRequest & { ip?: string }).ip || '127.0.0.1';
      const rateLimitKey = `rl:${ip}:${path}`;
      
      // Limit to 60 requests per minute per IP per API route
      const limitResult = await checkRateLimit(rateLimitKey, 60, 60);
      
      if (!limitResult.success) {
        return new NextResponse(
          JSON.stringify({ error: 'Too many requests. Please try again later.' }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'Retry-After': '60',
              'X-RateLimit-Limit': String(limitResult.limit),
              'X-RateLimit-Remaining': String(limitResult.remaining),
            },
          }
        );
      }
    }
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          response = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // Refresh session if expired - required for Server Components
  // https://supabase.com/docs/guides/auth/server-side/nextjs
  const { data: { user } } = await supabase.auth.getUser();

  // Helper to preserve refreshed cookies on redirect
  const redirect = (path: string) => {
    const redirectResponse = NextResponse.redirect(new URL(path, request.url));
    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value);
    });
    return redirectResponse;
  };

  const { pathname } = request.nextUrl;

  // If user is already logged in and visits login or signup, send them to dashboard
  if (pathname === '/merchant/login' || pathname === '/merchant/signup') {
    if (user) {
      if (user.email === process.env.ADMIN_EMAIL) {
        return redirect('/admin');
      }
      return redirect('/merchant/dashboard');
    }
  }

  // Protect /merchant routes (except /merchant/login and /merchant/signup)
  if (pathname.startsWith('/merchant') && !pathname.startsWith('/merchant/login') && !pathname.startsWith('/merchant/signup')) {
    if (!user) {
      return redirect('/merchant/login');
    }

    // If the logged in user is the admin and they land on dashboard/onboarding, route them to /admin
    if (user.email === process.env.ADMIN_EMAIL && (pathname === '/merchant/dashboard' || pathname === '/merchant/onboarding')) {
      return redirect('/admin');
    }

    // Check subscription status
    const serviceRoleClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        cookies: {
          getAll() { return request.cookies.getAll(); },
          setAll() {},
        },
      }
    );

    const { data: merchant } = await serviceRoleClient
      .from('merchants')
      .select('subscription_status')
      .eq('email', user.email)
      .single();

    if (merchant) {
      // Hard block — cannot access anything
      if (merchant.subscription_status === 'blocked') {
        if (!pathname.startsWith('/merchant/suspended')) {
          return redirect('/merchant/suspended');
        }
      } else if (merchant.subscription_status === 'inactive') {
        // Not yet activated — send to pending page
        if (!pathname.startsWith('/merchant/pending')) {
          return redirect('/merchant/pending');
        }
      } else {
        // Active - restrict access to pending/suspended pages
        if (pathname.startsWith('/merchant/pending') || pathname.startsWith('/merchant/suspended')) {
          return redirect('/merchant/dashboard');
        }
      }
    }
  }

  // Protect /admin routes
  if (pathname.startsWith('/admin')) {
    if (!user || user.email !== process.env.ADMIN_EMAIL) {
      return redirect('/merchant/login');
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
